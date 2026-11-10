"use client";

import { useCallback, useEffect, useRef, useState, use } from "react";
import { useRouter } from "next/navigation";
import { QuizGenerateResponse, PublicQuestion } from "@/types";
import { apiClient } from "@/lib/api";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Flag,
  GraduationCap,
  Loader2,
  Timer,
  X,
} from "lucide-react";

const TOTAL_SECONDS = 300; // 5 minutes

const LEGEND = [
  { label: "Current", dot: "bg-black" },
  { label: "Answered", dot: "bg-emerald-400" },
  { label: "Marked for review", dot: "bg-amber-400" },
  { label: "Not answered", dot: "border border-stone-400 bg-white" },
];

export default function QuizPlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);
  const quizId = resolvedParams.id;

  const [quizData, setQuizData] = useState<QuizGenerateResponse | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [timeLeft, setTimeLeft] = useState(TOTAL_SECONDS);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Always holds the latest answers, so auto-submit never sends stale data
  const answersRef = useRef<Record<string, string>>({});
  const submittingRef = useRef(false);

  // Load quiz from sessionStorage
  useEffect(() => {
    const raw = sessionStorage.getItem(`quiz_${quizId}`);
    if (raw) {
      try {
        setQuizData(JSON.parse(raw));
      } catch (e) {
        setError("Failed to parse quiz session data.");
      }
    } else {
      setError(
        "Quiz session not found or expired. Please generate a new quiz.",
      );
    }
  }, [quizId]);

  const handleSubmitQuiz = useCallback(async () => {
    if (!quizData || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setShowConfirmModal(false);

    try {
      const response = await apiClient.submitQuiz({
        quiz_session_id: quizId,
        answers: answersRef.current,
      });

      // Save results in sessionStorage
      sessionStorage.setItem(`results_${quizId}`, JSON.stringify(response));
      router.push(`/quiz/${quizId}/results`);
    } catch (err: any) {
      setError(err.message || "Failed to submit quiz.");
      setSubmitting(false);
      submittingRef.current = false;
    }
  }, [quizData, quizId, router]);

  // Timer: one steady interval, started once the quiz is loaded
  useEffect(() => {
    if (!quizData) return;
    const id = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [quizData]);

  // Auto-submit when time runs out
  useEffect(() => {
    if (quizData && timeLeft === 0) handleSubmitQuiz();
  }, [quizData, timeLeft, handleSubmitQuiz]);

  const setAnswer = (questionId: string, optionKey: string | null) => {
    const next = { ...answersRef.current };
    if (optionKey === null) delete next[questionId];
    else next[questionId] = optionKey;
    answersRef.current = next;
    setAnswers(next);
  };

  const toggleFlag = (questionId: string) => {
    setFlagged((prev) => ({ ...prev, [questionId]: !prev[questionId] }));
  };

  // Keyboard shortcuts: A-D to answer, arrows to move, Esc closes the dialog
  useEffect(() => {
    if (!quizData) return;

    const onKey = (e: KeyboardEvent) => {
      if (submitting) return;
      if (e.key === "Escape") {
        setShowConfirmModal(false);
        return;
      }
      if (showConfirmModal) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "ArrowRight") {
        setCurrentIndex((i) => Math.min(quizData.total_questions - 1, i + 1));
      } else if (e.key === "ArrowLeft") {
        setCurrentIndex((i) => Math.max(0, i - 1));
      } else {
        const key = e.key.toUpperCase();
        const q = quizData.questions[currentIndex];
        if (q && key in q.options) setAnswer(q.id, key);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [quizData, currentIndex, showConfirmModal, submitting]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  /* ----------------------------- States ----------------------------- */

  if (error) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-50 p-4 sm:p-6">
        <div className="w-full max-w-lg rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-700 sm:p-8">
          <AlertCircle className="mx-auto h-10 w-10 text-red-500" />
          <h3 className="mt-3 text-lg font-bold">Session Notice</h3>
          <p className="mt-2 text-sm">{error}</p>
          <button
            onClick={() => router.push("/quiz/new")}
            className="mt-6 w-full rounded-md bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-700 sm:w-auto sm:py-2.5"
          >
            Return to Quiz Generator
          </button>
        </div>
      </div>
    );
  }

  if (!quizData) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-stone-50 text-stone-500">
        <Loader2 className="h-8 w-8 animate-spin text-black" />
        <p className="mt-4 text-sm font-medium">
          Preparing test environment...
        </p>
      </div>
    );
  }

  /* ------------------------------ Derived ------------------------------ */

  const currentQ: PublicQuestion = quizData.questions[currentIndex];
  const total = quizData.total_questions;
  const answeredCount = Object.keys(answers).length;
  const flaggedCount = Object.values(flagged).filter(Boolean).length;
  const unansweredNumbers = quizData.questions
    .map((q, i) => (answers[q.id] ? null : i + 1))
    .filter((n): n is number => n !== null);
  const isFlagged = !!flagged[currentQ.id];

  const timerStyle =
    timeLeft < 60
      ? "border-red-300 bg-red-50 text-red-600 animate-pulse"
      : timeLeft < 120
        ? "border-amber-300 bg-amber-50 text-amber-700"
        : "border-stone-200 bg-stone-100 text-stone-900";

  const paletteClass = (idx: number, q: PublicQuestion) => {
    if (idx === currentIndex) return "border-black bg-black text-white";
    if (flagged[q.id]) return "border-amber-400 bg-amber-100 text-amber-800";
    if (answers[q.id])
      return "border-emerald-300 bg-emerald-100 text-emerald-800";
    return "border-stone-300 bg-white text-stone-600 hover:border-stone-500";
  };

  return (
    <div className="fixed inset-x-0 top-0 z-[60] flex h-dvh flex-col bg-stone-50">
      {/* ------------------------- Top bar ------------------------- */}
      <header className="shrink-0 border-b border-stone-200 bg-white">
        <div className="flex h-14 items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <div className="hidden items-center gap-2 sm:flex">
              <GraduationCap className="h-6 w-6 text-black" />
              <span className="text-base font-extrabold uppercase tracking-[0.18em] text-black">
                MindMark
              </span>
            </div>
            <span className="hidden h-6 w-px bg-stone-200 sm:block" />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-bold text-stone-900">
                {quizData.subject}
              </p>
              <p className="truncate text-xs text-stone-500">
                {quizData.topic}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <button
              onClick={() => setShowConfirmModal(true)}
              disabled={submitting}
              aria-label="Submit assessment"
              className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 active:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
            >
              <CheckCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Submit</span>
            </button>

            <div
              role="timer"
              aria-label="Time remaining"
              className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-mono text-sm font-bold tabular-nums transition-colors sm:gap-2 sm:px-3.5 sm:text-base ${timerStyle}`}
            >
              <Timer className="h-4 w-4" />
              <span>{formatTime(timeLeft)}</span>
            </div>
          </div>
        </div>

        {/* Progress bar: answered / total */}
        <div className="h-1 w-full bg-stone-100">
          <div
            className="h-full bg-black transition-all duration-500"
            style={{ width: `${(answeredCount / total) * 100}%` }}
          />
        </div>
      </header>

      {/* ---------------------------- Body ---------------------------- */}
      <div className="flex min-h-0 flex-1">
        {/* Left sidebar: question palette + legend (desktop) */}
        <aside className="hidden w-72 shrink-0 flex-col gap-6 overflow-y-auto border-r border-stone-200 bg-white p-6 lg:flex">
          <div>
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-bold uppercase tracking-widest text-stone-900">
                Questions
              </h2>
              <span className="text-xs font-medium text-stone-500">
                {answeredCount}/{total} answered
              </span>
            </div>

            <div className="mt-4 grid grid-cols-5 gap-2">
              {quizData.questions.map((q, idx) => (
                <button
                  key={q.id}
                  onClick={() => setCurrentIndex(idx)}
                  aria-label={`Go to question ${idx + 1}`}
                  aria-current={idx === currentIndex ? "step" : undefined}
                  className={`flex aspect-square items-center justify-center rounded-md border text-sm font-bold transition ${paletteClass(
                    idx,
                    q,
                  )}`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
          </div>

          <ul className="space-y-2.5 text-sm text-stone-600">
            {LEGEND.map((l) => (
              <li key={l.label} className="flex items-center gap-2.5">
                <span className={`h-3 w-3 rounded-sm ${l.dot}`} />
                {l.label}
              </li>
            ))}
          </ul>

          <p className="mt-auto rounded-lg bg-stone-50 p-3 text-xs leading-relaxed text-stone-500">
            Tip: press A–D to answer and the left or right arrow keys to move
            between questions.
          </p>
        </aside>

        {/* Main: question */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:gap-3 sm:p-5 sm:pb-5">
          {/* Compact palette for small screens */}
          <div className="flex shrink-0 gap-2 overflow-x-auto px-0.5 py-0.5 lg:hidden">
            {quizData.questions.map((q, idx) => (
              <button
                key={q.id}
                onClick={() => setCurrentIndex(idx)}
                aria-label={`Go to question ${idx + 1}`}
                aria-current={idx === currentIndex ? "step" : undefined}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-sm font-bold transition ${paletteClass(
                  idx,
                  q,
                )}`}
              >
                {idx + 1}
              </button>
            ))}
          </div>

          <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-6">
            {/* Header row */}
            <div className="flex shrink-0 items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-widest text-stone-500">
                Question {currentIndex + 1} of {total}
              </p>
              <button
                onClick={() => toggleFlag(currentQ.id)}
                aria-pressed={isFlagged}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition sm:px-3 ${
                  isFlagged
                    ? "border-amber-400 bg-amber-100 text-amber-800"
                    : "border-stone-300 text-stone-600 hover:border-stone-500 hover:bg-stone-50"
                }`}
              >
                <Flag className="h-3.5 w-3.5" />
                <span className="sm:hidden">
                  {isFlagged ? "Marked" : "Review"}
                </span>
                <span className="hidden sm:inline">
                  {isFlagged ? "Marked for review" : "Mark for review"}
                </span>
              </button>
            </div>

            {/* Question + options (scrolls inside only if very long) */}
            <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
              <h3 className="text-lg font-bold leading-snug text-stone-900 sm:text-xl lg:text-2xl">
                {currentQ.question}
              </h3>

              <div className="mt-3 space-y-2 sm:mt-4 sm:space-y-2.5">
                {Object.entries(currentQ.options).map(([key, label]) => {
                  const isSelected = answers[currentQ.id] === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setAnswer(currentQ.id, key)}
                      aria-pressed={isSelected}
                      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all active:bg-stone-100 sm:gap-3.5 sm:px-4 sm:py-3 ${
                        isSelected
                          ? "border-black bg-stone-50 ring-1 ring-black"
                          : "border-stone-200 bg-white hover:border-stone-400 hover:bg-stone-50"
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm font-bold transition ${
                          isSelected
                            ? "bg-black text-white"
                            : "bg-stone-100 text-stone-700"
                        }`}
                      >
                        {key}
                      </span>
                      <span className="text-[15px] font-medium text-stone-900 sm:text-base">
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {answers[currentQ.id] && (
                <button
                  onClick={() => setAnswer(currentQ.id, null)}
                  className="mt-3 py-1 text-sm font-medium text-stone-500 underline underline-offset-4 transition hover:text-black"
                >
                  Clear my answer
                </button>
              )}
            </div>

            {/* Navigation (always visible) */}
            <div className="mt-3 flex shrink-0 items-center justify-between gap-3 border-t border-stone-100 pt-3 sm:mt-4 sm:pt-4">
              <button
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                className="inline-flex items-center gap-2 rounded-md border border-stone-300 px-4 py-2.5 text-sm font-semibold text-stone-800 transition hover:bg-stone-50 active:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40 sm:px-5"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="sm:hidden">Prev</span>
                <span className="hidden sm:inline">Previous</span>
              </button>

              {currentIndex < total - 1 ? (
                <button
                  onClick={() => setCurrentIndex((prev) => prev + 1)}
                  className="inline-flex items-center gap-2 rounded-md bg-black px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-800 active:bg-stone-700 sm:px-6"
                >
                  Next
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={() => setShowConfirmModal(true)}
                  className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 active:bg-emerald-800 sm:px-6"
                >
                  <CheckCircle className="h-4 w-4" />
                  <span className="sm:hidden">Submit</span>
                  <span className="hidden sm:inline">Submit Assessment</span>
                </button>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* --------------------- Submit confirmation --------------------- */}
      {showConfirmModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="submit-title"
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
        >
          <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <h3
                id="submit-title"
                className="text-xl font-extrabold text-stone-900"
              >
                Submit assessment?
              </h3>
              <button
                onClick={() => setShowConfirmModal(false)}
                aria-label="Close"
                className="rounded-md p-1 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2 text-center sm:gap-3">
              <div className="rounded-xl bg-emerald-50 px-2 py-3 sm:px-3">
                <p className="text-2xl font-extrabold text-emerald-700">
                  {answeredCount}
                </p>
                <p className="text-xs text-stone-600">Answered</p>
              </div>
              <div className="rounded-xl bg-stone-100 px-2 py-3 sm:px-3">
                <p className="text-2xl font-extrabold text-stone-800">
                  {total - answeredCount}
                </p>
                <p className="text-xs text-stone-600">Not answered</p>
              </div>
              <div className="rounded-xl bg-amber-50 px-2 py-3 sm:px-3">
                <p className="text-2xl font-extrabold text-amber-700">
                  {flaggedCount}
                </p>
                <p className="text-xs text-stone-600">For review</p>
              </div>
            </div>

            {unansweredNumbers.length > 0 && (
              <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                You haven&apos;t answered question
                {unansweredNumbers.length > 1 ? "s" : ""}{" "}
                <span className="font-bold">
                  {unansweredNumbers.join(", ")}
                </span>
                .
              </p>
            )}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="w-full rounded-md border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 sm:w-auto sm:py-2.5"
              >
                Continue Quiz
              </button>
              <button
                onClick={handleSubmitQuiz}
                disabled={submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:opacity-50 sm:w-auto sm:py-2.5"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Grading with AI...</span>
                  </>
                ) : (
                  <span>Yes, Submit Now</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shown when time runs out and the quiz is being graded */}
      {submitting && !showConfirmModal && (
        <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
          <Loader2 className="h-8 w-8 animate-spin text-black" />
          <p className="mt-4 text-sm font-medium text-stone-700">
            Submitting and grading...
          </p>
        </div>
      )}
    </div>
  );
}