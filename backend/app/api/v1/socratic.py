from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User
from app.schemas.schemas import SocraticQueryRequest, SocraticQueryResponse, ConceptMindmap
from app.services.socratic_service import socratic_service

router = APIRouter(prefix="/socratic", tags=["Socratic AI Tutor & Concept Mindmaps"])

@router.post("/query", response_model=SocraticQueryResponse)
async def socratic_query(
    req: SocraticQueryRequest,
    current_user: User = Depends(get_current_user)
):
    """Generates Socratic guided discovery inquiry and concept mindmap."""
    return await socratic_service.generate_socratic_guidance(
        course_id=req.course_id,
        query=req.query,
        student_attempt=req.student_attempt
    )

@router.get("/mindmap", response_model=ConceptMindmap)
async def get_concept_mindmap(topic: str = "Binary Search Trees"):
    """Returns visual concept mindmap nodes, edges, and Mermaid.js diagram for a topic."""
    return socratic_service.generate_mindmap_for_topic(topic)
