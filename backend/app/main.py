import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.api.v1 import (
    analytics,
    assignments,
    auth,
    communities,
    courses,
    curriculum_audit,
    documents,
    exams,
    pods,
    quizzes,
    roadmap,
    socratic,
    tutor,
)
from app.core.config import settings
from app.core.database import init_db
from app.core.seed import seed_demo_data

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("cognipath.main")

from sqlalchemy import text
from sqlalchemy.future import select

from app.core.database import AsyncSessionLocal
from app.core.security import get_password_hash
from app.models.models import LearningPod
from app.services.pod_service import pod_manager


async def migrate_legacy_passcodes():
    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(LearningPod).where(LearningPod.passcode_hash.isnot(None)))
            pods = result.scalars().all()
            updated = 0
            for p in pods:
                if p.passcode_hash and not p.passcode_hash.startswith("$2"):
                    p.passcode_hash = get_password_hash(p.passcode_hash.strip())
                    updated += 1
            if updated > 0:
                await session.commit()
                logger.info(f"Successfully migrated {updated} legacy plaintext pod passcodes to bcrypt.")
    except Exception as e:
        logger.warning(f"Passcode migration warning: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager: sets up DB schemas, seeds demo data, and starts pod monitor."""
    logger.info("Starting COGNIPATH Backend Engine...")
    await init_db()
    
    # Run legacy passcode migration
    await migrate_legacy_passcodes()
    
    # Disable seed_demo_data when in production or testing
    if settings.ENVIRONMENT.lower() not in ("production", "testing", "test"):
        await seed_demo_data()
    else:
        logger.info(f"ENVIRONMENT is {settings.ENVIRONMENT}. Skipping seed_demo_data().")

    pod_manager.ensure_monitor_running()
    yield
    if pod_manager.monitor_task and not pod_manager.monitor_task.done():
        pod_manager.monitor_task.cancel()
    logger.info("Shutting down COGNIPATH Backend Engine...")

app = FastAPI(
    title="COGNIPATH API - AI-Powered Personalized Learning Ecosystem",
    description=(
        "Backend REST & WebSocket API for Smart India Hackathon 2026 (SIH262070/500). "
        "Features Curriculum-Grounded RAG, Bhashini Indic Multilingual Support, "
        "SM-2 Spaced Repetition Quizzes, Educator At-Risk Analytics, "
        "Native Learning Pods, and Community Hub."
    ),
    version="1.0.0",
    lifespan=lifespan
)

# GZip Compression Middleware for payloads > 1KB
app.add_middleware(GZipMiddleware, minimum_size=1000)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"^https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request Timing & Process Time Header Middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = (time.time() - start_time) * 1000
    response.headers["X-Process-Time-MS"] = f"{process_time:.2f}"
    return response

# Mount API Routers under /api/v1
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(courses.router, prefix=settings.API_V1_STR)
app.include_router(courses.module_router, prefix=settings.API_V1_STR)
app.include_router(documents.router, prefix=settings.API_V1_STR)
app.include_router(tutor.router, prefix=settings.API_V1_STR)
app.include_router(quizzes.router, prefix=settings.API_V1_STR)
app.include_router(analytics.router, prefix=settings.API_V1_STR)
app.include_router(pods.router, prefix=settings.API_V1_STR)
app.include_router(communities.router, prefix=settings.API_V1_STR)
app.include_router(socratic.router, prefix=settings.API_V1_STR)
app.include_router(roadmap.router, prefix=settings.API_V1_STR)
app.include_router(curriculum_audit.router, prefix=settings.API_V1_STR)
app.include_router(exams.router, prefix=settings.API_V1_STR)
app.include_router(assignments.router, prefix=settings.API_V1_STR)

@app.get("/")
async def root():
    return {
        "project": "COGNIPATH",
        "hackathon": "Smart India Hackathon 2026",
        "problem_statement": "SIH262070/500 - Developing an AI-Integrated LMS",
        "team": "AKAZA",
        "status": "online",
        "docs_url": "/docs"
    }

@app.get("/health")
@app.get(f"{settings.API_V1_STR}/health")
async def health_check():
    return {"status": "healthy", "version": settings.VERSION}


@app.get("/health/ready")
@app.get(f"{settings.API_V1_STR}/health/ready")
async def readiness_check():
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        return {
            "status": "ready",
            "database": "connected",
            "version": settings.VERSION,
        }
    except Exception as e:
        logger.error(f"Readiness check database failure: {e}")
        raise HTTPException(status_code=503, detail="Database connection unavailable")

