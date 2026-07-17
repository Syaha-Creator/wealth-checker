"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageShell } from "@/components/ui/PageShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, SkeletonHero, SkeletonCard } from "@/components/ui/Skeleton";
import { Toggle } from "@/components/ui/Toggle";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency, formatCurrencyShort } from "@/lib/format";
import { retirementHeroTarget } from "@/lib/retirementHero";
import { RetirementAdvancedPanel } from "./_components/RetirementAdvancedPanel";
import { apiFetch } from "@/lib/apiFetch";

type RetirementPlanResponse =
  | { hasProfile: false; error: string }
  | {
      hasProfile: true;
      mode?: "simple" | "advanced";
      plan: {
        tahunMenujuPensiun: number;
        tahunMenujuWarisan: number;
        danaDibutuhkanSebelumPensiun: number;
        danaDibutuhkanSelamaPensiun: number;
        totalDanaPensiunWarisan: number;
        danaDibutuhkanSekarang?: number;
      };
      sisaUangBulanan: number;
      danaTerkumpulSaatIni: number;
      selisihMenujuTarget: number;
      collectedFunds: {
        danaDaruratTerkumpul: number;
        danaPensiunTerkumpul: number;
        danaWarisanTerkumpul: number;
      };
      debtPayoff: {
        bisaLunasSekarang: boolean;
        bulanLunasDenganKas: number | null;
        bulanLunasDenganSisaGaji: number | null;
      };
      realizedPL: { untungRugiJualBarang: number; untungRugiInvestasi: number };
    };

function TargetIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

function RetirementPlanSkeleton() {
  return (
    <div className="space-y-4">
      <SkeletonHero className="h-36" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <Skeleton className="h-40 rounded-2xl" />
      <Skeleton className="h-32 rounded-2xl" />
    </div>
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

function formatTahun(n: number): string {
  if (n < 0) return "sudah terlewat";
  return `${n.toFixed(1)} tahun`;
}

function formatBulan(n: number | null): string {
  if (n === null) return "belum bisa dihitung — pengeluaran masih lebih besar dari pemasukan";
  if (n === 0) return "sekarang";
  return `${n} bulan`;
}

export default function RetirementPlanPage() {
  const { showToast } = useToast();
  const [data, setData] = useState<RetirementPlanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [togglingAdvanced, setTogglingAdvanced] = useState(false);
  const [simpleTotal, setSimpleTotal] = useState(0);

  const loadPlan = useCallback(async (mode: "simple" | "advanced") => {
    const r = await apiFetch(`/api/wealth/retirement-plan?mode=${mode}`, { credentials: "include" });
    if (!r.ok) throw new Error("Gagal memuat rencana pensiun & warisan");
    return r.json() as Promise<RetirementPlanResponse>;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const assumptions = await apiFetch(`/api/wealth/retirement-assumptions`, { credentials: "include" })
          .then(async (r) => (r.ok ? (r.json() as Promise<{ useAdvancedFormula?: boolean }>) : null))
          .catch(() => null);
        const advanced = Boolean(assumptions?.useAdvancedFormula);
        const simpleJson = await loadPlan("simple");
        if (cancelled) return;
        if (simpleJson.hasProfile) {
          setSimpleTotal(simpleJson.plan.totalDanaPensiunWarisan);
        }
        if (advanced) {
          const advancedJson = await loadPlan("advanced");
          if (cancelled) return;
          setShowAdvanced(true);
          setData(advancedJson);
        } else {
          setShowAdvanced(false);
          setData(simpleJson);
        }
        setError("");
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Gagal memuat");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [retryKey, loadPlan]);

  const handleAdvancedToggle = async (checked: boolean) => {
    const previous = showAdvanced;
    setShowAdvanced(checked);
    setTogglingAdvanced(true);
    try {
      const res = await apiFetch(`/api/wealth/retirement-assumptions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ useAdvancedFormula: checked }),
      });
      if (!res.ok) {
        setShowAdvanced(previous);
        const body = await res.json().catch(() => ({ error: "Gagal menyimpan preferensi" }));
        showToast({ type: "error", message: body.error ?? "Gagal menyimpan preferensi mode lanjutan" });
        return;
      }
      if (!checked) {
        const json = await loadPlan("simple");
        if (json.hasProfile) setSimpleTotal(json.plan.totalDanaPensiunWarisan);
        setData(json);
      } else {
        const [simpleJson, advancedJson] = await Promise.all([loadPlan("simple"), loadPlan("advanced")]);
        if (simpleJson.hasProfile) setSimpleTotal(simpleJson.plan.totalDanaPensiunWarisan);
        setData(advancedJson);
      }
    } catch {
      setShowAdvanced(previous);
      showToast({ type: "error", message: "Gagal menyimpan preferensi mode lanjutan" });
    } finally {
      setTogglingAdvanced(false);
    }
  };

  const mode = data?.hasProfile ? (data.mode ?? (showAdvanced ? "advanced" : "simple")) : "simple";
  const heroTarget =
    data?.hasProfile
      ? retirementHeroTarget({
          mode,
          totalDanaPensiunWarisan: data.plan.totalDanaPensiunWarisan,
          danaDibutuhkanSekarang: data.plan.danaDibutuhkanSekarang,
        })
      : 0;
  const progressPct =
    data?.hasProfile && heroTarget > 0
      ? Math.min(100, (data.danaTerkumpulSaatIni / heroTarget) * 100)
      : 0;

  return (
    <PageShell width="narrow">
      <PageHeader title="Rencana Pensiun & Warisan" subtitle="Proyeksi dana yang kamu butuhkan menuju pensiun dan warisan" />

      {loading ? (
        <RetirementPlanSkeleton />
      ) : error ? (
        <ErrorBanner message={error} onRetry={() => { setError(""); setLoading(true); setRetryKey((k) => k + 1); }} />
      ) : !data || !data.hasProfile ? (
        <EmptyState
          icon={<TargetIcon />}
          title="Lengkapi profil untuk melihat rencana pensiun"
          description={data?.error ?? "Isi tanggal lahir, rencana usia pensiun, dan rencana usia warisan di halaman Profil."}
          action={<Button href="/profile" size="sm">Lengkapi Profil</Button>}
        />
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl p-5 sm:p-6 bg-brand">
            <p className="text-white/70 text-sm">
              {mode === "advanced"
                ? "Dana yang perlu disiapkan hari ini (PV)"
                : "Total Dana Pensiun & Warisan Dibutuhkan"}
            </p>
            <p className="text-2xl sm:text-3xl font-bold mt-1 text-white">{formatCurrencyShort(heroTarget)}</p>
            <p className="text-sm text-white/80 mt-0.5">{formatCurrency(heroTarget)}</p>
            {mode === "advanced" && (
              <p className="text-xs text-white/60 mt-1">
                Target nominal masa depan (FV): {formatCurrencyShort(data.plan.totalDanaPensiunWarisan)}
              </p>
            )}

            <div
              className="mt-4 h-2 rounded-full bg-white/20 overflow-hidden"
              role="progressbar"
              aria-valuenow={Math.round(progressPct)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Dana terkumpul: ${Math.round(progressPct)}% dari target`}
            >
              <div className="h-full bg-white rounded-full transition-all" style={{ width: `${progressPct}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-white/80">
              <span>Terkumpul: {formatCurrencyShort(data.danaTerkumpulSaatIni)}</span>
              <span>{progressPct.toFixed(0)}%</span>
            </div>
            {data.selisihMenujuTarget > 0 && (
              <p className="text-xs text-white/70 mt-1">
                {mode === "advanced"
                  ? `Kurang ${formatCurrencyShort(data.selisihMenujuTarget)} lagi menuju kebutuhan hari ini (PV)`
                  : `Kurang ${formatCurrencyShort(data.selisihMenujuTarget)} lagi menuju target (nominal hari ini)`}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card>
              <p className="text-xs text-text-muted">Dana Dibutuhkan Sebelum Pensiun</p>
              <p className="text-lg font-bold text-text-primary mt-1">{formatCurrencyShort(data.plan.danaDibutuhkanSebelumPensiun)}</p>
              <p className="text-xs text-text-muted mt-2">Menuju pensiun: {formatTahun(data.plan.tahunMenujuPensiun)}</p>
            </Card>
            <Card>
              <p className="text-xs text-text-muted">Dana Dibutuhkan Selama Pensiun</p>
              <p className="text-lg font-bold text-text-primary mt-1">{formatCurrencyShort(data.plan.danaDibutuhkanSelamaPensiun)}</p>
              <p className="text-xs text-text-muted mt-2">Menuju warisan: {formatTahun(data.plan.tahunMenujuWarisan)}</p>
            </Card>
          </div>

          <Card>
            <h2 className="text-sm font-semibold text-text-secondary mb-3">Rincian Dana Terkumpul Saat Ini</h2>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-primary">Dana Darurat</span>
                <span className="font-semibold text-text-primary">{formatCurrency(data.collectedFunds.danaDaruratTerkumpul)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-primary">Dana Pensiun</span>
                <span className="font-semibold text-text-primary">{formatCurrency(data.collectedFunds.danaPensiunTerkumpul)}</span>
              </div>
              <div className="flex items-center justify-between text-sm pt-2 border-t border-border">
                <span className="text-text-primary">Dana Warisan</span>
                <span className="font-semibold text-brand">{formatCurrency(data.collectedFunds.danaWarisanTerkumpul)}</span>
              </div>
            </div>
            <p className="text-xs text-text-muted mt-3">
              Sisa uang bulanan (pemasukan − pengeluaran rencana): <span className="font-medium text-text-primary">{formatCurrency(data.sisaUangBulanan)}</span>/bulan
            </p>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-text-secondary mb-3">Kapan Utang Bisa Lunas?</h2>
            {data.debtPayoff.bisaLunasSekarang ? (
              <p className="text-sm text-brand font-medium">Utang bisa dilunasi sekarang dengan kas yang tersedia.</p>
            ) : (
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-muted">Dengan kas + sisa gaji</span>
                  <span className="font-medium text-text-primary">{formatBulan(data.debtPayoff.bulanLunasDenganKas)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Dengan sisa gaji saja</span>
                  <span className="font-medium text-text-primary">{formatBulan(data.debtPayoff.bulanLunasDenganSisaGaji)}</span>
                </div>
              </div>
            )}
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-text-secondary mb-3">Untung/Rugi Realized</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-text-muted">Jual Barang</p>
                <p className={`text-sm font-semibold mt-0.5 ${data.realizedPL.untungRugiJualBarang >= 0 ? "text-brand" : "text-danger-text"}`}>
                  {data.realizedPL.untungRugiJualBarang >= 0 ? "+" : ""}{formatCurrency(data.realizedPL.untungRugiJualBarang)}
                </p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Jual Investasi</p>
                <p className={`text-sm font-semibold mt-0.5 ${data.realizedPL.untungRugiInvestasi >= 0 ? "text-brand" : "text-danger-text"}`}>
                  {data.realizedPL.untungRugiInvestasi >= 0 ? "+" : ""}{formatCurrency(data.realizedPL.untungRugiInvestasi)}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <Toggle
              id="toggle-advanced-mode"
              checked={showAdvanced}
              onChange={handleAdvancedToggle}
              disabled={togglingAdvanced}
              label="Mode Lanjutan: hitung kebutuhan hari ini (PV) dengan inflasi & return"
            />
          </Card>

          {showAdvanced && (
            <RetirementAdvancedPanel
              totalDanaPensiunWarisanSimple={simpleTotal}
              onAssumptionsApplied={async () => {
                const json = await loadPlan("advanced");
                setData(json);
              }}
            />
          )}
        </div>
      )}
    </PageShell>
  );
}
