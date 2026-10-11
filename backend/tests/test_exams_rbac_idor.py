import pytest
import json
from app.models.models import User, Course, Module, Exam, ExamQuestion, Enrollment, StudentBadge
from app.core.security import get_password_hash

@pytest.mark.asyncio
async def test_exams_rbac_masking_and_idor(client, db_session):
    # Setup users: 1 Educator, 2 Students
    educator = User(
        email="exam_prof@cognipath.edu",
        hashed_password=get_password_hash("Pass123!"),
        full_name="Prof. Turing",
        role="EDUCATOR"
    )
    student1 = User(
        email="enrolled_student@cognipath.edu",
        hashed_password=get_password_hash("Pass123!"),
        full_name="Enrolled Alice",
        role="STUDENT"
    )
    student2 = User(
        email="unenrolled_student@cognipath.edu",
        hashed_password=get_password_hash("Pass123!"),
        full_name="Unenrolled Bob",
        role="STUDENT"
    )
    db_session.add_all([educator, student1, student2])
    await db_session.commit()
    await db_session.refresh(educator)
    await db_session.refresh(student1)
    await db_session.refresh(student2)

    course = Course(title="Theory of Computation", code="CS301", educator_id=educator.id)
    db_session.add(course)
    await db_session.commit()
    await db_session.refresh(course)

    # Enroll student1 only
    enrollment = Enrollment(user_id=student1.id, course_id=course.id)
    db_session.add(enrollment)
    await db_session.commit()

    # Login tokens
    login_edu = await client.post("/api/v1/auth/login", data={"username": educator.email, "password": "Pass123!"})
    token_edu = login_edu.json()["access_token"]
    headers_edu = {"Authorization": f"Bearer {token_edu}"}

    login_stu1 = await client.post("/api/v1/auth/login", data={"username": student1.email, "password": "Pass123!"})
    token_stu1 = login_stu1.json()["access_token"]
    headers_stu1 = {"Authorization": f"Bearer {token_stu1}"}

    login_stu2 = await client.post("/api/v1/auth/login", data={"username": student2.email, "password": "Pass123!"})
    token_stu2 = login_stu2.json()["access_token"]
    headers_stu2 = {"Authorization": f"Bearer {token_stu2}"}

    # 1. Student cannot create exam (403)
    exam_payload = {
        "course_id": course.id,
        "exam_type": "FINAL_EXAM",
        "title": "Turing Final Exam",
        "time_limit_mins": 60,
        "passing_score": 75,
        "questions": [
            {
                "question_type": "MULTIPLE_CHOICE",
                "question_text": "Is the Halting Problem decidable?",
                "options": ["Yes", "No", "Depends", "Undecided"],
                "correct_answer": "No",
                "explanation": "Turing proved the halting problem is undecidable."
            }
        ]
    }
    create_fail = await client.post("/api/v1/exams", json=exam_payload, headers=headers_stu1)
    assert create_fail.status_code == 403

    # 2. Educator creates exam (201)
    create_ok = await client.post("/api/v1/exams", json=exam_payload, headers=headers_edu)
    assert create_ok.status_code == 201
    exam_id = create_ok.json()["id"]

    # 3. Educator GET exam -> answers & explanations are revealed
    edu_get = await client.get(f"/api/v1/exams/{exam_id}", headers=headers_edu)
    assert edu_get.status_code == 200
    edu_q = edu_get.json()["questions"][0]
    assert edu_q["correct_answer"] == "No"
    assert "Turing proved" in edu_q["explanation"]

    # 4. Enrolled Student GET exam -> answers & explanations MUST BE MASKED (None)
    stu1_get = await client.get(f"/api/v1/exams/{exam_id}", headers=headers_stu1)
    assert stu1_get.status_code == 200
    stu_q = stu1_get.json()["questions"][0]
    assert stu_q["correct_answer"] is None
    assert stu_q["explanation"] is None

    # 5. Unenrolled Student GET exam -> 403 Forbidden
    stu2_get = await client.get(f"/api/v1/exams/{exam_id}", headers=headers_stu2)
    assert stu2_get.status_code == 403

    # 6. Unenrolled Student submit exam -> 403 Forbidden
    stu2_sub = await client.post(f"/api/v1/exams/{exam_id}/submit", json={"responses": []}, headers=headers_stu2)
    assert stu2_sub.status_code == 403

    # 7. Student IDOR on badges: student2 cannot view student1's badges (403)
    badge = StudentBadge(
        student_id=student1.id,
        course_id=course.id,
        badge_name="Master of Computability",
        difficulty_level="hard",
        verification_hash="tamperproof_hash_123"
    )
    db_session.add(badge)
    await db_session.commit()

    # student2 viewing student1 badges -> 403
    badge_idor = await client.get(f"/api/v1/exams/badges/student/{student1.id}", headers=headers_stu2)
    assert badge_idor.status_code == 403

    # student1 viewing own badges -> 200
    badge_own = await client.get(f"/api/v1/exams/badges/student/{student1.id}", headers=headers_stu1)
    assert badge_own.status_code == 200
    assert len(badge_own.json()) == 1
