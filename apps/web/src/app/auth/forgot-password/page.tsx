"use client";

import Link from "next/link";
import { useState } from "react";
import { forgetPassword } from "@/lib/auth-client";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ThemeToggle";

const SUCCESS_MESSAGE =
  "Jika email terdaftar, tautan reset sudah dikirim. Silakan cek inbox kamu.";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const redirectTo = `${window.location.origin}/reset-password`;
    await forgetPassword({ email, redirectTo });

    // Anti-enumeration: tampilkan pesan sukses generic apapun respons API-nya.
    setSubmitted(true);
    setLoading(false);
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
          <h1 className="mt-4 text-lg font-semibold text-text-primary">Lupa Kata Sandi</h1>
          <p className="mt-2 text-text-secondary text-sm">
            Masukkan email akunmu, kami kirimkan tautan reset kata sandi
          </p>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-6">
          {submitted ? (
            <div
              className="flex items-start gap-2 bg-brand-soft border border-brand-soft-border text-text-primary text-sm px-4 py-3 rounded-lg"
              role="status"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="shrink-0 mt-0.5 text-brand" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              <span>{SUCCESS_MESSAGE}</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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

              <Button type="submit" loading={loading} fullWidth className="mt-1">
                {loading ? "Mengirim..." : "Kirim Tautan Reset"}
              </Button>
            </form>
          )}
        </div>

        <p className="text-center text-text-muted text-sm mt-5">
          Ingat kata sandimu?{" "}
          <Link href="/auth/login" className="text-brand hover:text-brand-hover font-medium">
            Masuk
          </Link>
        </p>
      </div>
    </div>
  );
}
