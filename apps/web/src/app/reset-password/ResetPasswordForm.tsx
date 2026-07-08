"use client";

import Link from "next/link";
import { useState } from "react";
import { resetPassword } from "@/lib/auth-client";
import { PasswordInput } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  getPasswordChecks,
  isPasswordValid,
  PASSWORD_REQUIREMENTS_MESSAGE,
} from "@/lib/passwordValidation";

const TOKEN_ERROR_MESSAGE =
  "Tautan reset sudah tidak valid atau kadaluarsa. Silakan minta tautan baru.";

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

type ResetPasswordFormProps = {
  token: string;
  invalidLink?: boolean;
};

export function ResetPasswordForm({ token, invalidLink = false }: ResetPasswordFormProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(invalidLink ? TOKEN_ERROR_MESSAGE : "");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!isPasswordValid(password)) {
      setError(PASSWORD_REQUIREMENTS_MESSAGE);
      return;
    }

    if (password !== confirmPassword) {
      setError("Konfirmasi password tidak cocok.");
      return;
    }

    setLoading(true);
    const { error: err } = await resetPassword({ newPassword: password, token });

    if (err) {
      setError(TOKEN_ERROR_MESSAGE);
      setLoading(false);
      return;
    }

    setSuccess(true);
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
          <h1 className="mt-4 text-lg font-semibold text-text-primary">Buat Kata Sandi Baru</h1>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-6">
          {success ? (
            <div className="space-y-4">
              <div
                className="flex items-start gap-2 bg-brand-soft border border-brand-soft-border text-text-primary text-sm px-4 py-3 rounded-lg"
                role="status"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="shrink-0 mt-0.5 text-brand" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                <span>Kata sandi berhasil diperbarui. Silakan masuk dengan password baru.</span>
              </div>
              <Button href="/auth/login" fullWidth>
                Masuk
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {error && (
                <div className="flex items-start gap-2 bg-danger-soft border border-danger-soft-border text-danger-text text-sm px-4 py-3 rounded-lg" role="alert">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="shrink-0 mt-0.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <span>
                    {error}
                    {error === TOKEN_ERROR_MESSAGE && (
                      <>
                        {" "}
                        <Link href="/auth/forgot-password" className="underline font-medium">
                          Minta tautan baru
                        </Link>
                      </>
                    )}
                  </span>
                </div>
              )}

              <div>
                <PasswordInput
                  id="password"
                  label="Password Baru"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 karakter, huruf besar & angka"
                  autoComplete="new-password"
                  required
                />
                <PasswordStrength password={password} />
              </div>

              <PasswordInput
                id="confirmPassword"
                label="Konfirmasi Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ulangi password baru"
                autoComplete="new-password"
                required
              />

              <Button type="submit" loading={loading} fullWidth className="mt-1">
                {loading ? "Menyimpan..." : "Simpan Kata Sandi Baru"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
