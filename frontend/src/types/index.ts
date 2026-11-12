// =========================================================================
// TypeScript Interfaces Mirroring Nitish's FastAPI Pydantic Models
// =========================================================================

// 1. Syllabus & Topic Extraction
export interface TopicItem {
  topic_id: string;
  topic_name: string;
  subtopics: string[];
  summary: string;
}

export interface SyllabusUploadResponse {
  status: string;
  subject: string;
  total_pages_or_chunks: number;
  extracted_topics: TopicItem[];
}

// 2. Quiz Generation (Zero-Leak)
export interface PublicQuestion {
  id: string;
  question: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
    [key: string]: string;
  };
}

export interface QuizGenerateRequest {
  subject: string;
  topic: string;
  count: number;
  difficulty: "Easy" | "Medium" | "Hard" | string;
}

export interface QuizGenerateResponse {
  quiz_session_id: string;
  subject: string;
  topic: string;
  total_questions: number;
  questions: PublicQuestion[];
}

// 3. Quiz Submission & Scoring
export interface QuizSubmitRequest {
  quiz_session_id: string;
  answers: Record<string, string>; // e.g., { "q_1": "B", "q_2": "A" }
}

export interface QuestionReview {
  question_id: string;
  question: string;
  selected_option: string | null;
  correct_option: string;
  is_correct: boolean;
  explanation: string;
}

export interface QuizSubmitResponse {
  quiz_session_id: string;
  score_percentage: number;
  correct_count: number;
  total_questions: number;
  reviews: QuestionReview[];
  ai_feedback: string;
}

// 4. AI Tutor: Explain My Mistake
export interface TutorExplainRequest {
  question: string;
  selected_option: string | null;
  correct_option: string;
  explanation: string;
}

export interface TutorExplainResponse {
  simplified_explanation: string;
  memory_tip: string;
  real_world_example: string;
}

// 5. Authentication (frontend-first: confirm these with the backend partner)
export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  name: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  user: AuthUser;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role?: "admin" | "user";
}