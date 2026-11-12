"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Library,
  ListChecks,
  Users,
  Server,
  Layers,
  type LucideIcon,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { getSession } from "@/lib/session";
import { normalizeSubjects, type SubjectEntry } from "@/lib/subjects";

function StatCard({
  icon: Icon,
  value,
  label,
  tint,
}: {
  icon: LucideIcon;
  value: string | number;
  label: string;
  tint: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-5">
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${tint}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-extrabold leading-tight text-neutral-900">{value}</p>
        <p className="truncate text-sm text-neutral-500">{label}</p>
      </div>
    </div>
  );
}

function HealthRow({
  icon: Icon,
  label,
  value,
  tint,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  tint: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <span className="flex items-center gap-3 text-[15px] text-neutral-700">
        <Icon className={`h-4 w-4 ${tint}`} />
        {label}
      </span>
      <span className="truncate text-base font-bold text-neutral-900">{value}</span>
    </div>
  );
}

export default function AdminDashboard() {
  const [name, setName] = useState("Admin");
  const [subjects, setSubjects] = useState<SubjectEntry[]>([]);
  const [userCount, setUserCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  useEffect(() => {
    const n = getSession()?.user?.name;
    if (n) setName(n);

    apiClient
      .getSubjects()
      .then((raw) => setSubjects(normalizeSubjects(raw)))
      .catch(() => {})
      .finally(() => setLoading(false));

    apiClient
      .getAdminUsers()
      .then((users) => setUserCount(users.length))
      .catch(() => {}); // stays "—" if it fails

    apiClient
      .checkHealth()
      .then(() => setBackendOnline(true))
      .catch(() => setBackendOnline(false));
  }, []);

  const totalTopics = useMemo(
    () => subjects.reduce((sum, s) => sum + s.topics.length, 0),
    [subjects]
  );
  // Server list is oldest-first, so reverse for newest-first
  const recent = useMemo(() => [...subjects].reverse().slice(0, 4), [subjects]);
  const avg = subjects.length ? Math.round(totalTopics / subjects.length) : 0;
  const show = (n: number) => (loading ? "…" : n);

  return (
    <div className="mx-auto max-w-[1400px]">
      <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">
        Welcome, {name}
      </h1>
      <p className="mt-1 text-neutral-500">Here&apos;s an overview of the platform.</p>

      {/* Stat cards */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Library} value={show(subjects.length)} label="Total Subjects" tint="bg-indigo-50 text-indigo-600" />
        <StatCard icon={ListChecks} value={show(totalTopics)} label="Total Topics" tint="bg-emerald-50 text-emerald-600" />
        <StatCard icon={Layers} value={show(avg)} label="Avg Topics / Subject" tint="bg-amber-50 text-amber-600" />
        <StatCard icon={Users} value={userCount ?? "—"} label="Total Users" tint="bg-sky-50 text-sky-600" />
      </div>

      {/* Two panels */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border border-neutral-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-extrabold text-neutral-900">Recent Subjects</h2>
            <Link
              href="/admin/subjects"
              className="inline-flex items-center gap-1 text-sm font-semibold text-neutral-700 hover:text-black"
            >
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {!loading && recent.length === 0 && (
            <p className="mt-6 text-sm text-neutral-500">No subjects uploaded yet.</p>
          )}

          <ul className="mt-4 divide-y divide-neutral-100">
            {recent.map((s) => (
              <li key={s.name} className="flex items-center justify-between gap-3 py-3.5">
                <span className="truncate text-[15px] text-neutral-900">{s.name}</span>
                <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  {s.topics.length} {s.topics.length === 1 ? "topic" : "topics"}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-extrabold text-neutral-900">Platform Health</h2>
            <span className="text-xs text-neutral-400">Live overview</span>
          </div>
          <div className="mt-3 divide-y divide-neutral-100">
            <HealthRow
              icon={Server}
              label="Backend server"
              value={backendOnline === null ? "…" : backendOnline ? "Online" : "Offline"}
              tint={backendOnline === false ? "text-red-500" : "text-emerald-500"}
            />
            <HealthRow icon={Library} label="Subjects" value={show(subjects.length)} tint="text-indigo-500" />
            <HealthRow icon={ListChecks} label="Topics" value={show(totalTopics)} tint="text-emerald-500" />
            <HealthRow icon={Layers} label="Latest subject" value={recent[0]?.name ?? "—"} tint="text-amber-500" />
          </div>
        </section>
      </div>
    </div>
  );
}