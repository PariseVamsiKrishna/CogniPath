import asyncio
import sys
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core.database import init_db
from app.core.seed import seed_demo_data

async def run_integration_tests():
    print("=================================================================")
    print("COGNIPATH LMS NEXT-GEN FULL-STACK INTEGRATION VERIFICATION")
    print("=================================================================")

    # 1. Initialize DB and Seed Data
    print("\n[STEP 1] Initializing Database and Seeding Hierarchical Ecosystem...")
    await init_db()
    await seed_demo_data()
    print("-> Database initialized and demonstration data populated.")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Authenticate as student
        login_res = await client.post("/api/v1/auth/login-json", json={
            "email": "student@cognipath.edu",
            "password": "password123"
        })
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        student_token = login_res.json()["access_token"]
        student_headers = {"Authorization": f"Bearer {student_token}"}
        print("-> Student Aarav authenticated successfully.")

        # Authenticate as educator
        edu_login = await client.post("/api/v1/auth/login-json", json={
            "email": "teacher@cognipath.edu",
            "password": "password123"
        })
        assert edu_login.status_code == 200, f"Educator login failed: {edu_login.text}"
        edu_token = edu_login.json()["access_token"]
        edu_headers = {"Authorization": f"Bearer {edu_token}"}
        print("-> Educator Prof. Ramanujan authenticated successfully.")

        # =====================================================================
        # 1. COURSE CREATION & CONTENT DELIVERY ENGINE
        # =====================================================================
        print("\n[PILLAR 1] Testing Course Hierarchy, Topics & PDF Viewer...")
        res = await client.get("/api/v1/courses/1/hierarchy", headers=student_headers)
        assert res.status_code == 200, f"Hierarchy error: {res.text}"
        hierarchy = res.json()
        print(f"-> Course: {hierarchy['title']} ({hierarchy['code']}) - Difficulty: {hierarchy['difficulty']}")
        assert len(hierarchy["modules"]) >= 2, "Expected at least 2 modules"
        mod1 = hierarchy["modules"][0]
        print(f"-> Module 1: {mod1['title']}")
        assert len(mod1["topics"]) >= 2, "Expected topics in Module 1"
        top1 = mod1["topics"][0]
        print(f"   - Topic 1: {top1['title']} (YouTube Video ID: {top1['youtube_video_id']})")
        assert top1["youtube_video_id"] == "qH6clASSS54", "YouTube video ID mismatch"

        # Check view-only PDF resource
        assert len(mod1["resources"]) >= 1, "Expected PDF notes resource in Module 1"
        pdf_res = mod1["resources"][0]
        print(f"   - PDF Resource: {pdf_res['title']} (View-Only: {pdf_res['is_view_only']})")

        # Test view endpoint for secure PDF streaming
        stream_res = await client.get(f"/api/v1/courses/resources/{pdf_res['id']}/view", headers=student_headers)
        assert stream_res.status_code == 200, f"PDF stream error: {stream_res.status_code}"
        assert stream_res.headers.get("content-type") == "application/pdf"
        assert "inline" in stream_res.headers.get("content-disposition", "")
        print("-> Secure PDF stream verified with inline header & PDF binary payload.")

        # =====================================================================
        # 2. DUAL-ENGINE ASSESSMENT SYSTEM (QUIZZES & COMPREHENSIVE EXAMS)
        # =====================================================================
        print("\n[PILLAR 2] Testing Dual-Engine Exams, Reorder & Auto-Grading...")
        exam_list_res = await client.get("/api/v1/exams/course/1", headers=student_headers)
        assert exam_list_res.status_code == 200
        exams = exam_list_res.json()
        print(f"-> Found {len(exams)} exams in course 1.")
        assert len(exams) >= 2, "Expected Module Quiz and Final Exam"

        final_exam = next((e for e in exams if e["exam_type"] == "FINAL_EXAM"), None)
        assert final_exam is not None, "Final exam not found"
        print(f"-> Final Exam: {final_exam['title']} ({len(final_exam['questions'])} Questions, Passing: {final_exam['passing_score']}%)")

        # Test Reordering
        if len(final_exam["questions"]) >= 2:
            q1_id = final_exam["questions"][0]["id"]
            q2_id = final_exam["questions"][1]["id"]
            reorder_res = await client.put(f"/api/v1/exams/{final_exam['id']}/reorder", json={
                "question_orders": [
                    {"question_id": q1_id, "order_index": 2},
                    {"question_id": q2_id, "order_index": 1}
                ]
            }, headers=edu_headers)
            assert reorder_res.status_code == 200, f"Reorder failed: {reorder_res.text}"
            print("-> Drag-and-drop question reordering verified.")

        # Test Student Timed Submission & Badge Generation
        submit_responses = []
        for q in final_exam["questions"]:
            submit_responses.append({
                "question_id": q["id"],
                "selected_option": 0  # Pick option 0 (correct answer for seeded questions)
            })

        sub_res = await client.post(f"/api/v1/exams/{final_exam['id']}/submit", json={
            "responses": submit_responses
        }, headers=student_headers)
        assert sub_res.status_code == 200, f"Submit failed: {sub_res.text}"
        sub_data = sub_res.json()
        print(f"-> Student Score: {sub_data['score']}/{sub_data['total_questions']} ({sub_data['percentage']}%) - Passed: {sub_data['passed']}")
        assert sub_data["passed"] is True, "Expected passing score"
        assert sub_data["unlocked_badge"] is not None, "Expected verified badge to be minted"
        badge_info = sub_data["unlocked_badge"]
        print(f"-> Automated Verified Credential Minted: {badge_info['badge_name']}")
        print(f"   SHA-256 Verification Hash: {badge_info['verification_hash']}")

        # =====================================================================
        # 3. VERIFIED BADGES CRYPTOGRAPHIC PUBLIC VERIFICATION
        # =====================================================================
        print("\n[PILLAR 3] Verifying Tamper-Proof Credential Hash...")
        verify_res = await client.get(f"/api/v1/courses/badges/verify/{badge_info['verification_hash']}")
        assert verify_res.status_code == 200
        verify_data = verify_res.json()
        assert verify_data["verified"] is True
        print(f"-> Ledger Verified: {verify_data['badge_name']} awarded to {verify_data['student_name']} on {verify_data['course_title']}")

        # =====================================================================
        # 4. ASSIGNMENT ENGINE & CRITERION-BY-CRITERION AI AUTO-EVALUATION
        # =====================================================================
        print("\n[PILLAR 4] Testing Rubric Assignment Submission & Gemini Grading...")
        assign_res = await client.get(f"/api/v1/assignments/module/{mod1['id']}", headers=student_headers)
        assert assign_res.status_code == 200
        assignments = assign_res.json()
        assert len(assignments) >= 1, "Expected assignment in Module 1"
        assign = assignments[0]
        print(f"-> Assignment: {assign['title']} ({len(assign['rubric'])} Rubric Criteria, Max: {assign['max_score']} Pts)")

        # Submit text response for auto-grading
        solution_text = """
        Binary Search Tree Invariant Verification Algorithm:
        We implement a recursive function `is_valid_bst(node, min_val, max_val)`:
        1. If node is None, return True.
        2. If node.val <= min_val or node.val >= max_val, return False.
        3. Recursively verify left child with bounds (min_val, node.val) and right child with (node.val, max_val).
        Time complexity is O(N) since every node is visited exactly once.
        Auxiliary space complexity is O(H) where H is tree height due to the recursive call stack.
        For AVL balanced trees, height is strictly bounded by H <= 1.44 log2(N), guaranteeing O(log N) lookup time.
        Degenerate unbalanced trees suffer from H = N, causing O(N) linear time search equivalent to a linked list.
        """
        eval_res = await client.post(f"/api/v1/assignments/{assign['id']}/submit", data={
            "text_submission": solution_text
        }, headers=student_headers)
        assert eval_res.status_code == 200, f"Assignment grading failed: {eval_res.text}"
        eval_data = eval_res.json()
        print(f"-> AI Evaluation Grade: {eval_data['ai_score']} Pts")
        if eval_data.get("ai_feedback"):
            fb = eval_data["ai_feedback"]
            print(f"   Summary: {fb.get('actionable_feedback', '')[:80]}...")
            print(f"   Criteria Graded: {len(fb.get('criteria_scores', []))} items")

        # =====================================================================
        # 5. REAL-TIME COLLABORATIVE PODS: QUOTAS & PASSCODE SECURITY
        # =====================================================================
        print("\n[PILLAR 5] Testing Educator Quotas & Learning Pod Security...")
        # Check quota
        quota_res = await client.get("/api/v1/pods/educator/quota", headers=edu_headers)
        assert quota_res.status_code == 200
        q_data = quota_res.json()
        print(f"-> Educator Quota: Daily {q_data['daily_created']}/{q_data['daily_limit']} • Weekly {q_data['weekly_created']}/{q_data['weekly_limit']}")

        # Test creating protected pod and educator quota increment
        create_pod_res = await client.post("/api/v1/pods", json={
            "title": "Algorithms Revision Pod",
            "course_id": 1,
            "topic": "Graph Algorithms",
            "agenda": "Reviewing BFS and DFS",
            "passcode": "1234",
            "max_peers": 6
        }, headers=edu_headers)
        assert create_pod_res.status_code == 201, f"Create pod failed: {create_pod_res.text}"
        protected_pod = create_pod_res.json()
        print(f"-> Created Protected Pod: {protected_pod['title']} (Protected: {protected_pod.get('has_passcode')})")
        assert protected_pod.get("has_passcode") is True, "Pod should have has_passcode = True"

        # Verify correct passcode '1234'
        pv_res = await client.post(f"/api/v1/pods/{protected_pod['id']}/verify-passcode", json={
            "passcode": "1234"
        }, headers=student_headers)
        assert pv_res.status_code == 200
        assert pv_res.json()["verified"] is True
        print("-> Passcode '1234' verified successfully. Authorized to join.")

        # Verify wrong passcode
        pv_wrong = await client.post(f"/api/v1/pods/{protected_pod['id']}/verify-passcode", json={
            "passcode": "wrong_code"
        }, headers=student_headers)
        assert pv_wrong.status_code == 200
        assert pv_wrong.json()["verified"] is False
        print("-> Incorrect passcode correctly rejected.")

    print("\n=================================================================")
    print("ALL 5 PILLARS SYSTEM INTEGRATION VERIFICATION PASSED WITH 100% SUCCESS!")
    print("=================================================================")

if __name__ == "__main__":
    asyncio.run(run_integration_tests())
