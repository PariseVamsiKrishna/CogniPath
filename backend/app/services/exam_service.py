import asyncio
import json
import hashlib
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import settings
from app.models.models import (
    Course,
    Exam,
    ExamQuestion,
    ExamSubmission,
    Module,
    ModuleResource,
    StudentBadge,
    Topic,
    User,
)
from app.schemas.schemas import (
    AISuggestionItem,
    ExamSubmitItem,
    ExamSubmitResponse,
    RAGMCQItem,
)
from app.services.chroma_service import chroma_service

logger = logging.getLogger("cognipath.exams")

class ExamService:
    """Handles Dual-Engine Exam & Quiz building, AI Suggestions, DnD Ordering, and Verified Badging."""

    async def generate_ai_suggestions(
        self,
        course_id: int,
        module_id: int | None = None,
        topic: str = "Computer Science Concepts",
        count: int = 4,
        difficulty: str = "Intermediate",
        db: Optional[AsyncSession] = None
    ) -> List[AISuggestionItem]:
        """Generates dynamic MCQ questions grounded in course video concepts and lecture notes."""
        context_chunks: List[str] = []
        video_summaries: List[str] = []
        course_title = f"Course {course_id}"

        # 1. Fetch DB video lectures, topics, and descriptions
        if db:
            try:
                c_res = await db.execute(select(Course).where(Course.id == course_id))
                c_obj = c_res.scalars().first()
                if c_obj:
                    course_title = c_obj.title

                if module_id:
                    m_res = await db.execute(select(Module).where(Module.id == module_id))
                    modules = m_res.scalars().all()
                else:
                    m_res = await db.execute(select(Module).where(Module.course_id == course_id).order_by(Module.order_index.asc()))
                    modules = m_res.scalars().all()

                for m in modules:
                    t_res = await db.execute(select(Topic).where(Topic.module_id == m.id).order_by(Topic.order_index.asc()))
                    topics = t_res.scalars().all()
                    for t in topics:
                        desc = t.description or "Core theoretical foundation and application."
                        video_summaries.append(f"Module: {m.title} | Video Lecture: {t.title}\nKey Concepts Taught: {desc}")
            except Exception as e:
                logger.warning(f"Error fetching course video concepts for assessment: {e}")

        # 2. Retrieve vector store context chunks
        try:
            results = await chroma_service.query_similar(course_id, topic, n_results=count + 2)
            docs = results.get("documents", [[]])[0]
            context_chunks = [d for d in docs if d and len(d.strip()) > 0]
        except Exception as e:
            logger.warning(f"Vector search notice during exam AI suggestion: {e}")

        video_context_str = "\n\n".join(video_summaries) if video_summaries else f"Course: {course_title} - {topic}"
        context_str = "\n\n---\n\n".join(context_chunks) if context_chunks else f"Core topics for {topic}"

        # 3. Prefer Google Gemini generation
        try:
            from app.services.rag_service import rag_service
            if hasattr(rag_service, '_gemini_client') and rag_service._gemini_client and settings.GEMINI_API_KEY:
                prompt = f"""You are a master academic assessment designer and university professor.
Generate exactly {count} rigorous, high-quality Multiple Choice Questions (MCQs) for the course "{course_title}".
Target Difficulty: {difficulty}.
Focus Area: {topic}.

THE COURSE CURRICULUM CONTAINS THE FOLLOWING VIDEO LECTURES AND CONCEPTS:
{video_context_str}

SUPPLEMENTARY COURSE NOTES & EXCERPTS:
{context_str}

STRICT JSON OUTPUT FORMAT:
Return ONLY a valid JSON array of objects without any markdown code fences, backticks, or other text.
Each object must have EXACTLY these fields:
- "question_type": "MCQ"
- "question_text": clear, unambiguous question testing an essential concept or invariant taught in the lectures
- "options": an array of exactly 4 strings ["Option A", "Option B", "Option C", "Option D"]
- "correct_answer": "0", "1", "2", or "3" (the 0-based index of the correct option)
- "explanation": a concise pedagogical explanation explaining why the correct option is true and why others are false
- "source_ref": citation string referencing the relevant video lecture or module (e.g. "{course_title}, Lecture Notes")
- "bloom_level": "APPLY", "ANALYZE", or "UNDERSTAND"
"""
                resp = await asyncio.to_thread(
                    rag_service._gemini_client.models.generate_content,
                    model=settings.GEMINI_MODEL_NAME,
                    contents=prompt
                )
                raw = resp.text.strip()
                raw = raw.removeprefix("```json")
                raw = raw.removeprefix("```")
                raw = raw.removesuffix("```")
                parsed = json.loads(raw.strip())
                if isinstance(parsed, list) and len(parsed) >= 1:
                    items = []
                    for q in parsed:
                        opts = q.get("options")
                        if not opts or not isinstance(opts, list) or len(opts) < 4:
                            opts = ["Option A", "Option B", "Option C", "Option D"]
                        items.append(AISuggestionItem(
                            temp_id=f"sug_{uuid.uuid4().hex[:6]}",
                            question_type="MCQ",
                            question_text=q.get("question_text", "Conceptual Question"),
                            options=opts[:4],
                            correct_answer=str(q.get("correct_answer", "0")),
                            explanation=q.get("explanation", f"Based on {topic} principles."),
                            source_ref=q.get("source_ref", f"{topic} Core Notes"),
                            bloom_level=q.get("bloom_level", "UNDERSTAND")
                        ))
                    return items
        except Exception as e:
            logger.warning(f"AI exam suggestion fallback notice: {e}")

        # 4. Dynamic Topic Fallback
        return [
            AISuggestionItem(
                temp_id=f"sug_{uuid.uuid4().hex[:6]}",
                question_type="MCQ",
                question_text=f"Which core architectural principle governs the operational efficiency of {topic}?",
                options=[
                    "Strict invariant preservation guaranteeing bounded logarithmic/linear search",
                    "Arbitrary memory mutation without structural synchronization",
                    "Single-threaded sequential lookups across unindexed memory arrays",
                    "Deprecated legacy pointer structures unsuitable for concurrent access"
                ],
                correct_answer="0",
                explanation=f"{topic} relies on explicit ordering invariants to bound operational complexity.",
                source_ref=f"{topic} Fundamental Principles, Page 1",
                bloom_level="UNDERSTAND"
            ),
            AISuggestionItem(
                temp_id=f"sug_{uuid.uuid4().hex[:6]}",
                question_type="SHORT_ANSWER",
                question_text=f"Explain how pathological or skewed input sequences affect the worst-case time complexity of {topic}.",
                options=None,
                correct_answer="Skewed insertions eliminate balanced branching, causing tree or graph structures to degenerate into linear chains operating in O(N) time.",
                explanation=f"Balance preservation is essential in {topic} to prevent worst-case linear degradation.",
                source_ref=f"{topic} Complexity Analysis, Page 3",
                bloom_level="ANALYZE"
            ),
            AISuggestionItem(
                temp_id=f"sug_{uuid.uuid4().hex[:6]}",
                question_type="MCQ",
                question_text=f"When applying {topic} in production distributed systems, what is the primary engineering trade-off?",
                options=[
                    "Guaranteed query latency vs write-time rebalancing/synchronization overhead",
                    "Zero CPU memory footprint vs infinite cache invalidations",
                    "Unlimited throughput with complete loss of consistency",
                    "Eliminating all algorithmic space complexity entirely"
                ],
                correct_answer="0",
                explanation="Rebalancing and invariant checks require constant-time pointer updates during write operations.",
                source_ref=f"{topic} Applied Engineering Guide",
                bloom_level="APPLY"
            )
        ]

def check_mcq_answer(selected: Any, correct: Any, options_raw: Any) -> bool:
    """Robust MCQ answer checker that normalizes between 0-based indices, letters (A-E), and option text."""
    if selected is None or correct is None:
        return False
    sel_str = str(selected).strip().lower()
    cor_str = str(correct).strip().lower()
    if sel_str == cor_str:
        return True

    letter_to_idx = {"a": "0", "b": "1", "c": "2", "d": "3", "e": "4"}
    idx_to_letter = {"0": "a", "1": "b", "2": "c", "3": "d", "4": "e"}

    # Direct letter <-> index cross-mapping
    if letter_to_idx.get(sel_str) == cor_str or idx_to_letter.get(sel_str) == cor_str:
        return True
    if letter_to_idx.get(cor_str) == sel_str or idx_to_letter.get(cor_str) == sel_str:
        return True

    # Option text matching if options exist
    if options_raw:
        try:
            opts = json.loads(options_raw) if isinstance(options_raw, str) else options_raw
            if isinstance(opts, list):
                if sel_str.isdigit():
                    s_idx = int(sel_str)
                    if 0 <= s_idx < len(opts) and str(opts[s_idx]).strip().lower() == cor_str:
                        return True
                if cor_str.isdigit():
                    c_idx = int(cor_str)
                    if 0 <= c_idx < len(opts) and str(opts[c_idx]).strip().lower() == sel_str:
                        return True
                if sel_str in letter_to_idx:
                    s_idx = int(letter_to_idx[sel_str])
                    if 0 <= s_idx < len(opts) and str(opts[s_idx]).strip().lower() == cor_str:
                        return True
                if cor_str in letter_to_idx:
                    c_idx = int(letter_to_idx[cor_str])
                    if 0 <= c_idx < len(opts) and str(opts[c_idx]).strip().lower() == sel_str:
                        return True
        except Exception:
            pass

    return False


    async def evaluate_submission(
        self,
        exam_id: int,
        student_id: int,
        responses: list[ExamSubmitItem],
        db: AsyncSession
    ) -> ExamSubmitResponse:
        """Evaluates student exam submission, calculates scores, and issues verified digital badge upon completion."""
        # 1. Fetch Exam and Questions
        exam_res = await db.execute(select(Exam).where(Exam.id == exam_id))
        exam = exam_res.scalars().first()
        if not exam:
            raise ValueError(f"Exam #{exam_id} not found")

        q_res = await db.execute(
            select(ExamQuestion).where(ExamQuestion.exam_id == exam_id).order_by(ExamQuestion.order_index)
        )
        questions = q_res.scalars().all()
        q_map = {q.id: q for q in questions}

        total_questions = len(questions)
        if total_questions == 0:
            raise ValueError("Exam has no questions configured.")

        # 2. Grade responses
        correct_count = 0
        evaluated_responses = []

        for resp in responses:
            q = q_map.get(resp.question_id)
            if not q:
                continue

            is_correct = False
            if q.question_type == "MCQ":
                if resp.selected_option is not None:
                    is_correct = check_mcq_answer(resp.selected_option, q.correct_answer, q.options)
            else:
                # Short Answer heuristic check
                ans_text = (resp.short_answer or "").strip().lower()
                model_text = q.correct_answer.strip().lower()
                # Check for significant keyword overlap
                keywords = [w for w in model_text.split() if len(w) > 4]
                match_count = sum(1 for kw in keywords if kw in ans_text)
                is_correct = match_count >= max(1, len(keywords) // 3)

            if is_correct:
                correct_count += 1

            evaluated_responses.append({
                "question_id": q.id,
                "selected_option": resp.selected_option,
                "short_answer": resp.short_answer,
                "is_correct": is_correct,
                "explanation": q.explanation
            })

        score = float(correct_count * 10)  # 10 points per question
        percentage = round((correct_count / total_questions) * 100.0, 2)
        passed = percentage >= exam.passing_score

        # 3. Save Submission Record
        sub_record = ExamSubmission(
            exam_id=exam_id,
            student_id=student_id,
            score=score,
            percentage=percentage,
            passed=passed,
            responses_json=json.dumps(evaluated_responses),
            evaluated_at=datetime.now(timezone.utc)
        )
        db.add(sub_record)
        await db.commit()
        await db.refresh(sub_record)

        # 4. Check for Verified Badge Unlock (If passed final exam or high achievement)
        unlocked_badge_data = None
        if passed:
            course_res = await db.execute(select(Course).where(Course.id == exam.course_id))
            course = course_res.scalars().first()
            user_res = await db.execute(select(User).where(User.id == student_id))
            student = user_res.scalars().first()

            # Check if badge already issued
            badge_res = await db.execute(
                select(StudentBadge).where(
                    StudentBadge.student_id == student_id,
                    StudentBadge.course_id == exam.course_id
                )
            )
            existing_badge = badge_res.scalars().first()
            active_badge = existing_badge

            if not existing_badge and (exam.exam_type == "FINAL_EXAM" or percentage >= 80.0):
                # Mint verifiable SHA-256 hash
                hash_source = f"{student_id}:{exam.course_id}:{datetime.now(timezone.utc).isoformat()}:COGNIPATH_VERIFIED"
                verification_hash = hashlib.sha256(hash_source.encode("utf-8")).hexdigest()

                badge = StudentBadge(
                    student_id=student_id,
                    course_id=exam.course_id,
                    badge_name=f"Verified Scholar: {course.title if course else 'Advanced Computing'}",
                    badge_image_url="https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=300&q=80",
                    difficulty_level=course.difficulty if course else "Intermediate",
                    verification_hash=verification_hash,
                    issued_at=datetime.now(timezone.utc)
                )
                db.add(badge)
                await db.commit()
                await db.refresh(badge)
                active_badge = badge

            if active_badge:
                unlocked_badge_data = {
                    "id": active_badge.id,
                    "badge_name": active_badge.badge_name,
                    "difficulty_level": active_badge.difficulty_level,
                    "verification_hash": active_badge.verification_hash,
                    "student_name": student.full_name if student else "Alex Kumar",
                    "course_title": course.title if course else "Data Structures",
                    "issued_at": active_badge.issued_at.isoformat()
                }

        return ExamSubmitResponse(
            submission_id=sub_record.id,
            exam_id=exam_id,
            score=score,
            percentage=percentage,
            passed=passed,
            total_questions=total_questions,
            correct_count=correct_count,
            evaluated_at=sub_record.evaluated_at,
            unlocked_badge=unlocked_badge_data
        )

    async def generate_module_rag_mcqs(
        self,
        course_id: int,
        module_id: int,
        topic: str | None = None,
        count: int = 4,
        difficulty: str = "Intermediate",
        db: AsyncSession | None = None
    ) -> dict[str, Any]:
        """
        RAG-Powered Module MCQ Generation:
        1. Query vector embeddings strictly filtered by module_id.
        2. Supplement with module lecture topics, titles, and descriptions from DB.
        3. Prompt LLM (Gemini / OpenAI) for structured JSON with exact required schema.
        4. Provide robust topic-aware fallback if LLM/vector store is unavailable.
        """
        sources_used = []
        context_chunks: list[str] = []
        module_title = f"Module {module_id}"

        # 1. Fetch DB ground truth for the module (topics, notes, title)
        if db:
            try:
                mod_res = await db.execute(select(Module).where(Module.id == module_id))
                mod_obj = mod_res.scalars().first()
                if mod_obj:
                    module_title = mod_obj.title
                    sources_used.append(f"Module: {mod_obj.title}")
                    if mod_obj.description:
                        context_chunks.append(f"Module Overview: {mod_obj.description}")

                # Fetch Topics
                top_res = await db.execute(select(Topic).where(Topic.module_id == module_id).order_by(Topic.order_index.asc()))
                topics = top_res.scalars().all()
                for t in topics:
                    sources_used.append(f"Lecture: {t.title}")
                    t_desc = t.description or "Key theoretical foundation and practical implementation."
                    context_chunks.append(f"Topic: {t.title}\nConcept Summary: {t_desc}")

                # Fetch Resources
                res_res = await db.execute(select(ModuleResource).where(ModuleResource.module_id == module_id))
                resources = res_res.scalars().all()
                for r in resources:
                    sources_used.append(f"Notes: {r.title}")
            except Exception as e:
                logger.warning(f"Error fetching DB module details for RAG: {e}")

        # 2. Query Vector Store filtered specifically by module_id
        try:
            vector_res = await chroma_service.query_by_module(
                course_id=course_id,
                module_id=module_id,
                query=topic or module_title,
                n_results=count + 3
            )
            v_docs = vector_res.get("documents", [[]])[0]
            v_metas = vector_res.get("metadatas", [[]])[0]
            for idx, doc in enumerate(v_docs):
                if doc and len(doc.strip()) > 0:
                    context_chunks.append(f"Resource Excerpt: {doc.strip()[:600]}")
                    if idx < len(v_metas) and v_metas[idx].get("doc_title"):
                        sources_used.append(f"Doc: {v_metas[idx]['doc_title']}")
        except Exception as e:
            logger.warning(f"Vector search for module_id={module_id} notice: {e}")

        # Consolidate context
        context_str = "\n\n---\n\n".join(context_chunks) if context_chunks else f"Core subject matter for {module_title}."

        # 3. Invoke Google Gemini LLM with Strict JSON Schema
        try:
            from app.services.rag_service import rag_service
            if hasattr(rag_service, '_gemini_client') and rag_service._gemini_client and settings.GEMINI_API_KEY:
                prompt = f"""You are a master academic assessment designer.
Generate exactly {count} rigorous, high-quality Multiple Choice Questions (MCQs) for the curriculum module: "{module_title}".
Target Difficulty: {difficulty}.
Focus Area: {topic or 'Comprehensive Module Coverage'}.

GROUND QUESTIONS STRICTLY IN THE FOLLOWING MODULE CONTENT:
{context_str}

STRICT JSON OUTPUT REQUIREMENT:
Return ONLY a valid JSON array of objects. Do NOT include markdown code blocks, backticks, or any extraneous text.
Each JSON object must have EXACTLY these fields:
- "question_id": a valid unique UUID string (e.g. "b5e9f4e2-6d2c-4f81-a831-5231dfb19401")
- "question_text": clear, unambiguous question prompt testing an essential invariant or application
- "options": an array of exactly 4 strings ["Option A text", "Option B text", "Option C text", "Option D text"]
- "correct_option": one letter among "A", "B", "C", or "D"
- "explanation": a concise, pedagogical explanation explaining why the correct option is true and others are false
- "source_reference": exact snippet or lecture reference from the module material (e.g. "{module_title}, Section 2.1")
"""
                resp = await asyncio.to_thread(
                    rag_service._gemini_client.models.generate_content,
                    model=settings.GEMINI_MODEL_NAME,
                    contents=prompt
                )
                raw = resp.text.strip()
                raw = raw.removeprefix("```json")
                raw = raw.removeprefix("```")
                raw = raw.removesuffix("```")
                parsed = json.loads(raw.strip())
                if isinstance(parsed, list) and len(parsed) >= 1:
                    questions = []
                    for item in parsed:
                        q_id = str(item.get("question_id") or uuid.uuid4())
                        options = item.get("options") or ["True", "False", "Partially", "None"]
                        if len(options) < 4:
                            options = (options + ["None of the above", "All of the above"])[:4]
                        corr = str(item.get("correct_option", "A")).upper().strip()
                        if corr not in ["A", "B", "C", "D"]:
                            corr = "A"
                        questions.append(RAGMCQItem(
                            question_id=q_id,
                            question_text=item.get("question_text", f"Key invariant for {module_title}"),
                            options=options[:4],
                            correct_option=corr,
                            explanation=item.get("explanation", f"Validated by {module_title} curriculum standards."),
                            source_reference=item.get("source_reference", f"{module_title} Verified Material")
                        ))
                    return {
                        "module_id": module_id,
                        "course_id": course_id,
                        "count": len(questions),
                        "questions": questions,
                        "sources_used": list(set(sources_used))
                    }
        except Exception as e:
            logger.warning(f"Gemini RAG MCQ generation failed or fallback triggered: {e}")

        # 4. Deterministic Domain-Aware Fallback
        fallback_mcqs = [
            RAGMCQItem(
                question_id=str(uuid.uuid4()),
                question_text=f"In the context of {module_title}, what is the primary algorithmic or structural objective of the core methods presented?",
                options=[
                    "Minimizing asymptotic time complexity and preserving balanced invariants",
                    "Maximizing auxiliary memory allocation regardless of cache efficiency",
                    "Bypassing deterministic validation in favor of unverified pointers",
                    "Eliminating constant-time lookup guarantees entirely"
                ],
                correct_option="A",
                explanation=f"Core modules in {module_title} are designed to balance structural constraints while guaranteeing optimal worst-case asymptotic bounds.",
                source_reference=f"{module_title}: Structural Principles"
            ),
            RAGMCQItem(
                question_id=str(uuid.uuid4()),
                question_text=f"Which condition must hold true to prevent edge-case degradation during state transitions in {module_title}?",
                options=[
                    "State invariants must be satisfied prior to and following every mutating operation",
                    "Mutations should ignore pointer reassignments until garbage collection",
                    "All recursive depths must exceed heap allocation limits",
                    "Dynamic balance factors should be evaluated only after runtime errors occur"
                ],
                correct_option="A",
                explanation="In all robust computer science architectures, class and data invariants must be maintained as pre-conditions and post-conditions of operations.",
                source_reference=f"{module_title}: Invariant Verification"
            ),
            RAGMCQItem(
                question_id=str(uuid.uuid4()),
                question_text=f"When analyzing space complexity for techniques in {module_title}, what is the space consumed by call-stack recursion?",
                options=[
                    "O(h) where h is the maximum depth of the active recursion stack",
                    "Strictly O(1) regardless of recursion tree depth",
                    "Always O(N^2) for any divide-and-conquer strategy",
                    "O(0) because stack frames exist purely in hardware registers"
                ],
                correct_option="A",
                explanation="Each recursive activation frame placed on the runtime call stack contributes proportionally to the recursion tree height h.",
                source_reference=f"{module_title}: Space Complexity Analysis"
            ),
            RAGMCQItem(
                question_id=str(uuid.uuid4()),
                question_text=f"How does the {module_title} implementation handle concurrent or sequential updates efficiently?",
                options=[
                    "By leveraging localized sub-tree updates and logarithmic re-balancing",
                    "By re-initializing the entire data hierarchy from scratch",
                    "By converting all operations into linear scan traversals",
                    "By deferring all updates indefinitely without synchronization"
                ],
                correct_option="A",
                explanation="Localized updates preserve the logarithmic execution properties of hierarchical structures without necessitating global re-indexing.",
                source_reference=f"{module_title}: Performance Optimization"
            )
        ]

        return {
            "module_id": module_id,
            "course_id": course_id,
            "count": len(fallback_mcqs[:count]),
            "questions": fallback_mcqs[:count],
            "sources_used": list(set(sources_used)) or [f"{module_title} Verified Notes"]
        }

exam_service = ExamService()
