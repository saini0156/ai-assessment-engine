"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { QuizGenerateResponse, PublicQuestion } from "@/types";
import { apiClient } from "@/lib/api";
import { Timer, ArrowLeft, ArrowRight, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

export default function QuizPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const quizId = resolvedParams.id;

  const [quizData, setQuizData] = useState<QuizGenerateResponse | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setError("Quiz session not found or expired. Please generate a new quiz.");
    }
  }, [quizId]);

  // Timer countdown
  useEffect(() => {
    if (!quizData || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleSubmitQuiz();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [quizData, timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const handleSelectOption = (questionId: string, optionKey: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: optionKey,
    }));
  };

  const handleSubmitQuiz = async () => {
    if (!quizData || submitting) return;
    setSubmitting(true);
    setShowConfirmModal(false);

    try {
      const response = await apiClient.submitQuiz({
        quiz_session_id: quizId,
        answers: answers,
      });

      // Save results in sessionStorage
      sessionStorage.setItem(`results_${quizId}`, JSON.stringify(response));
      router.push(`/quiz/${quizId}/results`);
    } catch (err: any) {
      setError(err.message || "Failed to submit quiz.");
      setSubmitting(false);
    }
  };

  if (error) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-700">
        <AlertCircle className="mx-auto h-10 w-10 text-red-500" />
        <h3 className="mt-3 text-lg font-bold">Session Notice</h3>
        <p className="mt-2 text-sm">{error}</p>
        <button
          onClick={() => router.push("/quiz/new")}
          className="mt-6 rounded-xl bg-red-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
        >
          Return to Quiz Generator
        </button>
      </div>
    );
  }

  if (!quizData) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        <p className="mt-4 text-sm font-medium">Preparing test environment...</p>
      </div>
    );
  }

  const currentQ: PublicQuestion = quizData.questions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const isTimeCritical = timeLeft < 60;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Top Status Bar with Timer */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:px-6">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
            {quizData.subject} &bull; {quizData.topic}
          </span>
          <h2 className="text-base font-bold text-slate-900">
            Question {currentIndex + 1} of {quizData.total_questions}
          </h2>
        </div>

        {/* Countdown Timer */}
        <div
          className={`flex items-center gap-2 rounded-xl px-4 py-2 font-mono text-base font-bold transition ${
            isTimeCritical
              ? "bg-red-50 text-red-600 animate-pulse border border-red-200"
              : "bg-slate-100 text-slate-800"
          }`}
        >
          <Timer className="h-5 w-5" />
          <span>{formatTime(timeLeft)}</span>
        </div>
      </div>

      {/* Progress Bubbles */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto py-1">
        {quizData.questions.map((q, idx) => {
          const isAnswered = !!answers[q.id];
          const isCurrent = idx === currentIndex;
          return (
            <button
              key={q.id}
              onClick={() => setCurrentIndex(idx)}
              className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-xs font-bold transition ${
                isCurrent
                  ? "bg-indigo-600 text-white ring-2 ring-indigo-300"
                  : isAnswered
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>

      {/* Question Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h3 className="text-lg font-bold leading-snug text-slate-900 sm:text-xl">
          {currentQ.question}
        </h3>

        {/* Options Grid */}
        <div className="mt-6 space-y-3">
          {Object.entries(currentQ.options).map(([key, label]) => {
            const isSelected = answers[currentQ.id] === key;
            return (
              <button
                key={key}
                onClick={() => handleSelectOption(currentQ.id, key)}
                className={`flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all ${
                  isSelected
                    ? "border-indigo-600 bg-indigo-50/80 ring-2 ring-indigo-500 shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70"
                }`}
              >
                <div
                  className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold transition ${
                    isSelected
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {key}
                </div>
                <span className="text-sm font-medium text-slate-800">{label}</span>
              </button>
            );
          })}
        </div>

        {/* Navigation Buttons */}
        <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-6">
          <button
            onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
            disabled={currentIndex === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Previous</span>
          </button>

          {currentIndex < quizData.total_questions - 1 ? (
            <button
              onClick={() => setCurrentIndex((prev) => prev + 1)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700"
            >
              <span>Next</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={() => setShowConfirmModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700"
            >
              <CheckCircle className="h-4 w-4" />
              <span>Submit Assessment</span>
            </button>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900">Submit Assessment?</h3>
            <p className="mt-2 text-sm text-slate-600">
              You answered <span className="font-bold text-indigo-600">{answeredCount}</span> of{" "}
              <span className="font-bold">{quizData.total_questions}</span> questions.
              {answeredCount < quizData.total_questions && (
                <span className="block mt-1 text-amber-600 font-medium">
                  Warning: You have unattempted questions!
                </span>
              )}
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Continue Quiz
              </button>
              <button
                onClick={handleSubmitQuiz}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
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
    </div>
  );
}
