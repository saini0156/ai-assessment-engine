"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Lock, Mail, User } from "lucide-react";
import { apiClient } from "@/lib/api";
import { saveSession } from "@/lib/session";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthField } from "@/components/auth/AuthField";
import { GoogleButton } from "@/components/auth/GoogleButton";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Your password needs at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }

    setLoading(true);
    try {
      const data = await apiClient.signup({
        name: name.trim(),
        email: email.trim(),
        password,
      });
      saveSession(data);
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Could not create your account. Please try again.");
      setLoading(false);
    }
  };

  return (
    <AuthShell
      image="/images/auth-bg2.jpg"
      headline="Start practising smarter."
      text="Create your account to turn syllabus topics into quizzes, see your score right away and learn from every mistake with the AI tutor."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <h2 className="text-4xl font-extrabold tracking-tight text-black">Sign up</h2>
          <p className="mt-2 text-stone-600">Create your account in less than a minute.</p>
        </div>

        <GoogleButton
          label="Sign up with Google"
          onClick={() => setError("Google sign-in isn't connected yet.")}
        />

        <div className="flex items-center gap-4 text-xs text-stone-500">
          <span className="h-px flex-1 bg-stone-200" />
          or sign up with email
          <span className="h-px flex-1 bg-stone-200" />
        </div>

        <AuthField
          id="name"
          label="Full name"
          value={name}
          onChange={setName}
          icon={User}
          placeholder="Your name"
          autoComplete="name"
        />

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
          placeholder="At least 8 characters"
          autoComplete="new-password"
          minLength={8}
        />

        <AuthField
          id="confirm"
          label="Confirm password"
          type="password"
          value={confirm}
          onChange={setConfirm}
          icon={Lock}
          placeholder="Re-enter your password"
          autoComplete="new-password"
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
              Creating account...
            </>
          ) : (
            <>
              Create account
              <ArrowRight className="h-5 w-5" />
            </>
          )}
        </button>

        <p className="text-center text-sm text-stone-600">
          Already have an account?{" "}
          <Link href="/login" className="font-bold text-black hover:underline">
            Log in
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