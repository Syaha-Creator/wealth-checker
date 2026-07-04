"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "@/lib/auth-client";
import { Input, PasswordInput } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { apiFetch } from "@/lib/apiFetch";


// Bug hunt (Issue 1): "sudah onboarding atau belum" dulu ditentukan dari
// GET /api/accounts.length — tidak konsisten dengan definisi dashboard sendiri
// (wealthLevel !== -1, yang juga menghitung aset likuid/tidak lancar/utang).
// User yang cuma mencatat investasi/utang tanpa rekening bank akan terus-menerus
// dilempar ke /onboarding tiap login. Pakai sumber kebenaran yang sama di sini.
async function resolvePostLoginDestination(): Promise<"/onboarding" | "/dashboard"> {
  try {
    const res = await apiFetch(`/api/wealth/summary`, { credentials: "include" });
    if (!res.ok) return "/dashboard";
    const summary = await res.json();
    return summary?.wealthLevel === -1 ? "/onboarding" : "/dashboard";
  } catch {
    return "/dashboard";
  }
}

export default function LoginPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Bug hunt (Issue 2): satu-satunya jalur navigasi pasca-login/sudah-login,
  // supaya tidak ada race antara efek ini dan keputusan redirect di handleSubmit
  // (yang sebelumnya bisa membuat user baru "kelihatan" sempat mampir ke
  // /dashboard sebelum dilempar ke /onboarding).
  const navigatingRef = useRef(false);

  useEffect(() => {
    if (isPending || !session || navigatingRef.current) return;
    navigatingRef.current = true;
    resolvePostLoginDestination().then((destination) => router.replace(destination));
  }, [session, isPending, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error: err } = await signIn.email({ email, password });

    if (err) {
      setError(
        err.code === "INVALID_EMAIL_OR_PASSWORD"
          ? "Email atau password salah."
          : (err.message ?? "Gagal masuk. Coba lagi.")
      );
      setLoading(false);
      return;
    }

    // Navigasi ditangani oleh useEffect di atas begitu `session` ter-update —
    // tetap loading sampai redirect terjadi.
  }

  if (isPending || session) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-6 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 justify-center">
            <div className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center text-brand-text-on font-bold text-lg">
              W
            </div>
            <span className="text-xl font-semibold text-text-primary">WealthChecker</span>
          </Link>
          <p className="mt-2 text-text-secondary text-sm">Masuk ke akun kamu</p>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <div className="flex items-start gap-2 bg-danger-soft border border-danger-soft-border text-danger-text text-sm px-4 py-3 rounded-lg" role="alert">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="shrink-0 mt-0.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span>{error}</span>
              </div>
            )}

            <Input
              id="email"
              type="email"
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="kamu@email.com"
              autoComplete="email"
              required
            />

            <PasswordInput
              id="password"
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />

            <Button type="submit" loading={loading} fullWidth className="mt-1">
              {loading ? "Masuk..." : "Masuk"}
            </Button>
          </form>
        </div>

        <p className="text-center text-text-muted text-sm mt-5">
          Belum punya akun?{" "}
          <Link href="/auth/register" className="text-brand hover:text-brand-hover font-medium">
            Daftar gratis
          </Link>
        </p>
      </div>
    </div>
  );
}
