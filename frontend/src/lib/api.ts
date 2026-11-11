import {
  SyllabusUploadResponse,
  QuizGenerateRequest,
  QuizGenerateResponse,
  QuizSubmitRequest,
  QuizSubmitResponse,
  TutorExplainRequest,
  TutorExplainResponse,
  LoginRequest,
  SignupRequest,
  AuthResponse,
} from "../types";

// Base API URL pointing to Nitish's FastAPI backend
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// ---------------------------------------------------------------
// Auth: frontend-only for now.
// When the backend /auth endpoints are ready, set this to false.
// ---------------------------------------------------------------
const USE_MOCK_AUTH = true;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Turns FastAPI errors (string or validation array) into readable text
async function parseError(res: Response, fallback: string): Promise<string> {
  const err = await res.json().catch(() => ({}));
  if (typeof err.detail === "string") return err.detail;
  if (Array.isArray(err.detail)) {
    const msg = err.detail
      .map((d: { msg?: string }) => d.msg)
      .filter(Boolean)
      .join(", ");
    return msg || fallback;
  }
  return fallback;
}

export const apiClient = {
  /**
   * Health Check
   */
  checkHealth: async () => {
    const res = await fetch("http://localhost:8000/health");
    if (!res.ok) throw new Error("Backend server is unreachable");
    return res.json();
  },

  /**
   * Screen 1: Upload Syllabus PDF & Extract Topics
   */
  uploadSyllabus: async (subject: string, file: File): Promise<SyllabusUploadResponse> => {
    const formData = new FormData();
    formData.append("subject", subject);
    formData.append("file", file);

    const res = await fetch(`${API_BASE}/syllabus/upload-pdf`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to upload syllabus PDF");
    }
    return res.json();
  },

  /**
   * Screen 2: Fetch all uploaded subjects & topics from database
   */
  getSubjects: async () => {
    const res = await fetch(`${API_BASE}/syllabus/subjects`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to fetch subjects from database");
    }
    return res.json();
  },

  /**
   * Screen 3: Generate Quiz (Zero-Leak)
   */
  generateQuiz: async (params: QuizGenerateRequest): Promise<QuizGenerateResponse> => {
    const res = await fetch(`${API_BASE}/quiz/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to generate quiz");
    }
    return res.json();
  },

  /**
   * Screen 4: Submit Student Answers & Receive Score
   */
  submitQuiz: async (payload: QuizSubmitRequest): Promise<QuizSubmitResponse> => {
    const res = await fetch(`${API_BASE}/quiz/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to submit quiz answers");
    }
    return res.json();
  },

  /**
   * Screen 5: AI Tutor "Explain My Mistake"
   */
  explainMistake: async (data: TutorExplainRequest): Promise<TutorExplainResponse> => {
    const res = await fetch(`${API_BASE}/tutor/explain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to retrieve AI tutor explanation");
    }
    return res.json();
  },

  /**
   * Auth: Log in (mock until the backend /auth/login exists)
   */
  login: async (payload: LoginRequest): Promise<AuthResponse> => {
    if (USE_MOCK_AUTH) {
      await wait(800);
      return {
        access_token: "mock-token",
        user: { id: "mock-1", name: payload.email.split("@")[0], email: payload.email },
      };
    }

    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await parseError(res, "Invalid email or password"));
    return res.json();
  },

  /**
   * Auth: Sign up (mock until the backend /auth/signup exists)
   */
  signup: async (payload: SignupRequest): Promise<AuthResponse> => {
    if (USE_MOCK_AUTH) {
      await wait(800);
      return {
        access_token: "mock-token",
        user: { id: "mock-1", name: payload.name, email: payload.email },
      };
    }

    const res = await fetch(`${API_BASE}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await parseError(res, "Could not create your account"));
    return res.json();
  },
};