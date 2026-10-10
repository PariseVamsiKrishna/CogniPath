import asyncio
import pytest
from httpx import AsyncClient, ASGITransport
from starlette.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from datetime import datetime, timezone, timedelta
from jose import jwt

from app.main import app
from app.core.config import settings
from app.core.database import Base, get_db
from app.core.security import get_password_hash
from app.models.models import User, Course, Module, Enrollment, LearningPod

import os

TEST_DATABASE_FILE = "./test_cognipath_pytest.db"
TEST_DATABASE_URL = f"sqlite+aiosqlite:///{TEST_DATABASE_FILE}"

settings.ENVIRONMENT = "testing"

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session")
async def test_engine():
    if os.path.exists(TEST_DATABASE_FILE):
        try:
            os.remove(TEST_DATABASE_FILE)
        except Exception:
            pass

    import app.core.database as db_module
    import app.api.v1.pods as pods_module
    import app.services.pod_service as pod_service_module
    import app.main as main_module

    engine = create_async_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
    new_sessionmaker = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    
    db_module.engine = engine
    try:
        db_module.AsyncSessionLocal.configure(bind=engine)
    except Exception:
        pass
    db_module.AsyncSessionLocal = new_sessionmaker
    pods_module.AsyncSessionLocal = new_sessionmaker
    pod_service_module.AsyncSessionLocal = new_sessionmaker
    main_module.AsyncSessionLocal = new_sessionmaker
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield engine
    
    await engine.dispose()
    if os.path.exists(TEST_DATABASE_FILE):
        try:
            os.remove(TEST_DATABASE_FILE)
        except Exception:
            pass

@pytest.fixture
async def db_session(test_engine):
    async_session = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)
    async with async_session() as session:
        yield session

@pytest.fixture
async def client(db_session):
    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac
    app.dependency_overrides.clear()

@pytest.fixture
def sync_test_client(db_session):
    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as tc:
        yield tc
    app.dependency_overrides.clear()

def create_access_token_for_user(user_id: int, role: str = "STUDENT") -> str:
    expires = datetime.now(timezone.utc) + timedelta(minutes=60)
    to_encode = {"sub": str(user_id), "role": role, "exp": expires}
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
