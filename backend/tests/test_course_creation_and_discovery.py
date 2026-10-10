import pytest
from app.models.models import User, Course, Module, Topic
from tests.conftest import create_access_token_for_user

@pytest.mark.asyncio
async def test_atomic_course_creation(client, db_session):
    # Create educator user
    educator = User(
        email="prof_atomic@cognipath.edu",
        full_name="Prof. Atomic Test",
        hashed_password="hashedpassword123",
        role="EDUCATOR"
    )
    db_session.add(educator)
    await db_session.commit()
    await db_session.refresh(educator)

    token = create_access_token_for_user(educator.id, role="EDUCATOR")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "title": "Compiler Design & Code Generation",
        "code": "CD401",
        "category": "Computer Science",
        "difficulty": "Advanced",
        "description": "Lexical analysis, parsing, ASTs, and LLVM backend.",
        "modules": [
            {
                "title": "Module 1: Lexing and Parsing",
                "description": "Regex, DFAs, and LR(1) parser tables.",
                "topics": [
                    {
                        "title": "Lexical Analysis with Flex",
                        "description": "Building a tokenizer.",
                        "youtube_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                    },
                    {
                        "title": "LALR Parser Construction",
                        "description": "Bison and shift-reduce conflicts.",
                        "youtube_url": "https://youtu.be/dQw4w9WgXcQ"
                    }
                ]
            },
            {
                "title": "Module 2: Code Generation",
                "description": "Targeting LLVM IR.",
                "topics": [
                    {
                        "title": "LLVM IR Basics",
                        "description": "Static Single Assignment.",
                        "youtube_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                    }
                ]
            }
        ]
    }

    # 1. Atomic creation request
    resp = await client.post("/api/v1/courses", json=payload, headers=headers)
    assert resp.status_code == 201, resp.text
    data = resp.json()
    course_id = data["id"]
    assert data["title"] == "Compiler Design & Code Generation"
    assert data["code"] == "CD401"
    assert data["educator_email"] == "prof_atomic@cognipath.edu"

    # 2. Verify hierarchy has all modules and topics
    hier_resp = await client.get(f"/api/v1/courses/{course_id}/hierarchy", headers=headers)
    assert hier_resp.status_code == 200
    hier_data = hier_resp.json()
    assert len(hier_data["modules"]) == 2
    assert hier_data["modules"][0]["title"] == "Module 1: Lexing and Parsing"
    assert len(hier_data["modules"][0]["topics"]) == 2
    assert hier_data["modules"][1]["title"] == "Module 2: Code Generation"
    assert len(hier_data["modules"][1]["topics"]) == 1

@pytest.mark.asyncio
async def test_course_code_conflict_resilience(client, db_session):
    educator = User(
        email="prof_conflict@cognipath.edu",
        full_name="Prof. Conflict Test",
        hashed_password="hashedpassword123",
        role="EDUCATOR"
    )
    db_session.add(educator)
    await db_session.commit()
    await db_session.refresh(educator)

    token = create_access_token_for_user(educator.id, role="EDUCATOR")
    headers = {"Authorization": f"Bearer {token}"}

    payload1 = {
        "title": "Operating Systems Part 1",
        "code": "OS201",
        "category": "Computer Science"
    }
    resp1 = await client.post("/api/v1/courses", json=payload1, headers=headers)
    assert resp1.status_code == 201

    # Posting identical code should not crash; it should auto-disambiguate
    payload2 = {
        "title": "Operating Systems Part 2",
        "code": "OS201",
        "category": "Computer Science"
    }
    resp2 = await client.post("/api/v1/courses", json=payload2, headers=headers)
    assert resp2.status_code == 201
    data2 = resp2.json()
    assert data2["code"].startswith("OS201-")

@pytest.mark.asyncio
async def test_explore_courses_null_safety(client, db_session):
    # Insert a course with nullable fields (category None, description None)
    educator = User(
        email="prof_null@cognipath.edu",
        full_name="Prof. Null Safety",
        hashed_password="hashedpassword123",
        role="EDUCATOR"
    )
    db_session.add(educator)
    await db_session.commit()
    await db_session.refresh(educator)

    course = Course(
        title="Bare Minimal Course",
        code="MIN101",
        description=None,
        category=None,
        educator_id=educator.id
    )
    db_session.add(course)
    await db_session.commit()

    # Search query and category filter should not crash with AttributeError
    resp = await client.get("/api/v1/courses/explore?q=minimal&category=All")
    assert resp.status_code == 200
    items = resp.json()
    assert any(c["code"] == "MIN101" for c in items)

    # Filtering by category should safely ignore courses with None category
    resp_filtered = await client.get("/api/v1/courses/explore?category=Web%20Development")
    assert resp_filtered.status_code == 200

@pytest.mark.asyncio
async def test_educator_my_courses_retrieval(client, db_session):
    educator = User(
        email="prof_mine@cognipath.edu",
        full_name="Prof. Mine Test",
        hashed_password="hashedpassword123",
        role="EDUCATOR"
    )
    db_session.add(educator)
    await db_session.commit()
    await db_session.refresh(educator)

    token = create_access_token_for_user(educator.id, role="EDUCATOR")
    headers = {"Authorization": f"Bearer {token}"}

    # Create a course
    resp = await client.post("/api/v1/courses", json={
        "title": "Distributed Systems",
        "code": "DS501",
        "category": "Computer Science"
    }, headers=headers)
    assert resp.status_code == 201

    # Call /courses/my-courses and /courses/enrolled
    my_resp = await client.get("/api/v1/courses/my-courses", headers=headers)
    assert my_resp.status_code == 200
    my_courses = my_resp.json()
    assert any(c["code"] == "DS501" for c in my_courses)
    assert any(c["educator_email"] == "prof_mine@cognipath.edu" for c in my_courses)

@pytest.mark.asyncio
async def test_health_and_readiness_endpoints(client):
    # Test root /health and /api/v1/health
    resp1 = await client.get("/health")
    assert resp1.status_code == 200
    assert resp1.json()["status"] == "healthy"

    resp2 = await client.get("/api/v1/health")
    assert resp2.status_code == 200
    assert resp2.json()["status"] == "healthy"

    # Test root /health/ready and /api/v1/health/ready
    resp3 = await client.get("/health/ready")
    assert resp3.status_code == 200
    assert resp3.json()["status"] == "ready"
    assert resp3.json()["database"] == "connected"

    resp4 = await client.get("/api/v1/health/ready")
    assert resp4.status_code == 200
    assert resp4.json()["status"] == "ready"
    assert resp4.json()["database"] == "connected"

