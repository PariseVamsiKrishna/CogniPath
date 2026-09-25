import json
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import (
    User, Course, Quiz, QuizQuestion, StudentQuizAttempt,
    StudentConceptRetention, StudentActivityLog
)
from app.schemas.schemas import (
    QuizResponse, QuizQuestionSchema, QuizSubmitRequest,
    QuizSubmitResponse, SpacedConceptItem
)
from app.services.quiz_service import quiz_service

router = APIRouter(prefix="/quizzes", tags=["Adaptive Spaced Quizzes"])

@router.post("/generate", response_model=QuizResponse)
async def generate_spaced_quiz(
    course_id: int,
    topic: str = "Trees & Search Algorithms",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Generates an on-demand spaced-repetition micro-quiz for the student."""
    # Create or reuse a micro-quiz for the topic using AI grounded in course context
    raw_questions = await quiz_service.generate_concept_micro_quiz(course_id, topic, None)

    quiz = Quiz(
        course_id=course_id,
        topic=topic,
        title=f"Spaced Retention Check: {topic}",
        difficulty_level="adaptive",
        created_by=current_user.id
    )
    db.add(quiz)
    await db.commit()
    await db.refresh(quiz)

    questions_out = []
    for q_data in raw_questions:
        q_obj = QuizQuestion(
            quiz_id=quiz.id,
            question_text=q_data["question"],
            options=json.dumps(q_data["options"]),
            correct_option_index=q_data["correct_index"],
            explanation=q_data["explanation"],
            source_chunk_ref=q_data["source_ref"]
        )
        db.add(q_obj)
        await db.commit()
        await db.refresh(q_obj)

        questions_out.append(QuizQuestionSchema(
            id=q_obj.id,
            question_text=q_obj.question_text,
            options=json.loads(q_obj.options),
            correct_option_index=q_obj.correct_option_index,
            explanation=q_obj.explanation,
            source_chunk_ref=q_obj.source_chunk_ref
        ))

    return QuizResponse(
        id=quiz.id,
        course_id=quiz.course_id,
        topic=quiz.topic,
        title=quiz.title,
        difficulty_level=quiz.difficulty_level,
        questions=questions_out
    )

@router.post("/submit", response_model=QuizSubmitResponse)
async def submit_quiz_attempt(
    req: QuizSubmitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Submit answers, compute score, update SM-2 retention parameters, and schedule next review."""
    # 1. Fetch quiz and questions
    quiz_res = await db.execute(select(Quiz).where(Quiz.id == req.quiz_id))
    quiz = quiz_res.scalars().first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    q_res = await db.execute(select(QuizQuestion).where(QuizQuestion.quiz_id == req.quiz_id))
    questions = q_res.scalars().all()
    if not questions:
        raise HTTPException(status_code=400, detail="Quiz has no questions.")

    # 2. Grade submission
    correct_count = 0
    total = len(questions)
    for q in questions:
        user_choice = req.answers.get(q.id)
        if user_choice is not None and user_choice == q.correct_option_index:
            correct_count += 1

    percentage = round((correct_count / max(1, total)) * 100, 1)
    passed = percentage >= 60.0

    # 3. Determine SM-2 quality rating
    quality_rating = req.quality_rating if req.quality_rating is not None else quiz_service.score_to_sm2_rating(percentage)

    # 4. Fetch or initialize student concept retention record
    ret_res = await db.execute(
        select(StudentConceptRetention).where(
            StudentConceptRetention.user_id == current_user.id,
            StudentConceptRetention.course_id == quiz.course_id,
            StudentConceptRetention.concept_tag == quiz.topic
        )
    )
    retention = ret_res.scalars().first()

    now = datetime.now(timezone.utc)
    if not retention:
        retention = StudentConceptRetention(
            user_id=current_user.id,
            course_id=quiz.course_id,
            concept_tag=quiz.topic,
            repetition_interval=1,
            difficulty_factor=2.5,
            repetitions=0,
            next_review_date=now + timedelta(days=1),
            last_reviewed_at=now
        )
        db.add(retention)
        await db.commit()
        await db.refresh(retention)

    # 5. Apply SuperMemo SM-2 formula
    new_reps, new_ef, new_interval = quiz_service.calculate_sm2_update(
        repetition_count=retention.repetitions,
        easiness_factor=retention.difficulty_factor,
        interval_days=retention.repetition_interval,
        quality_rating=quality_rating
    )

    next_review = now + timedelta(days=new_interval)
    retention.repetitions = new_reps
    retention.difficulty_factor = new_ef
    retention.repetition_interval = new_interval
    retention.next_review_date = next_review
    retention.last_reviewed_at = now

    # 6. Save attempt record & activity log
    attempt = StudentQuizAttempt(
        user_id=current_user.id,
        quiz_id=quiz.id,
        score=float(correct_count),
        total_questions=total,
        answers_json=json.dumps(req.answers),
        completed_at=now
    )
    db.add(attempt)

    log_entry = StudentActivityLog(
        user_id=current_user.id,
        course_id=quiz.course_id,
        action_type="TAKE_QUIZ",
        query_text=f"Completed {quiz.topic} quiz with {percentage}%",
        metadata_info=json.dumps({
            "percentage": percentage,
            "sm2_interval": new_interval,
            "sm2_factor": new_ef
        })
    )
    db.add(log_entry)
    await db.commit()

    feedback = (
        f"Outstanding mastery! Next review scheduled in {new_interval} days."
        if passed else
        f"Concept needs reinforcement. Next micro-review scheduled in {new_interval} day(s)."
    )

    return QuizSubmitResponse(
        score=float(correct_count),
        total_questions=total,
        percentage=percentage,
        passed=passed,
        next_review_date=next_review,
        new_interval_days=new_interval,
        feedback=feedback
    )

@router.get("/due", response_model=List[SpacedConceptItem])
async def get_due_retention_items(
    course_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List concepts due for spaced-repetition review for the current student."""
    now = datetime.now(timezone.utc)
    res = await db.execute(
        select(StudentConceptRetention).where(
            StudentConceptRetention.user_id == current_user.id,
            StudentConceptRetention.course_id == course_id
        )
    )
    items = res.scalars().all()
    output = []
    for item in items:
        # Normalize timezone
        item_review = item.next_review_date
        if item_review.tzinfo is None:
            item_review = item_review.replace(tzinfo=timezone.utc)
        output.append(SpacedConceptItem(
            id=item.id,
            concept_tag=item.concept_tag,
            repetition_interval=item.repetition_interval,
            difficulty_factor=item.difficulty_factor,
            repetitions=item.repetitions,
            next_review_date=item_review,
            is_due=item_review <= now
        ))
    return output
