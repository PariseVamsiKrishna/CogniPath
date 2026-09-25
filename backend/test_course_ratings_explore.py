import asyncio
import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from app.core.database import AsyncSessionLocal, init_db
from app.models.models import User, Course, Module, Topic
from app.schemas.schemas import CourseRatingCreate, TopicRatingCreate
from app.api.v1.courses import explore_courses, rate_course, get_course_ratings, rate_topic, get_topic_ratings

async def test_backend():
    print("Initializing DB...")
    await init_db()

    async with AsyncSessionLocal() as db:
        # Create or fetch mock user
        mock_user = User(id=2, role="STUDENT", full_name="Aarav Sharma", email="aarav@cognipath.edu")

        print("\n--- 1. Testing explore_courses() ---")
        items = await explore_courses(q=None, category="All", sort_by="rating", current_user=mock_user, db=db)
        print(f"Total courses explored: {len(items)}")
        assert len(items) > 0, "Should return courses"
        for it in items:
            print(f"[{it.code}] {it.title} | Created By: {it.educator_name} | Rating: ★{it.average_rating} ({it.total_ratings}) | Enrolled: {it.is_enrolled}")

        # Test search by creator name
        print("\n--- 2. Testing search by creator name 'Rajesh' ---")
        creator_items = await explore_courses(q="Rajesh", category="All", sort_by="rating", current_user=mock_user, db=db)
        print(f"Courses found matching 'Rajesh': {len(creator_items)}")
        assert len(creator_items) > 0, "Should find courses by creator name"
        for it in creator_items:
            assert "rajesh" in it.educator_name.lower(), f"Expected 'Rajesh' in {it.educator_name}"

        # Test sorting by rating
        print("\n--- 3. Testing High-Rating Priority Sorting ---")
        ratings = [it.average_rating for it in items]
        print(f"Ratings sequence: {ratings}")
        assert ratings == sorted(ratings, reverse=True), "Courses must be sorted by highest rating first!"

        # Test course rating
        print("\n--- 4. Testing Course Rating POST & GET ---")
        rating_in = CourseRatingCreate(rating=5.0, review="Extraordinary course structure, very clear explanations!")
        saved_rating = await rate_course(course_id=1, rating_in=rating_in, current_user=mock_user, db=db)
        print(f"Saved Course Rating: ID={saved_rating.id}, User={saved_rating.user_name}, Rating=★{saved_rating.rating}, Review='{saved_rating.review}'")
        assert saved_rating.rating == 5.0
        assert saved_rating.user_name == "Aarav Sharma"

        summary = await get_course_ratings(course_id=1, current_user=mock_user, db=db)
        print(f"Course 1 Rating Summary: Average=★{summary.average_rating} ({summary.total_ratings} ratings), User Rating={summary.user_rating}")
        assert summary.user_rating == 5.0
        assert len(summary.reviews) > 0

        # Test topic rating
        print("\n--- 5. Testing Topic Rating POST & GET ---")
        topic_rating_in = TopicRatingCreate(rating=5, feedback="Brilliant video explanation of binary tree operations!")
        saved_t_rating = await rate_topic(topic_id=1, rating_in=topic_rating_in, current_user=mock_user, db=db)
        print(f"Saved Topic Rating: ID={saved_t_rating.id}, Rating=★{saved_t_rating.rating}, Feedback='{saved_t_rating.feedback}'")
        assert saved_t_rating.rating == 5

        t_summary = await get_topic_ratings(topic_id=1, current_user=mock_user, db=db)
        print(f"Topic 1 Rating Summary: Average=★{t_summary.average_rating} ({t_summary.total_ratings} ratings), User Rating={t_summary.user_rating}")
        assert t_summary.user_rating == 5

        print("\nALL BACKEND COURSE RATINGS & EXPLORER TESTS PASSED SUCCESSFULLY! \u2705")

if __name__ == "__main__":
    asyncio.run(test_backend())
