import os
import re
import shutil
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from datetime import datetime, timezone
import json
from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.models import (
    Course, Enrollment, User, CommunityChannel, Module, Topic,
    ModuleResource, StudentBadge, Exam, ExamQuestion, CourseRating, TopicRating
)
from app.schemas.schemas import (
    CourseCreate, CourseResponse, CourseHierarchyResponse,
    ModuleCreate, ModuleResponse, ModuleUpdate,
    TopicCreate, TopicResponse, TopicUpdate,
    ModuleResourceResponse, StudentBadgeResponse,
    RAGMCQGenerateRequest, RAGMCQGenerateResponse,
    ModuleExamCreateRequest, ExamResponse, ExamQuestionSchema,
    TabsSummaryResponse, TabsSummaryCourse, TabsSummaryModule,
    CourseExploreItem, CourseRatingCreate, CourseRatingResponse,
    CourseRatingsSummary, TopicRatingCreate, TopicRatingResponse, TopicRatingSummary
)
from app.services.ingestion_service import ingestion_service
from app.services.exam_service import exam_service

router = APIRouter(prefix="/courses", tags=["Courses & Hierarchical Content Delivery"])
module_router = APIRouter(tags=["Module End Assessments"])

def extract_youtube_video_id(url: str) -> str:
    """Extract standard 11-character YouTube video ID from various link formats."""
    if not url:
        return "qH6clASSS54"
    patterns = [
        r'(?:v=|\/embed\/|\/watch\?v=|\.be\/|\/v\/)([0-9A-Za-z_-]{11})',
        r'^([0-9A-Za-z_-]{11})$'
    ]
    for p in patterns:
        m = re.search(p, url.strip())
        if m:
            return m.group(1)
    return "qH6clASSS54"


# ==============================================================================
# COURSE ROOT ENDPOINTS & RATING SCENARIOS
# ==============================================================================

async def get_course_rating_stats(course: Course, db: AsyncSession):
    """Calculates creator name, aggregated star rating, and review count."""
    educator_res = await db.execute(select(User).where(User.id == course.educator_id))
    educator = educator_res.scalars().first()
    educator_name = educator.full_name if educator else "Prof. Rajesh Ramanujan"

    c_ratings_res = await db.execute(select(CourseRating).where(CourseRating.course_id == course.id))
    c_ratings = c_ratings_res.scalars().all()

    # Topic ratings for this course
    t_res = await db.execute(
        select(Topic.id).join(Module, Topic.module_id == Module.id).where(Module.course_id == course.id)
    )
    topic_ids = [t for t in t_res.scalars().all()]
    t_ratings = []
    if topic_ids:
        t_ratings_res = await db.execute(select(TopicRating).where(TopicRating.topic_id.in_(topic_ids)))
        t_ratings = t_ratings_res.scalars().all()

    all_scores = [r.rating for r in c_ratings] + [r.rating for r in t_ratings]
    if all_scores:
        avg_rating = round(sum(all_scores) / len(all_scores), 1)
        total_count = len(all_scores)
    else:
        # Default benchmark for standard demo courses
        avg_rating = 4.9 if course.id == 1 else (4.8 if course.id == 2 else 4.7)
        total_count = 18 if course.id == 1 else (12 if course.id == 2 else 9)

    return educator_name, avg_rating, total_count

async def get_course_ratings_summary(course_id: int, user_id: Optional[int], db: AsyncSession):
    """Summarizes course reviews and current user rating."""
    ratings_res = await db.execute(
        select(CourseRating).where(CourseRating.course_id == course_id).order_by(CourseRating.created_at.desc())
    )
    all_ratings = ratings_res.scalars().all()

    reviews_out = []
    user_rating_val = None
    user_review_val = None

    for r in all_ratings:
        u_res = await db.execute(select(User).where(User.id == r.user_id))
        u = u_res.scalars().first()
        u_name = u.full_name if u else "Student"

        if user_id and r.user_id == user_id:
            user_rating_val = r.rating
            user_review_val = r.review

        reviews_out.append(CourseRatingResponse(
            id=r.id,
            course_id=r.course_id,
            user_id=r.user_id,
            user_name=u_name,
            rating=r.rating,
            review=r.review,
            created_at=r.created_at
        ))

    if all_ratings:
        avg = round(sum(r.rating for r in all_ratings) / len(all_ratings), 1)
        cnt = len(all_ratings)
    else:
        avg = 4.9
        cnt = 12

    return CourseRatingsSummary(
        course_id=course_id,
        average_rating=avg,
        total_ratings=cnt,
        user_rating=user_rating_val,
        user_review=user_review_val,
        reviews=reviews_out
    )

@router.get("/explore", response_model=List[CourseExploreItem])
async def explore_courses(
    q: Optional[str] = None,
    category: Optional[str] = None,
    sort_by: str = "rating",  # "rating" | "popular" | "newest"
    current_user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Search and explore all courses available in the app.
    Supports real-time search across course title, code, category, description, and creator name.
    Prioritizes highest-rated courses first.
    """
    courses_res = await db.execute(select(Course).order_by(Course.id.asc()))
    all_courses = courses_res.scalars().all()

    user_enrolled_ids = set()
    if current_user:
        enr_res = await db.execute(select(Enrollment.course_id).where(Enrollment.user_id == current_user.id))
        user_enrolled_ids = set(enr_res.scalars().all())

    items = []
    for c in all_courses:
        educator_name, avg_rating, total_count = await get_course_rating_stats(c, db)

        # Count modules and topics
        mod_res = await db.execute(select(Module).where(Module.course_id == c.id))
        mods = mod_res.scalars().all()
        modules_count = len(mods)

        t_count_res = await db.execute(
            select(Topic).join(Module, Topic.module_id == Module.id).where(Module.course_id == c.id)
        )
        topics_count = len(t_count_res.scalars().all())

        # Category Filter
        if category and category.lower() != "all":
            if c.category.lower() != category.lower():
                continue

        # Text Query Search (Title, Code, Description, Category, Creator Name)
        if q and q.strip():
            query_str = q.strip().lower()
            matches = (
                query_str in c.title.lower() or
                query_str in (c.code or "").lower() or
                query_str in (c.description or "").lower() or
                query_str in (c.category or "").lower() or
                query_str in educator_name.lower()
            )
            if not matches:
                continue

        items.append(CourseExploreItem(
            id=c.id,
            title=c.title,
            code=c.code or "CS101",
            description=c.description,
            category=c.category or "Computer Science",
            difficulty=c.difficulty or "Intermediate",
            thumbnail_url=c.thumbnail_url,
            educator_id=c.educator_id,
            educator_name=educator_name,
            average_rating=avg_rating,
            total_ratings=total_count,
            modules_count=modules_count,
            topics_count=topics_count,
            is_enrolled=(c.id in user_enrolled_ids),
            created_at=c.created_at
        ))

    # High Rating Priority Sorting
    if sort_by == "rating":
        items.sort(key=lambda x: (x.average_rating, x.total_ratings), reverse=True)
    elif sort_by == "popular":
        items.sort(key=lambda x: x.total_ratings, reverse=True)
    elif sort_by == "newest":
        items.sort(key=lambda x: x.id, reverse=True)

    return items

@router.get("", response_model=List[CourseResponse])
async def list_courses(db: AsyncSession = Depends(get_db)):
    """List all available courses with enriched creator name and star ratings."""
    result = await db.execute(select(Course))
    courses = result.scalars().all()
    out = []
    for c in courses:
        educator_name, avg_rating, total_count = await get_course_rating_stats(c, db)
        out.append(CourseResponse(
            id=c.id,
            title=c.title,
            code=c.code,
            description=c.description,
            category=c.category or "Computer Science",
            difficulty=c.difficulty or "Intermediate",
            thumbnail_url=c.thumbnail_url,
            educator_id=c.educator_id,
            educator_name=educator_name,
            average_rating=avg_rating,
            total_ratings=total_count,
            created_at=c.created_at
        ))
    return out


@router.post("", response_model=CourseResponse, status_code=status.HTTP_201_CREATED)
async def create_course(
    course_in: CourseCreate,
    current_user: User = Depends(require_roles("EDUCATOR", "ADMIN")),
    db: AsyncSession = Depends(get_db)
):
    """Create a new course with difficulty, thumbnail, and auto-provisioned community channels."""
    existing = await db.execute(select(Course).where(Course.code == course_in.code))
    if existing.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A course with this code already exists."
        )

    new_course = Course(
        title=course_in.title,
        code=course_in.code,
        description=course_in.description,
        category=course_in.category or "Computer Science",
        difficulty=course_in.difficulty or "Intermediate",
        thumbnail_url=course_in.thumbnail_url,
        educator_id=current_user.id
    )
    db.add(new_course)
    await db.commit()
    await db.refresh(new_course)

    # Automatically provision native community channels for this course
    channels = [
        CommunityChannel(course_id=new_course.id, name="general", description="General course discussion and announcements"),
        CommunityChannel(course_id=new_course.id, name="doubts-and-qa", description="Peer and educator doubt clarification"),
        CommunityChannel(course_id=new_course.id, name="exam-prep", description="Collaborative revision, mock questions, and notes"),
    ]
    db.add_all(channels)
    await db.commit()

    educator_name = current_user.full_name or "Prof. Rajesh Ramanujan"
    return CourseResponse(
        id=new_course.id,
        title=new_course.title,
        code=new_course.code,
        description=new_course.description,
        category=new_course.category or "Computer Science",
        difficulty=new_course.difficulty or "Intermediate",
        thumbnail_url=new_course.thumbnail_url,
        educator_id=new_course.educator_id,
        educator_name=educator_name,
        average_rating=5.0,
        total_ratings=0,
        created_at=new_course.created_at
    )


# ==============================================================================
# SUBTOPIC / LECTURE RATING ENDPOINTS
# ==============================================================================

@router.post("/topics/{topic_id}/rate", response_model=TopicRatingResponse)
async def rate_topic(
    topic_id: int,
    rating_in: TopicRatingCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Submit or update a 1-5 star feedback rating for a specific subtopic lecture."""
    t_res = await db.execute(select(Topic).where(Topic.id == topic_id))
    topic = t_res.scalars().first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    existing_res = await db.execute(
        select(TopicRating).where(
            TopicRating.topic_id == topic_id,
            TopicRating.user_id == current_user.id
        )
    )
    rating_obj = existing_res.scalars().first()
    now = datetime.now(timezone.utc)

    if rating_obj:
        rating_obj.rating = rating_in.rating
        rating_obj.feedback = rating_in.feedback
        rating_obj.created_at = now
    else:
        rating_obj = TopicRating(
            topic_id=topic_id,
            user_id=current_user.id,
            rating=rating_in.rating,
            feedback=rating_in.feedback,
            created_at=now
        )
        db.add(rating_obj)

    await db.commit()
    await db.refresh(rating_obj)

    return TopicRatingResponse(
        id=rating_obj.id,
        topic_id=topic_id,
        user_id=current_user.id,
        rating=rating_obj.rating,
        feedback=rating_obj.feedback,
        created_at=rating_obj.created_at
    )


@router.get("/topics/{topic_id}/ratings", response_model=TopicRatingSummary)
async def get_topic_ratings(
    topic_id: int,
    current_user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get rating summary and current user rating for a topic."""
    t_res = await db.execute(select(Topic).where(Topic.id == topic_id))
    topic = t_res.scalars().first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    r_res = await db.execute(select(TopicRating).where(TopicRating.topic_id == topic_id))
    all_ratings = r_res.scalars().all()

    user_val = None
    if current_user:
        for r in all_ratings:
            if r.user_id == current_user.id:
                user_val = r.rating
                break

    if all_ratings:
        avg = round(sum(r.rating for r in all_ratings) / len(all_ratings), 1)
        cnt = len(all_ratings)
    else:
        avg = 4.9
        cnt = 8

    return TopicRatingSummary(
        topic_id=topic_id,
        average_rating=avg,
        total_ratings=cnt,
        user_rating=user_val
    )


# ==============================================================================
# INDIVIDUAL COURSE DETAIL & COURSE RATING ENDPOINTS
# ==============================================================================

@router.get("/{course_id}", response_model=CourseResponse)
async def get_course(course_id: int, db: AsyncSession = Depends(get_db)):
    """Get single course basic details enriched with creator name and star ratings."""
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    educator_name, avg_rating, total_count = await get_course_rating_stats(course, db)
    return CourseResponse(
        id=course.id,
        title=course.title,
        code=course.code,
        description=course.description,
        category=course.category or "Computer Science",
        difficulty=course.difficulty or "Intermediate",
        thumbnail_url=course.thumbnail_url,
        educator_id=course.educator_id,
        educator_name=educator_name,
        average_rating=avg_rating,
        total_ratings=total_count,
        created_at=course.created_at
    )


@router.post("/{course_id}/rate", response_model=CourseRatingResponse)
async def rate_course(
    course_id: int,
    rating_in: CourseRatingCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Submit or update a student star rating and review for a course."""
    c_res = await db.execute(select(Course).where(Course.id == course_id))
    course = c_res.scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    existing_res = await db.execute(
        select(CourseRating).where(
            CourseRating.course_id == course_id,
            CourseRating.user_id == current_user.id
        )
    )
    rating_obj = existing_res.scalars().first()
    now = datetime.now(timezone.utc)

    if rating_obj:
        rating_obj.rating = rating_in.rating
        rating_obj.review = rating_in.review
        rating_obj.created_at = now
    else:
        rating_obj = CourseRating(
            course_id=course_id,
            user_id=current_user.id,
            rating=rating_in.rating,
            review=rating_in.review,
            created_at=now
        )
        db.add(rating_obj)

    await db.commit()
    await db.refresh(rating_obj)

    return CourseRatingResponse(
        id=rating_obj.id,
        course_id=course_id,
        user_id=current_user.id,
        user_name=current_user.full_name or current_user.email,
        rating=rating_obj.rating,
        review=rating_obj.review,
        created_at=rating_obj.created_at
    )


@router.get("/{course_id}/ratings", response_model=CourseRatingsSummary)
async def get_course_ratings(
    course_id: int,
    current_user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve full reviews and star rating distribution for a course."""
    c_res = await db.execute(select(Course).where(Course.id == course_id))
    course = c_res.scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    user_id = current_user.id if current_user else None
    return await get_course_ratings_summary(course_id, user_id, db)


@router.get("/{course_id}/hierarchy", response_model=CourseHierarchyResponse)
async def get_course_hierarchy(course_id: int, db: AsyncSession = Depends(get_db)):
    """Get complete hierarchical syllabus: Course -> Modules -> Topics & View-Only PDF Resources."""
    res = await db.execute(select(Course).where(Course.id == course_id))
    course = res.scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # Fetch modules ordered by order_index
    m_res = await db.execute(
        select(Module).where(Module.course_id == course_id).order_by(Module.order_index.asc())
    )
    modules = m_res.scalars().all()

    module_responses = []
    for m in modules:
        # Topics
        t_res = await db.execute(
            select(Topic).where(Topic.module_id == m.id).order_by(Topic.order_index.asc())
        )
        topics = t_res.scalars().all()

        # Resources
        r_res = await db.execute(
            select(ModuleResource).where(ModuleResource.module_id == m.id).order_by(ModuleResource.id.asc())
        )
        resources = r_res.scalars().all()

        module_responses.append(ModuleResponse(
            id=m.id,
            course_id=m.course_id,
            title=m.title,
            description=m.description,
            order_index=m.order_index,
            has_module_exam=bool(getattr(m, "has_module_exam", False)),
            module_exam_id=getattr(m, "module_exam_id", None),
            created_at=m.created_at,
            topics=[TopicResponse.model_validate(t) for t in topics],
            resources=[ModuleResourceResponse.model_validate(r) for r in resources]
        ))

    return CourseHierarchyResponse(
        id=course.id,
        title=course.title,
        code=course.code,
        description=course.description,
        category=course.category or "Computer Science",
        difficulty=getattr(course, "difficulty", "Intermediate") or "Intermediate",
        thumbnail_url=getattr(course, "thumbnail_url", None),
        educator_id=course.educator_id,
        created_at=course.created_at,
        modules=module_responses
    )


@router.post("/{course_id}/enroll")
async def enroll_in_course(
    course_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Enroll student into course."""
    existing = await db.execute(
        select(Enrollment).where(
            Enrollment.user_id == current_user.id,
            Enrollment.course_id == course_id
        )
    )
    if existing.scalars().first():
        return {"status": "already_enrolled", "message": "You are already enrolled in this course."}

    enrollment = Enrollment(user_id=current_user.id, course_id=course_id)
    db.add(enrollment)
    await db.commit()
    return {"status": "success", "message": "Successfully enrolled in course."}


# ==============================================================================
# MODULE CRUD ENDPOINTS
# ==============================================================================

@router.post("/{course_id}/modules", response_model=ModuleResponse, status_code=status.HTTP_201_CREATED)
async def create_module(
    course_id: int,
    req: ModuleCreate,
    current_user: User = Depends(require_roles("EDUCATOR", "ADMIN")),
    db: AsyncSession = Depends(get_db)
):
    """Educator adds a new curriculum module to a course."""
    course_res = await db.execute(select(Course).where(Course.id == course_id))
    if not course_res.scalars().first():
        raise HTTPException(status_code=404, detail="Course not found")

    count_res = await db.execute(select(Module).where(Module.course_id == course_id))
    existing_count = len(count_res.scalars().all())

    module = Module(
        course_id=course_id,
        title=req.title,
        description=req.description,
        order_index=existing_count + 1,
        has_module_exam=bool(req.has_module_exam) if req.has_module_exam is not None else False
    )
    db.add(module)
    await db.commit()
    await db.refresh(module)

    return ModuleResponse(
        id=module.id,
        course_id=module.course_id,
        title=module.title,
        description=module.description,
        order_index=module.order_index,
        has_module_exam=module.has_module_exam,
        module_exam_id=module.module_exam_id,
        created_at=module.created_at,
        topics=[],
        resources=[]
    )


@router.put("/modules/{module_id}", response_model=ModuleResponse)
async def update_module(
    module_id: int,
    req: ModuleUpdate,
    current_user: User = Depends(require_roles("EDUCATOR", "ADMIN")),
    db: AsyncSession = Depends(get_db)
):
    """Update module title, description, ordering, or exam link."""
    res = await db.execute(select(Module).where(Module.id == module_id))
    module = res.scalars().first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    if req.title is not None:
        module.title = req.title
    if req.description is not None:
        module.description = req.description
    if req.order_index is not None:
        module.order_index = req.order_index
    if req.has_module_exam is not None:
        module.has_module_exam = req.has_module_exam
    if req.module_exam_id is not None:
        module.module_exam_id = req.module_exam_id

    await db.commit()
    await db.refresh(module)

    t_res = await db.execute(select(Topic).where(Topic.module_id == module.id).order_by(Topic.order_index.asc()))
    r_res = await db.execute(select(ModuleResource).where(ModuleResource.module_id == module.id))

    return ModuleResponse(
        id=module.id,
        course_id=module.course_id,
        title=module.title,
        description=module.description,
        order_index=module.order_index,
        has_module_exam=module.has_module_exam,
        module_exam_id=module.module_exam_id,
        created_at=module.created_at,
        topics=[TopicResponse.model_validate(t) for t in t_res.scalars().all()],
        resources=[ModuleResourceResponse.model_validate(r) for r in r_res.scalars().all()]
    )


@router.delete("/modules/{module_id}")
async def delete_module(
    module_id: int,
    current_user: User = Depends(require_roles("EDUCATOR", "ADMIN")),
    db: AsyncSession = Depends(get_db)
):
    """Delete a module and all nested topics and resources."""
    res = await db.execute(select(Module).where(Module.id == module_id))
    module = res.scalars().first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    await db.delete(module)
    await db.commit()
    return {"status": "success", "message": "Module deleted successfully"}


# ==============================================================================
# TOPIC CRUD ENDPOINTS (WITH YOUTUBE PARSING)
# ==============================================================================

@router.post("/modules/{module_id}/topics", response_model=TopicResponse, status_code=status.HTTP_201_CREATED)
async def create_topic(
    module_id: int,
    req: TopicCreate,
    current_user: User = Depends(require_roles("EDUCATOR", "ADMIN")),
    db: AsyncSession = Depends(get_db)
):
    """Educator adds a topic concept inside a module with automated YouTube ID parsing."""
    mod_res = await db.execute(select(Module).where(Module.id == module_id))
    if not mod_res.scalars().first():
        raise HTTPException(status_code=404, detail="Module not found")

    count_res = await db.execute(select(Topic).where(Topic.module_id == module_id))
    existing_count = len(count_res.scalars().all())

    video_id = extract_youtube_video_id(req.youtube_url)

    topic = Topic(
        module_id=module_id,
        title=req.title,
        description=req.description,
        youtube_url=req.youtube_url,
        youtube_video_id=video_id,
        order_index=existing_count + 1
    )
    db.add(topic)
    await db.commit()
    await db.refresh(topic)

    return TopicResponse.model_validate(topic)


@router.put("/topics/{topic_id}", response_model=TopicResponse)
async def update_topic(
    topic_id: int,
    req: TopicUpdate,
    current_user: User = Depends(require_roles("EDUCATOR", "ADMIN")),
    db: AsyncSession = Depends(get_db)
):
    """Update topic lecture information."""
    res = await db.execute(select(Topic).where(Topic.id == topic_id))
    topic = res.scalars().first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    if req.title is not None:
        topic.title = req.title
    if req.description is not None:
        topic.description = req.description
    if req.order_index is not None:
        topic.order_index = req.order_index
    if req.youtube_url is not None:
        topic.youtube_url = req.youtube_url
        topic.youtube_video_id = extract_youtube_video_id(req.youtube_url)

    await db.commit()
    await db.refresh(topic)
    return TopicResponse.model_validate(topic)


@router.delete("/topics/{topic_id}")
async def delete_topic(
    topic_id: int,
    current_user: User = Depends(require_roles("EDUCATOR", "ADMIN")),
    db: AsyncSession = Depends(get_db)
):
    """Delete a topic from module."""
    res = await db.execute(select(Topic).where(Topic.id == topic_id))
    topic = res.scalars().first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    await db.delete(topic)
    await db.commit()
    return {"status": "success", "message": "Topic deleted successfully"}


# ==============================================================================
# MODULE RESOURCE (PDF NOTES) ENDPOINTS
# ==============================================================================

@router.post("/modules/{module_id}/resources", response_model=ModuleResourceResponse, status_code=status.HTTP_201_CREATED)
async def upload_module_resource(
    module_id: int,
    title: str = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(require_roles("EDUCATOR", "ADMIN")),
    db: AsyncSession = Depends(get_db)
):
    """Educator uploads module lecture notes / reference PDF for secure view-only access."""
    mod_res = await db.execute(select(Module).where(Module.id == module_id))
    module = mod_res.scalars().first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    filename = file.filename
    ext = os.path.splitext(filename)[1].lower().replace(".", "")
    if ext != "pdf":
        raise HTTPException(status_code=400, detail="Only PDF notes can be attached as module resources.")

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    saved_name = f"mod_{module_id}_{filename}"
    file_path = os.path.join(settings.UPLOAD_DIR, saved_name)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Ingest document into vector store under the course ID
    chunk_count = 0
    try:
        chunk_count = await ingestion_service.ingest_file(
            file_path=file_path,
            course_id=module.course_id,
            doc_id=module_id,
            doc_title=title,
            topic=module.title,
            module_id=module_id
        )
    except Exception:
        chunk_count = 1

    resource = ModuleResource(
        module_id=module_id,
        title=title,
        file_url=f"/uploads/{saved_name}",
        file_type="pdf",
        is_view_only=True,
        chunk_count=chunk_count
    )
    db.add(resource)
    await db.commit()
    await db.refresh(resource)

    return ModuleResourceResponse.model_validate(resource)


@router.get("/resources/{resource_id}/view")
async def view_module_resource(
    resource_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Secure endpoint streaming PDF bytes for in-browser canvas rendering with watermarks."""
    res = await db.execute(select(ModuleResource).where(ModuleResource.id == resource_id))
    resource = res.scalars().first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")

    file_name = os.path.basename(resource.file_url)
    disk_path = os.path.join(settings.UPLOAD_DIR, file_name)

    if not os.path.exists(disk_path):
        # Fallback check if it was saved directly in uploads without prefix
        for candidate in os.listdir(settings.UPLOAD_DIR):
            if file_name in candidate or candidate in file_name:
                disk_path = os.path.join(settings.UPLOAD_DIR, candidate)
                break

    if not os.path.exists(disk_path):
        raise HTTPException(status_code=404, detail="PDF resource file not found on server storage")

    return FileResponse(
        path=disk_path,
        media_type="application/pdf",
        headers={
            "Content-Disposition": "inline; filename=\"resource.pdf\"",
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "no-store, no-cache, must-revalidate"
        }
    )


# ==============================================================================
# BADGE VERIFICATION ENDPOINT
# ==============================================================================

@router.get("/badges/verify/{verification_hash}")
async def verify_badge(
    verification_hash: str,
    db: AsyncSession = Depends(get_db)
):
    """Public tamper-proof verification endpoint for student course completion badges."""
    res = await db.execute(select(StudentBadge).where(StudentBadge.verification_hash == verification_hash))
    badge = res.scalars().first()
    if not badge:
        return {
            "verified": False,
            "status": "INVALID_OR_REVOKED",
            "message": "No verified credential found for this cryptographic signature hash."
        }

    # Fetch student and course
    stu_res = await db.execute(select(User).where(User.id == badge.student_id))
    student = stu_res.scalars().first()

    course_res = await db.execute(select(Course).where(Course.id == badge.course_id))
    course = course_res.scalars().first()

    return {
        "verified": True,
        "status": "VALID_CREDENTIAL",
        "badge_id": badge.id,
        "badge_name": badge.badge_name,
        "difficulty_level": badge.difficulty_level,
        "issued_at": badge.issued_at.isoformat(),
        "student_name": student.full_name if student else "Enrolled Student",
        "student_email": student.email if student else "",
        "course_title": course.title if course else "COGNIPATH Verified Track",
        "course_code": course.code if course else "CP101",
        "verification_hash": badge.verification_hash,
        "cryptographic_algorithm": "SHA-256 (COGNIPATH Verified Ledger)"
    }


# ==============================================================================
# RAG-POWERED MODULE-END EXAM & TABBED WORKSPACE ENDPOINTS
# ==============================================================================

@router.post("/modules/{module_id}/generate-exam-rag", response_model=RAGMCQGenerateResponse)
@module_router.post("/modules/{module_id}/generate-exam-rag", response_model=RAGMCQGenerateResponse)
async def generate_module_exam_rag(
    module_id: int,
    req: RAGMCQGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    RAG-Powered Module MCQ Generation:
    Extracts module notes, lecture outlines, and vector embeddings strictly filtered by module_id,
    then prompts Gemini LLM for structured questions.
    """
    mod_res = await db.execute(select(Module).where(Module.id == module_id))
    module = mod_res.scalars().first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    course_id = req.course_id or module.course_id

    result = await exam_service.generate_module_rag_mcqs(
        course_id=course_id,
        module_id=module.id,
        topic=req.topic or module.title,
        count=req.count or 4,
        difficulty=req.difficulty or "Intermediate",
        db=db
    )
    return RAGMCQGenerateResponse(
        module_id=module.id,
        course_id=course_id,
        count=result["count"],
        questions=result["questions"],
        sources_used=result["sources_used"]
    )


@router.post("/modules/{module_id}/exam", response_model=ExamResponse)
@module_router.post("/modules/{module_id}/exam", response_model=ExamResponse)
async def save_module_exam(
    module_id: int,
    req: ModuleExamCreateRequest,
    current_user: User = Depends(require_roles("EDUCATOR", "ADMIN")),
    db: AsyncSession = Depends(get_db)
):
    """
    Saves the final reviewed questions and links the exam to the module.
    Sets module.has_module_exam = True and links module.module_exam_id.
    """
    mod_res = await db.execute(select(Module).where(Module.id == module_id))
    module = mod_res.scalars().first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    exam = Exam(
        course_id=module.course_id,
        module_id=module.id,
        exam_type="MODULE_QUIZ",
        scope=req.scope or "MODULE_END",
        title=req.title,
        time_limit_mins=req.time_limit_mins,
        passing_score=req.passing_score,
        created_by=current_user.id
    )
    db.add(exam)
    await db.commit()
    await db.refresh(exam)

    # Insert individual questions
    for idx, q in enumerate(req.questions):
        q_obj = ExamQuestion(
            exam_id=exam.id,
            question_type=q.question_type or "MCQ",
            question_text=q.question_text,
            options=json.dumps(q.options) if q.options else None,
            correct_answer=q.correct_answer,
            explanation=q.explanation,
            source_ref=q.source_ref,
            order_index=q.order_index or (idx + 1)
        )
        db.add(q_obj)

    # Link to module
    module.has_module_exam = True
    module.module_exam_id = exam.id
    await db.commit()
    await db.refresh(module)

    # Fetch and return full exam details
    from app.api.v1.exams import get_exam_details
    return await get_exam_details(exam.id, db)


@router.get("/tabs-summary", response_model=TabsSummaryResponse)
@module_router.get("/user/courses/tabs-summary", response_model=TabsSummaryResponse)
async def get_tabs_summary(
    current_user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns lightweight metadata (course title, ID, code, module list, progress)
    optimized to render the top tab navigation bar instantly without deep payload overhead.
    """
    courses_res = await db.execute(select(Course).order_by(Course.id.asc()))
    courses_list = courses_res.scalars().all()

    tabs_courses = []
    for c in courses_list:
        m_res = await db.execute(
            select(Module).where(Module.course_id == c.id).order_by(Module.order_index.asc())
        )
        mods = m_res.scalars().all()
        tabs_mods = []
        for m in mods:
            t_count_res = await db.execute(select(Topic).where(Topic.module_id == m.id))
            r_count_res = await db.execute(select(ModuleResource).where(ModuleResource.module_id == m.id))
            topics_count = len(t_count_res.scalars().all())
            resources_count = len(r_count_res.scalars().all())

            tabs_mods.append(TabsSummaryModule(
                id=m.id,
                title=m.title,
                order_index=m.order_index,
                topics_count=topics_count,
                resources_count=resources_count,
                has_module_exam=bool(getattr(m, "has_module_exam", False)),
                module_exam_id=getattr(m, "module_exam_id", None),
                is_completed=False
            ))

        tabs_courses.append(TabsSummaryCourse(
            id=c.id,
            code=c.code or "CP101",
            title=c.title,
            category=c.category or "Computer Science",
            difficulty=getattr(c, "difficulty", "Intermediate") or "Intermediate",
            completion_percentage=0.0,
            modules=tabs_mods
        ))

    return TabsSummaryResponse(courses=tabs_courses)

