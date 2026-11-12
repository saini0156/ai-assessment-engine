"use client";

import { usePathname } from "next/navigation";

// Hides its children (Navbar / Footer) on every /admin page
export function HideOnAdmin({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;
  return <>{children}</>;
}

// Same <main> as before for the website; no padding on admin pages
export function PageMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");

  return (
    <main
      className={
        isAdmin
          ? "flex-1"
          : "mx-auto max-w-full flex-1 px-4 py-6 pb-28 sm:px-6 sm:pb-6 lg:px-8"
      }
    >
      {children}
    </main>
  );
}