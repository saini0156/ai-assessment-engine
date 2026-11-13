
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";

import { apiClient } from "@/lib/api";
import { getSession } from "@/lib/session";

import type {
  AdminUserHistoryItem,
  AdminUserListItem,
  UserRole,
} from "@/types";

/* ----------------------------- helpers ----------------------------- */

function toDate(value: string): Date {
  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(value);
  return new Date(hasZone ? value : `${value}Z`);
}

function formatDate(value: string | null): string {
  if (!value) return "—";

  const d = toDate(value);
  if (isNaN(d.getTime())) return "—";

  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value: string): string {
  const d = toDate(value);
  if (isNaN(d.getTime())) return "—";

  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function scoreTone(score: number): string {
  if (score >= 70) return "bg-emerald-50 text-emerald-700";
  if (score >= 40) return "bg-amber-50 text-amber-700";
  return "bg-red-50 text-red-700";
}

function formatAvg(avg: number | null): string {
  return avg === null ? "—" : `${Math.round(avg * 10) / 10}%`;
}

const LEVEL_TONE: Record<string, string> = {
  Easy: "bg-emerald-50 text-emerald-700",
  Medium: "bg-amber-50 text-amber-700",
  Hard: "bg-red-50 text-red-700",
};

/* --------------------------- history drawer --------------------------- */

function HistoryDrawer({
  user,
  onClose,
}: {
  user: AdminUserListItem;
  onClose: () => void;
}) {
  const [items, setItems] = useState<AdminUserHistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setItems(null);
    setError(null);

    apiClient
      .getAdminUserHistory(user.id)
      .then((res) => {
        if (!cancelled) setItems(res);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load quiz history"
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKey);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const avg =
    items && items.length
      ? Math.round(
          (items.reduce((sum, item) => sum + item.score_percentage, 0) /
            items.length) *
            10
        ) / 10
      : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-title"
      className="fixed inset-0 z-[80] flex justify-end bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex h-dvh w-full max-w-md flex-col bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-5 py-4">
          <div className="min-w-0">
            <h2
              id="history-title"
              className="truncate text-lg font-extrabold text-neutral-900"
            >
              {user.name}
            </h2>
            <p className="truncate text-sm text-neutral-500">
              {user.email}
            </p>
          </div>

          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-5">
          {items === null && !error && (
            <div className="flex flex-col items-center py-16 text-neutral-500">
              <Loader2 className="h-6 w-6 animate-spin text-black" />
              <p className="mt-3 text-sm">Loading quiz history...</p>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          {items && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-neutral-100 px-4 py-3">
                  <p className="text-2xl font-extrabold text-neutral-900">
                    {items.length}
                  </p>
                  <p className="text-xs text-neutral-500">Attempts</p>
                </div>

                <div className="rounded-xl bg-neutral-100 px-4 py-3">
                  <p className="text-2xl font-extrabold text-neutral-900">
                    {avg === null ? "—" : `${avg}%`}
                  </p>
                  <p className="text-xs text-neutral-500">
                    Average score
                  </p>
                </div>
              </div>

              {items.length === 0 ? (
                <p className="mt-8 text-center text-sm text-neutral-500">
                  This user hasn&apos;t taken any quizzes yet.
                </p>
              ) : (
                <ul className="mt-5 space-y-3">
                  {items.map((h) => (
                    <li
                      key={h.quiz_session_id}
                      className="rounded-xl border border-neutral-200 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-bold text-neutral-900">
                            {h.subject}
                          </p>
                          <p className="truncate text-sm text-neutral-500">
                            {h.topic}
                          </p>
                        </div>

                        <span
                          className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold ${scoreTone(
                            h.score_percentage
                          )}`}
                        >
                          {Math.round(h.score_percentage)}%
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className={`rounded-full px-2.5 py-1 font-semibold ${
                            LEVEL_TONE[h.difficulty] ??
                            "bg-neutral-100 text-neutral-600"
                          }`}
                        >
                          {h.difficulty}
                        </span>

                        <span className="text-neutral-500">
                          {h.correct_count}/{h.total_questions} correct
                        </span>

                        <span className="text-neutral-300">•</span>

                        <span className="text-neutral-500">
                          {formatDateTime(h.submitted_at)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- page ------------------------------- */

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<AdminUserListItem | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [notice, setNotice] = useState<{
    type: "ok" | "error";
    text: string;
  } | null>(null);

  const myId = getSession()?.user?.id;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await apiClient.getAdminUsers();
      setUsers(data);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to load users"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!notice) return;

    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const handleRoleChange = async (
    user: AdminUserListItem,
    role: UserRole
  ) => {
    if (savingId) return;

    setSavingId(user.id);
    setNotice(null);

    try {
      const updated = await apiClient.updateUserRole(user.id, role);

      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id
            ? { ...u, role: updated.role }
            : u
        )
      );

      setNotice({
        type: "ok",
        text: `${user.name} is now ${
          role === "admin" ? "an admin" : "a student"
        }.`,
      });
    } catch (err: unknown) {
      setNotice({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Could not update the role.",
      });
    } finally {
      setSavingId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return users;

    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
    );
  }, [users, query]);

  const adminCount = users.filter(
    (u) => u.role === "admin"
  ).length;

  const RoleSelect = ({ user }: { user: AdminUserListItem }) => (
    <div
      className="relative inline-flex items-center"
      onClick={(e) => e.stopPropagation()}
    >
      <select
        value={user.role}
        disabled={savingId === user.id || savingId !== null}
        onChange={(e) =>
          void handleRoleChange(user, e.target.value as UserRole)
        }
        aria-label={`Role for ${user.name}`}
        className={`rounded-lg border py-1.5 pl-3 pr-8 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-black/20 disabled:cursor-wait disabled:opacity-60 ${
          user.role === "admin"
            ? "border-black bg-black text-white"
            : "border-neutral-300 bg-white text-neutral-800"
        }`}
      >
        <option value="user">Student</option>
        <option value="admin">Admin</option>
      </select>

      {savingId === user.id && (
        <Loader2 className="pointer-events-none absolute right-2 h-4 w-4 animate-spin text-neutral-400" />
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">
            Users
          </h1>

          <p className="mt-1 text-neutral-500">
            {loading
              ? "Loading users..."
              : `${users.length} ${
                  users.length === 1 ? "user" : "users"
                } · ${adminCount} ${
                  adminCount === 1 ? "admin" : "admins"
                }`}
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />

          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or email"
            aria-label="Search users"
            className="w-full rounded-xl border border-neutral-300 bg-white py-2.5 pl-10 pr-4 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
          />
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className={`mt-6 flex items-start gap-2.5 rounded-xl border p-3.5 text-sm ${
            notice.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {notice.type === "ok" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}

          {notice.text}
        </div>
      )}

      {error && (
        <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-red-500" />

          <p className="mt-2 text-sm font-semibold text-red-800">
            {error}
          </p>

          <button
            onClick={() => void load()}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
        </div>
      )}

      {loading && !error && (
        <div className="mt-8 space-y-3" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-2xl bg-neutral-200/70"
            />
          ))}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600">
            <Users className="h-6 w-6" />
          </span>

          <p className="mt-4 text-base font-bold text-neutral-900">
            {query ? "No users match your search" : "No users yet"}
          </p>

          <p className="mt-1 max-w-sm text-sm text-neutral-500">
            {query
              ? "Try a different name or email."
              : "People who sign up will appear here."}
          </p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <>
          <div className="mt-8 hidden overflow-hidden rounded-2xl border border-neutral-200 bg-white md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 text-xs font-bold uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="px-5 py-3.5">User</th>
                  <th className="px-5 py-3.5">Role</th>
                  <th className="px-5 py-3.5">Quizzes</th>
                  <th className="px-5 py-3.5">Avg score</th>
                  <th className="px-5 py-3.5">Last active</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-neutral-100">
                {filtered.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => setSelected(u)}
                    className="cursor-pointer transition hover:bg-neutral-50"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-sm font-bold text-white">
                          {u.name.trim().charAt(0).toUpperCase() || "U"}
                        </span>

                        <div className="min-w-0">
                          <p className="truncate font-semibold text-neutral-900">
                            {u.name}
                            {u.id === myId && (
                              <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-600">
                                You
                              </span>
                            )}
                          </p>

                          <p className="truncate text-neutral-500">
                            {u.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <RoleSelect user={u} />
                    </td>

                    <td className="px-5 py-4 font-semibold text-neutral-900">
                      {u.quizzes_taken}
                    </td>

                    <td className="px-5 py-4">
                      {u.avg_score === null ? (
                        <span className="text-neutral-400">—</span>
                      ) : (
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-bold ${scoreTone(
                            u.avg_score
                          )}`}
                        >
                          {formatAvg(u.avg_score)}
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4 text-neutral-500">
                      {formatDate(u.last_active)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="mt-8 space-y-3 md:hidden">
            {filtered.map((u) => (
              <li key={u.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelected(u)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelected(u);
                    }
                  }}
                  className="rounded-2xl border border-neutral-200 bg-white p-4 text-left transition active:bg-neutral-50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-sm font-bold text-white">
                        {u.name.trim().charAt(0).toUpperCase() || "U"}
                      </span>

                      <div className="min-w-0">
                        <p className="truncate font-semibold text-neutral-900">
                          {u.name}
                          {u.id === myId && (
                            <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-600">
                              You
                            </span>
                          )}
                        </p>

                        <p className="truncate text-sm text-neutral-500">
                          {u.email}
                        </p>
                      </div>
                    </div>

                    <RoleSelect user={u} />
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-neutral-100 py-2">
                      <p className="text-base font-extrabold text-neutral-900">
                        {u.quizzes_taken}
                      </p>
                      <p className="text-[11px] text-neutral-500">
                        Quizzes
                      </p>
                    </div>

                    <div className="rounded-lg bg-neutral-100 py-2">
                      <p className="text-base font-extrabold text-neutral-900">
                        {formatAvg(u.avg_score)}
                      </p>
                      <p className="text-[11px] text-neutral-500">
                        Avg score
                      </p>
                    </div>

                    <div className="rounded-lg bg-neutral-100 py-2">
                      <p className="text-sm font-bold text-neutral-900">
                        {formatDate(u.last_active)}
                      </p>
                      <p className="text-[11px] text-neutral-500">
                        Last active
                      </p>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-4 flex items-center gap-1.5 text-xs text-neutral-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            Click a user to see their quiz history.
          </p>
        </>
      )}

      {selected && (
        <HistoryDrawer
          user={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
