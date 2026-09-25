# 🧠 COGNIPATH — AI-Powered Personalized Learning Ecosystem
**Smart India Hackathon 2026 | Problem Statement: SIH262070/500 (Smart Education)**  
*Developed by Team AKAZA*

---

## 🚀 Overview & Vision
Traditional Learning Management Systems (LMS) act as static repositories for lecture notes and assignments. They fail to understand individual learning struggles, detect early signs of academic distress, or provide instant context-grounded assistance.

**COGNIPATH** transforms education into an active, personalized, multilingual learning journey through:
1. **Curriculum-Grounded RAG AI Tutor**: Strict anti-hallucination system prompt providing verified answers with source citations `[Source: Doc, Page X]`.
2. **Knowledge Ingestion Pipeline**: Recursive character chunking (1000 chars, 150 overlap) with automated embedding generation and ChromaDB vector indexing.
3. **Adaptive Spaced-Repetition Quiz Engine**: Mathematically calculates review intervals using the **SuperMemo SM-2 algorithm** based on quiz performance and doubt frequency.
4. **Educator Insights & At-Risk Analytics**: Heuristic early-warning engine flagging struggling students (`Score < 50%`, `Inactive > 4 Days`, `Struggling Concepts`) with one-click teacher intervention.
5. **Native Learning Pods**: In-app live video/audio conference rooms with interactive peer grids, live chat, and in-pod `@Tutor` AI co-pilot.
6. **Native Community Hub**: In-app course discussion channels (`#general`, `#doubts-and-qa`, `#exam-prep`) with upvoting and verified solutions.
7. **Multilingual Regional Accessibility**: Indian language translation (NMT), speech-to-text (ASR), and text-to-speech (TTS) via the Government of India's **Bhashini API**.

---

## 🛠️ Architecture & Tech Stack

```
+-----------------------------------------------------------------------------------+
|                              COGNIPATH ARCHITECTURE                                |
+-----------------------------------------------------------------------------------+
|  [REACT FRONTEND (Vite + Tailwind CSS + Lucide Icons)]                            |
|    * Student Portal: AI Tutor Chat (RAG + Source Citations + Voice/Multilingual)  |
|    * Educator Portal: Knowledge Ingestion + At-Risk Student Intervention          |
|    * Spaced Repetition Flashcards & Quizzes (SM-2 Algorithm)                      |
|    * Native Learning Pods (Video/Audio + Live Chat with @Tutor)                   |
|    * Native Community Hub (Channel feeds, peer Q&A, and upvoting)                 |
+-----------------------------------------------------------------------------------+
                                  |  HTTP / WS (JSON, JWT)
                                  v
+-----------------------------------------------------------------------------------+
|  [FASTAPI BACKEND (Python 3.11+, Pydantic v2, SQLAlchemy 2.0)]                    |
|    * Auth & RBAC (/api/v1/auth - Student, Educator, Admin)                        |
|    * Document Ingestion (/api/v1/documents - PDF, DOCX, TXT Parsing & Chunking)   |
|    * Grounded AI Tutor (/api/v1/tutor - MMR Vector Search, Anti-Hallucination)    |
|    * Multilingual Engine (/services/bhashini_service.py - Regional Indic ASR/TTS) |
|    * Adaptive Quiz Engine (/api/v1/quizzes - SM-2 Spaced Repetition)              |
|    * Educator Analytics (/api/v1/analytics - At-Risk Flagging Heuristic Engine)   |
|    * Pods & Communities (/api/v1/pods, /api/v1/communities - WebSockets)          |
+-----------------------------------------------------------------------------------+
           |                                  |                        |
           v                                  v                        v
+-----------------------+          +--------------------+    +----------------------+
| PostgreSQL Database   |          | ChromaDB Vector DB |    | External AI Services |
| (Users, Courses,      |          | (Course-isolated   |    | * OpenAI gpt-4o-mini |
|  Quizzes, Attempts,   |          |  collections, MMR, |    | * text-embedding-3-sm|
|  Activity Logs)       |          |  chunk metadata)   |    | * Bhashini ULCA API  |
+-----------------------+          +--------------------+    +----------------------+
```

---

## ⚡ Quickstart Guide

### Option 1: Docker Compose (Full Containerized Stack)
Ensure Docker is installed, then run:
```bash
# Clone and navigate to project root
cd cognipath

# Copy environment variables
cp .env.example .env

# Build and start all 4 microservices
docker-compose up --build
```
- **React Frontend**: `http://localhost:3000`
- **FastAPI Interactive Docs**: `http://localhost:8000/docs`
- **ChromaDB Endpoint**: `http://localhost:8001`
- **PostgreSQL**: `localhost:5432`

---

### Option 2: Local Standalone Execution (Without Docker)

#### Step 1: Backend Setup
```bash
cd cognipath/backend

# Install python requirements
pip install -r requirements.txt

# Start FastAPI server (Automatically creates SQLite database and seeds demo data on startup!)
uvicorn app.main:app --reload --port 8000
```

#### Step 2: Frontend Setup
```bash
cd cognipath/frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```
Open `http://localhost:3000` in your browser.

---

## 🎯 Pre-Configured Demo Personas

| Role | Email | Password | Persona Overview |
| :--- | :--- | :--- | :--- |
| **Student (Regular)** | `student@cognipath.edu` | `password123` | **Aarav Sharma**: Enrolled in CS101 & AI201, active learner with positive retention |
| **Student (At-Risk)** | `priya@cognipath.edu` | `password123` | **Priya Patel**: Score 33.3%, struggling with Binary Search Trees |
| **Student (Inactive)** | `rohit@cognipath.edu` | `password123` | **Rohit Verma**: Inactive for 6 days with stagnant scores |
| **Educator** | `teacher@cognipath.edu` | `password123` | **Prof. Rajesh Ramanujan**: Manages curriculum, reviews at-risk alerts, and dispatches interventions |

*Tip: You can use the **Quick One-Click Demo Login** buttons on the login page or the **Switch Role** button in the navbar anytime!*

---

## 🔬 Core Module Walkthrough

### 1. Document Ingestion & Vector Indexing
- Educators upload `.pdf`, `.docx`, or `.txt` course materials in the Educator Dashboard.
- The `ingestion_service` uses `RecursiveCharacterTextSplitter` (size: 1000, overlap: 150) and tags each chunk with metadata (`course_id`, `document_id`, `page_number`, `topic`).
- Embeddings are indexed into course-isolated collections in **ChromaDB**.

### 2. Grounded AI Tutor with Anti-Hallucination
- When a student asks a doubt, the backend retrieves top matching curriculum chunks using cosine similarity vector search.
- The prompt strictly enforces that answers cite source document names and page numbers (e.g. `[Source: CS101_Lecture_04_Trees_and_BST.pdf, Page 1]`).
- Expandable citation badges in the student UI display the exact snippet, page, and match score.

### 3. SuperMemo SM-2 Spaced Repetition Engine
- Calculates interval updates using the formula:
  $$EF' = EF + (0.1 - (5 - q) \times (0.08 + (5 - q) \times 0.02))$$
  where $EF \ge 1.3$ and $q$ is the response quality score.
- Automatically schedules review dates for concepts students recently covered or made mistakes on.

### 4. Educator Insights & At-Risk Heuristic Engine
- Aggregates class performance and flags at-risk learners when:
  - Quiz score average $< 50\%$
  - Student is inactive for $\ge 4$ days
  - Student asks repetitive doubts on foundational topics without score improvement
- Provides a one-click **Intervene** action for educators to dispatch targeted revision materials.

### 5. Native Learning Pods & Community Hub
- **Learning Pods**: Live in-app audio/video peer conference grid with camera/mic controls and real-time pod chat with in-pod `@Tutor` doubts support.
- **Community Hub**: In-app course channels (`#general`, `#doubts-and-qa`, `#exam-prep`) for peer answers and verified solution badges.

---

## 🌐 Cloud Deployment Guide (Vercel + Supabase + Render)

CogniPath is architected for zero-friction cloud deployment:

### 1. Database: Supabase (PostgreSQL)
1. Create a project at [supabase.com](https://supabase.com).
2. Under **Project Settings** -> **Database**, navigate to **Connection Pooling** (Mode: **Transaction**, Port: `6543`).
3. Copy the URI connection string:
   ```
   postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
   ```
4. *(Optional)* Paste `backend/supabase_schema.sql` into Supabase's **SQL Editor** to bootstrap all tables and demo users, or let FastAPI's `init_db()` auto-initialize them on first boot.

### 2. Backend: Render or Railway
1. Create a **New Web Service** pointing to this GitHub repository (`backend` folder).
2. Set Environment Variables:
   - `DATABASE_URL`: Your Supabase pooler connection string.
   - `GEMINI_API_KEY`: Your Google Gemini API key.
   - `SECRET_KEY`: Random 64-character secret.
   - `ENVIRONMENT`: `production`.
3. Start Command:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```
4. Copy your live backend service URL (e.g. `https://cognipath-backend.onrender.com`).

### 3. Frontend: Vercel
1. Import this GitHub repository into [vercel.com](https://vercel.com).
2. In Project Configuration:
   - **Root Directory**: `frontend`
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Under **Environment Variables**:
   - `VITE_API_BASE_URL`: Your deployed backend URL (e.g. `https://cognipath-backend.onrender.com`).
4. Click **Deploy**. Vercel will build and assign your production domain.

---

## 🛡️ License
Built for Smart India Hackathon (SIH 2026) under the MIT License.

