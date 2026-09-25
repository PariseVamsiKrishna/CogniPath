from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import CommunityChannel, CommunityMessage, User, Course
from app.schemas.schemas import (
    CommunityChannelResponse, CommunityMessageCreate, CommunityMessageResponse
)

router = APIRouter(prefix="/communities", tags=["Native Community Hub"])

@router.get("/courses/{course_id}/channels", response_model=List[CommunityChannelResponse])
async def list_course_channels(course_id: int, db: AsyncSession = Depends(get_db)):
    """List all community channels available in a course."""
    result = await db.execute(
        select(CommunityChannel).where(CommunityChannel.course_id == course_id)
    )
    channels = result.scalars().all()
    if not channels:
        # Default fallback channel creation if none exist
        default_ch = CommunityChannel(
            course_id=course_id,
            name="general",
            description="General student and educator discussion"
        )
        db.add(default_ch)
        await db.commit()
        await db.refresh(default_ch)
        return [default_ch]
    return channels

@router.get("/channels/{channel_id}/messages", response_model=List[CommunityMessageResponse])
async def list_channel_messages(channel_id: int, db: AsyncSession = Depends(get_db)):
    """Retrieve message feed for a channel."""
    result = await db.execute(
        select(CommunityMessage)
        .where(CommunityMessage.channel_id == channel_id)
        .order_by(CommunityMessage.created_at.asc())
    )
    return result.scalars().all()

@router.post("/channels/{channel_id}/messages", response_model=CommunityMessageResponse)
async def post_community_message(
    channel_id: int,
    msg_in: CommunityMessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Post a question, code snippet, or explanation to the course community channel."""
    if not msg_in.content.strip():
        raise HTTPException(status_code=400, detail="Message content cannot be empty.")

    message = CommunityMessage(
        channel_id=channel_id,
        user_id=current_user.id,
        author_name=current_user.full_name,
        author_role=current_user.role,
        content=msg_in.content,
        upvotes=0,
        is_solution=False
    )
    db.add(message)
    await db.commit()
    await db.refresh(message)
    return message

@router.post("/messages/{message_id}/upvote")
async def upvote_community_message(
    message_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Upvote a helpful student answer or explanation."""
    result = await db.execute(select(CommunityMessage).where(CommunityMessage.id == message_id))
    message = result.scalars().first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    message.upvotes += 1
    await db.commit()
    return {"status": "success", "upvotes": message.upvotes}
