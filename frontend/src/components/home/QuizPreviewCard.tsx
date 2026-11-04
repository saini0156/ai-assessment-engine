
import { Clock, Lightbulb } from "lucide-react";

const options = [
  { k: "A", t: "Queue", selected: false },
  { k: "B", t: "Stack", selected: true },
  { k: "C", t: "Linked list", selected: false },
  { k: "D", t: "Binary tree", selected: false },
];

export function QuizPreviewCard() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="rounded-2xl bg-white p-4 text-slate-900 shadow-[0_20px_60px_rgba(0,0,0,0.18)] ring-1 ring-black/5 sm:p-5">

        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Question 3 of 10
          </span>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
            <Clock className="h-3.5 w-3.5" />
            04:12
          </span>
        </div>

        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-[30%] rounded-full bg-slate-600" />
        </div>

        <p className="mt-4 text-sm font-semibold leading-snug tracking-tight">
          Which data structure uses the LIFO principle?
        </p>

        <div className="mt-4 space-y-2">
          {options.map((o) => (
            <div
              key={o.k}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                o.selected
                  ? "border-slate-500 bg-slate-50 font-semibold text-slate-900"
                  : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold ${
                  o.selected
                    ? "bg-slate-600 text-white"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {o.k}
              </span>
              {o.t}
            </div>
          ))}
        </div>
      </div>

      <div className="absolute -bottom-14 -left-6 hidden max-w-[220px] rounded-xl border border-amber-200/80 bg-amber-50 p-3 text-xs text-amber-900 shadow-lg sm:block">
        <div className="flex items-center gap-1.5 font-bold">
          <Lightbulb className="h-3.5 w-3.5" />
          Memory tip
        </div>

        <p className="mt-1 leading-snug">
          Think of a stack of plates: the last one placed is the first one taken.
        </p>
      </div>
    </div>
  );
}
