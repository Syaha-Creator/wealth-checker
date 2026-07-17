"use client";

import Link from "next/link";
import { useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { ThemeToggle } from "@/components/ThemeToggle";

function VerifiedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const invalid = searchParams.get("error") === "invalid_token";
  const { data: session, isPending } = useSession();
  const navigatingRef = useRef(false);

  useEffect(() => {
    if (invalid || isPending || !session || navigatingRef.current) return;
    navigatingRef.current = true;
    router.replace("/onboarding");
  }, [invalid, isPending, session, router]);

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-6 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm text-center">
        <Link href="/" className="inline-flex items-center gap-2 justify-center mb-8">
          <div className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center text-brand-text-on font-bold text-lg">
            W
          </div>
          <span className="text-xl font-semibold text-text-primary">WealthChecker</span>
        </Link>

        <div className="bg-surface border border-border rounded-2xl p-6 space-y-3">
          {invalid ? (
            <>
              <h1 className="text-lg font-semibold text-text-primary">Tautan tidak valid</h1>
              <p className="text-sm text-text-secondary">
                Tautan verifikasi sudah kedaluwarsa atau tidak berlaku. Minta tautan baru dari
                halaman daftar/masuk.
              </p>
              <Link
                href="/auth/check-email"
                className="inline-block text-sm text-brand hover:text-brand-hover font-medium"
              >
                Kirim ulang tautan
              </Link>
            </>
          ) : isPending || session ? (
            <>
              <h1 className="text-lg font-semibold text-text-primary">Email terverifikasi</h1>
              <p className="text-sm text-text-secondary">Mengalihkan ke aplikasi…</p>
              <div className="mx-auto w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            </>
          ) : (
            <>
              <h1 className="text-lg font-semibold text-text-primary">Email terverifikasi</h1>
              <p className="text-sm text-text-secondary">Silakan masuk untuk melanjutkan.</p>
              <Link
                href="/auth/login"
                className="inline-block text-sm text-brand hover:text-brand-hover font-medium"
              >
                Masuk
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifiedPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-page" role="status">
          <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <VerifiedContent />
    </Suspense>
  );
}
