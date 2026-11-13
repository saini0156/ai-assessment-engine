# Mind Mark — AI-Powered Smart Assessment & Quiz Engine

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2015-black.svg?logo=next.js&logoColor=white)](https://nextjs.org/)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB.svg?logo=python&logoColor=white)](https://www.python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%20(Supabase)-4169E1.svg?logo=postgresql&logoColor=white)](https://supabase.com/)
[![Groq](https://img.shields.io/badge/AI%20Inference-Groq%20Cloud-f55036.svg)](https://groq.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> An enterprise-grade, intelligent assessment platform: automated syllabus PDF extraction, dynamic multiple-choice question generation with engineered distractors, zero-leak anti-cheat exam delivery, dual authentication (Argon2 + Sign in with Google), role-based admin analytics, and an interactive AI Tutor ("Explain My Mistake") that delivers analogy-driven feedback.

---

## 📑 Table of Contents

- [Overview & Key Features](#-overview--key-features)
- [System Architecture](#-system-architecture)
- [Tech Stack](#-tech-stack)
- [Monorepo Project Structure](#-monorepo-project-structure)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [1. Backend Setup](#1-backend-setup)
  - [2. Frontend Setup](#2-frontend-setup)
- [Environment Configuration](#-environment-configuration)
- [API Reference Manual](#-api-reference-manual)
- [Security & Zero-Leak Anti-Cheat](#-security--zero-leak-anti-cheat)
- [High-Performance 2-Tier Question Engine](#-high-performance-2-tier-question-engine)
- [Automated Testing & Verification](#-automated-testing--verification)
- [Team & Roles](#-team--roles)
- [Roadmap](#-roadmap)
- [License](#-license)

---

## 🌟 Overview & Key Features

* **📄 Syllabus PDF Ingestion:** Upload any course syllabus (PDF or text) up to 10MB; the engine automatically extracts structured subjects, units, topics, and subtopics.
* **🧠 Distractor-Engineered MCQ Generation:** Questions are dynamically generated with plausible, misconception-targeted distractors rather than obvious wrong choices.
* **🛡️ Zero-Leak Anti-Cheat Delivery:** Correct answer keys and explanations are held in server-side memory (`session_store.py`) and never exposed to browser network tabs until submission.
* **⚡ High-Speed 2-Tier AI Engine:** Checks the database Question Bank first ($0 cost, ~1s response) and generates deficits concurrently via Groq (`qwen/qwen3.8-27b`) in 5-question micro-chunks.
* **🔐 Dual Authentication & RBAC:**
  * Native Email & Password with industry-standard **Argon2id** hashing.
  * **Sign in with Google** via Google Identity Services (GIS) ID Token verification.
  * Strict Role-Based Access Control (**`admin`** vs **`student`**).
* **📊 Admin Performance Analytics:** Real-time user management with live aggregated metrics (`quizzes_taken`, `avg_score`, `last_active`), detailed student history, and role update safeguards (self-demotion and last-admin demotion blocked).
* **🤖 "Explain My Mistake" AI Tutor:** On incorrect answers, students receive a 3-part feedback breakdown: a simplified explanation, a memorable mnemonic, and a real-world analogy.
* **📜 Persistent Quiz History:** Every completed quiz attempt is recorded against the authenticated user's ID in PostgreSQL with full review snapshots.

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    Client["Client Layer (Next.js 15 UI / Swagger Docs)"]

    subgraph Gateway ["FastAPI API Gateway (:8000)"]
        CORS["CORS Middleware"]
        AuthRoute["/api/v1/auth (Signup, Login, Google OAuth)"]
        AdminRoute["/api/v1/admin (User Mgmt, Role Update, History)"]
        QuizRoute["/api/v1/quiz (Generate, Submit, Share, Personal History)"]
        SyllabusRoute["/api/v1/syllabus (PDF Ingestion, Subjects)"]
        TutorRoute["/api/v1/tutor (Explain My Mistake)"]
    end

    subgraph SecurityLayer ["Security & Cryptography"]
        Argon2["Argon2id Password Hasher"]
        JWT["PyJWT (HMAC-SHA256 Bearer)"]
        GoogleAuth["Google Auth SDK (Token Verification)"]
        RBAC["RBAC Guard (admin vs student)"]
    end

    subgraph ServiceEngine ["Core Services Layer"]
        LLM["LLM Service (Groq Qwen Engine + Connection Pool)"]
        Store["Zero-Leak Memory Cache (session_store.py)"]
        PDF["PDF Extractor (pypdf)"]
        DBRepo["Database Repository (db_service.py)"]
    end

    subgraph DatabaseLayer ["Persistence Layer"]
        PG["PostgreSQL (Supabase Pooler)"]
        SQLite["SQLite Fallback"]
    end

    Client -->|HTTP / JSON + Bearer JWT| CORS
    CORS --> AuthRoute & AdminRoute & QuizRoute & SyllabusRoute & TutorRoute

    AuthRoute --> Argon2 & JWT & GoogleAuth
    AdminRoute --> RBAC & DBRepo
    QuizRoute --> Store & LLM & DBRepo
    SyllabusRoute --> PDF & LLM & DBRepo
    TutorRoute --> LLM

    DBRepo --> PG
    PG -.->|Network Fallback| SQLite
```

---

## 💻 Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | [Next.js 15](https://nextjs.org/) (App Router), React 19, TypeScript, Tailwind CSS | Responsive, modern user interface, interactive quiz player, and admin dashboard |
| **Backend** | [FastAPI](https://fastapi.tiangolo.com/), Python 3.12, Uvicorn | High-performance asynchronous REST API framework |
| **Database** | [PostgreSQL](https://supabase.com/) via Supabase, [SQLAlchemy 2.0](https://www.sqlalchemy.org/), SQLite | Relational persistence, connection pooling, and local offline fallback |
| **AI / LLM** | [Groq Cloud](https://groq.com/) (`qwen/qwen3.8-27b`, `openai/gpt-oss-20b`) | Ultra-fast token inference (~0.9s per micro-chunk) with offline mock fallback |
| **Security & Auth** | Argon2id, PyJWT, Google Identity Services (`google-auth`) | Enterprise password hashing, stateless Bearer tokens, and Google Single Sign-On |
| **Document Parsing** | [pypdf](https://pypdf.readthedocs.io/) | PDF text extraction and semantic chunking |
| **Testing** | [pytest](https://pytest.org/), httpx, in-memory SQLite | 31 automated unit and integration tests |

---

## 📁 Monorepo Project Structure

```
ai-assessment-engine/
├── backend/                           # Python & FastAPI REST API
│   ├── app/
│   │   ├── api/                       # API Route Controllers
│   │   │   ├── admin.py               # Admin user management, history, and role updates
│   │   │   ├── auth.py                # Signup, login, Google OAuth, session hydration (/me)
│   │   │   ├── quiz.py                # MCQ generation, grading, submission, personal history
│   │   │   ├── syllabus.py            # PDF upload and subject taxonomy
│   │   │   └── tutor.py               # "Explain My Mistake" AI feedback
│   │   ├── models/                    # Data Contracts
│   │   │   ├── schemas.py             # Pydantic V2 Request & Response DTOs
│   │   │   └── user.py                # SQLAlchemy User ORM entity
│   │   ├── prompts/                   # Prompt Engineering
│   │   │   └── templates.py           # MCQ generation & AI Tutor prompt templates
│   │   ├── services/                  # Business Logic Engines
│   │   │   ├── auth_service.py        # Cryptography, JWT lifecycle, Google token verify
│   │   │   ├── db_service.py          # PostgreSQL repository & Question Bank manager
│   │   │   ├── llm_service.py         # Groq rotation, connection pooling, parallel chunking
│   │   │   ├── pdf_service.py         # pypdf text extraction
│   │   │   └── session_store.py       # Thread-safe Zero-Leak answer cache
│   │   ├── config.py                  # Pydantic BaseSettings environment manager
│   │   ├── database.py                # Database engine & transactional session factory
│   │   └── main.py                    # Application gateway, CORS, and lifecycle events
│   ├── docs/
│   │   └── ARCHITECTURE.md            # Comprehensive backend architectural manual
│   ├── tests/                         # Automated Test Suite (31 Tests)
│   │   ├── conftest.py                # Isolated in-memory SQLite fixtures
│   │   ├── test_admin.py              # 10 Admin security and management test cases
│   │   ├── test_auth.py               # 17 Auth, registration, and Google OAuth test cases
│   │   └── test_syllabus.py          # 4 Syllabus ingestion and validation test cases
│   ├── requirements.txt               # Backend Python dependencies
│   ├── run.py                         # Development server launcher (port 8000)
│   └── .env                           # Backend environment variables (Git-ignored)
│
├── frontend/                          # Next.js 15 & React Frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── admin/page.tsx         # Admin Dashboard (Syllabus upload & Users)
│   │   │   ├── login/page.tsx         # User Login (Email + Google Sign-In)
│   │   │   ├── signup/page.tsx        # User Registration
│   │   │   ├── quiz/new/page.tsx      # Quiz Configuration & Count Selection
│   │   │   ├── quiz/[id]/page.tsx     # Timed Quiz Player (Zero-Leak)
│   │   │   └── quiz/[id]/results/page.tsx # Scorecard & Review Breakdown
│   │   ├── components/                # Modular UI widgets
│   │   │   ├── tutor/TutorModal.tsx   # "Explain My Mistake" modal
│   │   │   ├── quiz/                  # QuestionCard, Timer, ScoreRing
│   │   │   └── admin/                 # Dropzone, SubjectSelector
│   │   ├── lib/api.ts                 # Strongly-typed fetch API client
│   │   └── types/index.ts             # TypeScript models mirroring backend schemas
│   ├── package.json                   # Frontend dependencies
│   └── tailwind.config.ts             # Tailwind CSS design system configuration
│
├── .gitignore                         # Monorepo exclusion rules
└── README.md                          # Repository documentation
```

---

## 🚀 Getting Started

### Prerequisites

* **Python:** 3.10 or newer (tested with 3.12)
* **Node.js:** 18.18 or newer (with npm)
* **Git**
* *(Optional)* **Groq API Key** and **Google Client ID**. *(The backend includes built-in offline mock fallbacks if keys are omitted)*.

---

### 1. Backend Setup

Open a terminal and navigate to the backend directory:

```bash
cd ai-assessment-engine/backend

# Create and activate a Python virtual environment
python -m venv venv

# Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# macOS / Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create your .env file
cp .env.example .env
```

Configure your `backend/.env` file with your credentials (see [Environment Configuration](#-environment-configuration)).

Start the backend development server:
```bash
python run.py
```
* **API Server:** [http://localhost:8000](http://localhost:8000)
* **Interactive Swagger UI:** [http://localhost:8000/docs](http://localhost:8000/docs)
* **Alternative ReDoc UI:** [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

### 2. Frontend Setup

In a second terminal:

```bash
cd ai-assessment-engine/frontend

# Install dependencies
npm install

# Start the Next.js development server
npm run dev
```

* **Web Application:** [http://localhost:3000](http://localhost:3000)

---

## ⚙️ Environment Configuration

### Backend (`backend/.env`)

```env
# Database (Supabase PostgreSQL pooler or local SQLite fallback)
DATABASE_URL=postgresql://postgres.xxx:password@aws-0-ap-south-1.pooler.supabase.com:6543/postgres

# AI / LLM Keys (Groq Cloud)
GROQ_API_KEY=gsk_your_groq_api_key_here

# Authentication & JWT Security
JWT_SECRET_KEY=your-super-secret-jwt-key-min-32-chars
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Google Authentication (OAuth 2.0 Client ID)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com

# CORS Configuration (comma-separated allowed origins)
FRONTEND_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

---

## 📖 API Reference Manual

All backend endpoints are prefixed with `/api/v1`. Full interactive testing is available via Swagger at `http://localhost:8000/docs`.

### Authentication (`/api/v1/auth`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/auth/signup` | Register a new student or admin account with Argon2 hashing | No |
| `POST` | `/auth/login` | Authenticate with email and password; returns JWT token + role | No |
| `POST` | `/auth/google` | Single Sign-On with Google ID Token; auto-provisions student account | No |
| `GET` | `/auth/me` | Hydrate current user session using Bearer JWT | Bearer Token |
| `POST` | `/auth/logout` | Client-side logout instruction | No |

### Admin Users Management (`/api/v1/admin`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/admin/users` | List all registered users with aggregated stats (`quizzes_taken`, `avg_score`, `last_active`) | Admin Only (403 otherwise) |
| `GET` | `/admin/users/{user_id}/history` | Retrieve full quiz attempt history for a specific student (newest first) | Admin Only (403 otherwise) |
| `PATCH` | `/admin/users/{user_id}/role` | Promote/demote user between `'admin'` and `'student'` (self & last-admin protected) | Admin Only (403 otherwise) |

### Quiz & Assessment (`/api/v1/quiz`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/quiz/generate` | Generate MCQs (1 to 100 questions); correct answers kept server-side (Zero-Leak) | Optional |
| `POST` | `/quiz/submit` | Evaluate student choices; release score, reviews, and persist history to user ID | Optional |
| `GET` | `/quiz/{quiz_session_id}` | Retrieve sanitized questions for public or shared quiz taking | No |
| `GET` | `/quiz/my-history` | View logged-in student's personal past quiz attempts and scores | Bearer Token |
| `GET` | `/quiz/history` | Global recent quiz attempts snapshot | No |

### Syllabus & Topics (`/api/v1/syllabus`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/syllabus/upload-pdf` | Ingest syllabus PDF/text file (max 10MB) and extract subjects, topics, and subtopics | No |
| `GET` | `/syllabus/subjects` | List all extracted subjects and topics for quiz creation dropdowns | No |

### AI Tutor (`/api/v1/tutor`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/tutor/explain` | Generate analogy-based feedback, simplified breakdown, and memory mnemonic for errors | No |

---

## 🔒 Security & Zero-Leak Anti-Cheat

A critical vulnerability in standard quiz applications is returning the answer key to the client's browser, allowing students to inspect network traffic in DevTools to find correct answers.

**Mind Mark prevents this entirely through Server-Side State Isolation:**

```mermaid
sequenceDiagram
    autonumber
    actor Student
    participant API as Backend (/quiz/generate)
    participant RAM as session_store.py (Server RAM)
    participant DB as PostgreSQL Database

    Student->>API: Request Quiz (Subject, Topic, Count)
    API->>API: Generate Questions via Question Bank & Groq LLM
    API->>RAM: Cache Full Questions (Keys & Explanations) in Server RAM
    API->>DB: Save Immutable Exam Snapshot
    API-->>Student: Return PublicQuestions (ZERO LEAK: No correct options, no explanations)

    Note over Student: Student solves quiz.<br/>DevTools inspection reveals ZERO answers.

    Student->>API: POST /quiz/submit { answers: { q_1: "A", ... } }
    API->>RAM: Lookup stored answer key
    API->>API: Grade selections & compute percentage score
    API->>DB: Record final score & reviews linked to user_id
    API-->>Student: Return Scorecard + Explanations + Correct Answers
```

---

## ⚡ High-Performance 2-Tier Question Engine

Generating 50 to 100+ questions on demand without cost inflation or token truncation is achieved through a **Smart 2-Tier Engine**:

```
                       User Requests N Questions
                                   │
                                   ▼
        ┌─────────────────────────────────────────────────────┐
        │ Tier 1: PostgreSQL Question Bank (Instant & $0)     │
        │ Checks DB questions table for matching topic        │
        └──────────────────────────┬──────────────────────────┘
                                   │
                 ┌─────────────────┴─────────────────┐
                 ▼                                   ▼
          Cache Hit (100%)                    Deficit Exists
                 │                                   │
                 │ Retrieve from DB                  │ Generate only missing count
                 │ (~1.13s for 50 Qs)                ▼
                 │                    ┌────────────────────────────────────────┐
                 │                    │ Tier 2: Groq Parallel Micro-Chunking   │
                 │                    │ - Model: qwen/qwen3.8-27b (~0.9s)      │
                 │                    │ - 5 questions per chunk                │
                 │                    │ - ThreadPoolExecutor(max_workers=3)    │
                 │                    │ - Persistent HTTP connection pool      │
                 │                    └──────────────────┬─────────────────────┘
                 │                                       │
                 │                                       ▼
                 │                           Save generated questions to
                 │                           Question Bank for future reuse
                 │                                       │
                 └───────────────────┬───────────────────┘
                                     │
                                     ▼
                        Deliver Clean Public Questions
```

---

## 🧪 Automated Testing & Verification

The backend includes a comprehensive, isolated automated test suite built on `pytest`. All tests execute against an in-memory SQLite database (`sqlite:///:memory:`) using `StaticPool`, ensuring complete isolation from production data.

### Running the Tests

From `ai-assessment-engine/backend`:

```bash
# Run the entire test suite (31 tests)
python -m pytest tests -v

# Run only authentication tests (17 tests)
python -m pytest tests/test_auth.py -v

# Run only admin security tests (10 tests)
python -m pytest tests/test_admin.py -v

# Run only syllabus tests (4 tests)
python -m pytest tests/test_syllabus.py -v
```

### Verified Test Results
```text
tests/test_admin.py ..........                                           [ 32%]
tests/test_auth.py .................                                     [ 87%]
tests/test_syllabus.py ....                                              [100%]
======================= 31 passed in 2.88s =======================
```

---

## 👥 Team & Roles

| Contributor | Role | Primary Responsibilities |
|---|---|---|
| **Nitish** | Backend Lead | System architecture, FastAPI controllers, PostgreSQL repository, Groq LLM engine, Zero-Leak security, and Google authentication |
| **Rahul** | Frontend Lead | Next.js 15 UI/UX, responsive quiz player, timer countdown, admin users management page, and API integration |

---

## 🗺️ Roadmap

- [x] User registration, password hashing (Argon2), and JWT authentication
- [x] Persistent PostgreSQL database replacing in-memory session store
- [x] Multi-tier Question Bank for instant $0 generation up to 100 questions
- [x] Admin Users management APIs with live aggregate stats
- [x] Role-Based Access Control (`admin` vs `student`) with self-demotion guards
- [x] Sign in with Google (Google Identity Services ID Token verification)
- [x] Full automated test suite (31 passing tests)
- [ ] Export quiz scorecard and analysis as PDF (`/quiz/{id}/pdf`)
- [ ] Docker containerization and Docker Compose setup for one-command deployment
- [ ] WebSocket connection for multiplayer live competitive quiz rooms

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
