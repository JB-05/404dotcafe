"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { login } from "@/lib/api";
import { roleHome, setSession } from "@/lib/auth";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await login(email.trim(), password);
      setSession({
        access_token: res.access_token,
        role: res.role,
        name: res.name,
      });
      const dest = next || roleHome(res.role);
      router.push(dest);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="paper-card p-8 w-full max-w-sm">
        <h1 className="font-[family-name:var(--font-bebas)] text-3xl text-center">STAFF LOGIN</h1>
        <p className="mt-1 text-center text-sm opacity-70">404 Café · CafeOS</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-xs opacity-70">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded border border-black/20 bg-white/50 px-3 py-2 text-sm text-[var(--color-ink)]"
              placeholder="staff@404cafe.in"
            />
          </div>
          <div>
            <label className="text-xs opacity-70">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded border border-black/20 bg-white/50 px-3 py-2 text-sm text-[var(--color-ink)]"
            />
          </div>

          {error && <p className="text-sm text-red-700">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-[var(--color-ink)] text-white py-2.5 font-medium disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <Link href="/menu" className="mt-4 block text-center text-xs text-white/50 hover:text-white/80">
          ← Customer menu
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-white/70">Loading…</div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
