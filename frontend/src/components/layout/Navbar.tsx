"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, GraduationCap } from "lucide-react";

const links = [
  { href: "/", label: "Home" },
  { href: "/quiz/new", label: "Quiz" },
  { href: "/admin", label: "Admin" },
];

export function Navbar() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href === "/quiz/new" ? "/quiz" : href);

  // Transparent (white text) only on the home page, before scrolling
  const transparent = isHome && !scrolled;
    // Hidden on the quiz builder (/quiz/new) and the test player (/quiz/<id>)
  if (/^\/quiz\/[^/]+$/.test(pathname)) return null;

  

  return (
    <header
      className={`${isHome ? "fixed" : "sticky"} inset-x-0 top-0 z-50 w-full transition-all duration-300 ${
        transparent
          ? "border-b border-transparent bg-transparent"
          : "border-b border-stone-200 bg-white/90 shadow-sm backdrop-blur-md"
      }`}
    >
      <div className="flex h-16 w-full items-center justify-between px-4 sm:px-8 lg:px-12">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <GraduationCap
            className={`h-8 w-8 transition-colors ${transparent ? "text-white" : "text-stone-900"}`}
          />
          <span
            className={`font-serif text-xl font-bold transition-colors ${
              transparent ? "text-white" : "text-stone-900"
            }`}
          >
            Quiz
            <span className={transparent ? "text-white/70" : "text-stone-500"}>Pro</span>
          </span>
        </Link>

        {/* Links */}
        <nav className="hidden h-full items-center gap-8 sm:flex">
          {links.map((l) => {
            const active = isActive(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`flex h-full items-center border-b-2 text-lg font-medium transition-colors ${
                  transparent
                    ? active
                      ? "border-white text-white"
                      : "border-transparent text-white/80 hover:text-white"
                    : active
                      ? "border-black text-black"
                      : "border-transparent text-stone-600 hover:text-black"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        {/* CTA */}
        <Link
          href="/quiz/new"
          className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-lg font-semibold transition-colors ${
            transparent
              ? "bg-white text-black hover:bg-stone-100"
              : "bg-black text-white hover:bg-stone-800"
          }`}
        >
          Take a Quiz
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </header>
  );
}