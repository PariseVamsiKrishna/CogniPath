import asyncio
import sys
import os

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

from app.core.database import AsyncSessionLocal
from app.services.quiz_service import quiz_service
from app.services.socratic_service import socratic_service
from app.services.curriculum_audit_service import curriculum_audit_service

async def test_all_upgrades():
    print("=" * 60)
    print("🧪 TESTING AI-POWERED UPGRADES (QUIZ, SOCRATIC, AUDIT)")
    print("=" * 60)

    # 1. Test Quiz Generation for a completely new topic
    print("\n[1/4] Testing Real AI Quiz Generation for 'Graph Algorithms: Dijkstra & Bellman-Ford'...")
    questions = await quiz_service.generate_concept_micro_quiz(
        course_id=1,
        topic="Graph Algorithms: Dijkstra & Bellman-Ford",
        context_chunks=None
    )
    assert len(questions) >= 2, "Expected at least 2 questions"
    print(f"Generated {len(questions)} dynamic questions:")
    for idx, q in enumerate(questions):
        print(f"  Q{idx+1}: {q['question']}")
        print(f"       Correct Option: [{q['correct_index']}] {q['options'][q['correct_index']]}")
        print(f"       Source: {q['source_ref']}")
    assert "What is the primary design characteristic of" not in questions[0]["question"], "Failed: Static template returned!"
    print("✅ Real AI Quiz Generation verified successfully!")

    # 2. Test Socratic Guidance for a completely new concept
    print("\n[2/4] Testing Dynamic Socratic Guidance for 'Relational Database Normalization'...")
    socratic_res = await socratic_service.generate_socratic_guidance(
        course_id=1,
        query="Why do we need Boyce-Codd Normal Form (BCNF) over 3NF?",
        student_attempt="Because 3NF still allows transitive functional dependencies if the determinant is not a superkey"
    )
    print(f"Stage: {socratic_res.stage}")
    print(f"Probing Question: {socratic_res.probing_question}")
    print(f"Guidance: {socratic_res.pedagogical_guidance[:120]}...")
    assert socratic_res.stage == "VERIFICATION", f"Expected VERIFICATION stage, got {socratic_res.stage}"
    assert "When you think about" not in socratic_res.probing_question, "Failed: Static Socratic template returned!"
    print("✅ Real Dynamic Socratic Guidance verified successfully!")

    # 3. Test Dynamic Mindmap for an arbitrary topic
    print("\n[3/4] Testing Dynamic Mermaid Mindmap for 'Operating Systems Virtual Memory & Paging'...")
    mindmap = socratic_service.generate_mindmap_for_topic("Operating Systems Virtual Memory & Paging")
    print(f"Mindmap Title: {mindmap.title}")
    print(f"Nodes ({len(mindmap.nodes)}): {[n.label for n in mindmap.nodes]}")
    print(f"Mermaid Code:\n{mindmap.mermaid_code[:200]}...")
    assert len(mindmap.nodes) >= 3, "Expected at least 3 nodes"
    assert "graph TD" in mindmap.mermaid_code, "Expected valid graph TD in Mermaid code"
    print("✅ Real Dynamic Mermaid Mindmap verified successfully!")

    # 4. Test Real Curriculum Health Audit
    print("\n[4/4] Testing Real Curriculum Health Audit...")
    async with AsyncSessionLocal() as session:
        audit = await curriculum_audit_service.perform_audit(course_id=1, db=session)
        print(f"Health Score: {audit.health_score}/100 ({audit.grade_rating})")
        print(f"Total Chunks Analyzed: {audit.total_chunks_analyzed}")
        print(f"Prerequisite Gaps Flagged ({len(audit.prerequisite_gaps)}):")
        for g in audit.prerequisite_gaps:
            print(f"  - [{g.severity}] {g.missing_prerequisite} -> {g.advanced_concept}")
            print(f"    Suggestion: {g.remediation_suggestion}")
        print(f"Bloom's Balance: {audit.blooms_balance}")
        print(f"Recommendations ({len(audit.recommendations)}):")
        for r in audit.recommendations:
            print(f"  * {r}")
        assert audit.health_score > 0, "Audit health score must be > 0"
        assert len(audit.prerequisite_gaps) > 0, "Expected prerequisite gaps"
        print("✅ Real Curriculum Health Audit verified successfully!")

    print("\n" + "=" * 60)
    print("🎉 ALL 4 AI-POWERED UPGRADE TESTS PASSED!")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(test_all_upgrades())
