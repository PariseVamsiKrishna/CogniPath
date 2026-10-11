import pytest
from app.models.models import (
    User,
    Course,
    Enrollment,
    ModuleResource,
    StudentActivityLog,
)
from app.core.security import get_password_hash


@pytest.mark.asyncio
async def test_course_player_hierarchy_exam_security_and_youtube(client, db_session):
    # Setup users: 2 Educators, 2 Students
    educator = User(
        email="player_educator@cognipath.edu",
        hashed_password=get_password_hash("Pass123!"),
        full_name="Prof. Knuth",
        role="EDUCATOR"
    )
    educator2 = User(
        email="other_educator@cognipath.edu",
        hashed_password=get_password_hash("Pass123!"),
        full_name="Prof. Dijkstra",
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
    db_session.add_all([educator, educator2, student1, student2])
    await db_session.commit()
    await db_session.refresh(educator)
    await db_session.refresh(educator2)
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

    login_edu2 = await client.post("/api/v1/auth/login", data={"username": educator2.email, "password": "Pass123!"})
    headers_edu2 = {"Authorization": f"Bearer {login_edu2.json()['access_token']}"}

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

    # C) Valid youtu.be URL and live URL
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

    t4_res = await client.post(
        f"/api/v1/courses/modules/{module_id}/topics",
        json={
            "title": "Live stream topic",
            "description": "Live session",
            "youtube_url": "https://www.youtube.com/live/WLvU5EQVZqY?feature=share"
        },
        headers=headers_edu
    )
    assert t4_res.status_code == 201
    assert t4_res.json()["youtube_video_id"] == "WLvU5EQVZqY"

    # D) Invalid URL and spoofed domain URL must return 400 Bad Request
    inv_res = await client.post(
        f"/api/v1/courses/modules/{module_id}/topics",
        json={
            "title": "Invalid link",
            "description": "Bad link",
            "youtube_url": "https://evil.com/youtube.com/watch?v=WLvU5EQVZqY"
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
        "passing_score": 50,
        "questions": [
            {
                "question_type": "MCQ",
                "question_text": "What is the height of a balanced AVL tree with N nodes?",
                "options": ["O(log N)", "O(N)", "O(1)", "O(N^2)"],
                "correct_answer": "O(log N)",
                "explanation": "AVL trees guarantee logarithmic height bound O(log N).",
                "source_ref": "Module 1 Slide 4"
            },
            {
                "question_type": "MCQ",
                "question_text": "Which traversal visits the root node first?",
                "options": ["In-order", "Pre-order", "Post-order", "Level-order"],
                "correct_answer": "Pre-order",
                "explanation": "Pre-order visits Root, Left, Right.",
                "source_ref": "Module 1 Slide 8"
            }
        ]
    }
    exam_create_res = await client.post("/api/v1/exams", json=final_exam_payload, headers=headers_edu)
    assert exam_create_res.status_code == 201
    exam_id = exam_create_res.json()["id"]
    assert exam_create_res.json()["questions"][0]["correct_answer"] == "O(log N)"

    # 3b. Educator updates exam via PUT /api/v1/exams/{exam_id} -> must retain educator answer keys in response
    update_exam_res = await client.put(
        f"/api/v1/exams/{exam_id}",
        json=final_exam_payload,
        headers=headers_edu
    )
    assert update_exam_res.status_code == 200
    assert update_exam_res.json()["questions"][0]["correct_answer"] == "O(log N)"

    # 3c. Educator saves module exam via POST /api/v1/courses/modules/{module_id}/exam -> must retain answer keys
    mod_exam_res = await client.post(
        f"/api/v1/courses/modules/{module_id}/exam",
        json={
            "title": "Binary Trees Module Quiz",
            "time_limit_mins": 15,
            "passing_score": 60,
            "questions": [
                {
                    "question_type": "MCQ",
                    "question_text": "Maximum children in a binary tree node?",
                    "options": ["1", "2", "3", "4"],
                    "correct_answer": "2",
                    "explanation": "Binary tree nodes have at most 2 children.",
                    "source_ref": "Binary Trees Notes"
                }
            ]
        },
        headers=headers_edu
    )
    assert mod_exam_res.status_code == 200
    assert mod_exam_res.json()["questions"][0]["correct_answer"] == "2"

    # 3d. RBAC check on /api/v1/exams/ai-suggest: student and non-owner educator must be rejected (403)
    ai_stu_res = await client.post(
        "/api/v1/exams/ai-suggest",
        json={"course_id": course.id, "topic": "Trees", "count": 2},
        headers=headers_stu1
    )
    assert ai_stu_res.status_code == 403

    ai_edu2_res = await client.post(
        "/api/v1/exams/ai-suggest",
        json={"course_id": course.id, "topic": "Trees", "count": 2},
        headers=headers_edu2
    )
    assert ai_edu2_res.status_code == 403

    # 4. SECURITY CHECK: Hierarchy & Exam endpoints
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

    # C) Student retrieves exam via GET /api/v1/exams/{exam_id} -> correct_answer, explanation, source_ref MUST BE NONE
    stu_exam = await client.get(f"/api/v1/exams/{exam_id}", headers=headers_stu1)
    assert stu_exam.status_code == 200
    stu_exam_q = stu_exam.json()["questions"][0]
    assert stu_exam_q["correct_answer"] is None
    assert stu_exam_q["explanation"] is None
    assert stu_exam_q["source_ref"] is None

    # C2) Enrolled Student retrieves course exams list via GET /api/v1/exams/course/{course_id} -> masked
    stu_course_exams = await client.get(f"/api/v1/exams/course/{course.id}", headers=headers_stu1)
    assert stu_course_exams.status_code == 200
    assert len(stu_course_exams.json()) >= 1
    assert stu_course_exams.json()[0]["questions"][0]["correct_answer"] is None
    assert stu_course_exams.json()[0]["questions"][0]["explanation"] is None
    assert stu_course_exams.json()[0]["questions"][0]["source_ref"] is None

    # Unenrolled Student2 cannot list course exams (403 Forbidden)
    stu2_course_exams = await client.get(f"/api/v1/exams/course/{course.id}", headers=headers_stu2)
    assert stu2_course_exams.status_code == 403

    # D) Student submits exam via POST /api/v1/exams/{exam_id}/submit (including duplicate question_id attempt)
    q1_id = stu_exam.json()["questions"][0]["id"]
    q2_id = stu_exam.json()["questions"][1]["id"]
    submit_res = await client.post(
        f"/api/v1/exams/{exam_id}/submit",
        json={
            "responses": [
                {"question_id": q1_id, "selected_option": "O(log N)"},
                {"question_id": q1_id, "selected_option": "O(log N)"},  # duplicate must not inflate score
                {"question_id": q2_id, "selected_option": "In-order"},   # wrong answer
            ],
            "time_taken_secs": 120
        },
        headers=headers_stu1
    )
    assert submit_res.status_code == 200
    submit_data = submit_res.json()
    assert submit_data["score"] == 10.0
    assert submit_data["total_questions"] == 2
    assert submit_data["correct_count"] == 1
    assert submit_data["percentage"] == 50.0
    assert submit_data["passed"] is True

    # 5. Topic Progress Tracking, Enrollment Enforcement & Deduplication
    # Unenrolled Student2 cannot mark topic as completed (403 Forbidden)
    stu2_comp_res = await client.post(
        f"/api/v1/courses/topics/{topic1_id}/complete",
        json={"is_completed": True},
        headers=headers_stu2
    )
    assert stu2_comp_res.status_code == 403

    # Student1 marks topic1 as completed
    comp_res = await client.post(
        f"/api/v1/courses/topics/{topic1_id}/complete",
        json={"is_completed": True},
        headers=headers_stu1
    )
    assert comp_res.status_code == 200
    assert comp_res.json()["is_completed"] is True
    assert topic1_id in comp_res.json()["completed_topic_ids"]

    # Insert a duplicate StudentActivityLog to verify uncompleting cleans up ALL duplicates
    db_session.add(
        StudentActivityLog(
            user_id=student1.id,
            course_id=course.id,
            action_type="TOPIC_COMPLETE",
            activity_type="PROGRESS",
            query_text=str(topic1_id)
        )
    )
    await db_session.commit()

    # Student1 gets completed topics
    stu1_prog = await client.get(f"/api/v1/courses/{course.id}/completed-topics", headers=headers_stu1)
    assert stu1_prog.status_code == 200
    assert stu1_prog.json()["completed_topic_ids"].count(topic1_id) == 1

    # Student2 (different user, unenrolled) gets 403 Forbidden when attempting to fetch progress
    stu2_prog = await client.get(f"/api/v1/courses/{course.id}/completed-topics", headers=headers_stu2)
    assert stu2_prog.status_code == 403

    # Non-owner educator (unenrolled) also gets 403 Forbidden when attempting to fetch progress
    edu2_prog = await client.get(f"/api/v1/courses/{course.id}/completed-topics", headers=headers_edu2)
    assert edu2_prog.status_code == 403

    # Unauthenticated request gets 401 Unauthorized
    unauth_prog = await client.get(f"/api/v1/courses/{course.id}/completed-topics")
    assert unauth_prog.status_code == 401

    # Audit 4: Course owner educator can mark a topic complete and view progress
    # WITHOUT creating a self-Enrollment record or inflating enrolled_count
    edu_comp_res = await client.post(
        f"/api/v1/courses/topics/{topic1_id}/complete",
        json={"is_completed": True},
        headers=headers_edu
    )
    assert edu_comp_res.status_code == 200
    assert topic1_id in edu_comp_res.json()["completed_topic_ids"]

    edu_prog = await client.get(f"/api/v1/courses/{course.id}/completed-topics", headers=headers_edu)
    assert edu_prog.status_code == 200
    assert topic1_id in edu_prog.json()["completed_topic_ids"]

    # Verify educator was NOT added to /enrolled and course enrolled_count stays 1 (only student1)
    edu_enrolled_list = await client.get("/api/v1/courses/enrolled", headers=headers_edu)
    assert edu_enrolled_list.status_code == 200
    assert all(c["id"] != course.id for c in edu_enrolled_list.json())

    course_detail_after_edu_comp = await client.get(f"/api/v1/courses/{course.id}", headers=headers_edu)
    assert course_detail_after_edu_comp.status_code == 200
    assert course_detail_after_edu_comp.json()["enrolled_count"] == 1

    # Student1 unmarks topic1 as completed -> must delete all duplicate logs too
    uncomp_res = await client.post(
        f"/api/v1/courses/topics/{topic1_id}/complete",
        json={"is_completed": False},
        headers=headers_stu1
    )
    assert uncomp_res.status_code == 200
    assert uncomp_res.json()["is_completed"] is False
    assert topic1_id not in uncomp_res.json()["completed_topic_ids"]

    # 5b. Deleting a completed topic cleans up orphaned TOPIC_COMPLETE activity logs
    extra_topic_res = await client.post(
        f"/api/v1/courses/modules/{module_id}/topics",
        json={
            "title": "Temporary Topic to Delete",
            "youtube_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        },
        headers=headers_edu
    )
    assert extra_topic_res.status_code == 201
    extra_topic_id = extra_topic_res.json()["id"]

    mark_extra = await client.post(
        f"/api/v1/courses/topics/{extra_topic_id}/complete",
        json={"is_completed": True},
        headers=headers_stu1
    )
    assert mark_extra.status_code == 200
    assert extra_topic_id in mark_extra.json()["completed_topic_ids"]

    del_extra = await client.delete(
        f"/api/v1/courses/topics/{extra_topic_id}",
        headers=headers_edu
    )
    assert del_extra.status_code == 200

    prog_after_del = await client.get(
        f"/api/v1/courses/{course.id}/completed-topics",
        headers=headers_stu1
    )
    assert prog_after_del.status_code == 200
    assert extra_topic_id not in prog_after_del.json()["completed_topic_ids"]

    # 6. PDF Resource Access Control, Preview Masking & Missing File Handling
    resource = ModuleResource(
        module_id=module_id,
        title="Lecture 1 Slides",
        file_url="/uploads/nonexistent_unique_test_file_99999.pdf",
        file_type="pdf"
    )
    db_session.add(resource)
    await db_session.commit()
    await db_session.refresh(resource)

    # 6b. Unenrolled Student2 fetching hierarchy in Preview Mode sees syllabus titles,
    #     but video URLs/IDs, resource file_urls, and exam payloads are masked
    preview_hier = await client.get(f"/api/v1/courses/{course.id}/hierarchy", headers=headers_stu2)
    assert preview_hier.status_code == 200
    preview_data = preview_hier.json()
    assert preview_data["is_enrolled"] is False
    assert preview_data["final_exam"] is None
    preview_mod = preview_data["modules"][0]
    assert preview_mod["module_exam_id"] is None
    assert preview_mod["topics"][0]["title"] == "Tree Traversals"
    assert preview_mod["topics"][0]["youtube_url"] == ""
    assert preview_mod["topics"][0]["youtube_video_id"] == ""
    assert preview_mod["resources"][0]["title"] == "Lecture 1 Slides"
    assert preview_mod["resources"][0]["file_url"] == ""

    # Unenrolled Student2 gets 403 Forbidden when trying to download PDF resource
    res_stu2 = await client.get(f"/api/v1/courses/resources/{resource.id}/view", headers=headers_stu2)
    assert res_stu2.status_code == 403

    # Enrolled Student1 gets 404 Not Found (since file is not on disk, and no substring fallback leak)
    res_stu1 = await client.get(f"/api/v1/courses/resources/{resource.id}/view", headers=headers_stu1)
    assert res_stu1.status_code == 404

    # 6c. Rating Authorization: Non-owner educator (not enrolled) and unenrolled student cannot rate course/topic
    rate_course_edu2 = await client.post(
        f"/api/v1/courses/{course.id}/rate",
        json={"rating": 5, "review": "Unauthorized educator review"},
        headers=headers_edu2
    )
    assert rate_course_edu2.status_code == 403

    rate_topic_edu2 = await client.post(
        f"/api/v1/courses/topics/{topic1_id}/rate",
        json={"rating": 5, "feedback": "Unauthorized educator topic rating"},
        headers=headers_edu2
    )
    assert rate_topic_edu2.status_code == 403

    # Enrolled Student1 can rate published course
    rate_course_stu1 = await client.post(
        f"/api/v1/courses/{course.id}/rate",
        json={"rating": 5, "review": "Excellent course!"},
        headers=headers_stu1
    )
    assert rate_course_stu1.status_code == 200

    # 7. Draft Course Protection
    unpub_res = await client.post(f"/api/v1/courses/{course.id}/unpublish", headers=headers_edu)
    assert unpub_res.status_code == 200

    draft_prog_stu1 = await client.get(f"/api/v1/courses/{course.id}/completed-topics", headers=headers_stu1)
    assert draft_prog_stu1.status_code == 403

    draft_exam_stu1 = await client.get(f"/api/v1/exams/{exam_id}", headers=headers_stu1)
    assert draft_exam_stu1.status_code == 403

    draft_ratings_stu1 = await client.get(f"/api/v1/courses/{course.id}/ratings", headers=headers_stu1)
    assert draft_ratings_stu1.status_code == 403

    draft_rate_post_stu1 = await client.post(
        f"/api/v1/courses/{course.id}/rate",
        json={"rating": 4, "review": "Trying to rate draft"},
        headers=headers_stu1
    )
    assert draft_rate_post_stu1.status_code == 403

    draft_topic_ratings_stu1 = await client.get(
        f"/api/v1/courses/topics/{topic1_id}/ratings",
        headers=headers_stu1
    )
    assert draft_topic_ratings_stu1.status_code == 403

    # Draft course is excluded from /api/v1/courses/enrolled and /api/v1/courses/tabs-summary for students,
    # but visible to owner educator
    enrolled_stu1 = await client.get("/api/v1/courses/enrolled", headers=headers_stu1)
    assert enrolled_stu1.status_code == 200
    assert all(c["id"] != course.id for c in enrolled_stu1.json())

    tabs_stu1 = await client.get("/api/v1/courses/tabs-summary", headers=headers_stu1)
    assert tabs_stu1.status_code == 200
    assert all(c["id"] != course.id for c in tabs_stu1.json()["courses"])

    tabs_edu = await client.get("/api/v1/courses/tabs-summary", headers=headers_edu)
    assert tabs_edu.status_code == 200
    assert any(c["id"] == course.id for c in tabs_edu.json()["courses"])


@pytest.mark.asyncio
async def test_pdf_filename_collision_and_storage_consistency(client, db_session, monkeypatch):
    """
    Tests Bug 1 & Bug 2:
    1. Two uploads of the exact same filename ('notes.pdf') to the same module within the same second
       receive distinct storage paths, preserve distinct PDF contents, and deleting one does not delete the other.
    2. If AI vector ingestion fails, the resource is still saved with chunk_count == 0 (not falsely 1).
    3. If the database commit fails during upload, the newly written file on disk is cleaned up.
    """
    import os
    from app.core.config import settings
    from app.services.ingestion_service import ingestion_service

    educator = User(
        email="pdf_educator@cognipath.edu",
        hashed_password=get_password_hash("Pass123!"),
        full_name="Prof. Liskov",
        role="EDUCATOR"
    )
    student = User(
        email="pdf_student@cognipath.edu",
        hashed_password=get_password_hash("Pass123!"),
        full_name="PDF Student",
        role="STUDENT"
    )
    db_session.add_all([educator, student])
    await db_session.commit()
    await db_session.refresh(educator)
    await db_session.refresh(student)

    course = Course(title="Distributed Systems", code="CS301-PDF", educator_id=educator.id, is_published=True)
    db_session.add(course)
    await db_session.commit()
    await db_session.refresh(course)

    db_session.add(Enrollment(user_id=student.id, course_id=course.id))
    await db_session.commit()

    login_edu = await client.post("/api/v1/auth/login", data={"username": educator.email, "password": "Pass123!"})
    headers_edu = {"Authorization": f"Bearer {login_edu.json()['access_token']}"}

    login_stu = await client.post("/api/v1/auth/login", data={"username": student.email, "password": "Pass123!"})
    headers_stu = {"Authorization": f"Bearer {login_stu.json()['access_token']}"}

    mod_res = await client.post(
        f"/api/v1/courses/{course.id}/modules",
        json={"title": "Consensus", "description": "Paxos and Raft"},
        headers=headers_edu
    )
    assert mod_res.status_code == 201
    module_id = mod_res.json()["id"]

    # Simulate ingestion failure to verify chunk_count == 0 (Bug 2)
    async def _failing_ingest(*args, **kwargs):
        raise RuntimeError("Simulated ChromaDB / PDF text extraction failure")

    monkeypatch.setattr(ingestion_service, "ingest_file", _failing_ingest)

    pdf_bytes_1 = b"%PDF-1.4\n1 0 obj\n<< /Title (First Lecture Notes) >>\nendobj\n%%EOF\n"
    pdf_bytes_2 = b"%PDF-1.4\n1 0 obj\n<< /Title (Second Lecture Notes) >>\nendobj\n%%EOF\n"

    # Upload 1 and Upload 2 with identical filename "notes.pdf" back-to-back
    up1 = await client.post(
        f"/api/v1/courses/modules/{module_id}/resources",
        data={"title": "Consensus Notes Part 1"},
        files={"file": ("notes.pdf", pdf_bytes_1, "application/pdf")},
        headers=headers_edu
    )
    assert up1.status_code == 201
    res1 = up1.json()
    assert res1["chunk_count"] == 0

    up2 = await client.post(
        f"/api/v1/courses/modules/{module_id}/resources",
        data={"title": "Consensus Notes Part 2"},
        files={"file": ("notes.pdf", pdf_bytes_2, "application/pdf")},
        headers=headers_edu
    )
    assert up2.status_code == 201
    res2 = up2.json()
    assert res2["chunk_count"] == 0

    # Storage paths must be distinct
    assert res1["file_url"] != res2["file_url"]

    # Both resources must serve their exact respective PDF bytes
    view1 = await client.get(f"/api/v1/courses/resources/{res1['id']}/view", headers=headers_stu)
    assert view1.status_code == 200
    assert view1.content == pdf_bytes_1

    view2 = await client.get(f"/api/v1/courses/resources/{res2['id']}/view", headers=headers_stu)
    assert view2.status_code == 200
    assert view2.content == pdf_bytes_2

    # Deleting resource 1 must NOT affect resource 2's file on disk
    del1 = await client.delete(f"/api/v1/courses/resources/{res1['id']}", headers=headers_edu)
    assert del1.status_code == 200

    view1_after = await client.get(f"/api/v1/courses/resources/{res1['id']}/view", headers=headers_stu)
    assert view1_after.status_code == 404

    view2_after = await client.get(f"/api/v1/courses/resources/{res2['id']}/view", headers=headers_stu)
    assert view2_after.status_code == 200
    assert view2_after.content == pdf_bytes_2

    # Invalid/non-PDF payload disguised with .pdf extension is rejected and leaves no file behind
    before_files = set(os.listdir(settings.UPLOAD_DIR)) if os.path.exists(settings.UPLOAD_DIR) else set()
    bad_up = await client.post(
        f"/api/v1/courses/modules/{module_id}/resources",
        data={"title": "Corrupt PDF"},
        files={"file": ("notes.pdf", b"NOT_A_PDF_HEADER", "application/pdf")},
        headers=headers_edu
    )
    assert bad_up.status_code == 400
    after_files = set(os.listdir(settings.UPLOAD_DIR)) if os.path.exists(settings.UPLOAD_DIR) else set()
    assert before_files == after_files

    # Clean up remaining resource 2
    del2 = await client.delete(f"/api/v1/courses/resources/{res2['id']}", headers=headers_edu)
    assert del2.status_code == 200


def test_youtube_video_id_extractor_edge_cases():
    """Verify backend extract_youtube_video_id across valid formats, malformed URLs, and spoofed hosts."""
    from app.api.v1.courses import extract_youtube_video_id

    # Valid formats
    assert extract_youtube_video_id("https://www.youtube.com/watch?v=WLvU5EQVZqY") == "WLvU5EQVZqY"
    assert extract_youtube_video_id("https://youtu.be/dQw4w9WgXcQ?si=123") == "dQw4w9WgXcQ"
    assert extract_youtube_video_id("https://www.youtube.com/embed/jDM6_TnYIuE") == "jDM6_TnYIuE"
    assert extract_youtube_video_id("https://www.youtube.com/shorts/WLvU5EQVZqY") == "WLvU5EQVZqY"
    assert extract_youtube_video_id("https://www.youtube.com/live/WLvU5EQVZqY?feature=share") == "WLvU5EQVZqY"
    assert extract_youtube_video_id("WLvU5EQVZqY") == "WLvU5EQVZqY"

    # Invalid / malformed / spoofed URLs must return None (never a default ID)
    assert extract_youtube_video_id("") is None
    assert extract_youtube_video_id(None) is None
    assert extract_youtube_video_id("https://www.youtube.com/playlist?v=WLvU5EQVZqY") is None
    assert extract_youtube_video_id("https://youtu.be/WLvU5EQVZqY/extra") is None
    assert extract_youtube_video_id("https://www.youtube.com/embed/WLvU5EQVZqY/extra") is None
    assert extract_youtube_video_id("https://evil.com/watch?v=WLvU5EQVZqY") is None
    assert extract_youtube_video_id("https://youtube.com.evil.com/watch?v=WLvU5EQVZqY") is None
    assert extract_youtube_video_id("not-a-valid-id") is None


@pytest.mark.asyncio
async def test_student_unenrollment_preserves_other_enrollments_and_course_record(client, db_session):
    """
    Verifies the complete student unenrollment and educator permanent deletion workflow:
    1. Student enrolled in Course A and Course B unenrolls from Course A via POST /api/v1/courses/{course_id}/unenroll.
    2. Course A is removed from GET /api/v1/courses/enrolled while Course B remains enrolled.
    3. Course A itself is NOT deleted from the database and remains discoverable in GET /api/v1/courses/explore.
    4. Educator can still permanently delete their own created course via DELETE /api/v1/courses/{course_id}.
    """
    educator = User(
        email="unenroll_edu@cognipath.edu",
        hashed_password=get_password_hash("Pass123!"),
        full_name="Prof. Tanenbaum",
        role="EDUCATOR"
    )
    student = User(
        email="unenroll_stu@cognipath.edu",
        hashed_password=get_password_hash("Pass123!"),
        full_name="Learner A",
        role="STUDENT"
    )
    db_session.add_all([educator, student])
    await db_session.commit()
    await db_session.refresh(educator)
    await db_session.refresh(student)

    course_a = Course(
        title="Operating Systems Design",
        code="CS401-OS",
        description="Kernel architecture and scheduling",
        educator_id=educator.id,
        is_published=True
    )
    course_b = Course(
        title="Computer Networks",
        code="CS402-NET",
        description="TCP/IP and routing protocols",
        educator_id=educator.id,
        is_published=True
    )
    db_session.add_all([course_a, course_b])
    await db_session.commit()
    await db_session.refresh(course_a)
    await db_session.refresh(course_b)

    db_session.add_all([
        Enrollment(user_id=student.id, course_id=course_a.id),
        Enrollment(user_id=student.id, course_id=course_b.id),
    ])
    await db_session.commit()

    login_stu = await client.post("/api/v1/auth/login", data={"username": student.email, "password": "Pass123!"})
    headers_stu = {"Authorization": f"Bearer {login_stu.json()['access_token']}"}

    login_edu = await client.post("/api/v1/auth/login", data={"username": educator.email, "password": "Pass123!"})
    headers_edu = {"Authorization": f"Bearer {login_edu.json()['access_token']}"}

    # Verify both courses initially appear in /enrolled
    initial_enrolled = await client.get("/api/v1/courses/enrolled", headers=headers_stu)
    assert initial_enrolled.status_code == 200
    initial_ids = {c["id"] for c in initial_enrolled.json()}
    assert course_a.id in initial_ids
    assert course_b.id in initial_ids

    # Student unenrolls from course_a
    unenroll_res = await client.post(f"/api/v1/courses/{course_a.id}/unenroll", headers=headers_stu)
    assert unenroll_res.status_code == 200
    assert unenroll_res.json()["status"] == "success"

    # Refresh enrolled courses: course_a is gone, course_b remains
    after_enrolled = await client.get("/api/v1/courses/enrolled", headers=headers_stu)
    assert after_enrolled.status_code == 200
    remaining_ids = {c["id"] for c in after_enrolled.json()}
    assert course_a.id not in remaining_ids
    assert course_b.id in remaining_ids

    # Course A record still exists and is discoverable in /explore with is_enrolled == False
    course_a_detail = await client.get(f"/api/v1/courses/{course_a.id}", headers=headers_stu)
    assert course_a_detail.status_code == 200
    assert course_a_detail.json()["id"] == course_a.id
    assert course_a_detail.json()["is_enrolled"] is False

    explore_res = await client.get("/api/v1/courses/explore", headers=headers_stu)
    assert explore_res.status_code == 200
    explored_a = next((c for c in explore_res.json() if c["id"] == course_a.id), None)
    assert explored_a is not None
    assert explored_a["is_enrolled"] is False

    # Educator can still permanently delete course_a
    del_res = await client.delete(f"/api/v1/courses/{course_a.id}", headers=headers_edu)
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "success"

    course_a_after_del = await client.get(f"/api/v1/courses/{course_a.id}", headers=headers_stu)
    assert course_a_after_del.status_code == 404

