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
elif "asyncpg" in database_url:
    # Disable prepared statement caching for Supabase / PgBouncer connection poolers
    engine_kwargs["connect_args"] = {
        "statement_cache_size": 0,
        "prepared_statement_cache_size": 0,
    }

engine = create_async_engine(database_url, **engine_kwargs)
AsyncSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

async def init_db():
    """Initialize database tables and apply safe additive column migrations without modifying existing data."""
    from sqlalchemy import text
    from app.models.models import Base as ModelsBase
    try:
        async with engine.begin() as conn:
            await conn.run_sync(ModelsBase.metadata.create_all)
        logger.info("Database tables verified/initialized successfully.")

        # Safe non-destructive additive column migrations for existing databases
        if database_url.startswith("sqlite"):
            sqlite_migrations = [
                "ALTER TABLE courses ADD COLUMN target_branch VARCHAR(255) DEFAULT 'Computer Science & Engineering (CSE)'",
                "ALTER TABLE courses ADD COLUMN is_published BOOLEAN DEFAULT 1 NOT NULL",
                "ALTER TABLE courses ADD COLUMN updated_at TIMESTAMP",
                "ALTER TABLE educator_pod_quotas ADD COLUMN weekly_created INTEGER DEFAULT 0 NOT NULL",
            ]
            for stmt in sqlite_migrations:
                try:
                    async with engine.begin() as conn:
                        await conn.execute(text(stmt))
                except Exception:
                    pass
        else:
            pg_migrations = [
                "ALTER TABLE courses ADD COLUMN IF NOT EXISTS target_branch VARCHAR(255) DEFAULT 'Computer Science & Engineering (CSE)'",
                "ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT TRUE NOT NULL",
                "ALTER TABLE courses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()",
                "ALTER TABLE educator_pod_quotas ADD COLUMN IF NOT EXISTS weekly_created INTEGER DEFAULT 0 NOT NULL",
            ]
            for stmt in pg_migrations:
                try:
                    async with engine.begin() as conn:
                        await conn.execute(text(stmt))
                except Exception as mig_err:
                    logger.debug(f"Additive column migration notice: {mig_err}")
    except Exception as e:
        err_msg = str(e)
        if "tenant" in err_msg.lower() or "ENOTFOUND" in err_msg or "puamvixoldsxphuivssh" in err_msg:
            logger.error(
                "CRITICAL: Supabase connection failed — tenant/user not found. "
                "Your Supabase project is likely PAUSED due to inactivity or the project reference ID is invalid. "
                "Please go to https://supabase.com/dashboard/project/puamvixoldsxphuivssh and click 'Restore project' (or unpause), "
                "or update DATABASE_URL in your Render environment variables."
            )
        logger.error(f"Failed to initialize database: {e}")
        raise
