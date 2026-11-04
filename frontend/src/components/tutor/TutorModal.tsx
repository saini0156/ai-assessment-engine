"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { TutorExplainResponse } from "@/types";
import { X, Sparkles, Lightbulb, Brain, Globe, Loader2 } from "lucide-react";

interface TutorModalProps {
  isOpen: boolean;
  onClose: () => void;
  question: string;
  selectedOption: string | null;
  correctOption: string;
  explanation: string;
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
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setData(null);
      setError(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    apiClient
      .explainMistake({
        question,
        selected_option: selectedOption,
        correct_option: correctOption,
        explanation,
      })
      .then((res) => {
        if (isMounted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || "Failed to load explanation");
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, question, selectedOption, correctOption, explanation]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl transition-all sm:p-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">AI Tutor: Explain My Mistake</h3>
              <p className="text-xs text-slate-500">Pedagogical breakdown & intuitive analogies</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="mt-6 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              <p className="mt-3 text-sm font-medium">Generating tutor analogies & memory tips...</p>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          ) : data ? (
            <div className="space-y-4">
              {/* Simplified Explanation */}
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
                <div className="flex items-center gap-2 font-semibold text-indigo-950">
                  <Lightbulb className="h-4 w-4 text-indigo-600" />
                  <h4>Simplified Explanation</h4>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  {data.simplified_explanation}
                </p>
              </div>

              {/* Memory Tip */}
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
                <div className="flex items-center gap-2 font-semibold text-emerald-950">
                  <Brain className="h-4 w-4 text-emerald-600" />
                  <h4>Memory Tip & Catchphrase</h4>
                </div>
                <p className="mt-2 text-sm font-medium leading-relaxed text-emerald-900">
                  {data.memory_tip}
                </p>
              </div>

              {/* Real World Example */}
              <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-4">
                <div className="flex items-center gap-2 font-semibold text-amber-950">
                  <Globe className="h-4 w-4 text-amber-600" />
                  <h4>Real-World Analogy</h4>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  {data.real_world_example}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-100 px-5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
          >
            Got it, thanks!
          </button>
        </div>
      </div>
    </div>
  );
}
