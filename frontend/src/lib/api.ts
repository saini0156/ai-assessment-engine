import {
  SyllabusUploadResponse,
  QuizGenerateRequest,
  QuizGenerateResponse,
  QuizSubmitRequest,
  QuizSubmitResponse,
  TutorExplainRequest,
  TutorExplainResponse,
} from "../types";

// Base API URL pointing to Nitish's FastAPI backend
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

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
   * Screen 2: Generate Quiz (Zero-Leak)
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
};
