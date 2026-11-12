"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, LayoutDashboard, LogOut } from "lucide-react";
import { getSession, clearSession } from "@/lib/session";
import type { AuthUser } from "@/types";

export default function UserMenu() {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  // Read the session after mount (avoids hydration mismatch)
  useEffect(() => {
    setUser(getSession()?.user ?? null);
  }, []);

  // Close when clicking outside
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!user) {
    return (
      <Link
        href="/login"
        className="rounded-full bg-black px-5 py-2 text-sm font-semibold text-white"
      >
        Login
      </Link>
    );
  }

  const logout = () => {
    clearSession();
    setUser(null);
    setOpen(false);
    router.replace("/login");
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2.5 rounded-full border border-neutral-200 bg-white py-1.5 pl-1.5 pr-3 transition hover:border-neutral-400"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-sm font-bold text-white">
          {user.name.charAt(0).toUpperCase()}
        </span>
        <span className="text-sm font-semibold text-neutral-900">{user.name}</span>
        <ChevronDown
          className={`h-4 w-4 text-neutral-500 transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-lg">
          {user.role === "admin" && (
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
            >
              <LayoutDashboard className="h-4 w-4" />
              Admin Dashboard
            </Link>
          )}
          <button
            onClick={logout}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}