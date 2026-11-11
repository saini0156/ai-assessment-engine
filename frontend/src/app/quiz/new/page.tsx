"use client";

import { useState, useEffect, useMemo, useRef, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/api";
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
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

type SubjectEntry = { name: string; topics: string[] };

const toTopic = (t: any): string =>
  typeof t === "string" ? t : (t?.name ?? t?.title ?? t?.topic ?? "");

// Accepts several likely response shapes from GET /syllabus/subjects:
//   [{ subject, topics: [...] }]  |  { subjects: [...] }  |  { Physics: [...] }
function normalizeSubjects(raw: any): SubjectEntry[] {
  const list = Array.isArray(raw) ? raw : (raw?.subjects ?? raw);

  if (Array.isArray(list)) {
    return list
      .map((s: any) => ({
        name:
          typeof s === "string" ? s : (s?.subject ?? s?.name ?? s?.title ?? ""),
        topics: (Array.isArray(s?.topics) ? s.topics : [])
          .map(toTopic)
          .filter(Boolean),
      }))
      .filter((s) => s.name);
  }

  if (list && typeof list === "object") {
    return Object.entries(list).map(([name, topics]) => ({
      name,
      topics: (Array.isArray(topics) ? topics : [])
        .map(toTopic)
        .filter(Boolean),
    }));
  }
  return [];
}

type DropdownProps = {
  id: string;
  icon: React.ReactNode;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  placeholder: string;
  disabled?: boolean;
};

function Dropdown({
  id,
  icon,
  value,
  options,
  onChange,
  placeholder,
  disabled,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Close when tapping/clicking outside (pointerdown works for mouse and touch)
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  // Keep the highlighted option visible while using the keyboard
  useEffect(() => {
    if (open)
      listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const toggle = () => {
    if (disabled) return;
    setActive(Math.max(0, options.indexOf(value)));
    setOpen((o) => !o);
  };

  const select = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) toggle();
      else setActive((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) toggle();
      else setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && open) {
      e.preventDefault();
      if (options[active] !== undefined) select(options[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative mt-2">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400">
        {icon}
      </span>
      <button
        id={id}
        type="button"
        onClick={toggle}
        onKeyDown={onKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`${inputClass} flex items-center pr-11 text-left disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400`}
      >
        <span className={`block truncate ${value ? "" : "text-stone-400"}`}>
          {value || placeholder}
        </span>
      </button>
      <ChevronDown
        className={`pointer-events-none absolute right-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400 transition-transform ${
          open ? "rotate-180" : ""
        }`}
      />

      {open && (
        <ul
          ref={listRef}
          role="listbox"
          aria-labelledby={id}
          className="absolute z-20 mt-2 max-h-60 w-full overflow-auto rounded-md border border-stone-300 bg-white py-1 shadow-lg"
        >
          {options.map((opt, i) => (
            <li
              key={opt}
              role="option"
              aria-selected={opt === value}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select(opt)}
              className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm text-stone-800 sm:py-2.5 ${
                i === active ? "bg-stone-100" : ""
              } ${opt === value ? "font-semibold" : ""}`}
            >
              <span className="truncate">{opt}</span>
              {opt === value && <Check className="h-4 w-4 shrink-0" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function QuizConfigForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [entries, setEntries] = useState<SubjectEntry[]>([]);
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState("Medium");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep ?subject= / ?topic= so they can preselect once the data loads
  const initialParams = useRef({
    subject: searchParams.get("subject"),
    topic: searchParams.get("topic"),
  });

  const topics = useMemo(
    () => entries.find((e) => e.name === subject)?.topics ?? [],
    [entries, subject],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = normalizeSubjects(await apiClient.getSubjects());
        if (cancelled) return;
        setEntries(list);

        const { subject: s, topic: t } = initialParams.current;
        const match = list.find((e) => e.name === s) ?? list[0];
        if (match) {
          setSubject(match.name);
          setTopic(t && match.topics.includes(t) ? t : (match.topics[0] ?? ""));
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || "Failed to load subjects");
      } finally {
        if (!cancelled) setLoadingSubjects(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubjectChange = (name: string) => {
    setSubject(name);
    setTopic(entries.find((e) => e.name === name)?.topics[0] ?? "");
  };

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
      sessionStorage.setItem(
        `quiz_${data.quiz_session_id}`,
        JSON.stringify(data),
      );
      router.push(`/quiz/${data.quiz_session_id}`);
    } catch (err: any) {
      setError(err.message || "Failed to generate quiz");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col overflow-y-auto overscroll-contain bg-white lg:flex-row lg:overflow-hidden">
      {/* ============ LEFT / TOP: image + content ============ */}
      <div className="relative min-h-[200px] shrink-0 bg-stone-300 sm:min-h-[260px] lg:h-full lg:w-[60%]">
        <Image
          src="/images/quiz-bg1.jpg"
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 60vw, 100vw"
          className="object-cover"
        />
        {/* Mobile: dark top-to-bottom. Desktop: dark left-to-right */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/70 lg:bg-gradient-to-r lg:from-black/65 lg:via-black/25 lg:to-black/10" />

        <div className="relative z-10 flex h-full flex-col justify-between gap-6 px-5 pb-10 pt-5 sm:p-10 lg:p-14">
          <Link href="/" className="inline-flex items-center self-start">
            <Image
              src="/images/logowhite.png"
              alt="MindMark"
              width={200}
              height={48}
              className="h-8 w-auto sm:h-24"
              priority
            />
          </Link>

          <div className="max-w-2xl space-y-3 lg:space-y-4 lg:py-0">
            <h1 className="text-3xl font-extrabold leading-[1.1] tracking-tight text-white drop-shadow-md sm:text-5xl xl:text-6xl">
              Turn your syllabus into practice quizzes.
            </h1>
            {/* Hidden on phones so the form is visible sooner */}
            <p className="hidden max-w-xl text-base leading-relaxed text-white/90 drop-shadow sm:block sm:text-lg">
              Pick a subject and topic, choose how many questions you want, and
              get a timed quiz in seconds. Every wrong answer comes with a
              simple explanation from the AI tutor.
            </p>
          </div>

          <p className="hidden text-sm text-white/80 lg:block">
            &copy; {new Date().getFullYear()} MindMark
          </p>
        </div>
      </div>

      {/* ============ RIGHT / BOTTOM: form ============ */}
      <div className="relative z-10 -mt-6 flex flex-1 items-start justify-center rounded-t-3xl bg-white px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-8 sm:px-12 sm:py-10 lg:mt-0 lg:h-full lg:w-[40%] lg:flex-none lg:items-center lg:overflow-y-auto lg:rounded-none lg:px-14">
        <form
          onSubmit={handleStartQuiz}
          className="w-full max-w-md space-y-5 sm:space-y-6"
        >
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-black sm:text-4xl">
              Set up your quiz
            </h2>
            <p className="mt-1.5 text-stone-600 sm:mt-2">
              Choose your options to get started.
            </p>
          </div>

          {/* Subject */}
          <div>
            <label
              htmlFor="subject"
              className="block text-sm font-bold text-black"
            >
              Subject
            </label>
            <Dropdown
              id="subject"
              icon={<BookOpen className="h-5 w-5" />}
              value={subject}
              options={entries.map((e) => e.name)}
              onChange={handleSubjectChange}
              disabled={loadingSubjects || entries.length === 0}
              placeholder={
                loadingSubjects
                  ? "Loading subjects..."
                  : entries.length === 0
                    ? "No subjects found. Upload a syllabus PDF first"
                    : "Select a subject"
              }
            />
          </div>

          {/* Topic */}
          <div>
            <label
              htmlFor="topic"
              className="block text-sm font-bold text-black"
            >
              Topic
            </label>
            <Dropdown
              id="topic"
              icon={<Layers className="h-5 w-5" />}
              value={topic}
              options={topics}
              onChange={setTopic}
              disabled={loadingSubjects || topics.length === 0}
              placeholder={
                topics.length === 0 ? "No topics available" : "Select a topic"
              }
            />
          </div>

          {/* Number of questions */}
          <div>
            <span className="block text-sm font-bold text-black">
              Number of Questions
            </span>
            <div className="mt-2 grid grid-cols-3 gap-2.5 sm:gap-3">
              {COUNTS.map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setCount(num)}
                  aria-pressed={count === num}
                  aria-label={`${num} questions`}
                  className={optionClass(count === num)}
                >
                  {num}
                  <span className="hidden sm:inline"> Questions</span>
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <span className="block text-sm font-bold text-black">
              Difficulty Level
            </span>
            <div className="mt-2 grid grid-cols-3 gap-2.5 sm:gap-3">
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
            disabled={loading || !subject || !topic}
            className="inline-flex w-full items-center justify-center gap-2.5 rounded-md bg-black py-4 text-base font-semibold text-white transition hover:bg-stone-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
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
              className="inline-flex items-center gap-1.5 py-1 text-sm text-stone-500 transition-colors hover:text-black"
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
      fallback={
        <div className="py-12 text-center text-stone-500">
          Loading quiz builder...
        </div>
      }
    >
      <QuizConfigForm />
    </Suspense>
  );
}
