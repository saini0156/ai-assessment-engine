import Link from "next/link";
import { ArrowRight, BookOpen, Check, UploadCloud, Zap } from "lucide-react";
import Reveal from "@/components/ui/Reveal";

function PdfIllustration() {
  return (
    <div className="relative h-44 w-40 transition-transform duration-300 group-hover:-translate-y-2">
      <div className="absolute inset-0 rotate-6 rounded-2xl bg-violet-300/50 transition-transform duration-300 group-hover:rotate-3" />
      <div className="absolute inset-0 -rotate-3 rounded-xl bg-white p-4 shadow-xl ring-1 ring-violet-100 transition-transform duration-300 group-hover:rotate-0">
        <div className="space-y-2">
          <div className="h-2 w-3/4 rounded bg-violet-300" />
          <div className="h-2 w-full rounded bg-violet-100" />
          <div className="h-2 w-5/6 rounded bg-violet-100" />
          <div className="h-2 w-2/3 rounded bg-violet-100" />
        </div>

        <span className="absolute bottom-12 right-3 rounded-md bg-violet-900 px-2 py-1 text-[11px] font-bold text-white">
          PDF
        </span>

        <span className="absolute -bottom-3 right-5 flex h-9 w-9 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg">
          <UploadCloud className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}

function QuizIllustration() {
  const opts = [
    { k: "A", t: "Queue", on: false },
    { k: "B", t: "Stack", on: true },
    { k: "C", t: "Linked list", on: false },
    { k: "D", t: "Binary tree", on: false },
  ];

  return (
    <div className="w-48 -rotate-3 rounded-2xl bg-white p-3.5 shadow-xl ring-1 ring-emerald-100 transition-transform duration-300 group-hover:-translate-y-2 group-hover:rotate-0">
      <div className="flex items-center justify-between text-[10px] font-semibold text-stone-600">
        <span>Question 3 of 10</span>
        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-violet-700">
          04:12
        </span>
      </div>

      <div className="mt-2 h-1 rounded-full bg-stone-100">
        <div className="h-1 w-1/3 rounded-full bg-violet-600" />
      </div>

      <div className="mt-3 space-y-1.5">
        {opts.map((o) => (
          <div
            key={o.k}
            className={`flex items-center gap-2 rounded-lg px-2 py-1 text-[11px] ${
              o.on
                ? "bg-violet-100 font-semibold text-violet-900"
                : "text-stone-600"
            }`}
          >
            <span
              className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ${
                o.on
                  ? "bg-violet-600 text-white"
                  : "bg-stone-100 text-stone-600"
              }`}
            >
              {o.k}
            </span>
            {o.t}
          </div>
        ))}
      </div>
    </div>
  );
}

const workflows = [
  {
    icon: BookOpen,
    title: "Admin / Teacher",
    description:
      "Drag and drop a syllabus PDF or course notes and get a structured topic tree back.",
    bullets: [
      "Chapter and subtopic extraction",
      "Auto-generated topic summaries",
      "Ready for question generation",
    ],
    href: "/admin",
    cta: "Upload Syllabus Now",
    card: "bg-gradient-to-br from-violet-50 via-violet-50 to-violet-100 ring-violet-200 hover:shadow-violet-200/70",
    blob: "bg-violet-300/40",
    iconBox: "bg-violet-600 text-white shadow-violet-200",
    check: "bg-violet-600",
    button: "bg-violet-600 text-white hover:bg-violet-700",
    art: <PdfIllustration />,
  },
  {
    icon: Zap,
    title: "Student Assessment",
    description:
      "Choose a topic and difficulty, then take a timed quiz with instant results.",
    bullets: [
      "Easy, Medium and Hard levels",
      "Timed quiz with zero answer leaks",
      "AI explanations for every mistake",
    ],
    href: "/quiz/new",
    cta: "Start Assessment",
    card: "bg-gradient-to-br from-emerald-50 via-emerald-50 to-emerald-100 ring-emerald-200 hover:shadow-emerald-200/70",
    blob: "bg-emerald-300/40",
    iconBox: "bg-emerald-600 text-white shadow-emerald-200",
    check: "bg-emerald-600",
    button: "bg-emerald-600 text-white hover:bg-emerald-700",
    art: <QuizIllustration />,
  },
];

export function WorkflowsSection() {
  return (
    <section className="grid gap-6 lg:grid-cols-2">
      {workflows.map((w, index) => (
        <Reveal
          key={w.title}
          direction="up"
          delay={index * 0.15}
          duration={0.8}
        >
          <div
            className={`group relative flex h-full items-center justify-between gap-4 overflow-hidden rounded-3xl p-7 ring-1 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${w.card}`}
          >
            {/* Decorative corner circle */}
            <span
              className={`pointer-events-none absolute -bottom-16 -right-16 h-56 w-56 rounded-full ${w.blob}`}
            />

            {/* Content */}
            <div className="relative z-10 space-y-4">
              {/* Icon and heading */}
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-full shadow-lg ${w.iconBox}`}
                >
                  <w.icon className="h-5 w-5" />
                </div>

                <h3 className="text-2xl font-extrabold tracking-tight text-stone-900">
                  {w.title}
                </h3>
              </div>

              {/* Description */}
              <p className="max-w-sm text-sm leading-relaxed text-stone-600">
                {w.description}
              </p>

              {/* Features list */}
              <ul className="space-y-2 text-sm font-medium text-stone-700">
                {w.bullets.map((b) => (
                  <li key={b} className="flex items-center gap-2.5">
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-white ${w.check}`}
                    >
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    {b}
                  </li>
                ))}
              </ul>

              {/* CTA button */}
              <Link
                href={w.href}
                className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold shadow-sm transition-colors ${w.button}`}
              >
                {w.cta}
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </div>

            {/* Illustration */}
            <div className="relative z-10 hidden shrink-0 pr-2 sm:block">
              {w.art}
            </div>
          </div>
        </Reveal>
      ))}
    </section>
  );
}