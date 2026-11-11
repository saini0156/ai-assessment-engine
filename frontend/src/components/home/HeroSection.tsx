import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { QuizPreviewCard } from "@/components/home/QuizPreviewCard";
import Reveal from "@/components/ui/Reveal";

export function HeroSection() {
  return (
    <section className="relative -mx-4 -mt-6 min-h-screen overflow-hidden bg-[#e6e0da] sm:-mx-8 lg:-mx-12">
      {/* Full background image */}
      <Image
        src="/images/hero-bg.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-right-top transition-transform duration-500 group-hover:scale-105"
      />

      {/* Keeps the left text readable */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/10 to-transparent" />

      <div className="relative z-10 mx-auto grid min-h-screen w-full items-center gap-10 px-4 pb-16 pt-16 sm:px-8 lg:grid-cols-[1.3fr_1fr] lg:px-12">
        {/* Left: text */}
        <div className="space-y-7">
          <Reveal direction="up" duration={0.7}>
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-stone-900 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-black" />
              Quiz practice for students and teachers
            </span>
          </Reveal>

          <Reveal direction="up" delay={0.1} duration={0.8}>
            <h1 className="text-5xl font-black uppercase leading-[0.95] tracking-tighter text-white sm:text-6xl lg:text-7xl xl:text-8xl">
              Turn your
              <br />
              syllabus into
              <br />
              practice <span className="text-amber-500">quizzes.</span>
            </h1>
          </Reveal>

          <Reveal direction="up" delay={0.2}>
            <p className="max-w-xl text-lg leading-relaxed text-gray-50">
              Upload a syllabus PDF and get multiple-choice questions on every
              topic. When you get one wrong, you get a short, plain explanation
              of why.
            </p>
          </Reveal>

          <Reveal direction="up" delay={0.3}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Link
                href="/quiz/new"
                className="inline-flex items-center justify-center gap-3 rounded-full bg-black px-8 py-5 text-base font-semibold text-white transition-colors hover:bg-stone-800"
              >
                Take a practice quiz
                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                href="/admin"
                className="inline-flex items-center justify-center gap-3 rounded-full bg-white px-8 py-5 text-base font-semibold text-black transition-colors hover:bg-stone-50"
              >
                <BookOpen className="h-4 w-4" />
                I&apos;m a teacher
              </Link>
            </div>
          </Reveal>
        </div>

        {/* Right: quiz preview */}
        <Reveal direction="up" delay={0.2}>
          <div className="hidden lg:flex lg:justify-end">
            <QuizPreviewCard />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
