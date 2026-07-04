"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, SkeletonHero } from "@/components/ui/Skeleton";
import { formatCurrency } from "@/lib/format";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

type HealthCheckup = {
  wealthLevel: number;
  wealthLevelName: string;
  diagnosa: string;
  saran: string;
  ciri: string[];
  kekayaanBersih: number;
  totalAset: number;
  totalUtang: number;
};

const LEVEL_VARIANT: Record<number, "danger" | "warning" | "info" | "brand"> = {
  0: "danger", 1: "danger", 2: "warning", 3: "warning", 4: "info", 5: "brand", 6: "brand",
};

const VARIANT_CLASSES: Record<"danger" | "warning" | "info" | "brand", string> = {
  danger: "bg-danger",
  warning: "bg-warning",
  info: "bg-info",
  brand: "bg-brand",
};

function HeartPulseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 10-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z" />
      <path d="M3.5 12h4l2-4 3 8 2-4h6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="text-center max-w-lg mx-auto" role="alert">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="mx-auto mb-3 text-danger" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <p className="text-sm font-medium text-danger-text mb-1">Gagal memuat data</p>
      <p className="text-xs text-text-muted mb-4">{message}</p>
      <Button variant="danger" size="sm" onClick={onRetry}>Coba Lagi</Button>
    </Card>
  );
}

export default function HealthCheckupPage() {
  const [data, setData] = useState<HealthCheckup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/api/wealth/health-checkup`, { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error("Gagal memuat Financial Health Check-up");
        return r.json();
      })
      .then((json: HealthCheckup) => {
        if (!cancelled) setData(json);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [retryKey]);

  return (
    <div className="max-w-2xl">
      <PageHeader title="Financial Health Check-up" subtitle="Diagnosa lengkap kondisi keuanganmu saat ini" />

      {loading ? (
        <div className="space-y-4">
          <SkeletonHero className="h-32" />
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
      ) : error ? (
        <ErrorBanner message={error} onRetry={() => { setError(""); setLoading(true); setRetryKey((k) => k + 1); }} />
      ) : !data || data.wealthLevel === -1 ? (
        <EmptyState
          icon={<HeartPulseIcon />}
          title="Belum ada data untuk didiagnosa"
          description="Tambahkan rekening dan catat transaksi pertamamu untuk melihat level kesehatan finansialmu."
          action={<Button href="/accounts" size="sm">Tambah Rekening</Button>}
        />
      ) : (
        <div className="space-y-4">
          <div className={`rounded-2xl p-5 sm:p-6 text-white ${VARIANT_CLASSES[LEVEL_VARIANT[data.wealthLevel] ?? "brand"]}`}>
            <p className="text-white/70 text-sm">Level Kebebasan Finansial</p>
            <p className="text-2xl sm:text-3xl font-bold mt-1">Level {data.wealthLevel} · {data.wealthLevelName}</p>
            <div className="flex gap-0.5 mt-4" role="progressbar" aria-valuenow={data.wealthLevel} aria-valuemin={0} aria-valuemax={6} aria-label={`Level ${data.wealthLevel} dari 6`}>
              {[0, 1, 2, 3, 4, 5, 6].map((l) => (
                <div key={l} className={`h-1.5 flex-1 rounded-full ${l <= data.wealthLevel ? "bg-white" : "bg-white/25"}`} />
              ))}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[11px] text-white/70">Total Aset</p>
                <p className="text-sm font-semibold mt-0.5">{formatCurrency(data.totalAset)}</p>
              </div>
              <div>
                <p className="text-[11px] text-white/70">Total Utang</p>
                <p className="text-sm font-semibold mt-0.5">{formatCurrency(data.totalUtang)}</p>
              </div>
              <div>
                <p className="text-[11px] text-white/70">Kekayaan Bersih</p>
                <p className="text-sm font-semibold mt-0.5">{formatCurrency(data.kekayaanBersih)}</p>
              </div>
            </div>
          </div>

          <Card>
            <h2 className="text-sm font-semibold text-text-secondary mb-2">Diagnosa</h2>
            <p className="text-sm text-text-primary leading-relaxed">{data.diagnosa}</p>
          </Card>

          {data.ciri.length > 0 && (
            <Card>
              <h2 className="text-sm font-semibold text-text-secondary mb-3">Ciri-ciri Kondisimu</h2>
              <ul className="space-y-2">
                {data.ciri.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-text-primary">
                    <span className="w-5 h-5 rounded-full bg-brand-soft text-brand flex items-center justify-center shrink-0 mt-0.5">
                      <CheckIcon />
                    </span>
                    {c}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="bg-brand-soft border-brand-soft-border">
            <h2 className="text-sm font-semibold text-brand mb-2">Saran untuk Kamu</h2>
            <p className="text-sm text-text-primary leading-relaxed">{data.saran}</p>
          </Card>
        </div>
      )}
    </div>
  );
}
