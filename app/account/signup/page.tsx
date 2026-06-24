'use client';

import { useState } from "react";
import useAuth from "@/utils/useAuth";
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function SignUpPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  const { signUpWithCredentials } = useAuth();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!email || !password) {
      setError("Please fill in all fields");
      setLoading(false);
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      setLoading(false);
      return;
    }
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setError("Password must contain at least one letter and one number");
      setLoading(false);
      return;
    }

    try {
      const result = await (signUpWithCredentials as any)({
        email,
        password,
        callbackUrl: "/",
      });
      if (result?.emailConfirmationRequired) {
        setEmailSent(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-zinc-950 p-4 font-sans text-zinc-100">
        <div className="w-full max-w-md space-y-8 rounded-3xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl text-center">
          <h1 className="text-4xl font-black tracking-tighter text-white">CODEX</h1>
          <div className="space-y-4">
            <div className="mx-auto h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <svg className="h-6 w-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h2 className="text-xl font-bold text-white">Check your email</h2>
            <p className="text-zinc-400 text-sm">
              We sent a confirmation link to <strong className="text-white">{email}</strong>.
              Click the link to activate your account, then sign in.
            </p>
            <a href="/account/signin" className="inline-block rounded-xl bg-white px-6 py-3 text-sm font-bold text-black transition-all hover:bg-zinc-200">
              Back to Sign In
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-zinc-950 p-4 font-sans text-zinc-100">
      <form
        noValidate
        onSubmit={onSubmit}
        className="w-full max-w-md space-y-8 rounded-3xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl"
      >
        <div className="text-center">
          <h1 className="text-4xl font-black tracking-tighter text-white">
            CODEX
          </h1>
          <p className="mt-2 text-zinc-400">
            Start your AI-fluid reporting journey.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Email</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white outline-none ring-zinc-700 transition-all focus:ring-1"
              placeholder="name@example.com"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">
              Password
            </label>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white outline-none ring-zinc-700 transition-all focus:ring-1"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-red-500/10 p-3 text-sm text-red-400 border border-red-500/20">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-white px-4 py-3 text-base font-bold text-black transition-all hover:bg-zinc-200 active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {loading ? "Loading..." : "Sign Up"}
          </button>

          <p className="text-center text-sm text-zinc-500">
            Already have an account?{" "}
            <Link href="/account/signin" className="text-white hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}
