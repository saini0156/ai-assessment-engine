
import Link from "next/link";
import { ArrowRight, Upload } from "lucide-react";

export function CtaSection() {
  return (
    <section className="relative isolate flex min-h-[380px] items-center justify-center overflow-hidden rounded-3xl bg-[url('/images/banner.jpg')] bg-cover bg-center px-6 py-16 text-white sm:px-12">

      {/* Dark Overlay */}
      <div className="absolute inset-0 -z-10 bg-black/60" />

      <div className="mx-auto max-w-3xl text-center">
        <span className="mb-5 block text-xs font-bold uppercase tracking-[0.2em] text-white/90">
          Get Started
        </span>

        <h2 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
          Ready to test your knowledge?
        </h2>

        <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-white/80 sm:text-base">
          Start a quiz now, or upload a syllabus to build your own
          question bank and make learning more effective.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/quiz/new"
            className="inline-flex items-center gap-3 rounded-full bg-white px-7 py-4 text-sm font-semibold text-gray-950 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:bg-gray-100"
          >
            Take a Practice Quiz
            <ArrowRight className="h-4 w-4" />
          </Link>

          <Link
            href="/admin"
            className="inline-flex items-center gap-3 rounded-full border border-white/60 bg-white/10 px-7 py-4 text-sm font-semibold text-white backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:bg-white/20"
          >
            <Upload className="h-4 w-4" />
            Upload Syllabus
          </Link>
        </div>
      </div>
    </section>
  );
}
