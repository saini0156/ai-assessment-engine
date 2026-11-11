"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Lock, Mail } from "lucide-react";
import { apiClient } from "@/lib/api";
import { saveSession } from "@/lib/session";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthField } from "@/components/auth/AuthField";
import { GoogleButton } from "@/components/auth/GoogleButton";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = await apiClient.login({ email: email.trim(), password });
      saveSession(data);
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Could not log you in. Please try again.");
      setLoading(false);
    }
  };

  return (
    <AuthShell
      headline="Welcome back."
      text="Log in to practise your topics, take timed quizzes and get instant help from the AI tutor."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <h2 className="text-4xl font-extrabold tracking-tight text-black">Log in</h2>
          <p className="mt-2 text-stone-600">Welcome back. Enter your details to continue.</p>
        </div>

        <GoogleButton
          label="Continue with Google"
          onClick={() => setError("Google sign-in isn't connected yet.")}
        />

        <div className="flex items-center gap-4 text-xs text-stone-500">
          <span className="h-px flex-1 bg-stone-200" />
          or log in with email
          <span className="h-px flex-1 bg-stone-200" />
        </div>

        <AuthField
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          icon={Mail}
          placeholder="you@example.com"
          autoComplete="email"
        />

        <AuthField
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          icon={Lock}
          placeholder="Enter your password"
          autoComplete="current-password"
        />

        {error && (
          <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2.5 rounded-md bg-black py-4 text-base font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Logging in...
            </>
          ) : (
            <>
              Log in
              <ArrowRight className="h-5 w-5" />
            </>
          )}
        </button>

        <p className="text-center text-sm text-stone-600">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-bold text-black hover:underline">
            Sign up
          </Link>
        </p>

        <p className="text-center">
          <Link href="/" className="text-sm text-stone-500 transition hover:text-black">
            Continue browsing as guest
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}