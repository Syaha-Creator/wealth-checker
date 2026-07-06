"use client";

import Link from "next/link";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signUp, useSession } from "@/lib/auth-client";
import { Input, PasswordInput } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { safeRedirectTarget } from "@/lib/safeRedirect";

// Bug hunt (Issue 11): dulu kriteria ini cuma kosmetik — password 8 karakter
// tanpa huruf besar/angka tetap lolos daftar (Better Auth server-side cuma
// mengecek panjang lewat minPasswordLength). Sekarang dipakai juga sebagai
// syarat submit di handleSubmit, supaya apa yang ditampilkan sesuai dengan
// yang benar-benar diwajibkan. (Enforcement ini di sisi client saja — API
// Better Auth sendiri tetap hanya menegakkan panjang minimum.)
function getPasswordChecks(password: string) {
  return [
    { label: "Min. 8 karakter", ok: password.length >= 8 },
    { label: "Huruf besar", ok: /[A-Z]/.test(password) },
    { label: "Angka", ok: /[0-9]/.test(password) },
  ];
}

function PasswordStrength({ password }: { password: string }) {
  const checks = getPasswordChecks(password);
  const score = checks.filter((c) => c.ok).length;
  const colors = ["", "bg-danger", "bg-warning", "bg-brand"];

  if (!password) return null;
  return (
    <div className="mt-1.5 space-y-1.5">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < score ? colors[score] : "bg-border"
            }`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {checks.map((c) => (
          <span key={c.label} className={`text-xs ${c.ok ? "text-brand" : "text-text-muted"}`}>
            {c.ok ? "✓" : "·"} {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Sprint 28 (Fase 4): sama seperti login — kalau ada tujuan tersimpan (mis.
  // link undangan household yang diklik sebelum akun ini dibuat), utamakan itu
  // daripada alur onboarding default. Lihat safeRedirect.ts & (app)/layout.tsx.
  const redirectTarget = safeRedirectTarget(searchParams.get("redirect"));
  const { data: session, isPending } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Sudah login? langsung redirect
  useEffect(() => {
    if (!isPending && session) {
      router.replace(redirectTarget ?? "/onboarding");
    }
  }, [session, isPending, router, redirectTarget]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (getPasswordChecks(password).some((c) => !c.ok)) {
      setError("Password harus minimal 8 karakter, mengandung huruf besar, dan angka.");
      setLoading(false);
      return;
    }

    const { error: err } = await signUp.email({ name, email, password });

    if (err) {
      // Bug hunt (Issue 13): pesan spesifik "email sudah terdaftar" ini secara
      // teknis membuka celah email enumeration (penyerang bisa cek email mana
      // yang sudah punya akun). Trade-off UX vs security yang disengaja — untuk
      // aplikasi personal finance non-sensitif seperti ini, UX pendaftaran yang
      // jelas lebih diprioritaskan daripada mitigasi enumeration (yang dampaknya
      // rendah di sini karena tidak ada data sensitif yang bocor, cuma status
      // "email ini terdaftar atau tidak").
      if (err.code === "USER_ALREADY_EXISTS") {
        setError("Email ini sudah terdaftar. Coba masuk.");
      } else {
        setError(err.message ?? "Gagal mendaftar. Coba lagi.");
      }
      setLoading(false);
      return;
    }

    router.push(redirectTarget ?? "/onboarding");
    router.refresh();
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
          <p className="mt-2 text-text-secondary text-sm">Buat akun baru — gratis selamanya</p>
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
              id="name"
              type="text"
              label="Nama Lengkap"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama kamu"
              autoComplete="name"
              required
            />

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

            <div>
              <PasswordInput
                id="password"
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 karakter, huruf besar & angka"
                autoComplete="new-password"
                required
              />
              <PasswordStrength password={password} />
            </div>

            <Button type="submit" loading={loading} fullWidth className="mt-1">
              {loading ? "Mendaftar..." : "Daftar Sekarang"}
            </Button>
          </form>

          <p className="text-center text-text-muted text-xs mt-4">
            Dengan mendaftar, kamu menyetujui penggunaan data untuk layanan ini.
          </p>
        </div>

        <p className="text-center text-text-muted text-sm mt-5">
          Sudah punya akun?{" "}
          <Link
            href={redirectTarget ? `/auth/login?redirect=${encodeURIComponent(redirectTarget)}` : "/auth/login"}
            className="text-brand hover:text-brand-hover font-medium"
          >
            Masuk
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterContent />
    </Suspense>
  );
}
