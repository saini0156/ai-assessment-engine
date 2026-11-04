"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";
import { SyllabusUploadResponse, TopicItem } from "@/types";
import { UploadCloud, FileText, CheckCircle2, ArrowRight, Loader2, Sparkles, BookOpen } from "lucide-react";

export default function AdminSyllabusPage() {
  const router = useRouter();
  const [subject, setSubject] = useState("Computer Science");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SyllabusUploadResponse | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a PDF or text file first.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await apiClient.uploadSyllabus(subject, file);
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to process syllabus.");
    } finally {
      setLoading(false);
    }
  };

  const startQuizForTopic = (topicName: string) => {
    router.push(`/quiz/new?subject=${encodeURIComponent(subject)}&topic=${encodeURIComponent(topicName)}`);
  };

  return (
    <div className="space-y-8">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Admin Syllabus Ingestion
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Upload a syllabus PDF to automatically extract topics, subtopics, and prepare dynamic quizzes.
        </p>
      </div>

      {/* Upload Form */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <form onSubmit={handleUpload} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700">Subject Name</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Computer Science"
              required
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700">Syllabus PDF or Notes</label>
            <div className="mt-1.5 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center transition-colors hover:border-indigo-400">
              <UploadCloud className="h-10 w-10 text-indigo-500" />
              <p className="mt-2 text-sm font-medium text-slate-700">
                {file ? file.name : "Drag & drop your syllabus PDF here, or click to browse"}
              </p>
              <p className="text-xs text-slate-400">Supports .pdf and .txt files</p>
              <input
                type="file"
                accept=".pdf,.txt"
                onChange={handleFileChange}
                className="mt-4 text-xs text-slate-500 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading || !file}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Extracting Topics with AI...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Process Syllabus</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Extracted Topics Result Grid */}
      {result && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              <h2 className="text-xl font-bold text-slate-900">
                Extracted Topics for {result.subject}
              </h2>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {result.extracted_topics.length} Topics Discovered
            </span>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {result.extracted_topics.map((topic: TopicItem) => (
              <div
                key={topic.topic_id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-indigo-600">
                    <BookOpen className="h-5 w-5" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      {topic.topic_id}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">{topic.topic_name}</h3>
                  <p className="text-xs leading-relaxed text-slate-500">{topic.summary}</p>

                  <div className="pt-2">
                    <span className="text-[11px] font-semibold text-slate-400">SUBTOPICS:</span>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {topic.subtopics.map((sub, idx) => (
                        <span
                          key={idx}
                          className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700"
                        >
                          {sub}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-6">
                  <button
                    onClick={() => startQuizForTopic(topic.topic_name)}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
                  >
                    <span>Generate Quiz</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
