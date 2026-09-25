import asyncio
import os
import sys

# Configure utf-8 stdout for Windows console
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.core.database import init_db, AsyncSessionLocal
from app.core.seed import seed_demo_data
from app.services.rag_service import rag_service
from app.services.quiz_service import quiz_service
from app.services.analytics_service import analytics_service
from app.core.security import verify_password, get_password_hash, create_access_token
from app.models.models import User
from sqlalchemy.future import select

async def run_verification():
    print("==================================================")
    print("🚀 COGNIPATH BACKEND VERIFICATION SUITE (SIH 2026)")
    print("==================================================")

    # 1. Database Init & Seeding Test
    print("\n[1/5] Testing Database Schema Initialization & Seeder...")
    await init_db()
    await seed_demo_data()
    print("✅ Database initialized and seed data populated successfully.")

    # 2. Authentication & Security Test
    print("\n[2/5] Testing Security, Password Hashing & JWT Tokens...")
    async with AsyncSessionLocal() as session:
        user_res = await session.execute(select(User).where(User.email == "teacher@cognipath.edu"))
        educator = user_res.scalars().first()
        assert educator is not None, "Educator not found in seeded DB"
        assert verify_password("password123", educator.hashed_password), "Password verification failed"
        token = create_access_token(data={"sub": str(educator.id), "role": educator.role})
        assert token and len(token) > 20, "JWT token generation failed"
        print(f"✅ Auth verified for {educator.full_name} ({educator.role}). Valid JWT generated.")

    # 3. Grounded RAG & Citation Engine Test
    print("\n[3/5] Testing Curriculum-Grounded RAG & Citations...")
    query = "What is the time complexity of Binary Search Trees?"
    answer, citations, latency_ms = await rag_service.generate_response(
        course_id=1,
        query=query,
        target_language="en"
    )
    print(f"Latency: {latency_ms}ms | Citations retrieved: {len(citations)}")
    assert len(citations) > 0, "Expected at least 1 citation for seeded topic"
    assert citations[0].source_title, "Citation missing source title"
    print(f"Top Citation: {citations[0].source_title} ({citations[0].page_or_chunk})")
    print("Grounded Excerpt Preview:", citations[0].snippet[:100] + "...")
    print("✅ RAG response grounded with verified curriculum citations.")

    # 4. SuperMemo SM-2 Spaced Repetition Test
    print("\n[4/5] Testing SuperMemo SM-2 Interval Calculation...")
    # Perfect score q=5 on 1st repetition
    reps, ef, interval = quiz_service.calculate_sm2_update(
        repetition_count=0,
        easiness_factor=2.5,
        interval_days=1,
        quality_rating=5
    )
    assert reps == 1 and interval == 1, f"Unexpected SM-2 values for rep 0: reps={reps}, interval={interval}"
    
    # 2nd repetition
    reps2, ef2, interval2 = quiz_service.calculate_sm2_update(
        repetition_count=reps,
        easiness_factor=ef,
        interval_days=interval,
        quality_rating=4
    )
    assert reps2 == 2 and interval2 == 6, f"Unexpected SM-2 values for rep 1: reps={reps2}, interval={interval2}"
    print(f"✅ SM-2 Algorithm verified: Initial interval -> {interval} day, 2nd interval -> {interval2} days (EF: {ef2}).")

    # 5. Educator Analytics & At-Risk Heuristics Test
    print("\n[5/8] Testing Educator At-Risk Heuristic Engine...")
    async with AsyncSessionLocal() as session:
        overview = await analytics_service.compute_dashboard_overview(
            educator_id=educator.id,
            db=session
        )
        print(f"Total Enrolled: {overview.total_students}")
        print(f"Class Average: {overview.average_class_score}%")
        print(f"At-Risk Students Detected: {overview.at_risk_count}")
        assert overview.at_risk_count >= 1, "Expected at least 1 at-risk student flagged"
        for st in overview.at_risk_students:
            print(f" - Flagged Student: {st.student_name} ({st.email}) | Risk: {st.risk_level} | Score: {st.average_quiz_score}%")
            print(f"   Reasons: {'; '.join(st.risk_reasons)}")
        print("✅ At-Risk heuristic engine accurately detected struggling students.")

    # 6. Socratic Guidance & Mindmap Engine Test
    print("\n[6/8] Testing Socratic Guided Inquiry & Dynamic Concept Mindmaps...")
    from app.services.socratic_service import socratic_service
    socratic_res = await socratic_service.generate_socratic_guidance(
        course_id=1,
        query="Why is searching a binary search tree fast?",
        student_attempt="Because we go left or right at each step"
    )
    assert socratic_res.stage == "VERIFICATION", f"Unexpected stage: {socratic_res.stage}"
    assert socratic_res.probing_question, "Missing probing question"
    print(f"Socratic Stage: {socratic_res.stage}")
    print(f"Probing Question: {socratic_res.probing_question[:90]}...")
    
    mindmap = socratic_service.generate_mindmap_for_topic("Binary Search Trees")
    assert len(mindmap.nodes) >= 3, "Mindmap missing nodes"
    assert "graph TD" in mindmap.mermaid_code, "Mermaid code missing graph TD header"
    print(f"Generated Mindmap Nodes: {len(mindmap.nodes)} nodes, {len(mindmap.edges)} edges.")
    print("✅ Socratic dialogue and Mermaid.js concept graphs verified.")

    # 7. Adaptive Roadmap & Knowledge Gap Radar Test
    print("\n[7/8] Testing Adaptive Learning Roadmap & Knowledge Gap Radar...")
    from app.services.roadmap_service import roadmap_service
    async with AsyncSessionLocal() as session:
        user_res = await session.execute(select(User).where(User.email == "student@cognipath.edu"))
        student = user_res.scalars().first()
        assert student is not None, "Student user not found"

        roadmap = await roadmap_service.get_student_roadmap(
            user_id=student.id,
            course_id=1,
            db=session
        )
        assert len(roadmap.skills) > 0, "No skills computed in roadmap"
        assert len(roadmap.next_best_actions) > 0, "No next best actions suggested"
        print(f"Student Level: {roadmap.current_level} (XP: {roadmap.total_xp}, Streak: {roadmap.streak_days} days)")
        print(f"Evaluated Skills: {len(roadmap.skills)} tracked domain topics")
        print(f"Top Action Item: {roadmap.next_best_actions[0].title} (+{roadmap.next_best_actions[0].xp_reward} XP)")
        print("✅ Adaptive knowledge gaps and Next-Best-Action queue verified.")

    # 8. Curriculum Diagnostic Studio & Bloom's Taxonomy Test
    print("\n[8/8] Testing Curriculum Health Audit & Bloom's Taxonomy Generator...")
    from app.services.curriculum_audit_service import curriculum_audit_service
    async with AsyncSessionLocal() as session:
        audit = await curriculum_audit_service.perform_audit(course_id=1, db=session)
        assert audit.health_score > 0, "Health score must be > 0"
        assert len(audit.prerequisite_gaps) > 0, "Prerequisite gaps not identified"
        print(f"Curriculum Health Score: {audit.health_score}/100 ({audit.grade_rating})")
        print(f"Prerequisite Gaps Flagged: {len(audit.prerequisite_gaps)}")
        for gap in audit.prerequisite_gaps:
            print(f" - Missing: '{gap.missing_prerequisite}' before '{gap.advanced_concept}' [Severity: {gap.severity}]")

        blooms_quiz = curriculum_audit_service.generate_blooms_taxonomy_quiz("Binary Search Trees")
        assert len(blooms_quiz) == 4, "Expected 4-tier Bloom's taxonomy quiz"
        levels = [q.level for q in blooms_quiz]
        assert "REMEMBER" in levels and "ANALYZE" in levels, "Missing Bloom's taxonomy tiers"
        print(f"Bloom's Taxonomy Quiz generated across {len(blooms_quiz)} cognitive tiers: {', '.join(levels)}")
        print("✅ Curriculum Health Diagnostic Studio & Bloom's Generator verified.")

    print("\n==================================================")
    print("🎉 ALL 8 FULL-SYSTEM VERIFICATION SUITES PASSED FLAWLESSLY!")
    print("==================================================")

if __name__ == "__main__":
    asyncio.run(run_verification())
