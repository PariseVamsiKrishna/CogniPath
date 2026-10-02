import pytest
import asyncio
from datetime import datetime, timezone, timedelta
from sqlalchemy.future import select

from app.models.models import User, Course, LearningPod, EducatorPodQuota
from app.core.security import get_password_hash
from app.services.pod_service import pod_manager

@pytest.mark.asyncio
async def test_daily_and_weekly_quota_enforcement(client, db_session):
    # 1. Create Educator
    educator = User(
        email="quota_educator@cognipath.edu",
        hashed_password=get_password_hash("Pass123!"),
        full_name="Dr. Quota",
        role="EDUCATOR"
    )
    db_session.add(educator)
    await db_session.commit()
    await db_session.refresh(educator)

    # Login to get JWT
    login_res = await client.post("/api/v1/auth/login", data={
        "username": educator.email,
        "password": "Pass123!"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create Course
    course = Course(title="Quota Course", code="QC101", educator_id=educator.id)
    db_session.add(course)
    await db_session.commit()
    await db_session.refresh(course)

    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")
    week_start_str = (now - timedelta(days=now.weekday())).strftime("%Y-%m-%d")

    # Seed 11 pods already created across previous days in the same week
    q_prev = EducatorPodQuota(
        educator_id=educator.id,
        day_date=(now - timedelta(days=1)).strftime("%Y-%m-%d"),
        week_start_date=week_start_str,
        daily_created=11,
        weekly_created=11
    )
    db_session.add(q_prev)
    await db_session.commit()

    # 12th pod created today -> should succeed (daily=1, weekly=12)
    res_12 = await client.post("/api/v1/pods", json={
        "title": "12th Pod",
        "course_id": course.id,
        "topic": "Algorithms"
    }, headers=headers)
    assert res_12.status_code == 201

    # 13th pod in the same week -> must return 429 Too Many Requests
    res_13 = await client.post("/api/v1/pods", json={
        "title": "13th Pod (Limit)",
        "course_id": course.id,
        "topic": "Algorithms"
    }, headers=headers)
    assert res_13.status_code == 429
    assert "12 active pods allowed per week" in res_13.json()["detail"]


@pytest.mark.asyncio
async def test_grace_timer_teardown(client, db_session):
    educator = User(
        email="grace_host@cognipath.edu",
        hashed_password=get_password_hash("Pass123!"),
        full_name="Grace Host",
        role="EDUCATOR"
    )
    db_session.add(educator)
    await db_session.commit()
    await db_session.refresh(educator)

    pod = LearningPod(
        title="Grace Pod",
        course_id=1,
        host_id=educator.id,
        topic="Grace Timer Test",
        is_active=True,
        scheduled_duration_minutes=30,
        started_at=datetime.now(timezone.utc),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
        status="ACTIVE"
    )
    db_session.add(pod)
    await db_session.commit()
    await db_session.refresh(pod)

    target_pod_id = pod.id

    # Schedule host grace period with 1 second grace window
    pod_manager._schedule_host_grace_period(target_pod_id, grace_seconds=1)
    assert str(target_pod_id) in pod_manager.host_grace_timers

    # Wait for grace timer to expire and execute teardown
    await asyncio.sleep(1.5)

    # Verify pod status in DB
    db_session.expire_all()
    res = await db_session.execute(select(LearningPod).where(LearningPod.id == target_pod_id))
    updated_pod = res.scalars().first()
    assert updated_pod is not None
    assert updated_pod.is_active is False
    assert updated_pod.status == "TERMINATED_BY_HOST"
    assert updated_pod.ended_at is not None
    assert str(target_pod_id) not in pod_manager.host_grace_timers
