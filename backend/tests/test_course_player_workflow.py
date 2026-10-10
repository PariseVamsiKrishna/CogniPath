import pytest
from app.models.models import User, Course, Module, Exam, ExamQuestion, Enrollment, Topic
from app.core.security import get_password_hash

@pytest.mark.asyncio
async def test_course_player_hierarchy_exam_security_and_youtube(client, db_session):
    # Setup users: 1 Educator, 2 Students
    educator = User(
        email="player_educator@cognipath.edu",
        hashed_password=get_password_hash("Pass123!"),
        full_name="Prof. Knuth",
        role="EDUCATOR"
    )
    student1 = User(
        email="player_student1@cognipath.edu",
        hashed_password=get_password_hash("Pass123!"),
        full_name="Student One",
        role="STUDENT"
    )
    student2 = User(
        email="player_student2@cognipath.edu",
        hashed_password=get_password_hash("Pass123!"),
        full_name="Student Two",
        role="STUDENT"
    )
    db_session.add_all([educator, student1, student2])
    await db_session.commit()
    await db_session.refresh(educator)
    await db_session.refresh(student1)
    await db_session.refresh(student2)

    course = Course(title="Algorithms and Data Structures", code="CS201", educator_id=educator.id)
    db_session.add(course)
    await db_session.commit()
    await db_session.refresh(course)

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

    # 1. Educator creates module
    mod_res = await client.post(
        f"/api/v1/courses/{course.id}/modules",
        json={"title": "Binary Trees", "description": "Tree Data Structures"},
        headers=headers_edu
    )
    assert mod_res.status_code == 201
    module_id = mod_res.json()["id"]

    # 2. YouTube URL Validation tests on create_topic:
    # A) Valid standard watch URL
    t1_res = await client.post(
        f"/api/v1/courses/modules/{module_id}/topics",
        json={
            "title": "Tree Traversals",
            "description": "DFS and BFS",
            "youtube_url": "https://www.youtube.com/watch?v=WLvU5EQVZqY"
        },
        headers=headers_edu
    )
    assert t1_res.status_code == 201
    assert t1_res.json()["youtube_video_id"] == "WLvU5EQVZqY"
    topic1_id = t1_res.json()["id"]

    # B) Valid shorts URL
    t2_res = await client.post(
        f"/api/v1/courses/modules/{module_id}/topics",
        json={
            "title": "Shorts Intro",
            "description": "Quick overview",
            "youtube_url": "https://youtube.com/shorts/dQw4w9WgXcQ"
        },
        headers=headers_edu
    )
    assert t2_res.status_code == 201
    assert t2_res.json()["youtube_video_id"] == "dQw4w9WgXcQ"

    # C) Valid youtu.be URL
    t3_res = await client.post(
        f"/api/v1/courses/modules/{module_id}/topics",
        json={
            "title": "Short link topic",
            "description": "Short link",
            "youtube_url": "https://youtu.be/jDM6_TnYIuE?t=10"
        },
        headers=headers_edu
    )
    assert t3_res.status_code == 201
    assert t3_res.json()["youtube_video_id"] == "jDM6_TnYIuE"

    # D) Invalid URL must return 400 Bad Request
    inv_res = await client.post(
        f"/api/v1/courses/modules/{module_id}/topics",
        json={
            "title": "Invalid link",
            "description": "Bad link",
            "youtube_url": "https://evil.com/video/not_youtube"
        },
        headers=headers_edu
    )
    assert inv_res.status_code == 400

    # 3. Create Final Course Exam with questions
    final_exam_payload = {
        "course_id": course.id,
        "exam_type": "FINAL_EXAM",
        "title": "Algorithms Final Capstone Exam",
        "time_limit_mins": 45,
        "passing_score": 70,
        "questions": [
            {
                "question_type": "MCQ",
                "question_text": "What is the height of a balanced AVL tree with N nodes?",
                "options": ["O(log N)", "O(N)", "O(1)", "O(N^2)"],
                "correct_answer": "O(log N)",
                "explanation": "AVL trees guarantee logarithmic height bound O(log N)."
            }
        ]
    }
    exam_create_res = await client.post("/api/v1/exams", json=final_exam_payload, headers=headers_edu)
    assert exam_create_res.status_code == 201

    # 4. SECURITY CHECK: Hierarchy endpoint
    # A) Educator retrieves hierarchy -> sees answer keys and explanations
    edu_hier = await client.get(f"/api/v1/courses/{course.id}/hierarchy", headers=headers_edu)
    assert edu_hier.status_code == 200
    edu_data = edu_hier.json()
    assert edu_data["final_exam"] is not None
    edu_q = edu_data["final_exam"]["questions"][0]
    assert edu_q["correct_answer"] == "O(log N)"
    assert "logarithmic height" in edu_q["explanation"]

    # B) Student retrieves hierarchy -> answers and explanations MUST BE NONE
    stu_hier = await client.get(f"/api/v1/courses/{course.id}/hierarchy", headers=headers_stu1)
    assert stu_hier.status_code == 200
    stu_data = stu_hier.json()
    assert stu_data["final_exam"] is not None
    stu_q = stu_data["final_exam"]["questions"][0]
    assert stu_q["correct_answer"] is None
    assert stu_q["explanation"] is None

    # 5. Topic Progress Tracking & Isolation
    # Student1 marks topic1 as completed
    comp_res = await client.post(
        f"/api/v1/courses/topics/{topic1_id}/complete",
        json={"is_completed": True},
        headers=headers_stu1
    )
    assert comp_res.status_code == 200
    assert comp_res.json()["is_completed"] is True
    assert topic1_id in comp_res.json()["completed_topic_ids"]

    # Student1 gets completed topics
    stu1_prog = await client.get(f"/api/v1/courses/{course.id}/completed-topics", headers=headers_stu1)
    assert stu1_prog.status_code == 200
    assert topic1_id in stu1_prog.json()["completed_topic_ids"]

    # Student2 (different user) gets completed topics -> MUST BE EMPTY
    stu2_prog = await client.get(f"/api/v1/courses/{course.id}/completed-topics", headers=headers_stu2)
    assert stu2_prog.status_code == 200
    assert stu2_prog.json()["completed_topic_ids"] == []

    # Student1 unmarks topic1 as completed
    uncomp_res = await client.post(
        f"/api/v1/courses/topics/{topic1_id}/complete",
        json={"is_completed": False},
        headers=headers_stu1
    )
    assert uncomp_res.status_code == 200
    assert uncomp_res.json()["is_completed"] is False
    assert topic1_id not in uncomp_res.json()["completed_topic_ids"]
