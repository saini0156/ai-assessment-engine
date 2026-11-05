"use client";

import { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/api";
import {
  ArrowLeft,
  BookOpen,
  GraduationCap,
  Layers,
  Loader2,
  Sparkles,
} from "lucide-react";

const COUNTS = [3, 5, 10];
const LEVELS = ["Easy", "Medium", "Hard"];

const inputClass =
  "w-full rounded-md border border-stone-300 bg-white py-3.5 pl-11 pr-4 text-base text-stone-900 placeholder:text-stone-400 transition focus:border-black focus:outline-none focus:ring-1 focus:ring-black";

const optionClass = (selected: boolean) =>
  `rounded-md border py-3 text-sm font-semibold transition ${
    selected
      ? "border-black bg-black text-white"
      : "border-stone-300 bg-white text-stone-700 hover:border-stone-500"
  }`;

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
    <div className="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-white lg:flex-row lg:overflow-hidden">
      {/* ============ LEFT: image + content (60%) ============ */}
      <div className="relative min-h-[300px] bg-stone-300 lg:h-full lg:w-[60%]">
        <Image
          src="/images/quiz-bg.jpg"
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 60vw, 100vw"
          className="object-cover"
        />
        {/* Light overlay: keeps the photo bright, text still readable */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/25 to-black/10" />

        <div className="relative z-10 flex h-full flex-col justify-between p-6 sm:p-10 lg:p-14">
          <Link href="/" className="inline-flex items-center gap-2.5 self-start text-white">
            <GraduationCap className="h-8 w-8" />
            <span className="text-2xl font-extrabold uppercase tracking-[0.2em]">QuizPro</span>
          </Link>

          <div className="max-w-2xl space-y-4 py-8 lg:py-0">
            <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight text-white drop-shadow-md sm:text-5xl xl:text-6xl">
              Turn your syllabus into practice quizzes.
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-white/90 drop-shadow sm:text-lg">
              Pick a subject and topic, choose how many questions you want, and get a timed
              quiz in seconds. Every wrong answer comes with a simple explanation from the AI
              tutor.
            </p>
          </div>

          <p className="hidden text-sm text-white/80 lg:block">
            &copy; {new Date().getFullYear()} QuizPro
          </p>
        </div>
      </div>

      {/* ============ RIGHT: simple form (40%) ============ */}
      <div className="flex items-center justify-center bg-white px-6 py-10 sm:px-12 lg:h-full lg:w-[40%] lg:overflow-y-auto lg:px-14">
        <form onSubmit={handleStartQuiz} className="w-full max-w-md space-y-6">
          <div>
            <h2 className="text-4xl font-extrabold tracking-tight text-black">Set up your quiz</h2>
            <p className="mt-2 text-stone-600">Choose your options to get started.</p>
          </div>

          {/* Subject */}
          <div>
            <label htmlFor="subject" className="block text-sm font-bold text-black">
              Subject
            </label>
            <div className="relative mt-2">
              <BookOpen className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
              <input
                id="subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                placeholder="e.g. Computer Science"
                className={inputClass}
              />
            </div>
          </div>

          {/* Topic */}
          <div>
            <label htmlFor="topic" className="block text-sm font-bold text-black">
              Topic
            </label>
            <div className="relative mt-2">
              <Layers className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
              <input
                id="topic"
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                required
                placeholder="e.g. Object-Oriented Programming"
                className={inputClass}
              />
            </div>
          </div>

          {/* Number of questions */}
          <div>
            <span className="block text-sm font-bold text-black">Number of Questions</span>
            <div className="mt-2 grid grid-cols-3 gap-3">
              {COUNTS.map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setCount(num)}
                  aria-pressed={count === num}
                  className={optionClass(count === num)}
                >
                  {num} Questions
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <span className="block text-sm font-bold text-black">Difficulty Level</span>
            <div className="mt-2 grid grid-cols-3 gap-3">
              {LEVELS.map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setDifficulty(lvl)}
                  aria-pressed={difficulty === lvl}
                  className={optionClass(difficulty === lvl)}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2.5 rounded-md bg-black py-4 text-base font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Generating your quiz...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                <span>Generate &amp; Start Quiz</span>
              </>
            )}
          </button>

          <div className="text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-stone-500 transition-colors hover:text-black"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to home
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function QuizNewPage() {
  return (
    <Suspense
      fallback={<div className="py-12 text-center text-stone-500">Loading quiz builder...</div>}
    >
      <QuizConfigForm />
    </Suspense>
  );
}