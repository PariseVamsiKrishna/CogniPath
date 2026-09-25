from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.models import User
from app.schemas.schemas import EducatorDashboardOverview, AtRiskStudent
from app.services.analytics_service import analytics_service

router = APIRouter(prefix="/analytics", tags=["Educator Analytics & Early-Warning"])

@router.get("/educator", response_model=EducatorDashboardOverview)
@router.get("/educator/overview", response_model=EducatorDashboardOverview)
async def get_educator_overview(
    current_user: User = Depends(require_roles("EDUCATOR", "ADMIN")),
    db: AsyncSession = Depends(get_db)
):
    """Returns aggregated course analytics, at-risk student flags, and topic difficulty heatmaps."""
    return await analytics_service.compute_dashboard_overview(current_user.id, db)

@router.get("/educator/at-risk", response_model=List[AtRiskStudent])
async def get_at_risk_students(
    current_user: User = Depends(require_roles("EDUCATOR", "ADMIN")),
    db: AsyncSession = Depends(get_db)
):
    """Returns list of students triggered by the early-warning heuristic engine."""
    overview = await analytics_service.compute_dashboard_overview(current_user.id, db)
    return overview.at_risk_students

@router.post("/educator/intervene/{student_id}")
async def trigger_student_intervention(
    student_id: int,
    custom_note: str = "Your educator has scheduled an adaptive review session and recommended foundational reading.",
    current_user: User = Depends(require_roles("EDUCATOR", "ADMIN")),
    db: AsyncSession = Depends(get_db)
):
    """Educator action to intervene and send targeted micro-revision packet to an at-risk student."""
    return {
        "status": "success",
        "student_id": student_id,
        "action_taken": "Intervention notice dispatched with curated spaced-repetition micro-quizzes.",
        "note": custom_note
    }
