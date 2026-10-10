from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, EmailStr, Field


# ==========================================
# User & Auth Schemas
# ==========================================
class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: str = "STUDENT"  # STUDENT, EDUCATOR, ADMIN
    university: str | None = None
    department: str | None = None
    institutional_email: str | None = None
    student_year: str | None = None
    student_id_num: str | None = None
    highest_qualification: str | None = None
    designation: str | None = None
    profile_completed: bool = False

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserProfileUpdate(BaseModel):
    full_name: str
    email: EmailStr | None = None
    role: str = "STUDENT"  # STUDENT, EDUCATOR
    university: str
    department: str
    institutional_email: str | None = None
    # Student dynamic fields
    student_year: str | None = None
    student_id_num: str | None = None
    # Educator dynamic fields
    highest_qualification: str | None = None
    designation: str | None = None

class UserResponse(UserBase):
    id: int
    avatar_url: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# ==========================================
# Course & Document Schemas
# ==========================================
class CourseCreate(BaseModel):
    title: str
    code: str
    description: str | None = None
    category: str | None = "Computer Science"
    difficulty: str | None = "Intermediate"
    thumbnail_url: str | None = None

class CourseResponse(BaseModel):
    id: int
    title: str
    code: str
    description: str | None = None
    category: str
    difficulty: str | None = "Intermediate"
    thumbnail_url: str | None = None
    educator_id: int
    educator_name: str | None = "Prof. Rajesh Ramanujan"
    average_rating: float | None = 4.9
    total_ratings: int | None = 0
    progress_percentage: float | None = 0.0
    next_topic_title: str | None = None
    is_enrolled: bool | None = False
    created_at: datetime

    class Config:
        from_attributes = True

class CourseExploreItem(BaseModel):
    id: int
    title: str
    code: str
    description: str | None = None
    category: str
    difficulty: str = "Intermediate"
    thumbnail_url: str | None = None
    educator_id: int
    educator_name: str
    average_rating: float = 4.9
    total_ratings: int = 0
    modules_count: int = 0
    topics_count: int = 0
    is_enrolled: bool = False
    created_at: datetime

class CourseRatingCreate(BaseModel):
    rating: float = Field(..., ge=1.0, le=5.0)
    review: str | None = None

class CourseRatingResponse(BaseModel):
    id: int
    course_id: int
    user_id: int
    user_name: str
    rating: float
    review: str | None = None
    created_at: datetime

class CourseRatingsSummary(BaseModel):
    course_id: int
    average_rating: float
    total_ratings: int
    user_rating: float | None = None
    user_review: str | None = None
    reviews: list[CourseRatingResponse] = []

class TopicRatingCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    feedback: str | None = None

class TopicRatingResponse(BaseModel):
    id: int
    topic_id: int
    user_id: int
    rating: int
    feedback: str | None = None
    created_at: datetime

class TopicRatingSummary(BaseModel):
    topic_id: int
    average_rating: float
    total_ratings: int
    user_rating: int | None = None

class DocumentResponse(BaseModel):
    id: int
    course_id: int
    title: str
    file_type: str
    chunk_count: int
    topic: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True

# ==========================================
# RAG & Tutor Schemas
# ==========================================
class Citation(BaseModel):
    source_title: str
    page_or_chunk: str
    snippet: str
    similarity_score: float

class TutorQueryRequest(BaseModel):
    course_id: int
    module_id: int | None = None
    topic_id: int | None = None
    query: str
    target_language: str = "en"  # "en", "hi", "te", "ta", "kn", "bn", "mr"
    audio_base64: str | None = None

class SupplementaryVideoResponse(BaseModel):
    title: str
    youtube_video_id: str
    embed_url: str
    channel: str | None = "CogniPath Knowledge Base"
    duration: str | None = "10 mins"
    relevance_reason: str
    timestamp_anchor: int | None = 0

class SupplementaryVideoSuggestRequest(BaseModel):
    course_id: int | None = None
    module_id: int | None = None
    topic: str
    query: str | None = None

class TutorQueryResponse(BaseModel):
    answer: str
    citations: list[Citation]
    language: str
    audio_base64: str | None = None
    processing_time_ms: int
    suggested_video: SupplementaryVideoResponse | None = None

# ==========================================
# Spaced Repetition & Quiz Schemas
# ==========================================
class QuizQuestionSchema(BaseModel):
    id: int
    question_text: str
    options: list[str]
    correct_option_index: int
    explanation: str | None = None
    source_chunk_ref: str | None = None

class QuizResponse(BaseModel):
    id: int
    course_id: int
    topic: str
    title: str
    difficulty_level: str
    questions: list[QuizQuestionSchema]

class QuizSubmitRequest(BaseModel):
    quiz_id: int
    answers: dict[int, int]  # question_id -> selected_option_index
    quality_rating: int | None = Field(None, ge=0, le=5)  # SM-2 rating 0 to 5

class QuizSubmitResponse(BaseModel):
    score: float
    total_questions: int
    percentage: float
    passed: bool
    next_review_date: datetime
    new_interval_days: int
    feedback: str

class SpacedConceptItem(BaseModel):
    id: int
    concept_tag: str
    repetition_interval: int
    difficulty_factor: float
    repetitions: int
    next_review_date: datetime
    is_due: bool

# ==========================================
# Educator Analytics Schemas
# ==========================================
class AtRiskStudent(BaseModel):
    student_id: int
    student_name: str
    email: str
    average_quiz_score: float
    days_inactive: int
    struggling_topics: list[str]
    risk_level: str  # HIGH, MEDIUM, LOW
    risk_reasons: list[str]

class TopicDifficultyStat(BaseModel):
    topic: str
    failure_rate: float
    average_score: float
    doubt_query_count: int

class EducatorDashboardOverview(BaseModel):
    total_students: int
    active_students_last_week: int
    average_class_score: float
    total_courses: int
    total_documents_indexed: int
    at_risk_count: int
    at_risk_students: list[AtRiskStudent]
    topic_difficulties: list[TopicDifficultyStat]

class StudentRecommendationItem(BaseModel):
    id: str
    topic_title: str
    course_id: int
    course_title: str
    category: str
    difficulty: str
    reason: str

class StudentDashboardOverview(BaseModel):
    user_id: int
    user_name: str
    streak_days: int = 1
    overall_score: float = 0.0
    topics_completed: int = 0
    total_topics: int = 0
    enrolled_courses_count: int = 0
    recommendations: list[StudentRecommendationItem] = []

# ==========================================
# Native Learning Pods & Community Schemas
# ==========================================
class PodCreate(BaseModel):
    title: str
    course_id: int
    topic: str
    agenda: str | None = None
    passcode: str | None = None
    kshetra_meeting_code: str | None = None
    # NOTE: Mesh WebRTC is capped at max 6 peers. >6 requires an SFU (e.g. LiveKit).
    max_peers: int = 6
    scheduled_duration_minutes: int | None = 45

class PodResponse(BaseModel):
    id: int
    title: str
    course_id: int
    host_id: int
    topic: str
    agenda: str | None = None
    has_passcode: bool = False
    host_name: str | None = None
    is_active: bool
    max_peers: int
    scheduled_duration_minutes: int = 45
    started_at: datetime | None = None
    expires_at: datetime | None = None
    ended_at: datetime | None = None
    status: str = "ACTIVE"
    remaining_seconds: int | None = None
    kshetra_meeting_code: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True

class PodEndRequest(BaseModel):
    reason: str | None = "Host terminated session"

class PodEndResponse(BaseModel):
    pod_id: int
    status: str
    reason: str
    ended_at: datetime
    duration_minutes: float
    total_participants: int

class PodMessageSchema(BaseModel):
    id: int
    pod_id: int
    user_id: int | None = None
    sender_name: str
    content: str
    is_ai_tutor: bool
    created_at: datetime

    class Config:
        from_attributes = True

class CommunityChannelResponse(BaseModel):
    id: int
    course_id: int
    name: str
    description: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True

class CommunityMessageCreate(BaseModel):
    content: str

class CommunityMessageResponse(BaseModel):
    id: int
    channel_id: int
    user_id: int
    author_name: str
    author_role: str
    content: str
    upvotes: int
    is_solution: bool
    created_at: datetime

    class Config:
        from_attributes = True

# ==========================================
# Enhanced Socratic & Concept Mindmap Schemas
# ==========================================
class MindmapNode(BaseModel):
    id: str
    label: str
    category: str = "concept"  # root, concept, prerequisite, formula, warning

class MindmapEdge(BaseModel):
    source: str
    target: str
    label: str | None = None

class ConceptMindmap(BaseModel):
    title: str
    nodes: list[MindmapNode]
    edges: list[MindmapEdge]
    mermaid_code: str

class SocraticQueryRequest(BaseModel):
    course_id: int
    query: str
    student_attempt: str | None = None
    target_language: str = "en"

class SocraticQueryResponse(BaseModel):
    stage: str  # PROBING, HINT, VERIFICATION, MASTERY
    probing_question: str
    pedagogical_guidance: str
    concept_mindmap: ConceptMindmap | None = None
    citations: list[Citation]
    latency_ms: int

# ==========================================
# Adaptive Roadmap & Mastery Schemas
# ==========================================
class SkillMasteryItem(BaseModel):
    topic: str
    mastery_percentage: float
    status: str  # MASTERED, IN_PROGRESS, AT_RISK
    review_due: bool

class RoadmapActionItem(BaseModel):
    id: str
    title: str
    topic: str
    action_type: str  # READ_RECAP, RETRY_QUIZ, WATCH_POD, PRACTICE_PROBLEMS
    estimated_mins: int
    xp_reward: int
    is_completed: bool = False
    action_url_target: str

class LearningRoadmapResponse(BaseModel):
    total_xp: int
    streak_days: int
    current_level: str
    skills: list[SkillMasteryItem]
    next_best_actions: list[RoadmapActionItem]

# ==========================================
# Educator Curriculum Health & Bloom's Schemas
# ==========================================
class PrerequisiteGapItem(BaseModel):
    advanced_concept: str
    missing_prerequisite: str
    severity: str  # HIGH, MEDIUM
    remediation_suggestion: str

class BloomsQuestionItem(BaseModel):
    level: str  # REMEMBER, UNDERSTAND, APPLY, ANALYZE
    question: str
    options: list[str]
    correct_index: int
    explanation: str
    syllabus_source: str

class CurriculumAuditResponse(BaseModel):
    health_score: float  # 0 to 100
    grade_rating: str    # A+, A, B, C
    total_chunks_analyzed: int
    prerequisite_gaps: list[PrerequisiteGapItem]
    blooms_balance: dict[str, int]  # e.g. {"REMEMBER": 35, "UNDERSTAND": 30, "APPLY": 20, "ANALYZE": 15}
    recommendations: list[str]

# ==============================================================================
# HIERARCHICAL CONTENT DELIVERY ENGINE SCHEMAS
# ==============================================================================
class TopicBase(BaseModel):
    title: str
    description: str | None = None
    youtube_url: str

class TopicCreate(TopicBase):
    pass

class TopicResponse(TopicBase):
    id: int
    module_id: int
    youtube_video_id: str
    order_index: int
    created_at: datetime
    class Config:
        from_attributes = True

class ModuleResourceResponse(BaseModel):
    id: int
    module_id: int
    title: str
    file_url: str
    file_type: str
    is_view_only: bool
    chunk_count: int
    created_at: datetime
    class Config:
        from_attributes = True

class ModuleCreate(BaseModel):
    title: str
    description: str | None = None
    has_module_exam: bool | None = False

class ModuleResponse(BaseModel):
    id: int
    course_id: int
    title: str
    description: str | None = None
    order_index: int
    has_module_exam: bool = False
    module_exam_id: int | None = None
    created_at: datetime
    topics: list[TopicResponse] = []
    resources: list[ModuleResourceResponse] = []
    module_exam: Any | None = None
    class Config:
        from_attributes = True

class ModuleUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    order_index: int | None = None
    has_module_exam: bool | None = None
    module_exam_id: int | None = None

class TopicUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    youtube_url: str | None = None
    order_index: int | None = None

class CourseHierarchyResponse(BaseModel):
    id: int
    title: str
    code: str
    description: str | None = None
    category: str
    difficulty: str | None = "Intermediate"
    thumbnail_url: str | None = None
    educator_id: int
    created_at: datetime
    modules: list[ModuleResponse] = []
    final_exam: Optional[Any] = None

    class Config:
        from_attributes = True

# ==============================================================================
# DUAL-ENGINE ASSESSMENT SCHEMAS (EXAMS, BUILDER, AUTO-GRADING)
# ==============================================================================
class ExamQuestionSchema(BaseModel):
    id: int | None = None
    question_type: str = "MCQ"  # MCQ or SHORT_ANSWER
    question_text: str
    options: list[str] | None = None
    correct_answer: str | None = None
    explanation: str | None = None
    source_ref: str | None = None
    order_index: int = 1

class ExamCreate(BaseModel):
    course_id: int
    module_id: int | None = None
    exam_type: str = "MODULE_QUIZ"
    scope: str = "MODULE_END"
    title: str
    time_limit_mins: int = 20
    passing_score: float = 60.0
    questions: list[ExamQuestionSchema] | None = None

class ExamResponse(BaseModel):
    id: int
    course_id: int
    module_id: int | None = None
    exam_type: str
    scope: str = "MODULE_END"
    title: str
    time_limit_mins: int
    passing_score: float
    created_at: datetime
    questions: list[ExamQuestionSchema] = []
    class Config:
        from_attributes = True

# ==============================================================================
# RAG-POWERED MODULE MCQ GENERATION SCHEMAS
# ==============================================================================
class RAGMCQItem(BaseModel):
    question_id: str
    question_text: str
    options: list[str]
    correct_option: str  # "A", "B", "C", or "D"
    explanation: str
    source_reference: str

class RAGMCQGenerateRequest(BaseModel):
    course_id: int | None = None
    topic: str | None = None
    count: int = 4
    difficulty: str = "Intermediate"

class RAGMCQGenerateResponse(BaseModel):
    module_id: int
    course_id: int
    count: int
    questions: list[RAGMCQItem]
    sources_used: list[str] = []

class ModuleExamCreateRequest(BaseModel):
    title: str
    time_limit_mins: int = 20
    passing_score: float = 60.0
    scope: str = "MODULE_END"
    questions: list[ExamQuestionSchema]

# ==============================================================================
# LIGHTWEIGHT TABBED NAVIGATION SUMMARY SCHEMAS
# ==============================================================================
class TabsSummaryModule(BaseModel):
    id: int
    title: str
    order_index: int
    topics_count: int
    resources_count: int
    has_module_exam: bool
    module_exam_id: int | None = None
    is_completed: bool = False

class TabsSummaryCourse(BaseModel):
    id: int
    code: str
    title: str
    category: str
    difficulty: str = "Intermediate"
    completion_percentage: float = 0.0
    modules: list[TabsSummaryModule] = []

class TabsSummaryResponse(BaseModel):
    courses: list[TabsSummaryCourse]

class ExamReorderItem(BaseModel):
    question_id: int
    order_index: int

class ExamReorderRequest(BaseModel):
    question_orders: list[ExamReorderItem]

class ExamSubmitItem(BaseModel):
    question_id: int
    selected_option: Any | None = None
    short_answer: str | None = None

class ExamSubmitRequest(BaseModel):
    responses: list[ExamSubmitItem]

class ExamSubmitResponse(BaseModel):
    submission_id: int
    exam_id: int
    score: float
    percentage: float
    passed: bool
    total_questions: int
    correct_count: int
    evaluated_at: datetime
    unlocked_badge: dict[str, Any] | None = None

class AISuggestionItem(BaseModel):
    temp_id: str
    question_type: str
    question_text: str
    options: list[str] | None = None
    correct_answer: str
    explanation: str
    source_ref: str
    bloom_level: str | None = None

class AISuggestionRequest(BaseModel):
    course_id: int
    module_id: int | None = None
    topic: str | None = "General Curriculum"
    count: int = 3
    difficulty: str = "Intermediate"

class AISuggestionResponse(BaseModel):
    topic: str
    suggestions: list[AISuggestionItem]

# ==============================================================================
# GAMIFICATION & VERIFIED BADGES
# ==============================================================================
class StudentBadgeResponse(BaseModel):
    id: int
    student_id: int
    course_id: int
    badge_name: str
    badge_image_url: str | None = None
    difficulty_level: str
    verification_hash: str
    issued_at: datetime
    student_name: str | None = None
    course_title: str | None = None
    class Config:
        from_attributes = True

# ==============================================================================
# ASSIGNMENT & AI AUTO-EVALUATION SCHEMAS
# ==============================================================================
class RubricCriterion(BaseModel):
    criterion: str
    max_points: float
    description: str | None = None

class AssignmentCreate(BaseModel):
    module_id: int
    title: str
    description: str
    assignment_type: str = "PRACTICAL_PDF"
    rubric: list[RubricCriterion]
    model_answer: str | None = None
    max_score: float = 100.0

class AssignmentResponse(BaseModel):
    id: int
    module_id: int
    title: str
    description: str
    assignment_type: str
    rubric: list[RubricCriterion]
    model_answer: str | None = None
    max_score: float
    created_at: datetime
    class Config:
        from_attributes = True

class CriterionScoreItem(BaseModel):
    criterion: str
    awarded_points: float
    max_points: float
    feedback: str

class AIEvaluationFeedback(BaseModel):
    overall_score: float
    percentage: float
    criteria_scores: list[CriterionScoreItem]
    strengths: list[str]
    weaknesses: list[str]
    actionable_feedback: str

class AssignmentSubmissionResponse(BaseModel):
    id: int
    assignment_id: int
    student_id: int
    submitted_file_url: str | None = None
    ai_score: float | None = None
    ai_feedback: AIEvaluationFeedback | None = None
    status: str
    submitted_at: datetime
    class Config:
        from_attributes = True

# ==============================================================================
# LEARNING POD MODERATION & SECURITY SCHEMAS
# ==============================================================================
class PodPasscodeVerifyRequest(BaseModel):
    passcode: str

class PodPasscodeVerifyResponse(BaseModel):
    verified: bool
    is_blacklisted: bool
    message: str


class TopicCompleteRequest(BaseModel):
    is_completed: bool = True


class TopicCompleteResponse(BaseModel):
    status: str
    topic_id: int
    is_completed: bool
    completion_percentage: float
    completed_topic_ids: list[int]


