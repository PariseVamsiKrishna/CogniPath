import logging
import re
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from app.core.config import settings

logger = logging.getLogger("cognipath.database")

# Handle SQLite vs PostgreSQL (Supabase) engine options
connect_args = {}
database_url = settings.DATABASE_URL.strip()

# Check for unreplaced placeholder
if "[YOUR-PASSWORD]" in database_url or "[YOUR_PASSWORD]" in database_url:
    logger.error("🚨 CRITICAL: DATABASE_URL contains literal placeholder '[YOUR-PASSWORD]'! Replace it with your Supabase DB password in Render Environment Variables.")

# Auto-strip accidental placeholder brackets in passwords, e.g. postgres:[password]@host -> postgres:password@host
database_url = re.sub(r':\[([^\[\]]+)\]@', r':\1@', database_url)

# Auto-convert standard postgresql:// or postgres:// URI to asyncpg driver
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql+asyncpg://", 1)
elif database_url.startswith("postgresql://") and not database_url.startswith("postgresql+asyncpg://"):
    database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)

if database_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
else:
    # Supabase / PostgreSQL cloud pooling optimizations:
    # Supabase Transaction Pooler (port 6543) requires statement_cache_size=0 for asyncpg
    if ":6543" in database_url or "pooler.supabase.com" in database_url or "supavisor" in database_url:
        connect_args["statement_cache_size"] = 0

    # Ensure SSL is enabled for Supabase cloud connections
    if "supabase.co" in database_url or "supabase.com" in database_url:
        connect_args["ssl"] = "require"

engine = create_async_engine(
    database_url,
    echo=False,
    future=True,
    connect_args=connect_args,
    pool_pre_ping=True
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

Base = declarative_base()

async def get_db():
    """Dependency for providing an async database session per request."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

from sqlalchemy import text

async def init_db():
    """Create all database tables on startup and ensure new columns exist."""
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            if database_url.startswith("sqlite"):
                # Ensure courses new columns
                res_c = await conn.execute(text("PRAGMA table_info(courses)"))
                c_cols = [row[1] for row in res_c.fetchall()]
                if "difficulty" not in c_cols:
                    await conn.execute(text("ALTER TABLE courses ADD COLUMN difficulty VARCHAR(50) DEFAULT 'Intermediate'"))
                if "thumbnail_url" not in c_cols:
                    await conn.execute(text("ALTER TABLE courses ADD COLUMN thumbnail_url VARCHAR(512)"))

                # Ensure learning_pods new columns
                res_p = await conn.execute(text("PRAGMA table_info(learning_pods)"))
                p_cols = [row[1] for row in res_p.fetchall()]
                if "agenda" not in p_cols:
                    await conn.execute(text("ALTER TABLE learning_pods ADD COLUMN agenda TEXT"))
                if "passcode_hash" not in p_cols:
                    await conn.execute(text("ALTER TABLE learning_pods ADD COLUMN passcode_hash VARCHAR(255)"))
                if "scheduled_duration_minutes" not in p_cols:
                    await conn.execute(text("ALTER TABLE learning_pods ADD COLUMN scheduled_duration_minutes INTEGER DEFAULT 45"))
                if "started_at" not in p_cols:
                    await conn.execute(text("ALTER TABLE learning_pods ADD COLUMN started_at DATETIME"))
                if "expires_at" not in p_cols:
                    await conn.execute(text("ALTER TABLE learning_pods ADD COLUMN expires_at DATETIME"))
                if "ended_at" not in p_cols:
                    await conn.execute(text("ALTER TABLE learning_pods ADD COLUMN ended_at DATETIME"))
                if "status" not in p_cols:
                    await conn.execute(text("ALTER TABLE learning_pods ADD COLUMN status VARCHAR(50) DEFAULT 'ACTIVE'"))
                if "host_last_seen_at" not in p_cols:
                    await conn.execute(text("ALTER TABLE learning_pods ADD COLUMN host_last_seen_at DATETIME"))
                if "kshetra_meeting_code" not in p_cols:
                    await conn.execute(text("ALTER TABLE learning_pods ADD COLUMN kshetra_meeting_code VARCHAR(100)"))

                # Ensure modules new columns
                res_m = await conn.execute(text("PRAGMA table_info(modules)"))
                m_cols = [row[1] for row in res_m.fetchall()]
                if "has_module_exam" not in m_cols:
                    await conn.execute(text("ALTER TABLE modules ADD COLUMN has_module_exam BOOLEAN DEFAULT 0"))
                if "module_exam_id" not in m_cols:
                    await conn.execute(text("ALTER TABLE modules ADD COLUMN module_exam_id INTEGER"))

                # Ensure exams new columns
                res_e = await conn.execute(text("PRAGMA table_info(exams)"))
                e_cols = [row[1] for row in res_e.fetchall()]
                if "scope" not in e_cols:
                    await conn.execute(text("ALTER TABLE exams ADD COLUMN scope VARCHAR(50) DEFAULT 'MODULE_END'"))

                # Ensure users academic profile columns (SIH 2026)
                res_u = await conn.execute(text("PRAGMA table_info(users)"))
                u_cols = [row[1] for row in res_u.fetchall()]
                if "university" not in u_cols:
                    await conn.execute(text("ALTER TABLE users ADD COLUMN university VARCHAR(255)"))
                if "department" not in u_cols:
                    await conn.execute(text("ALTER TABLE users ADD COLUMN department VARCHAR(255)"))
                if "institutional_email" not in u_cols:
                    await conn.execute(text("ALTER TABLE users ADD COLUMN institutional_email VARCHAR(255)"))
                if "student_year" not in u_cols:
                    await conn.execute(text("ALTER TABLE users ADD COLUMN student_year VARCHAR(100)"))
                if "student_id_num" not in u_cols:
                    await conn.execute(text("ALTER TABLE users ADD COLUMN student_id_num VARCHAR(100)"))
                if "highest_qualification" not in u_cols:
                    await conn.execute(text("ALTER TABLE users ADD COLUMN highest_qualification VARCHAR(100)"))
                if "designation" not in u_cols:
                    await conn.execute(text("ALTER TABLE users ADD COLUMN designation VARCHAR(100)"))
                if "profile_completed" not in u_cols:
                    await conn.execute(text("ALTER TABLE users ADD COLUMN profile_completed BOOLEAN DEFAULT 0"))

        logger.info("Database schema initialized successfully.")
    except Exception as e:
        err_msg = str(e)
        logger.error(f"❌ Failed to initialize database: {err_msg}")
        if "password authentication failed" in err_msg.lower():
            logger.error(
                "\n"
                "================================================================================\n"
                "🚨 SUPABASE DATABASE AUTHENTICATION FAILED 🚨\n"
                "The database password in DATABASE_URL was rejected by Supabase.\n\n"
                "STEPS TO FIX IN RENDER:\n"
                "1. Open your Supabase Dashboard: https://supabase.com/dashboard\n"
                "2. Go to Project Settings -> Database -> scroll to 'Database password'\n"
                "3. Click 'Reset database password' and set a clean alphanumeric password\n"
                "   (e.g., 'CogniPath2026DB' - avoid special symbols that require URL escaping)\n"
                "4. Copy the connection string under 'Connection string' -> 'URI':\n"
                "   postgresql://postgres:CogniPath2026DB@db.xxxx.supabase.co:5432/postgres\n"
                "   (Or pooler): postgresql://postgres.xxxx:CogniPath2026DB@aws-0-xxxx.pooler.supabase.com:6543/postgres\n"
                "5. In Render Dashboard -> Environment -> Update DATABASE_URL and click Save Changes.\n"
                "================================================================================\n"
            )
        raise

