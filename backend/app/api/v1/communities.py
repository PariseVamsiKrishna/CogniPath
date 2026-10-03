from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import CommunityChannel, CommunityMessage, User, Course, Enrollment
from app.schemas.schemas import (
    CommunityChannelResponse, CommunityMessageCreate, CommunityMessageResponse
)

router = APIRouter(prefix="/communities", tags=["Native Community Hub"])

@router.get("/courses/{course_id}/channels", response_model=List[CommunityChannelResponse])
async def list_course_channels(course_id: int, db: AsyncSession = Depends(get_db)):
    """List all community channels available in a course."""
    result = await db.execute(
        select(CommunityChannel).where(CommunityChannel.course_id == course_id).order_by(CommunityChannel.id.asc())
    )
    channels = result.scalars().all()
    if not channels:
        # Auto-provision classic WhatsApp-style channels: announcements + discussion
        ann_ch = CommunityChannel(
            course_id=course_id,
            name="announcements",
            description="Official announcements and broadcasts from the Community Owner"
        )
        disc_ch = CommunityChannel(
            course_id=course_id,
            name="discussion",
            description="Open peer questions, concept discussions, and study exchange"
        )
        db.add_all([ann_ch, disc_ch])
        await db.commit()
        await db.refresh(ann_ch)
        await db.refresh(disc_ch)
        return [ann_ch, disc_ch]
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

    ch_res = await db.execute(select(CommunityChannel).where(CommunityChannel.id == channel_id))
    channel = ch_res.scalars().first()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    course_res = await db.execute(select(Course).where(Course.id == channel.course_id))
    course = course_res.scalars().first()

    # WhatsApp-style rule: Only the community owner/admin can post in announcements!
    is_owner = (course and course.educator_id == current_user.id) or current_user.role == "ADMIN"
    if channel.name.lower() in ["announcements", "announcement"] and not is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the Community Owner can post announcements in this channel."
        )

    message = CommunityMessage(
        channel_id=channel_id,
        user_id=current_user.id,
        author_name=current_user.full_name or "Member",
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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Upvote a helpful student answer or explanation."""
    result = await db.execute(select(CommunityMessage).where(CommunityMessage.id == message_id))
    message = result.scalars().first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    message.upvotes = (message.upvotes or 0) + 1
    await db.commit()
    return {"status": "success", "upvotes": message.upvotes}


# ==============================================================================
# WHATSAPP-STYLE COMMUNITY OWNER PRIVILEGES & MANAGEMENT
# ==============================================================================

@router.get("/courses/{course_id}/members")
async def get_community_members(
    course_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns full member roster.
    STRICT PRIVACY: ONLY the community owner / educator or admin has access to view members.
    Regular students are denied access.
    """
    c_res = await db.execute(select(Course).where(Course.id == course_id))
    course = c_res.scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    is_owner = (course.educator_id == current_user.id) or current_user.role == "ADMIN"
    if not is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted: Only the Community Owner can view the member roster."
        )

    # Fetch creator / owner info
    owner_res = await db.execute(select(User).where(User.id == course.educator_id))
    owner = owner_res.scalars().first()

    # Fetch all enrolled student members
    enr_res = await db.execute(
        select(User).join(Enrollment, User.id == Enrollment.user_id).where(Enrollment.course_id == course_id)
    )
    students = enr_res.scalars().all()

    members = []
    if owner:
        members.append({
            "user_id": owner.id,
            "full_name": owner.full_name or "Community Owner",
            "email": owner.email,
            "role": "OWNER",
            "is_owner": True,
            "joined_at": owner.created_at
        })

    for s in students:
        if owner and s.id == owner.id:
            continue
        members.append({
            "user_id": s.id,
            "full_name": s.full_name or "Student",
            "email": s.email,
            "role": s.role,
            "is_owner": False,
            "joined_at": s.created_at
        })

    return {
        "course_id": course_id,
        "community_name": course.title,
        "total_members": len(members),
        "members": members
    }


@router.delete("/courses/{course_id}/members/{user_id}")
async def kick_community_member(
    course_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Kick a student member out of the community.
    STRICT: ONLY the Community Owner or admin can kick members.
    """
    c_res = await db.execute(select(Course).where(Course.id == course_id))
    course = c_res.scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    is_owner = (course.educator_id == current_user.id) or current_user.role == "ADMIN"
    if not is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the Community Owner can remove members."
        )

    if user_id == course.educator_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot kick the Community Owner."
        )

    # Delete enrollment
    enr_res = await db.execute(
        select(Enrollment).where(Enrollment.course_id == course_id, Enrollment.user_id == user_id)
    )
    enr = enr_res.scalars().first()
    if enr:
        await db.delete(enr)
        await db.commit()

    return {
        "status": "success",
        "message": "Member was kicked out and removed from this community."
    }


@router.delete("/courses/{course_id}/close")
async def close_community_permanently(
    course_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Permanently closes the community and deletes all channels & message threads forever.
    STRICT: ONLY the Community Owner or admin can close the community.
    """
    c_res = await db.execute(select(Course).where(Course.id == course_id))
    course = c_res.scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    is_owner = (course.educator_id == current_user.id) or current_user.role == "ADMIN"
    if not is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the Community Owner can close this community."
        )

    # Delete all community messages and channels
    ch_res = await db.execute(select(CommunityChannel).where(CommunityChannel.course_id == course_id))
    channels = ch_res.scalars().all()
    for ch in channels:
        await db.execute(delete(CommunityMessage).where(CommunityMessage.channel_id == ch.id))
        await db.delete(ch)

    await db.commit()
    return {
        "status": "success",
        "message": f"Community for '{course.title}' has been permanently closed."
    }
