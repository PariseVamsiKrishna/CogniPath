from typing import List
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "COGNIPATH"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"

    # Environment
    ENVIRONMENT: str = "development"

    # Database — Pydantic BaseSettings reads from .env automatically
    DATABASE_URL: str = "sqlite+aiosqlite:///./cognipath.db"

    # Security / JWT
    SECRET_KEY: str = "cognipath_super_secure_jwt_secret_key_sih2026_smart_education"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # OpenAI & Embeddings (optional fallback)
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL_NAME: str = "gpt-4o-mini"
    EMBEDDING_MODEL: str = "text-embedding-3-small"

    # Google Gemini API — values come from .env at startup via Pydantic BaseSettings
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL_NAME: str = "gemini-2.0-flash"
    GEMINI_EMBEDDING_MODEL: str = "gemini-embedding-001"

    # ChromaDB Vector Store
    CHROMA_SERVER_HOST: str = "localhost"
    CHROMA_SERVER_PORT: int = 8001
    CHROMA_PERSIST_DIR: str = "./chroma_data"

    # Bhashini ULCA Multilingual API
    BHASHINI_USER_ID: str = ""
    BHASHINI_API_KEY: str = ""
    BHASHINI_PIPELINE_ID: str = ""
    BHASHINI_BASE_URL: str = "https://dhruva-api.bhashini.gov.in/services/inference/pipeline"

    # File Storage
    UPLOAD_DIR: str = "./uploads"

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "*"
    ]

    class Config:
        case_sensitive = True
        env_file = ".env"
        extra = "allow"

settings = Settings()
