"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { QuizSubmitResponse, QuestionReview } from "@/types";
import { TutorModal } from "@/components/tutor/TutorModal";
import { CheckCircle2, XCircle, Sparkles, RotateCcw, Home } from "lucide-react";
import Link from "next/link";

const RING_RADIUS = 54;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

export default function QuizResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const quizId = resolvedParams.id;

  const [results, setResults] = useState<QuizSubmitResponse | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [ringOn, setRingOn] = useState(false);
  const [filter, setFilter] = useState<"all" | "missed">("all");
  const [activeTutorReview, setActiveTutorReview] = useState<QuestionReview | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem(`results_${quizId}`);
    if (raw) {
      try {
        setResults(JSON.parse(raw));
      } catch (e) {
        console.error("Failed to parse results:", e);
      }
    }
    setLoaded(true);
  }, [quizId]);

  // Start the ring animation just after the page appears
  useEffect(() => {
    if (!results) return;
    const t = setTimeout(() => setRingOn(true), 150);
    return () => clearTimeout(t);
  }, [results]);

  if (!loaded) {
    return <div className="py-24 text-center text-sm text-stone-500">Loading your results...</div>;
  }

  if (!results) {
    return (
      <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
        <h3 className="text-xl font-extrabold text-stone-900">No Assessment Results Found</h3>
        <p className="mt-2 text-sm text-stone-500">
          We could not locate the submitted score for this session.
        </p>
        <button
          onClick={() => router.push("/quiz/new")}
          className="mt-6 w-full rounded-md bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800 sm:w-auto"
        >
          Take a New Quiz
        </button>
      </div>
    );
  }

  const score = results.score_percentage;
  const missed = results.total_questions - results.correct_count;
  const isPassing = score >= 70;

  const tone =
    score >= 70
      ? { ring: "stroke-emerald-500", text: "text-emerald-600", label: "Great work" }
      : score >= 40
        ? { ring: "stroke-amber-500", text: "text-amber-600", label: "Getting there" }
        : { ring: "stroke-red-500", text: "text-red-600", label: "Keep practising" };

  const visibleReviews = results.reviews
    .map((rev, idx) => ({ rev, idx }))
    .filter(({ rev }) => (filter === "missed" ? !rev.is_correct : true));

  return (
    <div className="mx-auto w-full pb-10">
      <div className="grid gap-6 lg:grid-cols-[360px_1fr] lg:items-start lg:gap-8">
        {/* ====================== Scorecard (left) ====================== */}
        <aside className="space-y-4 lg:sticky lg:top-24">
          <div className="rounded-2xl border border-stone-200 bg-white p-6 text-center shadow-sm sm:p-8">
            <p className="text-xs font-bold uppercase tracking-widest text-stone-500">
              Assessment complete
            </p>

            {/* Mastery ring */}
            <div className="relative mx-auto mt-5 h-40 w-40 sm:h-44 sm:w-44">
              <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                <circle
                  cx="60"
                  cy="60"
                  r={RING_RADIUS}
                  fill="none"
                  strokeWidth="10"
                  className="stroke-stone-100"
                />
                <circle
                  cx="60"
                  cy="60"
                  r={RING_RADIUS}
                  fill="none"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={RING_LENGTH}
                  strokeDashoffset={ringOn ? RING_LENGTH * (1 - score / 100) : RING_LENGTH}
                  className={`${tone.ring} transition-[stroke-dashoffset] duration-1000 ease-out motion-reduce:transition-none`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-black tracking-tight text-stone-900 sm:text-5xl">
                  {score}%
                </span>
                <span className="mt-0.5 text-[11px] font-bold uppercase tracking-wider text-stone-400">
                  Mastery score
                </span>
              </div>
            </div>

            <p className={`mt-4 text-lg font-extrabold ${tone.text}`}>
              {isPassing ? "Passed. " : ""}
              {tone.label}
            </p>

            {/* Summary stats */}
            <div className="mt-5 grid grid-cols-3 gap-2 border-t border-stone-100 pt-5 sm:gap-3">
              <div className="rounded-xl bg-stone-100 px-2 py-3">
                <span className="block text-xl font-extrabold text-stone-900">
                  {results.total_questions}
                </span>
                <span className="text-xs text-stone-500">Total</span>
              </div>
              <div className="rounded-xl bg-emerald-50 px-2 py-3">
                <span className="block text-xl font-extrabold text-emerald-700">
                  {results.correct_count}
                </span>
                <span className="text-xs text-emerald-700/80">Correct</span>
              </div>
              <div className="rounded-xl bg-red-50 px-2 py-3">
                <span className="block text-xl font-extrabold text-red-700">{missed}</span>
                <span className="text-xs text-red-700/80">Missed</span>
              </div>
            </div>
          </div>

          {/* AI feedback */}
          <div className="rounded-2xl border border-stone-200 bg-stone-100/70 p-5 text-sm leading-relaxed text-stone-700">
            <p className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-stone-500">
              <Sparkles className="h-3.5 w-3.5" />
              AI evaluation
            </p>
            {results.ai_feedback}
          </div>

          {/* Actions (desktop) */}
          <div className="hidden flex-col gap-3 lg:flex">
            <button
              onClick={() => router.push("/quiz/new")}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-black px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-stone-800"
            >
              <RotateCcw className="h-4 w-4" />
              Take Another Quiz
            </button>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 text-sm text-stone-500 transition hover:text-black"
            >
              <Home className="h-3.5 w-3.5" />
              Back to home
            </Link>
          </div>
        </aside>

        {/* ====================== Question review (right) ====================== */}
        <section className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight text-stone-900">
                Question Review
              </h2>
              <p className="mt-0.5 text-sm text-stone-500">
                Tap &apos;Explain My Mistake&apos; on any missed question.
              </p>
            </div>

            <div className="inline-flex rounded-md border border-stone-300 bg-white p-0.5 text-sm font-semibold">
              {(["all", "missed"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  aria-pressed={filter === f}
                  className={`rounded px-4 py-1.5 transition ${
                    filter === f ? "bg-black text-white" : "text-stone-600 hover:text-black"
                  }`}
                >
                  {f === "all" ? `All (${results.total_questions})` : `Missed (${missed})`}
                </button>
              ))}
            </div>
          </div>

          {visibleReviews.length === 0 && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center text-sm font-medium text-emerald-800">
              You didn&apos;t miss any questions. Well done!
            </div>
          )}

          {visibleReviews.map(({ rev, idx }) => (
            <article
              key={rev.question_id}
              className={`rounded-2xl border bg-white p-4 shadow-sm sm:p-6 ${
                rev.is_correct ? "border-stone-200" : "border-red-200"
              }`}
            >
              <div className="flex items-start gap-3">
                {rev.is_correct ? (
                  <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-500" />
                ) : (
                  <XCircle className="mt-0.5 h-6 w-6 shrink-0 text-red-500" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-stone-400">
                      Question {idx + 1}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        rev.is_correct
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {rev.is_correct ? "Correct" : "Missed"}
                    </span>
                  </div>
                  <h3 className="mt-1.5 text-base font-bold leading-snug text-stone-900 sm:text-lg">
                    {rev.question}
                  </h3>
                </div>
              </div>

              {/* Answer comparison */}
              <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                <div
                  className={`rounded-xl border px-3.5 py-2.5 ${
                    rev.is_correct
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                      : "border-red-200 bg-red-50 text-red-900"
                  }`}
                >
                  <span className="font-bold">Your choice: </span>
                  {rev.selected_option ? `Option ${rev.selected_option}` : "Not answered"}
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-emerald-900">
                  <span className="font-bold">Correct: </span>Option {rev.correct_option}
                </div>
              </div>

              {/* Explanation */}
              <div className="mt-3 rounded-xl bg-stone-50 px-3.5 py-3 text-sm leading-relaxed text-stone-600">
                <span className="font-semibold text-stone-900">Explanation: </span>
                {rev.explanation}
              </div>

              {/* AI tutor on wrong answers */}
              {!rev.is_correct && (
                <div className="mt-4 flex sm:justify-end">
                  <button
                    onClick={() => setActiveTutorReview(rev)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-black px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-800 sm:w-auto"
                  >
                    <Sparkles className="h-4 w-4" />
                    Learn with AI Tutor
                  </button>
                </div>
              )}
            </article>
          ))}

          {/* Actions (mobile and tablet) */}
          <div className="flex flex-col gap-3 pt-2 lg:hidden">
            <button
              onClick={() => router.push("/quiz/new")}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-black px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-stone-800"
            >
              <RotateCcw className="h-4 w-4" />
              Take Another Quiz
            </button>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 py-1 text-sm text-stone-500 transition hover:text-black"
            >
              <Home className="h-3.5 w-3.5" />
              Back to home
            </Link>
          </div>
        </section>
      </div>

      {/* AI Tutor Modal */}
      {activeTutorReview && (
        <TutorModal
          isOpen={!!activeTutorReview}
          onClose={() => setActiveTutorReview(null)}
          question={activeTutorReview.question}
          selectedOption={activeTutorReview.selected_option}
          correctOption={activeTutorReview.correct_option}
          explanation={activeTutorReview.explanation}
        />
      )}
    </div>
  );
}