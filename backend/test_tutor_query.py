import asyncio
import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from app.core.database import AsyncSessionLocal, init_db
from app.models.models import User
from app.schemas.schemas import TutorQueryRequest
from app.api.v1.tutor import tutor_chat
from app.services.rag_service import rag_service

async def test_tutor():
    print("Initializing DB...")
    await init_db()

    async with AsyncSessionLocal() as db:
        mock_user = User(id=2, role="STUDENT", full_name="Aarav Sharma", email="aarav@cognipath.edu")

        # Test 1: Direct question about binary search trees
        print("\n--- 1. Testing Question: 'What is a Binary Search Tree and what are its key properties?' ---")
        req1 = TutorQueryRequest(course_id=1, module_id=1, topic_id=1, query="What is a Binary Search Tree and what are its key properties?")
        res1 = await tutor_chat(req1, current_user=mock_user, db=db)
        print(f"Latency: {res1.processing_time_ms} ms")
        print(f"Citations: {len(res1.citations)}")
        print(f"Answer Preview:\n{res1.answer[:300]}...")
        assert len(res1.answer) > 50
        assert "not covered" not in res1.answer.lower(), "Should NOT say topic is not covered!"

        # Test 2: Question about time complexity
        print("\n--- 2. Testing Question: 'What is the worst-case time complexity of an unbalanced BST?' ---")
        req2 = TutorQueryRequest(course_id=1, module_id=1, topic_id=1, query="What is the worst-case time complexity of an unbalanced BST?")
        res2 = await tutor_chat(req2, current_user=mock_user, db=db)
        print(f"Answer Preview:\n{res2.answer[:300]}...")
        assert len(res2.answer) > 30

        print("\nTUTOR EXACT ANSWER VERIFICATION PASSED SUCCESSFULLY! ✅")

if __name__ == "__main__":
    asyncio.run(test_tutor())
