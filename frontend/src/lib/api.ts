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

// Base API URL pointing to the FastAPI backend
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const HEALTH_URL = API_BASE.replace(/\/api\/v1\/?$/, "") + "/health";

// ---------------------------------------------------------------
// Auth config: CHECK http://localhost:8000/docs and adjust these
// ---------------------------------------------------------------
const AUTH = {
  login: "/auth/login",
  signup: "/auth/signup", // some backends use /auth/register
  google: "/auth/google",
  me: "/auth/me",
  // Set to true if Swagger shows "username" + "password" form fields
  // (FastAPI OAuth2PasswordRequestForm). Set to false for a JSON body.
  loginAsForm: false,
};

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

// Adds the Bearer token (if logged in) to a set of headers
function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getSession()?.access_token;
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}

// The backend returns { access_token, token_type, user: { full_name, role, ... } }.
// This guarantees we always end up with { access_token, user: { id, name, email, role } }.
async function normalizeAuth(
  data: any,
  fallbackUser: Partial<AuthUser>
): Promise<AuthResponse> {
  const token: string = data.access_token ?? data.token;
  if (!token) throw new Error("Server did not return a token");

  let user: any = data.user;

  if (!user) {
    const me = await fetch(`${API_BASE}${AUTH.me}`, {
      headers: { Authorization: `Bearer ${token}` },
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
      // Backend sends "full_name"; the app uses "name"
      name:
        user?.full_name ??
        user?.name ??
        fallbackUser.name ??
        fallbackUser.email?.split("@")[0] ??
        "",
      email: user?.email ?? fallbackUser.email ?? "",
      role: String(user?.role ?? data.role ?? "student").toLowerCase() as AuthUser["role"],
    },
  };
}

export const apiClient = {
  /**
   * Health Check
   */
  checkHealth: async () => {
    const res = await fetch(HEALTH_URL);
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
      headers: authHeaders(), // don't set Content-Type: browser sets it for FormData
      body: formData,
    });

    if (!res.ok) throw new Error(await parseError(res, "Failed to upload syllabus PDF"));
    return res.json();
  },

  /**
   * Screen 2: Fetch all uploaded subjects & topics from database
   */
  getSubjects: async () => {
    const res = await fetch(`${API_BASE}/syllabus/subjects`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(await parseError(res, "Failed to fetch subjects from database"));
    return res.json();
  },

  /**
   * Screen 3: Generate Quiz (Zero-Leak)
   */
  generateQuiz: async (params: QuizGenerateRequest): Promise<QuizGenerateResponse> => {
    const res = await fetch(`${API_BASE}/quiz/generate`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(params),
    });

    if (!res.ok) throw new Error(await parseError(res, "Failed to generate quiz"));
    return res.json();
  },

  /**
   * Screen 4: Submit Student Answers & Receive Score
   * (the token links this attempt to the logged-in user's history)
   */
  submitQuiz: async (payload: QuizSubmitRequest): Promise<QuizSubmitResponse> => {
    const res = await fetch(`${API_BASE}/quiz/submit`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(await parseError(res, "Failed to submit quiz answers"));
    return res.json();
  },

  /**
   * Screen 5: AI Tutor "Explain My Mistake"
   */
  explainMistake: async (data: TutorExplainRequest): Promise<TutorExplainResponse> => {
    const res = await fetch(`${API_BASE}/tutor/explain`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(data),
    });

    if (!res.ok) throw new Error(await parseError(res, "Failed to retrieve AI tutor explanation"));
    return res.json();
  },

  /**
   * Auth: Log in
   */
  login: async (payload: LoginRequest): Promise<AuthResponse> => {
    const res = AUTH.loginAsForm
      ? await fetch(`${API_BASE}${AUTH.login}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            username: payload.email,
            password: payload.password,
          }),
        })
      : await fetch(`${API_BASE}${AUTH.login}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

    if (!res.ok) throw new Error(await parseError(res, "Invalid email or password"));
    return normalizeAuth(await res.json(), { email: payload.email });
  },

  /**
   * Auth: Sign up
   */
  signup: async (payload: SignupRequest): Promise<AuthResponse> => {
    const res = await fetch(`${API_BASE}${AUTH.signup}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // The backend field is "full_name"; our form field is "name"
      body: JSON.stringify({
        full_name: payload.name,
        email: payload.email,
        password: payload.password,
      }),
    });

    if (!res.ok) throw new Error(await parseError(res, "Could not create your account"));
    const data = await res.json().catch(() => ({}));

    // If signup doesn't return a token, log in right after
    if (!data.access_token && !data.token) {
      return apiClient.login({ email: payload.email, password: payload.password });
    }
    return normalizeAuth(data, { name: payload.name, email: payload.email });
  },

  /**
   * Auth: Sign in with Google (the credential is Google's ID token)
   * Works for both login and signup: the backend creates the account if needed.
   */
  googleLogin: async (credential: string): Promise<AuthResponse> => {
    const res = await fetch(`${API_BASE}${AUTH.google}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential }),
    });

    if (!res.ok) throw new Error(await parseError(res, "Google sign-in failed"));
    return normalizeAuth(await res.json(), {});
  },

  /**
   * Auth: current user (use it to refresh the role after it changes)
   */
  getMe: async (): Promise<AuthUser> => {
    const res = await fetch(`${API_BASE}${AUTH.me}`, { headers: authHeaders() });
    if (!res.ok) throw new Error(await parseError(res, "Could not load your profile"));
    const raw = await res.json();
    const u = raw.user ?? raw; // /auth/me may wrap the user, like login does
    return {
      id: String(u.id),
      name: u.full_name ?? u.name ?? "",
      email: u.email,
      role: String(u.role ?? "student").toLowerCase() as AuthUser["role"],
    };
  },

  /**
   * Student: my own quiz history
   */
  getMyQuizHistory: async (): Promise<AdminUserHistoryItem[]> => {
    const res = await fetch(`${API_BASE}/quiz/my-history`, { headers: authHeaders() });
    if (!res.ok) throw new Error(await parseError(res, "Failed to load quiz history"));
    return res.json();
  },

  /**
   * Admin: list all users
   */
  getAdminUsers: async (): Promise<AdminUserListItem[]> => {
    const res = await fetch(`${API_BASE}/admin/users`, { headers: authHeaders() });
    if (!res.ok) throw new Error(await parseError(res, "Failed to load users"));
    return res.json();
  },

  /**
   * Admin: quiz history for one user
   */
  getAdminUserHistory: async (userId: string): Promise<AdminUserHistoryItem[]> => {
    const res = await fetch(`${API_BASE}/admin/users/${userId}/history`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(await parseError(res, "Failed to load user history"));
    return res.json();
  },

  /**
   * Admin: change a user's role (the backend accepts only "admin" or "user")
   */
  updateUserRole: async (userId: string, role: "admin" | "user"): Promise<AdminUserListItem> => {
    const res = await fetch(`${API_BASE}/admin/users/${userId}/role`, {
      method: "PATCH",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ role }),
    });
    if (!res.ok) throw new Error(await parseError(res, "Failed to update role"));
    return res.json();
  },
};