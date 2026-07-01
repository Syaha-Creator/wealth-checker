"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signUp, useSession } from "@/lib/auth-client";

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: "Min. 8 karakter", ok: password.length >= 8 },
    { label: "Huruf besar", ok: /[A-Z]/.test(password) },
    { label: "Angka", ok: /[0-9]/.test(password) },
  ];
  const score = checks.filter((c) => c.ok).length;
  const colors = ["", "bg-red-500", "bg-yellow-500", "bg-emerald-500"];

  if (!password) return null;
  return (
    <div className="mt-1.5 space-y-1.5">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < score ? colors[score] : "bg-slate-700"
            }`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {checks.map((c) => (
          <span key={c.label} className={`text-xs ${c.ok ? "text-emerald-400" : "text-slate-600"}`}>
            {c.ok ? "✓" : "·"} {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Sudah login? langsung redirect
  useEffect(() => {
    if (!isPending && session) {
      router.replace("/onboarding");
    }
  }, [session, isPending, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password.length < 8) {
      setError("Password minimal 8 karakter.");
      setLoading(false);
      return;
    }

    const { error: err } = await signUp.email({
      name,
      email,
      password,
      callbackURL: "/dashboard",
    });

    if (err) {
      if (err.code === "USER_ALREADY_EXISTS") {
        setError("Email ini sudah terdaftar. Coba masuk.");
      } else {
        setError(err.message ?? "Gagal mendaftar. Coba lagi.");
      }
      setLoading(false);
      return;
    }

    router.push("/onboarding");
    router.refresh();
  }

  if (isPending || session) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-emerald-950 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 justify-center">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center text-slate-950 font-bold text-lg">
              W
            </div>
            <span className="text-xl font-semibold text-white">WealthChecker</span>
          </Link>
          <p className="mt-2 text-slate-400 text-sm">Buat akun baru — gratis selamanya</p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-lg" role="alert">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="shrink-0 mt-0.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span>{error}</span>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="name" className="text-sm font-medium text-slate-300">
                Nama Lengkap
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama kamu"
                autoComplete="name"
                required
                className="bg-slate-900/60 border border-slate-700 text-white placeholder-slate-500 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-medium text-slate-300">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="kamu@email.com"
                autoComplete="email"
                required
                className="bg-slate-900/60 border border-slate-700 text-white placeholder-slate-500 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium text-slate-300">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 karakter"
                autoComplete="new-password"
                required
                className="bg-slate-900/60 border border-slate-700 text-white placeholder-slate-500 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all"
              />
              <PasswordStrength password={password} />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-1 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-semibold py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                  Mendaftar...
                </>
              ) : (
                "Daftar Sekarang"
              )}
            </button>
          </form>

          <p className="text-center text-slate-500 text-xs mt-4">
            Dengan mendaftar, kamu menyetujui penggunaan data untuk layanan ini.
          </p>
        </div>

        <p className="text-center text-slate-500 text-sm mt-5">
          Sudah punya akun?{" "}
          <Link href="/auth/login" className="text-emerald-400 hover:text-emerald-300 font-medium">
            Masuk
          </Link>
        </p>
      </div>
    </div>
  );
}
