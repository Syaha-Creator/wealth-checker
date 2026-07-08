"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/lib/auth-client";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageShell } from "@/components/ui/PageShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, SkeletonCard, SkeletonHero } from "@/components/ui/Skeleton";
import { formatCurrency, formatCurrencyShort, formatMonthLabel } from "@/lib/format";
import { apiFetch, WEALTH_CHANGED_EVENT } from "@/lib/apiFetch";


type WealthSummary = {
  totalAset: number;
  totalUtang: number;
  kekayaanBersih: number;
  totalKas: number;
  totalLiquidAssets: number;
  totalFixedAssets: number;
  totalReceivables: number;
  wealthLevel: number;
  wealthLevelName: string;
};

type MonthlySnapshot = {
  bulan: string;
  pemasukan: number;
  pengeluaran: number;
  sisaUangBulanan: number;
};

type MonthlyCashFlow = {
  bulanIni: MonthlySnapshot;
  bulanLalu: MonthlySnapshot;
  rataRata3Bulan: { pemasukan: number; pengeluaran: number; sisaUangBulanan: number };
  hidupTanpaGajiBulan: number | null;
};

type Account = { id: string; nama: string; saldoCache: string };

const LEVEL_CONFIG: { label: string; desc: string; variant: "danger" | "warning" | "info" | "brand" }[] = [
  { label: "Pailit", desc: "Utang melebihi aset", variant: "danger" },
  { label: "Terjerat Utang", desc: "Utang lebih besar dari kekayaan", variant: "danger" },
  { label: "Terlihat Kaya", desc: "Barang banyak tapi kas minus", variant: "warning" },
  { label: "Gaji ke Gaji", desc: "Belum punya dana darurat", variant: "warning" },
  { label: "Punya Dana Darurat", desc: "Sudah aman jika darurat", variant: "info" },
  { label: "Dana Pensiun", desc: "Sudah menyiapkan masa depan", variant: "brand" },
  { label: "Punya Warisan", desc: "Level kebebasan finansial tertinggi", variant: "brand" },
];

function AccountIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-40" />
        </div>
        <Skeleton className="h-9 w-20 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <SkeletonHero className="h-40" />
          <div className="grid grid-cols-2 gap-3">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-2">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [summary, setSummary] = useState<WealthSummary | null>(null);
  const [cashFlow, setCashFlow] = useState<MonthlyCashFlow | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Medium #9 (bug hunt): "Coba Lagi" sebelumnya hanya reset error/loading state
  // tanpa memicu ulang fetch — useEffect di bawah cuma bergantung pada `session`
  // yang tidak berubah saat retry, jadi skeleton loading jadi permanen. retryKey
  // dinaikkan setiap klik retry dan dimasukkan ke dependency array agar fetch
  // benar-benar diulang.
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!session) return;
    Promise.all([
      apiFetch(`/api/wealth/summary`, { credentials: "include" }).then((r) => {
        if (!r.ok) throw new Error("Gagal memuat ringkasan kekayaan");
        return r.json();
      }),
      apiFetch(`/api/accounts`, { credentials: "include" }).then((r) => {
        if (!r.ok) throw new Error("Gagal memuat rekening");
        return r.json();
      }),
      apiFetch(`/api/wealth/monthly-cash-flow`, { credentials: "include" }).then((r) => {
        if (!r.ok) return null;
        return r.json();
      }),
    ])
      .then(([w, a, cf]) => {
        setSummary(w);
        setAccounts(Array.isArray(a) ? a.filter((acc: Account & { isActive: boolean }) => acc.isActive) : []);
        if (cf) setCashFlow(cf);
      })
      .catch((err: Error) => {
        setError(err.message ?? "Gagal memuat data. Coba muat ulang halaman.");
      })
      .finally(() => setLoading(false));
  }, [session, retryKey]);

  useEffect(() => {
    const onWealthChanged = () => {
      setRetryKey((k) => k + 1);
    };
    window.addEventListener(WEALTH_CHANGED_EVENT, onWealthChanged);
    return () => window.removeEventListener(WEALTH_CHANGED_EVENT, onWealthChanged);
  }, []);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <Card className="text-center max-w-lg mx-auto">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="mx-auto mb-3 text-danger" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <p className="text-sm font-medium text-danger-text mb-1">Gagal memuat dashboard</p>
        <p className="text-xs text-text-muted mb-4">{error}</p>
        <Button variant="danger" size="sm" onClick={() => { setError(""); setLoading(true); setRetryKey((k) => k + 1); }}>
          Coba Lagi
        </Button>
      </Card>
    );
  }

  const level = summary?.wealthLevel ?? -1;
  // level -1 = "no data yet" — show neutral state, not "Pailit"
  const isNoData = level === -1;
  const levelCfg = isNoData ? null : (LEVEL_CONFIG[level] ?? LEVEL_CONFIG[0]);
  const kn = summary?.kekayaanBersih ?? 0;

  const isNewUser = !summary || isNoData;

  return (
    <PageShell width="full" className="space-y-6">
      <PageHeader
        title={session?.user?.name ?? "Dashboard"}
        subtitle="Selamat datang kembali"
      />

      {/* New-user guidance — only shown when there is truly no wealth data yet
          (wealthLevel -1), never for users who already have data */}
      {isNewUser && (
        <EmptyState
          icon={<AccountIcon />}
          title="Mulai lacak kekayaanmu"
          description="Tambahkan rekening pertama untuk mulai menghitung kekayaan bersih dan level kebebasan finansialmu."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button href="/accounts" size="sm">Tambah Rekening</Button>
              <Button href="/onboarding" variant="secondary" size="sm">Setup Lengkap →</Button>
            </div>
          }
          className="bg-brand-soft border border-brand-soft-border rounded-2xl"
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Primary column: net worth + breakdown + cash flow */}
        <div className="lg:col-span-2 space-y-6">
          {/* Kekayaan Bersih hero */}
          <div className={`rounded-2xl p-5 sm:p-6 ${isNoData ? "bg-surface-hover" : kn >= 0 ? "bg-brand" : "bg-danger"}`}>
            <p className={isNoData ? "text-text-muted text-sm" : "text-white/70 text-sm"}>Kekayaan Bersih</p>
            <p className={`text-3xl font-bold mt-1 ${isNoData ? "text-text-primary" : "text-white"}`}>
              {isNoData ? "—" : formatCurrencyShort(kn)}
            </p>
            {!isNoData && <p className="text-sm text-white/80 mt-0.5">{formatCurrency(kn)}</p>}
            {levelCfg && (
              <div className="mt-4 flex items-center gap-2">
                {/* Overlay pill (not the semantic Badge) — needs to contrast with the
                    solid brand/danger hero background regardless of active theme */}
                <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full bg-white/20 text-white">
                  Level {level} · {levelCfg.label}
                </span>
                <Link href="/health-checkup" className="text-xs font-medium text-white/80 hover:text-white underline transition-colors">
                  Lihat diagnosa lengkap →
                </Link>
              </div>
            )}
          </div>

          {/* Breakdown: Aset vs Utang — skip when there's no data yet, the
              empty state above already covers guidance for that case */}
          {summary && !isNoData && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Card>
                <p className="text-xs text-text-muted">Total Aset</p>
                <p className="text-lg font-bold text-text-primary mt-1">{formatCurrencyShort(summary.totalAset)}</p>
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-xs text-text-muted">
                    <span>Kas</span>
                    <span>{formatCurrencyShort(summary.totalKas)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-text-muted">
                    <span>Investasi</span>
                    <span>{formatCurrencyShort(summary.totalLiquidAssets)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-text-muted">
                    <span>Barang</span>
                    <span>{formatCurrencyShort(summary.totalFixedAssets)}</span>
                  </div>
                  {summary.totalReceivables > 0 && (
                    <div className="flex justify-between text-xs text-text-muted">
                      <span>Piutang</span>
                      <span>{formatCurrencyShort(summary.totalReceivables)}</span>
                    </div>
                  )}
                </div>
              </Card>
              <Card>
                <p className="text-xs text-text-muted">Total Utang</p>
                <p className="text-lg font-bold text-danger-text mt-1">{formatCurrencyShort(summary.totalUtang)}</p>
                <div className="mt-2 pt-2 border-t border-border">
                  <p className="text-xs text-text-muted">{levelCfg ? levelCfg.desc : "Lengkapi data untuk melihat level"}</p>
                </div>
                {/* Level progress bar */}
                <div className="mt-3">
                  <div className="flex gap-0.5 mt-1" role="progressbar" aria-valuenow={Math.max(0, level)} aria-valuemin={0} aria-valuemax={6} aria-label={`Level kebebasan finansial: ${isNoData ? "belum ada data" : `${level} dari 6`}`}>
                    {[0, 1, 2, 3, 4, 5, 6].map((l) => (
                      <div
                        key={l}
                        className={`h-1.5 flex-1 rounded-full ${!isNoData && l <= level ? "bg-brand" : "bg-border"}`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-text-muted mt-1">{isNoData ? "Belum ada data" : `Level ${level} dari 6`}</p>
                </div>
              </Card>
            </div>
          )}

          {/* Arus Kas Bulan Ini */}
          {cashFlow && (cashFlow.bulanIni.pemasukan > 0 || cashFlow.bulanIni.pengeluaran > 0) && (
            <Card>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-text-secondary">Arus Kas Bulan Ini</h2>
                <span className="text-xs text-text-muted">{formatMonthLabel(cashFlow.bulanIni.bulan)}</span>
              </div>

              {/* Pemasukan vs Pengeluaran bar */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-brand-soft rounded-xl p-3">
                  <p className="text-xs text-brand font-medium mb-1">Pemasukan</p>
                  <p className="text-sm font-bold text-brand">{formatCurrencyShort(cashFlow.bulanIni.pemasukan)}</p>
                </div>
                <div className="bg-danger-soft rounded-xl p-3">
                  <p className="text-xs text-danger-text font-medium mb-1">Pengeluaran</p>
                  <p className="text-sm font-bold text-danger-text">{formatCurrencyShort(cashFlow.bulanIni.pengeluaran)}</p>
                </div>
              </div>

              {/* Sisa */}
              <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl ${
                cashFlow.bulanIni.sisaUangBulanan >= 0 ? "bg-brand" : "bg-danger"
              }`}>
                <p className="text-xs font-medium text-white/80">Sisa Uang Bulan Ini</p>
                <p className="text-sm font-bold text-white">
                  {cashFlow.bulanIni.sisaUangBulanan >= 0 ? "+" : ""}
                  {formatCurrencyShort(cashFlow.bulanIni.sisaUangBulanan)}
                </p>
              </div>

              {/* Rata-rata 3 bulan & hidup tanpa gaji */}
              <div className="mt-3 pt-3 border-t border-border space-y-1.5">
                <div className="flex justify-between text-xs text-text-muted">
                  <span>Rata-rata sisa 3 bln</span>
                  <span className={cashFlow.rataRata3Bulan.sisaUangBulanan >= 0 ? "text-brand font-medium" : "text-danger-text font-medium"}>
                    {cashFlow.rataRata3Bulan.sisaUangBulanan >= 0 ? "+" : ""}
                    {formatCurrencyShort(cashFlow.rataRata3Bulan.sisaUangBulanan)}
                  </span>
                </div>
                {cashFlow.hidupTanpaGajiBulan !== null && (
                  <div className="flex justify-between text-xs text-text-muted">
                    <span>Hidup tanpa gaji</span>
                    <span className="text-text-primary font-medium">{cashFlow.hidupTanpaGajiBulan} bulan</span>
                  </div>
                )}
              </div>

              {/* Bulan lalu perbandingan */}
              {(cashFlow.bulanLalu.pemasukan > 0 || cashFlow.bulanLalu.pengeluaran > 0) && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs text-text-muted mb-1.5">{formatMonthLabel(cashFlow.bulanLalu.bulan)}</p>
                  <div className="flex justify-between text-xs">
                    <span className="text-brand">+{formatCurrencyShort(cashFlow.bulanLalu.pemasukan)}</span>
                    <span className="text-danger-text">-{formatCurrencyShort(cashFlow.bulanLalu.pengeluaran)}</span>
                    <span className={`font-semibold ${cashFlow.bulanLalu.sisaUangBulanan >= 0 ? "text-brand" : "text-danger-text"}`}>
                      {cashFlow.bulanLalu.sisaUangBulanan >= 0 ? "+" : ""}{formatCurrencyShort(cashFlow.bulanLalu.sisaUangBulanan)}
                    </span>
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Secondary column: accounts + quick actions */}
        <div className="space-y-6">
          {/* Rekening */}
          {accounts.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-text-secondary">Rekening</h2>
                <Link href="/accounts" className="text-xs text-brand font-medium hover:text-brand-hover transition-colors">Lihat semua</Link>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {accounts.slice(0, 4).map((acc) => (
                  <Card key={acc.id} padding="sm">
                    <p className="text-xs text-text-muted truncate">{acc.nama}</p>
                    <p className="text-sm font-bold text-text-primary mt-0.5">
                      {formatCurrencyShort(Number(acc.saldoCache))}
                    </p>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Insights — Sprint 13/14: health checkup & budgeting advisor */}
          {!isNoData && (
            <Card padding="none" className="overflow-hidden">
              <Link href="/health-checkup" className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-surface-hover transition-colors border-b border-border">
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-full bg-brand-soft text-brand flex items-center justify-center shrink-0" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 10-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z" /></svg>
                  </span>
                  <span className="text-sm font-medium text-text-primary">Financial Health Check-up</span>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-text-muted shrink-0" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
              </Link>
              <Link href="/budgeting" className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-surface-hover transition-colors border-b border-border">
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-full bg-info-soft text-info-text flex items-center justify-center shrink-0" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M21 12V7H5a2 2 0 010-4h14v4" /><path d="M3 5v14a2 2 0 002 2h16v-5" /><path d="M18 12a2 2 0 000 4h4v-4z" /></svg>
                  </span>
                  <span className="text-sm font-medium text-text-primary">Budgeting Advisor</span>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-text-muted shrink-0" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
              </Link>
              <Link href="/retirement-plan" className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-surface-hover transition-colors">
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-full bg-brand-soft text-brand flex items-center justify-center shrink-0" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" fill="currentColor" /></svg>
                  </span>
                  <span className="text-sm font-medium text-text-primary">Rencana Pensiun &amp; Warisan</span>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-text-muted shrink-0" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
              </Link>
            </Card>
          )}

          {/* Quick actions */}
          <Card>
            <h2 className="text-sm font-semibold text-text-secondary mb-3">Catat Cepat</h2>
            <div className="grid grid-cols-3 gap-2">
              <Link href="/transactions/new?type=pendapatan" className="flex flex-col items-center gap-2 p-3 bg-brand-soft rounded-xl hover:bg-brand-soft-border/50 transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-brand" strokeLinecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 5 5 12"/></svg>
                <span className="text-xs font-medium text-brand">Pemasukan</span>
              </Link>
              <Link href="/transactions/new?type=pengeluaran" className="flex flex-col items-center gap-2 p-3 bg-danger-soft rounded-xl hover:bg-danger-soft-border/50 transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-danger-text" strokeLinecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="5 12 12 19 19 12"/></svg>
                <span className="text-xs font-medium text-danger-text">Pengeluaran</span>
              </Link>
              <Link href="/transactions/new?type=transfer" className="flex flex-col items-center gap-2 p-3 bg-info-soft rounded-xl hover:bg-info-soft-border/50 transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-info-text" strokeLinecap="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                <span className="text-xs font-medium text-info-text">Transfer</span>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
