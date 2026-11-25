
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
   * Leaderboard: total points
   */
  getLeaderboard: async (period: LeaderboardPeriod): Promise<LeaderboardResponse> => {
    if (USE_MOCK_LEADERBOARD) return mockPoints(period);

    const res = await fetch(`${API_BASE}/leaderboard?period=${period}`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(await parseError(res, "Failed to load the leaderboard"));
    return res.json();
  },

  /**
   * Leaderboard: best attempts for one subject and topic
   */
  getTopicLeaderboard: async (
    subject: string,
    topic: string,
    period: LeaderboardPeriod
  ): Promise<TopicLeaderboardResponse> => {
    if (USE_MOCK_LEADERBOARD) return mockTopic(subject, topic, period);

    const params = new URLSearchParams({ subject, topic, period });
    const res = await fetch(`${API_BASE}/leaderboard/topic?${params}`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(await parseError(res, "Failed to load the topic leaderboard"));
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


// ---------------------------------------------------------------
// Leaderboard: sample data until the backend endpoints are live.
// When Nitish's endpoints are ready, set this to false.
// ---------------------------------------------------------------
const USE_MOCK_LEADERBOARD = true;

const MOCK_NAMES = [
  "Aarav S.", "Priya M.", "Rohan K.", "Ananya R.", "Vikram P.",
  "Sneha D.", "Karan T.", "Isha N.", "Arjun B.", "Meera J.",
];

const shortName = (full: string) => {
  const [first, last] = full.trim().split(/\s+/);
  return last ? `${first} ${last.charAt(0)}.` : first || "You";
};

function mockPoints(period: LeaderboardPeriod): LeaderboardResponse {
  const k = period === "week" ? 1 : period === "month" ? 3 : 8;
  const session = getSession();
  return {
    period,
    total_participants: 42,
    entries: MOCK_NAMES.map((name, i) => ({
      rank: i + 1,
      user_id: `mock-${i}`,
      display_name: name,
      points: (300 - i * 24) * k,
      quizzes_taken: (12 - i) * k,
      avg_score: 92 - i * 3,
    })),
    me: session
      ? {
          rank: 12,
          user_id: session.user.id,
          display_name: shortName(session.user.name),
          points: 60 * k,
          quizzes_taken: 3 * k,
          avg_score: 61,
        }
      : null,
  };
}

function mockTopic(subject: string, topic: string, period: LeaderboardPeriod): TopicLeaderboardResponse {
  const levels = ["Hard", "Hard", "Medium", "Hard", "Medium", "Easy", "Medium", "Easy", "Easy", "Medium"];
  const session = getSession();
  return {
    subject,
    topic,
    period,
    total_participants: 18,
    entries: MOCK_NAMES.map((name, i) => ({
      rank: i + 1,
      user_id: `mock-${i}`,
      display_name: name,
      points: 60 - i * 5,
      score_percentage: 100 - i * 4,
      difficulty: levels[i],
      correct_count: 10 - Math.floor(i / 2),
      total_questions: 10,
      achieved_at: new Date(Date.now() - i * 86400000).toISOString(),
    })),
    me: session
      ? {
          rank: 11,
          user_id: session.user.id,
          display_name: shortName(session.user.name),
          points: 12,
          score_percentage: 60,
          difficulty: "Medium",
          correct_count: 6,
          total_questions: 10,
          achieved_at: new Date().toISOString(),
        }
      : null,
  };
}

