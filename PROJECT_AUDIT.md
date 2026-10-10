# 📋 COGNIPATH — Comprehensive Project Audit & Architectural Assessment
**Problem Statement:** SIH262070/500 (Smart Education) | **Project:** CogniPath AI-Powered Learning Ecosystem  
**Target Deployments:** Vercel (Frontend) · Render (FastAPI Backend) · Supabase (PostgreSQL Database)  
**Audit Date:** October 6, 2026  

---

## Executive Summary

CogniPath is an AI-powered personalized learning platform built for the Smart India Hackathon (SIH 2026). It combines curriculum-grounded RAG tutoring, SuperMemo SM-2 spaced repetition assessments, educator analytics, WebRTC peer study pods, and Indic multilingual translation via the Government of India Bhashini ULCA API.

This audit evaluates the codebase across frontend, backend, database, and cloud infrastructure (Vercel, Render, and Supabase). The frontend builds cleanly with Vite, and core business logic (SM-2 calculations, heuristics, auth token generation) is functional. However, critical deployment misconfigurations, schema migration gaps, API model deprecations, and security flaws were identified that impact production stability.

---

## 1. Technology Stack

### Frontend
- **Framework & Bundler:** React 18.2.0, Vite 5.1.6 (ES Modules)
- **Styling & Design System:** Tailwind CSS 3.4.1, PostCSS 8.4.38, Autoprefixer 10.4.19
- **HTTP Client:** Axios 1.6.8 with JWT request/response interceptors
- **Icons & Visuals:** Lucide-react 0.359.0, Canvas Confetti 1.9.2
- **Diagramming & Visualization:** Mermaid 12.1.0, Cytoscape, ELKjs, Katex (math formula rendering)
- **Document & Media Export:** jsPDF 4.2.1, html2canvas 1.4.1 (digital credential certificates)
- **Real-Time Communication:** Native Browser WebRTC Mesh API + HTML5 Audio/Video + WebSocket Signaling

### Backend
- **Core Framework:** FastAPI 0.110.0+ / 0.141.1, Uvicorn 0.28.0+ / 0.53.0 (ASGI)
- **Python Version:** Python 3.11.8 (Render production target) / Python 3.14 (local development)
- **Validation & Schemas:** Pydantic v2 (2.13.5) & Pydantic-Settings (2.15.0)
- **Database & ORM:** SQLAlchemy 2.0.28+ (Async Engine & AsyncSessionLocal), Greenlet 3.0.3+
- **Database Drivers:**
  - `aiosqlite` 0.20.0+ (Local SQLite development)
  - `asyncpg` 0.29.0+ (Production PostgreSQL for Supabase pooler)
- **Security & Cryptography:** `python-jose[cryptography]` 3.3.0+, `bcrypt` 4.0.1+ (12 rounds), `passlib`
- **File Parsing:** `pypdf` 4.1.0+ / 6.19.0, `python-docx` 1.1.0+
- **Real-Time Protocols:** `websockets` 12.0+ / 16.1.1, HTTPX 0.27.0+ (async HTTP client)

### AI, Vector Search & External Services
- **LLM Engine:** Google Gemini API (`google-genai` 0.1.0+ / 2.24.0) with OpenAI API fallback (`openai` 1.14.0+)
- **Vector Database:** ChromaDB 0.4.24+ with embedded fallback `InMemoryCollection`
- **Multilingual Pipeline:** Government of India Bhashini ULCA API (NMT translation, ASR speech-to-text, TTS text-to-speech)
- **Algorithm:** SuperMemo SM-2 for adaptive review interval scheduling

---

## 2. Frontend Architecture

### Application Structure & Routing
- **Architecture Style:** Single Page Application (SPA) state-machine architecture managed inside [`frontend/src/App.jsx`](file:///c:/Users/paris/OneDrive/Documents/SIH/cognipath/frontend/src/App.jsx).
- **Navigation Model:** Does **not** use `react-router-dom`. Navigation is driven by an internal `activeTab` string state:
  - `dashboard` → [`DashboardHome.jsx`](file:///c:/Users/paris/OneDrive/Documents/SIH/cognipath/frontend/src/pages/DashboardHome.jsx)
  - `course-player` / `courses` → [`CoursePlayer.jsx`](file:///c:/Users/paris/OneDrive/Documents/SIH/cognipath/frontend/src/pages/CoursePlayer.jsx)
  - `exam-studio` → [`ExamStudio.jsx`](file:///c:/Users/paris/OneDrive/Documents/SIH/cognipath/frontend/src/pages/ExamStudio.jsx)
  - `assignments` → [`AssignmentView.jsx`](file:///c:/Users/paris/OneDrive/Documents/SIH/cognipath/frontend/src/pages/AssignmentView.jsx)
  - `tutor` → [`StudentPortal.jsx`](file:///c:/Users/paris/OneDrive/Documents/SIH/cognipath/frontend/src/pages/StudentPortal.jsx)
  - `roadmap` → [`LearningRoadmapView.jsx`](file:///c:/Users/paris/OneDrive/Documents/SIH/cognipath/frontend/src/pages/LearningRoadmapView.jsx)
  - `quizzes` / `flashcards` → [`SpacedQuizView.jsx`](file:///c:/Users/paris/OneDrive/Documents/SIH/cognipath/frontend/src/pages/SpacedQuizView.jsx)
  - `analytics` → [`EducatorDashboard.jsx`](file:///c:/Users/paris/OneDrive/Documents/SIH/cognipath/frontend/src/pages/EducatorDashboard.jsx)
  - `pods` → [`LearningPods.jsx`](file:///c:/Users/paris/OneDrive/Documents/SIH/cognipath/frontend/src/pages/LearningPods.jsx)
  - `kshetra` → [`LiveKshetraStudio.jsx`](file:///c:/Users/paris/OneDrive/Documents/SIH/cognipath/frontend/src/pages/LiveKshetraStudio.jsx)
  - `community` → [`CommunityFeed.jsx`](file:///c:/Users/paris/OneDrive/Documents/SIH/cognipath/frontend/src/pages/CommunityFeed.jsx)
  - `landing` → [`LandingPage.jsx`](file:///c:/Users/paris/OneDrive/Documents/SIH/cognipath/frontend/src/pages/LandingPage.jsx)
- **State Persistence:**
  - User session: `localStorage.getItem('cognipath_user')` and `localStorage.getItem('cognipath_token')`
  - Course enrollments cache: `localStorage.getItem('cognipath_enrolled_<userId>')`
- **Error Boundaries:** Top-level and main workspace wrapped in [`ErrorBoundary.jsx`](file:///c:/Users/paris/OneDrive/Documents/SIH/cognipath/frontend/src/components/ErrorBoundary.jsx) with reset and reload fallbacks.
- **API Communication Layer:** Centralized in [`frontend/src/services/api.js`](file:///c:/Users/paris/OneDrive/Documents/SIH/cognipath/frontend/src/services/api.js):
  - Automatically parses `VITE_API_BASE_URL`
  - Strips trailing slashes and handles default `/api/v1` base
  - Attaches `Authorization: Bearer <token>` on all outbound requests
  - Clears authentication tokens on HTTP 401 responses

---

## 3. Backend Architecture

### Application Design & Modularity
- **Entry Point:** [`backend/app/main.py`](file:///c:/Users/paris/OneDrive/Documents/SIH/cognipath/backend/app/main.py) with FastAPI async lifespan (`lifespan` context manager):
  1. Executes `init_db()` to create/reconcile relational schemas.
  2. Executes `seed_demo_data()` to populate initial demo users, courses, modules, quizzes, and vectors.
  3. Launches `pod_manager.ensure_monitor_running()` background task for pod heartbeats and expiry.
- **Layered Structure:**
  - **API Layer (`app/api/v1/`):** 13 endpoint routers providing REST and WebSocket interfaces.
  - **Service Layer (`app/services/`):** Encapsulates core business logic in singleton service instances:
    - `rag_service.py`: Anti-hallucination curriculum grounding and prompt assembly.
    - `quiz_service.py`: SuperMemo SM-2 interval calculations and dynamic quiz generation.
    - `analytics_service.py`: At-risk heuristic rules and educator metrics computation.
    - `pod_service.py`: In-memory WebRTC mesh connection manager and signaling broker.
    - `ingestion_service.py`: Text extraction (PDF, DOCX, TXT), recursive chunking (1000 char, 150 overlap).
    - `exam_service.py`: Comprehensive exam evaluations, questions drag-drop reordering, Bloom's suggestions.
    - `assignment_service.py`: Criteria rubric evaluations and submission handling.
    - `socratic_service.py`: Multi-turn question probing and dynamic Mermaid/JSON mindmap generation.
    - `curriculum_audit_service.py`: Syllabus gap analysis and Bloom's taxonomy distribution.
    - `roadmap_service.py`: Adaptive milestone progression.
    - `chroma_service.py`: Vector embeddings via Gemini/OpenAI with fallback `InMemoryCollection`.
    - `bhashini_service.py`: Government of India Dhruva API pipeline for regional language translation.
  - **Data Access Layer (`app/models/` & `app/schemas/`):** SQLAlchemy 2.0 ORM models and Pydantic v2 schemas.

---

## 4. Database and Authentication Setup

### Database Setup
- **Multi-Database Support:**
  - **Development:** SQLite (`sqlite+aiosqlite:///./cognipath.db`) with `check_same_thread=False`.
  - **Production:** PostgreSQL via Supabase (`postgresql+asyncpg://...`).
- **Supabase Cloud Optimizations in `database.py`:**
  - Converts `postgres://` or `postgresql://` URIs to `postgresql+asyncpg://`.
  - When connecting to Supabase transaction pooler (port 6543 / `pooler.supabase.com`), automatically sets `statement_cache_size = 0` to prevent asyncpg prepared statement conflicts with Supavisor.
  - Sets `ssl = "require"` for secure transport.
- **Schema & Tables (28 Relational Tables):**
  - `users`, `courses`, `enrollments`, `documents`, `quizzes`, `quiz_questions`, `student_quiz_attempts`, `student_concept_retention`, `student_activity_logs`
  - `learning_pods`, `pod_messages`, `pod_blacklists`, `educator_pod_quotas`
  - `community_channels`, `community_messages`
  - `modules`, `topics`, `module_resources`, `course_ratings`, `topic_ratings`
  - `exams`, `exam_questions`, `exam_submissions`, `student_badges`
  - `assignments`, `assignment_submissions`
  - `student_skill_mastery`, `curriculum_audit_reports`
- Full SQL setup available in [`backend/supabase_schema.sql`](file:///c:/Users/paris/OneDrive/Documents/SIH/cognipath/backend/supabase_schema.sql), compatible with Postgres 15/16 and `pgvector`.

### Authentication & Authorization
- **Token Mechanism:** Stateless JSON Web Tokens (JWT) signed with `HS256`.
- **Token Expiration:** Configurable via `ACCESS_TOKEN_EXPIRE_MINUTES` (defaults to 1440 minutes / 24 hours).
- **Password Security:** Salted bcrypt hashing via native `bcrypt` package (`gensalt(rounds=12)`), truncated to 72 bytes.
- **Role-Based Access Control (RBAC):**
  - Roles: `STUDENT`, `EDUCATOR`, `ADMIN`
  - Enforced via FastAPI dependency: `require_roles("EDUCATOR", "ADMIN")`
  - Dual login endpoints: Form-urlencoded (`/auth/login`) and JSON (`/auth/login-json`).

---

## 5. Important Environment Variables

| Variable | Scope | Description | Production Value / Best Practice |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Backend | SQLAlchemy connection string | `postgresql+asyncpg://postgres.[ref]:[pwd]@aws-0-[region].pooler.supabase.com:6543/postgres` |
| `SECRET_KEY` | Backend | JWT secret key for signature verification | Must be a cryptographically random string (min 32 chars). Generated automatically on Render if configured. |
| `ALGORITHM` | Backend | JWT algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Backend | Token lifetime in minutes | `1440` (24h) |
| `ENVIRONMENT` | Backend | Environment flag | `production` |
| `GEMINI_API_KEY` | Backend | Google Gemini API Key | Required for LLM features and vector embeddings |
| `GEMINI_MODEL_NAME` | Backend | Model identifier for Gemini | **Must be updated** to supported model (e.g. `gemini-2.5-flash` or `gemini-3.8-flash`) |
| `GEMINI_EMBEDDING_MODEL` | Backend | Gemini embedding model | `gemini-embedding-001` |
| `OPENAI_API_KEY` | Backend | OpenAI API Key (optional fallback) | Optional |
| `BHASHINI_USER_ID` | Backend | Bhashini ULCA User ID | Optional (uses local mock if empty) |
| `BHASHINI_API_KEY` | Backend | Bhashini ULCA API Key | Optional |
| `BHASHINI_PIPELINE_ID` | Backend | Bhashini Pipeline ID | Optional |
| `CHROMA_SERVER_HOST` | Backend | ChromaDB host | `localhost` or internal container name |
| `CHROMA_SERVER_PORT` | Backend | ChromaDB port | `8001` |
| `CORS_ORIGINS` | Backend | Allowed CORS origins | Comma-separated or JSON list of Vercel production domains |
| `VITE_API_BASE_URL` | Frontend | Backend public URL | Required on Vercel: e.g. `https://cognipath-backend.onrender.com` (no trailing slash) |
| `VITE_TURN_URL` | Frontend | WebRTC TURN server URL | Optional: for NAT/firewall traversal |
| `VITE_TURN_USERNAME` | Frontend | TURN username | Optional |
| `VITE_TURN_CREDENTIAL` | Frontend | TURN password | Optional |

---

## 6. API Routes and Endpoints (91 REST + 2 WebSocket)

### Authentication (`/api/v1/auth`)
- `POST /api/v1/auth/register` — Register student or educator
- `POST /api/v1/auth/login` — OAuth2 password grant login
- `POST /api/v1/auth/login-json` — JSON payload login (Axios)
- `GET /api/v1/auth/me` — Get current authenticated user details
- `PUT /api/v1/auth/profile` / `POST /api/v1/auth/profile` — Update profile & academic onboarding
- `PUT /api/v1/auth/onboarding` / `POST /api/v1/auth/onboarding` — Multi-role onboarding endpoint

### Courses & Hierarchical Syllabus (`/api/v1/courses`)
- `GET /api/v1/courses` — List all courses
- `POST /api/v1/courses` — Create new course (Educator/Admin)
- `GET /api/v1/courses/enrolled` & `GET /api/v1/courses/my-courses` — Get user enrolled courses
- `GET /api/v1/courses/explore` — Explore catalog with category and difficulty filters
- `GET /api/v1/courses/{course_id}` — Get single course details
- `DELETE /api/v1/courses/{course_id}` — Permanently delete course & cascaded entities (Creator/Admin)
- `GET /api/v1/courses/{course_id}/hierarchy` — Complete syllabus hierarchy (Course → Modules → Topics & Resources)
- `POST /api/v1/courses/{course_id}/enroll` — Enroll current student
- `POST /api/v1/courses/{course_id}/unenroll` — Unenroll student
- `POST /api/v1/courses/{course_id}/modules` — Create module in course
- `PUT /api/v1/courses/modules/{module_id}` & `DELETE /api/v1/courses/modules/{module_id}` — Update/delete module
- `POST /api/v1/courses/modules/{module_id}/topics` — Add topic lecture with automated YouTube ID parsing
- `PUT /api/v1/courses/topics/{topic_id}` & `DELETE /api/v1/courses/topics/{topic_id}` — Update/delete topic
- `POST /api/v1/courses/modules/{module_id}/resources` — Upload view-only PDF lecture notes
- `GET /api/v1/courses/resources/{resource_id}/view` — Stream view-only PDF with security headers
- `POST /api/v1/courses/modules/{module_id}/generate-exam-rag` — Generate module exam questions via RAG
- `POST /api/v1/courses/modules/{module_id}/exam` — Attach exam to module
- `GET /api/v1/courses/tabs-summary` — Course navigation tabs summary
- `POST /api/v1/courses/{course_id}/rate` & `GET /api/v1/courses/{course_id}/ratings` — 1-5 star course rating
- `POST /api/v1/courses/topics/{topic_id}/rate` & `GET /api/v1/courses/topics/{topic_id}/ratings` — Subtopic ratings
- `GET /api/v1/courses/badges/verify/{verification_hash}` — Cryptographic badge verification

### Document Ingestion (`/api/v1/documents`)
- `POST /api/v1/documents/upload` — Upload PDF/DOCX/TXT; triggers text extraction, chunking, and ChromaDB indexing
- `GET /api/v1/documents/course/{course_id}` — List ingested documents per course

### AI Tutor & Socratic Engine (`/api/v1/tutor` & `/api/v1/socratic`)
- `POST /api/v1/tutor/query` / `POST /api/v1/tutor/chat` — Anti-hallucination RAG tutor with source citations
- `POST /api/v1/tutor/suggest-video` — AI supplementary video recommendation
- `GET /api/v1/tutor/languages` — List supported Indic regional languages
- `POST /api/v1/socratic/query` — Socratic guided inquiry engine
- `GET /api/v1/socratic/mindmap` — Generate dynamic topic concept mindmap (Mermaid/JSON)

### Adaptive Spaced Quizzes (`/api/v1/quizzes`)
- `POST /api/v1/quizzes/generate` — Generate quiz questions based on curriculum
- `POST /api/v1/quizzes/submit` — Submit quiz attempt, calculate SuperMemo SM-2 interval updates
- `GET /api/v1/quizzes/due` — Retrieve items due for spaced review

### Dual-Engine Assessments & Exams (`/api/v1/exams`)
- `GET /api/v1/exams/course/{course_id}` — List exams for course
- `POST /api/v1/exams` — Create quiz or final certification exam
- `GET /api/v1/exams/{exam_id}` — Get exam structure and questions
- `POST /api/v1/exams/{exam_id}/questions` — Add question manually or from AI drawer
- `DELETE /api/v1/exams/{exam_id}/questions/{question_id}` — Remove question from builder
- `PUT /api/v1/exams/{exam_id}/reorder` — Batch update question order indices
- `POST /api/v1/exams/{exam_id}/submit` — Submit exam responses, auto-grade and issue badge if passed
- `POST /api/v1/exams/ai-suggest` — Generate suggested assessment items using curriculum chunks
- `GET /api/v1/exams/badges/student/{student_id}` — Retrieve earned badges
- `GET /api/v1/exams/badges/verify/{verification_hash}` — Public certificate verification

### Assignments & Rubrics (`/api/v1/assignments`)
- `GET /api/v1/assignments/module/{module_id}` — List module assignments
- `POST /api/v1/assignments` — Create assignment with criteria rubric
- `GET /api/v1/assignments/{assignment_id}` — Get assignment details
- `POST /api/v1/assignments/{assignment_id}/submit` — Upload practical assignment submission
- `GET /api/v1/assignments/{assignment_id}/submissions` — Educator view submissions
- `GET /api/v1/assignments/submissions/student/{student_id}` — Student submission history

### Learning Pods & WebSockets (`/api/v1/pods` & `/ws`)
- `GET /api/v1/pods` — List active/scheduled pods for a course
- `POST /api/v1/pods` — Create new study pod with quota enforcement
- `GET /api/v1/pods/{pod_id}` — Get pod details
- `POST /api/v1/pods/{pod_id}/verify-passcode` — Verify pod access passcode
- `GET /api/v1/pods/{pod_id}/messages` — Get pod chat history
- `POST /api/v1/pods/{pod_id}/end` — Terminate pod for everyone (Host/Admin)
- `GET /api/v1/pods/educator/quota` — Check daily and weekly pod limits
- `GET /api/v1/pods/kshetra-meta/{code}` & `GET /api/v1/pods/kshetra-embed/{code}` — Meeting embed metadata
- `WebSocket /api/v1/pods/ws/{room_id}` — WebRTC peer mesh signaling, chat, and `@Tutor` AI co-pilot

### Community Hub (`/api/v1/communities`)
- `GET /api/v1/communities/courses/{course_id}/channels` — List channels (`#general`, `#doubts-and-qa`, `#exam-prep`)
- `GET /api/v1/communities/channels/{channel_id}/messages` — Channel message feed
- `POST /api/v1/communities/channels/{channel_id}/messages` — Post message (enrollment and announcement checks)
- `POST /api/v1/communities/messages/{message_id}/upvote` — Upvote helpful answer
- `GET /api/v1/communities/courses/{course_id}/members` — List course community members
- `DELETE /api/v1/communities/courses/{course_id}/members/{user_id}` — Kick member (Educator/Admin)
- `DELETE /api/v1/communities/courses/{course_id}/close` — Close community channel

### Educator Analytics & Heuristics (`/api/v1/analytics`)
- `GET /api/v1/analytics/educator/overview` — Course completion rates, class averages, at-risk summaries
- `GET /api/v1/analytics/educator/at-risk` — List students flagged by early-warning heuristics
- `POST /api/v1/analytics/educator/intervene/{student_id}` — Dispatch targeted educator intervention
- `GET /api/v1/analytics/student/overview` — Student personal study streaks, mastery, and due items

### Curriculum Health & Roadmap (`/api/v1/curriculum-audit` & `/api/v1/roadmap`)
- `GET /api/v1/curriculum-audit` — Syllabus health score, prerequisite gaps, Bloom's cognitive distribution
- `GET /api/v1/curriculum-audit/blooms-quiz` — Generate cognitive level assessment quiz
- `GET /api/v1/roadmap` — Adaptive milestone roadmap for student
- `POST /api/v1/roadmap/complete-action/{action_id}` — Mark roadmap milestone completed

---

## 7. Main Components and Pages

| Component / Page | Location | Primary Responsibilities |
| :--- | :--- | :--- |
| `LandingPage.jsx` | `frontend/src/pages/` | SIH overview, hero section, interactive feature tabs, quick-login cards |
| `Login.jsx` | `frontend/src/pages/` | Authentication form, role selection, demo persona buttons |
| `DashboardHome.jsx` | `frontend/src/pages/` | Student dashboard, enrolled courses overview, study stats, explore catalog trigger |
| `CoursePlayer.jsx` | `frontend/src/pages/` | Hierarchical course delivery player, embedded YouTube player, view-only PDF notes canvas |
| `StudentPortal.jsx` | `frontend/src/pages/` | Curriculum-grounded AI Tutor interface, audio voice input, citation badges |
| `SpacedQuizView.jsx` | `frontend/src/pages/` | Spaced repetition flashcards and review quizzes powered by SuperMemo SM-2 |
| `ExamStudio.jsx` | `frontend/src/pages/` | Assessment builder with AI question drawer and drag-and-drop reordering |
| `AssignmentView.jsx` | `frontend/src/pages/` | Practical assignments dashboard, PDF submission upload, AI rubric auto-grading |
| `LearningPods.jsx` | `frontend/src/pages/` | Native WebRTC peer video conference, screen share, live chat, `@Tutor` doubts |
| `LiveKshetraStudio.jsx` | `frontend/src/pages/` | Dedicated meeting studio and passcode validation room |
| `CommunityFeed.jsx` | `frontend/src/pages/` | Course discussion forum, upvoting, solution verification, channel selector |
| `EducatorDashboard.jsx` | `frontend/src/pages/` | Analytics overview, at-risk student early warning engine, one-click intervention |
| `LearningRoadmapView.jsx` | `frontend/src/pages/` | Competency map, learning tracks, milestone completions |
| `Navbar.jsx` | `frontend/src/components/` | Top bar with role switcher, Bhashini language picker, user profile modal trigger |
| `Sidebar.jsx` | `frontend/src/components/` | Role-aware navigation sidebar (STUDENT vs EDUCATOR tabs) |
| `AcademicProfileModal.jsx` | `frontend/src/components/` | Multi-role onboarding profile completion (college, department, designation) |
| `CourseCatalogModal.jsx` | `frontend/src/components/` | Global catalog browser to discover and enroll in new courses |
| `CreateCourseModal.jsx` | `frontend/src/components/` | Educator course creation modal |
| `LiveKshetraNative.jsx` | `frontend/src/components/pods/` | Core WebRTC signaling and canvas rendering engine for video pods |

---

## 8. Current Bugs and Obvious Architectural Problems

### Bug 1: Google Gemini Model Deprecation (404 NOT_FOUND)
- **Observed Behavior:** Running backend verification triggered:
  `404 NOT_FOUND: This model models/gemini-2.0-flash is no longer available. Please update your code to use models/gemini-3.8-flash...` and fallback `models/gemini-1.5-flash is not found for API version v1beta`.
- **Root Cause:** In [`backend/app/core/config.py`](file:///c:/Users/paris/OneDrive/Documents/SIH/cognipath/backend/app/core/config.py#L27) and `backend/.env`, `GEMINI_MODEL_NAME` defaults to `gemini-2.0-flash`. The Google Gemini API v1beta endpoint has deprecated this model name.
- **Impact:** All dynamic AI generation (AI Tutor, Socratic guidance, mindmap generation, exam question synthesis, rubric scoring) fails on the live Gemini API and falls back to static hardcoded strings.

### Bug 2: Missing Column in Local SQLite Database (`weekly_created`)
- **Observed Behavior:** Running `test_all_features.py` failed with:
  `sqlalchemy.exc.OperationalError: (sqlite3.OperationalError) no such column: educator_pod_quotas.weekly_created`
- **Root Cause:** When `educator_pod_quotas` was introduced or modified, existing local databases were not migrated. In [`backend/app/core/database.py`](file:///c:/Users/paris/OneDrive/Documents/SIH/cognipath/backend/app/core/database.py#L77-L139), manual PRAGMA column additions were added for `courses`, `learning_pods`, `modules`, `exams`, and `users`, but **omitted** for `educator_pod_quotas`.
- **Impact:** Any call to `GET /api/v1/pods/educator/quota` crashes with an unhandled 500 error in SQLite.

### Bug 3: Missing Root `package.json` Breaks Root NPM Commands
- **Observed Behavior:** Running `npm install` or `npm run dev` in the project root fails immediately with:
  `npm error code ENOENT: open C:\Users\paris\OneDrive\Documents\SIH\cognipath\package.json`
- **Root Cause:** The workspace has a `package-lock.json` at root (88 bytes) but no `package.json`. The actual frontend application lives inside [`frontend/`](file:///c:/Users/paris/OneDrive/Documents/SIH/cognipath/frontend/).

### Bug 4: Test Suite Import Failure (`test_pod.py`)
- **Observed Behavior:** Running `pytest` fails immediately during test collection:
  `ERROR test_pod.py - httpx.ConnectError: All connection attempts failed`
- **Root Cause:** [`backend/test_pod.py`](file:///c:/Users/paris/OneDrive/Documents/SIH/cognipath/backend/test_pod.py#L60) executes `asyncio.run(run())` at top-level module load time instead of inside a test function or `if __name__ == "__main__":` guard. It attempts an HTTP connection to `http://127.0.0.1:8000`, which is not running during pytest collection.

### Bug 5: Unawaited Coroutine in Backend Verification Script
- **Observed Behavior:** [`backend/verify_backend.py`](file:///c:/Users/paris/OneDrive/Documents/SIH/cognipath/backend/verify_backend.py#L109) crashed with:
  `AttributeError: 'coroutine' object has no attribute 'nodes'` with warning `coroutine 'SocraticTutorService.generate_mindmap_for_topic' was never awaited`.
- **Root Cause:** Line 106 called `socratic_service.generate_mindmap_for_topic(...)` synchronously without `await`.

### Bug 6: Duplicate Router Mounts in `main.py`
- In [`backend/app/main.py`](file:///c:/Users/paris/OneDrive/Documents/SIH/cognipath/backend/app/main.py#L63-L64):
  ```python
  app.include_router(pods.router, prefix=settings.API_V1_STR)
  app.include_router(pods.router, prefix="/ws")
  ```
  This creates redundant endpoints such as `GET /ws/pods`, `POST /ws/pods`, `GET /ws/pods/educator/quota`.

---

## 9. Build and Deployment Configuration (Vercel, Render, Supabase)

### Vercel (Frontend Deployment)
- **Configuration Files:** Root [`vercel.json`](file:///c:/Users/paris/OneDrive/Documents/SIH/cognipath/vercel.json) and [`frontend/vercel.json`](file:///c:/Users/paris/OneDrive/Documents/SIH/cognipath/frontend/vercel.json).
- **Vercel Settings Requirement:**
  - If Vercel Root Directory is set to `.`, root `vercel.json` attempts `cd frontend && npm run build` with output `frontend/dist`. However, without a root `package.json`, Vercel's dependency installation step can fail.
  - **Recommended Vercel Setup:** In Vercel Project Settings → General → Root Directory, configure `frontend`. Vercel will then naturally run `npm install` and `npm run build` using `frontend/package.json` and `frontend/dist`.
- **SPA Rewrite Rule:**
  - Both configurations contain:
    ```json
    { "source": "/(.*)", "destination": "/index.html" }
    ```
  - **Critical Deployment Gotcha:** If `VITE_API_BASE_URL` is omitted in Vercel Environment Variables, all frontend requests default to `/api/v1/...`. Vercel's rewrite rule captures these requests and returns HTTP 200 with `index.html`. Axios attempts to parse HTML as JSON, causing instant frontend failure.

### Render (FastAPI Backend Deployment)
- **Configuration File:** [`render.yaml`](file:///c:/Users/paris/OneDrive/Documents/SIH/cognipath/render.yaml).
- **Render Service:**
  - Service type: `web`, runtime: `python`, root directory: `backend`.
  - Build command: `pip install --upgrade pip && pip install -r requirements.txt`
  - Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
  - Health check path: `/health`
- **Render Ephemeral Disk Problem:**
  - Standard Render web services run on stateless containers with **ephemeral disks**.
  - Any files uploaded by educators to `./uploads/` (PDFs, DOCX notes) and local ChromaDB persistence in `./chroma_data/` will be **wiped on container restart or auto-deploy**.
- **Cold Starts:** Free Render instances spin down after 15 minutes of inactivity, resulting in 50–90 second latency on initial student connection.

### Supabase (Database Deployment)
- **Schema Management:** Provided via [`backend/supabase_schema.sql`](file:///c:/Users/paris/OneDrive/Documents/SIH/cognipath/backend/supabase_schema.sql).
- **Connection Configuration:**
  - Render must be supplied with the Supabase connection string in `DATABASE_URL`.
  - To avoid connection limits and prepared statement failures with asyncpg, the Supavisor Pooler URI (port 6543) must be used:
    `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`
  - In [`backend/app/core/database.py`](file:///c:/Users/paris/OneDrive/Documents/SIH/cognipath/backend/app/core/database.py#L32), `statement_cache_size = 0` is correctly applied when port 6543 or `pooler.supabase.com` is detected.
- **Lack of Alembic Migrations:** Future table modifications currently require manual SQL execution in the Supabase SQL editor because no Alembic migration environment is set up.

---

## 10. Security Risks

1. **Privilege Escalation via Profile Update (`/auth/profile`):**
   - In [`backend/app/api/v1/auth.py`](file:///c:/Users/paris/OneDrive/Documents/SIH/cognipath/backend/app/api/v1/auth.py#L136-L139):
     ```python
     requested_role = profile_in.role.upper()
     if requested_role == "ADMIN" and current_user.role != "ADMIN":
         raise HTTPException(status_code=403, detail="Cannot escalate to ADMIN role")
     current_user.role = requested_role
     ```
   - **Vulnerability:** While escalation to `ADMIN` is blocked, any student can submit `{"role": "EDUCATOR"}` and instantly gain full course creation, deletion, document upload, and exam generation rights.
2. **Path Traversal in File Uploads:**
   - In [`backend/app/api/v1/documents.py`](file:///c:/Users/paris/OneDrive/Documents/SIH/cognipath/backend/app/api/v1/documents.py#L50) and [`backend/app/api/v1/courses.py`](file:///c:/Users/paris/OneDrive/Documents/SIH/cognipath/backend/app/api/v1/courses.py#L1015):
     ```python
     filename = file.filename
     file_path = os.path.join(settings.UPLOAD_DIR, f"c{course_id}_{filename}")
     ```
   - `file.filename` is not passed through `os.path.basename` or sanitized. Malicious filenames containing directory traversal characters (e.g. `../../`) could allow writing outside the designated uploads folder.
3. **Missing File Size Validation (Denial of Service):**
   - File uploads in `documents.py` and `courses.py` use `shutil.copyfileobj(file.file, buffer)` directly without verifying `content-length` or streaming byte limits. An attacker can upload gigabyte-sized files and exhaust server disk space.
4. **CORS Specification Violation with Credentials:**
   - In [`backend/app/main.py`](file:///c:/Users/paris/OneDrive/Documents/SIH/cognipath/backend/app/main.py#L47-L53):
     ```python
     app.add_middleware(
         CORSMiddleware,
         allow_origins=["*"],
         allow_credentials=True,
         ...
     )
     ```
   - Under the W3C Fetch / CORS specification, a wildcard origin `*` **cannot** be paired with `allow_credentials=True`. Modern web browsers reject authenticated requests with this header combination.
5. **Hardcoded Fallback Secret Key:**
   - [`backend/app/core/config.py`](file:///c:/Users/paris/OneDrive/Documents/SIH/cognipath/backend/app/core/config.py#L16) has a hardcoded default `SECRET_KEY = "cognipath_super_secure_jwt_secret_key_sih2026_smart_education"`. If an environment variable is omitted in production, an attacker could sign arbitrary JWT tokens and impersonate any user.
6. **Client-Side Auth Bypass / Mock Token Injection:**
   - In [`frontend/src/App.jsx`](file:///c:/Users/paris/OneDrive/Documents/SIH/cognipath/frontend/src/App.jsx#L298-L300) and `handleQuickLogin`:
     ```javascript
     if (!localStorage.getItem('cognipath_token')) {
       localStorage.setItem('cognipath_token', 'local_jwt_' + (validUser.id || Date.now()));
     }
     ```
   - If the backend is down or fails, mock sessions are created locally, which creates confusion regarding whether the system is authenticated against the actual backend.

---

## 11. Missing Error Handling

1. **Unchecked Directory Existence in PDF Streaming:**
   - In [`backend/app/api/v1/courses.py`](file:///c:/Users/paris/OneDrive/Documents/SIH/cognipath/backend/app/api/v1/courses.py#L1066):
     `for candidate in os.listdir(settings.UPLOAD_DIR):`
     If `settings.UPLOAD_DIR` does not exist on disk, `os.listdir()` throws an unhandled `FileNotFoundError`, crashing the request with a 500 error instead of returning 404.
2. **WebSocket Disconnection & Reconnection Logic:**
   - In [`frontend/src/pages/LearningPods.jsx`](file:///c:/Users/paris/OneDrive/Documents/SIH/cognipath/frontend/src/pages/LearningPods.jsx#L660) and `LiveKshetraNative.jsx`, when the WebSocket connection is dropped by Render or network instability, reconnection attempts lack exponential backoff and can spam connection attempts.
3. **Axios 401 Interceptor Desynchronization:**
   - In [`frontend/src/services/api.js`](file:///c:/Users/paris/OneDrive/Documents/SIH/cognipath/frontend/src/services/api.js#L30-L37), a 401 response removes tokens from `localStorage`, but does not dispatch an event or reset `user` state in `App.jsx`. The UI remains on the current screen with failing subsequent requests until the page is manually refreshed.

---

## 12. Technical Debt

1. **State-Based Navigation Instead of React Router:**
   - `App.jsx` spans 719 lines managing tab switches manually. Deep-linking, browser history (back/forward buttons), and bookmarking specific course lessons or exam pages are severely limited.
2. **Monolithic Page Files:**
   - [`LearningPods.jsx`](file:///c:/Users/paris/OneDrive/Documents/SIH/cognipath/frontend/src/pages/LearningPods.jsx) has **3,110 lines** (141 KB).
   - [`LiveKshetraNative.jsx`](file:///c:/Users/paris/OneDrive/Documents/SIH/cognipath/frontend/src/components/pods/LiveKshetraNative.jsx) has **2,273 lines** (95 KB).
   - Both files implement separate, duplicated copies of WebRTC peer mesh logic, media stream management, and signaling handling.
3. **Lack of Alembic Database Migrations:**
   - The project currently relies on runtime string manipulation and manual `ALTER TABLE` execution inside `database.py`. Adding or changing model attributes requires custom procedural code instead of declarative Alembic revisions.
4. **Integration Test Files Placed in Test Discovery Root:**
   - Several scripts (`test_pod.py`, `test_pod_lifecycle.py`, etc.) are runnable scripts rather than structured pytest modules, which breaks standard `pytest` runs.
5. **Large Frontend Bundle Chunks:**
   - The Vite production build generates multiple chunks exceeding 500 KB (e.g. `elk.js` at 1.47 MB, `mermaid.core.js` at 654 KB, `cytoscape.js` at 443 KB) due to eager imports rather than lazy code splitting (`React.lazy()` / dynamic `import()`).

---

## Recommended Next Steps (Prioritized)

1. **Fix Gemini API Model Identifier:** Update `GEMINI_MODEL_NAME` from deprecated `gemini-2.0-flash` to an active model (e.g. `gemini-2.5-flash` or `gemini-3.8-flash`) to restore live AI capabilities.
2. **Correct SQLite Schema & Fix `weekly_created`:** Add the missing column migration in `database.py` for `educator_pod_quotas` so local development and integration tests pass cleanly.
3. **Harden Authentication:** Prevent students from promoting their role to `EDUCATOR` via `PUT /auth/profile`.
4. **Sanitize File Uploads:** Use `os.path.basename` and enforce maximum file size limits on PDF/document ingestion.
5. **Align CORS Settings:** Use explicit domain lists from `settings.CORS_ORIGINS` instead of `["*"]` when `allow_credentials=True`.
6. **Vercel & Render Alignment:** Set Vercel Root Directory to `frontend`, ensure `VITE_API_BASE_URL` is configured in Vercel, and consider persistent storage (e.g. Supabase Storage bucket or S3) for uploaded course documents.
