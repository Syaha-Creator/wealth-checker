"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { apiFetch, setActiveHouseholdId } from "@/lib/apiFetch";
import { useToast } from "@/components/ui/Toast";

type Status = "loading" | "success" | "error";

function AcceptInviteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showToast } = useToast();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<Status>(() => (token ? "loading" : "error"));
  const [message, setMessage] = useState(() => (token ? "" : "Link undangan tidak valid — token tidak ditemukan."));
  const [householdId, setHouseholdId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    apiFetch(`/api/households/accept-invite/${token}`, { method: "POST" })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? "Gagal menerima undangan");
        }
        return res.json();
      })
      .then((data: { householdId: string; alreadyMember: boolean }) => {
        if (cancelled) return;
        setHouseholdId(data.householdId);
        setStatus("success");
        setMessage(
          data.alreadyMember
            ? "Kamu sudah menjadi anggota household ini."
            : "Undangan berhasil diterima! Kamu sekarang bisa melihat dan mengelola data keuangan household ini.",
        );
        showToast({
          type: "success",
          message: data.alreadyMember ? "Kamu sudah anggota household ini" : "Undangan household berhasil diterima",
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Gagal menerima undangan";
        setStatus("error");
        setMessage(msg);
        showToast({ type: "error", message: msg });
      });

    return () => { cancelled = true; };
  }, [token, showToast]);

  const handleGoToDashboard = () => {
    if (householdId) setActiveHouseholdId(householdId);
    router.push("/dashboard");
  };

  return (
    <div className="max-w-md mx-auto">
      <PageHeader title="Undangan Household" />
      <Card>
        {status === "loading" && (
          <div className="flex items-center gap-3 py-4">
            <span className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin shrink-0" aria-hidden="true" />
            <p className="text-sm text-text-secondary">Memproses undangan...</p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">{message}</p>
            <Button fullWidth onClick={handleGoToDashboard}>Buka Dashboard Household Ini</Button>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <p className="text-sm text-danger-text" role="alert">{message}</p>
            <Button variant="secondary" fullWidth href="/dashboard">Kembali ke Dashboard</Button>
          </div>
        )}
      </Card>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={null}>
      <AcceptInviteContent />
    </Suspense>
  );
}
