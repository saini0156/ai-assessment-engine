# AI-Powered Smart Assessment & Quiz Engine

> An end-to-end intelligent assessment platform featuring syllabus PDF ingestion, dynamic multiple-choice question generation with distractor engineering, zero-leak anti-cheat delivery, and an AI tutor ("Explain My Mistake") that delivers analogy-based feedback.

---

## 1. Project Directory Structure

```
quiz-interview-platform/
├── backend/                       # Python & FastAPI Backend (Nitish)
│   ├── app/
│   │   ├── main.py                # FastAPI entry, CORS, routers
│   │   ├── config.py              # Environment settings & fallback configuration
│   │   ├── api/
│   │   │   ├── syllabus.py        # POST /api/v1/syllabus/upload-pdf
│   │   │   ├── quiz.py            # POST /api/v1/quiz/generate, submit
│   │   │   └── tutor.py           # POST /api/v1/tutor/explain
│   │   ├── models/schemas.py      # Pydantic schemas
│   │   ├── services/
│   │   │   ├── pdf_service.py     # pypdf text extraction
│   │   │   ├── llm_service.py     # Gemini 2.5 Flash + Offline Mock Engine
│   │   │   └── session_store.py   # Zero-Leak server-side session cache
│   │   └── prompts/templates.py   # Prompt engineering templates
│   ├── requirements.txt           # Python dependencies
│   ├── test_flow.py               # Automated end-to-end test script
│   └── run.py                     # Server starter script (port 8000)
│
├── frontend/                      # Next.js 15 & Tailwind CSS Frontend (Rahul)
│   ├── src/
│   │   ├── app/
│   │   │   ├── admin/page.tsx     # Screen 1: Admin Syllabus Upload
│   │   │   ├── quiz/new/page.tsx  # Screen 2: Quiz Configuration
│   │   │   ├── quiz/[id]/page.tsx # Screen 3: Timed Quiz Player (Timer, A/B/C/D)
│   │   │   └── quiz/[id]/results/page.tsx # Screen 4: Scorecard & AI Review
│   │   ├── components/
│   │   │   ├── tutor/TutorModal.tsx # Screen 5: "Explain My Mistake" Modal
│   │   │   ├── quiz/ (Timer, QuestionCard, ScoreRing)
│   │   │   └── admin/ (Dropzone, TopicCard)
│   │   ├── lib/api.ts             # Centralized typed fetch API client
│   │   └── types/index.ts         # TypeScript models mirroring backend schemas
│   └── package.json
│
└── README.md                      # Unified Project Documentation
```

---

## 2. Quick Start Guide

### Step 1: Start the Backend (Nitish)
```powershell
# Open terminal inside project root
cd backend
.\venv\Scripts\python.exe run.py
```
- Server running at: `http://localhost:8000`
- Interactive Swagger UI: `http://localhost:8000/docs`

### Step 2: Start the Frontend (Rahul)
```powershell
# In a second terminal inside project root
cd frontend
npm install
npm run dev
```
- Frontend running at: `http://localhost:3000`

---

## 3. The 4 Core API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/syllabus/upload-pdf` | Uploads syllabus PDF and returns extracted topics/subtopics. |
| `POST` | `/api/v1/quiz/generate` | Generates MCQs. Answer keys stay on the server (Zero-Leak). |
| `POST` | `/api/v1/quiz/submit` | Grades student choices, releases explanations and AI feedback. |
| `POST` | `/api/v1/tutor/explain` | Returns simplified explanation, memory tip, and real-world analogy. |
