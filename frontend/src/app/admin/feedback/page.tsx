"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  HelpCircle,
  MessageSquare,
  RefreshCw,
  Search,
} from "lucide-react";
import { apiClient } from "@/lib/api";

/* ------------------------------ types ------------------------------ */

type FeedbackEntry = {
  id: string;
  name: string;
  email: string;
  comment: string;
  question: string;
  questionId: string;
  subject: string;
  topic: string;
  createdAt: string | null;
};

type Range = "all" | "today" | "7d" | "30d";

/* ----------------------------- helpers ----------------------------- */

// The backend sends times without a timezone. Treat them as UTC.
function toDate(value: string): Date {
  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(value);
  return new Date(hasZone ? value : `${value}Z`);
}

function formatDateTime(value: string | null): string {
  if (!value) return "";
  const d = toDate(value);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const str = (v: any): string => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());

// First non-empty value among several possible field names
const pick = (obj: any, keys: string[]): string => {
  for (const k of keys) {
    const v = str(obj?.[k]);
    if (v) return v;
  }
  return "";
};

// Fallback: the longest text field that isn't an id, a name, a date, etc.
const SKIP_KEYS = /(^|_)(id|email|name|created|updated|time|date|subject|topic|question|role|token|url)(_|$)|at$/i;
function guessComment(f: any): string {
  let best = "";
  for (const [key, value] of Object.entries(f ?? {})) {
    if (typeof value !== "string" || SKIP_KEYS.test(key)) continue;
    if (value.trim().length > best.length) best = value.trim();
  }
  return best;
}

// Accepts a plain array or { items | feedback | data: [...] }
function normalizeFeedback(raw: any): FeedbackEntry[] {
  const list = Array.isArray(raw) ? raw : (raw?.items ?? raw?.feedback ?? raw?.data ?? []);
  if (!Array.isArray(list)) return [];

  return list
    .map((f: any, i: number): FeedbackEntry => {
      const q = f.question;
      const questionText =
        (typeof q === "string" ? q : str(q?.question ?? q?.text)) ||
        pick(f, ["question_text", "questionText", "quiz_question"]);

      return {
        id: str(f.id ?? f.feedback_id) || String(i),
        name: pick(f, ["user_name", "full_name", "name", "username"]) ||
          str(f.user?.full_name ?? f.user?.name),
        email: pick(f, ["user_email", "email"]) || str(f.user?.email),
        comment:
          pick(f, [
            "comment", "comments", "message", "feedback", "feedback_text", "text",
            "description", "details", "issue", "report", "note", "notes", "remarks", "suggestion",
          ]) || guessComment(f),
        question: questionText,
        questionId: pick(f, ["question_id", "questionId"]) || str(q?.id),
        subject: pick(f, ["subject"]) || str(f.quiz?.subject),
        topic: pick(f, ["topic"]) || str(f.quiz?.topic),
        createdAt: f.created_at ?? f.submitted_at ?? f.timestamp ?? f.date ?? null,
      };
    })
    .sort((a, b) => {
      const ta = a.createdAt ? toDate(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? toDate(b.createdAt).getTime() : 0;
      return tb - ta; // newest first
    });
}

const RANGES: { id: Range; label: string }[] = [
  { id: "all", label: "All time" },
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
];

function inRange(createdAt: string | null, range: Range): boolean {
  if (range === "all") return true;
  if (!createdAt) return false;
  const t = toDate(createdAt).getTime();
  if (isNaN(t)) return false;
  const now = Date.now();
  if (range === "today") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return t >= start.getTime();
  }
  const days = range === "7d" ? 7 : 30;
  return t >= now - days * 24 * 60 * 60 * 1000;
}

/* ------------------------------- page ------------------------------- */

export default function FeedbackPage() {
  const [items, setItems] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [range, setRange] = useState<Range>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = await apiClient.getAdminFeedback();
      // TEMPORARY: remove this line once the fields show correctly
      console.log("FEEDBACK RAW:", JSON.stringify(Array.isArray(raw) ? raw.slice(0, 2) : raw, null, 2));
      setItems(normalizeFeedback(raw));
    } catch (err: any) {
      setError(err?.message || "Failed to load feedback");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const thisWeek = items.filter(
      (i) => i.createdAt && toDate(i.createdAt).getTime() >= weekAgo
    ).length;
    const uniqueQuestions = new Set(
      items.map((i) => i.questionId || i.question).filter(Boolean)
    ).size;
    return { total: items.length, thisWeek, uniqueQuestions };
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      if (!inRange(i.createdAt, range)) return false;
      if (!q) return true;
      return [i.name, i.email, i.comment, i.question, i.subject, i.topic].some((s) =>
        s.toLowerCase().includes(q)
      );
    });
  }, [items, query, range]);

  return (
    <div className="mx-auto max-w-[1400px]">
      {/* Title */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">Feedback</h1>
          <p className="mt-1 text-neutral-500">
            {loading
              ? "Loading feedback..."
              : `${stats.total} ${stats.total === 1 ? "report" : "reports"} from students`}
          </p>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search question, comment or student"
            aria-label="Search feedback"
            className="w-full rounded-xl border border-neutral-300 bg-white py-2.5 pl-10 pr-4 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-red-500" />
          <p className="mt-2 text-sm font-semibold text-red-800">{error}</p>
          <button
            onClick={load}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
        </div>
      )}

      {/* Loading placeholders */}
      {loading && !error && (
        <div className="mt-8 space-y-3" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl bg-neutral-200/70" />
          ))}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Summary */}
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <MessageSquare className="h-5 w-5" />
              </span>
              <div>
                <p className="text-2xl font-extrabold text-neutral-900">{stats.total}</p>
                <p className="text-sm text-neutral-500">Total reports</p>
              </div>
            </div>

            <div className="flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <CalendarDays className="h-5 w-5" />
              </span>
              <div>
                <p className="text-2xl font-extrabold text-neutral-900">{stats.thisWeek}</p>
                <p className="text-sm text-neutral-500">In the last 7 days</p>
              </div>
            </div>

            <div className="flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <HelpCircle className="h-5 w-5" />
              </span>
              <div>
                <p className="text-2xl font-extrabold text-neutral-900">{stats.uniqueQuestions}</p>
                <p className="text-sm text-neutral-500">Different questions reported</p>
              </div>
            </div>
          </div>

          {/* Date filter */}
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {RANGES.map((r) => (
              <button
                key={r.id}
                onClick={() => setRange(r.id)}
                aria-pressed={range === r.id}
                className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
                  range === r.id
                    ? "border-black bg-black text-white"
                    : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-500"
                }`}
              >
                {r.label}
              </button>
            ))}
            <span className="ml-auto text-sm text-neutral-500">
              Showing {filtered.length} of {items.length}
            </span>
          </div>

          {/* Empty */}
          {filtered.length === 0 && (
            <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-14 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600">
                <MessageSquare className="h-6 w-6" />
              </span>
              <p className="mt-4 text-base font-bold text-neutral-900">
                {items.length === 0 ? "No feedback yet" : "No feedback matches your filters"}
              </p>
              <p className="mt-1 max-w-sm text-sm text-neutral-500">
                {items.length === 0
                  ? "Reports about questions, like spelling mistakes, will appear here."
                  : "Try a different date range, or clear the search."}
              </p>
            </div>
          )}

          {/* List */}
          <ul className="mt-6 space-y-3">
            {filtered.map((f) => {
              const display = f.name || f.email || "Anonymous";
              return (
                <li
                  key={f.id}
                  className="rounded-2xl border border-neutral-200 bg-white p-5 transition hover:shadow-sm"
                >
                  {/* Who + when */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-sm font-bold text-white">
                        {display.trim().charAt(0).toUpperCase() || "A"}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-neutral-900">{display}</p>
                        {f.name && f.email && (
                          <p className="truncate text-xs text-neutral-500">{f.email}</p>
                        )}
                      </div>
                    </div>
                    {f.createdAt && (
                      <span className="text-xs text-neutral-500">{formatDateTime(f.createdAt)}</span>
                    )}
                  </div>

                  {/* The question that was reported */}
                  {(f.question || f.questionId) && (
                    <div className="mt-4 rounded-xl border-l-4 border-amber-400 bg-amber-50/60 px-4 py-3">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-amber-700">
                        Reported question
                      </p>
                      <p className="mt-1 text-[15px] font-medium leading-snug text-neutral-900">
                        {f.question || `Question ID: ${f.questionId}`}
                      </p>
                    </div>
                  )}

                  {/* The feedback */}
                  <div className="mt-3">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">
                      Feedback
                    </p>
                    {f.comment ? (
                      <p className="mt-1 whitespace-pre-line text-[15px] leading-relaxed text-neutral-800">
                        {f.comment}
                      </p>
                    ) : (
                      <p className="mt-1 text-sm italic text-neutral-400">No written comment.</p>
                    )}
                  </div>

                  {/* Quiz info */}
                  {(f.subject || f.topic) && (
                    <div className="mt-3">
                      <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700">
                        {[f.subject, f.topic].filter(Boolean).join(" · ")}
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}