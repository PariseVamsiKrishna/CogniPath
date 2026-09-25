import os
import logging
import hashlib
from typing import List, Dict, Any, Optional

try:
    import chromadb
    from chromadb.config import Settings as ChromaSettings
    HAS_CHROMADB = True
except ImportError:
    HAS_CHROMADB = False
    chromadb = None

try:
    from google import genai
    HAS_GENAI = True
except ImportError:
    HAS_GENAI = False

from openai import AsyncOpenAI
from app.core.config import settings

logger = logging.getLogger("cognipath.chroma")

class InMemoryCollection:
    """Zero-dependency in-memory vector collection for environments without compiled Chroma binaries."""
    def __init__(self, name: str, metadata: dict = None):
        self.name = name
        self.metadata = metadata or {}
        self._docs = []
        self._embeddings = []
        self._metadatas = []
        self._ids = []

    def add(self, documents: list, embeddings: list, metadatas: list, ids: list):
        self._docs.extend(documents)
        self._embeddings.extend(embeddings)
        self._metadatas.extend(metadatas)
        self._ids.extend(ids)

    def count(self) -> int:
        return len(self._docs)

    def query(self, query_embeddings: list = None, n_results: int = 4, where: dict = None, include: list = None):
        if not self._docs:
            return {"documents": [[]], "metadatas": [[]], "distances": [[]]}
        
        q_emb = query_embeddings[0] if (query_embeddings and len(query_embeddings) > 0) else None
        scored = []
        for i, doc_emb in enumerate(self._embeddings):
            # Evaluate where filter if provided
            if where:
                match = True
                meta = self._metadatas[i] or {}
                for k, v in where.items():
                    if meta.get(k) != v:
                        match = False
                        break
                if not match:
                    continue

            # Compute cosine similarity if query embedding is available
            if q_emb and doc_emb:
                dot = sum(a * b for a, b in zip(q_emb, doc_emb))
                norm_a = sum(a * a for a in q_emb) ** 0.5 or 1.0
                norm_b = sum(b * b for b in doc_emb) ** 0.5 or 1.0
                cos_sim = dot / (norm_a * norm_b)
                cos_dist = max(0.0, 1.0 - cos_sim)
            else:
                cos_dist = 0.0
            scored.append((cos_dist, self._docs[i], self._metadatas[i]))

        scored.sort(key=lambda x: x[0])
        top_k = scored[:n_results]

        return {
            "documents": [[x[1] for x in top_k]],
            "metadatas": [[x[2] for x in top_k]],
            "distances": [[x[0] for x in top_k]]
        }

class ChromaService:
    def __init__(self):
        self._client = None
        self._in_memory_collections: Dict[str, InMemoryCollection] = {}
        self._openai_client = None
        self._init_client()

    def _init_client(self):
        """Initialize ChromaDB client or fallback to in-memory store."""
        if HAS_CHROMADB:
            try:
                self._client = chromadb.HttpClient(
                    host=settings.CHROMA_SERVER_HOST,
                    port=settings.CHROMA_SERVER_PORT,
                    settings=ChromaSettings(anonymized_telemetry=False)
                )
                self._client.heartbeat()
                logger.info("Connected to remote ChromaDB server at %s:%s", settings.CHROMA_SERVER_HOST, settings.CHROMA_SERVER_PORT)
            except Exception as e:
                logger.warning("Remote ChromaDB connection failed (%s). Initializing embedded PersistentClient at %s", e, settings.CHROMA_PERSIST_DIR)
                try:
                    os.makedirs(settings.CHROMA_PERSIST_DIR, exist_ok=True)
                    self._client = chromadb.PersistentClient(
                        path=settings.CHROMA_PERSIST_DIR,
                        settings=ChromaSettings(anonymized_telemetry=False)
                    )
                except Exception as ex:
                    logger.warning("Embedded ChromaDB failed (%s). Falling back to InMemoryCollection store.", ex)
                    self._client = None
        else:
            logger.info("ChromaDB library not installed; using built-in InMemoryCollection vector store.")
            self._client = None

        if settings.OPENAI_API_KEY:
            self._openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

        self._gemini_client = None
        if HAS_GENAI and settings.GEMINI_API_KEY:
            try:
                self._gemini_client = genai.Client(api_key=settings.GEMINI_API_KEY)
                logger.info("ChromaService: Google Gemini embedding client initialized.")
            except Exception as e:
                logger.warning(f"ChromaService: Gemini client initialization warning: {e}")

    def _get_collection_name(self, course_id: int) -> str:
        return f"course_collection_{course_id}"

    async def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings using Gemini or OpenAI, with deterministic fallback."""
        # 1. Prefer Google Gemini embedding
        if self._gemini_client and settings.GEMINI_API_KEY:
            try:
                embeddings = []
                for t in texts:
                    res = self._gemini_client.models.embed_content(
                        model=settings.GEMINI_EMBEDDING_MODEL,
                        contents=t
                    )
                    if hasattr(res, 'embeddings') and res.embeddings:
                        embeddings.append(res.embeddings[0].values)
                if len(embeddings) == len(texts):
                    return embeddings
            except Exception as e:
                logger.warning(f"Gemini embedding notice ({e}). Falling back to local semantic vector.")

        # 2. OpenAI Embedding fallback
        if self._openai_client and settings.OPENAI_API_KEY:
            try:
                response = await self._openai_client.embeddings.create(
                    input=texts,
                    model=settings.EMBEDDING_MODEL
                )
                return [data.embedding for data in response.data]
            except Exception as e:
                logger.error("OpenAI embedding generation failed: %s. Using local deterministic fallback.", e)

        # 3. High-dimension pseudo-semantic fallback vector (1536 dimensions) for testing without API keys
        return [self._generate_fallback_embedding(t) for t in texts]

    def _generate_fallback_embedding(self, text: str, dim: int = 1536) -> List[float]:
        """Generates reproducible unit-normalized vector for standalone testing."""
        h = hashlib.sha256(text.encode("utf-8")).digest()
        raw = [(h[i % len(h)] / 255.0) - 0.5 for i in range(dim)]
        # normalize
        norm = (sum(x * x for x in raw)) ** 0.5 or 1.0
        return [x / norm for x in raw]

    def get_or_create_collection(self, course_id: int):
        name = self._get_collection_name(course_id)
        if self._client:
            return self._client.get_or_create_collection(
                name=name,
                metadata={"hnsw:space": "cosine", "course_id": course_id}
            )
        if name not in self._in_memory_collections:
            self._in_memory_collections[name] = InMemoryCollection(name=name, metadata={"course_id": course_id})
        return self._in_memory_collections[name]

    async def add_chunks(
        self,
        course_id: int,
        chunks: List[str],
        metadatas: List[Dict[str, Any]],
        ids: List[str]
    ):
        """Embeds and indexes document chunks into the course collection."""
        collection = self.get_or_create_collection(course_id)
        embeddings = await self.get_embeddings(chunks)
        collection.add(
            documents=chunks,
            embeddings=embeddings,
            metadatas=metadatas,
            ids=ids
        )
        logger.info("Successfully indexed %d chunks for course_id=%d", len(chunks), course_id)

    async def query_similar(
        self,
        course_id: int,
        query: str,
        n_results: int = 4,
        where: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Queries the course collection for top matching chunks with cosine distance, optionally filtered by metadata."""
        collection = self.get_or_create_collection(course_id)
        query_embeddings = await self.get_embeddings([query]) if query else None
        
        count = collection.count()
        if count == 0:
            return {"documents": [[]], "metadatas": [[]], "distances": [[]]}

        k = min(n_results, count)
        kwargs = {
            "query_embeddings": query_embeddings,
            "n_results": k,
            "include": ["documents", "metadatas", "distances"]
        }
        if where:
            kwargs["where"] = where

        try:
            results = collection.query(**kwargs)
        except Exception as e:
            logger.warning(f"Collection query with where filter notice ({e}). Retrying without filter.")
            kwargs.pop("where", None)
            results = collection.query(**kwargs)

        return results

    async def query_by_module(
        self,
        course_id: int,
        module_id: int,
        query: str = "",
        n_results: int = 6
    ) -> Dict[str, Any]:
        """Queries chunks strictly filtered by module_id."""
        return await self.query_similar(
            course_id=course_id,
            query=query or f"Module {module_id} concepts",
            n_results=n_results,
            where={"module_id": module_id}
        )

    def get_document_count(self, course_id: int) -> int:
        collection = self.get_or_create_collection(course_id)
        return collection.count()

chroma_service = ChromaService()
