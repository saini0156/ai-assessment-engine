"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Loader2, Search, UploadCloud } from "lucide-react";
import { apiClient } from "@/lib/api";
import { normalizeSubjects, type SubjectEntry } from "@/lib/subjects";

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<SubjectEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [openName, setOpenName] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .getSubjects()
      .then((raw) => setSubjects(normalizeSubjects(raw)))
      .catch((e) => setError(e.message || "Failed to load subjects."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...subjects].reverse(); // newest first
    return q ? list.filter((s) => s.name.toLowerCase().includes(q)) : list;
  }, [subjects, query]);

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">Subjects</h1>
          <p className="mt-1 text-neutral-500">{subjects.length} subjects uploaded</p>
        </div>
        <div className="flex w-full flex-wrap gap-3 sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search subjects"
              className="w-full rounded-lg border border-neutral-300 bg-white py-2.5 pl-9 pr-3 text-base focus:border-neutral-900 focus:outline-none sm:text-sm"
            />
          </div>
          <Link
            href="/admin/upload-pdf"
            className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-black"
          >
            <UploadCloud className="h-4 w-4" />
            Upload
          </Link>
        </div>
      </div>

      {error && (
        <div role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && <Loader2 className="mx-auto mt-12 h-6 w-6 animate-spin text-neutral-400" />}

      {!loading && !error && filtered.length === 0 && (
        <p className="mt-12 text-center text-neutral-500">No subjects found.</p>
      )}

      <div className="mt-6 space-y-3">
        {filtered.map((s) => {
          const open = openName === s.name;
          return (
            <div key={s.name} className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
              <button
                onClick={() => setOpenName(open ? null : s.name)}
                aria-expanded={open}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-neutral-50"
              >
                <span className="truncate text-base font-bold text-neutral-900">{s.name}</span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    {s.topics.length} {s.topics.length === 1 ? "topic" : "topics"}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-neutral-500 transition ${open ? "rotate-180" : ""}`} />
                </span>
              </button>

              {open && (
                <div className="border-t border-neutral-100 bg-neutral-50/50 px-5 py-4">
                  {s.details.length === 0 && (
                    <p className="text-sm text-neutral-500">No topics found.</p>
                  )}
                  <ul className="grid gap-3 md:grid-cols-2">
                    {s.details.map((d) => (
                      <li key={d.id + d.name} className="rounded-xl border border-neutral-200 bg-white p-4">
                        <p className="text-sm font-bold text-neutral-900">{d.name}</p>
                        {d.summary && (
                          <p className="mt-1 text-xs leading-relaxed text-neutral-600">{d.summary}</p>
                        )}
                        {d.subtopics.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {d.subtopics.map((sub, i) => (
                              <span
                                key={i}
                                className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] font-medium text-neutral-800"
                              >
                                {sub}
                              </span>
                            ))}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}