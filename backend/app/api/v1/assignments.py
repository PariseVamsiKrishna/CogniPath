import os
import json
import shutil
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User, Assignment, AssignmentSubmission, Module
from app.schemas.schemas import (
    AssignmentCreate, AssignmentResponse, AssignmentSubmissionResponse,
    AIEvaluationFeedback, RubricCriterion
)
from app.services.assignment_service import assignment_service

router = APIRouter(prefix="/assignments", tags=["Assignment Engine & AI Auto-Evaluation"])

@router.post("", response_model=AssignmentResponse, status_code=status.HTTP_201_CREATED)
async def create_assignment(
    req: AssignmentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Educator creates an assignment with criterion-by-criterion rubrics."""
    mod_res = await db.execute(select(Module).where(Module.id == req.module_id))
    if not mod_res.scalars().first():
        raise HTTPException(status_code=404, detail="Module not found")

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

@router.get("/module/{module_id}", response_model=List[AssignmentResponse])
async def list_module_assignments(module_id: int, db: AsyncSession = Depends(get_db)):
    """List all assignments for a module."""
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
async def get_assignment(assignment_id: int, db: AsyncSession = Depends(get_db)):
    """Get single assignment details with rubric."""
    res = await db.execute(select(Assignment).where(Assignment.id == assignment_id))
    a = res.scalars().first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")

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
    submission_text: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Student submits text or PDF for assignment, triggers automatic text extraction."""
    res = await db.execute(select(Assignment).where(Assignment.id == assignment_id))
    assignment = res.scalars().first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    file_url = None
    extracted = submission_text or ""

    if file:
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        file_path = os.path.join(settings.UPLOAD_DIR, f"assign_{assignment_id}_u{current_user.id}_{file.filename}")
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        file_url = f"/uploads/{os.path.basename(file_path)}"

        if file.filename.lower().endswith(".pdf"):
            pdf_text = assignment_service.extract_text_from_pdf(file_path)
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
        logger.warning(f"Auto-grading warning: {e}")

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

@router.get("/submissions/student/{student_id}", response_model=List[AssignmentSubmissionResponse])
async def list_student_submissions(student_id: int, db: AsyncSession = Depends(get_db)):
    """List all assignment submissions for a student."""
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
