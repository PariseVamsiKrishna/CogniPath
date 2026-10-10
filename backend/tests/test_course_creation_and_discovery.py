import pytest
from app.models.models import (
    User, Course, Module, Topic, Enrollment, Exam, ExamQuestion,
    ExamSubmission, Assignment, AssignmentSubmission, CommunityChannel,
    CommunityMessage, LearningPod, PodMessage, PodBlacklist, StudentBadge,
    CourseRating, TopicRating, ModuleResource, Document,
    StudentConceptRetention, StudentActivityLog, StudentSkillMastery,
    CurriculumAuditReport
)
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

@pytest.mark.asyncio
async def test_delete_course_lifecycle(client, db_session):
    # Educator A
    educator_a = User(
        email="prof_del_a@cognipath.edu",
        full_name="Prof. Delete Owner",
        hashed_password="hashedpassword123",
        role="EDUCATOR"
    )
    # Educator B
    educator_b = User(
        email="prof_del_b@cognipath.edu",
        full_name="Prof. Delete Intruder",
        hashed_password="hashedpassword123",
        role="EDUCATOR"
    )
    db_session.add_all([educator_a, educator_b])
    await db_session.commit()
    await db_session.refresh(educator_a)
    await db_session.refresh(educator_b)

    token_a = create_access_token_for_user(educator_a.id, role="EDUCATOR")
    token_b = create_access_token_for_user(educator_b.id, role="EDUCATOR")
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # 1. Educator A creates a course with modules and topics
    create_resp = await client.post("/api/v1/courses", json={
        "title": "Quantum Computing 101",
        "code": "QC101",
        "category": "Computer Science",
        "modules": [
            {
                "title": "Qubits and Superposition",
                "topics": [
                    {
                        "title": "Bloch Sphere",
                        "youtube_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                    }
                ]
            }
        ]
    }, headers=headers_a)
    assert create_resp.status_code == 201
    course_id = create_resp.json()["id"]

    # 2. Educator B attempts to delete Educator A's course -> 403 Forbidden
    del_resp_b = await client.delete(f"/api/v1/courses/{course_id}", headers=headers_b)
    assert del_resp_b.status_code == 403

    # 3. Nonexistent course deletion -> 404
    del_resp_none = await client.delete("/api/v1/courses/999999", headers=headers_a)
    assert del_resp_none.status_code == 404

    # 4. Educator A deletes own course -> 200 OK
    del_resp_a = await client.delete(f"/api/v1/courses/{course_id}", headers=headers_a)
    assert del_resp_a.status_code == 200, del_resp_a.text

    # 5. Course no longer exists
    get_resp = await client.get(f"/api/v1/courses/{course_id}", headers=headers_a)
    assert get_resp.status_code == 404

    # 6. Course does not appear in my-courses
    my_resp = await client.get("/api/v1/courses/my-courses", headers=headers_a)
    assert my_resp.status_code == 200
    assert not any(c["id"] == course_id for c in my_resp.json())

@pytest.mark.asyncio
async def test_delete_course_with_full_dependencies(client, db_session):
    # Educator and Student
    educator = User(
        email="prof_dep_del@cognipath.edu",
        full_name="Prof. Deep Dependency",
        hashed_password="hashedpassword123",
        role="EDUCATOR"
    )
    student = User(
        email="student_dep@cognipath.edu",
        full_name="Student Dep Test",
        hashed_password="hashedpassword123",
        role="STUDENT"
    )
    db_session.add_all([educator, student])
    await db_session.commit()
    await db_session.refresh(educator)
    await db_session.refresh(student)

    token_ed = create_access_token_for_user(educator.id, role="EDUCATOR")
    headers_ed = {"Authorization": f"Bearer {token_ed}"}

    # Create Course
    course = Course(
        title="Complex Systems Architecture",
        code="CSA701",
        category="Computer Science",
        educator_id=educator.id
    )
    db_session.add(course)
    await db_session.commit()
    await db_session.refresh(course)

    # 1. Module & Topic
    module = Module(course_id=course.id, title="Module 1: Foundations", order_index=1)
    db_session.add(module)
    await db_session.commit()
    await db_session.refresh(module)

    topic = Topic(
        module_id=module.id,
        title="Topic 1: Intro",
        youtube_url="https://youtube.com/watch?v=dQw4w9WgXcQ",
        youtube_video_id="dQw4w9WgXcQ",
        order_index=1
    )
    db_session.add(topic)
    await db_session.commit()
    await db_session.refresh(topic)

    # 2. Topic Rating
    topic_rating = TopicRating(topic_id=topic.id, user_id=student.id, rating=5, feedback="Great topic")
    db_session.add(topic_rating)

    # 3. Module Resource
    resource = ModuleResource(module_id=module.id, title="Slides.pdf", file_url="/docs/slides.pdf")
    db_session.add(resource)

    # 4. Exam & circular module_exam_id
    exam = Exam(course_id=course.id, module_id=module.id, title="Module 1 Quiz", exam_type="MODULE_QUIZ")
    db_session.add(exam)
    await db_session.commit()
    await db_session.refresh(exam)
    module.module_exam_id = exam.id

    exam_q = ExamQuestion(exam_id=exam.id, question_text="What is 1+1?", correct_answer="2")
    exam_sub = ExamSubmission(exam_id=exam.id, student_id=student.id, score=100.0, percentage=100.0, responses_json="[]")
    db_session.add_all([exam_q, exam_sub])

    # 5. Assignment & Submission
    assignment = Assignment(module_id=module.id, title="Lab 1", description="Build something", rubric_json="[]")
    db_session.add(assignment)
    await db_session.commit()
    await db_session.refresh(assignment)
    sub = AssignmentSubmission(assignment_id=assignment.id, student_id=student.id, status="PENDING")
    db_session.add(sub)

    # 6. Community Channel & Message
    ch = CommunityChannel(course_id=course.id, name="announcements", description="Announcements")
    db_session.add(ch)
    await db_session.commit()
    await db_session.refresh(ch)
    msg = CommunityMessage(channel_id=ch.id, user_id=educator.id, author_name="Prof", content="Welcome!")
    db_session.add(msg)

    # 7. Learning Pod, Message & Blacklist
    pod = LearningPod(course_id=course.id, host_id=educator.id, title="Study Pod", topic="AI")
    db_session.add(pod)
    await db_session.commit()
    await db_session.refresh(pod)
    p_msg = PodMessage(pod_id=pod.id, user_id=educator.id, sender_name="Prof", content="Hello")
    p_bl = PodBlacklist(pod_id=pod.id, user_id=student.id, kicked_by=educator.id)
    db_session.add_all([p_msg, p_bl])

    # 8. Enrollment, Document, Badge, Rating, Retention, Activity, Mastery, Audit
    enrollment = Enrollment(course_id=course.id, user_id=student.id)
    doc = Document(course_id=course.id, title="Doc 1", file_path="/fake/path", file_type="pdf", uploaded_by=educator.id)
    badge = StudentBadge(course_id=course.id, student_id=student.id, badge_name="Explorer", verification_hash="hash123456789")
    course_rating = CourseRating(course_id=course.id, user_id=student.id, rating=5.0)
    retention = StudentConceptRetention(course_id=course.id, user_id=student.id, concept_tag="Architecture")
    activity = StudentActivityLog(course_id=course.id, user_id=student.id, action_type="VIEW_DOC")
    mastery = StudentSkillMastery(course_id=course.id, user_id=student.id, topic="Architecture")
    audit = CurriculumAuditReport(course_id=course.id)
    db_session.add_all([enrollment, doc, badge, course_rating, retention, activity, mastery, audit])
    await db_session.commit()

    # Now attempt to permanently delete the course
    del_resp = await client.delete(f"/api/v1/courses/{course.id}", headers=headers_ed)
    assert del_resp.status_code == 200, del_resp.text
    data = del_resp.json()
    assert data["status"] == "success"

    # Verify course is completely gone
    get_resp = await client.get(f"/api/v1/courses/{course.id}", headers=headers_ed)
    assert get_resp.status_code == 404



