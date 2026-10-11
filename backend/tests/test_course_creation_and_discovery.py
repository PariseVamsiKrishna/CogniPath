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


def _sample_valid_modules():
    return [
        {
            "title": "Module 1: Core Foundations",
            "description": "Foundational theory and systems architecture.",
            "topics": [
                {
                    "title": "Lecture 1: Introduction",
                    "description": "Walkthrough of core concepts.",
                    "youtube_url": "https://www.youtube.com/watch?v=qH6clASSS54"
                }
            ]
        }
    ]


@pytest.mark.asyncio
async def test_atomic_course_creation(client, db_session):
    educator = User(
        email="prof_atomic@cognipath.edu",
        full_name="Prof. Atomic Test",
        university="IIT Bombay",
        department="Computer Science & Engineering (CSE)",
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
        "category": "Computer Science & Engineering (CSE)",
        "target_branch": "Computer Science & Engineering (CSE)",
        "difficulty": "Hard",
        "description": "Lexical analysis, parsing, ASTs, and LLVM backend.",
        "is_published": True,
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
                        "youtube_url": "https://youtu.be/qH6clASSS54"
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
                        "youtube_url": "https://www.youtube.com/embed/aircAruvnKk"
                    }
                ]
            }
        ]
    }

    resp = await client.post("/api/v1/courses", json=payload, headers=headers)
    assert resp.status_code == 201, resp.text
    data = resp.json()
    course_id = data["id"]
    assert data["title"] == "Compiler Design & Code Generation"
    assert data["code"] == "CD401"
    assert data["difficulty"] == "Hard"
    assert data["target_branch"] == "Computer Science & Engineering (CSE)"
    assert data["educator_email"] == "prof_atomic@cognipath.edu"
    assert data["university"] == "IIT Bombay"
    assert data["modules_count"] == 2
    assert data["topics_count"] == 3
    assert data["average_rating"] == 0.0
    assert data["total_ratings"] == 0

    hier_resp = await client.get(f"/api/v1/courses/{course_id}/hierarchy", headers=headers)
    assert hier_resp.status_code == 200
    hier_data = hier_resp.json()
    assert len(hier_data["modules"]) == 2
    assert hier_data["modules"][0]["title"] == "Module 1: Lexing and Parsing"
    assert len(hier_data["modules"][0]["topics"]) == 2
    assert hier_data["modules"][0]["topics"][1]["youtube_video_id"] == "qH6clASSS54"
    assert hier_data["modules"][1]["title"] == "Module 2: Code Generation"
    assert len(hier_data["modules"][1]["topics"]) == 1
    assert hier_data["modules"][1]["topics"][0]["youtube_video_id"] == "aircAruvnKk"


@pytest.mark.asyncio
async def test_course_creation_validation_rules(client, db_session):
    educator = User(
        email="prof_val@cognipath.edu",
        full_name="Prof. Validation",
        hashed_password="hashedpassword123",
        role="EDUCATOR"
    )
    student = User(
        email="stu_val@cognipath.edu",
        full_name="Student NoCreate",
        hashed_password="hashedpassword123",
        role="STUDENT"
    )
    db_session.add_all([educator, student])
    await db_session.commit()
    await db_session.refresh(educator)
    await db_session.refresh(student)

    ed_headers = {"Authorization": f"Bearer {create_access_token_for_user(educator.id, role='EDUCATOR')}"}
    stu_headers = {"Authorization": f"Bearer {create_access_token_for_user(student.id, role='STUDENT')}"}

    # 1. Student cannot create a course -> 403
    stu_resp = await client.post("/api/v1/courses", json={
        "title": "Unauthorized Course",
        "description": "Should fail",
        "difficulty": "Easy",
        "target_branch": "Computer Science & Engineering (CSE)",
        "modules": _sample_valid_modules()
    }, headers=stu_headers)
    assert stu_resp.status_code == 403

    # 2. Missing description -> 400
    no_desc = await client.post("/api/v1/courses", json={
        "title": "No Description Course",
        "description": "   ",
        "difficulty": "Easy",
        "target_branch": "Computer Science & Engineering (CSE)",
        "modules": _sample_valid_modules()
    }, headers=ed_headers)
    assert no_desc.status_code == 400

    # 3. Missing module -> 400
    no_mods = await client.post("/api/v1/courses", json={
        "title": "No Modules Course",
        "description": "Valid description",
        "difficulty": "Medium",
        "target_branch": "Computer Science & Engineering (CSE)",
        "modules": []
    }, headers=ed_headers)
    assert no_mods.status_code == 400

    # 4. Module without topics -> 400
    no_topics = await client.post("/api/v1/courses", json={
        "title": "Empty Module Course",
        "description": "Valid description",
        "difficulty": "Medium",
        "target_branch": "Computer Science & Engineering (CSE)",
        "modules": [{"title": "Module 1", "topics": []}]
    }, headers=ed_headers)
    assert no_topics.status_code == 400

    # 5. Invalid YouTube URL -> 400 (never substitutes default video ID)
    bad_yt = await client.post("/api/v1/courses", json={
        "title": "Bad YouTube Course",
        "description": "Valid description",
        "difficulty": "Hard",
        "target_branch": "Computer Science & Engineering (CSE)",
        "modules": [
            {
                "title": "Module 1",
                "topics": [
                    {
                        "title": "Topic 1",
                        "youtube_url": "https://example.com/not-a-youtube-link"
                    }
                ]
            }
        ]
    }, headers=ed_headers)
    assert bad_yt.status_code == 400


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
        "description": "Process scheduling and virtual memory.",
        "category": "Computer Science",
        "difficulty": "Medium",
        "modules": _sample_valid_modules()
    }
    resp1 = await client.post("/api/v1/courses", json=payload1, headers=headers)
    assert resp1.status_code == 201, resp1.text

    payload2 = {
        "title": "Operating Systems Part 2",
        "code": "OS201",
        "description": "File systems and distributed kernels.",
        "category": "Computer Science",
        "difficulty": "Hard",
        "modules": _sample_valid_modules()
    }
    resp2 = await client.post("/api/v1/courses", json=payload2, headers=headers)
    assert resp2.status_code == 201, resp2.text
    data2 = resp2.json()
    assert data2["code"].startswith("OS201-")


@pytest.mark.asyncio
async def test_explore_courses_null_safety(client, db_session):
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
        is_published=True,
        educator_id=educator.id
    )
    db_session.add(course)
    await db_session.commit()

    resp = await client.get("/api/v1/courses/explore?q=minimal&category=All")
    assert resp.status_code == 200
    items = resp.json()
    assert any(c["code"] == "MIN101" for c in items)

    resp_filtered = await client.get("/api/v1/courses/explore?category=Web%20Development")
    assert resp_filtered.status_code == 200


@pytest.mark.asyncio
async def test_educator_my_courses_retrieval_and_isolation(client, db_session):
    educator_1 = User(
        email="prof_mine@cognipath.edu",
        full_name="Prof. Mine Test",
        university="IIT Madras",
        hashed_password="hashedpassword123",
        role="EDUCATOR"
    )
    educator_2 = User(
        email="prof_other@cognipath.edu",
        full_name="Prof. Other Test",
        university="NIT Trichy",
        hashed_password="hashedpassword123",
        role="EDUCATOR"
    )
    db_session.add_all([educator_1, educator_2])
    await db_session.commit()
    await db_session.refresh(educator_1)
    await db_session.refresh(educator_2)

    headers_1 = {"Authorization": f"Bearer {create_access_token_for_user(educator_1.id, role='EDUCATOR')}"}
    headers_2 = {"Authorization": f"Bearer {create_access_token_for_user(educator_2.id, role='EDUCATOR')}"}

    resp = await client.post("/api/v1/courses", json={
        "title": "Distributed Systems",
        "code": "DS501",
        "description": "Consensus, Raft, Paxos, and replication.",
        "category": "Computer Science",
        "difficulty": "Hard",
        "modules": _sample_valid_modules()
    }, headers=headers_1)
    assert resp.status_code == 201, resp.text

    # Educator 1 sees DS501 in /courses/my-courses
    my_resp_1 = await client.get("/api/v1/courses/my-courses", headers=headers_1)
    assert my_resp_1.status_code == 200
    my_courses_1 = my_resp_1.json()
    assert any(c["code"] == "DS501" for c in my_courses_1)
    assert all(c["educator_id"] == educator_1.id for c in my_courses_1)

    # Educator 1 does NOT see DS501 in /courses/enrolled because they haven't enrolled as a student
    enr_resp_1 = await client.get("/api/v1/courses/enrolled", headers=headers_1)
    assert enr_resp_1.status_code == 200
    assert not any(c["code"] == "DS501" for c in enr_resp_1.json())

    # Educator 2 does NOT see Educator 1's course in /courses/my-courses
    my_resp_2 = await client.get("/api/v1/courses/my-courses", headers=headers_2)
    assert my_resp_2.status_code == 200
    assert not any(c["code"] == "DS501" for c in my_resp_2.json())


@pytest.mark.asyncio
async def test_module_and_topic_crud_and_ownership(client, db_session):
    owner = User(
        email="owner_crud@cognipath.edu",
        full_name="Prof. Owner",
        hashed_password="hashedpassword123",
        role="EDUCATOR"
    )
    intruder = User(
        email="intruder_crud@cognipath.edu",
        full_name="Prof. Intruder",
        hashed_password="hashedpassword123",
        role="EDUCATOR"
    )
    db_session.add_all([owner, intruder])
    await db_session.commit()
    await db_session.refresh(owner)
    await db_session.refresh(intruder)

    owner_headers = {"Authorization": f"Bearer {create_access_token_for_user(owner.id, role='EDUCATOR')}"}
    intruder_headers = {"Authorization": f"Bearer {create_access_token_for_user(intruder.id, role='EDUCATOR')}"}

    create_resp = await client.post("/api/v1/courses", json={
        "title": "Cloud Native Engineering",
        "description": "Kubernetes, service meshes, and observability.",
        "difficulty": "Medium",
        "target_branch": "Computer Science & Engineering (CSE)",
        "modules": _sample_valid_modules()
    }, headers=owner_headers)
    assert create_resp.status_code == 201
    course_id = create_resp.json()["id"]

    # Intruder cannot add a module -> 403
    bad_mod = await client.post(f"/api/v1/courses/{course_id}/modules", json={
        "title": "Intruder Module"
    }, headers=intruder_headers)
    assert bad_mod.status_code == 403

    # Owner adds Module 2
    mod2_resp = await client.post(f"/api/v1/courses/{course_id}/modules", json={
        "title": "Module 2: Kubernetes Internals",
        "description": "Control plane and kubelet."
    }, headers=owner_headers)
    assert mod2_resp.status_code == 201
    mod2_id = mod2_resp.json()["id"]

    # Owner updates Module 2
    upd_mod_resp = await client.put(f"/api/v1/courses/modules/{mod2_id}", json={
        "title": "Module 2: Kubernetes & Containers"
    }, headers=owner_headers)
    assert upd_mod_resp.status_code == 200
    assert upd_mod_resp.json()["title"] == "Module 2: Kubernetes & Containers"

    # Owner adds Topic with invalid YouTube URL -> 400
    bad_top = await client.post(f"/api/v1/courses/modules/{mod2_id}/topics", json={
        "title": "Bad Video Topic",
        "youtube_url": "not-a-valid-url"
    }, headers=owner_headers)
    assert bad_top.status_code == 400

    # Owner adds Topic with valid YouTube Shorts URL -> 201
    top_resp = await client.post(f"/api/v1/courses/modules/{mod2_id}/topics", json={
        "title": "Pod Lifecycle",
        "description": "Init containers and probes.",
        "youtube_url": "https://www.youtube.com/shorts/IHZwWFHWa-w"
    }, headers=owner_headers)
    assert top_resp.status_code == 201
    top_data = top_resp.json()
    assert top_data["youtube_video_id"] == "IHZwWFHWa-w"
    topic_id = top_data["id"]

    # Owner updates Topic
    upd_top = await client.put(f"/api/v1/courses/topics/{topic_id}", json={
        "title": "Pod Lifecycle & Probes",
        "youtube_url": "https://youtu.be/aircAruvnKk"
    }, headers=owner_headers)
    assert upd_top.status_code == 200
    assert upd_top.json()["youtube_video_id"] == "aircAruvnKk"

    # Intruder cannot delete Topic -> 403
    intruder_del = await client.delete(f"/api/v1/courses/topics/{topic_id}", headers=intruder_headers)
    assert intruder_del.status_code == 403

    # Owner deletes Topic and Module 2
    del_top = await client.delete(f"/api/v1/courses/topics/{topic_id}", headers=owner_headers)
    assert del_top.status_code == 200
    del_mod = await client.delete(f"/api/v1/courses/modules/{mod2_id}", headers=owner_headers)
    assert del_mod.status_code == 200


@pytest.mark.asyncio
async def test_draft_vs_published_and_enrollment_workflow(client, db_session):
    educator = User(
        email="prof_pub@cognipath.edu",
        full_name="Prof. Publisher",
        university="IISc Bangalore",
        hashed_password="hashedpassword123",
        role="EDUCATOR"
    )
    student = User(
        email="stu_enroll@cognipath.edu",
        full_name="Student Enroller",
        university="BITS Pilani",
        hashed_password="hashedpassword123",
        role="STUDENT"
    )
    db_session.add_all([educator, student])
    await db_session.commit()
    await db_session.refresh(educator)
    await db_session.refresh(student)

    ed_headers = {"Authorization": f"Bearer {create_access_token_for_user(educator.id, role='EDUCATOR')}"}
    stu_headers = {"Authorization": f"Bearer {create_access_token_for_user(student.id, role='STUDENT')}"}

    # Student starts with 0 enrolled courses
    init_enr = await client.get("/api/v1/courses/enrolled", headers=stu_headers)
    assert init_enr.status_code == 200
    assert init_enr.json() == []

    # Educator creates a DRAFT course
    draft_resp = await client.post("/api/v1/courses", json={
        "title": "Draft Neural Networks Course",
        "code": "DNN101",
        "description": "Draft syllabus not yet visible to students.",
        "difficulty": "Hard",
        "target_branch": "Artificial Intelligence & Machine Learning (AI/ML)",
        "is_published": False,
        "modules": _sample_valid_modules()
    }, headers=ed_headers)
    assert draft_resp.status_code == 201
    draft_id = draft_resp.json()["id"]
    assert draft_resp.json()["is_published"] is False

    # Draft course does NOT appear in student's /courses/explore
    exp_draft = await client.get("/api/v1/courses/explore", headers=stu_headers)
    assert exp_draft.status_code == 200
    assert not any(c["id"] == draft_id for c in exp_draft.json())

    # Student cannot enroll in or view hierarchy of draft course -> 403
    enr_draft = await client.post(f"/api/v1/courses/{draft_id}/enroll", headers=stu_headers)
    assert enr_draft.status_code == 403
    hier_draft = await client.get(f"/api/v1/courses/{draft_id}/hierarchy", headers=stu_headers)
    assert hier_draft.status_code == 403

    # Educator publishes the course
    pub_resp = await client.post(f"/api/v1/courses/{draft_id}/publish", headers=ed_headers)
    assert pub_resp.status_code == 200
    assert pub_resp.json()["is_published"] is True

    # Now course appears in student's /courses/explore with educator name & university
    exp_pub = await client.get("/api/v1/courses/explore", headers=stu_headers)
    assert exp_pub.status_code == 200
    found = next((c for c in exp_pub.json() if c["id"] == draft_id), None)
    assert found is not None
    assert found["educator_name"] == "Prof. Publisher"
    assert found["university"] == "IISc Bangalore"
    assert found["average_rating"] == 0.0

    # Student can view hierarchy without being auto-enrolled
    hier_pub = await client.get(f"/api/v1/courses/{draft_id}/hierarchy", headers=stu_headers)
    assert hier_pub.status_code == 200
    assert hier_pub.json()["is_enrolled"] is False

    # Student enrolls in course
    enr_ok = await client.post(f"/api/v1/courses/{draft_id}/enroll", headers=stu_headers)
    assert enr_ok.status_code == 200
    assert enr_ok.json()["status"] == "success"

    # Duplicate enrollment returns already_enrolled
    enr_dup = await client.post(f"/api/v1/courses/{draft_id}/enroll", headers=stu_headers)
    assert enr_dup.status_code == 200
    assert enr_dup.json()["status"] == "already_enrolled"

    # Course now appears in student's /courses/enrolled
    stu_enrolled = await client.get("/api/v1/courses/enrolled", headers=stu_headers)
    assert stu_enrolled.status_code == 200
    assert any(c["id"] == draft_id for c in stu_enrolled.json())

    # Enrolled course is now excluded from student's /courses/explore
    exp_after = await client.get("/api/v1/courses/explore", headers=stu_headers)
    assert exp_after.status_code == 200
    assert not any(c["id"] == draft_id for c in exp_after.json())


@pytest.mark.asyncio
async def test_health_and_readiness_endpoints(client):
    resp1 = await client.get("/health")
    assert resp1.status_code == 200
    assert resp1.json()["status"] == "healthy"

    resp2 = await client.get("/api/v1/health")
    assert resp2.status_code == 200
    assert resp2.json()["status"] == "healthy"

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
    educator_a = User(
        email="prof_del_a@cognipath.edu",
        full_name="Prof. Delete Owner",
        hashed_password="hashedpassword123",
        role="EDUCATOR"
    )
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

    create_resp = await client.post("/api/v1/courses", json={
        "title": "Quantum Computing 101",
        "code": "QC101",
        "description": "Quantum gates, superposition, and Shor's algorithm.",
        "category": "Computer Science",
        "difficulty": "Hard",
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

    del_resp_b = await client.delete(f"/api/v1/courses/{course_id}", headers=headers_b)
    assert del_resp_b.status_code == 403

    del_resp_none = await client.delete("/api/v1/courses/999999", headers=headers_a)
    assert del_resp_none.status_code == 404

    del_resp_a = await client.delete(f"/api/v1/courses/{course_id}", headers=headers_a)
    assert del_resp_a.status_code == 200, del_resp_a.text

    get_resp = await client.get(f"/api/v1/courses/{course_id}", headers=headers_a)
    assert get_resp.status_code == 404

    my_resp = await client.get("/api/v1/courses/my-courses", headers=headers_a)
    assert my_resp.status_code == 200
    assert not any(c["id"] == course_id for c in my_resp.json())


@pytest.mark.asyncio
async def test_delete_course_with_full_dependencies(client, db_session):
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

    course = Course(
        title="Complex Systems Architecture",
        code="CSA701",
        category="Computer Science",
        educator_id=educator.id
    )
    db_session.add(course)
    await db_session.commit()
    await db_session.refresh(course)

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

    topic_rating = TopicRating(topic_id=topic.id, user_id=student.id, rating=5, feedback="Great topic")
    db_session.add(topic_rating)

    resource = ModuleResource(module_id=module.id, title="Slides.pdf", file_url="/docs/slides.pdf")
    db_session.add(resource)

    exam = Exam(course_id=course.id, module_id=module.id, title="Module 1 Quiz", exam_type="MODULE_QUIZ")
    db_session.add(exam)
    await db_session.commit()
    await db_session.refresh(exam)
    module.module_exam_id = exam.id

    exam_q = ExamQuestion(exam_id=exam.id, question_text="What is 1+1?", correct_answer="2")
    exam_sub = ExamSubmission(exam_id=exam.id, student_id=student.id, score=100.0, percentage=100.0, responses_json="[]")
    db_session.add_all([exam_q, exam_sub])

    assignment = Assignment(module_id=module.id, title="Lab 1", description="Build something", rubric_json="[]")
    db_session.add(assignment)
    await db_session.commit()
    await db_session.refresh(assignment)
    sub = AssignmentSubmission(assignment_id=assignment.id, student_id=student.id, status="PENDING")
    db_session.add(sub)

    ch = CommunityChannel(course_id=course.id, name="announcements", description="Announcements")
    db_session.add(ch)
    await db_session.commit()
    await db_session.refresh(ch)
    msg = CommunityMessage(channel_id=ch.id, user_id=educator.id, author_name="Prof", content="Welcome!")
    db_session.add(msg)

    pod = LearningPod(course_id=course.id, host_id=educator.id, title="Study Pod", topic="AI")
    db_session.add(pod)
    await db_session.commit()
    await db_session.refresh(pod)
    p_msg = PodMessage(pod_id=pod.id, user_id=educator.id, sender_name="Prof", content="Hello")
    p_bl = PodBlacklist(pod_id=pod.id, user_id=student.id, kicked_by=educator.id)
    db_session.add_all([p_msg, p_bl])

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

    del_resp = await client.delete(f"/api/v1/courses/{course.id}", headers=headers_ed)
    assert del_resp.status_code == 200, del_resp.text
    data = del_resp.json()
    assert data["status"] == "success"

    get_resp = await client.get(f"/api/v1/courses/{course.id}", headers=headers_ed)
    assert get_resp.status_code == 404
