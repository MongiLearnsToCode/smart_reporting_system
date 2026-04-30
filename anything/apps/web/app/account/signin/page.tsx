'use client';

import { useState } from "react";
import useAuth from "@/utils/useAuth";
import Link from 'next/link';

export default function SignInPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const { signInWithCredentials } = useAuth();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!email || !password) {
      setError("Please fill in all fields");
      setLoading(false);
      return;
    }

    try {
      await (signInWithCredentials as any)({
        email,
        password,
        callbackUrl: "/",
        redirect: true,
      });
    } catch (err: any) {
      const errorMessages: Record<string, string> = {
        OAuthSignin:
          "Couldn't start sign-in. Please try again or use a different method.",
        OAuthCallback: "Sign-in failed after redirecting. Please try again.",
        CredentialsSignin:
          "Incorrect email or password. Try again or reset your password.",
      };
      setError(
        errorMessages[err.message] || err.message || "Something went wrong. Please try again.",
      );
      setLoading(false);
    }
  };

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
            Welcome back to your living report.
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
            {loading ? "Loading..." : "Sign In"}
          </button>

          <p className="text-center text-sm text-zinc-500">
            New here?{" "}
            <Link href="/account/signup" className="text-white hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}
