import asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.models.models import User
from app.core.security import create_access_token
from app.core.database import AsyncSessionLocal
from sqlalchemy import select

async def main():
    print("Testing Tutor Video Suggestion & RAG Endpoints...")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Get test student user
        async with AsyncSessionLocal() as db:
            res = await db.execute(select(User).where(User.role == "STUDENT"))
            user = res.scalars().first()
            if not user:
                user = User(
                    email="test_student_rag@cognipath.edu",
                    hashed_password="mock",
                    full_name="Test Student",
                    role="STUDENT"
                )
                db.add(user)
                await db.commit()
                await db.refresh(user)

        token = create_access_token(data={"sub": str(user.id), "role": user.role, "email": user.email})
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Test /tutor/suggest-video for AVL Trees
        resp1 = await client.post(
            "/api/v1/tutor/suggest-video",
            json={"topic": "AVL Trees", "query": "rotations and balance"},
            headers=headers
        )
        print("Suggest Video (AVL Trees) Status:", resp1.status_code)
        assert resp1.status_code == 200, f"Expected 200, got {resp1.status_code}: {resp1.text}"
        data1 = resp1.json()
        print("Suggested Video Title:", data1["title"])
        print("Embed URL:", data1["embed_url"])
        assert "vRwi_UCVrjA" in data1["youtube_video_id"] or "vRwi_UCVrjA" in data1["embed_url"]

        # 3. Test /tutor/suggest-video for SQL Joins
        resp2 = await client.post(
            "/api/v1/tutor/suggest-video",
            json={"topic": "SQL Joins", "query": "inner vs outer join"},
            headers=headers
        )
        print("Suggest Video (SQL Joins) Status:", resp2.status_code)
        assert resp2.status_code == 200
        data2 = resp2.json()
        print("Suggested Video Title:", data2["title"])

        # 4. Test /tutor/query with video trigger keyword
        resp3 = await client.post(
            "/api/v1/tutor/query",
            json={
                "course_id": 1,
                "query": "Can you show me a video explanation for AVL tree rotations?",
                "target_language": "en"
            },
            headers=headers
        )
        print("Tutor Query Status:", resp3.status_code)
        assert resp3.status_code == 200
        data3 = resp3.json()
        print("Tutor Query Answer excerpt:", data3["answer"][:100] + "...")
        print("Tutor Query Video Attached:", data3.get("suggested_video") is not None)

        print("\nALL TUTOR & VIDEO INJECTION TESTS PASSED!")

if __name__ == "__main__":
    asyncio.run(main())
