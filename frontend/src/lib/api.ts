
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
  AuthUser,
  AdminUserListItem,
  AdminUserHistoryItem,
} from "../types";

import { getSession } from "./session";

// ---------------------------------------------------------------
// API configuration
// ---------------------------------------------------------------

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"
).replace(/\/+$/, "");

const HEALTH_URL = `${API_BASE.replace(/\/api\/v1$/, "")}/health`;

// ---------------------------------------------------------------
// Auth configuration
// ---------------------------------------------------------------

const AUTH = {
  login: "/auth/login",
  signup: "/auth/signup",
  google: "/auth/google",
  me: "/auth/me",
  loginAsForm: false,
};

// ---------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------

async function parseError(
  res: Response,
  fallback: string
): Promise<string> {
  const err = await res.json().catch(() => ({}));

  if (typeof err.detail === "string") {
    return err.detail;
  }

  if (Array.isArray(err.detail)) {
    const message = err.detail
      .map((item: { msg?: string }) => item.msg)
      .filter(Boolean)
      .join(", ");

    return message || fallback;
  }

  return fallback;
}

// ---------------------------------------------------------------
// Authentication headers
// ---------------------------------------------------------------

function authHeaders(
  extra: Record<string, string> = {}
): Record<string, string> {
  const token = getSession()?.access_token;

  return token
    ? {
        ...extra,
        Authorization: `Bearer ${token}`,
      }
    : extra;
}

// ---------------------------------------------------------------
// Normalize authentication response
// ---------------------------------------------------------------

async function normalizeAuth(
  data: any,
  fallbackUser: Partial<AuthUser>
): Promise<AuthResponse> {
  const token: string = data.access_token ?? data.token;

  if (!token) {
    throw new Error("Server did not return a token");
  }

  let user: any = data.user;

  if (!user) {
    const me = await fetch(`${API_BASE}${AUTH.me}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }).catch(() => null);

    if (me?.ok) {
      const raw = await me.json().catch(() => undefined);
      user = raw?.user ?? raw;
    }
  }

  return {
    access_token: token,
    user: {
      id: String(user?.id ?? fallbackUser.id ?? ""),
      name:
        user?.full_name ??
        user?.name ??
        fallbackUser.name ??
        fallbackUser.email?.split("@")[0] ??
        "",
      email: user?.email ?? fallbackUser.email ?? "",
      role: String(
        user?.role ?? data.role ?? "student"
      ).toLowerCase() as AuthUser["role"],
    },
  };
}

// ---------------------------------------------------------------
// API CLIENT
// ---------------------------------------------------------------

export const apiClient = {
  /**
   * Health Check
   */
  checkHealth: async () => {
    const res = await fetch(HEALTH_URL);

    if (!res.ok) {
      throw new Error("Backend server is unreachable");
    }

    return res.json();
  },

  /**
   * Screen 1: Upload Syllabus PDF
   */
  uploadSyllabus: async (
    subject: string,
    file: File
  ): Promise<SyllabusUploadResponse> => {
    const formData = new FormData();

    formData.append("subject", subject);
    formData.append("file", file);

    const res = await fetch(`${API_BASE}/syllabus/upload-pdf`, {
      method: "POST",
      headers: authHeaders(),
      body: formData,
    });

    if (!res.ok) {
      throw new Error(
        await parseError(res, "Failed to upload syllabus PDF")
      );
    }

    return res.json();
  },

  /**
   * Screen 2: Fetch uploaded subjects and topics
   */
  getSubjects: async () => {
    const res = await fetch(`${API_BASE}/syllabus/subjects`, {
      headers: authHeaders(),
    });

    if (!res.ok) {
      throw new Error(
        await parseError(res, "Failed to fetch subjects from database")
      );
    }

    return res.json();
  },

  /**
   * Screen 3: Generate Quiz
   */
  generateQuiz: async (
    params: QuizGenerateRequest
  ): Promise<QuizGenerateResponse> => {
    const res = await fetch(`${API_BASE}/quiz/generate`, {
      method: "POST",
      headers: authHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      throw new Error(
        await parseError(res, "Failed to generate quiz")
      );
    }

    return res.json();
  },

  /**
   * Screen 4: Submit Quiz Answers
   */
  submitQuiz: async (
    payload: QuizSubmitRequest
  ): Promise<QuizSubmitResponse> => {
    const res = await fetch(`${API_BASE}/quiz/submit`, {
      method: "POST",
      headers: authHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(
        await parseError(res, "Failed to submit quiz answers")
      );
    }

    return res.json();
  },

  /**
   * Screen 4.1: Submit Individual Question Feedback
   *
   * POST /api/v1/quiz/{quiz_session_id}/feedback
   *
   * Request body:
   * {
   *   question_id: string,
   *   review_text: string
   * }
   *
   * Response:
   * {
   *   feedback_id: string
   * }
   */
  submitQuestionFeedback: async (
    quizSessionId: string,
    questionId: string,
    reviewText: string
  ): Promise<{ feedback_id: string }> => {
    if (!quizSessionId || !questionId || !reviewText.trim()) {
      throw new Error("Please provide valid feedback details.");
    }

    const url = `${API_BASE}/quiz/${encodeURIComponent(
      quizSessionId
    )}/feedback`;

    const res = await fetch(url, {
      method: "POST",
      headers: authHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        question_id: questionId,
        review_text: reviewText.trim(),
      }),
    });

    if (!res.ok) {
      throw new Error(
        await parseError(res, "Failed to submit question feedback")
      );
    }

    return res.json();
  },

  /**
   * Screen 5: AI Tutor - Explain My Mistake
   */
  explainMistake: async (
    data: TutorExplainRequest
  ): Promise<TutorExplainResponse> => {
    const res = await fetch(`${API_BASE}/tutor/explain`, {
      method: "POST",
      headers: authHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      throw new Error(
        await parseError(
          res,
          "Failed to retrieve AI tutor explanation"
        )
      );
    }

    return res.json();
  },

  /**
   * Auth: Login
   */
  login: async (
    payload: LoginRequest
  ): Promise<AuthResponse> => {
    const res = AUTH.loginAsForm
      ? await fetch(`${API_BASE}${AUTH.login}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            username: payload.email,
            password: payload.password,
          }),
        })
      : await fetch(`${API_BASE}${AUTH.login}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

    if (!res.ok) {
      throw new Error(
        await parseError(res, "Invalid email or password")
      );
    }

    return normalizeAuth(await res.json(), {
      email: payload.email,
    });
  },

  /**
   * Auth: Signup
   */
  signup: async (
    payload: SignupRequest
  ): Promise<AuthResponse> => {
    const res = await fetch(`${API_BASE}${AUTH.signup}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        full_name: payload.name,
        email: payload.email,
        password: payload.password,
      }),
    });

    if (!res.ok) {
      throw new Error(
        await parseError(res, "Could not create your account")
      );
    }

    const data = await res.json().catch(() => ({}));

    if (!data.access_token && !data.token) {
      return apiClient.login({
        email: payload.email,
        password: payload.password,
      });
    }

    return normalizeAuth(data, {
      name: payload.name,
      email: payload.email,
    });
  },

  /**
   * Auth: Google Login
   */
  googleLogin: async (
    credential: string
  ): Promise<AuthResponse> => {
    const res = await fetch(`${API_BASE}${AUTH.google}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ credential }),
    });

    if (!res.ok) {
      throw new Error(
        await parseError(res, "Google sign-in failed")
      );
    }

    return normalizeAuth(await res.json(), {});
  },

  /**
   * Auth: Get Current User
   */
  getMe: async (): Promise<AuthUser> => {
    const res = await fetch(`${API_BASE}${AUTH.me}`, {
      headers: authHeaders(),
    });

    if (!res.ok) {
      throw new Error(
        await parseError(res, "Could not load your profile")
      );
    }

    const raw = await res.json();
    const u = raw.user ?? raw;

    return {
      id: String(u.id),
      name: u.full_name ?? u.name ?? "",
      email: u.email,
      role: String(
        u.role ?? "student"
      ).toLowerCase() as AuthUser["role"],
    };
  },

  /**
   * Student: My Quiz History
   */
  getMyQuizHistory: async (): Promise<AdminUserHistoryItem[]> => {
    const res = await fetch(`${API_BASE}/quiz/my-history`, {
      headers: authHeaders(),
    });

    if (!res.ok) {
      throw new Error(
        await parseError(res, "Failed to load quiz history")
      );
    }

    return res.json();
  },

  /**
   * Admin: List All Users
   */
  getAdminUsers: async (): Promise<AdminUserListItem[]> => {
    const res = await fetch(`${API_BASE}/admin/users`, {
      headers: authHeaders(),
    });

    if (!res.ok) {
      throw new Error(
        await parseError(res, "Failed to load users")
      );
    }

    return res.json();
  },

  /**
   * Admin: Quiz History for One User
   */
  getAdminUserHistory: async (
    userId: string
  ): Promise<AdminUserHistoryItem[]> => {
    const res = await fetch(
      `${API_BASE}/admin/users/${encodeURIComponent(userId)}/history`,
      {
        headers: authHeaders(),
      }
    );

    if (!res.ok) {
      throw new Error(
        await parseError(res, "Failed to load user history")
      );
    }

    return res.json();
  },

    getAdminFeedback: async (): Promise<any> => {
    const res = await fetch(`${API_BASE}/admin/feedback`, { headers: authHeaders() });
    if (!res.ok) throw new Error(await parseError(res, "Failed to load feedback"));
    return res.json();
  },

  /**
   * Admin: Change User Role
   */
  updateUserRole: async (
    userId: string,
    role: "admin" | "student"
  ): Promise<AdminUserListItem> => {
    const res = await fetch(
      `${API_BASE}/admin/users/${encodeURIComponent(userId)}/role`,
      {
        method: "PATCH",
        headers: authHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ role }),
      }
    );

    if (!res.ok) {
      throw new Error(
        await parseError(res, "Failed to update role")
      );
    }

    return res.json();
  },
};

