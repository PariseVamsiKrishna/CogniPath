import os
import shutil
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.models import Document, Course, User
from app.schemas.schemas import DocumentResponse
from app.services.ingestion_service import ingestion_service

router = APIRouter(prefix="/documents", tags=["Document Ingestion"])

@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    course_id: int = Form(...),
    topic: str = Form("General Syllabus"),
    file: UploadFile = File(...),
    current_user: User = Depends(require_roles("EDUCATOR", "ADMIN")),
    db: AsyncSession = Depends(get_db)
):
    """Educator uploads curriculum material (.pdf, .docx, .txt). Automatically parsed, chunked, and embedded."""
    # Verify course exists
    course_res = await db.execute(select(Course).where(Course.id == course_id))
    course = course_res.scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Course does not exist.")

    # Validate file extension
    filename = file.filename
    ext = os.path.splitext(filename)[1].lower().replace(".", "")
    if ext not in ["pdf", "docx", "doc", "txt", "md"]:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{ext}'. Only .pdf, .docx, and .txt files are accepted."
        )

    # Save to uploads directory
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    file_path = os.path.join(settings.UPLOAD_DIR, f"c{course_id}_{filename}")
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Create DB record
    doc_record = Document(
        course_id=course_id,
        title=filename,
        file_path=file_path,
        file_type=ext,
        topic=topic,
        uploaded_by=current_user.id
    )
    db.add(doc_record)
    await db.commit()
    await db.refresh(doc_record)

    # Trigger Ingestion Pipeline (Chunking -> Embedding -> ChromaDB)
    try:
        chunk_count = await ingestion_service.process_and_index_document(
            course_id=course_id,
            document_id=doc_record.id,
            doc_title=doc_record.title,
            file_path=file_path,
            file_type=ext,
            topic=topic,
            educator_id=current_user.id
        )
        doc_record.chunk_count = chunk_count
        await db.commit()
        await db.refresh(doc_record)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Document parsing/indexing failed: {str(e)}")

    return doc_record

@router.get("/course/{course_id}", response_model=List[DocumentResponse])
async def list_course_documents(course_id: int, db: AsyncSession = Depends(get_db)):
    """List all ingested documents for a specific course."""
    result = await db.execute(select(Document).where(Document.course_id == course_id))
    return result.scalars().all()
