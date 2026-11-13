"use client";

import { useEffect, useRef, useState } from "react";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const SCRIPT_SRC = "https://accounts.google.com/gsi/client";

declare global {
  interface Window {
    google?: any;
  }
}

// Load Google's script once for the whole app
let scriptPromise: Promise<void> | null = null;

function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null; // allow a retry later
      script.remove();
      reject(new Error("Failed to load Google script"));
    };
    document.head.appendChild(script);
  });

  return scriptPromise;
}

// Google wants initialize() called once, so the page-specific handler is swapped in here
let initialized = false;
let activeHandler: ((credential: string) => void) | null = null;

function initGoogle() {
  if (initialized) return;
  window.google.accounts.id.initialize({
    client_id: CLIENT_ID,
    callback: (response: { credential?: string }) => {
      if (response.credential) activeHandler?.(response.credential);
    },
  });
  initialized = true;
}

interface GoogleButtonProps {
  text: "signin_with" | "signup_with" | "continue_with";
  onCredential: (credential: string) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}

export function GoogleButton({ text, onCredential, onError, disabled }: GoogleButtonProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLDivElement>(null);
  const onErrorRef = useRef(onError);
  const [ready, setReady] = useState(false);
  const [width, setWidth] = useState(0);

  onErrorRef.current = onError;

  // Keep the latest handler from the page
  useEffect(() => {
    activeHandler = onCredential;
    return () => {
      if (activeHandler === onCredential) activeHandler = null;
    };
  }, [onCredential]);

  // Load Google's script
  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;

    loadGoogleScript()
      .then(() => {
        if (cancelled) return;
        initGoogle();
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          onErrorRef.current("Couldn't load Google sign-in. Check your connection and try again.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Track the available width (Google's button needs a pixel width)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setWidth(Math.round(el.getBoundingClientRect().width));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Draw Google's official button
  useEffect(() => {
    if (!ready || !btnRef.current || width === 0) return;
    btnRef.current.innerHTML = "";
    window.google.accounts.id.renderButton(btnRef.current, {
      type: "standard",
      theme: "outline",
      size: "large",
      text,
      shape: "rectangular",
      logo_alignment: "center",
      width: Math.min(400, Math.max(200, width)), // Google allows 200 to 400
    });
  }, [ready, width, text]);

  if (!CLIENT_ID) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        Google sign-in isn&apos;t set up. Add NEXT_PUBLIC_GOOGLE_CLIENT_ID to .env.local and
        restart the dev server.
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative w-full">
      <div
        ref={btnRef}
        className={`flex min-h-[44px] w-full justify-center rounded-md ${
          ready ? "" : "animate-pulse bg-stone-100"
        }`}
      />
      {disabled && (
        <div className="absolute inset-0 z-10 cursor-not-allowed rounded-md bg-white/60" />
      )}
    </div>
  );
}