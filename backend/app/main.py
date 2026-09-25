import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import init_db
from app.core.seed import seed_demo_data
from app.api.v1 import (
    auth, courses, documents, tutor, quizzes, analytics, pods, communities,
    socratic, roadmap, curriculum_audit, exams, assignments
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("cognipath.main")

from app.services.pod_service import pod_manager

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager: sets up DB schemas, seeds demo data, and starts pod monitor."""
    logger.info("Starting COGNIPATH Backend Engine...")
    await init_db()
    await seed_demo_data()
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

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permits local Vite dev server and external clients
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API Routers under /api/v1
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(courses.router, prefix=settings.API_V1_STR)
app.include_router(courses.module_router, prefix=settings.API_V1_STR)
app.include_router(documents.router, prefix=settings.API_V1_STR)
app.include_router(tutor.router, prefix=settings.API_V1_STR)
app.include_router(quizzes.router, prefix=settings.API_V1_STR)
app.include_router(analytics.router, prefix=settings.API_V1_STR)
app.include_router(pods.router, prefix=settings.API_V1_STR)
app.include_router(pods.router, prefix="/ws")
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
async def health_check():
    return {"status": "healthy", "version": settings.VERSION}
