"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowUp,
  GraduationCap,
  Home,
  ListChecks,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const links = [
  { href: "/", label: "Home" },
  { href: "/quiz/new", label: "Quiz" },
  { href: "/admin", label: "Admin" },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
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

  // Hidden on the quiz builder (/quiz/new) and the test player (/quiz/<id>)
  if (/^\/quiz\/[^/]+$/.test(pathname)) return null;

  // Desktop only: transparent on home before scrolling
  const transparent = isHome && !scrolled;

  // Mobile: header is NOT sticky. Absolute on home (floats over hero), relative elsewhere.
  // sm and up: fixed on home, sticky elsewhere.
  const position = isHome ? "absolute sm:fixed" : "relative sm:sticky";

  const surface = !isHome
    ? "border-b border-stone-200 bg-white/90 backdrop-blur-md sm:shadow-sm"
    : transparent
      ? "border-b border-transparent bg-transparent"
      : "border-b border-transparent bg-transparent sm:border-stone-200 sm:bg-white/90 sm:shadow-sm sm:backdrop-blur-md";

  // On home mobile the logo is always white (it sits on the hero image)
  const logoColor = !isHome
    ? "text-stone-900"
    : transparent
      ? "text-white"
      : "text-white sm:text-stone-900";

  const logoAccent = !isHome
    ? "text-stone-500"
    : transparent
      ? "text-white/70"
      : "text-white/70 sm:text-stone-500";

  const scrollTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  const goToHighlights = () => {
    if (pathname === "/") {
      const el = document.getElementById("highlights");
      if (el) {
        const top = el.getBoundingClientRect().top + window.scrollY - 16;
        window.scrollTo({ top, behavior: "smooth" });
      }
    } else {
      router.push("/#highlights");
    }
  };

  return (
    <>
      {/* Top header */}
      <header
        className={`${position} inset-x-0 top-0 z-50 w-full transition-all duration-300 ${surface}`}
      >
        <div className="flex h-16 w-full items-center justify-between px-4 sm:px-8 lg:px-12">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <GraduationCap className={`h-8 w-8 transition-colors ${logoColor}`} />
            <span className={`font-serif text-xl font-bold transition-colors ${logoColor}`}>
              Quiz<span className={logoAccent}>Pro</span>
            </span>
          </Link>

          {/* Desktop links */}
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

          {/* Desktop CTA */}
          <Link
            href="/quiz/new"
            className={`hidden items-center gap-2 rounded-full px-5 py-2.5 text-lg font-semibold transition-colors sm:inline-flex ${
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

      {/* Mobile bottom nav: floating pill */}
      <nav
        aria-label="Primary"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden"
      >
        <ul className="pointer-events-auto mx-auto grid h-16 max-w-md grid-cols-5 items-center rounded-3xl bg-stone-950/95 px-1 shadow-2xl shadow-black/30 ring-1 ring-white/10 backdrop-blur-xl">
          <NavItem href="/" label="Home" icon={Home} active={isActive("/")} />

          <NavButton label="Highlights" icon={Sparkles} onClick={goToHighlights} />

          {/* Center: main action */}
          <li className="flex justify-center">
            <Link
              href="/quiz/new"
              aria-label="Take a quiz"
              aria-current={isActive("/quiz/new") ? "page" : undefined}
              className="-mt-6 flex flex-col items-center gap-1"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500 text-black shadow-[0_8px_20px_rgba(245,158,11,0.45)] ring-4 ring-stone-950 transition-transform active:scale-95">
                <ListChecks className="h-7 w-7" />
              </span>
              <span className="text-[10px] font-semibold text-white">Quiz</span>
            </Link>
          </li>

          <NavItem
            href="/admin"
            label="Upload"
            icon={ShieldCheck}
            active={isActive("/admin")}
          />

          {/* Back to top */}
          <NavButton label="Top" icon={ArrowUp} onClick={scrollTop} />
        </ul>
      </nav>
    </>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <li className="flex justify-center">
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className="relative flex flex-col items-center gap-1 py-2"
      >
        <Icon className={`h-5 w-5 transition-colors ${active ? "text-white" : "text-stone-400"}`} />
        <span
          className={`whitespace-nowrap text-[10px] font-medium transition-colors ${
            active ? "text-white" : "text-stone-400"
          }`}
        >
          {label}
        </span>
        {active && (
          <span className="absolute -top-0.5 h-1 w-1 rounded-full bg-amber-500" />
        )}
      </Link>
    </li>
  );
}

function NavButton({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}) {
  return (
    <li className="flex justify-center">
      <button
        type="button"
        onClick={onClick}
        className="relative flex flex-col items-center gap-1 py-2 text-stone-400 transition-colors active:text-white"
      >
        <Icon className="h-5 w-5" />
        <span className="whitespace-nowrap text-[10px] font-medium">{label}</span>
      </button>
    </li>
  );
}