from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.models import User
from app.schemas.schemas import CurriculumAuditResponse, BloomsQuestionItem
from app.services.curriculum_audit_service import curriculum_audit_service

router = APIRouter(prefix="/curriculum-audit", tags=["Curriculum Health & Bloom's Generator"])

@router.get("", response_model=CurriculumAuditResponse)
async def get_course_curriculum_audit(
    course_id: int = 1,
    current_user: User = Depends(require_roles("EDUCATOR", "ADMIN")),
    db: AsyncSession = Depends(get_db)
):
    """Run automated syllabus coverage and prerequisite gap diagnostic."""
    return await curriculum_audit_service.perform_audit(course_id, db)

@router.get("/blooms-quiz", response_model=List[BloomsQuestionItem])
async def generate_blooms_quiz(
    topic: str = "Binary Search Trees",
    current_user: User = Depends(require_roles("EDUCATOR", "ADMIN"))
):
    """Generate balanced 4-tier Bloom's Taxonomy assessment (Remember, Understand, Apply, Analyze)."""
    return curriculum_audit_service.generate_blooms_taxonomy_quiz(topic)
