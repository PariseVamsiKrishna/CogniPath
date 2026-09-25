import asyncio
import sys
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select

from app.main import app
from app.core.database import init_db, AsyncSessionLocal
from app.core.seed import seed_demo_data
from app.models.models import LearningPod, EducatorPodQuota
from app.services.pod_service import pod_manager


async def run_pod_lifecycle_tests():
    print("=================================================================")
    print("COGNIPATH LEARNING PODS LIFECYCLE & AUTO-TERMINATION TEST SUITE")
    print("=================================================================")

    # 1. Initialize DB and Seed Data
    print("\n[STEP 1] Initializing Database & Seed Data...")
    await init_db()
    await seed_demo_data()

    # Reset educator quota so test runs cleanly every time
    async with AsyncSessionLocal() as session:
        q_res = await session.execute(select(EducatorPodQuota).where(EducatorPodQuota.educator_id == 1))
        for q in q_res.scalars().all():
            q.daily_created = 0
            q.weekly_created = 0
        await session.commit()
    print("-> Educator quota reset for test suite execution.")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Authenticate as educator (Prof. Ramanujan, id=1)
        edu_login = await client.post("/api/v1/auth/login-json", json={
            "email": "teacher@cognipath.edu",
            "password": "password123"
        })
        assert edu_login.status_code == 200, f"Educator login failed: {edu_login.text}"
        edu_token = edu_login.json()["access_token"]
        edu_headers = {"Authorization": f"Bearer {edu_token}"}
        print("-> Educator Prof. Ramanujan authenticated.")

        # Authenticate as student (Alex Kumar / Aarav, id=2)
        student_login = await client.post("/api/v1/auth/login-json", json={
            "email": "student@cognipath.edu",
            "password": "password123"
        })
        assert student_login.status_code == 200, f"Student login failed: {student_login.text}"
        student_token = student_login.json()["access_token"]
        student_headers = {"Authorization": f"Bearer {student_token}"}
        print("-> Student authenticated.")

        # 2. Test Pod Creation with Scheduled Duration (30 minutes)
        print("\n[STEP 2] Creating Pod with 30-minute scheduled duration...")
        create_res = await client.post(
            "/api/v1/pods",
            headers=edu_headers,
            json={
                "title": "Distributed Consensus & Raft Protocol Pod",
                "course_id": 1,
                "topic": "Leader election and log replication invariants",
                "agenda": "Review term numbers and split-vote scenarios",
                "scheduled_duration_minutes": 30,
                "max_peers": 6
            }
        )
        assert create_res.status_code == 201, f"Pod creation failed: {create_res.text}"
        pod_data = create_res.json()
        pod_id = pod_data["id"]
        print(f"-> Created Pod #{pod_id}: '{pod_data['title']}'")
        assert pod_data["scheduled_duration_minutes"] == 30, f"Expected duration 30, got {pod_data['scheduled_duration_minutes']}"
        assert pod_data["is_active"] is True
        assert pod_data["status"] == "ACTIVE"
        assert pod_data["expires_at"] is not None
        print(f"   - Started At: {pod_data['started_at']}")
        print(f"   - Expires At: {pod_data['expires_at']}")
        print(f"   - Remaining Secs: {pod_data['remaining_seconds']}")
        assert 1700 <= pod_data["remaining_seconds"] <= 1800, f"Expected ~1800s, got {pod_data['remaining_seconds']}"

        # 3. Test Student Attempt to End Pod (Must be Forbidden 403)
        print("\n[STEP 3] Testing Authorization: Non-host student attempts to terminate pod...")
        unauth_end = await client.post(
            f"/api/v1/pods/{pod_id}/end",
            headers=student_headers,
            json={"reason": "Student trying to close pod"}
        )
        assert unauth_end.status_code == 403, f"Expected 403 Forbidden, got {unauth_end.status_code}: {unauth_end.text}"
        print(f"-> Correctly rejected with 403 Forbidden: {unauth_end.json()['detail']}")

        # 4. Test Host "End Pod for Everyone" Immediate Teardown
        print("\n[STEP 4] Host terminates pod for everyone via POST /api/v1/pods/{id}/end...")
        end_res = await client.post(
            f"/api/v1/pods/{pod_id}/end",
            headers=edu_headers,
            json={"reason": "Host concluded workshop"}
        )
        assert end_res.status_code == 200, f"Host end pod failed: {end_res.text}"
        end_data = end_res.json()
        print(f"-> Pod #{end_data['pod_id']} closed.")
        print(f"   - Status: {end_data['status']}")
        print(f"   - Reason: {end_data['reason']}")
        print(f"   - Ended At: {end_data['ended_at']}")
        print(f"   - Duration: {end_data['duration_minutes']} min")
        assert end_data["status"] == "TERMINATED_BY_HOST"

        # Verify DB state
        get_res = await client.get(f"/api/v1/pods/{pod_id}")
        assert get_res.status_code == 200
        verified_pod = get_res.json()
        assert verified_pod["is_active"] is False
        assert verified_pod["status"] == "TERMINATED_BY_HOST"
        assert verified_pod["ended_at"] is not None
        print("-> Verified in database: is_active=False, status=TERMINATED_BY_HOST")

        # 5. Test Server-Side Auto-Termination on Expiration
        print("\n[STEP 5] Testing Lifecycle Monitor Auto-Termination on Expiration...")
        # Reset quota again before creating second pod
        async with AsyncSessionLocal() as session:
            q_res = await session.execute(select(EducatorPodQuota).where(EducatorPodQuota.educator_id == 1))
            for q in q_res.scalars().all():
                q.daily_created = 0
            await session.commit()

        expired_pod_res = await client.post(
            "/api/v1/pods",
            headers=edu_headers,
            json={
                "title": "Time-Lapsed Micro-Pod",
                "course_id": 1,
                "topic": "Quick sprint",
                "scheduled_duration_minutes": 15
            }
        )
        assert expired_pod_res.status_code == 201, f"Failed to create second pod: {expired_pod_res.text}"
        exp_pod_id = expired_pod_res.json()["id"]

        # Artificially set expires_at in the past
        async with AsyncSessionLocal() as session:
            p = await session.get(LearningPod, exp_pod_id)
            p.expires_at = datetime.now(timezone.utc) - timedelta(seconds=10)
            await session.commit()

        # Run lifecycle check
        await pod_manager.check_active_pods_lifecycle()

        # Verify pod was marked COMPLETED
        async with AsyncSessionLocal() as session:
            p = await session.get(LearningPod, exp_pod_id)
            assert p.is_active is False, "Expired pod was not marked inactive!"
            assert p.status == "COMPLETED", f"Expected COMPLETED, got {p.status}"
            assert p.ended_at is not None
            print(f"-> Pod #{exp_pod_id} correctly auto-terminated by monitor with status='{p.status}' and ended_at='{p.ended_at}'.")

    print("\n=================================================================")
    print("ALL LEARNING PODS LIFECYCLE & TERMINATION TESTS PASSED (100% SUCCESS)")
    print("=================================================================")


if __name__ == "__main__":
    asyncio.run(run_pod_lifecycle_tests())
