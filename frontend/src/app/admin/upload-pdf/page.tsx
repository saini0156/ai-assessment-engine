"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";
import { SyllabusUploadResponse, TopicItem } from "@/types";
import { normalizeSubjects, type SubjectEntry } from "@/lib/subjects";
import {
  ArrowRight,
  BookOpen,
  Calculator,
  CheckCircle2,
  Code2,
  Dna,
  FileText,
  FlaskConical,
  Landmark,
  Languages,
  Layers,
  Library,
  ListChecks,
  Loader2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/* ---------- Colors and icons ---------- */

// Black / gray is the main look (buttons, borders, chips, pagination).
// Colour is only used for small accents: the icon tile and the topic count of each
// subject card. Full class names are written out so Tailwind can see them.
const PALETTES = [
  {
    bar: "border-t-neutral-900",
    icon: "bg-indigo-100 text-indigo-700",
    chip: "border-neutral-200 bg-neutral-50 text-neutral-800 hover:border-neutral-900 hover:bg-neutral-900 hover:text-white",
    btn: "bg-neutral-900 text-white hover:bg-black",
    label: "text-indigo-700",
  },
  {
    bar: "border-t-neutral-900",
    icon: "bg-emerald-100 text-emerald-700",
    chip: "border-neutral-200 bg-neutral-50 text-neutral-800 hover:border-neutral-900 hover:bg-neutral-900 hover:text-white",
    btn: "bg-neutral-900 text-white hover:bg-black",
    label: "text-emerald-700",
  },
  {
    bar: "border-t-neutral-900",
    icon: "bg-rose-100 text-rose-700",
    chip: "border-neutral-200 bg-neutral-50 text-neutral-800 hover:border-neutral-900 hover:bg-neutral-900 hover:text-white",
    btn: "bg-neutral-900 text-white hover:bg-black",
    label: "text-rose-700",
  },
  {
    bar: "border-t-neutral-900",
    icon: "bg-amber-100 text-amber-700",
    chip: "border-neutral-200 bg-neutral-50 text-neutral-800 hover:border-neutral-900 hover:bg-neutral-900 hover:text-white",
    btn: "bg-neutral-900 text-white hover:bg-black",
    label: "text-amber-700",
  },
];

// Same subject name always gets the same colour.
const paletteFor = (name: string) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTES[h % PALETTES.length];
};

const iconFor = (name: string): LucideIcon => {
  const n = name.toLowerCase();
  if (/comput|program|code|software|data|cyber|\bit\b/.test(n)) return Code2;
  if (/math|algebra|calcul|statist/.test(n)) return Calculator;
  if (/phys|chem|science/.test(n)) return FlaskConical;
  if (/bio|life|medic|health/.test(n)) return Dna;
  if (/hist|civic|politic|social|geograph|econom/.test(n)) return Landmark;
  if (/engl|hindi|lang|liter/.test(n)) return Languages;
  return BookOpen;
};

const PAGE_SIZE = 4; // subject cards per page (2 x 2)
const TOPIC_PREVIEW = 2; // topics listed per card (the rest open in a dialog)
const ACCEPTED = [".pdf", ".txt"];

const isAccepted = (f: File) => ACCEPTED.some((ext) => f.name.toLowerCase().endsWith(ext));

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

// 1 2 3 ... 9 style page list
const pageItems = (total: number, current: number): (number | "…")[] => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const items: (number | "…")[] = [1];
  if (current > 3) items.push("…");
  for (let n = Math.max(2, current - 1); n <= Math.min(total - 1, current + 1); n++) items.push(n);
  if (current < total - 2) items.push("…");
  items.push(total);
  return items;
};

export default function UploadPdfPage() {
  const router = useRouter();

  // Upload form
  const [subject, setSubject] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SyllabusUploadResponse | null>(null);
  const [showResult, setShowResult] = useState(false); // latest-upload dialog

  // Already uploaded subjects
  const [subjects, setSubjects] = useState<SubjectEntry[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [subjectsError, setSubjectsError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [topicsFor, setTopicsFor] = useState<SubjectEntry | null>(null); // subject whose full topic list is open
  const [latest, setLatest] = useState<string | null>(null); // subject uploaded in this session

  const loadSubjects = useCallback(async () => {
    setLoadingSubjects(true);
    setSubjectsError(null);
    try {
      setSubjects(normalizeSubjects(await apiClient.getSubjects()));
    } catch (err: any) {
      setSubjectsError(err.message || "Failed to load uploaded subjects.");
    } finally {
      setLoadingSubjects(false);
    }
  }, []);

  useEffect(() => {
    loadSubjects();
  }, [loadSubjects]);

  // Newest first. The server list is assumed to be in upload order (oldest first),
  // so it is reversed; a subject uploaded just now is always pinned to the top.
  const ordered = useMemo(() => {
    const list = [...subjects].reverse();
    if (!latest) return list;
    const i = list.findIndex((s) => s.name.toLowerCase() === latest.toLowerCase());
    if (i > 0) list.unshift(...list.splice(i, 1));
    return list;
  }, [subjects, latest]);

  const totalPages = Math.max(1, Math.ceil(ordered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const shown = ordered.slice(start, start + PAGE_SIZE);
  const totalTopics = subjects.reduce((sum, s) => sum + s.topics.length, 0);

  // While a dialog is open: Escape closes it, and the page behind it can't scroll
  // (important on phones, where the background would otherwise scroll under the sheet).
  useEffect(() => {
    if (!topicsFor && !showResult) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setTopicsFor(null);
        setShowResult(false);
      }
    };
    document.addEventListener("keydown", onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [topicsFor, showResult]);

  const pickFile = (f: File | undefined | null) => {
    if (!f) return;
    if (!isAccepted(f)) {
      setError("Only .pdf and .txt files are supported.");
      return;
    }
    setFile(f);
    setError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    pickFile(e.target.files?.[0]);
    e.target.value = ""; // lets the same file be picked again after removing it
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragging(false);
    pickFile(e.dataTransfer.files?.[0]);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = subject.trim();
    if (!name) {
      setError("Please enter a subject name.");
      return;
    }
    if (!file) {
      setError("Please select a PDF or text file first.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await apiClient.uploadSyllabus(name, file);
      setResult(data);
      setShowResult(true);
      setLatest(data.subject || name);
      setPage(1);
      setFile(null);
      setSubject("");
      await loadSubjects();
    } catch (err: any) {
      setError(err.message || "Failed to process syllabus.");
    } finally {
      setLoading(false);
    }
  };

  const startQuiz = (subjectName: string, topicName?: string) => {
    const params = new URLSearchParams({ subject: subjectName });
    if (topicName) params.set("topic", topicName);
    router.push(`/quiz/new?${params.toString()}`);
  };

  const resultPalette = result ? paletteFor(result.subject) : PALETTES[0];

  return (
    // On large screens the page fits one screen: 5rem navbar + 4rem admin padding = 9rem.
    // On phones and tablets the page just scrolls normally.
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-3 pb-6 lg:h-[calc(100dvh-9rem)] lg:overflow-hidden lg:pb-0">
      {/* ============ Title row ============ */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h1 className="text-xl font-extrabold tracking-tight text-neutral-900 sm:text-2xl">
          Upload PDF
        </h1>

        {!loadingSubjects && !subjectsError && subjects.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-bold text-indigo-800 sm:px-3">
              <Library className="h-3.5 w-3.5" />
              {subjects.length} {subjects.length === 1 ? "subject" : "subjects"}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800 sm:px-3">
              <ListChecks className="h-3.5 w-3.5" />
              {totalTopics} {totalTopics === 1 ? "topic" : "topics"}
            </span>
            {result && (
              <button
                type="button"
                onClick={() => setShowResult(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-xs font-bold text-neutral-800 transition hover:border-neutral-900 sm:px-3"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <span className="sm:hidden">Last upload</span>
                <span className="hidden sm:inline">
                  Last upload: {result.extracted_topics.length} topics
                </span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* ============ Form (left) + uploaded subjects (right) ============ */}
      <div className="grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)] lg:items-stretch lg:gap-5">
        {/* ---------- LEFT: upload form ---------- */}
        <section className="flex min-h-0 flex-col rounded-2xl border border-t-4 border-neutral-200 border-t-neutral-900 bg-white p-3.5 shadow-sm sm:p-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
              <UploadCloud className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-extrabold leading-tight text-neutral-900">
                Upload a syllabus
              </h2>
              <p className="text-xs text-neutral-500">PDF or TXT. Topics are extracted by AI.</p>
            </div>
          </div>

          <form onSubmit={handleUpload} className="mt-3 flex min-h-0 flex-1 flex-col gap-3">
            <div>
              <label htmlFor="subject" className="block text-sm font-bold text-neutral-900">
                Subject name
              </label>
              <div className="relative mt-1">
                <BookOpen className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-500" />
                {/* text-base on phones stops iOS Safari from zooming in when the field is focused */}
                <input
                  id="subject"
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Computer Science"
                  required
                  className="w-full rounded-lg border border-neutral-300 bg-white py-3 pl-9 pr-3 text-base text-neutral-900 placeholder:text-neutral-400 transition focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-300 sm:py-2.5 sm:text-sm"
                />
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
              <span className="block text-sm font-bold text-neutral-900">Syllabus file</span>

              {file ? (
                <div className="mt-1 flex items-center gap-3 rounded-xl border border-neutral-300 bg-neutral-50 p-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-900 text-white">
                    <FileText className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-neutral-900">{file.name}</p>
                    <p className="text-xs text-neutral-500">{formatSize(file.size)} · ready</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    aria-label="Remove file"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-200 hover:text-neutral-900 sm:h-9 sm:w-9"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  className={`mt-1 flex min-h-[130px] flex-1 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-3 py-5 text-center transition focus-within:ring-2 focus-within:ring-neutral-400 lg:min-h-[120px] lg:py-4 ${
                    dragging
                      ? "border-neutral-900 bg-neutral-100"
                      : "border-neutral-300 bg-neutral-50 hover:border-neutral-900 hover:bg-neutral-100"
                  }`}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-indigo-600 ring-1 ring-indigo-200">
                    <UploadCloud className="h-5 w-5" />
                  </span>
                  <p className="mt-2 text-sm font-semibold text-neutral-900">
                    <span className="lg:hidden">Tap to choose a file</span>
                    <span className="hidden lg:inline">Drop your file here or click to browse</span>
                  </p>
                  <p className="text-xs text-neutral-500">PDF or TXT</p>
                  <input
                    type="file"
                    accept=".pdf,.txt"
                    onChange={handleFileChange}
                    className="sr-only"
                  />
                </label>
              )}
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !file || !subject.trim()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-black active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 sm:py-3"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Extracting topics...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  <span>Process syllabus</span>
                </>
              )}
            </button>
          </form>
        </section>

        {/* ---------- RIGHT: uploaded subjects ---------- */}
        <section className="flex min-h-0 min-w-0 flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                <Library className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-extrabold leading-tight text-neutral-900">
                  Uploaded subjects
                </h2>
                <p className="text-xs text-neutral-500">
                  Newest first.
                  {!loadingSubjects && !subjectsError && subjects.length > 0 && (
                    <> Showing {start + 1}-{start + shown.length} of {ordered.length}.</>
                  )}
                </p>
              </div>
            </div>

            {/* Icon-only on phones, icon + label from sm up */}
            <button
              type="button"
              onClick={loadSubjects}
              disabled={loadingSubjects}
              aria-label="Refresh subjects"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center gap-1.5 rounded-full border border-neutral-300 bg-white text-xs font-semibold text-neutral-700 transition hover:border-neutral-900 hover:text-neutral-900 disabled:opacity-60 sm:h-auto sm:w-auto sm:px-3 sm:py-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingSubjects ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>

          {/* Loading skeleton */}
          {loadingSubjects && subjects.length === 0 && (
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:min-h-0 lg:flex-1 lg:grid-rows-2">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-44 animate-pulse rounded-xl border border-neutral-200 bg-neutral-100 sm:h-36 lg:h-auto"
                />
              ))}
            </div>
          )}

          {/* Error */}
          {subjectsError && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {subjectsError}
            </div>
          )}

          {/* Empty */}
          {!loadingSubjects && !subjectsError && subjects.length === 0 && (
            <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center">
              <Layers className="mx-auto h-7 w-7 text-indigo-500" />
              <p className="mt-2 text-sm font-semibold text-neutral-900">No subjects uploaded yet</p>
              <p className="mt-0.5 text-sm text-neutral-500">
                Upload a syllabus and its subject will show up here.
              </p>
            </div>
          )}

          {/* Cards: 2 columns on every screen size (2 x 2 filling the height on large screens) */}
          {shown.length > 0 && (
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:min-h-0 lg:flex-1 lg:grid-rows-2">
              {shown.map((s) => {
                const p = paletteFor(s.name);
                const Icon = iconFor(s.name);
                const listed = s.topics.slice(0, TOPIC_PREVIEW);
                const hidden = s.topics.length - listed.length;
                const isLatest = latest?.toLowerCase() === s.name.toLowerCase();

                return (
                  <article
                    key={s.name}
                    className={`flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-t-4 bg-white p-2.5 shadow-sm sm:p-3.5 ${p.bar} ${
                      isLatest ? "border-neutral-400 ring-2 ring-neutral-300" : "border-neutral-200"
                    }`}
                  >
                    {/* Click the subject header to open the full topics popup */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setTopicsFor(s)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setTopicsFor(s);
                        }
                      }}
                      title={`View all topics in ${s.name}`}
                      className="flex cursor-pointer items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 sm:gap-2.5"
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-9 sm:w-9 ${p.icon}`}
                      >
                        <Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-[13px] font-extrabold tracking-tight text-neutral-900 sm:text-sm">
                          {s.name}
                        </h3>
                        <p
                          className={`flex items-center gap-1 text-[11px] font-semibold sm:text-xs ${p.label}`}
                        >
                          <ListChecks className="h-3 w-3 shrink-0" />
                          <span className="truncate">
                            {s.topics.length} {s.topics.length === 1 ? "topic" : "topics"}
                          </span>
                        </p>
                      </div>
                      {/* On phones the badge is just the sparkle (no room for the word "New") */}
                      {isLatest && (
                        <span
                          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-neutral-900 p-1 text-[11px] font-bold text-white sm:px-2 sm:py-0.5"
                          title="New"
                        >
                          <Sparkles className="h-3 w-3 text-amber-400" />
                          <span className="hidden sm:inline">New</span>
                        </span>
                      )}
                    </div>

                    {s.topics.length > 0 ? (
                      <ul className="mt-2 space-y-1.5 sm:mt-2.5">
                        {listed.map((t) => (
                          <li key={t}>
                            <button
                              type="button"
                              onClick={() => startQuiz(s.name, t)}
                              title={`Generate a quiz on ${t}`}
                              className={`flex w-full items-center gap-1.5 rounded-lg border px-2 py-2 text-left text-[11px] font-medium transition sm:gap-2 sm:px-2.5 sm:py-1.5 sm:text-xs ${p.chip}`}
                            >
                              <span className="min-w-0 flex-1 truncate">{t}</span>
                              <ArrowRight className="h-3 w-3 shrink-0 opacity-60" />
                            </button>
                          </li>
                        ))}
                        {hidden > 0 && (
                          <li>
                            <button
                              type="button"
                              onClick={() => setTopicsFor(s)}
                              className={`inline-flex items-center gap-0.5 rounded-full px-1 py-1 text-[11px] font-bold transition hover:underline sm:gap-1 sm:py-0 sm:text-xs ${p.label}`}
                            >
                              +{hidden} more {hidden === 1 ? "topic" : "topics"}
                              <ChevronRight className="h-3 w-3" />
                            </button>
                          </li>
                        )}
                      </ul>
                    ) : (
                      <p className="mt-2.5 text-xs text-neutral-500 sm:text-sm">No topics found.</p>
                    )}

                    <div className="mt-auto pt-2.5">
                      <button
                        onClick={() => startQuiz(s.name)}
                        className={`inline-flex w-full items-center justify-center gap-1.5 rounded-full py-2 text-xs font-semibold transition active:scale-[0.99] sm:gap-2 sm:text-sm ${p.btn}`}
                      >
                        Take a quiz
                        <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* Pages */}
          {totalPages > 1 && (
            <nav
              aria-label="Subject pages"
              className="flex flex-wrap items-center justify-center gap-1.5"
            >
              <button
                type="button"
                onClick={() => setPage(currentPage - 1)}
                disabled={currentPage === 1}
                aria-label="Previous page"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-700 transition hover:border-neutral-900 disabled:cursor-not-allowed disabled:opacity-40 sm:h-8 sm:w-8"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {pageItems(totalPages, currentPage).map((it, i) =>
                it === "…" ? (
                  <span key={`gap-${i}`} className="px-1 text-neutral-400">
                    …
                  </span>
                ) : (
                  <button
                    key={it}
                    type="button"
                    onClick={() => setPage(it)}
                    aria-label={`Page ${it}`}
                    aria-current={it === currentPage ? "page" : undefined}
                    className={`flex h-9 min-w-9 items-center justify-center rounded-full border px-2.5 text-sm font-bold transition sm:h-8 sm:min-w-8 ${
                      it === currentPage
                        ? "border-neutral-900 bg-neutral-900 text-white"
                        : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-900"
                    }`}
                  >
                    {it}
                  </button>
                )
              )}

              <button
                type="button"
                onClick={() => setPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                aria-label="Next page"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-700 transition hover:border-neutral-900 disabled:cursor-not-allowed disabled:opacity-40 sm:h-8 sm:w-8"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </nav>
          )}
        </section>
      </div>

      {/* ============ Dialog: topics extracted from the latest upload (bottom sheet on phones) ============ */}
      {result && showResult && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-neutral-950/60 p-0 sm:items-center sm:p-4"
          onClick={() => setShowResult(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Topics extracted from ${result.subject}`}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[90dvh] w-full max-w-4xl flex-col rounded-t-3xl border-t-4 border-t-neutral-900 bg-white shadow-2xl sm:max-h-[85dvh] sm:rounded-3xl"
          >
            {/* sheet handle (phones only) */}
            <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-neutral-300 sm:hidden" />

            <div className="flex items-center gap-3 p-4 pb-3 sm:p-5 sm:pb-3">
              <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-500" />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-extrabold tracking-tight text-neutral-900 sm:text-lg">
                  Latest upload: {result.subject}
                </h2>
                <p className="text-xs font-semibold text-emerald-700">
                  {result.extracted_topics.length} topics found. Pick one to generate a quiz.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowResult(false)}
                aria-label="Close"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 sm:h-9 sm:w-9"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 overflow-y-auto overscroll-contain px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:gap-3 sm:px-5 lg:grid-cols-3">
              {result.extracted_topics.map((topic: TopicItem) => {
                const p = resultPalette;
                return (
                  <article
                    key={topic.topic_id}
                    className={`flex min-w-0 flex-col justify-between rounded-xl border border-t-4 border-neutral-200 bg-white p-3 shadow-sm sm:p-4 ${p.bar}`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${p.icon}`}
                        >
                          <BookOpen className="h-3.5 w-3.5" />
                        </span>
                        <span className="truncate text-xs font-semibold text-neutral-500">
                          {topic.topic_id}
                        </span>
                      </div>
                      <h3 className="text-[13px] font-extrabold leading-snug text-neutral-900 sm:text-sm">
                        {topic.topic_name}
                      </h3>
                      <p className="text-[11px] leading-relaxed text-neutral-600 sm:text-xs">
                        {topic.summary}
                      </p>

                      {topic.subtopics?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {topic.subtopics.map((sub, idx) => (
                            <span
                              key={idx}
                              className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-medium text-neutral-800 sm:text-[11px]"
                            >
                              {sub}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => startQuiz(result.subject, topic.topic_name)}
                      className={`mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full py-2 text-xs font-semibold transition active:scale-[0.99] sm:gap-2 sm:text-sm ${p.btn}`}
                    >
                      Generate quiz
                      <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </button>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ============ Dialog: all topics of one subject (same look as the latest upload popup) ============ */}
      {topicsFor &&
        (() => {
          const p = paletteFor(topicsFor.name);
          const Icon = iconFor(topicsFor.name);
          return (
            <div
              className="fixed inset-0 z-[70] flex items-end justify-center bg-neutral-950/60 p-0 sm:items-center sm:p-4"
              onClick={() => setTopicsFor(null)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label={`${topicsFor.name} topics`}
                onClick={(e) => e.stopPropagation()}
                className="flex max-h-[90dvh] w-full max-w-4xl flex-col rounded-t-3xl border-t-4 border-t-neutral-900 bg-white shadow-2xl sm:max-h-[85dvh] sm:rounded-3xl"
              >
                {/* sheet handle (phones only) */}
                <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-neutral-300 sm:hidden" />

                <div className="flex items-center gap-3 p-4 pb-3 sm:p-5 sm:pb-3">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${p.icon}`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-base font-extrabold tracking-tight text-neutral-900 sm:text-lg">
                      {topicsFor.name}
                    </h2>
                    <p className={`text-xs font-semibold ${p.label}`}>
                      {topicsFor.details.length} topics. Pick one to generate a quiz.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTopicsFor(null)}
                    aria-label="Close"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 sm:h-9 sm:w-9"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="grid gap-2.5 overflow-y-auto overscroll-contain px-4 pb-3 sm:gap-3 sm:px-5 lg:grid-cols-3">
                  {topicsFor.details.map((d) => (
                    <article
                      key={d.id + d.name}
                      className={`flex min-w-0 flex-col justify-between rounded-xl border border-t-4 border-neutral-200 bg-white p-3 shadow-sm sm:p-4 ${p.bar}`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${p.icon}`}
                          >
                            <BookOpen className="h-3.5 w-3.5" />
                          </span>
                          <span className="truncate text-xs font-semibold text-neutral-500">
                            {d.id}
                          </span>
                        </div>
                        <h3 className="text-[13px] font-extrabold leading-snug text-neutral-900 sm:text-sm">
                          {d.name}
                        </h3>
                        {d.summary && (
                          <p className="text-[11px] leading-relaxed text-neutral-600 sm:text-xs">
                            {d.summary}
                          </p>
                        )}
                        {d.subtopics.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {d.subtopics.map((sub, idx) => (
                              <span
                                key={idx}
                                className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-medium text-neutral-800 sm:text-[11px]"
                              >
                                {sub}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => startQuiz(topicsFor.name, d.name)}
                        className={`mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full py-2 text-xs font-semibold transition active:scale-[0.99] sm:gap-2 sm:text-sm ${p.btn}`}
                      >
                        Generate quiz
                        <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </button>
                    </article>
                  ))}
                </div>

                <div className="p-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5 sm:pt-2 sm:pb-5">
                  <button
                    type="button"
                    onClick={() => startQuiz(topicsFor.name)}
                    className={`inline-flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold transition active:scale-[0.99] ${p.btn}`}
                  >
                    <span className="truncate">Take a quiz on {topicsFor.name}</span>
                    <ArrowRight className="h-4 w-4 shrink-0" />
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}