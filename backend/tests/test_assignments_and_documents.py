import pytest
import io
from app.models.models import User, Course, Module, Assignment, Enrollment
from app.core.security import get_password_hash

@pytest.mark.asyncio
async def test_assignments_rbac_and_submissions_idor(client, db_session):
    educator = User(
        email="assign_prof@cognipath.edu",
        hashed_password=get_password_hash("Pass123!"),
        full_name="Prof. Assignment",
        role="EDUCATOR"
    )
    student1 = User(
        email="assign_stu1@cognipath.edu",
        hashed_password=get_password_hash("Pass123!"),
        full_name="Alice Assign",
        role="STUDENT"
    )
    student2 = User(
        email="assign_stu2@cognipath.edu",
        hashed_password=get_password_hash("Pass123!"),
        full_name="Bob Assign",
        role="STUDENT"
    )
    db_session.add_all([educator, student1, student2])
    await db_session.commit()

    course = Course(title="Data Structures", code="CS102", educator_id=educator.id)
    db_session.add(course)
    await db_session.commit()

    module = Module(course_id=course.id, title="Trees & Graphs", order_index=1)
    db_session.add(module)
    await db_session.commit()

    # Enroll student1 only
    db_session.add(Enrollment(user_id=student1.id, course_id=course.id))
    await db_session.commit()

    # Login tokens
    login_edu = await client.post("/api/v1/auth/login", data={"username": educator.email, "password": "Pass123!"})
    headers_edu = {"Authorization": f"Bearer {login_edu.json()['access_token']}"}

    login_stu1 = await client.post("/api/v1/auth/login", data={"username": student1.email, "password": "Pass123!"})
    headers_stu1 = {"Authorization": f"Bearer {login_stu1.json()['access_token']}"}

    login_stu2 = await client.post("/api/v1/auth/login", data={"username": student2.email, "password": "Pass123!"})
    headers_stu2 = {"Authorization": f"Bearer {login_stu2.json()['access_token']}"}

    # 1. Student cannot create assignment (403)
    assign_payload = {
        "module_id": module.id,
        "title": "Red-Black Trees",
        "description": "Implement insertion and rotation",
        "assignment_type": "CODE",
        "rubric": [{"criterion": "Correctness", "max_points": 50, "description": "Tests pass"}],
        "max_score": 50
    }
    create_fail = await client.post("/api/v1/assignments", json=assign_payload, headers=headers_stu1)
    assert create_fail.status_code == 403

    # 2. Educator creates assignment (201)
    create_ok = await client.post("/api/v1/assignments", json=assign_payload, headers=headers_edu)
    assert create_ok.status_code == 201
    assign_id = create_ok.json()["id"]

    # 3. Enrolled student can view assignment (200), unenrolled student cannot (403)
    assert (await client.get(f"/api/v1/assignments/{assign_id}", headers=headers_stu1)).status_code == 200
    assert (await client.get(f"/api/v1/assignments/{assign_id}", headers=headers_stu2)).status_code == 403

    # 4. Enrolled student submits assignment
    submit_res = await client.post(
        f"/api/v1/assignments/{assign_id}/submit",
        data={"submission_text": "class RedBlackTree { ... }"},
        headers=headers_stu1
    )
    assert submit_res.status_code == 200

    # 5. IDOR: Student 2 cannot list Student 1's submissions (403)
    idor_res = await client.get(f"/api/v1/assignments/submissions/student/{student1.id}", headers=headers_stu2)
    assert idor_res.status_code == 403

    # Student 1 can view own submissions (200)
    own_res = await client.get(f"/api/v1/assignments/submissions/student/{student1.id}", headers=headers_stu1)
    assert own_res.status_code == 200
    assert len(own_res.json()) == 1


@pytest.mark.asyncio
async def test_documents_upload_size_and_extension(client, db_session):
    educator = User(
        email="doc_prof@cognipath.edu",
        hashed_password=get_password_hash("Pass123!"),
        full_name="Prof. Ingestion",
        role="EDUCATOR"
    )
    db_session.add(educator)
    await db_session.commit()

    course = Course(title="Operating Systems", code="CS204", educator_id=educator.id)
    db_session.add(course)
    await db_session.commit()

    login_edu = await client.post("/api/v1/auth/login", data={"username": educator.email, "password": "Pass123!"})
    headers_edu = {"Authorization": f"Bearer {login_edu.json()['access_token']}"}

    # 1. Invalid file extension (.exe) -> 400 Bad Request
    invalid_file = io.BytesIO(b"binary payload")
    res_ext = await client.post(
        "/api/v1/documents/upload",
        data={"course_id": course.id, "topic": "Kernel"},
        files={"file": ("malicious.exe", invalid_file, "application/octet-stream")},
        headers=headers_edu
    )
    assert res_ext.status_code == 400

    # 2. Oversized document (>20 MB) -> 413 Request Entity Too Large
    large_payload = b"0" * (21 * 1024 * 1024)
    large_file = io.BytesIO(large_payload)
    res_large = await client.post(
        "/api/v1/documents/upload",
        data={"course_id": course.id, "topic": "Virtual Memory"},
        files={"file": ("large_book.pdf", large_file, "application/pdf")},
        headers=headers_edu
    )
    assert res_large.status_code == 413
