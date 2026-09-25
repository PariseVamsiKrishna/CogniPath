-- ====================================================================
-- COGNIPATH (SmartLearn SIH 2026) - Comprehensive Supabase Cloud Schema
-- Compatible with PostgreSQL 15 & 16 with pgvector extension
-- ====================================================================

-- 1. Enable Required PostgreSQL Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 2. Table Creation (CREATE TABLE IF NOT EXISTS)
-- Table: users
CREATE TABLE IF NOT EXISTS users (
	id SERIAL NOT NULL, 
	email VARCHAR(255) NOT NULL, 
	hashed_password VARCHAR(255) NOT NULL, 
	full_name VARCHAR(255) NOT NULL, 
	role VARCHAR(50) NOT NULL, 
	avatar_url VARCHAR(512), 
	created_at TIMESTAMP WITH TIME ZONE, 
	university VARCHAR(255), 
	department VARCHAR(255), 
	institutional_email VARCHAR(255), 
	student_year VARCHAR(100), 
	student_id_num VARCHAR(100), 
	highest_qualification VARCHAR(100), 
	designation VARCHAR(100), 
	profile_completed BOOLEAN NOT NULL, 
	PRIMARY KEY (id)
);

-- Table: courses
CREATE TABLE IF NOT EXISTS courses (
	id SERIAL NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	code VARCHAR(50) NOT NULL, 
	description TEXT, 
	category VARCHAR(100), 
	difficulty VARCHAR(50), 
	thumbnail_url VARCHAR(512), 
	educator_id INTEGER NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(educator_id) REFERENCES users (id)
);

-- Table: enrollments
CREATE TABLE IF NOT EXISTS enrollments (
	id SERIAL NOT NULL, 
	user_id INTEGER NOT NULL, 
	course_id INTEGER NOT NULL, 
	completion_percentage FLOAT, 
	enrolled_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id), 
	FOREIGN KEY(course_id) REFERENCES courses (id)
);

-- Table: documents
CREATE TABLE IF NOT EXISTS documents (
	id SERIAL NOT NULL, 
	course_id INTEGER NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	file_path VARCHAR(512) NOT NULL, 
	file_type VARCHAR(50) NOT NULL, 
	chunk_count INTEGER, 
	topic VARCHAR(255), 
	uploaded_by INTEGER NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(course_id) REFERENCES courses (id), 
	FOREIGN KEY(uploaded_by) REFERENCES users (id)
);

-- Table: quizzes
CREATE TABLE IF NOT EXISTS quizzes (
	id SERIAL NOT NULL, 
	course_id INTEGER NOT NULL, 
	topic VARCHAR(255) NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	difficulty_level VARCHAR(50), 
	created_by INTEGER, 
	created_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(course_id) REFERENCES courses (id), 
	FOREIGN KEY(created_by) REFERENCES users (id)
);

-- Table: quiz_questions
CREATE TABLE IF NOT EXISTS quiz_questions (
	id SERIAL NOT NULL, 
	quiz_id INTEGER NOT NULL, 
	question_text TEXT NOT NULL, 
	options TEXT NOT NULL, 
	correct_option_index INTEGER NOT NULL, 
	explanation TEXT, 
	source_chunk_ref VARCHAR(255), 
	PRIMARY KEY (id), 
	FOREIGN KEY(quiz_id) REFERENCES quizzes (id)
);

-- Table: student_quiz_attempts
CREATE TABLE IF NOT EXISTS student_quiz_attempts (
	id SERIAL NOT NULL, 
	user_id INTEGER NOT NULL, 
	quiz_id INTEGER NOT NULL, 
	score FLOAT NOT NULL, 
	max_score FLOAT, 
	total_questions INTEGER NOT NULL, 
	answers_json TEXT, 
	completed_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id), 
	FOREIGN KEY(quiz_id) REFERENCES quizzes (id)
);

-- Table: student_concept_retention
CREATE TABLE IF NOT EXISTS student_concept_retention (
	id SERIAL NOT NULL, 
	user_id INTEGER NOT NULL, 
	course_id INTEGER NOT NULL, 
	concept_tag VARCHAR(255) NOT NULL, 
	topic VARCHAR(255), 
	repetition_interval INTEGER, 
	difficulty_factor FLOAT, 
	repetitions INTEGER, 
	next_review_date TIMESTAMP WITH TIME ZONE, 
	last_reviewed_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id), 
	FOREIGN KEY(course_id) REFERENCES courses (id)
);

-- Table: student_activity_logs
CREATE TABLE IF NOT EXISTS student_activity_logs (
	id SERIAL NOT NULL, 
	user_id INTEGER NOT NULL, 
	course_id INTEGER NOT NULL, 
	action_type VARCHAR(100) NOT NULL, 
	activity_type VARCHAR(100), 
	query_text TEXT, 
	response_time_ms INTEGER, 
	metadata_info TEXT, 
	created_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id), 
	FOREIGN KEY(course_id) REFERENCES courses (id)
);

-- Table: learning_pods
CREATE TABLE IF NOT EXISTS learning_pods (
	id SERIAL NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	course_id INTEGER NOT NULL, 
	host_id INTEGER NOT NULL, 
	topic VARCHAR(255) NOT NULL, 
	agenda TEXT, 
	passcode_hash VARCHAR(255), 
	is_active BOOLEAN, 
	max_peers INTEGER, 
	scheduled_duration_minutes INTEGER, 
	started_at TIMESTAMP WITH TIME ZONE, 
	expires_at TIMESTAMP WITH TIME ZONE, 
	ended_at TIMESTAMP WITH TIME ZONE, 
	status VARCHAR(50), 
	host_last_seen_at TIMESTAMP WITH TIME ZONE, 
	kshetra_meeting_code VARCHAR(100), 
	created_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(course_id) REFERENCES courses (id), 
	FOREIGN KEY(host_id) REFERENCES users (id)
);

-- Table: pod_messages
CREATE TABLE IF NOT EXISTS pod_messages (
	id SERIAL NOT NULL, 
	pod_id INTEGER NOT NULL, 
	user_id INTEGER, 
	sender_name VARCHAR(255) NOT NULL, 
	content TEXT NOT NULL, 
	is_ai_tutor BOOLEAN, 
	created_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(pod_id) REFERENCES learning_pods (id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);

-- Table: community_channels
CREATE TABLE IF NOT EXISTS community_channels (
	id SERIAL NOT NULL, 
	course_id INTEGER NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	description VARCHAR(255), 
	created_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(course_id) REFERENCES courses (id)
);

-- Table: community_messages
CREATE TABLE IF NOT EXISTS community_messages (
	id SERIAL NOT NULL, 
	channel_id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	author_name VARCHAR(255) NOT NULL, 
	author_role VARCHAR(50), 
	content TEXT NOT NULL, 
	upvotes INTEGER, 
	is_solution BOOLEAN, 
	created_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(channel_id) REFERENCES community_channels (id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);

-- Table: student_skill_mastery
CREATE TABLE IF NOT EXISTS student_skill_mastery (
	id SERIAL NOT NULL, 
	user_id INTEGER NOT NULL, 
	course_id INTEGER NOT NULL, 
	topic VARCHAR(255) NOT NULL, 
	mastery_percentage FLOAT, 
	xp_points INTEGER, 
	streak_days INTEGER, 
	last_active_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id), 
	FOREIGN KEY(course_id) REFERENCES courses (id)
);

-- Table: curriculum_audit_reports
CREATE TABLE IF NOT EXISTS curriculum_audit_reports (
	id SERIAL NOT NULL, 
	course_id INTEGER NOT NULL, 
	health_score FLOAT, 
	total_topics INTEGER, 
	prerequisite_gaps_json TEXT, 
	blooms_distribution_json TEXT, 
	generated_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(course_id) REFERENCES courses (id)
);

-- Table: modules
CREATE TABLE IF NOT EXISTS modules (
	id SERIAL NOT NULL, 
	course_id INTEGER NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	description TEXT, 
	order_index INTEGER NOT NULL, 
	module_number INTEGER, 
	has_module_exam BOOLEAN NOT NULL, 
	module_exam_id INTEGER, 
	created_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(course_id) REFERENCES courses (id)
);

-- Table: topics
CREATE TABLE IF NOT EXISTS topics (
	id SERIAL NOT NULL, 
	module_id INTEGER NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	description TEXT, 
	youtube_url VARCHAR(512) NOT NULL, 
	youtube_video_id VARCHAR(50) NOT NULL, 
	order_index INTEGER NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(module_id) REFERENCES modules (id)
);

-- Table: module_resources
CREATE TABLE IF NOT EXISTS module_resources (
	id SERIAL NOT NULL, 
	module_id INTEGER NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	file_url VARCHAR(512) NOT NULL, 
	file_type VARCHAR(50) NOT NULL, 
	is_view_only BOOLEAN NOT NULL, 
	chunk_count INTEGER, 
	created_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(module_id) REFERENCES modules (id)
);

-- Table: exams
CREATE TABLE IF NOT EXISTS exams (
	id SERIAL NOT NULL, 
	course_id INTEGER NOT NULL, 
	module_id INTEGER, 
	exam_type VARCHAR(50) NOT NULL, 
	scope VARCHAR(50) NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	time_limit_mins INTEGER NOT NULL, 
	passing_score FLOAT NOT NULL, 
	created_by INTEGER, 
	created_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(course_id) REFERENCES courses (id), 
	FOREIGN KEY(module_id) REFERENCES modules (id), 
	FOREIGN KEY(created_by) REFERENCES users (id)
);

-- Table: exam_questions
CREATE TABLE IF NOT EXISTS exam_questions (
	id SERIAL NOT NULL, 
	exam_id INTEGER NOT NULL, 
	question_type VARCHAR(50) NOT NULL, 
	question_text TEXT NOT NULL, 
	options TEXT, 
	correct_answer TEXT NOT NULL, 
	explanation TEXT, 
	source_ref VARCHAR(255), 
	order_index INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(exam_id) REFERENCES exams (id)
);

-- Table: exam_submissions
CREATE TABLE IF NOT EXISTS exam_submissions (
	id SERIAL NOT NULL, 
	exam_id INTEGER NOT NULL, 
	student_id INTEGER NOT NULL, 
	score FLOAT NOT NULL, 
	percentage FLOAT NOT NULL, 
	passed BOOLEAN NOT NULL, 
	responses_json TEXT NOT NULL, 
	evaluated_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(exam_id) REFERENCES exams (id), 
	FOREIGN KEY(student_id) REFERENCES users (id)
);

-- Table: student_badges
CREATE TABLE IF NOT EXISTS student_badges (
	id SERIAL NOT NULL, 
	student_id INTEGER NOT NULL, 
	course_id INTEGER NOT NULL, 
	badge_name VARCHAR(255) NOT NULL, 
	badge_image_url VARCHAR(512), 
	difficulty_level VARCHAR(50), 
	verification_hash VARCHAR(64) NOT NULL, 
	issued_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(student_id) REFERENCES users (id), 
	FOREIGN KEY(course_id) REFERENCES courses (id)
);

-- Table: assignments
CREATE TABLE IF NOT EXISTS assignments (
	id SERIAL NOT NULL, 
	module_id INTEGER NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	description TEXT NOT NULL, 
	assignment_type VARCHAR(50) NOT NULL, 
	rubric_json TEXT NOT NULL, 
	model_answer TEXT, 
	max_score FLOAT NOT NULL, 
	deadline TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(module_id) REFERENCES modules (id)
);

-- Table: assignment_submissions
CREATE TABLE IF NOT EXISTS assignment_submissions (
	id SERIAL NOT NULL, 
	assignment_id INTEGER NOT NULL, 
	student_id INTEGER NOT NULL, 
	submitted_file_url VARCHAR(512), 
	extracted_text TEXT, 
	ai_score FLOAT, 
	ai_feedback_json TEXT, 
	manual_score FLOAT, 
	educator_notes TEXT, 
	status VARCHAR(50) NOT NULL, 
	submitted_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(assignment_id) REFERENCES assignments (id), 
	FOREIGN KEY(student_id) REFERENCES users (id)
);

-- Table: pod_blacklists
CREATE TABLE IF NOT EXISTS pod_blacklists (
	id SERIAL NOT NULL, 
	pod_id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	reason VARCHAR(255), 
	kicked_at TIMESTAMP WITH TIME ZONE, 
	kicked_by INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(pod_id) REFERENCES learning_pods (id), 
	FOREIGN KEY(user_id) REFERENCES users (id), 
	FOREIGN KEY(kicked_by) REFERENCES users (id)
);

-- Table: educator_pod_quotas
CREATE TABLE IF NOT EXISTS educator_pod_quotas (
	id SERIAL NOT NULL, 
	educator_id INTEGER NOT NULL, 
	day_date VARCHAR(20) NOT NULL, 
	week_start_date VARCHAR(20) NOT NULL, 
	daily_created INTEGER NOT NULL, 
	weekly_created INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(educator_id) REFERENCES users (id)
);

-- Table: course_ratings
CREATE TABLE IF NOT EXISTS course_ratings (
	id SERIAL NOT NULL, 
	course_id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	rating FLOAT NOT NULL, 
	review TEXT, 
	created_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_course_user_rating UNIQUE (course_id, user_id), 
	FOREIGN KEY(course_id) REFERENCES courses (id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);

-- Table: topic_ratings
CREATE TABLE IF NOT EXISTS topic_ratings (
	id SERIAL NOT NULL, 
	topic_id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	rating INTEGER NOT NULL, 
	feedback VARCHAR(500), 
	created_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_topic_user_rating UNIQUE (topic_id, user_id), 
	FOREIGN KEY(topic_id) REFERENCES topics (id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);

-- 3. Drop NOT NULL on Legacy Schema Columns
ALTER TABLE IF EXISTS "modules" ALTER COLUMN "module_number" DROP NOT NULL;
ALTER TABLE IF EXISTS "modules" ALTER COLUMN "module_number" SET DEFAULT 1;
ALTER TABLE IF EXISTS "student_quiz_attempts" ALTER COLUMN "max_score" DROP NOT NULL;
ALTER TABLE IF EXISTS "student_quiz_attempts" ALTER COLUMN "max_score" SET DEFAULT 100.0;
ALTER TABLE IF EXISTS "student_concept_retention" ALTER COLUMN "topic" DROP NOT NULL;
ALTER TABLE IF EXISTS "student_concept_retention" ALTER COLUMN "topic" SET DEFAULT 'General';
ALTER TABLE IF EXISTS "student_activity_logs" ALTER COLUMN "activity_type" DROP NOT NULL;
ALTER TABLE IF EXISTS "student_activity_logs" ALTER COLUMN "activity_type" SET DEFAULT 'GENERAL';
ALTER TABLE IF EXISTS "topics" ALTER COLUMN "summary" DROP NOT NULL;
ALTER TABLE IF EXISTS "documents" ALTER COLUMN "file_size" DROP NOT NULL;
ALTER TABLE IF EXISTS "documents" ALTER COLUMN "chunks_count" DROP NOT NULL;

-- 4. Idempotent Column Synchronization for Existing Databases
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "hashed_password" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "full_name" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" VARCHAR(50) DEFAULT 'STUDENT';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_url" VARCHAR(512);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "university" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "department" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "institutional_email" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "student_year" VARCHAR(100);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "student_id_num" VARCHAR(100);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "highest_qualification" VARCHAR(100);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "designation" VARCHAR(100);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profile_completed" BOOLEAN DEFAULT FALSE;

ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "title" VARCHAR(255);
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "code" VARCHAR(50);
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "category" VARCHAR(100) DEFAULT 'Computer Science';
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "difficulty" VARCHAR(50) DEFAULT 'Intermediate';
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "thumbnail_url" VARCHAR(512);
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "educator_id" INTEGER;
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "user_id" INTEGER;
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "course_id" INTEGER;
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "completion_percentage" FLOAT DEFAULT 0.0;
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "enrolled_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "course_id" INTEGER;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "title" VARCHAR(255);
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "file_path" VARCHAR(512);
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "file_type" VARCHAR(50);
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "chunk_count" INTEGER DEFAULT 0;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "topic" VARCHAR(255);
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "uploaded_by" INTEGER;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "quizzes" ADD COLUMN IF NOT EXISTS "course_id" INTEGER;
ALTER TABLE "quizzes" ADD COLUMN IF NOT EXISTS "topic" VARCHAR(255);
ALTER TABLE "quizzes" ADD COLUMN IF NOT EXISTS "title" VARCHAR(255);
ALTER TABLE "quizzes" ADD COLUMN IF NOT EXISTS "difficulty_level" VARCHAR(50) DEFAULT 'medium';
ALTER TABLE "quizzes" ADD COLUMN IF NOT EXISTS "created_by" INTEGER;
ALTER TABLE "quizzes" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "quiz_questions" ADD COLUMN IF NOT EXISTS "quiz_id" INTEGER;
ALTER TABLE "quiz_questions" ADD COLUMN IF NOT EXISTS "question_text" TEXT;
ALTER TABLE "quiz_questions" ADD COLUMN IF NOT EXISTS "options" TEXT;
ALTER TABLE "quiz_questions" ADD COLUMN IF NOT EXISTS "correct_option_index" INTEGER;
ALTER TABLE "quiz_questions" ADD COLUMN IF NOT EXISTS "explanation" TEXT;
ALTER TABLE "quiz_questions" ADD COLUMN IF NOT EXISTS "source_chunk_ref" VARCHAR(255);

ALTER TABLE "student_quiz_attempts" ADD COLUMN IF NOT EXISTS "user_id" INTEGER;
ALTER TABLE "student_quiz_attempts" ADD COLUMN IF NOT EXISTS "quiz_id" INTEGER;
ALTER TABLE "student_quiz_attempts" ADD COLUMN IF NOT EXISTS "score" FLOAT;
ALTER TABLE "student_quiz_attempts" ADD COLUMN IF NOT EXISTS "max_score" FLOAT DEFAULT 100.0;
ALTER TABLE "student_quiz_attempts" ADD COLUMN IF NOT EXISTS "total_questions" INTEGER DEFAULT 5;
ALTER TABLE "student_quiz_attempts" ADD COLUMN IF NOT EXISTS "answers_json" TEXT;
ALTER TABLE "student_quiz_attempts" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "student_concept_retention" ADD COLUMN IF NOT EXISTS "user_id" INTEGER;
ALTER TABLE "student_concept_retention" ADD COLUMN IF NOT EXISTS "course_id" INTEGER;
ALTER TABLE "student_concept_retention" ADD COLUMN IF NOT EXISTS "concept_tag" VARCHAR(255);
ALTER TABLE "student_concept_retention" ADD COLUMN IF NOT EXISTS "topic" VARCHAR(255) DEFAULT 'General';
ALTER TABLE "student_concept_retention" ADD COLUMN IF NOT EXISTS "repetition_interval" INTEGER DEFAULT 1;
ALTER TABLE "student_concept_retention" ADD COLUMN IF NOT EXISTS "difficulty_factor" FLOAT DEFAULT 2.5;
ALTER TABLE "student_concept_retention" ADD COLUMN IF NOT EXISTS "repetitions" INTEGER DEFAULT 0;
ALTER TABLE "student_concept_retention" ADD COLUMN IF NOT EXISTS "next_review_date" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "student_concept_retention" ADD COLUMN IF NOT EXISTS "last_reviewed_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "student_activity_logs" ADD COLUMN IF NOT EXISTS "user_id" INTEGER;
ALTER TABLE "student_activity_logs" ADD COLUMN IF NOT EXISTS "course_id" INTEGER;
ALTER TABLE "student_activity_logs" ADD COLUMN IF NOT EXISTS "action_type" VARCHAR(100);
ALTER TABLE "student_activity_logs" ADD COLUMN IF NOT EXISTS "activity_type" VARCHAR(100) DEFAULT 'GENERAL';
ALTER TABLE "student_activity_logs" ADD COLUMN IF NOT EXISTS "query_text" TEXT;
ALTER TABLE "student_activity_logs" ADD COLUMN IF NOT EXISTS "response_time_ms" INTEGER;
ALTER TABLE "student_activity_logs" ADD COLUMN IF NOT EXISTS "metadata_info" TEXT;
ALTER TABLE "student_activity_logs" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "learning_pods" ADD COLUMN IF NOT EXISTS "title" VARCHAR(255);
ALTER TABLE "learning_pods" ADD COLUMN IF NOT EXISTS "course_id" INTEGER;
ALTER TABLE "learning_pods" ADD COLUMN IF NOT EXISTS "host_id" INTEGER;
ALTER TABLE "learning_pods" ADD COLUMN IF NOT EXISTS "topic" VARCHAR(255);
ALTER TABLE "learning_pods" ADD COLUMN IF NOT EXISTS "agenda" TEXT DEFAULT 'Collaborative study session';
ALTER TABLE "learning_pods" ADD COLUMN IF NOT EXISTS "passcode_hash" VARCHAR(255);
ALTER TABLE "learning_pods" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT TRUE;
ALTER TABLE "learning_pods" ADD COLUMN IF NOT EXISTS "max_peers" INTEGER DEFAULT 8;
ALTER TABLE "learning_pods" ADD COLUMN IF NOT EXISTS "scheduled_duration_minutes" INTEGER DEFAULT 45;
ALTER TABLE "learning_pods" ADD COLUMN IF NOT EXISTS "started_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "learning_pods" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "learning_pods" ADD COLUMN IF NOT EXISTS "ended_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "learning_pods" ADD COLUMN IF NOT EXISTS "status" VARCHAR(50) DEFAULT 'ACTIVE';
ALTER TABLE "learning_pods" ADD COLUMN IF NOT EXISTS "host_last_seen_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "learning_pods" ADD COLUMN IF NOT EXISTS "kshetra_meeting_code" VARCHAR(100);
ALTER TABLE "learning_pods" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "pod_messages" ADD COLUMN IF NOT EXISTS "pod_id" INTEGER;
ALTER TABLE "pod_messages" ADD COLUMN IF NOT EXISTS "user_id" INTEGER;
ALTER TABLE "pod_messages" ADD COLUMN IF NOT EXISTS "sender_name" VARCHAR(255);
ALTER TABLE "pod_messages" ADD COLUMN IF NOT EXISTS "content" TEXT;
ALTER TABLE "pod_messages" ADD COLUMN IF NOT EXISTS "is_ai_tutor" BOOLEAN DEFAULT FALSE;
ALTER TABLE "pod_messages" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "community_channels" ADD COLUMN IF NOT EXISTS "course_id" INTEGER;
ALTER TABLE "community_channels" ADD COLUMN IF NOT EXISTS "name" VARCHAR(100);
ALTER TABLE "community_channels" ADD COLUMN IF NOT EXISTS "description" VARCHAR(255);
ALTER TABLE "community_channels" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "community_messages" ADD COLUMN IF NOT EXISTS "channel_id" INTEGER;
ALTER TABLE "community_messages" ADD COLUMN IF NOT EXISTS "user_id" INTEGER;
ALTER TABLE "community_messages" ADD COLUMN IF NOT EXISTS "author_name" VARCHAR(255);
ALTER TABLE "community_messages" ADD COLUMN IF NOT EXISTS "author_role" VARCHAR(50) DEFAULT 'STUDENT';
ALTER TABLE "community_messages" ADD COLUMN IF NOT EXISTS "content" TEXT;
ALTER TABLE "community_messages" ADD COLUMN IF NOT EXISTS "upvotes" INTEGER DEFAULT 0;
ALTER TABLE "community_messages" ADD COLUMN IF NOT EXISTS "is_solution" BOOLEAN DEFAULT FALSE;
ALTER TABLE "community_messages" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "student_skill_mastery" ADD COLUMN IF NOT EXISTS "user_id" INTEGER;
ALTER TABLE "student_skill_mastery" ADD COLUMN IF NOT EXISTS "course_id" INTEGER;
ALTER TABLE "student_skill_mastery" ADD COLUMN IF NOT EXISTS "topic" VARCHAR(255);
ALTER TABLE "student_skill_mastery" ADD COLUMN IF NOT EXISTS "mastery_percentage" FLOAT DEFAULT 0.0;
ALTER TABLE "student_skill_mastery" ADD COLUMN IF NOT EXISTS "xp_points" INTEGER DEFAULT 0;
ALTER TABLE "student_skill_mastery" ADD COLUMN IF NOT EXISTS "streak_days" INTEGER DEFAULT 1;
ALTER TABLE "student_skill_mastery" ADD COLUMN IF NOT EXISTS "last_active_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "curriculum_audit_reports" ADD COLUMN IF NOT EXISTS "course_id" INTEGER;
ALTER TABLE "curriculum_audit_reports" ADD COLUMN IF NOT EXISTS "health_score" FLOAT DEFAULT 85.0;
ALTER TABLE "curriculum_audit_reports" ADD COLUMN IF NOT EXISTS "total_topics" INTEGER DEFAULT 5;
ALTER TABLE "curriculum_audit_reports" ADD COLUMN IF NOT EXISTS "prerequisite_gaps_json" TEXT;
ALTER TABLE "curriculum_audit_reports" ADD COLUMN IF NOT EXISTS "blooms_distribution_json" TEXT;
ALTER TABLE "curriculum_audit_reports" ADD COLUMN IF NOT EXISTS "generated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "modules" ADD COLUMN IF NOT EXISTS "course_id" INTEGER;
ALTER TABLE "modules" ADD COLUMN IF NOT EXISTS "title" VARCHAR(255);
ALTER TABLE "modules" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "modules" ADD COLUMN IF NOT EXISTS "order_index" INTEGER DEFAULT 1;
ALTER TABLE "modules" ADD COLUMN IF NOT EXISTS "module_number" INTEGER DEFAULT 1;
ALTER TABLE "modules" ADD COLUMN IF NOT EXISTS "has_module_exam" BOOLEAN DEFAULT FALSE;
ALTER TABLE "modules" ADD COLUMN IF NOT EXISTS "module_exam_id" INTEGER;
ALTER TABLE "modules" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "topics" ADD COLUMN IF NOT EXISTS "module_id" INTEGER;
ALTER TABLE "topics" ADD COLUMN IF NOT EXISTS "title" VARCHAR(255);
ALTER TABLE "topics" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "topics" ADD COLUMN IF NOT EXISTS "youtube_url" VARCHAR(512);
ALTER TABLE "topics" ADD COLUMN IF NOT EXISTS "youtube_video_id" VARCHAR(50);
ALTER TABLE "topics" ADD COLUMN IF NOT EXISTS "order_index" INTEGER DEFAULT 1;
ALTER TABLE "topics" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "module_resources" ADD COLUMN IF NOT EXISTS "module_id" INTEGER;
ALTER TABLE "module_resources" ADD COLUMN IF NOT EXISTS "title" VARCHAR(255);
ALTER TABLE "module_resources" ADD COLUMN IF NOT EXISTS "file_url" VARCHAR(512);
ALTER TABLE "module_resources" ADD COLUMN IF NOT EXISTS "file_type" VARCHAR(50) DEFAULT 'pdf';
ALTER TABLE "module_resources" ADD COLUMN IF NOT EXISTS "is_view_only" BOOLEAN DEFAULT TRUE;
ALTER TABLE "module_resources" ADD COLUMN IF NOT EXISTS "chunk_count" INTEGER DEFAULT 0;
ALTER TABLE "module_resources" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "course_id" INTEGER;
ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "module_id" INTEGER;
ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "exam_type" VARCHAR(50) DEFAULT 'MODULE_QUIZ';
ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "scope" VARCHAR(50) DEFAULT 'MODULE_END';
ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "title" VARCHAR(255);
ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "time_limit_mins" INTEGER DEFAULT 20;
ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "passing_score" FLOAT DEFAULT 60.0;
ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "created_by" INTEGER;
ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "exam_questions" ADD COLUMN IF NOT EXISTS "exam_id" INTEGER;
ALTER TABLE "exam_questions" ADD COLUMN IF NOT EXISTS "question_type" VARCHAR(50) DEFAULT 'MCQ';
ALTER TABLE "exam_questions" ADD COLUMN IF NOT EXISTS "question_text" TEXT;
ALTER TABLE "exam_questions" ADD COLUMN IF NOT EXISTS "options" TEXT;
ALTER TABLE "exam_questions" ADD COLUMN IF NOT EXISTS "correct_answer" TEXT;
ALTER TABLE "exam_questions" ADD COLUMN IF NOT EXISTS "explanation" TEXT;
ALTER TABLE "exam_questions" ADD COLUMN IF NOT EXISTS "source_ref" VARCHAR(255);
ALTER TABLE "exam_questions" ADD COLUMN IF NOT EXISTS "order_index" INTEGER DEFAULT 1;

ALTER TABLE "exam_submissions" ADD COLUMN IF NOT EXISTS "exam_id" INTEGER;
ALTER TABLE "exam_submissions" ADD COLUMN IF NOT EXISTS "student_id" INTEGER;
ALTER TABLE "exam_submissions" ADD COLUMN IF NOT EXISTS "score" FLOAT;
ALTER TABLE "exam_submissions" ADD COLUMN IF NOT EXISTS "percentage" FLOAT;
ALTER TABLE "exam_submissions" ADD COLUMN IF NOT EXISTS "passed" BOOLEAN DEFAULT FALSE;
ALTER TABLE "exam_submissions" ADD COLUMN IF NOT EXISTS "responses_json" TEXT;
ALTER TABLE "exam_submissions" ADD COLUMN IF NOT EXISTS "evaluated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "student_badges" ADD COLUMN IF NOT EXISTS "student_id" INTEGER;
ALTER TABLE "student_badges" ADD COLUMN IF NOT EXISTS "course_id" INTEGER;
ALTER TABLE "student_badges" ADD COLUMN IF NOT EXISTS "badge_name" VARCHAR(255);
ALTER TABLE "student_badges" ADD COLUMN IF NOT EXISTS "badge_image_url" VARCHAR(512);
ALTER TABLE "student_badges" ADD COLUMN IF NOT EXISTS "difficulty_level" VARCHAR(50) DEFAULT 'Intermediate';
ALTER TABLE "student_badges" ADD COLUMN IF NOT EXISTS "verification_hash" VARCHAR(64);
ALTER TABLE "student_badges" ADD COLUMN IF NOT EXISTS "issued_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "assignments" ADD COLUMN IF NOT EXISTS "module_id" INTEGER;
ALTER TABLE "assignments" ADD COLUMN IF NOT EXISTS "title" VARCHAR(255);
ALTER TABLE "assignments" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "assignments" ADD COLUMN IF NOT EXISTS "assignment_type" VARCHAR(50) DEFAULT 'PRACTICAL_PDF';
ALTER TABLE "assignments" ADD COLUMN IF NOT EXISTS "rubric_json" TEXT;
ALTER TABLE "assignments" ADD COLUMN IF NOT EXISTS "model_answer" TEXT;
ALTER TABLE "assignments" ADD COLUMN IF NOT EXISTS "max_score" FLOAT DEFAULT 100.0;
ALTER TABLE "assignments" ADD COLUMN IF NOT EXISTS "deadline" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "assignments" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "assignment_submissions" ADD COLUMN IF NOT EXISTS "assignment_id" INTEGER;
ALTER TABLE "assignment_submissions" ADD COLUMN IF NOT EXISTS "student_id" INTEGER;
ALTER TABLE "assignment_submissions" ADD COLUMN IF NOT EXISTS "submitted_file_url" VARCHAR(512);
ALTER TABLE "assignment_submissions" ADD COLUMN IF NOT EXISTS "extracted_text" TEXT;
ALTER TABLE "assignment_submissions" ADD COLUMN IF NOT EXISTS "ai_score" FLOAT;
ALTER TABLE "assignment_submissions" ADD COLUMN IF NOT EXISTS "ai_feedback_json" TEXT;
ALTER TABLE "assignment_submissions" ADD COLUMN IF NOT EXISTS "manual_score" FLOAT;
ALTER TABLE "assignment_submissions" ADD COLUMN IF NOT EXISTS "educator_notes" TEXT;
ALTER TABLE "assignment_submissions" ADD COLUMN IF NOT EXISTS "status" VARCHAR(50) DEFAULT 'PENDING';
ALTER TABLE "assignment_submissions" ADD COLUMN IF NOT EXISTS "submitted_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "pod_blacklists" ADD COLUMN IF NOT EXISTS "pod_id" INTEGER;
ALTER TABLE "pod_blacklists" ADD COLUMN IF NOT EXISTS "user_id" INTEGER;
ALTER TABLE "pod_blacklists" ADD COLUMN IF NOT EXISTS "reason" VARCHAR(255) DEFAULT 'Expelled by Host';
ALTER TABLE "pod_blacklists" ADD COLUMN IF NOT EXISTS "kicked_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "pod_blacklists" ADD COLUMN IF NOT EXISTS "kicked_by" INTEGER;

ALTER TABLE "educator_pod_quotas" ADD COLUMN IF NOT EXISTS "educator_id" INTEGER;
ALTER TABLE "educator_pod_quotas" ADD COLUMN IF NOT EXISTS "day_date" VARCHAR(20);
ALTER TABLE "educator_pod_quotas" ADD COLUMN IF NOT EXISTS "week_start_date" VARCHAR(20);
ALTER TABLE "educator_pod_quotas" ADD COLUMN IF NOT EXISTS "daily_created" INTEGER DEFAULT 0;
ALTER TABLE "educator_pod_quotas" ADD COLUMN IF NOT EXISTS "weekly_created" INTEGER DEFAULT 0;

ALTER TABLE "course_ratings" ADD COLUMN IF NOT EXISTS "course_id" INTEGER;
ALTER TABLE "course_ratings" ADD COLUMN IF NOT EXISTS "user_id" INTEGER;
ALTER TABLE "course_ratings" ADD COLUMN IF NOT EXISTS "rating" FLOAT;
ALTER TABLE "course_ratings" ADD COLUMN IF NOT EXISTS "review" TEXT;
ALTER TABLE "course_ratings" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "topic_ratings" ADD COLUMN IF NOT EXISTS "topic_id" INTEGER;
ALTER TABLE "topic_ratings" ADD COLUMN IF NOT EXISTS "user_id" INTEGER;
ALTER TABLE "topic_ratings" ADD COLUMN IF NOT EXISTS "rating" INTEGER;
ALTER TABLE "topic_ratings" ADD COLUMN IF NOT EXISTS "feedback" VARCHAR(500);
ALTER TABLE "topic_ratings" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- 5. High-Performance Query Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_courses_code ON courses(code);
CREATE INDEX IF NOT EXISTS idx_enrollments_user_course ON enrollments(user_id, course_id);
CREATE INDEX IF NOT EXISTS idx_modules_course ON modules(course_id);
CREATE INDEX IF NOT EXISTS idx_topics_module ON topics(module_id);
CREATE INDEX IF NOT EXISTS idx_documents_course ON documents(course_id);
CREATE INDEX IF NOT EXISTS idx_pods_course_status ON learning_pods(course_id, status);
CREATE INDEX IF NOT EXISTS idx_pods_kshetra ON learning_pods(kshetra_meeting_code);
CREATE INDEX IF NOT EXISTS idx_messages_channel ON community_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_activity_user_course ON student_activity_logs(user_id, course_id);
