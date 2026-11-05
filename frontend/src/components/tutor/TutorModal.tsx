"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { TutorExplainResponse } from "@/types";
import { Globe2, Lightbulb, RotateCcw, Sparkles, X } from "lucide-react";

interface TutorModalProps {
  isOpen: boolean;
  onClose: () => void;
  question: string;
  selectedOption: string | null;
  correctOption: string;
  explanation: string;
}

function RobotFace({ thinking }: { thinking: boolean }) {
  return (
    <svg viewBox="0 0 48 48" className="h-11 w-11" aria-hidden="true">
      {/* antenna */}
      <line x1="24" y1="4" x2="24" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="24" cy="4" r="2.5" className={`fill-emerald-400 ${thinking ? "tm-pulse" : ""}`} />
      {/* head */}
      <rect x="6" y="10" width="36" height="30" rx="10" className="fill-black" />
      {/* ears */}
      <rect x="2" y="21" width="4" height="9" rx="2" className="fill-stone-400" />
      <rect x="42" y="21" width="4" height="9" rx="2" className="fill-stone-400" />
      {/* eyes */}
      <g className="tm-blink" style={{ transformOrigin: "24px 25px" }}>
        <ellipse cx="17" cy="25" rx="3.2" ry="4" className="fill-white" />
        <ellipse cx="31" cy="25" rx="3.2" ry="4" className="fill-white" />
      </g>
      {/* mouth */}
      <path d="M17 34 Q24 38 31 34" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function Bubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="tm-pop flex items-start gap-2.5">
      <div className="mt-1 hidden h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black text-white sm:flex">
        <Sparkles className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm bg-stone-100 px-4 py-3 text-sm leading-relaxed text-stone-800">
        {children}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="tm-pop flex items-start gap-2.5">
      <div className="mt-1 hidden h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black text-white sm:flex">
        <Sparkles className="h-3.5 w-3.5" />
      </div>
      <div
        className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-stone-100 px-4 py-3.5"
        aria-label="QuizBot is thinking"
      >
        <span className="tm-dot h-2 w-2 rounded-full bg-stone-400" />
        <span className="tm-dot h-2 w-2 rounded-full bg-stone-400" style={{ animationDelay: "150ms" }} />
        <span className="tm-dot h-2 w-2 rounded-full bg-stone-400" style={{ animationDelay: "300ms" }} />
      </div>
    </div>
  );
}

export function TutorModal({
  isOpen,
  onClose,
  question,
  selectedOption,
  correctOption,
  explanation,
}: TutorModalProps) {
  const [data, setData] = useState<TutorExplainResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState(0); // how many reply bubbles are visible (0-3)
  const [attempt, setAttempt] = useState(0);

  const fetchReply = useCallback(
    async (isCancelled: () => boolean) => {
      setLoading(true);
      setError(null);
      setData(null);
      setShown(0);

      try {
        const res = await apiClient.explainMistake({
          question,
          selected_option: selectedOption,
          correct_option: correctOption,
          explanation,
        });
        if (!isCancelled()) setData(res);
      } catch (err: any) {
        if (!isCancelled()) setError(err?.message || "Failed to load explanation");
      } finally {
        if (!isCancelled()) setLoading(false);
      }
    },
    [question, selectedOption, correctOption, explanation]
  );

  // Fetch when the modal opens (or when "Try again" is pressed)
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    fetchReply(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [isOpen, attempt, fetchReply]);

  // Reveal the reply one bubble at a time
  useEffect(() => {
    if (!data) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(3);
      return;
    }
    const timers = [
      setTimeout(() => setShown(1), 300),
      setTimeout(() => setShown(2), 1500),
      setTimeout(() => setShown(3), 2700),
    ];
    return () => timers.forEach(clearTimeout);
  }, [data]);

  // Esc to close + lock page scroll while open
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const thinking = loading || (!!data && shown < 3);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutor-title"
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <style>{`
        @keyframes tm-pop { from { opacity: 0; transform: translateY(12px) scale(.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes tm-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes tm-dot { 0%,80%,100% { transform: translateY(0); opacity: .4; } 40% { transform: translateY(-5px); opacity: 1; } }
        @keyframes tm-blink { 0%,92%,100% { transform: scaleY(1); } 95% { transform: scaleY(.1); } }
        @keyframes tm-pulse { 0%,100% { opacity: 1; } 50% { opacity: .25; } }
        .tm-pop { opacity: 0; animation: tm-pop .45s cubic-bezier(.2,.8,.2,1) forwards; }
        .tm-sheet { animation: tm-up .35s cubic-bezier(.2,.8,.2,1); }
        .tm-dot { animation: tm-dot 1s ease-in-out infinite; }
        .tm-blink { animation: tm-blink 4s infinite; }
        .tm-pulse { animation: tm-pulse .8s ease-in-out infinite; }
        @media (min-width: 640px) { .tm-sheet { animation: tm-pop .35s cubic-bezier(.2,.8,.2,1) forwards; } }
        @media (prefers-reduced-motion: reduce) {
          .tm-pop, .tm-sheet, .tm-dot, .tm-blink, .tm-pulse { animation: none !important; opacity: 1 !important; }
        }
      `}</style>

      <div
        className="tm-sheet flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-stone-200 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-3">
            <div className="text-black">
              <RobotFace thinking={thinking} />
            </div>
            <div className="leading-tight">
              <h2 id="tutor-title" className="text-base font-extrabold text-stone-900">
                QuizBot <span className="font-medium text-stone-500">· AI Tutor</span>
              </h2>
              <p className="flex items-center gap-1.5 text-xs text-stone-500">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                {thinking ? "Thinking..." : "Online"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Chat */}
        <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          <Bubble>
            <p className="font-semibold text-stone-900">Hi! Let&apos;s look at the one you missed.</p>
            <p className="mt-2 rounded-lg bg-white px-3 py-2 text-stone-700 ring-1 ring-stone-200">
              {question}
            </p>
            <p className="mt-2 text-xs">
              You chose{" "}
              <span className="font-bold text-red-600">
                {selectedOption ? `Option ${selectedOption}` : "no option"}
              </span>
              . The correct answer is{" "}
              <span className="font-bold text-emerald-600">Option {correctOption}</span>.
            </p>
          </Bubble>

          {loading && <TypingDots />}

          {error && (
            <Bubble>
              <p className="font-semibold text-red-600">Oops, something went wrong.</p>
              <p className="mt-1 text-stone-600">{error}</p>
              <button
                onClick={() => setAttempt((a) => a + 1)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-black px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-stone-800"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Try again
              </button>
            </Bubble>
          )}

          {data && shown >= 1 && (
            <Bubble>
              <p className="mb-1 text-xs font-bold uppercase tracking-widest text-stone-500">
                Simplified explanation
              </p>
              {data.simplified_explanation}
            </Bubble>
          )}

          {data && shown === 1 && <TypingDots />}

          {data && shown >= 2 && (
            <Bubble>
              <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-amber-600">
                <Lightbulb className="h-3.5 w-3.5" />
                Memory tip &amp; catchphrase
              </p>
              <span className="font-medium">{data.memory_tip}</span>
            </Bubble>
          )}

          {data && shown === 2 && <TypingDots />}

          {data && shown >= 3 && (
            <Bubble>
              <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-sky-600">
                <Globe2 className="h-3.5 w-3.5" />
                Real-world analogy
              </p>
              {data.real_world_example}
            </Bubble>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-stone-200 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4">
          <button
            onClick={onClose}
            className="w-full rounded-md bg-black py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
          >
            Got it, thanks
          </button>
        </div>
      </div>
    </div>
  );
}