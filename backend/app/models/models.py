from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, Float, DateTime, ForeignKey, UniqueConstraint
)
from sqlalchemy.orm import relationship
from app.core.database import Base

def utcnow():
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), default="STUDENT", nullable=False)  # STUDENT, EDUCATOR, ADMIN
    avatar_url = Column(String(512), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    # Academic & Professional Profile Fields (SIH 2026 Multi-Role Onboarding)
    university = Column(String(255), nullable=True)
    department = Column(String(255), nullable=True)
    institutional_email = Column(String(255), nullable=True)
    student_year = Column(String(100), nullable=True)
    student_id_num = Column(String(100), nullable=True)
    highest_qualification = Column(String(100), nullable=True)
    designation = Column(String(100), nullable=True)
    profile_completed = Column(Boolean, default=False, nullable=False)

    # Relationships
    courses_taught = relationship("Course", back_populates="educator")
    enrollments = relationship("Enrollment", back_populates="user")
    quiz_attempts = relationship("StudentQuizAttempt", back_populates="user")
    retention_records = relationship("StudentConceptRetention", back_populates="user")
    activity_logs = relationship("StudentActivityLog", back_populates="user")
    badges = relationship("StudentBadge", back_populates="student")
    exam_submissions = relationship("ExamSubmission", back_populates="student")
    assignment_submissions = relationship("AssignmentSubmission", back_populates="student")
    pod_quotas = relationship("EducatorPodQuota", back_populates="educator")
    course_ratings = relationship("CourseRating", back_populates="user", cascade="all, delete-orphan")
    topic_ratings = relationship("TopicRating", back_populates="user", cascade="all, delete-orphan")

class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(100), default="Computer Science")
    difficulty = Column(String(50), default="Intermediate")
    thumbnail_url = Column(String(512), nullable=True)
    educator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    # Relationships
    educator = relationship("User", back_populates="courses_taught")
    enrollments = relationship("Enrollment", back_populates="course")
    documents = relationship("Document", back_populates="course")
    quizzes = relationship("Quiz", back_populates="course")
    pods = relationship("LearningPod", back_populates="course")
    community_channels = relationship("CommunityChannel", back_populates="course")
    modules = relationship("Module", back_populates="course", cascade="all, delete-orphan", order_by="Module.order_index")
    exams = relationship("Exam", back_populates="course", cascade="all, delete-orphan")
    badges = relationship("StudentBadge", back_populates="course", cascade="all, delete-orphan")
    ratings = relationship("CourseRating", back_populates="course", cascade="all, delete-orphan")

class Enrollment(Base):
    __tablename__ = "enrollments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    completion_percentage = Column(Float, default=0.0)
    enrolled_at = Column(DateTime(timezone=True), default=utcnow)

    user = relationship("User", back_populates="enrollments")
    course = relationship("Course", back_populates="enrollments")

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    title = Column(String(255), nullable=False)
    file_path = Column(String(512), nullable=False)
    file_type = Column(String(50), nullable=False)  # pdf, docx, txt
    chunk_count = Column(Integer, default=0)
    topic = Column(String(255), nullable=True)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    course = relationship("Course", back_populates="documents")

class Quiz(Base):
    __tablename__ = "quizzes"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    topic = Column(String(255), nullable=False)
    title = Column(String(255), nullable=False)
    difficulty_level = Column(String(50), default="medium")  # easy, medium, hard
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    course = relationship("Course", back_populates="quizzes")
    questions = relationship("QuizQuestion", back_populates="quiz", cascade="all, delete-orphan")
    attempts = relationship("StudentQuizAttempt", back_populates="quiz")

class QuizQuestion(Base):
    __tablename__ = "quiz_questions"

    id = Column(Integer, primary_key=True, index=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.id"), nullable=False)
    question_text = Column(Text, nullable=False)
    options = Column(Text, nullable=False)  # JSON-encoded array of options: ["A", "B", "C", "D"]
    correct_option_index = Column(Integer, nullable=False)
    explanation = Column(Text, nullable=True)
    source_chunk_ref = Column(String(255), nullable=True)

    quiz = relationship("Quiz", back_populates="questions")

class StudentQuizAttempt(Base):
    __tablename__ = "student_quiz_attempts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    quiz_id = Column(Integer, ForeignKey("quizzes.id"), nullable=False)
    score = Column(Float, nullable=False)
    total_questions = Column(Integer, nullable=False)
    answers_json = Column(Text, nullable=True)  # JSON-encoded answers
    completed_at = Column(DateTime(timezone=True), default=utcnow)

    user = relationship("User", back_populates="quiz_attempts")
    quiz = relationship("Quiz", back_populates="attempts")

class StudentConceptRetention(Base):
    """Tracks SuperMemo SM-2 Spaced Repetition Parameters per concept tag."""
    __tablename__ = "student_concept_retention"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    concept_tag = Column(String(255), index=True, nullable=False)
    repetition_interval = Column(Integer, default=1)  # Interval in days
    difficulty_factor = Column(Float, default=2.5)     # Easiness Factor (EF in SM-2)
    repetitions = Column(Integer, default=0)           # Repetition count
    next_review_date = Column(DateTime(timezone=True), default=utcnow)
    last_reviewed_at = Column(DateTime(timezone=True), default=utcnow)

    user = relationship("User", back_populates="retention_records")

class StudentActivityLog(Base):
    """Telemetry tracking student queries, attempts, and behavior for At-Risk analytics."""
    __tablename__ = "student_activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    action_type = Column(String(100), nullable=False)  # QUERY_TUTOR, TAKE_QUIZ, VIEW_DOC, POD_SESSION
    query_text = Column(Text, nullable=True)
    response_time_ms = Column(Integer, nullable=True)
    metadata_info = Column(Text, nullable=True)  # JSON-encoded metadata
    created_at = Column(DateTime(timezone=True), default=utcnow)

    user = relationship("User", back_populates="activity_logs")

class LearningPod(Base):
    """Native collaborative video/audio and chat pod."""
    __tablename__ = "learning_pods"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    host_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    topic = Column(String(255), nullable=False)
    agenda = Column(Text, default="Collaborative study session")
    passcode_hash = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    max_peers = Column(Integer, default=8)
    scheduled_duration_minutes = Column(Integer, default=45)
    started_at = Column(DateTime(timezone=True), default=utcnow)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(50), default="ACTIVE")  # SCHEDULED, ACTIVE, COMPLETED, TERMINATED_BY_HOST
    host_last_seen_at = Column(DateTime(timezone=True), nullable=True)
    kshetra_meeting_code = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    course = relationship("Course", back_populates="pods")
    messages = relationship("PodMessage", back_populates="pod", cascade="all, delete-orphan")
    blacklists = relationship("PodBlacklist", back_populates="pod", cascade="all, delete-orphan")

class PodMessage(Base):
    __tablename__ = "pod_messages"

    id = Column(Integer, primary_key=True, index=True)
    pod_id = Column(Integer, ForeignKey("learning_pods.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    sender_name = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    is_ai_tutor = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    pod = relationship("LearningPod", back_populates="messages")

class CommunityChannel(Base):
    __tablename__ = "community_channels"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    name = Column(String(100), nullable=False)  # e.g., "general", "doubts-and-qa", "exam-prep"
    description = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    course = relationship("Course", back_populates="community_channels")
    messages = relationship("CommunityMessage", back_populates="channel", cascade="all, delete-orphan")

class CommunityMessage(Base):
    __tablename__ = "community_messages"

    id = Column(Integer, primary_key=True, index=True)
    channel_id = Column(Integer, ForeignKey("community_channels.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    author_name = Column(String(255), nullable=False)
    author_role = Column(String(50), default="STUDENT")
    content = Column(Text, nullable=False)
    upvotes = Column(Integer, default=0)
    is_solution = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    channel = relationship("CommunityChannel", back_populates="messages")

class StudentSkillMastery(Base):
    """Tracks domain topic mastery percentage, XP, and daily study streaks."""
    __tablename__ = "student_skill_mastery"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    topic = Column(String(255), nullable=False)
    mastery_percentage = Column(Float, default=0.0)
    xp_points = Column(Integer, default=0)
    streak_days = Column(Integer, default=1)
    last_active_at = Column(DateTime(timezone=True), default=utcnow)

class CurriculumAuditReport(Base):
    """Stores syllabus coverage health score, missing prerequisite flags, and Bloom's analytics."""
    __tablename__ = "curriculum_audit_reports"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    health_score = Column(Float, default=85.0)
    total_topics = Column(Integer, default=5)
    prerequisite_gaps_json = Column(Text, nullable=True)
    blooms_distribution_json = Column(Text, nullable=True)
    generated_at = Column(DateTime(timezone=True), default=utcnow)

# ==============================================================================
# HIERARCHICAL CONTENT DELIVERY ENGINE (COURSE -> MODULES -> TOPICS & RESOURCES)
# ==============================================================================

class Module(Base):
    """Hierarchical course module representing a chapter or thematic unit."""
    __tablename__ = "modules"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    order_index = Column(Integer, default=1, nullable=False)
    has_module_exam = Column(Boolean, default=False, nullable=False)
    module_exam_id = Column(Integer, ForeignKey("exams.id", use_alter=True, name="fk_modules_exam_id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    course = relationship("Course", back_populates="modules")
    topics = relationship("Topic", back_populates="module", cascade="all, delete-orphan", order_by="Topic.order_index")
    resources = relationship("ModuleResource", back_populates="module", cascade="all, delete-orphan")
    assignments = relationship("Assignment", back_populates="module", cascade="all, delete-orphan")
    exams = relationship("Exam", back_populates="module", foreign_keys="[Exam.module_id]")
    module_exam = relationship("Exam", foreign_keys=[module_exam_id], post_update=True)

class Topic(Base):
    """Individual concept topic containing YouTube video lecture and concept explanation."""
    __tablename__ = "topics"

    id = Column(Integer, primary_key=True, index=True)
    module_id = Column(Integer, ForeignKey("modules.id"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    youtube_url = Column(String(512), nullable=False)
    youtube_video_id = Column(String(50), nullable=False)
    order_index = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    module = relationship("Module", back_populates="topics")
    ratings = relationship("TopicRating", back_populates="topic", cascade="all, delete-orphan")

class ModuleResource(Base):
    """Reference materials (PDF notes) rendered via secure view-only canvas."""
    __tablename__ = "module_resources"

    id = Column(Integer, primary_key=True, index=True)
    module_id = Column(Integer, ForeignKey("modules.id"), nullable=False)
    title = Column(String(255), nullable=False)
    file_url = Column(String(512), nullable=False)
    file_type = Column(String(50), default="pdf", nullable=False)
    is_view_only = Column(Boolean, default=True, nullable=False)
    chunk_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    module = relationship("Module", back_populates="resources")

# ==============================================================================
# DUAL-ENGINE ASSESSMENT SYSTEM (QUIZZES & COMPREHENSIVE EXAMS)
# ==============================================================================

class Exam(Base):
    """Module-level Quizzes and comprehensive Final Course Exams."""
    __tablename__ = "exams"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    module_id = Column(Integer, ForeignKey("modules.id"), nullable=True)  # Null for final exam
    exam_type = Column(String(50), default="MODULE_QUIZ", nullable=False)  # MODULE_QUIZ, FINAL_EXAM
    scope = Column(String(50), default="MODULE_END", nullable=False)  # MODULE_END, FINAL_COURSE
    title = Column(String(255), nullable=False)
    time_limit_mins = Column(Integer, default=20, nullable=False)
    passing_score = Column(Float, default=60.0, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    course = relationship("Course", back_populates="exams")
    module = relationship("Module", back_populates="exams", foreign_keys=[module_id])
    questions = relationship("ExamQuestion", back_populates="exam", cascade="all, delete-orphan", order_by="ExamQuestion.order_index")
    submissions = relationship("ExamSubmission", back_populates="exam", cascade="all, delete-orphan")

class ExamQuestion(Base):
    """Individual assessment item supporting MCQs and short answers with drag-and-drop order."""
    __tablename__ = "exam_questions"

    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id"), nullable=False)
    question_type = Column(String(50), default="MCQ", nullable=False)  # MCQ, SHORT_ANSWER
    question_text = Column(Text, nullable=False)
    options = Column(Text, nullable=True)  # JSON-encoded options for MCQ: ["A", "B", "C", "D"]
    correct_answer = Column(Text, nullable=False)  # Option index "0" or model answer text
    explanation = Column(Text, nullable=True)
    source_ref = Column(String(255), nullable=True)
    order_index = Column(Integer, default=1, nullable=False)

    exam = relationship("Exam", back_populates="questions")

class ExamSubmission(Base):
    """Student exam submission evaluation record."""
    __tablename__ = "exam_submissions"

    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    score = Column(Float, nullable=False)
    percentage = Column(Float, nullable=False)
    passed = Column(Boolean, default=False, nullable=False)
    responses_json = Column(Text, nullable=False)  # JSON-encoded array of responses
    evaluated_at = Column(DateTime(timezone=True), default=utcnow)

    exam = relationship("Exam", back_populates="submissions")
    student = relationship("User", back_populates="exam_submissions")

# ==============================================================================
# GAMIFICATION & VERIFIED BADGES
# ==============================================================================

class StudentBadge(Base):
    """Cryptographically verifiable digital credential badge unlocked upon completion."""
    __tablename__ = "student_badges"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    badge_name = Column(String(255), nullable=False)
    badge_image_url = Column(String(512), nullable=True)
    difficulty_level = Column(String(50), default="Intermediate")
    verification_hash = Column(String(64), unique=True, index=True, nullable=False)
    issued_at = Column(DateTime(timezone=True), default=utcnow)

    student = relationship("User", back_populates="badges")
    course = relationship("Course", back_populates="badges")

# ==============================================================================
# ASSIGNMENT ENGINE & AI AUTO-EVALUATION
# ==============================================================================

class Assignment(Base):
    """Module-level assignment supporting MCQs, descriptive prompts, and practical PDF submissions."""
    __tablename__ = "assignments"

    id = Column(Integer, primary_key=True, index=True)
    module_id = Column(Integer, ForeignKey("modules.id"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    assignment_type = Column(String(50), default="PRACTICAL_PDF", nullable=False)  # MCQ, THEORETICAL, PRACTICAL_PDF
    rubric_json = Column(Text, nullable=False)  # JSON list of {criterion, max_points}
    model_answer = Column(Text, nullable=True)
    max_score = Column(Float, default=100.0, nullable=False)
    deadline = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    module = relationship("Module", back_populates="assignments")
    submissions = relationship("AssignmentSubmission", back_populates="assignment", cascade="all, delete-orphan")

class AssignmentSubmission(Base):
    """Student assignment submission and AI rubric evaluation."""
    __tablename__ = "assignment_submissions"

    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    submitted_file_url = Column(String(512), nullable=True)
    extracted_text = Column(Text, nullable=True)
    ai_score = Column(Float, nullable=True)
    ai_feedback_json = Column(Text, nullable=True)  # JSON {criteria_scores, strengths, weaknesses, actionable_feedback}
    manual_score = Column(Float, nullable=True)
    educator_notes = Column(Text, nullable=True)
    status = Column(String(50), default="PENDING", nullable=False)  # PENDING, AI_GRADED, MANUALLY_REVIEWED
    submitted_at = Column(DateTime(timezone=True), default=utcnow)

    assignment = relationship("Assignment", back_populates="submissions")
    student = relationship("User", back_populates="assignment_submissions")

# ==============================================================================
# LEARNING POD MODERATION & CREATION QUOTAS
# ==============================================================================

class PodBlacklist(Base):
    """Prevents expelled/kicked students from rejoining a specific pod."""
    __tablename__ = "pod_blacklists"

    id = Column(Integer, primary_key=True, index=True)
    pod_id = Column(Integer, ForeignKey("learning_pods.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    reason = Column(String(255), default="Expelled by Host")
    kicked_at = Column(DateTime(timezone=True), default=utcnow)
    kicked_by = Column(Integer, ForeignKey("users.id"), nullable=False)

    pod = relationship("LearningPod", back_populates="blacklists")

class EducatorPodQuota(Base):
    """Tracks daily and weekly pod creation limits per educator."""
    __tablename__ = "educator_pod_quotas"

    id = Column(Integer, primary_key=True, index=True)
    educator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    day_date = Column(String(20), nullable=False)  # YYYY-MM-DD
    week_start_date = Column(String(20), nullable=False)  # YYYY-MM-DD
    daily_created = Column(Integer, default=0, nullable=False)
    weekly_created = Column(Integer, default=0, nullable=False)

    educator = relationship("User", back_populates="pod_quotas")

# ==============================================================================
# COURSE & TOPIC RATING SCENARIOS
# ==============================================================================

class CourseRating(Base):
    """Student 1-5 star review rating on an entire course."""
    __tablename__ = "course_ratings"
    __table_args__ = (
        UniqueConstraint("course_id", "user_id", name="uq_course_user_rating"),
    )

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    rating = Column(Float, nullable=False)  # 1.0 to 5.0
    review = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    course = relationship("Course", back_populates="ratings")
    user = relationship("User", back_populates="course_ratings")


class TopicRating(Base):
    """Student 1-5 star feedback rating on an individual subtopic / video lecture."""
    __tablename__ = "topic_ratings"
    __table_args__ = (
        UniqueConstraint("topic_id", "user_id", name="uq_topic_user_rating"),
    )

    id = Column(Integer, primary_key=True, index=True)
    topic_id = Column(Integer, ForeignKey("topics.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    rating = Column(Integer, nullable=False)  # 1 to 5
    feedback = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    topic = relationship("Topic", back_populates="ratings")
    user = relationship("User", back_populates="topic_ratings")


