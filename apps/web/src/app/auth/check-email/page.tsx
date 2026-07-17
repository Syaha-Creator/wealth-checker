"use client";

import Link from "next/link";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { sendVerificationEmail } from "@/lib/auth-client";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ThemeToggle";

function CheckEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email")?.trim() ?? "";
  const [loading, setLoading] = useState(false);
  const [resent, setResent] = useState(false);

  async function handleResend() {
    if (!email) return;
    setLoading(true);
    setResent(false);
    const callbackURL = `${window.location.origin}/auth/verified`;
    await sendVerificationEmail({ email, callbackURL });
    // Anti-enumeration: selalu tampilkan sukses generik.
    setResent(true);
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
          <h1 className="mt-4 text-lg font-semibold text-text-primary">Cek Email Kamu</h1>
          <p className="mt-2 text-text-secondary text-sm">
            Kami mengirim tautan verifikasi
            {email ? (
              <>
                {" "}
                ke <span className="font-medium text-text-primary">{email}</span>
              </>
            ) : null}
            . Buka inbox (dan folder spam) lalu klik tautannya untuk mengaktifkan akun.
          </p>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-6 space-y-4">
          {resent && (
            <div
              className="flex items-start gap-2 bg-brand-soft border border-brand-soft-border text-text-primary text-sm px-4 py-3 rounded-lg"
              role="status"
            >
              <span>Jika email terdaftar dan belum diverifikasi, tautan baru sudah dikirim.</span>
            </div>
          )}

          <Button
            type="button"
            loading={loading}
            fullWidth
            onClick={handleResend}
            disabled={!email}
          >
            {loading ? "Mengirim..." : "Kirim Ulang Tautan"}
          </Button>

          <p className="text-center text-text-muted text-xs">
            Sudah verifikasi?{" "}
            <Link href="/auth/login" className="text-brand hover:text-brand-hover font-medium">
              Masuk
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function CheckEmailPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center bg-page"
          role="status"
          aria-label="Memuat halaman verifikasi email"
        >
          <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <CheckEmailContent />
    </Suspense>
  );
}
