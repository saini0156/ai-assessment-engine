"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { QuizSubmitResponse, QuestionReview } from "@/types";
import { TutorModal } from "@/components/tutor/TutorModal";
import { CheckCircle2, XCircle, Sparkles, RotateCcw, Award, Lightbulb } from "lucide-react";

export default function QuizResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const quizId = resolvedParams.id;

  const [results, setResults] = useState<QuizSubmitResponse | null>(null);
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
  }, [quizId]);

  if (!results) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <h3 className="text-lg font-bold text-slate-900">No Assessment Results Found</h3>
        <p className="mt-2 text-sm text-slate-500">
          We could not locate the submitted score for this session.
        </p>
        <button
          onClick={() => router.push("/quiz/new")}
          className="mt-6 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          Take a New Quiz
        </button>
      </div>
    );
  }

  const score = results.score_percentage;
  const isPassing = score >= 70;

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-12">
      {/* Scorecard Hero */}
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-10">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
          <Award className="h-10 w-10" />
        </div>

        <h1 className="mt-4 text-3xl font-extrabold text-slate-900">Assessment Complete</h1>
        <p className="mt-1 text-sm text-slate-500">Here is your verified performance breakdown</p>

        {/* Circular Mastery Ring / Badge */}
        <div className="my-6 inline-flex flex-col items-center justify-center rounded-2xl bg-slate-50 px-8 py-5 border border-slate-100">
          <span className="text-5xl font-black tracking-tight text-indigo-600">
            {score}%
          </span>
          <span className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-400">
            Mastery Score
          </span>
        </div>

        {/* Summary Stats */}
        <div className="mx-auto grid max-w-md grid-cols-3 gap-3 border-t border-slate-100 pt-6">
          <div className="rounded-xl bg-slate-50 p-3">
            <span className="block text-xl font-bold text-slate-900">{results.total_questions}</span>
            <span className="text-xs text-slate-500">Total</span>
          </div>
          <div className="rounded-xl bg-emerald-50 p-3 text-emerald-800">
            <span className="block text-xl font-bold">{results.correct_count}</span>
            <span className="text-xs text-emerald-600">Correct</span>
          </div>
          <div className="rounded-xl bg-red-50 p-3 text-red-800">
            <span className="block text-xl font-bold">{results.total_questions - results.correct_count}</span>
            <span className="text-xs text-red-600">Missed</span>
          </div>
        </div>

        {/* AI Feedback Banner */}
        <div className="mt-6 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 text-sm text-indigo-950">
          <span className="font-semibold">AI Evaluation: </span>
          <span>{results.ai_feedback}</span>
        </div>
      </div>

      {/* Question-by-Question Review */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Question Review</h2>
          <span className="text-xs text-slate-400">Click &apos;Explain My Mistake&apos; on missed questions</span>
        </div>

        {results.reviews.map((rev, idx) => (
          <div
            key={rev.question_id}
            className={`rounded-2xl border p-6 transition ${
              rev.is_correct
                ? "border-emerald-200 bg-white"
                : "border-red-200 bg-white shadow-sm"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                {rev.is_correct ? (
                  <CheckCircle2 className="mt-0.5 h-6 w-6 flex-shrink-0 text-emerald-500" />
                ) : (
                  <XCircle className="mt-0.5 h-6 w-6 flex-shrink-0 text-red-500" />
                )}
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Question {idx + 1}
                  </span>
                  <h3 className="mt-1 text-base font-semibold text-slate-900">{rev.question}</h3>
                </div>
              </div>
            </div>

            {/* Answer Comparison */}
            <div className="mt-4 grid gap-2 sm:grid-cols-2 text-xs">
              <div
                className={`rounded-xl p-3 border ${
                  rev.is_correct
                    ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                    : "bg-red-50 border-red-200 text-red-900"
                }`}
              >
                <span className="font-bold">Your Choice: </span>
                <span>Option {rev.selected_option || "None (Unattempted)"}</span>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">
                <span className="font-bold">Correct Option: </span>
                <span>Option {rev.correct_option}</span>
              </div>
            </div>

            {/* Explanation */}
            <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
              <span className="font-semibold text-slate-800">Explanation: </span>
              {rev.explanation}
            </div>

            {/* AI Tutor Button on Wrong Answers */}
            {!rev.is_correct && (
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setActiveTutorReview(rev)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-800 transition hover:bg-amber-100"
                >
                  <Sparkles className="h-4 w-4 text-amber-600" />
                  <span>Explain My Mistake (AI Tutor)</span>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Retake Action */}
      <div className="flex justify-center pt-4">
        <button
          onClick={() => router.push("/quiz/new")}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700"
        >
          <RotateCcw className="h-4 w-4" />
          <span>Take Another Quiz</span>
        </button>
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
