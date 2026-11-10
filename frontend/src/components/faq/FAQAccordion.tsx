"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { faqs, type FAQ } from "@/data/faqs";
import Reveal from "@/components/ui/Reveal";

type FAQAccordionProps = {
  items?: FAQ[];
  limit?: number;
};

const faqImages = [
  "/images/img1.jpg",
  "/images/img2.jpg",
  "/images/img3.jpg",
  "/images/img4.jpg",
];

export default function FAQAccordion({
  items = faqs,
  limit,
}: FAQAccordionProps) {
  const visibleItems =
    typeof limit === "number" ? items.slice(0, limit) : items;

  if (!visibleItems.length) {
    return (
      <p className="w-full py-5 text-sm text-stone-500">
        No FAQs available yet. Please check your FAQ data.
      </p>
    );
  }

  return (
    <section className="w-full">
      <div className="flex w-full flex-col items-stretch gap-7 lg:flex-row lg:gap-12">

        {/* LEFT SIDE - VERTICAL FAQ CARDS */}
        <div className="flex w-full flex-col gap-4 lg:w-1/2">
          {visibleItems.map((faq, index) => (
            <Reveal
              key={`${faq.question}-${index}`}
              direction="up"
              delay={index * 0.08}
              duration={0.6}
            >
              <div
                className="relative isolate flex h-[130px] w-full flex-col justify-center overflow-hidden rounded-2xl bg-[#111827] shadow-md transition duration-300 hover:-translate-y-1 hover:shadow-xl"
                style={{
                  backgroundImage: `
                    linear-gradient(
                      135deg,
                      rgba(7,13,30,0.82),
                      rgba(7,13,30,0.55)
                    ),
                    url("${faqImages[index % faqImages.length]}")
                  `,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              >
                <div className="flex flex-col justify-center px-5 py-3">
                  <h3 className="line-clamp-1 text-base font-bold leading-snug text-white">
                    {faq.question}
                  </h3>

                  <p className="mt-2 line-clamp-2 text-[13px] leading-5 text-white/90">
                    {faq.answer}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* RIGHT SIDE - CONTENT */}
        <div className="flex w-full flex-col justify-center lg:w-1/2">

          <Reveal direction="up">
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[#52627d]">
              Common Questions
            </p>
          </Reveal>

          <Reveal direction="up" delay={0.1}>
            <h2 className="text-3xl font-extrabold leading-tight tracking-tight text-[#111827] sm:text-4xl lg:text-5xl">
              Before you
              <span className="block text-[#8496b1]">
                get started.
              </span>
            </h2>
          </Reveal>

          <Reveal direction="up" delay={0.2}>
            <p className="mt-4 max-w-lg text-sm leading-6 text-[#53647e] sm:text-base">
              Find answers to common questions about MindMark,
              quizzes, your account, and how to get started.
            </p>
          </Reveal>

          <Reveal direction="up" delay={0.3}>
            <Link
              href="/faqs"
              className="mt-6 inline-flex w-fit items-center gap-2 rounded-full border border-[#ccd5e4] bg-white px-6 py-3 text-sm font-bold text-[#111827] shadow-sm transition hover:border-[#111827] hover:bg-[#111827] hover:text-white"
            >
              View All FAQs
              <ArrowRight size={17} />
            </Link>
          </Reveal>

        </div>
      </div>
    </section>
  );
}