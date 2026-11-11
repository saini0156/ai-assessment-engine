"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, GraduationCap } from "lucide-react";

const footerLinks = [
  { href: "/", label: "Home" },
  { href: "/quiz/new", label: "Practice Quiz" },
  { href: "/admin", label: "Admin" },
  { href: "/faq", label: "FAQ" },
];

export function Footer() {
  const pathname = usePathname();

  // The quiz builder is a full-screen page with no footer
  if (pathname === "/quiz/new") return null;

  return (
    <footer className="border-t border-stone-200 bg-stone-50">
      <div className="mx-auto max-w-full px-6 py-12 sm:px-8 lg:px-12">
        {/* Main Footer */}
        <div className="flex flex-col justify-between gap-10 md:flex-row md:items-start">
          {/* Brand */}
          <div className="max-w-sm">
            <Link href="/" className="inline-flex items-center gap-2">
              <GraduationCap className="h-8 w-8 text-stone-900" />
              <span className="font-serif text-2xl font-bold text-stone-900">
                Mind<span className="text-stone-500">Mark</span>
              </span>
            </Link>

            <p className="mt-4 text-sm leading-7 text-stone-500">
              Make learning smarter with interactive quizzes. Test your
              knowledge, practice regularly, and track your learning journey.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="mb-5 text-sm font-semibold uppercase tracking-wider text-stone-900">
              Quick Links
            </h3>

            <ul className="space-y-3">
              {footerLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="group inline-flex items-center gap-1 text-sm text-stone-500 transition-colors hover:text-black"
                  >
                    {link.label}
                    <ArrowUpRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Get Started */}
          <div>
            <h3 className="mb-5 text-sm font-semibold uppercase tracking-wider text-stone-900">
              Get Started
            </h3>

            <p className="mb-4 max-w-xs text-sm leading-6 text-stone-500">
              Ready to challenge yourself? Start your next quiz today.
            </p>

            <Link
              href="/quiz/new"
              className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-stone-800"
            >
              Take a Quiz
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-stone-200 pt-6 sm:flex-row">
          <p className="text-xs text-stone-500">
            © {new Date().getFullYear()} MindMark. All rights reserved.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-5">
            <Link
              href="/privacy-policy"
              className="text-xs text-stone-500 transition-colors hover:text-black"
            >
              Privacy Policy
            </Link>

            <Link
              href="/terms"
              className="text-xs text-stone-500 transition-colors hover:text-black"
            >
              Terms &amp; Conditions
            </Link>

            <Link
              href="/cookie-policy"
              className="text-xs text-stone-500 transition-colors hover:text-black"
            >
              Cookie Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}