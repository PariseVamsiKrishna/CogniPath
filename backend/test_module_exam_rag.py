import asyncio
from app.models.models import Module, Exam
from app.schemas.schemas import RAGMCQItem, TabsSummaryResponse
from app.services.exam_service import exam_service
from app.core.database import AsyncSessionLocal, init_db

async def run_test():
    print("Testing Backend RAG MCQ Generator & Tabs Summary...")
    await init_db()
    async with AsyncSessionLocal() as db:
        # 1. Test generate_module_rag_mcqs
        result = await exam_service.generate_module_rag_mcqs(
            course_id=1,
            module_id=1,
            topic="Binary Trees and Traversal",
            count=3,
            difficulty="Intermediate",
            db=db
        )
        print(f"RAG Generated {result['count']} MCQs successfully!")
        assert len(result["questions"]) >= 1, "Should generate at least 1 question"
        q1 = result["questions"][0]
        print(f"Sample Question: {q1.question_text}")
        print(f"Options: {q1.options}")
        print(f"Correct Option: {q1.correct_option}")
        print(f"Explanation: {q1.explanation}")
        print(f"Source: {q1.source_reference}")

        # 2. Test get_tabs_summary
        from app.api.v1.courses import get_tabs_summary
        summary = await get_tabs_summary(current_user=None, db=db)
        print(f"Tabs summary returned {len(summary.courses)} courses!")
        assert len(summary.courses) > 0, "Tabs summary should return courses"
        c1 = summary.courses[0]
        print(f"Course 1: {c1.title} with {len(c1.modules)} modules")
        if c1.modules:
            print(f"Module 1: {c1.modules[0].title}, topics: {c1.modules[0].topics_count}, has_exam: {c1.modules[0].has_module_exam}")

        # 3. Test save_module_exam
        from app.api.v1.courses import save_module_exam
        from app.schemas.schemas import ModuleExamCreateRequest, ExamQuestionSchema
        from app.models.models import User
        mock_user = User(id=1, role="EDUCATOR", full_name="Prof. Ramanujan", email="teacher@cognipath.edu")
        exam_req = ModuleExamCreateRequest(
            title="Module 1 End-of-Unit Mastery Assessment",
            time_limit_mins=15,
            passing_score=70.0,
            scope="MODULE_END",
            questions=[
                ExamQuestionSchema(
                    question_type="MCQ",
                    question_text=q1.question_text,
                    options=q1.options,
                    correct_answer=q1.correct_option,
                    explanation=q1.explanation,
                    source_ref=q1.source_reference,
                    order_index=1
                )
            ]
        )
        saved_exam = await save_module_exam(module_id=1, req=exam_req, current_user=mock_user, db=db)
        print(f"Saved Module Exam: ID={saved_exam.id}, Title='{saved_exam.title}', Questions={len(saved_exam.questions)}")
        assert saved_exam.id is not None
        assert len(saved_exam.questions) == 1

        print("ALL BACKEND ENDPOINTS VERIFIED AND PASSED!")

if __name__ == "__main__":
    asyncio.run(run_test())
