import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from urllib.parse import parse_qs, urlparse

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import delete, func, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.cache import ttl_cache
from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user, get_optional_current_user, require_roles
from app.models.models import (
    Assignment,
    AssignmentSubmission,
    CommunityChannel,
    CommunityMessage,
    Course,
    CourseRating,
    CurriculumAuditReport,
    Document,
    Enrollment,
    Exam,
    ExamQuestion,
    ExamSubmission,
    LearningPod,
    Module,
    ModuleResource,
    PodBlacklist,
    PodMessage,
    Quiz,
    QuizQuestion,
    StudentActivityLog,
    StudentBadge,
    StudentConceptRetention,
    StudentQuizAttempt,
    StudentSkillMastery,
    Topic,
    TopicRating,
    User,
)
from app.schemas.schemas import (
    CourseCreate,
    CourseExploreItem,
    CourseHierarchyResponse,
    CourseRatingCreate,
    CourseRatingResponse,
    CourseRatingsSummary,
    CourseResponse,
    CourseUpdate,
    ExamResponse,
    ModuleCreate,
    ModuleExamCreateRequest,
    ModuleReorderRequest,
    ModuleResourceResponse,
    ModuleResponse,
    ModuleUpdate,
    RAGMCQGenerateRequest,
    RAGMCQGenerateResponse,
    TabsSummaryCourse,
    TabsSummaryModule,
    TabsSummaryResponse,
    TopicCompleteRequest,
    TopicCompleteResponse,
    TopicCreate,
    TopicRatingCreate,
    TopicRatingResponse,
    TopicRatingSummary,
    TopicReorderRequest,
    TopicResponse,
    TopicUpdate,
)
from app.services.chroma_service import chroma_service
from app.services.exam_service import exam_service
from app.services.ingestion_service import ingestion_service

logger = logging.getLogger("cognipath.courses")

router = APIRouter(prefix="/courses", tags=["Courses & Hierarchical Content Delivery"])
module_router = APIRouter(tags=["Module End Assessments"])

CANONICAL_DIFFICULTY_MAP = {
    "easy": "Easy",
    "medium": "Medium",
    "hard": "Hard",
    "beginner": "Beginner",
    "intermediate": "Intermediate",
    "advanced": "Advanced",
}


def normalize_difficulty(val: str | None) -> str:
    """Validate and normalize course difficulty level."""
    if val is None or not str(val).strip():
        return "Intermediate"
    key = str(val).strip().lower()
    if key not in CANONICAL_DIFFICULTY_MAP:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid difficulty level. Allowed values: Easy, Medium, Hard (or Beginner, Intermediate, Advanced)."
        )
    return CANONICAL_DIFFICULTY_MAP[key]


def extract_youtube_video_id(url: str | None) -> str | None:
    """Extract standard 11-character YouTube video ID from supported YouTube link formats.
    Returns None if the URL is invalid, unsupported, or from an unauthorized domain.
    Never returns a hardcoded fallback.
    """
    if not url:
        return None
    url_str = str(url).strip()
    if not url_str:
        return None

    # Bare 11-character video ID
    if re.fullmatch(r"[0-9A-Za-z_-]{11}", url_str):
        return url_str

    parse_url = url_str
    if not parse_url.startswith(("http://", "https://")):
        parse_url = "https://" + parse_url

    try:
        parsed = urlparse(parse_url)
    except Exception:
        return None

    hostname = (parsed.hostname or "").lower()
    allowed_domains = {
        "youtube.com",
        "www.youtube.com",
        "m.youtube.com",
        "music.youtube.com",
        "youtube-nocookie.com",
        "www.youtube-nocookie.com",
        "youtu.be",
        "www.youtu.be",
    }

    if hostname not in allowed_domains:
        return None

    # Handle youtu.be/<id>
    if hostname in ("youtu.be", "www.youtu.be"):
        path_parts = [p for p in parsed.path.split("/") if p]
        if len(path_parts) == 1 and re.fullmatch(r"[0-9A-Za-z_-]{11}", path_parts[0]):
            return path_parts[0]
        return None

    # Handle youtube.com/watch?v=<id>
    if parsed.path in ("/watch", "/watch/"):
        query_params = parse_qs(parsed.query)
        v_list = query_params.get("v")
        if v_list and len(v_list) > 0:
            vid = v_list[0]
            if re.fullmatch(r"[0-9A-Za-z_-]{11}", vid):
                return vid
        return None

    # Handle /embed/<id>, /shorts/<id>, /v/<id>, /e/<id>, or /live/<id>
    path_match = re.fullmatch(r"/(?:embed|shorts|v|e|live)/([0-9A-Za-z_-]{11})/?", parsed.path)
    if path_match:
        return path_match.group(1)

    return None


def invalidate_course_hierarchy_cache(course_id: int):
    """Invalidates all cached role variants of course hierarchy."""
    ttl_cache.invalidate(f"hierarchy_{course_id}")
    ttl_cache.invalidate(f"hierarchy_{course_id}_educator")
    ttl_cache.invalidate(f"hierarchy_{course_id}_student")


async def _is_user_course_owner(course: Course, current_user: User | None, db: AsyncSession) -> bool:
    if not current_user:
        return False
    if current_user.role == "ADMIN":
        return True
    if course.educator_id == current_user.id:
        return True
    if course.educator_id and current_user.email:
        ed_res = await db.execute(select(User).where(User.id == course.educator_id))
        ed_user = ed_res.scalars().first()
        if ed_user and ed_user.email and ed_user.email.strip().lower() == current_user.email.strip().lower():
            return True
    return False


async def _check_course_ownership(course_id: int, current_user: User, db: AsyncSession) -> Course:
    course_res = await db.execute(select(Course).where(Course.id == course_id))
    course = course_res.scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if not await _is_user_course_owner(course, current_user, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the educator who created this course can modify or delete it."
        )
    return course


async def _validate_course_curriculum_for_publication(course_id: int, db: AsyncSession):
    """Ensure a course has at least 1 module and at least 1 topic with a valid YouTube video before publishing."""
    mod_res = await db.execute(select(Module).where(Module.course_id == course_id).order_by(Module.order_index.asc()))
    modules = mod_res.scalars().all()
    if not modules:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Course cannot be published without at least one module."
        )

    mod_ids = [m.id for m in modules]
    top_res = await db.execute(select(Topic).where(Topic.module_id.in_(mod_ids)))
    topics = top_res.scalars().all()
    if not topics:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Course cannot be published without at least one topic inside a module."
        )

    for t in topics:
        vid = extract_youtube_video_id(t.youtube_url) or extract_youtube_video_id(t.youtube_video_id)
        if not vid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Topic '{t.title}' does not have a valid YouTube video URL."
            )


# ==============================================================================
# COURSE ROOT ENDPOINTS & RATING SCENARIOS
# ==============================================================================

async def get_course_rating_stats(course: Course, db: AsyncSession):
    """Calculates creator name, creator email, aggregated star rating, and review count."""
    educator_res = await db.execute(select(User).where(User.id == course.educator_id))
    educator = educator_res.scalars().first()
    educator_name = (educator.full_name.strip() if educator and educator.full_name and educator.full_name.strip() else "Course Educator")
    educator_email = educator.email if educator else None

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
        avg_rating = 0.0
        total_count = 0

    return educator_name, educator_email, avg_rating, total_count


async def build_enriched_course_dict(
    course: Course,
    db: AsyncSession,
    current_user: User | None = None
) -> dict:
    """Builds complete authoritative metadata dictionary for a course from the database."""
    educator_res = await db.execute(select(User).where(User.id == course.educator_id))
    educator = educator_res.scalars().first()
    educator_name = (
        educator.full_name.strip()
        if educator and educator.full_name and educator.full_name.strip()
        else "Course Educator"
    )
    educator_email = educator.email if educator else None
    university = (
        educator.university.strip()
        if educator and educator.university and educator.university.strip()
        else None
    )
    educator_department = (
        educator.department.strip()
        if educator and educator.department and educator.department.strip()
        else None
    )

    _, _, avg_rating, total_ratings = await get_course_rating_stats(course, db)

    mod_res = await db.execute(
        select(Module).where(Module.course_id == course.id).order_by(Module.order_index.asc())
    )
    mods = mod_res.scalars().all()
    modules_count = len(mods)

    t_res = await db.execute(
        select(Topic)
        .join(Module, Topic.module_id == Module.id)
        .where(Module.course_id == course.id)
        .order_by(Module.order_index.asc(), Topic.order_index.asc())
    )
    topics = t_res.scalars().all()
    topics_count = len(topics)
    next_t_title = topics[0].title if topics else "Overview & Introduction"

    enr_all_res = await db.execute(select(Enrollment).where(Enrollment.course_id == course.id))
    all_enrollments = enr_all_res.scalars().all()
    enrolled_count = len(all_enrollments)

    user_enr = None
    if current_user:
        for e in all_enrollments:
            if e.user_id == current_user.id:
                user_enr = e
                break

    is_enrolled = user_enr is not None
    progress_percentage = user_enr.completion_percentage if user_enr else 0.0
    enrolled_at = user_enr.enrolled_at if user_enr else None

    raw_pub = getattr(course, "is_published", True)
    is_published = True if raw_pub is None else bool(raw_pub)
    publication_status = "PUBLISHED" if is_published else "DRAFT"

    cat_val = (course.category or "Computer Science").strip() or "Computer Science"
    branch_val = (getattr(course, "target_branch", None) or cat_val or "Computer Science & Engineering (CSE)").strip()
    diff_val = (course.difficulty or "Intermediate").strip()

    return {
        "id": course.id,
        "title": course.title or "Untitled Course",
        "code": course.code or f"CP{course.id}",
        "description": course.description,
        "category": cat_val,
        "target_branch": branch_val,
        "difficulty": diff_val,
        "thumbnail_url": course.thumbnail_url,
        "is_published": is_published,
        "publication_status": publication_status,
        "educator_id": course.educator_id,
        "educator_name": educator_name,
        "educator_email": educator_email,
        "university": university,
        "educator_university": university,
        "educator_department": educator_department,
        "average_rating": avg_rating,
        "total_ratings": total_ratings,
        "enrolled_count": enrolled_count,
        "modules_count": modules_count,
        "topics_count": topics_count,
        "progress_percentage": progress_percentage,
        "enrolled_at": enrolled_at,
        "next_topic_title": next_t_title,
        "is_enrolled": is_enrolled,
        "created_at": course.created_at,
        "updated_at": getattr(course, "updated_at", None) or course.created_at,
    }


async def get_course_ratings_summary(course_id: int, user_id: int | None, db: AsyncSession):
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
        avg = 0.0
        cnt = 0

    return CourseRatingsSummary(
        course_id=course_id,
        average_rating=avg,
        total_ratings=cnt,
        user_rating=user_rating_val,
        user_review=user_review_val,
        reviews=reviews_out
    )


@router.get("/explore", response_model=list[CourseExploreItem])
async def explore_courses(
    q: str | None = None,
    category: str | None = None,
    target_branch: str | None = None,
    difficulty: str | None = None,
    sort_by: str = "rating",  # "rating" | "popular" | "newest"
    include_enrolled: bool = False,
    current_user: User | None = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Search and explore published courses available in the platform.
    - Excludes unpublished (draft) courses.
    - Excludes courses in which the current authenticated user is already enrolled (unless include_enrolled=True).
    - Supports sorting by:
      * 'newest': most recently created/published courses first
      * 'popular': highest student enrollment count first (tie-broken by rating and ID)
      * 'rating' / 'highest_rated': highest genuine rating first (unrated courses have 0.0 and sort after rated ones)
    """
    courses_res = await db.execute(select(Course).order_by(Course.id.asc()))
    all_courses = courses_res.scalars().all()

    user_enrolled_ids = set()
    if current_user:
        enr_res = await db.execute(select(Enrollment.course_id).where(Enrollment.user_id == current_user.id))
        user_enrolled_ids = set(enr_res.scalars().all())

    items: list[CourseExploreItem] = []
    for c in all_courses:
        raw_pub = getattr(c, "is_published", True)
        is_pub = True if raw_pub is None else bool(raw_pub)
        if not is_pub:
            continue

        if current_user and not include_enrolled and c.id in user_enrolled_ids:
            continue

        enriched = await build_enriched_course_dict(c, db, current_user)

        # Category Filter (null-safe)
        if category and category.strip().lower() != "all":
            cat_filter = category.strip().lower()
            raw_cat = (c.category or "").strip().lower()
            raw_branch = (getattr(c, "target_branch", None) or "").strip().lower()
            if cat_filter != raw_cat and cat_filter != raw_branch and cat_filter not in raw_branch:
                continue

        # Target Branch Filter
        if target_branch and target_branch.strip().lower() != "all":
            tb_filter = target_branch.strip().lower()
            if tb_filter not in enriched["target_branch"].lower() and tb_filter not in enriched["category"].lower():
                continue

        # Difficulty Filter
        if difficulty and difficulty.strip().lower() != "all":
            diff_filter = difficulty.strip().lower()
            c_diff = enriched["difficulty"].lower()
            equiv_map = {
                "easy": {"easy", "beginner"},
                "beginner": {"easy", "beginner"},
                "medium": {"medium", "intermediate"},
                "intermediate": {"medium", "intermediate"},
                "hard": {"hard", "advanced"},
                "advanced": {"hard", "advanced"},
            }
            allowed_diffs = equiv_map.get(diff_filter, {diff_filter})
            if c_diff not in allowed_diffs:
                continue

        # Text Query Search (Title, Code, Description, Category, Target Branch, Educator Name, University)
        if q and q.strip():
            query_str = q.strip().lower()
            matches = (
                query_str in (c.title or "").lower() or
                query_str in (c.code or "").lower() or
                query_str in (c.description or "").lower() or
                query_str in (c.category or "").lower() or
                query_str in enriched["target_branch"].lower() or
                query_str in (enriched["educator_name"] or "").lower() or
                query_str in (enriched["educator_email"] or "").lower() or
                query_str in (enriched["university"] or "").lower()
            )
            if not matches:
                continue

        items.append(CourseExploreItem(**enriched))

    sort_key = (sort_by or "rating").strip().lower()
    if sort_key in ("rating", "highest_rated"):
        # Genuine ratings prioritized; unrated courses (total_ratings == 0) sort after rated ones
        items.sort(
            key=lambda x: (
                1 if x.total_ratings > 0 else 0,
                x.average_rating,
                x.total_ratings,
                x.enrolled_count,
                x.id
            ),
            reverse=True
        )
    elif sort_key in ("popular", "popularity"):
        # Popularity based on actual unique student enrollment count, tie-broken by rating and ID
        items.sort(
            key=lambda x: (
                x.enrolled_count,
                x.average_rating,
                x.total_ratings,
                x.id
            ),
            reverse=True
        )
    elif sort_key == "newest":
        items.sort(
            key=lambda x: (
                x.created_at.timestamp() if x.created_at else 0.0,
                x.id
            ),
            reverse=True
        )

    return items


@router.get("/my-courses", response_model=list[CourseResponse])
async def get_my_created_courses(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieve ONLY courses created by the currently authenticated educator.
    Never returns courses created by other educators or general student enrollments.
    Includes both DRAFT and PUBLISHED courses owned by this educator.
    """
    matching_educator_ids = {current_user.id}
    if current_user.email:
        ed_res = await db.execute(
            select(User.id).where(User.email.ilike(current_user.email.strip()))
        )
        matching_educator_ids.update(ed_res.scalars().all())

    res = await db.execute(
        select(Course)
        .where(Course.educator_id.in_(matching_educator_ids))
        .order_by(Course.id.desc())
    )
    courses = res.scalars().all()

    out = []
    for c in courses:
        enriched = await build_enriched_course_dict(c, db, current_user)
        out.append(CourseResponse(**enriched))
    return out


@router.get("/enrolled", response_model=list[CourseResponse])
async def get_enrolled_courses(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieve ONLY courses in which the currently authenticated user has an active Enrollment record.
    Kept strictly separate from educator-created courses.
    """
    res = await db.execute(
        select(Course)
        .join(Enrollment, Course.id == Enrollment.course_id)
        .where(Enrollment.user_id == current_user.id)
        .order_by(Enrollment.enrolled_at.desc(), Course.id.asc())
    )
    courses = res.scalars().all()

    out = []
    for c in courses:
        raw_pub = getattr(c, "is_published", True)
        is_pub = True if raw_pub is None else bool(raw_pub)
        if not is_pub and not await _is_user_course_owner(c, current_user, db):
            continue
        enriched = await build_enriched_course_dict(c, db, current_user)
        enriched["is_enrolled"] = True
        out.append(CourseResponse(**enriched))
    return out


@router.get("", response_model=list[CourseResponse])
async def list_courses(
    enrolled_only: bool = False,
    current_user: User | None = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List published courses (plus the current educator's own drafts) with enriched metadata."""
    if enrolled_only and current_user:
        return await get_enrolled_courses(current_user=current_user, db=db)

    result = await db.execute(select(Course).order_by(Course.id.asc()))
    courses = result.scalars().all()
    out = []
    for c in courses:
        raw_pub = getattr(c, "is_published", True)
        is_pub = True if raw_pub is None else bool(raw_pub)
        if not is_pub:
            is_owner = await _is_user_course_owner(c, current_user, db)
            if not is_owner:
                continue
        enriched = await build_enriched_course_dict(c, db, current_user)
        out.append(CourseResponse(**enriched))
    return out


@router.post("", response_model=CourseResponse, status_code=status.HTTP_201_CREATED)
async def create_course(
    course_in: CourseCreate,
    current_user: User = Depends(require_roles("EDUCATOR", "ADMIN")),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new course with validated metadata, difficulty, target branch,
    auto-provisioned community channels, and atomic nested curriculum.
    Enforces that initial curriculum contains at least 1 module, 1 topic, and a valid YouTube video URL.
    """
    title_clean = (course_in.title or "").strip()
    if len(title_clean) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Course title is required and must contain at least 2 characters."
        )
    if len(title_clean) > 255:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Course title must not exceed 255 characters."
        )

    difficulty_val = normalize_difficulty(course_in.difficulty)

    cat_clean = (course_in.category or course_in.target_branch or "Computer Science").strip()
    branch_clean = (course_in.target_branch or course_in.category or "Computer Science & Engineering (CSE)").strip()
    if not cat_clean or not branch_clean:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target student branch / category is required."
        )

    desc_clean = (course_in.description or "").strip()
    if not desc_clean:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Course description is required."
        )

    # Validate initial curriculum requirements: at least 1 module, 1 topic, and valid YouTube URLs
    if not course_in.modules or len(course_in.modules) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A course must include at least one initial module and one topic with a valid YouTube URL."
        )

    validated_modules = []
    for m_idx, mod_in in enumerate(course_in.modules):
        mod_title = (mod_in.title or "").strip()
        if not mod_title:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Module {m_idx + 1} title is required and must not be empty."
            )
        if not mod_in.topics or len(mod_in.topics) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Module '{mod_title}' must contain at least one topic."
            )

        validated_topics = []
        for t_idx, top_in in enumerate(mod_in.topics):
            top_title = (top_in.title or "").strip()
            if not top_title:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Topic {t_idx + 1} in module '{mod_title}' requires a title."
                )
            yt_url = (top_in.youtube_url or "").strip()
            vid_id = extract_youtube_video_id(yt_url)
            if not vid_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid YouTube video URL for topic '{top_title}'. Please provide a valid YouTube watch, youtu.be, embed, or shorts link."
                )
            validated_topics.append({
                "title": top_title,
                "description": (top_in.description or "").strip() or "Video lecture and conceptual walkthrough.",
                "youtube_url": yt_url if yt_url.startswith("http") else f"https://www.youtube.com/watch?v={vid_id}",
                "youtube_video_id": vid_id,
                "order_index": t_idx + 1,
            })

        validated_modules.append({
            "title": mod_title,
            "description": (mod_in.description or "").strip() or f"Module {m_idx + 1} syllabus.",
            "order_index": m_idx + 1,
            "has_module_exam": bool(mod_in.has_module_exam),
            "topics": validated_topics,
        })

    code_candidate = (course_in.code or "").strip()
    if not code_candidate:
        code_candidate = f"CP{uuid.uuid4().hex[:6].upper()}"
    existing = await db.execute(select(Course).where(Course.code == code_candidate))
    if existing.scalars().first():
        code_candidate = f"{code_candidate}-{uuid.uuid4().hex[:4].upper()}"

    now = datetime.now(timezone.utc)
    new_course = Course(
        title=title_clean,
        code=code_candidate,
        description=desc_clean,
        category=cat_clean[:100],
        target_branch=branch_clean[:255],
        difficulty=difficulty_val,
        thumbnail_url=(course_in.thumbnail_url or "").strip() or None,
        is_published=bool(course_in.is_published) if course_in.is_published is not None else True,
        educator_id=current_user.id,
        created_at=now,
        updated_at=now,
    )
    db.add(new_course)
    await db.flush()

    # Automatically provision native community channels for this course
    channels = [
        CommunityChannel(course_id=new_course.id, name="general", description="General course discussion and announcements"),
        CommunityChannel(course_id=new_course.id, name="doubts-and-qa", description="Peer and educator doubt clarification"),
        CommunityChannel(course_id=new_course.id, name="exam-prep", description="Collaborative revision, mock questions, and notes"),
    ]
    db.add_all(channels)

    # Atomically persist validated modules and topics
    for mod_data in validated_modules:
        module_obj = Module(
            course_id=new_course.id,
            title=mod_data["title"],
            description=mod_data["description"],
            order_index=mod_data["order_index"],
            has_module_exam=mod_data["has_module_exam"]
        )
        db.add(module_obj)
        await db.flush()

        for top_data in mod_data["topics"]:
            topic_obj = Topic(
                module_id=module_obj.id,
                title=top_data["title"],
                description=top_data["description"],
                youtube_url=top_data["youtube_url"],
                youtube_video_id=top_data["youtube_video_id"],
                order_index=top_data["order_index"]
            )
            db.add(topic_obj)

    await db.commit()
    await db.refresh(new_course)
    invalidate_course_hierarchy_cache(new_course.id)

    enriched = await build_enriched_course_dict(new_course, db, current_user)
    return CourseResponse(**enriched)


@router.put("/{course_id}", response_model=CourseResponse)
async def update_course(
    course_id: int,
    course_in: CourseUpdate,
    current_user: User = Depends(require_roles("EDUCATOR", "ADMIN")),
    db: AsyncSession = Depends(get_db)
):
    """Update course metadata, difficulty, target branch, or publication status."""
    course = await _check_course_ownership(course_id, current_user, db)

    if course_in.title is not None:
        title_clean = course_in.title.strip()
        if len(title_clean) < 2:
            raise HTTPException(status_code=400, detail="Course title must contain at least 2 characters.")
        course.title = title_clean

    if course_in.description is not None:
        desc_clean = course_in.description.strip()
        if not desc_clean:
            raise HTTPException(status_code=400, detail="Course description cannot be empty.")
        course.description = desc_clean

    if course_in.difficulty is not None:
        course.difficulty = normalize_difficulty(course_in.difficulty)

    if course_in.category is not None and course_in.category.strip():
        course.category = course_in.category.strip()[:100]

    if course_in.target_branch is not None and course_in.target_branch.strip():
        course.target_branch = course_in.target_branch.strip()[:255]
        if course_in.category is None:
            course.category = course_in.target_branch.strip()[:100]

    if course_in.thumbnail_url is not None:
        course.thumbnail_url = course_in.thumbnail_url.strip() or None

    if course_in.is_published is not None:
        if course_in.is_published:
            await _validate_course_curriculum_for_publication(course.id, db)
        course.is_published = bool(course_in.is_published)

    course.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(course)
    invalidate_course_hierarchy_cache(course.id)

    enriched = await build_enriched_course_dict(course, db, current_user)
    return CourseResponse(**enriched)


@router.post("/{course_id}/publish", response_model=CourseResponse)
async def publish_course(
    course_id: int,
    current_user: User = Depends(require_roles("EDUCATOR", "ADMIN")),
    db: AsyncSession = Depends(get_db)
):
    """Publish a draft course after verifying all required curriculum rules (at least 1 module, 1 topic, valid YouTube video)."""
    course = await _check_course_ownership(course_id, current_user, db)
    await _validate_course_curriculum_for_publication(course.id, db)

    course.is_published = True
    course.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(course)
    invalidate_course_hierarchy_cache(course.id)

    enriched = await build_enriched_course_dict(course, db, current_user)
    return CourseResponse(**enriched)


@router.post("/{course_id}/unpublish", response_model=CourseResponse)
async def unpublish_course(
    course_id: int,
    current_user: User = Depends(require_roles("EDUCATOR", "ADMIN")),
    db: AsyncSession = Depends(get_db)
):
    """Revert a published course to DRAFT status."""
    course = await _check_course_ownership(course_id, current_user, db)
    course.is_published = False
    course.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(course)
    invalidate_course_hierarchy_cache(course.id)

    enriched = await build_enriched_course_dict(course, db, current_user)
    return CourseResponse(**enriched)


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

    # Verify the user is enrolled in (or owns) the published course containing this topic
    mod_res = await db.execute(select(Module).where(Module.id == topic.module_id))
    mod = mod_res.scalars().first()
    if mod:
        c_res = await db.execute(select(Course).where(Course.id == mod.course_id))
        parent_course = c_res.scalars().first()
        is_owner = await _is_user_course_owner(parent_course, current_user, db) if parent_course else False
        if parent_course and not bool(getattr(parent_course, "is_published", True)) and not is_owner:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This course is currently in draft status and is not available to students."
            )
        if not is_owner:
            enr_res = await db.execute(
                select(Enrollment).where(
                    Enrollment.user_id == current_user.id,
                    Enrollment.course_id == mod.course_id
                )
            )
            if not enr_res.scalars().first():
                raise HTTPException(status_code=403, detail="You must be enrolled in this course to rate topics.")

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
    current_user: User | None = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get rating summary and current user rating for a topic."""
    t_res = await db.execute(select(Topic).where(Topic.id == topic_id))
    topic = t_res.scalars().first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    mod_res = await db.execute(select(Module).where(Module.id == topic.module_id))
    mod = mod_res.scalars().first()
    if mod:
        c_res = await db.execute(select(Course).where(Course.id == mod.course_id))
        parent_course = c_res.scalars().first()
        if parent_course and not bool(getattr(parent_course, "is_published", True)):
            if not await _is_user_course_owner(parent_course, current_user, db):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="This course is currently in draft status and is not available to students."
                )

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
        avg = 0.0
        cnt = 0

    return TopicRatingSummary(
        topic_id=topic_id,
        average_rating=avg,
        total_ratings=cnt,
        user_rating=user_val
    )


# ==============================================================================
# INDIVIDUAL COURSE DETAIL & COURSE RATING ENDPOINTS
# ==============================================================================

@router.get("/tabs-summary", response_model=TabsSummaryResponse)
@module_router.get("/user/courses/tabs-summary", response_model=TabsSummaryResponse)
async def get_tabs_summary(
    current_user: User | None = Depends(get_optional_current_user),
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
        raw_pub = getattr(c, "is_published", True)
        is_pub = True if raw_pub is None else bool(raw_pub)
        if not is_pub and not await _is_user_course_owner(c, current_user, db):
            continue
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


@router.get("/{course_id}", response_model=CourseResponse)
async def get_course(
    course_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get single course basic details enriched with creator name, university, counts, and star ratings."""
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    is_pub = bool(getattr(course, "is_published", True))
    if not is_pub and not await _is_user_course_owner(course, current_user, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This course is currently in draft status and is not available to students."
        )

    enriched = await build_enriched_course_dict(course, db, current_user)
    return CourseResponse(**enriched)


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

    is_owner = await _is_user_course_owner(course, current_user, db)
    if not bool(getattr(course, "is_published", True)) and not is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This course is currently in draft status and cannot be rated."
        )

    # Only enrolled users (or the course owner/admin) can rate
    if not is_owner:
        enr_res = await db.execute(
            select(Enrollment).where(
                Enrollment.user_id == current_user.id,
                Enrollment.course_id == course_id
            )
        )
        if not enr_res.scalars().first():
            raise HTTPException(status_code=403, detail="You must be enrolled in this course to submit a rating.")

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
    invalidate_course_hierarchy_cache(course_id)

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
    current_user: User | None = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve full reviews and star rating distribution for a course."""
    c_res = await db.execute(select(Course).where(Course.id == course_id))
    course = c_res.scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if not bool(getattr(course, "is_published", True)) and not await _is_user_course_owner(course, current_user, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This course is currently in draft status and is not available to students."
        )

    user_id = current_user.id if current_user else None
    return await get_course_ratings_summary(course_id, user_id, db)


@router.get("/{course_id}/hierarchy", response_model=CourseHierarchyResponse)
async def get_course_hierarchy(
    course_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get complete hierarchical syllabus: Course -> Modules -> Topics & View-Only PDF Resources."""
    res = await db.execute(select(Course).where(Course.id == course_id))
    course = res.scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    is_owner_or_admin = await _is_user_course_owner(course, current_user, db)
    is_pub = bool(getattr(course, "is_published", True))
    if not is_pub and not is_owner_or_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This course is currently in draft status and is not available to students."
        )

    # Fetch modules ordered by order_index
    m_res = await db.execute(
        select(Module).where(Module.course_id == course_id).order_by(Module.order_index.asc(), Module.id.asc())
    )
    modules = m_res.scalars().all()
    module_ids = [m.id for m in modules]

    # Bulk-fetch ALL topics and resources in 2 queries (eliminates N+1)
    topics_map: dict[int, list] = {m.id: [] for m in modules}
    resources_map: dict[int, list] = {m.id: [] for m in modules}

    if module_ids:
        t_res = await db.execute(
            select(Topic)
            .where(Topic.module_id.in_(module_ids))
            .order_by(Topic.module_id.asc(), Topic.order_index.asc(), Topic.id.asc())
        )
        for t in t_res.scalars().all():
            if t.module_id in topics_map:
                topics_map[t.module_id].append(t)

        r_res = await db.execute(
            select(ModuleResource)
            .where(ModuleResource.module_id.in_(module_ids))
            .order_by(ModuleResource.module_id.asc(), ModuleResource.id.asc())
        )
        for r in r_res.scalars().all():
            if r.module_id in resources_map:
                resources_map[r.module_id].append(r)

    enriched = await build_enriched_course_dict(course, db, current_user)
    can_access_full_content = is_owner_or_admin or bool(enriched["is_enrolled"])

    module_responses = [
        ModuleResponse(
            id=m.id,
            course_id=m.course_id,
            title=m.title,
            description=m.description,
            order_index=m.order_index,
            has_module_exam=bool(getattr(m, "has_module_exam", False)),
            module_exam_id=getattr(m, "module_exam_id", None) if can_access_full_content else None,
            created_at=m.created_at,
            topics=[
                TopicResponse(
                    id=t.id,
                    module_id=t.module_id,
                    title=t.title,
                    description=t.description,
                    youtube_url=t.youtube_url if can_access_full_content else "",
                    youtube_video_id=t.youtube_video_id if can_access_full_content else "",
                    order_index=t.order_index,
                    created_at=t.created_at,
                )
                for t in topics_map[m.id]
            ],
            resources=[
                ModuleResourceResponse(
                    id=r.id,
                    module_id=r.module_id,
                    title=r.title,
                    file_url=r.file_url if can_access_full_content else "",
                    file_type=r.file_type,
                    is_view_only=r.is_view_only,
                    chunk_count=r.chunk_count,
                    created_at=r.created_at,
                )
                for r in resources_map[m.id]
            ]
        )
        for m in modules
    ]

    # Fetch final course certification exam if present (only exposed to enrolled students or course owner/admin)
    final_exam_data = None
    if can_access_full_content:
        fe_res = await db.execute(
            select(Exam).where(Exam.course_id == course_id, Exam.exam_type == "FINAL_EXAM")
        )
        final_exam = fe_res.scalars().first()
        if final_exam:
            q_res = await db.execute(
                select(ExamQuestion)
                .where(ExamQuestion.exam_id == final_exam.id)
                .order_by(ExamQuestion.order_index.asc(), ExamQuestion.id.asc())
            )
            fe_questions = q_res.scalars().all()
            from app.api.v1.exams import _safe_parse_options
            final_exam_data = {
                "id": final_exam.id,
                "course_id": final_exam.course_id,
                "module_id": None,
                "exam_type": final_exam.exam_type,
                "scope": getattr(final_exam, "scope", "FINAL_COURSE") or "FINAL_COURSE",
                "title": final_exam.title,
                "time_limit_mins": final_exam.time_limit_mins,
                "passing_score": final_exam.passing_score,
                "created_at": final_exam.created_at,
                "questions": [
                    {
                        "id": q.id,
                        "question_type": q.question_type,
                        "question_text": q.question_text,
                        "options": _safe_parse_options(q.options),
                        "correct_answer": q.correct_answer if is_owner_or_admin else None,
                        "explanation": q.explanation if is_owner_or_admin else None,
                        "source_ref": q.source_ref if is_owner_or_admin else None,
                        "order_index": q.order_index
                    }
                    for q in fe_questions
                ]
            }

    response = CourseHierarchyResponse(
        id=course.id,
        title=course.title,
        code=course.code,
        description=course.description,
        category=enriched["category"],
        target_branch=enriched["target_branch"],
        difficulty=enriched["difficulty"],
        is_published=enriched["is_published"],
        publication_status=enriched["publication_status"],
        thumbnail_url=enriched["thumbnail_url"],
        educator_id=course.educator_id,
        educator_name=enriched["educator_name"],
        educator_email=enriched["educator_email"],
        university=enriched["university"],
        educator_university=enriched["educator_university"],
        educator_department=enriched["educator_department"],
        average_rating=enriched["average_rating"],
        total_ratings=enriched["total_ratings"],
        enrolled_count=enriched["enrolled_count"],
        is_enrolled=enriched["is_enrolled"],
        created_at=course.created_at,
        updated_at=enriched["updated_at"],
        modules=module_responses,
        final_exam=final_exam_data
    )
    return response


@router.post("/{course_id}/enroll")
async def enroll_in_course(
    course_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Enroll student into a published course."""
    c_res = await db.execute(select(Course).where(Course.id == course_id))
    course = c_res.scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found or has been deleted.")

    is_pub = bool(getattr(course, "is_published", True))
    if not is_pub:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot enroll in a course that is currently in draft status."
        )

    if course.educator_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are the creator of this course and manage it from 'My Created Courses'."
        )

    existing = await db.execute(
        select(Enrollment).where(
            Enrollment.user_id == current_user.id,
            Enrollment.course_id == course_id
        )
    )
    if existing.scalars().first():
        return {"status": "already_enrolled", "message": "You are already enrolled in this course."}

    enrollment = Enrollment(user_id=current_user.id, course_id=course_id, completion_percentage=0.0)
    db.add(enrollment)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        return {"status": "already_enrolled", "message": "You are already enrolled in this course."}

    invalidate_course_hierarchy_cache(course_id)
    return {"status": "success", "message": "Successfully enrolled in course."}


@router.post("/{course_id}/unenroll")
@router.delete("/{course_id}/enroll")
async def unenroll_from_course(
    course_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Unenroll from a course for the current student."""
    student_id = current_user.id
    if course_id <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid course ID. Course ID must be a positive integer."
        )

    course_res = await db.execute(select(Course).where(Course.id == course_id))
    course = course_res.scalars().first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found."
        )

    try:
        res = await db.execute(
            select(Enrollment).where(
                Enrollment.user_id == student_id,
                Enrollment.course_id == course_id
            )
        )
        enrollment = res.scalars().first()
        if enrollment:
            await db.delete(enrollment)
            # Clean up student's topic completion logs for this course so future enrollment starts fresh
            await db.execute(
                delete(StudentActivityLog).where(
                    StudentActivityLog.user_id == student_id,
                    StudentActivityLog.course_id == course_id,
                    func.upper(StudentActivityLog.action_type) == "TOPIC_COMPLETE"
                )
            )
            await db.commit()
            invalidate_course_hierarchy_cache(course_id)
            return {"status": "success", "message": "Successfully unenrolled from course."}
        return {"status": "not_enrolled", "message": "You are not enrolled in this course."}
    except HTTPException:
        raise
    except Exception as exc:
        await db.rollback()
        logger.error(
            f"Database error during unenrollment of user {student_id} from course {course_id}: {exc}",
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="A database error occurred while processing unenrollment. Please try again."
        )


@router.delete("/{course_id}", status_code=status.HTTP_200_OK)
async def delete_course_permanently(
    course_id: int,
    current_user: User = Depends(require_roles("EDUCATOR", "ADMIN")),
    db: AsyncSession = Depends(get_db)
):
    """
    Permanently delete a course, its syllabus modules, topics, enrollments,
    assessments, Chroma vectors, and associated resources.
    Requires user to be the course creator (educator) or ADMIN.
    """
    course = await _check_course_ownership(course_id, current_user, db)

    # 0. Break circular foreign key on module_exam_id before deleting exams/modules
    await db.execute(
        update(Module).where(Module.course_id == course_id).values(module_exam_id=None)
    )

    # 1. Clean up community messages & channels
    ch_res = await db.execute(select(CommunityChannel).where(CommunityChannel.course_id == course_id))
    channels = ch_res.scalars().all()
    for ch in channels:
        await db.execute(delete(CommunityMessage).where(CommunityMessage.channel_id == ch.id))
        await db.delete(ch)

    # 2. Clean up learning pods, pod blacklists & pod messages
    pod_res = await db.execute(select(LearningPod).where(LearningPod.course_id == course_id))
    pods = pod_res.scalars().all()
    for pod in pods:
        await db.execute(delete(PodBlacklist).where(PodBlacklist.pod_id == pod.id))
        await db.execute(delete(PodMessage).where(PodMessage.pod_id == pod.id))
        await db.delete(pod)

    # 3. Clean up quizzes, quiz attempts & questions
    q_res = await db.execute(select(Quiz).where(Quiz.course_id == course_id))
    quizzes = q_res.scalars().all()
    for q in quizzes:
        await db.execute(delete(StudentQuizAttempt).where(StudentQuizAttempt.quiz_id == q.id))
        await db.execute(delete(QuizQuestion).where(QuizQuestion.quiz_id == q.id))
        await db.delete(q)

    # 4. Clean up exams, exam submissions & questions
    e_res = await db.execute(select(Exam).where(Exam.course_id == course_id))
    exams = e_res.scalars().all()
    for ex in exams:
        await db.execute(delete(ExamSubmission).where(ExamSubmission.exam_id == ex.id))
        await db.execute(delete(ExamQuestion).where(ExamQuestion.exam_id == ex.id))
        await db.delete(ex)

    # 5. Clean up assignments, submissions, topics, resources & topic ratings per module
    m_res = await db.execute(select(Module).where(Module.course_id == course_id))
    modules = m_res.scalars().all()
    for m in modules:
        a_res = await db.execute(select(Assignment).where(Assignment.module_id == m.id))
        assignments = a_res.scalars().all()
        for a in assignments:
            await db.execute(delete(AssignmentSubmission).where(AssignmentSubmission.assignment_id == a.id))
            await db.delete(a)

        t_res = await db.execute(select(Topic).where(Topic.module_id == m.id))
        topics = t_res.scalars().all()
        for t in topics:
            await db.execute(delete(TopicRating).where(TopicRating.topic_id == t.id))
            await db.delete(t)

        r_res = await db.execute(select(ModuleResource).where(ModuleResource.module_id == m.id))
        for r in r_res.scalars().all():
            file_name = os.path.basename(r.file_url or "")
            if file_name:
                other_ref = await db.execute(
                    select(func.count(ModuleResource.id)).where(
                        ModuleResource.file_url == r.file_url,
                        ModuleResource.id != r.id
                    )
                )
                if int(other_ref.scalar() or 0) == 0:
                    disk_path = os.path.join(settings.UPLOAD_DIR, file_name)
                    if os.path.exists(disk_path):
                        try:
                            os.remove(disk_path)
                        except OSError:
                            pass
            await db.delete(r)
        await db.delete(m)

    # 6. Clean up enrollments, documents, retentions, badges, ratings, activity logs, mastery, audit reports
    await db.execute(delete(Enrollment).where(Enrollment.course_id == course_id))
    await db.execute(delete(Document).where(Document.course_id == course_id))
    await db.execute(delete(StudentConceptRetention).where(StudentConceptRetention.course_id == course_id))
    await db.execute(delete(StudentBadge).where(StudentBadge.course_id == course_id))
    await db.execute(delete(CourseRating).where(CourseRating.course_id == course_id))
    await db.execute(delete(StudentActivityLog).where(StudentActivityLog.course_id == course_id))
    await db.execute(delete(StudentSkillMastery).where(StudentSkillMastery.course_id == course_id))
    await db.execute(delete(CurriculumAuditReport).where(CurriculumAuditReport.course_id == course_id))

    # 7. Delete course itself
    await db.delete(course)
    await db.commit()
    invalidate_course_hierarchy_cache(course_id)

    # 8. Clean up Chroma vector store
    try:
        chroma_service.delete_collection(course_id)
    except Exception as e:
        logger.warning("Chroma collection cleanup error: %s", e)

    return {
        "status": "success",
        "message": f"Course '{course.title}' (ID: {course_id}) has been permanently deleted along with all syllabus modules, student enrollments, and vector indexes."
    }


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
    course = await _check_course_ownership(course_id, current_user, db)

    title_clean = (req.title or "").strip()
    if not title_clean:
        raise HTTPException(status_code=400, detail="Module title cannot be empty.")

    count_res = await db.execute(select(Module).where(Module.course_id == course_id))
    existing_count = len(count_res.scalars().all())

    module = Module(
        course_id=course_id,
        title=title_clean,
        description=(req.description or "").strip() or None,
        order_index=existing_count + 1,
        has_module_exam=bool(req.has_module_exam) if req.has_module_exam is not None else False
    )
    db.add(module)
    course.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(module)
    invalidate_course_hierarchy_cache(course_id)

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

    course = await _check_course_ownership(module.course_id, current_user, db)

    if req.title is not None:
        title_clean = req.title.strip()
        if not title_clean:
            raise HTTPException(status_code=400, detail="Module title cannot be empty.")
        module.title = title_clean
    if req.description is not None:
        module.description = req.description.strip() or None
    if req.order_index is not None:
        module.order_index = req.order_index
    if req.has_module_exam is not None:
        module.has_module_exam = req.has_module_exam
    if req.module_exam_id is not None:
        module.module_exam_id = req.module_exam_id

    course.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(module)
    invalidate_course_hierarchy_cache(module.course_id)

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


@router.put("/{course_id}/modules/reorder")
async def reorder_modules(
    course_id: int,
    req: ModuleReorderRequest,
    current_user: User = Depends(require_roles("EDUCATOR", "ADMIN")),
    db: AsyncSession = Depends(get_db)
):
    """Reorder modules within a course."""
    course = await _check_course_ownership(course_id, current_user, db)
    m_res = await db.execute(select(Module).where(Module.course_id == course_id))
    modules_by_id = {m.id: m for m in m_res.scalars().all()}

    if len(req.module_ids) != len(set(req.module_ids)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Duplicate module IDs in reorder request."
        )
    if set(req.module_ids) != set(modules_by_id.keys()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid module IDs: all modules of the course must be provided without duplicates or external IDs."
        )

    for idx, mod_id in enumerate(req.module_ids, start=1):
        modules_by_id[mod_id].order_index = idx

    course.updated_at = datetime.now(timezone.utc)
    await db.commit()
    invalidate_course_hierarchy_cache(course_id)
    return {"status": "success", "message": "Modules reordered successfully"}


@router.delete("/modules/{module_id}")
async def delete_module(
    module_id: int,
    current_user: User = Depends(require_roles("EDUCATOR", "ADMIN")),
    db: AsyncSession = Depends(get_db)
):
    """Delete a module and all nested topics, assignments, exams, and resources."""
    res = await db.execute(select(Module).where(Module.id == module_id))
    module = res.scalars().first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    course = await _check_course_ownership(module.course_id, current_user, db)
    course_id_to_invalidate = module.course_id

    # Break module_exam_id link and clean up module exams
    module.module_exam_id = None
    await db.flush()

    e_res = await db.execute(select(Exam).where(Exam.module_id == module.id))
    for ex in e_res.scalars().all():
        await db.execute(delete(ExamSubmission).where(ExamSubmission.exam_id == ex.id))
        await db.execute(delete(ExamQuestion).where(ExamQuestion.exam_id == ex.id))
        await db.delete(ex)

    a_res = await db.execute(select(Assignment).where(Assignment.module_id == module.id))
    for a in a_res.scalars().all():
        await db.execute(delete(AssignmentSubmission).where(AssignmentSubmission.assignment_id == a.id))
        await db.delete(a)

    t_res = await db.execute(select(Topic).where(Topic.module_id == module.id))
    for t in t_res.scalars().all():
        await db.execute(delete(TopicRating).where(TopicRating.topic_id == t.id))
        await db.execute(
            delete(StudentActivityLog).where(
                StudentActivityLog.course_id == course_id_to_invalidate,
                StudentActivityLog.action_type == "TOPIC_COMPLETE",
                StudentActivityLog.query_text == str(t.id)
            )
        )
        await db.delete(t)

    r_res = await db.execute(select(ModuleResource).where(ModuleResource.module_id == module.id))
    for r in r_res.scalars().all():
        file_name = os.path.basename(r.file_url or "")
        if file_name:
            other_ref = await db.execute(
                select(func.count(ModuleResource.id)).where(
                    ModuleResource.file_url == r.file_url,
                    ModuleResource.id != r.id
                )
            )
            if int(other_ref.scalar() or 0) == 0:
                disk_path = os.path.join(settings.UPLOAD_DIR, file_name)
                if os.path.exists(disk_path):
                    try:
                        os.remove(disk_path)
                    except OSError:
                        pass
        await db.delete(r)

    await db.delete(module)
    await db.flush()

    # Re-index remaining modules and ensure course without valid curriculum reverts to draft
    rem_mods_res = await db.execute(
        select(Module).where(Module.course_id == course_id_to_invalidate).order_by(Module.order_index.asc(), Module.id.asc())
    )
    rem_mods = rem_mods_res.scalars().all()
    for idx, m in enumerate(rem_mods, start=1):
        m.order_index = idx

    rem_mod_ids = [m.id for m in rem_mods]
    rem_topics_count = 0
    if rem_mod_ids:
        t_cnt = await db.execute(select(func.count(Topic.id)).where(Topic.module_id.in_(rem_mod_ids)))
        rem_topics_count = int(t_cnt.scalar() or 0)

    if not rem_mods or rem_topics_count == 0:
        course.is_published = False

    course.updated_at = datetime.now(timezone.utc)
    await db.commit()
    invalidate_course_hierarchy_cache(course_id_to_invalidate)
    return {"status": "success", "message": "Module deleted successfully", "is_published": course.is_published}


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
    module = mod_res.scalars().first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    course = await _check_course_ownership(module.course_id, current_user, db)

    title_clean = (req.title or "").strip()
    if not title_clean:
        raise HTTPException(status_code=400, detail="Topic title cannot be empty.")

    video_id = extract_youtube_video_id(req.youtube_url)
    if not video_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid YouTube URL. Please provide a valid YouTube watch, embed, shorts, or youtu.be link."
        )

    count_res = await db.execute(select(Topic).where(Topic.module_id == module_id))
    existing_count = len(count_res.scalars().all())

    topic = Topic(
        module_id=module_id,
        title=title_clean,
        description=(req.description or "").strip() or None,
        youtube_url=req.youtube_url.strip(),
        youtube_video_id=video_id,
        order_index=existing_count + 1
    )
    db.add(topic)
    course.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(topic)
    invalidate_course_hierarchy_cache(module.course_id)

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

    mod_res = await db.execute(select(Module).where(Module.id == topic.module_id))
    module = mod_res.scalars().first()
    course = None
    if module:
        course = await _check_course_ownership(module.course_id, current_user, db)

    if req.title is not None:
        title_clean = req.title.strip()
        if not title_clean:
            raise HTTPException(status_code=400, detail="Topic title cannot be empty.")
        topic.title = title_clean
    if req.description is not None:
        topic.description = req.description.strip() or None
    if req.order_index is not None:
        topic.order_index = req.order_index
    if req.youtube_url is not None:
        video_id = extract_youtube_video_id(req.youtube_url)
        if not video_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid YouTube URL. Please provide a valid YouTube watch, embed, shorts, or youtu.be link."
            )
        topic.youtube_url = req.youtube_url.strip()
        topic.youtube_video_id = video_id

    if course:
        course.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(topic)
    if module:
        invalidate_course_hierarchy_cache(module.course_id)
    return TopicResponse.model_validate(topic)


@router.put("/modules/{module_id}/topics/reorder")
async def reorder_topics(
    module_id: int,
    req: TopicReorderRequest,
    current_user: User = Depends(require_roles("EDUCATOR", "ADMIN")),
    db: AsyncSession = Depends(get_db)
):
    """Reorder topics within a module."""
    mod_res = await db.execute(select(Module).where(Module.id == module_id))
    module = mod_res.scalars().first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    course = await _check_course_ownership(module.course_id, current_user, db)

    t_res = await db.execute(select(Topic).where(Topic.module_id == module_id))
    topics_by_id = {t.id: t for t in t_res.scalars().all()}

    if len(req.topic_ids) != len(set(req.topic_ids)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Duplicate topic IDs in reorder request."
        )
    if set(req.topic_ids) != set(topics_by_id.keys()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid topic IDs: all topics of the module must be provided without duplicates or external IDs."
        )

    for idx, top_id in enumerate(req.topic_ids, start=1):
        topics_by_id[top_id].order_index = idx

    course.updated_at = datetime.now(timezone.utc)
    await db.commit()
    invalidate_course_hierarchy_cache(module.course_id)
    return {"status": "success", "message": "Topics reordered successfully"}


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

    mod_res = await db.execute(select(Module).where(Module.id == topic.module_id))
    module = mod_res.scalars().first()
    course = None
    if module:
        course = await _check_course_ownership(module.course_id, current_user, db)
    target_course_id = module.course_id if module else None

    await db.execute(delete(TopicRating).where(TopicRating.topic_id == topic.id))
    if target_course_id:
        await db.execute(
            delete(StudentActivityLog).where(
                StudentActivityLog.course_id == target_course_id,
                StudentActivityLog.action_type == "TOPIC_COMPLETE",
                StudentActivityLog.query_text == str(topic.id)
            )
        )
    await db.delete(topic)
    await db.flush()

    if module:
        rem_t_res = await db.execute(
            select(Topic).where(Topic.module_id == module.id).order_by(Topic.order_index.asc(), Topic.id.asc())
        )
        for idx, t in enumerate(rem_t_res.scalars().all(), start=1):
            t.order_index = idx

    if course and target_course_id:
        m_ids_res = await db.execute(select(Module.id).where(Module.course_id == target_course_id))
        m_ids = [r[0] for r in m_ids_res.all()]
        rem_topics_count = 0
        if m_ids:
            t_cnt = await db.execute(select(func.count(Topic.id)).where(Topic.module_id.in_(m_ids)))
            rem_topics_count = int(t_cnt.scalar() or 0)
        if rem_topics_count == 0:
            course.is_published = False
        course.updated_at = datetime.now(timezone.utc)

    await db.commit()
    if target_course_id:
        invalidate_course_hierarchy_cache(target_course_id)
    return {
        "status": "success",
        "message": "Topic deleted successfully",
        "is_published": course.is_published if course else True
    }


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

    course = await _check_course_ownership(module.course_id, current_user, db)

    raw_filename = os.path.basename(file.filename or "notes.pdf")
    ext = os.path.splitext(raw_filename)[1].lower().replace(".", "")
    if ext != "pdf":
        raise HTTPException(status_code=400, detail="Only PDF notes can be attached as module resources.")

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    safe_base = re.sub(r"[^a-zA-Z0-9._-]", "_", raw_filename)
    if not safe_base.lower().endswith(".pdf"):
        safe_base = f"{safe_base}.pdf"

    # Generate collision-resistant unique filename
    saved_name = f"mod_{module_id}_{int(datetime.now(timezone.utc).timestamp())}_{uuid.uuid4().hex[:12]}_{safe_base}"
    file_path = os.path.join(settings.UPLOAD_DIR, saved_name)
    while os.path.exists(file_path):
        saved_name = f"mod_{module_id}_{int(datetime.now(timezone.utc).timestamp())}_{uuid.uuid4().hex[:12]}_{safe_base}"
        file_path = os.path.join(settings.UPLOAD_DIR, saved_name)

    max_bytes = 20 * 1024 * 1024
    written_bytes = 0
    first_bytes = b""
    try:
        with open(file_path, "wb") as buffer:
            while chunk := await file.read(1024 * 1024):
                if len(first_bytes) < 5:
                    first_bytes += chunk[: 5 - len(first_bytes)]
                written_bytes += len(chunk)
                if written_bytes > max_bytes:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="File size exceeds maximum limit of 20 MB"
                    )
                buffer.write(chunk)
        if written_bytes == 0 or not first_bytes.startswith(b"%PDF"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or empty PDF file."
            )
    except Exception:
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except OSError:
                pass
        raise

    # Ingest document into vector store under the course ID.
    # If AI/vector ingestion fails (e.g. scanned/image-only PDF or embedding error),
    # record chunk_count = 0 rather than falsely claiming chunks were indexed.
    chunk_count = 0
    try:
        chunk_count = await ingestion_service.ingest_file(
            file_path=file_path,
            course_id=module.course_id,
            doc_id=module_id,
            doc_title=(title or "").strip() or raw_filename,
            topic=module.title,
            module_id=module_id
        )
    except Exception as exc:
        logger.warning(
            "Vector ingestion failed for module resource '%s' (module %d): %s",
            saved_name,
            module_id,
            exc
        )
        chunk_count = 0

    resource = ModuleResource(
        module_id=module_id,
        title=(title or "").strip() or raw_filename,
        file_url=f"/uploads/{saved_name}",
        file_type="pdf",
        is_view_only=True,
        chunk_count=chunk_count
    )
    try:
        db.add(resource)
        course.updated_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(resource)
    except Exception:
        await db.rollback()
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except OSError:
                pass
        raise

    invalidate_course_hierarchy_cache(module.course_id)
    return ModuleResourceResponse.model_validate(resource)


@router.delete("/resources/{resource_id}")
async def delete_module_resource(
    resource_id: int,
    current_user: User = Depends(require_roles("EDUCATOR", "ADMIN")),
    db: AsyncSession = Depends(get_db)
):
    """Delete an uploaded PDF resource from a module."""
    res = await db.execute(select(ModuleResource).where(ModuleResource.id == resource_id))
    resource = res.scalars().first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")

    mod_res = await db.execute(select(Module).where(Module.id == resource.module_id))
    module = mod_res.scalars().first()
    course = None
    if module:
        course = await _check_course_ownership(module.course_id, current_user, db)

    file_url_to_check = resource.file_url or ""
    file_name = os.path.basename(file_url_to_check)

    # Check if any other ModuleResource record still references the same file_url
    other_refs_count = 0
    if file_url_to_check:
        other_res = await db.execute(
            select(func.count(ModuleResource.id)).where(
                ModuleResource.file_url == file_url_to_check,
                ModuleResource.id != resource.id
            )
        )
        other_refs_count = int(other_res.scalar() or 0)

    await db.delete(resource)
    if course:
        course.updated_at = datetime.now(timezone.utc)
    await db.commit()

    if file_name and other_refs_count == 0:
        disk_path = os.path.join(settings.UPLOAD_DIR, file_name)
        if os.path.exists(disk_path):
            try:
                os.remove(disk_path)
            except OSError:
                pass

    if module:
        invalidate_course_hierarchy_cache(module.course_id)

    return {"status": "success", "message": "Module PDF notes removed successfully"}


@router.get("/resources/{resource_id}/view")
async def view_module_resource(
    resource_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Secure endpoint streaming PDF bytes for in-browser rendering."""
    res = await db.execute(select(ModuleResource).where(ModuleResource.id == resource_id))
    resource = res.scalars().first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")

    mod_res = await db.execute(select(Module).where(Module.id == resource.module_id))
    module = mod_res.scalars().first()
    if not module:
        raise HTTPException(status_code=404, detail="Parent module not found")

    course_res = await db.execute(select(Course).where(Course.id == module.course_id))
    course = course_res.scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Parent course not found")

    is_owner_or_admin = await _is_user_course_owner(course, current_user, db)
    if not is_owner_or_admin:
        if not bool(getattr(course, "is_published", True)):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This course is currently in draft mode")
        enr_res = await db.execute(
            select(Enrollment).where(
                Enrollment.user_id == current_user.id,
                Enrollment.course_id == course.id
            )
        )
        if not enr_res.scalars().first():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enrolled in this course")

    file_name = os.path.basename(resource.file_url or "")
    if not file_name:
        raise HTTPException(status_code=404, detail="Invalid resource file path")

    disk_path = os.path.join(settings.UPLOAD_DIR, file_name)
    if not os.path.isfile(disk_path):
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
        "student_email": f"{student.email[:3]}***@{student.email.split('@')[1]}" if student and '@' in student.email else "",
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
    current_user: User = Depends(require_roles("EDUCATOR", "ADMIN")),
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

    await _check_course_ownership(module.course_id, current_user, db)

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

    await _check_course_ownership(module.course_id, current_user, db)

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
    invalidate_course_hierarchy_cache(module.course_id)

    # Fetch and return full exam details including educator answer keys
    from app.api.v1.exams import get_exam_details
    return await get_exam_details(exam.id, db, is_educator=True)


# ==============================================================================
# TOPIC COMPLETION & PROGRESS TRACKING ENDPOINTS
# ==============================================================================

@router.post("/topics/{topic_id}/complete", response_model=TopicCompleteResponse)
@module_router.post("/topics/{topic_id}/complete", response_model=TopicCompleteResponse)
async def complete_topic(
    topic_id: int,
    req: TopicCompleteRequest = TopicCompleteRequest(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Marks a topic as completed (or uncompleted) for the current student, updates course completion %."""
    top_res = await db.execute(select(Topic).where(Topic.id == topic_id))
    topic = top_res.scalars().first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    mod_res = await db.execute(select(Module).where(Module.id == topic.module_id))
    module = mod_res.scalars().first()
    if not module:
        raise HTTPException(status_code=404, detail="Parent module not found")

    course_id = module.course_id
    course_res = await db.execute(select(Course).where(Course.id == course_id))
    course = course_res.scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Parent course not found")

    is_owner_or_admin = await _is_user_course_owner(course, current_user, db)
    if not is_owner_or_admin and not bool(getattr(course, "is_published", True)):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This course is currently in draft mode")

    enr_res = await db.execute(
        select(Enrollment).where(
            Enrollment.user_id == current_user.id,
            Enrollment.course_id == course_id
        )
    )
    enrollment = enr_res.scalars().first()
    if not enrollment and not is_owner_or_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Must be enrolled in this course to update topic progress"
        )

    # Query existing activity logs for this topic
    log_res = await db.execute(
        select(StudentActivityLog).where(
            StudentActivityLog.user_id == current_user.id,
            StudentActivityLog.course_id == course_id,
            StudentActivityLog.action_type == "TOPIC_COMPLETE"
        )
    )
    existing_logs = log_res.scalars().all()

    matching_logs = []
    for l in existing_logs:
        matched = False
        if l.query_text == str(topic_id):
            matched = True
        elif l.metadata_info:
            try:
                meta = json.loads(l.metadata_info)
                if int(meta.get("topic_id")) == int(topic_id):
                    matched = True
            except Exception:
                pass
        if matched:
            matching_logs.append(l)

    if not req.is_completed:
        for l in matching_logs:
            await db.delete(l)
        if matching_logs:
            await db.flush()
    else:
        if not matching_logs:
            new_log = StudentActivityLog(
                user_id=current_user.id,
                course_id=course_id,
                action_type="TOPIC_COMPLETE",
                activity_type="PROGRESS",
                query_text=str(topic_id),
                metadata_info=json.dumps({"topic_id": topic_id, "title": topic.title})
            )
            db.add(new_log)
            await db.flush()
        elif len(matching_logs) > 1:
            for extra_log in matching_logs[1:]:
                await db.delete(extra_log)
            await db.flush()

    # Calculate overall completion percentage for the course
    course_mods_res = await db.execute(select(Module.id).where(Module.course_id == course_id))
    course_mod_ids = course_mods_res.scalars().all()

    if course_mod_ids:
        course_topics_res = await db.execute(select(Topic.id).where(Topic.module_id.in_(course_mod_ids)))
        course_topic_ids = set(course_topics_res.scalars().all())
    else:
        course_topic_ids = set()
    total_topics_count = len(course_topic_ids)

    # Re-fetch active completed topic logs
    active_logs_res = await db.execute(
        select(StudentActivityLog).where(
            StudentActivityLog.user_id == current_user.id,
            StudentActivityLog.course_id == course_id,
            StudentActivityLog.action_type == "TOPIC_COMPLETE"
        )
    )
    active_logs = active_logs_res.scalars().all()

    completed_topic_ids = []
    for l in active_logs:
        try:
            tid = int(l.query_text) if l.query_text and l.query_text.isdigit() else None
            if not tid and l.metadata_info:
                meta = json.loads(l.metadata_info)
                tid = int(meta.get("topic_id")) if meta.get("topic_id") is not None else None
            if tid and tid in course_topic_ids and tid not in completed_topic_ids:
                completed_topic_ids.append(tid)
        except Exception:
            pass

    completion_pct = (
        min(100.0, round((len(completed_topic_ids) / total_topics_count) * 100.0, 1))
        if total_topics_count > 0
        else 0.0
    )
    if enrollment:
        enrollment.completion_percentage = completion_pct
    await db.commit()

    return TopicCompleteResponse(
        status="success",
        topic_id=topic_id,
        is_completed=req.is_completed,
        completion_percentage=completion_pct,
        completed_topic_ids=completed_topic_ids
    )


@router.get("/{course_id}/completed-topics")
async def get_completed_topics(
    course_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Returns all completed topic IDs for the current user and their completion %."""
    course_res = await db.execute(select(Course).where(Course.id == course_id))
    course = course_res.scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    is_owner_or_admin = await _is_user_course_owner(course, current_user, db)
    if not is_owner_or_admin and not bool(getattr(course, "is_published", True)):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This course is currently in draft mode")

    enr_res = await db.execute(
        select(Enrollment).where(
            Enrollment.user_id == current_user.id,
            Enrollment.course_id == course_id
        )
    )
    enrollment = enr_res.scalars().first()
    if not enrollment and not is_owner_or_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Must be enrolled in this course to view topic progress"
        )

    course_mods_res = await db.execute(select(Module.id).where(Module.course_id == course_id))
    course_mod_ids = course_mods_res.scalars().all()

    if course_mod_ids:
        course_topics_res = await db.execute(select(Topic.id).where(Topic.module_id.in_(course_mod_ids)))
        course_topic_ids = set(course_topics_res.scalars().all())
    else:
        course_topic_ids = set()

    logs_res = await db.execute(
        select(StudentActivityLog).where(
            StudentActivityLog.user_id == current_user.id,
            StudentActivityLog.course_id == course_id,
            StudentActivityLog.action_type == "TOPIC_COMPLETE"
        )
    )
    logs = logs_res.scalars().all()

    completed_topic_ids = []
    for l in logs:
        try:
            tid = int(l.query_text) if l.query_text and l.query_text.isdigit() else None
            if not tid and l.metadata_info:
                meta = json.loads(l.metadata_info)
                tid = int(meta.get("topic_id")) if meta.get("topic_id") is not None else None
            if tid and tid in course_topic_ids and tid not in completed_topic_ids:
                completed_topic_ids.append(tid)
        except Exception:
            pass

    total_topics_count = len(course_topic_ids)
    completion_pct = (
        min(100.0, round((len(completed_topic_ids) / total_topics_count) * 100.0, 1))
        if total_topics_count > 0
        else 0.0
    )

    if enrollment and enrollment.completion_percentage != completion_pct:
        enrollment.completion_percentage = completion_pct
        await db.commit()

    return {
        "course_id": course_id,
        "completed_topic_ids": completed_topic_ids,
        "completion_percentage": completion_pct
    }


