import json
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.models import (
    Course,
    Enrollment,
    Exam,
    ExamQuestion,
    StudentBadge,
    User,
)
from app.schemas.schemas import (
    AISuggestionRequest,
    AISuggestionResponse,
    ExamCreate,
    ExamQuestionSchema,
    ExamReorderRequest,
    ExamResponse,
    ExamSubmitRequest,
    ExamSubmitResponse,
    StudentBadgeResponse,
)
from app.services.exam_service import exam_service

logger = logging.getLogger("cognipath.exams_api")

router = APIRouter(prefix="/exams", tags=["Dual-Engine Assessments (Exams & Quizzes)"])

async def _assert_exam_owner(exam_id: int, current_user: User, db: AsyncSession) -> Exam:
    """Raises 403 unless current_user owns the course the exam belongs to (or is ADMIN)."""
    exam_res = await db.execute(select(Exam).where(Exam.id == exam_id))
    exam = exam_res.scalars().first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    if current_user.role == "ADMIN":
        return exam

    course_res = await db.execute(select(Course).where(Course.id == exam.course_id))
    course = course_res.scalars().first()
    if not course or course.educator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the course educator can modify this exam")
    return exam

async def _check_course_ownership_or_enrolment(course_id: int, user: User, db: AsyncSession, write: bool = False) -> Course:
    c_res = await db.execute(select(Course).where(Course.id == course_id))
    course = c_res.scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if user.role == "ADMIN":
        return course

    if write:
        if user.role != "EDUCATOR" or course.educator_id != user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not own this course.")
        return course

    # Read access
    if user.role == "EDUCATOR" and course.educator_id == user.id:
        return course

    enrol_res = await db.execute(
        select(Enrollment).where(Enrollment.course_id == course_id, Enrollment.user_id == user.id)
    )
    if not enrol_res.scalars().first():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not enrolled in this course.")
    return course

@router.post("", response_model=ExamResponse, status_code=status.HTTP_201_CREATED)
async def create_exam(
    req: ExamCreate,
    current_user: User = Depends(require_roles("EDUCATOR", "ADMIN")),
    db: AsyncSession = Depends(get_db)
):
    """Educator creates a Module-level Quiz or comprehensive Final Course Exam."""
    await _check_course_ownership_or_enrolment(req.course_id, current_user, db, write=True)

    exam = Exam(
        course_id=req.course_id,
        module_id=req.module_id,
        exam_type=req.exam_type,
        title=req.title,
        time_limit_mins=req.time_limit_mins,
        passing_score=req.passing_score,
        created_by=current_user.id
    )
    db.add(exam)
    await db.commit()
    await db.refresh(exam)

    # If questions provided initially, insert them
    if req.questions:
        for idx, q in enumerate(req.questions):
            q_obj = ExamQuestion(
                exam_id=exam.id,
                question_type=q.question_type,
                question_text=q.question_text,
                options=json.dumps(q.options) if q.options else None,
                correct_answer=q.correct_answer,
                explanation=q.explanation,
                source_ref=q.source_ref,
                order_index=q.order_index or (idx + 1)
            )
            db.add(q_obj)
        await db.commit()

    return await get_exam_details(exam.id, db, is_educator=True)

@router.get("/{exam_id}", response_model=ExamResponse)
async def get_exam(
    exam_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve full exam details with ordered questions (answers masked for students)."""
    res = await db.execute(select(Exam).where(Exam.id == exam_id))
    exam = res.scalars().first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    course = await _check_course_ownership_or_enrolment(exam.course_id, current_user, db, write=False)
    is_educator = (current_user.role == "ADMIN" or (current_user.role == "EDUCATOR" and course.educator_id == current_user.id))
    return await get_exam_details(exam_id, db, is_educator=is_educator)

async def get_exam_details(exam_id: int, db: AsyncSession, is_educator: bool = False) -> ExamResponse:
    res = await db.execute(select(Exam).where(Exam.id == exam_id))
    exam = res.scalars().first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    q_res = await db.execute(
        select(ExamQuestion).where(ExamQuestion.exam_id == exam_id).order_by(ExamQuestion.order_index.asc())
    )
    questions = q_res.scalars().all()

    q_schemas = []
    for q in questions:
        q_schemas.append(ExamQuestionSchema(
            id=q.id,
            question_type=q.question_type,
            question_text=q.question_text,
            options=json.loads(q.options) if q.options else None,
            correct_answer=q.correct_answer if is_educator else None,
            explanation=q.explanation if is_educator else None,
            source_ref=q.source_ref,
            order_index=q.order_index
        ))

    return ExamResponse(
        id=exam.id,
        course_id=exam.course_id,
        module_id=exam.module_id,
        exam_type=exam.exam_type,
        title=exam.title,
        time_limit_mins=exam.time_limit_mins,
        passing_score=exam.passing_score,
        created_at=exam.created_at,
        questions=q_schemas
    )

@router.get("/course/{course_id}", response_model=list[ExamResponse])
async def list_course_exams(
    course_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all module quizzes and final exams for a course with student answer masking."""
    course = await _check_course_ownership_or_enrolment(course_id, current_user, db, write=False)
    is_educator = (current_user.role == "ADMIN" or (current_user.role == "EDUCATOR" and course.educator_id == current_user.id))

    res = await db.execute(select(Exam).where(Exam.course_id == course_id))
    exams = res.scalars().all()
    results = []
    for e in exams:
        results.append(await get_exam_details(e.id, db, is_educator=is_educator))
    return results

@router.post("/{exam_id}/questions", response_model=ExamQuestionSchema)
async def add_question(
    exam_id: int,
    q_in: ExamQuestionSchema,
    current_user: User = Depends(require_roles('EDUCATOR', 'ADMIN')),
    db: AsyncSession = Depends(get_db)
):
    """Add a question (manual or pushed from AI suggestion drawer)."""
    exam = await _assert_exam_owner(exam_id, current_user, db)

    await _check_course_ownership_or_enrolment(exam.course_id, current_user, db, write=True)

    # Determine next order index
    count_res = await db.execute(select(ExamQuestion).where(ExamQuestion.exam_id == exam_id))
    existing_count = len(count_res.scalars().all())

    q_obj = ExamQuestion(
        exam_id=exam_id,
        question_type=q_in.question_type,
        question_text=q_in.question_text,
        options=json.dumps(q_in.options) if q_in.options else None,
        correct_answer=q_in.correct_answer,
        explanation=q_in.explanation,
        source_ref=q_in.source_ref,
        order_index=q_in.order_index or (existing_count + 1)
    )
    db.add(q_obj)
    await db.commit()
    await db.refresh(q_obj)

    return ExamQuestionSchema(
        id=q_obj.id,
        question_type=q_obj.question_type,
        question_text=q_obj.question_text,
        options=json.loads(q_obj.options) if q_obj.options else None,
        correct_answer=q_obj.correct_answer,
        explanation=q_obj.explanation,
        source_ref=q_obj.source_ref,
        order_index=q_obj.order_index
    )

@router.delete("/{exam_id}/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
async def drop_question(
    exam_id: int,
    question_id: int,
    current_user: User = Depends(require_roles('EDUCATOR', 'ADMIN')),
    db: AsyncSession = Depends(get_db)
):
    """Remove/drop a question from the active exam builder."""
    await _assert_exam_owner(exam_id, current_user, db)
    q_res = await db.execute(
        select(ExamQuestion).where(ExamQuestion.exam_id == exam_id, ExamQuestion.id == question_id)
    )
    q_obj = q_res.scalars().first()
    if not q_obj:
        raise HTTPException(status_code=404, detail="Question not found in this exam")

    await db.delete(q_obj)
    await db.commit()

@router.put("/{exam_id}/reorder", response_model=list[ExamQuestionSchema])
async def reorder_questions(
    exam_id: int,
    req: ExamReorderRequest,
    current_user: User = Depends(require_roles('EDUCATOR', 'ADMIN')),
    db: AsyncSession = Depends(get_db)
):
    """Batch updates question order indices following drag-and-drop actions."""
    await _assert_exam_owner(exam_id, current_user, db)
    for item in req.question_orders:
        q_res = await db.execute(
            select(ExamQuestion).where(ExamQuestion.exam_id == exam_id, ExamQuestion.id == item.question_id)
        )
        q = q_res.scalars().first()
        if q:
            q.order_index = item.order_index

    await db.commit()
    updated = await get_exam_details(exam_id, db, is_educator=True)
    return updated.questions

@router.put("/{exam_id}", response_model=ExamResponse)
async def update_exam(
    exam_id: int,
    req: ExamCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Educator updates exam metadata and syncs question list."""
    exam = await _assert_exam_owner(exam_id, current_user, db)
    exam.title = req.title
    exam.time_limit_mins = req.time_limit_mins
    exam.passing_score = req.passing_score
    if req.exam_type:
        exam.exam_type = req.exam_type

    if req.questions is not None:
        # Clear previous questions and re-insert updated questions
        old_qs = (await db.execute(select(ExamQuestion).where(ExamQuestion.exam_id == exam_id))).scalars().all()
        for q in old_qs:
            await db.delete(q)
        await db.flush()

        for idx, q in enumerate(req.questions):
            q_obj = ExamQuestion(
                exam_id=exam.id,
                question_type=q.question_type or "MCQ",
                question_text=q.question_text,
                options=json.dumps(q.options) if q.options else None,
                correct_answer=str(q.correct_answer),
                explanation=q.explanation,
                source_ref=q.source_ref,
                order_index=q.order_index or (idx + 1)
            )
            db.add(q_obj)

    await db.commit()
    return await get_exam_details(exam.id, db)

@router.post("/ai-suggest", response_model=AISuggestionResponse)
async def get_ai_suggestions(
    req: AISuggestionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Generates AI question suggestions grounded in course video concepts and notes."""
    suggestions = await exam_service.generate_ai_suggestions(
        course_id=req.course_id,
        module_id=req.module_id,
        topic=req.topic or "Course Curriculum",
        count=req.count,
        difficulty=req.difficulty,
        db=db
    )
    return AISuggestionResponse(
        topic=req.topic or "Course Curriculum",
        suggestions=suggestions
    )

@router.post("/{exam_id}/submit", response_model=ExamSubmitResponse)
async def submit_exam(
    exam_id: int,
    req: ExamSubmitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Student submits answers, system grades instantly and mints a verified badge if qualified."""
    exam_res = await db.execute(select(Exam).where(Exam.id == exam_id))
    exam = exam_res.scalars().first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    await _check_course_ownership_or_enrolment(exam.course_id, current_user, db, write=False)

    try:
        result = await exam_service.evaluate_submission(
            exam_id=exam_id,
            student_id=current_user.id,
            responses=req.responses,
            db=db
        )
        return result
    except HTTPException:
        raise
    except ValueError as ve:
        logger.exception(ve)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Exam evaluation failed")
    except Exception as e:
        logger.exception(f"Error evaluating exam {exam_id} submission for student {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while evaluating your exam submission. Please try again."
        )

@router.get("/badges/student/{student_id}", response_model=list[StudentBadgeResponse])
async def get_student_badges(
    student_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve all verified digital credential badges earned by a student."""
    if current_user.role not in ("EDUCATOR", "ADMIN") and current_user.id != student_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You cannot access another student's credentials.")

    res = await db.execute(select(StudentBadge).where(StudentBadge.student_id == student_id))
    badges = res.scalars().all()
    out = []
    for b in badges:
        c_res = await db.execute(select(Course).where(Course.id == b.course_id))
        course = c_res.scalars().first()
        u_res = await db.execute(select(User).where(User.id == b.student_id))
        student = u_res.scalars().first()
        out.append(StudentBadgeResponse(
            id=b.id,
            student_id=b.student_id,
            course_id=b.course_id,
            badge_name=b.badge_name,
            badge_image_url=b.badge_image_url,
            difficulty_level=b.difficulty_level,
            verification_hash=b.verification_hash,
            issued_at=b.issued_at,
            student_name=student.full_name if student else "Alex Kumar",
            course_title=course.title if course else "Course"
        ))
    return out

@router.get("/badges/verify/{verification_hash}", response_model=StudentBadgeResponse)
async def verify_badge(verification_hash: str, db: AsyncSession = Depends(get_db)):
    """Public verification endpoint to validate tamper-proof digital badge authenticity."""
    res = await db.execute(select(StudentBadge).where(StudentBadge.verification_hash == verification_hash))
    b = res.scalars().first()
    if not b:
        raise HTTPException(status_code=404, detail="Badge verification hash invalid or not found")

    c_res = await db.execute(select(Course).where(Course.id == b.course_id))
    course = c_res.scalars().first()
    u_res = await db.execute(select(User).where(User.id == b.student_id))
    student = u_res.scalars().first()

    return StudentBadgeResponse(
        id=b.id,
        student_id=b.student_id,
        course_id=b.course_id,
        badge_name=b.badge_name,
        badge_image_url=b.badge_image_url,
        difficulty_level=b.difficulty_level,
        verification_hash=b.verification_hash,
        issued_at=b.issued_at,
        student_name=student.full_name if student else "Alex Kumar",
        course_title=course.title if course else "Course"
    )
