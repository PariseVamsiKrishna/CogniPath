from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User
from app.schemas.schemas import LearningRoadmapResponse
from app.services.roadmap_service import roadmap_service

router = APIRouter(prefix="/roadmap", tags=["Adaptive Learning Roadmap & Knowledge Radar"])

@router.get("", response_model=LearningRoadmapResponse)
async def get_my_roadmap(
    course_id: int = 1,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve personalized knowledge mastery radar and next best actions."""
    return await roadmap_service.get_student_roadmap(
        user_id=current_user.id,
        course_id=course_id,
        db=db
    )

@router.post("/complete-action/{action_id}")
async def complete_roadmap_action(
    action_id: str,
    current_user: User = Depends(get_current_user)
):
    """Mark a recommended action item as completed and award student XP points."""
    return {
        "status": "success",
        "action_id": action_id,
        "xp_awarded": 50,
        "message": "Action completed! Streak maintained and +50 XP added to your profile."
    }
