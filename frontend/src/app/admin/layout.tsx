"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  LayoutDashboard,
  Users,
  UploadCloud,
  Library,
  Loader2,
} from "lucide-react";
import { getSession } from "@/lib/session";

const links = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/upload-pdf", label: "Upload PDF", icon: UploadCloud },
  { href: "/admin/subjects", label: "Subjects", icon: Library },
];

// Same black logo your Navbar uses
const LOGO_SRC = "/images/logoblack.png";

function Logo() {
  return (
    <Link href="/" className="inline-flex items-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={LOGO_SRC} alt="MindMark" className="h-12 w-auto rounded-lg object-contain" />
    </Link>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);

  // Session lives in the browser, so check it after mount
  useEffect(() => {
    const session = getSession();
    if (!session) router.replace("/login");
    else if (session.user?.role !== "admin") router.replace("/");
    else setAllowed(true);
  }, [router]);

  if (!allowed) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-500" />
      </div>
    );
  }

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <div className="flex min-h-dvh flex-col bg-neutral-50 md:flex-row">
      {/* ---------- Desktop sidebar ---------- */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-neutral-200 bg-white md:flex">
        <div className="border-b border-neutral-200 px-6 py-5">
          <Logo />
        </div>

        <nav className="flex-1 space-y-1.5 overflow-y-auto p-5">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-[15px] font-semibold transition ${
                isActive(href) ? "bg-black text-white" : "text-neutral-700 hover:bg-neutral-100"
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-neutral-200 p-5">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-xl border border-neutral-300 px-4 py-3 text-[15px] font-semibold text-neutral-800 transition hover:border-neutral-900 hover:bg-neutral-100"
          >
            <ArrowLeft className="h-5 w-5" />
            Back to website
          </Link>
        </div>
      </aside>

      {/* ---------- Mobile: top bar + tabs ---------- */}
      <div className="border-b border-neutral-200 bg-white md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Logo />
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 px-3.5 py-2 text-sm font-semibold text-neutral-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to website
          </Link>
        </div>
        <nav className="flex gap-2 overflow-x-auto px-3 pb-3">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
                isActive(href) ? "bg-black text-white" : "bg-neutral-100 text-neutral-700"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
      </div>

      <main className="min-w-0 flex-1 p-4 sm:p-8">{children}</main>
    </div>
  );
}