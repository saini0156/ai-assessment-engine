import Link from "next/link";
import { BookOpen, Sparkles, ShieldCheck, Brain, ArrowRight, Zap, Target } from "lucide-react";

export default function Home() {
  return (
    <div className="space-y-12 pb-12">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 px-6 py-16 text-center text-white shadow-xl sm:px-12 sm:py-20">
        <div className="relative z-10 mx-auto max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/20 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-200 backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5 text-indigo-300" />
            Next-Gen Assessment Engine
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
            Syllabus to Quizzes in Seconds, Powered by AI
          </h1>
          <p className="text-base text-indigo-100/90 sm:text-lg">
            Upload any syllabus PDF. Our AI automatically extracts topics, generates anti-cheat MCQs with misconception-based distractors, and provides instant tutoring on every mistake.
          </p>

          <div className="flex flex-col items-center justify-center gap-4 pt-4 sm:flex-row">
            <Link
              href="/quiz/new"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-base font-bold text-indigo-950 shadow-lg transition-all hover:bg-indigo-50 sm:w-auto"
            >
              <span>Take a Practice Quiz</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/admin"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-300/40 bg-indigo-800/50 px-6 py-3.5 text-base font-semibold text-white backdrop-blur-md transition-all hover:bg-indigo-700/60 sm:w-auto"
            >
              <BookOpen className="h-4 w-4" />
              <span>Admin Syllabus Upload</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Two Workflows Grid */}
      <section className="grid gap-6 sm:grid-cols-2">
        {/* Admin Card */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition-all hover:shadow-md">
          <div className="space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <BookOpen className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Admin / Teacher Workflow</h3>
            <p className="text-sm leading-relaxed text-slate-600">
              Drag and drop any syllabus PDF or course notes. The system extracts chapters, subtopics, and summaries automatically, ready for question generation.
            </p>
          </div>
          <div className="pt-6">
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
            >
              <span>Upload Syllabus Now</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Student Card */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition-all hover:shadow-md">
          <div className="space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Zap className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Student Assessment Workflow</h3>
            <p className="text-sm leading-relaxed text-slate-600">
              Select your topic and difficulty (Easy, Medium, Hard). Experience a timed quiz with zero answer leaks, instant scoring, and AI tutor explanations.
            </p>
          </div>
          <div className="pt-6">
            <Link
              href="/quiz/new"
              className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 hover:text-emerald-700"
            >
              <span>Start Assessment</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Core Architectural Features */}
      <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Platform Highlights</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <ShieldCheck className="h-5 w-5 text-indigo-600" />
              <h4>Zero-Leak Security</h4>
            </div>
            <p className="text-xs leading-relaxed text-slate-500">
              Answer keys and explanations are stored server-side. Students inspecting network calls or HTML cannot cheat.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <Target className="h-5 w-5 text-amber-600" />
              <h4>Distractor Engineering</h4>
            </div>
            <p className="text-xs leading-relaxed text-slate-500">
              No lazy options like &apos;All of the above&apos;. Wrong options are designed around common student misconceptions.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <Brain className="h-5 w-5 text-purple-600" />
              <h4>AI Tutor ("Explain My Mistake")</h4>
            </div>
            <p className="text-xs leading-relaxed text-slate-500">
              Instant feedback for missed questions with simplified concepts, catchy memory tips, and real-world analogies.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
