import logging

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base

from app.core.config import settings

logger = logging.getLogger("cognipath.database")

database_url = settings.DATABASE_URL
if database_url.startswith("postgresql://"):
    database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
elif database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql+asyncpg://", 1)

engine_kwargs = {"echo": False}
if database_url.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_async_engine(database_url, **engine_kwargs)
AsyncSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

async def init_db():
    """Initialize database tables for local SQLite development. Production uses Alembic migrations."""
    from app.models.models import Base as ModelsBase
    try:
        if database_url.startswith("sqlite"):
            async with engine.begin() as conn:
                await conn.run_sync(ModelsBase.metadata.create_all)
            logger.info("SQLite database schema initialized successfully.")
        else:
            logger.info("Production database detected. Using existing tables & Alembic migrations.")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        raise
