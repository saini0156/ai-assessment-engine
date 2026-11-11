
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Search, ChevronDown } from "lucide-react";
import { faqs } from "@/data/faqs";

export default function FAQPage() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const categories = [
    "All",
    ...Array.from(new Set(faqs.map((faq) => faq.category))),
  ];

  const filteredFAQs = useMemo(() => {
    return faqs.filter((faq) => {
      const matchesCategory =
        activeCategory === "All" || faq.category === activeCategory;

      const matchesSearch =
        faq.question.toLowerCase().includes(search.toLowerCase()) ||
        faq.answer.toLowerCase().includes(search.toLowerCase());

      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, search]);

  return (
    <main className="min-h-screen bg-white text-stone-900">
      <section className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        <Link
          href="/"
          className="mb-10 inline-flex text-sm font-medium text-stone-500 transition hover:text-black"
        >
          ← Back to home
        </Link>

        <div className="border-b border-stone-200 pb-10">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
            Help Center
          </p>

          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Frequently Asked Questions
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-7 text-stone-600">
            Find answers to common questions about MindMark, quizzes,
            your account, and how to get started.
          </p>

          <div className="relative mt-8 max-w-xl">
            <Search
              size={19}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setOpenIndex(null);
              }}
              placeholder="Search your question..."
              className="h-12 w-full rounded-xl border border-stone-200 bg-stone-50 pl-11 pr-4 text-sm outline-none transition placeholder:text-stone-400 focus:border-stone-400 focus:bg-white"
            />
          </div>
        </div>

        <div className="py-8">
          {/* Category Filters */}
          <div className="mb-7 flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => {
                  setActiveCategory(category);
                  setOpenIndex(null);
                }}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  activeCategory === category
                    ? "bg-stone-900 text-white"
                    : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          {/* FAQ List */}
          {filteredFAQs.length > 0 ? (
            <div className="space-y-3">
              {filteredFAQs.map((faq, index) => {
                const isOpen = openIndex === index;

                return (
                  <div
                    key={`${faq.category}-${faq.question}`}
                    className={`overflow-hidden rounded-xl border transition-colors ${
                      isOpen
                        ? "border-stone-300 bg-stone-50"
                        : "border-stone-200 bg-white"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setOpenIndex(isOpen ? null : index)
                      }
                      aria-expanded={isOpen}
                      className="flex w-full items-center justify-between gap-5 px-5 py-5 text-left sm:px-6"
                    >
                      <span className="text-base font-semibold leading-6 text-stone-900">
                        {faq.question}
                      </span>

                      <ChevronDown
                        size={19}
                        className={`shrink-0 text-stone-500 transition-transform duration-300 ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    <div
                      className={`grid transition-all duration-300 ease-in-out ${
                        isOpen
                          ? "grid-rows-[1fr] opacity-100"
                          : "grid-rows-[0fr] opacity-0"
                      }`}
                    >
                      <div className="overflow-hidden">
                        <div className="border-t border-stone-200 px-5 py-5 text-sm leading-7 text-stone-600 sm:px-6">
                          {faq.answer}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-stone-200 px-6 py-12 text-center">
              <h2 className="font-semibold text-stone-900">
                No questions found
              </h2>

              <p className="mt-2 text-sm text-stone-500">
                Try another search term or select a different category.
              </p>

              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setActiveCategory("All");
                  setOpenIndex(0);
                }}
                className="mt-5 text-sm font-semibold text-stone-900 underline underline-offset-4"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>

        {/* Contact Support */}
        <div className="mt-10 rounded-2xl bg-stone-50 p-7 sm:p-9">
          <h2 className="text-xl font-semibold tracking-tight">
            Still have questions?
          </h2>

          <p className="mt-2 text-sm leading-6 text-stone-600">
            Can't find the answer you're looking for? Get in touch
            with our support team.
          </p>

          <a
            href="mailto:[YOUR SUPPORT EMAIL]"
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-stone-900 transition hover:text-stone-600"
          >
            Contact support <ArrowRight size={16} />
          </a>
        </div>

        {/* Footer Links */}
        <div className="mt-12 border-t border-stone-200 pt-7">
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-stone-500">
            <Link href="/privacy-policy" className="hover:text-black">
              Privacy Policy
            </Link>

            <Link href="/terms" className="hover:text-black">
              Terms & Conditions
            </Link>

            <Link href="/cookie-policy" className="hover:text-black">
              Cookie Policy
            </Link>

            <Link href="/" className="hover:text-black">
              Home
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
