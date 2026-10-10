import hashlib
import json
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy.future import select

from app.core.database import AsyncSessionLocal
from app.core.security import get_password_hash
from app.models.models import (
    Assignment,
    CommunityChannel,
    CommunityMessage,
    Course,
    Document,
    Enrollment,
    Exam,
    ExamQuestion,
    LearningPod,
    Module,
    ModuleResource,
    Quiz,
    QuizQuestion,
    StudentActivityLog,
    StudentBadge,
    StudentConceptRetention,
    StudentQuizAttempt,
    Topic,
    User,
)
from app.services.chroma_service import chroma_service

logger = logging.getLogger("cognipath.seed")

async def ensure_curriculum_vectors(course_dsa_id: int = 1, course_ai_id: int = 2):
    """Ensures vector store is populated with verified lecture chunks."""
    try:
        coll_dsa = chroma_service.get_or_create_collection(course_dsa_id)
        if coll_dsa.count() == 0:
            dsa_chunks = [
                "A Binary Search Tree (BST) is a node-based binary tree data structure where each node has at most two children. The left subtree of a node contains only keys lesser than the node's key, and the right subtree contains only keys greater than the node's key. For balanced trees like AVL or Red-Black trees, lookup, insertion, and deletion operate in O(log N) time.",
                "In an unbalanced Binary Search Tree, degenerate conditions can cause worst-case time complexity to degrade to O(N), equivalent to a singly linked list. To preserve O(log N) guarantees, self-balancing rotations are performed whenever height invariants are violated.",
                "In-order traversal of a Binary Search Tree (left-root-right) always yields nodes in non-decreasing sorted order. Pre-order traversal is commonly used to serialize or clone tree structures."
            ]
            dsa_meta = [
                {"course_id": course_dsa_id, "document_id": 1, "doc_title": "CS101_Lecture_04_Trees_and_BST.pdf", "page": 1, "topic": "Binary Search Trees"},
                {"course_id": course_dsa_id, "document_id": 1, "doc_title": "CS101_Lecture_04_Trees_and_BST.pdf", "page": 2, "topic": "Binary Search Trees"},
                {"course_id": course_dsa_id, "document_id": 1, "doc_title": "CS101_Lecture_04_Trees_and_BST.pdf", "page": 3, "topic": "Binary Search Trees"}
            ]
            dsa_ids = [f"dsa_chunk_{i}" for i in range(len(dsa_chunks))]
            await chroma_service.add_chunks(course_dsa_id, dsa_chunks, dsa_meta, dsa_ids)

        coll_ai = chroma_service.get_or_create_collection(course_ai_id)
        if coll_ai.count() == 0:
            ai_chunks = [
                "The Attention Mechanism in Transformers allows neural networks to focus on specific parts of an input sequence regardless of distance. The core formula calculates Attention(Q, K, V) = softmax((Q * K^T) / sqrt(d_k)) * V, where Q is Queries, K is Keys, and V is Values.",
                "Multi-Head Attention projects Queries, Keys, and Values into multiple lower-dimensional representation subspaces, enabling the model to jointly attend to information from different representation positions simultaneously."
            ]
            ai_meta = [
                {"course_id": course_ai_id, "document_id": 2, "doc_title": "AI201_Lecture_02_Attention_Mechanism.pdf", "page": 1, "topic": "Attention Mechanism"},
                {"course_id": course_ai_id, "document_id": 2, "doc_title": "AI201_Lecture_02_Attention_Mechanism.pdf", "page": 2, "topic": "Attention Mechanism"}
            ]
            ai_ids = [f"ai_chunk_{i}" for i in range(len(ai_chunks))]
            await chroma_service.add_chunks(course_ai_id, ai_chunks, ai_meta, ai_ids)
    except Exception as e:
        logger.warning(f"Vector store indexing notice: {e}")

async def ensure_hierarchical_curriculum_data(db):
    """
    Self-healing curriculum populator.
    Ensures that CS101 and AI201 have complete modules, YouTube video topics,
    PDF resources, module exams with questions, and final course certification exams.
    Works seamlessly on local SQLite and Supabase PostgreSQL.
    """
    educator = (await db.execute(select(User).where(User.role == "EDUCATOR"))).scalars().first()
    ed_id = educator.id if educator else 1

    # =========================================================================
    # 1. CS101 (Data Structures & Algorithms)
    # =========================================================================
    course_1 = (await db.execute(select(Course).where(Course.code == "CS101"))).scalars().first()
    if not course_1:
        course_1 = (await db.execute(select(Course).order_by(Course.id.asc()))).scalars().first()

    if course_1:
        c1_id = course_1.id

        # Module 1
        m1 = (await db.execute(select(Module).where(Module.course_id == c1_id, Module.order_index == 1))).scalars().first()
        if not m1:
            m1 = Module(
                course_id=c1_id,
                title="Module 1: Foundations of Binary Search Trees",
                description="Master binary search tree invariants, left-root-right structure, and recursion algorithms.",
                order_index=1,
                has_module_exam=True
            )
            db.add(m1)
            await db.commit()
            await db.refresh(m1)

        # Topics for Module 1
        m1_topics = (await db.execute(select(Topic).where(Topic.module_id == m1.id))).scalars().all()
        if not m1_topics:
            t1 = Topic(
                module_id=m1.id,
                title="BST Invariants, Properties & Architecture",
                description="Deep dive into node pointers, parent-child invariants, and key insertion mechanics.",
                youtube_url="https://www.youtube.com/watch?v=qH6clASSS54",
                youtube_video_id="qH6clASSS54",
                order_index=1
            )
            t2 = Topic(
                module_id=m1.id,
                title="In-Order, Pre-Order & Post-Order Traversals",
                description="Explore depth-first traversal algorithms and mathematical non-decreasing sorting proofs.",
                youtube_url="https://www.youtube.com/watch?v=WLvU5EQVZqY",
                youtube_video_id="WLvU5EQVZqY",
                order_index=2
            )
            db.add_all([t1, t2])
            await db.commit()

        # Resource for Module 1
        m1_res = (await db.execute(select(ModuleResource).where(ModuleResource.module_id == m1.id))).scalars().all()
        if not m1_res:
            res1 = ModuleResource(
                module_id=m1.id,
                title="CS101 Lecture 04: Trees & BST Reference Notes",
                file_url="/uploads/CS101_Lecture_04_Trees_and_BST.pdf",
                file_type="pdf",
                is_view_only=True,
                chunk_count=3
            )
            db.add(res1)
            await db.commit()

        # Exam for Module 1
        exam1 = (await db.execute(select(Exam).where(Exam.course_id == c1_id, Exam.module_id == m1.id))).scalars().first()
        if not exam1:
            exam1 = Exam(
                course_id=c1_id,
                module_id=m1.id,
                exam_type="MODULE_QUIZ",
                scope="MODULE_END",
                title="Module 1: BST Invariants & Traversals Quiz",
                time_limit_mins=15,
                passing_score=60.0,
                created_by=ed_id
            )
            db.add(exam1)
            await db.commit()
            await db.refresh(exam1)

        if m1.module_exam_id != exam1.id or not m1.has_module_exam:
            m1.module_exam_id = exam1.id
            m1.has_module_exam = True
            await db.commit()

        e1_qs = (await db.execute(select(ExamQuestion).where(ExamQuestion.exam_id == exam1.id))).scalars().all()
        if not e1_qs:
            eq1 = ExamQuestion(
                exam_id=exam1.id,
                question_type="MCQ",
                question_text="Which traversal order of a Binary Search Tree produces strictly ascending sorted values?",
                options=json.dumps(["In-order traversal (Left, Root, Right)", "Pre-order traversal (Root, Left, Right)", "Post-order traversal (Left, Right, Root)", "Breadth-First Level Order"]),
                correct_answer="0",
                explanation="In-order traversal processes left child, current node, and right child, producing non-decreasing sorted keys.",
                source_ref="CS101 Lecture 04, Slide 12",
                order_index=1
            )
            eq2 = ExamQuestion(
                exam_id=exam1.id,
                question_type="MCQ",
                question_text="What is the worst-case lookup time complexity of an unbalanced degenerate Binary Search Tree?",
                options=json.dumps(["O(log N)", "O(N)", "O(1)", "O(N log N)"]),
                correct_answer="1",
                explanation="When keys are inserted in sorted order, the BST degenerates into a linear singly linked list with O(N) operations.",
                source_ref="CS101 Lecture 04, Slide 18",
                order_index=2
            )
            eq3 = ExamQuestion(
                exam_id=exam1.id,
                question_type="MCQ",
                question_text="In a valid Binary Search Tree, where are keys strictly smaller than the current node located?",
                options=json.dumps(["Left subtree", "Right subtree", "Any leaf node", "Direct ancestor"]),
                correct_answer="0",
                explanation="The BST property states that all keys in the left subtree must be less than the node's key.",
                source_ref="CS101 Lecture 04, Slide 5",
                order_index=3
            )
            db.add_all([eq1, eq2, eq3])
            await db.commit()

        # Module 2
        m2 = (await db.execute(select(Module).where(Module.course_id == c1_id, Module.order_index == 2))).scalars().first()
        if not m2:
            m2 = Module(
                course_id=c1_id,
                title="Module 2: Self-Balancing Trees & Rotations",
                description="AVL balance factors, single/double rotations, and asymptotic complexity boundaries.",
                order_index=2,
                has_module_exam=True
            )
            db.add(m2)
            await db.commit()
            await db.refresh(m2)

        m2_topics = (await db.execute(select(Topic).where(Topic.module_id == m2.id))).scalars().all()
        if not m2_topics:
            t3 = Topic(
                module_id=m2.id,
                title="AVL Trees & Single/Double Tree Rotations",
                description="Calculate balance factors and execute clockwise/counter-clockwise pivot rotations.",
                youtube_url="https://www.youtube.com/watch?v=jDM6_TnYIuE",
                youtube_video_id="jDM6_TnYIuE",
                order_index=1
            )
            t4 = Topic(
                module_id=m2.id,
                title="Red-Black Trees & Asymptotic Analysis",
                description="Explore black-height preservation, node recoloring, and strict O(log N) worst-case performance.",
                youtube_url="https://www.youtube.com/watch?v=qvZGUFHWChY",
                youtube_video_id="qvZGUFHWChY",
                order_index=2
            )
            db.add_all([t3, t4])
            await db.commit()

        exam2 = (await db.execute(select(Exam).where(Exam.course_id == c1_id, Exam.module_id == m2.id))).scalars().first()
        if not exam2:
            exam2 = Exam(
                course_id=c1_id,
                module_id=m2.id,
                exam_type="MODULE_QUIZ",
                scope="MODULE_END",
                title="Module 2: Tree Rotations & Balance Mastery Quiz",
                time_limit_mins=15,
                passing_score=60.0,
                created_by=ed_id
            )
            db.add(exam2)
            await db.commit()
            await db.refresh(exam2)

        if m2.module_exam_id != exam2.id or not m2.has_module_exam:
            m2.module_exam_id = exam2.id
            m2.has_module_exam = True
            await db.commit()

        e2_qs = (await db.execute(select(ExamQuestion).where(ExamQuestion.exam_id == exam2.id))).scalars().all()
        if not e2_qs:
            m2_q1 = ExamQuestion(
                exam_id=exam2.id,
                question_type="MCQ",
                question_text="What is the primary condition that triggers an AVL tree rotation?",
                options=json.dumps(["Balance factor becomes greater than +1 or less than -1", "Node has more than two children", "Tree height exceeds 10", "Leaf node is deleted"]),
                correct_answer="0",
                explanation="An AVL tree strictly preserves balance factors in {-1, 0, +1}.",
                source_ref="CS101 Module 2 Notes",
                order_index=1
            )
            m2_q2 = ExamQuestion(
                exam_id=exam2.id,
                question_type="MCQ",
                question_text="Which rotation sequence resolves a Left-Right (LR) imbalance?",
                options=json.dumps(["Left rotation on child, then Right rotation on parent", "Single Right rotation", "Single Left rotation", "Double Right rotation"]),
                correct_answer="0",
                explanation="An LR imbalance requires a left rotation on the left child followed by a right rotation on the parent.",
                source_ref="CS101 Module 2 Notes",
                order_index=2
            )
            m2_q3 = ExamQuestion(
                exam_id=exam2.id,
                question_type="MCQ",
                question_text="What is the worst-case asymptotic search complexity in a Red-Black Tree?",
                options=json.dumps(["O(log N)", "O(N)", "O(1)", "O(N^2)"]),
                correct_answer="0",
                explanation="Red-black trees guarantee strict O(log N) operations by preserving black height invariants.",
                source_ref="CS101 Module 2 Notes",
                order_index=3
            )
            db.add_all([m2_q1, m2_q2, m2_q3])
            await db.commit()

        # Final Certification Exam for CS101
        exam_final = (await db.execute(select(Exam).where(Exam.course_id == c1_id, Exam.exam_type == "FINAL_EXAM"))).scalars().first()
        if not exam_final:
            exam_final = Exam(
                course_id=c1_id,
                module_id=None,
                exam_type="FINAL_EXAM",
                scope="FINAL_COURSE",
                title="CS101: Comprehensive Final Certification Exam",
                time_limit_mins=30,
                passing_score=70.0,
                created_by=ed_id
            )
            db.add(exam_final)
            await db.commit()
            await db.refresh(exam_final)

        ef_qs = (await db.execute(select(ExamQuestion).where(ExamQuestion.exam_id == exam_final.id))).scalars().all()
        if not ef_qs:
            fq1 = ExamQuestion(
                exam_id=exam_final.id,
                question_type="MCQ",
                question_text="What tree rotation is performed to rebalance an AVL node with a Left-Left (LL) insertion imbalance?",
                options=json.dumps(["Single Right (Clockwise) Rotation", "Single Left (Counter-Clockwise) Rotation", "Left-Right Double Rotation", "Right-Left Double Rotation"]),
                correct_answer="0",
                explanation="A single right rotation about the imbalanced node brings the left child up as root and restores balance.",
                source_ref="CS101 Module 2, AVL Rotations",
                order_index=1
            )
            fq2 = ExamQuestion(
                exam_id=exam_final.id,
                question_type="MCQ",
                question_text="What is the maximum allowed balance factor |height(left) - height(right)| in an AVL tree?",
                options=json.dumps(["1", "0", "2", "3"]),
                correct_answer="0",
                explanation="An AVL tree strictly preserves balance factors in the range {-1, 0, +1}.",
                source_ref="CS101 Module 2, Balance Invariants",
                order_index=2
            )
            fq3 = ExamQuestion(
                exam_id=exam_final.id,
                question_type="MCQ",
                question_text="In-order traversal of a binary tree visits nodes in which recursive order?",
                options=json.dumps(["Left Subtree -> Root -> Right Subtree", "Root -> Left Subtree -> Right Subtree", "Right Subtree -> Root -> Left Subtree", "Root -> Right Subtree -> Left Subtree"]),
                correct_answer="0",
                explanation="In-order visits Left, Root, then Right.",
                source_ref="CS101 Traversal Fundamentals",
                order_index=3
            )
            fq4 = ExamQuestion(
                exam_id=exam_final.id,
                question_type="MCQ",
                question_text="Why do self-balancing trees (AVL / Red-Black) outperform basic BSTs in production systems?",
                options=json.dumps(["They guarantee O(log N) worst-case lookup by dynamically controlling tree height", "They allocate zero memory on heap", "They store keys in contiguous cache lines", "They execute faster hashing algorithms"]),
                correct_answer="0",
                explanation="Dynamic balancing prevents tree skewing, ensuring strict logarithmic height bounds.",
                source_ref="CS101 Asymptotic Complexity Analysis",
                order_index=4
            )
            fq5 = ExamQuestion(
                exam_id=exam_final.id,
                question_type="MCQ",
                question_text="Which data structure provides the optimal helper buffer for Breadth-First Level-Order traversal?",
                options=json.dumps(["FIFO Queue", "LIFO Stack", "Max-Heap Priority Queue", "Hash Map"]),
                correct_answer="0",
                explanation="A First-In-First-Out (FIFO) queue guarantees nodes are explored level by level.",
                source_ref="CS101 BFS Algorithms",
                order_index=5
            )
            db.add_all([fq1, fq2, fq3, fq4, fq5])
            await db.commit()

    # =========================================================================
    # 2. AI201 (Deep Learning & Neural Networks)
    # =========================================================================
    course_2 = (await db.execute(select(Course).where(Course.code == "AI201"))).scalars().first()
    if course_2:
        c2_id = course_2.id

        # Module 1
        ai_m1 = (await db.execute(select(Module).where(Module.course_id == c2_id, Module.order_index == 1))).scalars().first()
        if not ai_m1:
            ai_m1 = Module(
                course_id=c2_id,
                title="Module 1: Foundations of Deep Learning & Backpropagation",
                description="Master multi-layer perceptrons, non-linear activation functions, cost surfaces, and the calculus of backpropagation.",
                order_index=1,
                has_module_exam=True
            )
            db.add(ai_m1)
            await db.commit()
            await db.refresh(ai_m1)

        ai_m1_topics = (await db.execute(select(Topic).where(Topic.module_id == ai_m1.id))).scalars().all()
        if not ai_m1_topics:
            t1 = Topic(
                module_id=ai_m1.id,
                title="Perceptrons, Multi-Layer Feedforward Networks & Activations",
                description="Explore artificial neurons, sigmoid/ReLU activation functions, and universal approximation theorems.",
                youtube_url="https://www.youtube.com/watch?v=aircAruvnKk",
                youtube_video_id="aircAruvnKk",
                order_index=1
            )
            t2 = Topic(
                module_id=ai_m1.id,
                title="Gradient Descent & The Mathematics of Backpropagation",
                description="Step-by-step calculus derivation of chain rule gradients propagating error through hidden weight layers.",
                youtube_url="https://www.youtube.com/watch?v=IHZwWFHWa-w",
                youtube_video_id="IHZwWFHWa-w",
                order_index=2
            )
            db.add_all([t1, t2])
            await db.commit()

        ai_m1_res = (await db.execute(select(ModuleResource).where(ModuleResource.module_id == ai_m1.id))).scalars().all()
        if not ai_m1_res:
            res1 = ModuleResource(
                module_id=ai_m1.id,
                title="AI201 Lecture 01: Neural Networks & Backprop Reference Notes",
                file_url="/uploads/CS101_Lecture_04_Trees_and_BST.pdf",
                file_type="pdf",
                is_view_only=True,
                chunk_count=3
            )
            db.add(res1)
            await db.commit()

        ai_exam1 = (await db.execute(select(Exam).where(Exam.course_id == c2_id, Exam.module_id == ai_m1.id))).scalars().first()
        if not ai_exam1:
            ai_exam1 = Exam(
                course_id=c2_id,
                module_id=ai_m1.id,
                exam_type="MODULE_QUIZ",
                scope="MODULE_END",
                title="Module 1: Neural Networks & Backprop Mastery Quiz",
                time_limit_mins=15,
                passing_score=60.0,
                created_by=ed_id
            )
            db.add(ai_exam1)
            await db.commit()
            await db.refresh(ai_exam1)

        if ai_m1.module_exam_id != ai_exam1.id or not ai_m1.has_module_exam:
            ai_m1.module_exam_id = ai_exam1.id
            ai_m1.has_module_exam = True
            await db.commit()

        ai_e1_qs = (await db.execute(select(ExamQuestion).where(ExamQuestion.exam_id == ai_exam1.id))).scalars().all()
        if not ai_e1_qs:
            ai_eqs1 = [
                ExamQuestion(
                    exam_id=ai_exam1.id,
                    question_type="MCQ",
                    question_text="Why are non-linear activation functions (like ReLU or Sigmoid) essential in deep neural networks?",
                    options=json.dumps(["Without non-linearity, multi-layer networks collapse mathematically into a single linear transformation", "They reduce memory consumption to zero", "They eliminate the need for weights", "They guarantee 100% training accuracy"]),
                    correct_answer="0",
                    explanation="A composition of linear functions is just another linear function. Non-linearities enable universal approximation of arbitrary functions.",
                    source_ref="AI201 Module 1, Lecture 1",
                    order_index=1
                ),
                ExamQuestion(
                    exam_id=ai_exam1.id,
                    question_type="MCQ",
                    question_text="What mathematical rule underpins the backpropagation algorithm?",
                    options=json.dumps(["The Chain Rule of Calculus", "Bayes Theorem", "L'Hopital's Rule", "Euclidean Distance Metric"]),
                    correct_answer="0",
                    explanation="Backpropagation computes partial derivatives of the loss with respect to weights using the chain rule.",
                    source_ref="AI201 Module 1, Lecture 2",
                    order_index=2
                ),
                ExamQuestion(
                    exam_id=ai_exam1.id,
                    question_type="MCQ",
                    question_text="What problem in deep networks does the Rectified Linear Unit (ReLU) activation primarily help mitigate?",
                    options=json.dumps(["Vanishing Gradient Problem in positive regimes", "Exploding Memory Allocation", "Matrix Inversion Divergence", "Overfitting on small datasets"]),
                    correct_answer="0",
                    explanation="ReLU has a constant derivative of 1 for positive inputs, preventing gradients from vanishing exponentially.",
                    source_ref="AI201 Module 1, Lecture 1",
                    order_index=3
                )
            ]
            db.add_all(ai_eqs1)
            await db.commit()

        # Module 2
        ai_m2 = (await db.execute(select(Module).where(Module.course_id == c2_id, Module.order_index == 2))).scalars().first()
        if not ai_m2:
            ai_m2 = Module(
                course_id=c2_id,
                title="Module 2: Sequence Models & Transformer Attention Mechanisms",
                description="Explore Recurrent Neural Networks, LSTMs, Scaled Dot-Product Self-Attention, and Transformer architectures.",
                order_index=2,
                has_module_exam=True
            )
            db.add(ai_m2)
            await db.commit()
            await db.refresh(ai_m2)

        ai_m2_topics = (await db.execute(select(Topic).where(Topic.module_id == ai_m2.id))).scalars().all()
        if not ai_m2_topics:
            t3 = Topic(
                module_id=ai_m2.id,
                title="Recurrent Neural Networks, LSTMs & Vanishing Gradients",
                description="Understand sequential data modeling, hidden state recurrence, and gating units (forget, input, output).",
                youtube_url="https://www.youtube.com/watch?v=LHXXI4-IEns",
                youtube_video_id="LHXXI4-IEns",
                order_index=1
            )
            t4 = Topic(
                module_id=ai_m2.id,
                title="Transformer Self-Attention & Query-Key-Value Mechanics",
                description="Demystify the Attention(Q, K, V) = softmax(QK^T / sqrt(d_k))V equation and multi-head parallel attention projections.",
                youtube_url="https://www.youtube.com/watch?v=wjZofJX0v4U",
                youtube_video_id="wjZofJX0v4U",
                order_index=2
            )
            db.add_all([t3, t4])
            await db.commit()

        ai_m2_res = (await db.execute(select(ModuleResource).where(ModuleResource.module_id == ai_m2.id))).scalars().all()
        if not ai_m2_res:
            res2 = ModuleResource(
                module_id=ai_m2.id,
                title="AI201 Lecture 02: Transformer Attention Architecture Notes",
                file_url="/uploads/CS101_Lecture_04_Trees_and_BST.pdf",
                file_type="pdf",
                is_view_only=True,
                chunk_count=3
            )
            db.add(res2)
            await db.commit()

        ai_exam2 = (await db.execute(select(Exam).where(Exam.course_id == c2_id, Exam.module_id == ai_m2.id))).scalars().first()
        if not ai_exam2:
            ai_exam2 = Exam(
                course_id=c2_id,
                module_id=ai_m2.id,
                exam_type="MODULE_QUIZ",
                scope="MODULE_END",
                title="Module 2: Attention & Transformers Mastery Quiz",
                time_limit_mins=15,
                passing_score=60.0,
                created_by=ed_id
            )
            db.add(ai_exam2)
            await db.commit()
            await db.refresh(ai_exam2)

        if ai_m2.module_exam_id != ai_exam2.id or not ai_m2.has_module_exam:
            ai_m2.module_exam_id = ai_exam2.id
            ai_m2.has_module_exam = True
            await db.commit()

        ai_e2_qs = (await db.execute(select(ExamQuestion).where(ExamQuestion.exam_id == ai_exam2.id))).scalars().all()
        if not ai_e2_qs:
            ai_eqs2 = [
                ExamQuestion(
                    exam_id=ai_exam2.id,
                    question_type="MCQ",
                    question_text="In the Scaled Dot-Product Attention formula Attention(Q,K,V) = softmax(QK^T / sqrt(d_k))V, what purpose does sqrt(d_k) scaling serve?",
                    options=json.dumps(["Prevents dot products from growing excessively large and pushing the softmax into regions with vanishingly small gradients", "Normalizes the output tensor to zero mean", "Doubles the sequence length capacity", "Eliminates need for value projection"]),
                    correct_answer="0",
                    explanation="For large projection dimensions d_k, dot products grow large, causing softmax gradients to become dangerously small. Dividing by sqrt(d_k) stabilizes training.",
                    source_ref="AI201 Module 2, Attention",
                    order_index=1
                ),
                ExamQuestion(
                    exam_id=ai_exam2.id,
                    question_type="MCQ",
                    question_text="What is the primary computational advantage of Transformers over standard Recurrent Neural Networks (RNNs)?",
                    options=json.dumps(["Full parallelization across sequence tokens during training", "Zero matrix multiplications", "Inherent recurrence without positional encodings", "Fixed constant parameter count for any vocabulary size"]),
                    correct_answer="0",
                    explanation="Self-attention processes all sequence positions simultaneously rather than sequentially step-by-step.",
                    source_ref="AI201 Module 2, Transformers",
                    order_index=2
                ),
                ExamQuestion(
                    exam_id=ai_exam2.id,
                    question_type="MCQ",
                    question_text="Why do Transformers require Positional Encodings?",
                    options=json.dumps(["Because self-attention is permutation-invariant and has no inherent sense of token order", "To reduce training loss to exactly zero", "To compress sequence length", "To encrypt inputs"]),
                    correct_answer="0",
                    explanation="Self-attention computes token similarity without order awareness. Positional encodings inject sequence order information.",
                    source_ref="AI201 Module 2, Encodings",
                    order_index=3
                )
            ]
            db.add_all(ai_eqs2)
            await db.commit()

        # Final Exam for AI201
        ai_final = (await db.execute(select(Exam).where(Exam.course_id == c2_id, Exam.exam_type == "FINAL_EXAM"))).scalars().first()
        if not ai_final:
            ai_final = Exam(
                course_id=c2_id,
                module_id=None,
                exam_type="FINAL_EXAM",
                scope="FINAL_COURSE",
                title="AI201: Comprehensive Deep Learning & Attention Certification Exam",
                time_limit_mins=30,
                passing_score=70.0,
                created_by=ed_id
            )
            db.add(ai_final)
            await db.commit()
            await db.refresh(ai_final)

        ai_ef_qs = (await db.execute(select(ExamQuestion).where(ExamQuestion.exam_id == ai_final.id))).scalars().all()
        if not ai_ef_qs:
            ai_final_qs = [
                ExamQuestion(
                    exam_id=ai_final.id,
                    question_type="MCQ",
                    question_text="What is the role of Keys (K), Queries (Q), and Values (V) in Multi-Head Self-Attention?",
                    options=json.dumps(["Queries match with Keys to compute relevance weights that are used to average the Values", "Queries represent outputs, Keys are loss functions, Values are gradients", "Keys and Queries are identical linear constants that filter the dataset", "Values are discarded after computing Query dot products"]),
                    correct_answer="0",
                    explanation="Queries query the Keys to determine an attention score distribution, which weights the linear combination of Values.",
                    source_ref="AI201 Final Exam",
                    order_index=1
                ),
                ExamQuestion(
                    exam_id=ai_final.id,
                    question_type="MCQ",
                    question_text="Which optimization algorithm adapts learning rates individually for each parameter using first and second gradient moments?",
                    options=json.dumps(["Adam (Adaptive Moment Estimation)", "Vanilla Stochastic Gradient Descent (SGD)", "Linear Regression", "Bubble Sort"]),
                    correct_answer="0",
                    explanation="Adam computes adaptive learning rates using exponential moving averages of gradients and squared gradients.",
                    source_ref="AI201 Final Exam",
                    order_index=2
                ),
                ExamQuestion(
                    exam_id=ai_final.id,
                    question_type="MCQ",
                    question_text="What is the primary function of Layer Normalization in Transformer blocks?",
                    options=json.dumps(["Stabilizes activations across feature dimensions, facilitating smoother optimization and gradient flow", "Reduces parameter size by 50%", "Replaces the attention mechanism", "Eliminates all negative numbers"]),
                    correct_answer="0",
                    explanation="LayerNorm normalizes inputs across the hidden dimension per token, stabilizing deep Transformer training.",
                    source_ref="AI201 Final Exam",
                    order_index=3
                ),
                ExamQuestion(
                    exam_id=ai_final.id,
                    question_type="MCQ",
                    question_text="In an LSTM cell, which gate decides what information to discard from the cell state?",
                    options=json.dumps(["Forget Gate", "Input Gate", "Output Gate", "Modulation Gate"]),
                    correct_answer="0",
                    explanation="The forget gate applies a sigmoid layer to decide which historical memories to drop from the cell state.",
                    source_ref="AI201 Final Exam",
                    order_index=4
                ),
                ExamQuestion(
                    exam_id=ai_final.id,
                    question_type="MCQ",
                    question_text="Why does Cross-Entropy loss work well with Softmax output layers for multi-class classification?",
                    options=json.dumps(["Its gradient simplifies cleanly to (p - y), avoiding saturation slowdowns when errors are large", "It only outputs integers", "It guarantees zero training time", "It eliminates backpropagation"]),
                    correct_answer="0",
                    explanation="The derivative of cross-entropy combined with softmax yields linear error term (predicted - ground_truth).",
                    source_ref="AI201 Final Exam",
                    order_index=5
                )
            ]
            db.add_all(ai_final_qs)
            await db.commit()

    # 3. Rubric Assignment
    a_check = await db.execute(select(Assignment))
    if not a_check.scalars().first():
        m1 = (await db.execute(select(Module).where(Module.course_id == c_id).order_by(Module.order_index.asc()))).scalars().first()
        if m1:
            logger.info("Seeding assignment with rubrics...")
            rubric = [
                {"criterion": "Tree Invariant & Validation Logic", "max_points": 40.0, "description": "Accurately validates left < root < right invariant recursively across all subtree depths."},
                {"criterion": "Asymptotic Complexity & Mathematical Proof", "max_points": 30.0, "description": "Formally proves why balanced trees maintain O(log N) bounds versus O(N) degenerate skews."},
                {"criterion": "Code Quality, Modularity & Edge Case Handling", "max_points": 30.0, "description": "Handles null roots, single nodes, duplicate keys, and provides clean docstrings."}
            ]
            assign = Assignment(
                module_id=m1.id,
                title="Assignment 1: BST Invariant Verifier & AVL Balancing Engine",
                description="Implement a complete Binary Search Tree invariant validation suite in Python or C++. Provide a 2-page PDF document detailing your mathematical proof of AVL height bounds and empirical rotation benchmarks.",
                assignment_type="PRACTICAL_PDF",
                rubric_json=json.dumps(rubric),
                model_answer="Valid BST implementation includes recursion with min_val and max_val constraints. Balanced height proof uses recurrence relation H(N) <= 1.44 log2(N).",
                max_score=100.0,
                created_at=datetime.now(timezone.utc)
            )
            db.add(assign)
            await db.commit()

    # 4. Student Badges
    b_check = await db.execute(select(StudentBadge))
    if not b_check.scalars().first():
        stu_aarav = (await db.execute(select(User).where(User.email == "student@cognipath.edu"))).scalars().first()
        if stu_aarav:
            logger.info("Seeding verified credential badge for student...")
            v_hash = hashlib.sha256(f"badge_{stu_aarav.id}_course_{c_id}_BST_EXCELLENCE".encode()).hexdigest()
            badge = StudentBadge(
                student_id=stu_aarav.id,
                course_id=c_id,
                badge_name="Binary Search Tree Architect",
                difficulty_level="Advanced Mastery",
                verification_hash=v_hash,
                issued_at=datetime.now(timezone.utc)
            )
            db.add(badge)
            await db.commit()

async def seed_demo_data():
    """Populates realistic demonstration data on startup if database is fresh."""
    async with AsyncSessionLocal() as db:
        # 1. Ensure Educator exists
        educator = (await db.execute(select(User).where(User.email == "teacher@cognipath.edu"))).scalars().first()
        if not educator:
            educator = (await db.execute(select(User).where(User.role == "EDUCATOR"))).scalars().first()
        if not educator:
            educator = User(
                email="teacher@cognipath.edu",
                hashed_password=get_password_hash("password123"),
                full_name="Prof. Rajesh Ramanujan",
                role="EDUCATOR",
                university="Indian Institute of Technology",
                department="Computer Science & Engineering"
            )
            db.add(educator)
            await db.commit()
            await db.refresh(educator)

        # 2. Ensure Students exist
        student_emails = [
            ("student@cognipath.edu", "Aarav Sharma"),
            ("priya@cognipath.edu", "Priya Patel"),
            ("rohit@cognipath.edu", "Rohit Verma"),
            ("ananya@cognipath.edu", "Ananya Iyer"),
        ]
        students = []
        for s_email, s_name in student_emails:
            s_user = (await db.execute(select(User).where(User.email == s_email))).scalars().first()
            if not s_user:
                s_user = User(
                    email=s_email,
                    hashed_password=get_password_hash("password123"),
                    full_name=s_name,
                    role="STUDENT",
                    university="National Institute of Technology",
                    department="Computer Science"
                )
                db.add(s_user)
                await db.commit()
                await db.refresh(s_user)
            students.append(s_user)

        student_aarav = students[0]
        student_priya = students[1]
        student_rohit = students[2]
        student_ananya = students[3]

        # 3. Check if Courses exist
        course_check = await db.execute(select(Course).limit(1))
        if course_check.scalars().first():
            logger.info("Database already contains courses. Ensuring vector collections & hierarchy are indexed...")
            await ensure_curriculum_vectors()
            await ensure_hierarchical_curriculum_data(db)
            return

        logger.info("Seeding initial COGNIPATH demonstration ecosystem...")
        now = datetime.now(timezone.utc)

        # 3. Create Courses
        course_dsa = Course(
            title="Data Structures & Algorithms (CS101)",
            code="CS101",
            description="Fundamental data structures, search trees, asymptotic complexity, and graph algorithms.",
            category="Computer Science",
            difficulty="Intermediate",
            educator_id=educator.id
        )
        course_ai = Course(
            title="Deep Learning & Neural Networks (AI201)",
            code="AI201",
            description="Neural networks, backpropagation, attention mechanisms, and Transformer architectures.",
            category="Artificial Intelligence",
            difficulty="Advanced",
            educator_id=educator.id
        )
        db.add_all([course_dsa, course_ai])
        await db.commit()
        await db.refresh(course_dsa)
        await db.refresh(course_ai)

        # 4. Enrollments
        for s in [student_aarav, student_priya, student_rohit, student_ananya]:
            db.add(Enrollment(user_id=s.id, course_id=course_dsa.id, completion_percentage=65.0))
            db.add(Enrollment(user_id=s.id, course_id=course_ai.id, completion_percentage=45.0))
        await db.commit()

        # 5. Seed Documents
        doc1 = Document(
            course_id=course_dsa.id,
            title="CS101_Lecture_04_Trees_and_BST.pdf",
            file_path="./uploads/CS101_Lecture_04_Trees_and_BST.pdf",
            file_type="pdf",
            chunk_count=3,
            topic="Binary Search Trees",
            uploaded_by=educator.id
        )
        doc2 = Document(
            course_id=course_ai.id,
            title="AI201_Lecture_02_Attention_Mechanism.pdf",
            file_path="./uploads/AI201_Lecture_02_Attention_Mechanism.pdf",
            file_type="pdf",
            chunk_count=3,
            topic="Attention Mechanism",
            uploaded_by=educator.id
        )
        db.add_all([doc1, doc2])
        await db.commit()
        await db.refresh(doc1)
        await db.refresh(doc2)

        # 6. Index Curriculum Chunks in ChromaDB
        await ensure_curriculum_vectors(course_dsa.id, course_ai.id)

        # 7. Seed Quizzes
        quiz_bst = Quiz(
            course_id=course_dsa.id,
            topic="Binary Search Trees",
            title="BST Traversal & Invariants Micro-Quiz",
            difficulty_level="medium",
            created_by=educator.id
        )
        db.add(quiz_bst)
        await db.commit()
        await db.refresh(quiz_bst)

        q1 = QuizQuestion(
            quiz_id=quiz_bst.id,
            question_text="Which traversal order of a Binary Search Tree produces sorted values?",
            options=json.dumps(["In-order traversal", "Pre-order traversal", "Post-order traversal", "Level-order BFS"]),
            correct_option_index=0,
            explanation="In-order traversal (Left -> Node -> Right) visits elements in ascending numerical sequence.",
            source_chunk_ref="CS101_Lecture_04_Trees_and_BST.pdf, Page 3"
        )
        q2 = QuizQuestion(
            quiz_id=quiz_bst.id,
            question_text="What is the worst-case time complexity for search in an unbalanced BST?",
            options=json.dumps(["O(log N)", "O(N)", "O(1)", "O(N log N)"]),
            correct_option_index=1,
            explanation="An unbalanced BST can degenerate into a linked list with worst-case height N.",
            source_chunk_ref="CS101_Lecture_04_Trees_and_BST.pdf, Page 2"
        )
        q3 = QuizQuestion(
            quiz_id=quiz_bst.id,
            question_text="Which property holds true for all nodes in the left subtree of a BST node X?",
            options=json.dumps(["Key < X.key", "Key > X.key", "Key == X.key", "Key >= X.key"]),
            correct_option_index=0,
            explanation="By definition, every node in the left subtree has key strictly less than root key.",
            source_chunk_ref="CS101_Lecture_04_Trees_and_BST.pdf, Page 1"
        )
        db.add_all([q1, q2, q3])
        await db.commit()

        # 8. Seed Student Quiz Attempts
        db.add(StudentQuizAttempt(
            user_id=student_aarav.id,
            quiz_id=quiz_bst.id,
            score=3.0,
            total_questions=3,
            answers_json=json.dumps({str(q1.id): 0, str(q2.id): 1, str(q3.id): 0}),
            completed_at=now - timedelta(hours=6)
        ))
        db.add(StudentQuizAttempt(
            user_id=student_priya.id,
            quiz_id=quiz_bst.id,
            score=1.0,
            total_questions=3,
            answers_json=json.dumps({str(q1.id): 1, str(q2.id): 0, str(q3.id): 0}),
            completed_at=now - timedelta(days=2)
        ))
        db.add(StudentQuizAttempt(
            user_id=student_rohit.id,
            quiz_id=quiz_bst.id,
            score=0.0,
            total_questions=3,
            answers_json=json.dumps({str(q1.id): 2, str(q2.id): 3, str(q3.id): 1}),
            completed_at=now - timedelta(days=5)
        ))
        await db.commit()

        # 9. Seed Spaced Retention (SM-2 Records)
        db.add(StudentConceptRetention(
            user_id=student_aarav.id,
            course_id=course_dsa.id,
            concept_tag="Binary Search Trees",
            repetition_interval=6,
            difficulty_factor=2.6,
            repetitions=2,
            next_review_date=now + timedelta(days=5),
            last_reviewed_at=now - timedelta(hours=6)
        ))
        db.add(StudentConceptRetention(
            user_id=student_priya.id,
            course_id=course_dsa.id,
            concept_tag="Binary Search Trees",
            repetition_interval=1,
            difficulty_factor=1.7,
            repetitions=0,
            next_review_date=now - timedelta(days=1),
            last_reviewed_at=now - timedelta(days=2)
        ))

        # 10. Seed Activity Logs
        db.add(StudentActivityLog(
            user_id=student_rohit.id,
            course_id=course_dsa.id,
            action_type="QUERY_TUTOR",
            query_text="What is time complexity of BST?",
            response_time_ms=310,
            created_at=now - timedelta(days=6)
        ))
        db.add(StudentActivityLog(
            user_id=student_priya.id,
            course_id=course_dsa.id,
            action_type="QUERY_TUTOR",
            query_text="Why does BST degrade to O(N)?",
            response_time_ms=280,
            created_at=now - timedelta(days=2)
        ))

        # 11. Seed Native Learning Pod
        pod = LearningPod(
            title="Tree Traversal & Rotation Study Pod",
            course_id=course_dsa.id,
            host_id=educator.id,
            topic="BST Invariants & Tree Rotations",
            agenda="Collaborative walkthrough of tree rotation proofs and exam practice.",
            passcode_hash="1234",
            is_active=True,
            max_peers=6
        )
        db.add(pod)
        await db.commit()

        # 12. Seed Community Channels & Messages
        chan_gen = CommunityChannel(course_id=course_dsa.id, name="general", description="General discussions and study tips")
        chan_qa = CommunityChannel(course_id=course_dsa.id, name="doubts-and-qa", description="Peer Q&A and doubt resolution")
        db.add_all([chan_gen, chan_qa])
        await db.commit()
        await db.refresh(chan_gen)
        await db.refresh(chan_qa)

        msg1 = CommunityMessage(
            channel_id=chan_qa.id,
            user_id=student_priya.id,
            author_name=student_priya.full_name,
            author_role="STUDENT",
            content="Can someone explain in simple terms why in-order traversal of a BST is always sorted?",
            upvotes=3,
            is_solution=False
        )
        msg2 = CommunityMessage(
            channel_id=chan_qa.id,
            user_id=student_aarav.id,
            author_name=student_aarav.full_name,
            author_role="STUDENT",
            content="Because by definition all nodes in the left subtree are smaller than the root, and all in the right are larger. Visiting Left -> Root -> Right naturally sorts them!",
            upvotes=7,
            is_solution=True
        )
        db.add_all([msg1, msg2])
        await db.commit()

        # 13. Ensure hierarchical curriculum data
        await ensure_hierarchical_curriculum_data(db)

        logger.info("Demo ecosystem seeded successfully.")
