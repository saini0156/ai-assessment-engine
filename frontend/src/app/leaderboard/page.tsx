"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  BookOpen,
  CalendarDays,
  CalendarRange,
  Crown,
  Gem,
  Infinity as InfinityIcon,
  Info,
  RefreshCw,
  Star,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { normalizeSubjects, type SubjectEntry } from "@/lib/subjects";
import type {
  LeaderboardPeriod,
  LeaderboardResponse,
  TopicLeaderboardResponse,
} from "@/types";

/* ------------------------------ types ------------------------------ */

type Tab = "points" | "topic";

type Row = {
  id: string;
  rank: number;
  name: string;
  meta: string;
  value: string;
  sub?: string;
};

type BoardData = { rows: Row[]; me: Row | null; total: number };

const PERIODS: { id: LeaderboardPeriod; label: string }[] = [
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
  { id: "all", label: "All Time" },
];

const PERIOD_ICONS: Record<LeaderboardPeriod, LucideIcon> = {
  week: CalendarDays,
  month: CalendarRange,
  all: InfinityIcon,
};

// Visual config only: order is 2nd, 1st, 3rd.
const PODIUM = [
  {
    place: 2,
    height: "h-32 sm:h-36",
    block: "from-slate-100 to-slate-300 border-slate-300/80",
    pill: "bg-slate-400",
    ring: "ring-slate-300",
  },
  {
    place: 1,
    height: "h-40 sm:h-48",
    block: "from-amber-100 via-amber-200 to-amber-300 border-amber-300",
    pill: "bg-amber-500",
    ring: "ring-amber-300 shadow-[0_0_40px_rgba(251,191,36,0.55)]",
  },
  {
    place: 3,
    height: "h-28 sm:h-32",
    block: "from-orange-100 to-orange-300 border-orange-300/80",
    pill: "bg-orange-500",
    ring: "ring-orange-300",
  },
];

const AVATAR_COLORS = [
  "bg-purple-600",
  "bg-green-600",
  "bg-blue-600",
  "bg-pink-600",
  "bg-teal-600",
  "bg-indigo-600",
  "bg-rose-600",
];

// Fades the hero artwork into the page on its left and bottom edges.
const HERO_MASK: React.CSSProperties = {
  maskImage:
    "linear-gradient(to right, transparent 0%, #000 30%), linear-gradient(to bottom, #000 72%, transparent 100%)",
  WebkitMaskImage:
    "linear-gradient(to right, transparent 0%, #000 30%), linear-gradient(to bottom, #000 72%, transparent 100%)",
  maskComposite: "intersect",
  WebkitMaskComposite: "source-in",
};

/* ----------------------------- helpers ----------------------------- */

// The backend sends times without a timezone. Treat them as UTC.
function toDate(value: string): Date {
  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(value);
  return new Date(hasZone ? value : `${value}Z`);
}

function shortDate(value: string): string {
  const d = toDate(value);
  return isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function ordinalSuffix(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return "th";
  return ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function colorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

const toPointsBoard = (res: LeaderboardResponse): BoardData => {
  const toRow = (e: LeaderboardResponse["entries"][number]): Row => ({
    id: e.user_id,
    rank: e.rank,
    name: e.display_name,
    meta: `${e.quizzes_taken} ${e.quizzes_taken === 1 ? "quiz" : "quizzes"}${
      e.avg_score === null ? "" : ` · avg ${Math.round(e.avg_score)}%`
    }`,
    value: `${e.points} pts`,
  });
  return { rows: res.entries.map(toRow), me: res.me ? toRow(res.me) : null, total: res.total_participants };
};

const toTopicBoard = (res: TopicLeaderboardResponse): BoardData => {
  const toRow = (e: TopicLeaderboardResponse["entries"][number]): Row => ({
    id: e.user_id,
    rank: e.rank,
    name: e.display_name,
    meta: `${e.difficulty} · ${e.correct_count}/${e.total_questions} correct${
      e.achieved_at ? ` · ${shortDate(e.achieved_at)}` : ""
    }`,
    value: `${e.points} pts`,
    sub: `${Math.round(e.score_percentage)}%`,
  });
  return { rows: res.entries.map(toRow), me: res.me ? toRow(res.me) : null, total: res.total_participants };
};

/* --------------------------- small pieces --------------------------- */

function Avatar({
  name,
  dark = false,
  className = "",
}: {
  name: string;
  dark?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-bold text-white ${
        dark ? "bg-neutral-900" : colorFor(name)
      } ${className}`}
    >
      {initials(name)}
    </span>
  );
}

function Value({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-extrabold text-neutral-900 ${className}`}>
      <Gem className="h-4 w-4 shrink-0 fill-orange-400 text-orange-500" />
      {children}
    </span>
  );
}

function Confetti({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute h-3 w-1.5 rotate-45 rounded-sm bg-orange-400 ${className}`}
    />
  );
}

function Sparkle({ className }: { className: string }) {
  return (
    <Star
      aria-hidden
      className={`pointer-events-none absolute fill-amber-400 text-amber-400 ${className}`}
    />
  );
}

function RowItem({ r, mine }: { r: Row; mine: boolean }) {
  return (
    <li
      className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 shadow-sm sm:px-4 ${
        mine ? "border-orange-300 bg-orange-100/80" : "border-stone-100 bg-white"
      }`}
    >
      <span className="w-6 shrink-0 text-center text-sm font-extrabold text-neutral-900 sm:w-8">
        {r.rank}
      </span>
      <span className="h-9 w-px shrink-0 bg-stone-200" />
      <Avatar name={r.name} dark={mine} className="h-11 w-11 text-sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-neutral-900">
          {r.name}
          {mine && (
            <span className="ml-2 rounded-full bg-orange-500 px-2 py-0.5 align-middle text-[11px] font-bold text-white">
              You
            </span>
          )}
        </p>
        <p className="truncate text-xs text-stone-500">{r.meta}</p>
      </div>
      <div className="shrink-0 text-right">
        <Value className="text-sm sm:text-base">{r.value}</Value>
        {r.sub && <p className="text-xs font-semibold text-stone-500">{r.sub}</p>}
      </div>
      <span
        className={`hidden shrink-0 rounded-full px-3.5 py-1 text-sm font-black sm:inline-block ${
          mine
            ? "border border-orange-500 bg-white text-orange-600"
            : "bg-stone-100 text-stone-600"
        }`}
      >
        {r.rank}
        <sup className="text-[0.6em]">{ordinalSuffix(r.rank)}</sup>
      </span>
    </li>
  );
}

function KeepGoing({ isTop }: { isTop: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-neutral-800 to-neutral-950 p-6 text-center text-white shadow-xl">
      <Sparkle className="left-6 top-8 h-3 w-3" />
      <Sparkle className="right-8 top-6 h-2.5 w-2.5" />
      <Sparkle className="right-5 top-20 h-2 w-2" />
      <Trophy className="mx-auto h-16 w-16 fill-amber-400/30 text-amber-400" />
      <h3 className="mt-3 text-2xl font-black">{isTop ? "You're #1!" : "Keep Going!"}</h3>
      <p className="mx-auto mt-1 max-w-[12rem] text-sm text-stone-300">
        {isTop
          ? "Defend your spot with another quiz."
          : "You're just one step away from the top!"}
      </p>
      <div className="mt-5 flex h-20 items-end justify-center gap-1.5" aria-hidden>
        {[30, 40, 55, 62, 80, 100].map((h, i) => (
          <span
            key={i}
            style={{ height: `${h}%` }}
            className="w-5 rounded-t bg-gradient-to-t from-orange-600 to-amber-300"
          />
        ))}
      </div>
      <Link
        href="/quiz/new"
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/30 transition hover:brightness-105"
      >
        <RefreshCw className="h-4 w-4" />
        Try Again
      </Link>
    </div>
  );
}

function Board({ data }: { data: BoardData }) {
  const { rows, me, total } = data;
  const myId = me?.id;

  if (rows.length === 0) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center rounded-3xl border border-dashed border-orange-200 bg-white/80 px-6 py-16 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
          <Trophy className="h-7 w-7" />
        </span>
        <p className="mt-4 text-lg font-bold text-neutral-900">No rankings yet</p>
        <p className="mt-1 max-w-sm text-sm text-stone-500">
          Take a quiz to be the first on the board.
        </p>
      </div>
    );
  }

  const top = rows.slice(0, 3);
  const rest = rows.slice(3);
  const meInList = !me || rows.some((r) => r.id === me.id);
  const showList = rest.length > 0 || (me && !meInList);

  return (
    <div className="space-y-10">
      {/* Podium */}
      <div>
        <div className="relative mx-auto flex max-w-5xl items-end justify-center px-2 pt-14">
          <Sparkle className="left-4 top-16 h-4 w-4" />
          <Sparkle className="right-6 top-12 h-5 w-5" />
          <Confetti className="left-10 top-24" />
          <Confetti className="right-16 top-28" />

          {PODIUM.map((p) => {
            const r = top[p.place - 1];
            if (!r) return <div key={p.place} className="w-1/3 max-w-[320px]" />;
            const isMe = r.id === myId;
            return (
              <div
                key={p.place}
                className="relative flex w-1/3 max-w-[320px] flex-col items-center text-center"
              >
                {p.place === 1 && (
                  <Crown className="relative z-10 -mb-2 h-10 w-10 fill-amber-400 text-amber-500 drop-shadow" />
                )}
                <Avatar
                  name={r.name}
                  dark
                  className={`relative z-10 h-20 w-20 text-2xl ring-4 sm:h-24 sm:w-24 sm:text-3xl ${p.ring}`}
                />
                <span
                  className={`relative z-10 -mt-3.5 rounded-full px-3 py-0.5 text-sm font-extrabold text-white shadow ring-2 ring-white ${p.pill}`}
                >
                  {p.place}
                  {ordinalSuffix(p.place)}
                </span>
                <div
                  className={`-mt-3 flex w-full flex-col items-center justify-center rounded-t-2xl border bg-gradient-to-b px-2 pt-4 shadow-lg ${p.height} ${p.block}`}
                >
                  <p className="w-full truncate text-sm font-bold text-neutral-900 sm:text-base">
                    {r.name}
                    {isMe && (
                      <span className="ml-1 text-xs font-bold text-orange-600">(You)</span>
                    )}
                  </p>
                  <Value className="mt-1 text-sm sm:text-lg">{r.value}</Value>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mx-auto -mt-2 h-6 max-w-5xl rounded-[50%] bg-gradient-to-r from-slate-200 via-white to-slate-200 shadow-[0_12px_30px_rgba(100,116,139,0.25)]" />
      </div>

      {/* Ranking list + motivation card */}
      <div
        className={
          showList ? "grid gap-8 lg:grid-cols-[1fr_340px]" : "mx-auto w-full max-w-sm"
        }
      >
        {showList && (
          <section className="rounded-3xl bg-white/90 p-4 shadow-lg ring-1 ring-stone-100 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3">
              <h2 className="flex items-center gap-2 text-xl font-black text-neutral-900">
                <Trophy className="h-6 w-6 fill-amber-400/40 text-amber-500" />
                Top Ranking
              </h2>
              <span className="inline-flex items-center gap-1.5 text-sm text-stone-600">
                <Users className="h-4 w-4" />
                Total Participants: <b className="text-neutral-900">{total}</b>
              </span>
            </div>

            {rest.length > 0 && (
              <ul className="space-y-2.5">
                {rest.map((r) => (
                  <RowItem key={`${r.id}-${r.rank}`} r={r} mine={r.id === myId} />
                ))}
              </ul>
            )}

            {/* The student's own rank, when it's outside the list */}
            {me && !meInList && (
              <div className={rest.length > 0 ? "mt-5" : ""}>
                <p className="mb-2 text-center text-xs font-semibold uppercase tracking-widest text-stone-400">
                  Your position
                </p>
                <ul>
                  <RowItem r={me} mine />
                </ul>
              </div>
            )}
          </section>
        )}

        <KeepGoing isTop={me?.rank === 1} />
      </div>

      {!showList && (
        <p className="text-center text-sm text-stone-500">
          Total Participants: <b className="text-neutral-900">{total}</b>
        </p>
      )}
    </div>
  );
}

/* ------------------------------- page ------------------------------- */

const selectClass =
  "w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400";

export default function LeaderboardPage() {
  const [tab, setTab] = useState<Tab>("points");
  const [period, setPeriod] = useState<LeaderboardPeriod>("week");
  const [entries, setEntries] = useState<SubjectEntry[]>([]);
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [board, setBoard] = useState<BoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const topics = useMemo(
    () => entries.find((e) => e.name === subject)?.topics ?? [],
    [entries, subject]
  );

  // Subjects and topics for the topic leaderboard
  useEffect(() => {
    let cancelled = false;
    apiClient
      .getSubjects()
      .then((raw) => {
        if (cancelled) return;
        const list = normalizeSubjects(raw);
        setEntries(list);
        if (list[0]) {
          setSubject(list[0].name);
          setTopic(list[0].topics[0] ?? "");
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Load the board for the current tab and filters
  useEffect(() => {
    if (tab === "topic" && (!subject || !topic)) {
      setBoard(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const request =
      tab === "points"
        ? apiClient.getLeaderboard(period).then(toPointsBoard)
        : apiClient.getTopicLeaderboard(subject, topic, period).then(toTopicBoard);

    request
      .then((b) => !cancelled && setBoard(b))
      .catch((err: any) => !cancelled && setError(err?.message || "Failed to load the leaderboard"))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [tab, period, subject, topic, attempt]);

  const handleSubject = (name: string) => {
    setSubject(name);
    setTopic(entries.find((e) => e.name === name)?.topics[0] ?? "");
  };

  return (
    <div className="relative isolate left-1/2 right-1/2 -mx-[50vw] -mt-8 min-h-[calc(100vh-80px)] w-screen overflow-hidden bg-gradient-to-b from-orange-50/70 via-violet-50/40 to-white pb-20">
      {/* background blobs */}
      <div className="pointer-events-none absolute -left-24 -top-24 -z-10 h-80 w-80 rounded-full bg-orange-200/70 blur-3xl" />
      <div className="pointer-events-none absolute -left-20 top-72 -z-10 h-48 w-96 rounded-full bg-orange-300/40 blur-3xl" />

      {/* hero artwork, pinned to the right edge of the screen */}
      <div
        aria-hidden
        style={HERO_MASK}
        className="pointer-events-none absolute right-0 top-0 -z-10 hidden aspect-[1068/752] w-[min(56vw,720px)] md:block"
      >
        <Image
          src="/images/leaderboard-hero.png"
          alt=""
          fill
          priority
          sizes="720px"
          className="object-cover"
        />
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-8 lg:px-12">
        {/* Hero */}
        <div className="relative flex items-center py-6 md:py-8">
          <Confetti className="left-[42%] top-6" />
          <Sparkle className="left-[46%] top-12 h-4 w-4" />

          <div className="space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow-lg">
              <Trophy className="h-4 w-4 fill-amber-400 text-amber-400" />
              Leaderboard
            </span>
            <h1 className="text-5xl font-black tracking-tight text-neutral-950 sm:text-6xl lg:text-7xl">
              Who&apos;s on{" "}
              <span className="bg-gradient-to-r from-orange-500 to-amber-400 bg-clip-text text-transparent">
                top?
              </span>
            </h1>
            <p className="max-w-[22rem] text-lg leading-snug text-stone-600 sm:text-xl">
              Earn points with every quiz and climb the ranking.
            </p>
            <svg viewBox="0 0 160 14" className="h-3 w-40 text-orange-500" aria-hidden>
              <path
                d="M2 10 Q60 -2 158 4"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-2 flex justify-center">
          <div className="inline-flex rounded-full bg-white/90 p-1.5 text-sm font-bold shadow-md ring-1 ring-stone-200">
            {(
              [
                { id: "points", label: "Total Points", icon: Star },
                { id: "topic", label: "By Topic", icon: BookOpen },
              ] as const
            ).map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-2 rounded-full px-6 py-2.5 transition ${
                    active
                      ? "bg-neutral-900 text-white shadow"
                      : "text-stone-700 hover:text-black"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 ${active && t.id === "points" ? "fill-amber-400 text-amber-400" : ""}`}
                  />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Topic pickers */}
        {tab === "topic" && (
          <div className="mx-auto mt-5 grid max-w-2xl gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="lb-subject" className="mb-1.5 block text-sm font-bold text-black">
                Subject
              </label>
              <select
                id="lb-subject"
                value={subject}
                onChange={(e) => handleSubject(e.target.value)}
                disabled={entries.length === 0}
                className={selectClass}
              >
                {entries.length === 0 && <option>No subjects yet</option>}
                {entries.map((e) => (
                  <option key={e.name} value={e.name}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="lb-topic" className="mb-1.5 block text-sm font-bold text-black">
                Topic
              </label>
              <select
                id="lb-topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={topics.length === 0}
                className={selectClass}
              >
                {topics.length === 0 && <option>No topics</option>}
                {topics.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Period */}
        <div className="mt-3 flex flex-wrap justify-center gap-2.5">
          {PERIODS.map((p) => {
            const Icon = PERIOD_ICONS[p.id];
            const active = period === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                aria-pressed={active}
                className={`inline-flex items-center gap-2 rounded-full border px-5 py-2 text-sm font-bold transition ${
                  active
                    ? "border-orange-500 bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/30"
                    : "border-stone-200 bg-white/90 text-stone-700 hover:border-stone-400"
                }`}
              >
                <Icon className="h-4 w-4" />
                {p.label}
              </button>
            );
          })}
        </div>

        {/* How points work */}
        <div className="mx-auto mt-4 flex max-w-5xl items-center gap-3 rounded-2xl border border-orange-200 bg-orange-50 px-5 py-2.5 text-sm text-neutral-800 sm:rounded-full">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white">
            <Info className="h-3.5 w-3.5" />
          </span>
          <p>
            Each correct answer earns points by difficulty: Easy 1, Medium 2, Hard 3. Only your best
            attempt on each topic and difficulty counts.
          </p>
        </div>

        {/* Content */}
        <div className="mt-4">
          {error && (
            <div className="mx-auto max-w-2xl rounded-3xl border border-red-200 bg-red-50 p-6 text-center">
              <AlertCircle className="mx-auto h-8 w-8 text-red-500" />
              <p className="mt-2 text-sm font-semibold text-red-800">{error}</p>
              <button
                onClick={() => setAttempt((a) => a + 1)}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow transition hover:brightness-105"
              >
                <RefreshCw className="h-4 w-4" />
                Try again
              </button>
            </div>
          )}

          {loading && !error && (
            <div className="mx-auto max-w-4xl space-y-3" aria-busy="true">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-2xl bg-stone-200/70" />
              ))}
            </div>
          )}

          {!loading && !error && tab === "topic" && !board && (
            <p className="text-center text-sm text-stone-500">
              Upload a syllabus first to see topic rankings.
            </p>
          )}

          {!loading && !error && board && <Board data={board} />}
        </div>
      </div>
    </div>
  );
}