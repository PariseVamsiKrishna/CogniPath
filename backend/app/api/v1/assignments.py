import json
import logging
import os
import uuid
import shutil
from typing import List, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.models import (
    Assignment,
    AssignmentSubmission,
    Course,
    Enrollment,
    Module,
    User,
)
from app.schemas.schemas import (
    AIEvaluationFeedback,
    AssignmentCreate,
    AssignmentResponse,
    AssignmentSubmissionResponse,
    RubricCriterion,
)
from app.services.assignment_service import assignment_service

logger = logging.getLogger("cognipath.assignments_api")
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/assignments", tags=["Assignment Engine & AI Auto-Evaluation"])

async def _get_module_course(module_id: int, db: AsyncSession) -> tuple[Module, Course]:
    mod_res = await db.execute(select(Module).where(Module.id == module_id))
    module = mod_res.scalars().first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    c_res = await db.execute(select(Course).where(Course.id == module.course_id))
    course = c_res.scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    return module, course

async def _check_access(course_id: int, user: User, db: AsyncSession, write: bool = False):
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

    if user.role == "EDUCATOR" and course.educator_id == user.id:
        return course

    enrol_res = await db.execute(
        select(Enrollment).where(Enrollment.course_id == course_id, Enrollment.user_id == user.id)
    )
    if not enrol_res.scalars().first():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not enrolled in this course.")
    return course


@router.post("", response_model=AssignmentResponse, status_code=status.HTTP_201_CREATED)
async def create_assignment(
    req: AssignmentCreate,
    current_user: User = Depends(require_roles("EDUCATOR", "ADMIN")),
    db: AsyncSession = Depends(get_db)
):
    """Educator creates an assignment with criterion-by-criterion rubrics."""
    module, course = await _get_module_course(req.module_id, db)
    await _check_access(course.id, current_user, db, write=True)

    rubric_dicts = [r.model_dump() for r in req.rubric]
    assignment = Assignment(
        module_id=req.module_id,
        title=req.title,
        description=req.description,
        assignment_type=req.assignment_type,
        rubric_json=json.dumps(rubric_dicts),
        model_answer=req.model_answer,
        max_score=req.max_score,
        created_at=datetime.now(timezone.utc)
    )
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)

    return AssignmentResponse(
        id=assignment.id,
        module_id=assignment.module_id,
        title=assignment.title,
        description=assignment.description,
        assignment_type=assignment.assignment_type,
        rubric=[RubricCriterion(**r) for r in rubric_dicts],
        model_answer=assignment.model_answer,
        max_score=assignment.max_score,
        created_at=assignment.created_at
    )

@router.get("/module/{module_id}", response_model=list[AssignmentResponse])
async def list_module_assignments(
    module_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all assignments for a module."""
    module, course = await _get_module_course(module_id, db)
    await _check_access(course.id, current_user, db, write=False)

    res = await db.execute(select(Assignment).where(Assignment.module_id == module_id))
    assignments = res.scalars().all()
    out = []
    for a in assignments:
        r_list = json.loads(a.rubric_json) if a.rubric_json else []
        out.append(AssignmentResponse(
            id=a.id,
            module_id=a.module_id,
            title=a.title,
            description=a.description,
            assignment_type=a.assignment_type,
            rubric=[RubricCriterion(**r) for r in r_list],
            model_answer=a.model_answer,
            max_score=a.max_score,
            created_at=a.created_at
        ))
    return out

@router.get("/{assignment_id}", response_model=AssignmentResponse)
async def get_assignment(
    assignment_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get single assignment details with rubric."""
    res = await db.execute(select(Assignment).where(Assignment.id == assignment_id))
    a = res.scalars().first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")

    module, course = await _get_module_course(a.module_id, db)
    await _check_access(course.id, current_user, db, write=False)

    r_list = json.loads(a.rubric_json) if a.rubric_json else []
    return AssignmentResponse(
        id=a.id,
        module_id=a.module_id,
        title=a.title,
        description=a.description,
        assignment_type=a.assignment_type,
        rubric=[RubricCriterion(**r) for r in r_list],
        model_answer=a.model_answer,
        max_score=a.max_score,
        created_at=a.created_at
    )

@router.post("/{assignment_id}/submit", response_model=AssignmentSubmissionResponse)
async def submit_assignment(
    assignment_id: int,
    submission_text: str | None = Form(None),
    file: UploadFile | None = File(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Student submits text or PDF for assignment, triggers automatic text extraction."""
    res = await db.execute(select(Assignment).where(Assignment.id == assignment_id))
    assignment = res.scalars().first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    existing = await db.execute(select(AssignmentSubmission).where(AssignmentSubmission.assignment_id == assignment_id, AssignmentSubmission.student_id == current_user.id))
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail='Already submitted')
    module, course = await _get_module_course(assignment.module_id, db)
    await _check_access(course.id, current_user, db, write=False)

    file_url = None
    extracted = submission_text or ""

    if file:
        # Whitelist extensions
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in [".pdf", ".docx", ".doc", ".txt", ".md"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported file format for assignment. Allowed: .pdf, .docx, .doc, .txt, .md"
            )

        # Sanitize filename with UUID prefix
        safe_name = os.path.basename(file.filename).replace(" ", "_")
        unique_name = f"assign_{assignment_id}_u{current_user.id}_{uuid.uuid4().hex[:8]}_{safe_name}"
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        file_path = os.path.join(settings.UPLOAD_DIR, unique_name)

        # Cap size at 10 MB with chunked streaming and cleanup on failure
        max_bytes = 10 * 1024 * 1024
        written_bytes = 0
        try:
            with open(file_path, "wb") as buffer:
                while chunk := await file.read(1024 * 1024):  # 1MB chunks
                    written_bytes += len(chunk)
                    if written_bytes > max_bytes:
                        raise HTTPException(
                            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            detail="File size exceeds maximum limit of 10 MB"
                        )
                    buffer.write(chunk)
        except Exception:
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except Exception:
                    pass
            raise

        file_url = f"/uploads/{unique_name}"

        if ext == ".pdf":
            import asyncio
            pdf_text = await asyncio.to_thread(assignment_service.extract_text_from_pdf, file_path)
            if pdf_text:
                extracted = f"{extracted}\n\n{pdf_text}".strip()

    sub = AssignmentSubmission(
        assignment_id=assignment_id,
        student_id=current_user.id,
        submitted_file_url=file_url,
        extracted_text=extracted,
        status="PENDING",
        submitted_at=datetime.now(timezone.utc)
    )
    db.add(sub)
    await db.commit()
    await db.refresh(sub)

    # Automatically trigger AI auto-evaluation
    try:
        rubric_data = json.loads(assignment.rubric_json) if assignment.rubric_json else []
        ai_feedback = await assignment_service.auto_grade_submission(
            submission_text=extracted,
            rubric=rubric_data,
            model_answer=assignment.model_answer,
            max_score=assignment.max_score
        )
        sub.ai_score = ai_feedback.overall_score
        sub.ai_feedback_json = json.dumps(ai_feedback.model_dump())
        sub.status = "AI_GRADED"
        await db.commit()
        await db.refresh(sub)
    except Exception as e:
        logger.exception(f"AI auto-grading failed for submission {sub.id}: {e}")
        # Mark as GRADING_FAILED so it's visible — not stuck as PENDING forever
        sub.status = "GRADING_FAILED"
        sub.ai_feedback_json = json.dumps({
            "overall_score": 0,
            "rubric_feedback": [],
            "general_feedback": "Automatic grading failed. The educator will review this submission manually.",
            "improvement_suggestions": []
        })
        await db.commit()
        await db.refresh(sub)

    fb = None
    if sub.ai_feedback_json:
        fb = AIEvaluationFeedback(**json.loads(sub.ai_feedback_json))

    return AssignmentSubmissionResponse(
        id=sub.id,
        assignment_id=sub.assignment_id,
        student_id=sub.student_id,
        submitted_file_url=sub.submitted_file_url,
        ai_score=sub.ai_score,
        ai_feedback=fb,
        status=sub.status,
        submitted_at=sub.submitted_at
    )

@router.get("/submissions/student/{student_id}", response_model=list[AssignmentSubmissionResponse])
async def list_student_submissions(
    student_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all assignment submissions for a student with IDOR check."""
    if current_user.role not in ("EDUCATOR", "ADMIN") and current_user.id != student_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Cannot view submissions of another student")

    res = await db.execute(
        select(AssignmentSubmission).where(AssignmentSubmission.student_id == student_id)
    )
    subs = res.scalars().all()
    out = []
    for s in subs:
        fb = None
        if s.ai_feedback_json:
            fb = AIEvaluationFeedback(**json.loads(s.ai_feedback_json))
        out.append(AssignmentSubmissionResponse(
            id=s.id,
            assignment_id=s.assignment_id,
            student_id=s.student_id,
            submitted_file_url=s.submitted_file_url,
            ai_score=s.ai_score,
            ai_feedback=fb,
            status=s.status,
            submitted_at=s.submitted_at
        ))
    return out
