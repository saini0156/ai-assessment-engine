"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/api";
import { Sparkles, Loader2, Target, Sliders, BookOpen } from "lucide-react";

function QuizConfigForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [subject, setSubject] = useState("Computer Science");
  const [topic, setTopic] = useState("Object-Oriented Programming (OOP)");
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState("Medium");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const s = searchParams.get("subject");
    const t = searchParams.get("topic");
    if (s) setSubject(s);
    if (t) setTopic(t);
  }, [searchParams]);

  const handleStartQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = await apiClient.generateQuiz({
        subject,
        topic,
        count: Number(count),
        difficulty,
      });

      // Save quiz questions and metadata to sessionStorage for the player screen
      sessionStorage.setItem(`quiz_${data.quiz_session_id}`, JSON.stringify(data));
      router.push(`/quiz/${data.quiz_session_id}`);
    } catch (err: any) {
      setError(err.message || "Failed to generate quiz");
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Configure Your Assessment
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Customize the scope, difficulty, and question count for your fresh AI-generated test.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <form onSubmit={handleStartQuiz} className="space-y-6">
          {/* Subject */}
          <div>
            <label className="block text-sm font-semibold text-slate-700">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Topic */}
          <div>
            <label className="block text-sm font-semibold text-slate-700">Topic</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              required
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Question Count */}
          <div>
            <label className="block text-sm font-semibold text-slate-700">Number of Questions</label>
            <div className="mt-2 grid grid-cols-3 gap-3">
              {[3, 5, 10].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setCount(num)}
                  className={`rounded-xl border py-2.5 text-sm font-semibold transition ${
                    count === num
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {num} Questions
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <label className="block text-sm font-semibold text-slate-700">Difficulty Level</label>
            <div className="mt-2 grid grid-cols-3 gap-3">
              {["Easy", "Medium", "Hard"].map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setDifficulty(lvl)}
                  className={`rounded-xl border py-2.5 text-sm font-semibold transition ${
                    difficulty === lvl
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Synthesizing MCQs with Distractor Engineering...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Generate & Start Quiz</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function QuizNewPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-slate-500">Loading quiz builder...</div>}>
      <QuizConfigForm />
    </Suspense>
  );
}
