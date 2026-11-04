"use client";

import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  FolderOpen,
  ClipboardList,
  SlidersHorizontal,
  Play,
} from "lucide-react";

const steps = [
  {
    icon: BookOpen,
    title: "Subject",
    text: "Choose what you want to practise, like Computer Science.",
    iconBox: "bg-violet-50 border-violet-200 text-violet-700",
    label: "text-violet-700",
    line: "border-violet-300",
  },
  {
    icon: FolderOpen,
    title: "Topic",
    text: "Pick a topic from your syllabus, like OOP.",
    iconBox: "bg-emerald-50 border-emerald-200 text-emerald-700",
    label: "text-emerald-700",
    line: "border-emerald-300",
  },
  {
    icon: ClipboardList,
    title: "Number of Questions",
    text: "Select 3, 5 or 10 questions.",
    iconBox: "bg-orange-50 border-orange-200 text-orange-700",
    label: "text-orange-700",
    line: "border-orange-300",
  },
  {
    icon: SlidersHorizontal,
    title: "Difficulty Level",
    text: "Go with Easy, Medium or Hard.",
    iconBox: "bg-sky-50 border-sky-200 text-sky-700",
    label: "text-sky-700",
    line: "border-sky-300",
  },
  {
    icon: Play,
    title: "Generate & Start Quiz",
    text: "Your timed quiz is built in seconds.",
    iconBox: "bg-indigo-50 border-indigo-200 text-indigo-700",
    label: "text-indigo-700",
    line: "border-indigo-300",
  },
];

const STEP_DELAY = 300;

export function HowItWorksSection() {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  return (
    <section ref={ref} className="space-y-10">
      {/* Heading */}
      <div
        className={`text-center transition-all duration-700 motion-reduce:transition-none ${
          visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
      >
        <h2 className="text-3xl font-extrabold tracking-tight text-stone-900 sm:text-4xl">
          How it works
        </h2>

        <p className="mt-2 text-sm text-stone-500">
          Set up your quiz in five quick steps.
        </p>
      </div>

      {/* Steps */}
      <div className="grid gap-10 pl-10 sm:grid-cols-2 lg:grid-cols-5 lg:gap-6">
        {steps.map((s, i) => (
          <div
            key={s.title}
            style={{
              transitionDelay: visible ? `${i * STEP_DELAY}ms` : "0ms",
            }}
            className={`relative flex gap-5 transition-all duration-700 motion-reduce:transition-none lg:block ${
              visible
                ? "translate-y-0 opacity-100"
                : "translate-y-8 opacity-0"
            }`}
          >
            {/* Colored Outline Icon */}
            <div
              className={`relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border transition-all duration-300 hover:-translate-y-1 hover:shadow-md ${s.iconBox}`}
            >
              <s.icon
                className="h-6 w-6"
                strokeWidth={1.8}
              />
            </div>

            {/* Dashed Connector */}
            {i < steps.length - 1 && (
              <span
                style={{
                  transitionDelay: visible
                    ? `${i * STEP_DELAY + 400}ms`
                    : "0ms",
                }}
                className={`absolute -right-6 left-[4.5rem] top-7 hidden origin-left border-t-2 border-dashed transition-transform duration-700 motion-reduce:transition-none lg:block ${
                  s.line
                } ${visible ? "scale-x-100" : "scale-x-0"}`}
              />
            )}

            {/* Text */}
            <div className="lg:mt-5">
              <p
                className={`text-xs font-bold uppercase tracking-widest ${s.label}`}
              >
                Step {String(i + 1).padStart(2, "0")}
              </p>

              <h3 className="mt-1 text-lg font-extrabold leading-tight tracking-tight text-stone-900">
                {s.title}
              </h3>

              <p className="mt-2 text-sm leading-relaxed text-stone-600">
                {s.text}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}