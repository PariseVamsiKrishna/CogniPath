import os
import uuid
import logging
from typing import List, Dict, Any, Tuple, Optional
from pypdf import PdfReader
import docx

from app.services.chroma_service import chroma_service

logger = logging.getLogger("cognipath.ingestion")

class RecursiveCharacterTextSplitter:
    """Recursive Character Text Splitter with customizable chunk size and overlap."""
    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 150, separators: List[str] = None):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.separators = separators or ["\n\n", "\n", ". ", " ", ""]

    def split_text(self, text: str) -> List[str]:
        if len(text) <= self.chunk_size:
            return [text.strip()] if text.strip() else []

        chunks = []
        start = 0
        text_len = len(text)

        while start < text_len:
            end = start + self.chunk_size
            if end >= text_len:
                chunk = text[start:].strip()
                if chunk:
                    chunks.append(chunk)
                break

            # Find best split separator
            split_pos = -1
            chunk_slice = text[start:end]

            for sep in self.separators:
                pos = chunk_slice.rfind(sep)
                if pos != -1 and pos > 0:
                    split_pos = start + pos + len(sep)
                    break

            if split_pos == -1 or split_pos <= start:
                split_pos = end

            chunk = text[start:split_pos].strip()
            if chunk:
                chunks.append(chunk)

            # Move start pointer accounting for overlap
            start = max(split_pos - self.chunk_overlap, start + 1)

        return chunks

class DocumentIngestionService:
    def __init__(self):
        self.splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=150)

    def extract_text(self, file_path: str, file_type: str) -> List[Tuple[str, int]]:
        """Extracts text and page numbers from file. Returns list of (page_text, page_number)."""
        ext = file_type.lower().replace(".", "")
        pages_content: List[Tuple[str, int]] = []

        if ext == "pdf":
            try:
                reader = PdfReader(file_path)
                for idx, page in enumerate(reader.pages):
                    txt = page.extract_text() or ""
                    if txt.strip():
                        pages_content.append((txt.strip(), idx + 1))
            except Exception as e:
                logger.error("Failed to parse PDF %s: %s", file_path, e)
                raise ValueError(f"Invalid or corrupted PDF file: {e}")

        elif ext in ["docx", "doc"]:
            try:
                doc = docx.Document(file_path)
                full_text = "\n".join([p.text for p in doc.paragraphs if p.text.strip()])
                pages_content.append((full_text, 1))
            except Exception as e:
                logger.error("Failed to parse DOCX %s: %s", file_path, e)
                raise ValueError(f"Invalid or corrupted DOCX file: {e}")

        elif ext in ["txt", "md", "csv"]:
            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                    pages_content.append((content, 1))
            except Exception as e:
                logger.error("Failed to read text file %s: %s", file_path, e)
                raise ValueError(f"Failed to read text file: {e}")
        else:
            raise ValueError(f"Unsupported file format: {ext}")

        return pages_content

    async def process_and_index_document(
        self,
        course_id: int,
        document_id: int,
        doc_title: str,
        file_path: str,
        file_type: str,
        topic: str = "General",
        educator_id: int = 1,
        module_id: Optional[int] = None
    ) -> int:
        """Parses, chunks, embeds, and indexes document into ChromaDB."""
        pages = self.extract_text(file_path, file_type)
        all_chunks: List[str] = []
        all_metadatas: List[Dict[str, Any]] = []
        all_ids: List[str] = []

        chunk_counter = 0
        for page_text, page_num in pages:
            chunks = self.splitter.split_text(page_text)
            for ch in chunks:
                chunk_counter += 1
                chunk_id = f"doc_{document_id}_p{page_num}_c{chunk_counter}_{uuid.uuid4().hex[:6]}"
                all_chunks.append(ch)
                all_ids.append(chunk_id)
                meta = {
                    "course_id": course_id,
                    "document_id": document_id,
                    "doc_title": doc_title,
                    "page": page_num,
                    "chunk_index": chunk_counter,
                    "topic": topic,
                    "educator_id": educator_id
                }
                if module_id is not None:
                    meta["module_id"] = module_id
                all_metadatas.append(meta)

        if all_chunks:
            await chroma_service.add_chunks(
                course_id=course_id,
                chunks=all_chunks,
                metadatas=all_metadatas,
                ids=all_ids
            )

        logger.info("Indexed %d chunks for document '%s' (ID: %d, Module: %s)", len(all_chunks), doc_title, document_id, module_id)
        return len(all_chunks)

    async def ingest_file(
        self,
        file_path: str,
        course_id: int,
        doc_id: int,
        doc_title: str,
        topic: str = "General",
        module_id: Optional[int] = None
    ) -> int:
        """Direct file ingestion helper supporting course and module resources."""
        ext = os.path.splitext(file_path)[1].lower().replace(".", "") or "pdf"
        return await self.process_and_index_document(
            course_id=course_id,
            document_id=doc_id,
            doc_title=doc_title,
            file_path=file_path,
            file_type=ext,
            topic=topic,
            module_id=module_id
        )

ingestion_service = DocumentIngestionService()
