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
  LeaderboardPeriod,
  LeaderboardResponse,
  TopicLeaderboardResponse,
} from "../types";

import { getSession } from "./session";

// ---------------------------------------------------------------
// API configuration
// ---------------------------------------------------------------

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"
).replace(/\/+$/, "");

const HEALTH_URL = `${API_BASE.replace(/\/api\/v1$/, "")}/health`;

// Set NEXT_PUBLIC_USE_MOCK_LEADERBOARD=true in .env.local to use sample data
// until the backend leaderboard endpoints are live.
const USE_MOCK_LEADERBOARD =
  process.env.NEXT_PUBLIC_USE_MOCK_LEADERBOARD === "true";

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
// Types local to this file
// ---------------------------------------------------------------

export interface AdminFeedbackItem {
  id?: string;
  feedback_id?: string;
  quiz_session_id?: string;
  question_id?: string;
  user_id?: string;
  review_text?: string;
  created_at?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------
// Unauthorized (401) handling
//
// Register a handler once (e.g. in your AuthProvider) to clear the
// session and redirect to /login when the token expires:
//
//   setUnauthorizedHandler(() => { clearSession(); router.push("/login"); });
// ---------------------------------------------------------------

let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

// ---------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------

async function parseError(res: Response, fallback: string): Promise<string> {
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

  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}

// ---------------------------------------------------------------
// Request helper
// ---------------------------------------------------------------

interface RequestOptions {
  method?: string;
  /** Sent as a JSON body with Content-Type: application/json */
  json?: unknown;
  /** Raw body (FormData, URLSearchParams, ...). Ignored if `json` is set. */
  body?: BodyInit;
  headers?: Record<string, string>;
  /** Attach the bearer token and run the 401 handler. Default: true */
  auth?: boolean;
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
  fallback = "Request failed"
): Promise<T> {
  const { method = "GET", json, body, headers = {}, auth = true } = options;

  const baseHeaders =
    json !== undefined
      ? { "Content-Type": "application/json", ...headers }
      : headers;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: auth ? authHeaders(baseHeaders) : baseHeaders,
    body: json !== undefined ? JSON.stringify(json) : body,
  });

  if (!res.ok) {
    if (res.status === 401 && auth) {
      onUnauthorized?.();
    }
    throw new Error(await parseError(res, fallback));
  }

  return res.json();
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
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null);

    if (!me?.ok) {
      // Don't silently fall back to role "student": an admin would be downgraded.
      throw new Error("Signed in, but could not load your profile");
    }

    const raw = await me.json().catch(() => undefined);
    user = raw?.user ?? raw;
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
// Leaderboard: sample data until the backend endpoints are live.
// ---------------------------------------------------------------

const MOCK_NAMES = [
  "Aarav S.",
  "Priya M.",
  "Rohan K.",
  "Ananya R.",
  "Vikram P.",
  "Sneha D.",
  "Karan T.",
  "Isha N.",
  "Arjun B.",
  "Meera J.",
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

function mockTopic(
  subject: string,
  topic: string,
  period: LeaderboardPeriod
): TopicLeaderboardResponse {
  const levels = [
    "Hard",
    "Hard",
    "Medium",
    "Hard",
    "Medium",
    "Easy",
    "Medium",
    "Easy",
    "Easy",
    "Medium",
  ];
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

// ---------------------------------------------------------------
// API CLIENT
// ---------------------------------------------------------------

export const apiClient = {
  /** Health Check */
  checkHealth: async () => {
    const res = await fetch(HEALTH_URL);

    if (!res.ok) {
      throw new Error("Backend server is unreachable");
    }

    return res.json();
  },

  /** Screen 1: Upload Syllabus PDF */
  uploadSyllabus: (
    subject: string,
    file: File
  ): Promise<SyllabusUploadResponse> => {
    const formData = new FormData();
    formData.append("subject", subject);
    formData.append("file", file);

    return request<SyllabusUploadResponse>(
      "/syllabus/upload-pdf",
      { method: "POST", body: formData },
      "Failed to upload syllabus PDF"
    );
  },

  /** Screen 2: Fetch uploaded subjects and topics */
  getSubjects: () =>
    request("/syllabus/subjects", {}, "Failed to fetch subjects from database"),

  /** Screen 3: Generate Quiz */
  generateQuiz: (params: QuizGenerateRequest): Promise<QuizGenerateResponse> =>
    request<QuizGenerateResponse>(
      "/quiz/generate",
      { method: "POST", json: params },
      "Failed to generate quiz"
    ),

  /** Screen 4: Submit Quiz Answers */
  submitQuiz: (payload: QuizSubmitRequest): Promise<QuizSubmitResponse> =>
    request<QuizSubmitResponse>(
      "/quiz/submit",
      { method: "POST", json: payload },
      "Failed to submit quiz answers"
    ),

  /**
   * Screen 4.1: Submit Individual Question Feedback
   * POST /quiz/{quiz_session_id}/feedback
   * Body: { question_id, review_text } -> { feedback_id }
   */
  submitQuestionFeedback: (
    quizSessionId: string,
    questionId: string,
    reviewText: string
  ): Promise<{ feedback_id: string }> => {
    if (!quizSessionId || !questionId || !reviewText.trim()) {
      return Promise.reject(new Error("Please provide valid feedback details."));
    }

    return request<{ feedback_id: string }>(
      `/quiz/${encodeURIComponent(quizSessionId)}/feedback`,
      {
        method: "POST",
        json: {
          question_id: questionId,
          review_text: reviewText.trim(),
        },
      },
      "Failed to submit question feedback"
    );
  },

  /** Screen 5: AI Tutor - Explain My Mistake */
  explainMistake: (data: TutorExplainRequest): Promise<TutorExplainResponse> =>
    request<TutorExplainResponse>(
      "/tutor/explain",
      { method: "POST", json: data },
      "Failed to retrieve AI tutor explanation"
    ),

  /** Auth: Login */
  login: async (payload: LoginRequest): Promise<AuthResponse> => {
    const data = AUTH.loginAsForm
      ? await request<any>(
          AUTH.login,
          {
            method: "POST",
            auth: false,
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              username: payload.email,
              password: payload.password,
            }),
          },
          "Invalid email or password"
        )
      : await request<any>(
          AUTH.login,
          { method: "POST", auth: false, json: payload },
          "Invalid email or password"
        );

    return normalizeAuth(data, { email: payload.email });
  },

  /** Auth: Signup */
  signup: async (payload: SignupRequest): Promise<AuthResponse> => {
    const data = await request<any>(
      AUTH.signup,
      {
        method: "POST",
        auth: false,
        json: {
          full_name: payload.name,
          email: payload.email,
          password: payload.password,
        },
      },
      "Could not create your account"
    ).catch((err) => {
      throw err;
    });

    if (!data?.access_token && !data?.token) {
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

  /** Auth: Google Login */
  googleLogin: async (credential: string): Promise<AuthResponse> => {
    const data = await request<any>(
      AUTH.google,
      { method: "POST", auth: false, json: { credential } },
      "Google sign-in failed"
    );

    return normalizeAuth(data, {});
  },

  /** Auth: Get Current User */
  getMe: async (): Promise<AuthUser> => {
    const raw = await request<any>(
      AUTH.me,
      {},
      "Could not load your profile"
    );
    const u = raw.user ?? raw;

    return {
      id: String(u.id),
      name: u.full_name ?? u.name ?? "",
      email: u.email,
      role: String(u.role ?? "student").toLowerCase() as AuthUser["role"],
    };
  },

  /** Student: My Quiz History */
  getMyQuizHistory: (): Promise<AdminUserHistoryItem[]> =>
    request<AdminUserHistoryItem[]>(
      "/quiz/my-history",
      {},
      "Failed to load quiz history"
    ),

  /** Leaderboard: total points */
  getLeaderboard: async (
    period: LeaderboardPeriod
  ): Promise<LeaderboardResponse> => {
    if (USE_MOCK_LEADERBOARD) return mockPoints(period);

    return request<LeaderboardResponse>(
      `/leaderboard?period=${encodeURIComponent(period)}`,
      {},
      "Failed to load the leaderboard"
    );
  },

  /** Leaderboard: best attempts for one subject and topic */
  getTopicLeaderboard: async (
    subject: string,
    topic: string,
    period: LeaderboardPeriod
  ): Promise<TopicLeaderboardResponse> => {
    if (USE_MOCK_LEADERBOARD) return mockTopic(subject, topic, period);

    const params = new URLSearchParams({ subject, topic, period });

    return request<TopicLeaderboardResponse>(
      `/leaderboard/topic?${params}`,
      {},
      "Failed to load the topic leaderboard"
    );
  },

  /** Admin: List All Users */
  getAdminUsers: (): Promise<AdminUserListItem[]> =>
    request<AdminUserListItem[]>("/admin/users", {}, "Failed to load users"),

  /** Admin: Quiz History for One User */
  getAdminUserHistory: (userId: string): Promise<AdminUserHistoryItem[]> =>
    request<AdminUserHistoryItem[]>(
      `/admin/users/${encodeURIComponent(userId)}/history`,
      {},
      "Failed to load user history"
    ),

  /** Admin: All question feedback */
  getAdminFeedback: (): Promise<AdminFeedbackItem[]> =>
    request<AdminFeedbackItem[]>(
      "/admin/feedback",
      {},
      "Failed to load feedback"
    ),

  /** Admin: Change User Role */
  updateUserRole: (
    userId: string,
    role: "admin" | "student"
  ): Promise<AdminUserListItem> =>
    request<AdminUserListItem>(
      `/admin/users/${encodeURIComponent(userId)}/role`,
      { method: "PATCH", json: { role } },
      "Failed to update role"
    ),
};