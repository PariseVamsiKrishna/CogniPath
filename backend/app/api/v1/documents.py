import asyncio
import logging
import os
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.models import Course, Document, Enrollment, User
from app.schemas.schemas import DocumentResponse
from app.services.ingestion_service import ingestion_service

logger = logging.getLogger("cognipath.documents_api")

router = APIRouter(prefix="/documents", tags=["Document Ingestion"])

async def _check_course_access(course_id: int, user: User, db: AsyncSession, write: bool = False) -> Course:
    course_res = await db.execute(select(Course).where(Course.id == course_id))
    course = course_res.scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Course does not exist.")

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


@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    course_id: int = Form(...),
    topic: str = Form("General Syllabus"),
    file: UploadFile = File(...),
    current_user: User = Depends(require_roles("EDUCATOR", "ADMIN")),
    db: AsyncSession = Depends(get_db)
):
    """Educator uploads curriculum material (.pdf, .docx, .txt). Automatically parsed, chunked, and embedded."""
    # Verify course ownership
    await _check_course_access(course_id, current_user, db, write=True)

    # Verify ownership: only the course's own educator (or admin) can upload
    if current_user.role != "ADMIN" and course.educator_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You can only upload documents to courses you created."
        )

    # Validate file extension
    raw_filename = file.filename or "document.pdf"
    safe_basename = os.path.basename(raw_filename).replace(" ", "_")
    ext = os.path.splitext(safe_basename)[1].lower().replace(".", "")
    if ext not in ["pdf", "docx", "doc", "txt", "md"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{ext}'. Only .pdf, .docx, and .txt files are accepted."
        )

    # Save to uploads directory with sanitised filename + UUID prefix
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    unique_filename = f"c{course_id}_{uuid.uuid4().hex[:8]}_{safe_basename}"
    file_path = os.path.join(settings.UPLOAD_DIR, unique_filename)

    # Cap size at 20 MB with chunked streaming and cleanup on failure
    max_bytes = 20 * 1024 * 1024
    written_bytes = 0
    try:
        with open(file_path, "wb") as buffer:
            while chunk := await file.read(1024 * 1024):  # 1MB chunks
                written_bytes += len(chunk)
                if written_bytes > max_bytes:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="File size exceeds maximum limit of 20 MB"
                    )
                buffer.write(chunk)
    except Exception:
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception:
                pass
        raise

    # Create DB record
    doc_record = Document(
        course_id=course_id,
        title=safe_basename,
        file_path=file_path,
        file_type=ext,
        topic=topic,
        uploaded_by=current_user.id
    )
    db.add(doc_record)
    await db.commit()
    await db.refresh(doc_record)

    # Trigger Ingestion Pipeline (Chunking -> Embedding -> ChromaDB) through asyncio.to_thread
    try:
        chunk_count = await asyncio.to_thread(ingestion_service.process_and_index_document, course_id=course_id, document_id=doc_record.id, file_path=file_path)
        doc_record.chunk_count = chunk_count
        await db.commit()
        await db.refresh(doc_record)
    except Exception as e:
        logger.exception(e)
        raise HTTPException(status_code=500, detail="Document parsing/indexing failed.")

    return doc_record

@router.get("/course/{course_id}", response_model=list[DocumentResponse])
async def list_course_documents(
    course_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all ingested documents for a specific course with enrollment check."""
    await _check_course_access(course_id, current_user, db, write=False)
    result = await db.execute(select(Document).where(Document.course_id == course_id))
    return result.scalars().all()
