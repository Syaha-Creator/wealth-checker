"use client";

import { useEffect, useState, useCallback } from "react";
import type { FormEvent } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { InputRupiah } from "@/components/ui/Input";
import { Skeleton, SkeletonHero } from "@/components/ui/Skeleton";
import { formatCurrency, formatMonthLabel, parseRupiahInput } from "@/lib/format";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

type BudgetAllocationItem = { kategori: string; persen: number; nominal: number };

type BudgetingAdvice = {
  wealthLevel: number;
  hasPlan: boolean;
  rencanaPemasukanBulanan: number;
  alokasi: BudgetAllocationItem[];
  totalPersen: number;
  sisaTidakTeralokasi: number;
};

const CATEGORY_COLORS = [
  { bg: "bg-brand-soft", text: "text-brand", bar: "bg-brand" },
  { bg: "bg-info-soft", text: "text-info-text", bar: "bg-info" },
  { bg: "bg-warning-soft", text: "text-warning-text", bar: "bg-warning" },
  { bg: "bg-danger-soft", text: "text-danger-text", bar: "bg-danger" },
];

function WalletIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path d="M21 12V7H5a2 2 0 010-4h14v4" />
      <path d="M3 5v14a2 2 0 002 2h16v-5" />
      <path d="M18 12a2 2 0 000 4h4v-4z" />
    </svg>
  );
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="text-center max-w-lg mx-auto">
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

function currentYm() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function BudgetingPage() {
  const [advice, setAdvice] = useState<BudgetingAdvice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [pemasukan, setPemasukan] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchAdvice = useCallback(async () => {
    setError("");
    try {
      const res = await fetch(`${API}/api/budgeting-advice`, { credentials: "include" });
      if (!res.ok) throw new Error("Gagal memuat rekomendasi budgeting");
      const json: BudgetingAdvice = await res.json();
      setAdvice(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load: fetch inline with a cancellation guard rather than calling
  // fetchAdvice() (which sets state) directly in the effect body.
  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/api/budgeting-advice`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Gagal memuat rekomendasi budgeting");
        return res.json();
      })
      .then((json: BudgetingAdvice) => {
        if (!cancelled) setAdvice(json);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Gagal memuat data");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleSavePlan = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true); setFormError("");
    try {
      const res = await fetch(`${API}/api/budget-plans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ rencanaPemasukanBulanan: parseRupiahInput(pemasukan), bulanTahun: currentYm() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Gagal menyimpan rencana" }));
        throw new Error(err.error ?? "Gagal menyimpan rencana");
      }
      setPemasukan("");
      setShowForm(false);
      await fetchAdvice();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Gagal menyimpan rencana");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <PageHeader title="Budgeting Advisor" subtitle={`Rencana alokasi anggaran ${formatMonthLabel(currentYm())}`} />

      {loading ? (
        <div className="space-y-4">
          <SkeletonHero className="h-24" />
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
        </div>
      ) : error ? (
        <ErrorBanner message={error} onRetry={() => { setLoading(true); fetchAdvice(); }} />
      ) : !advice || advice.wealthLevel === -1 ? (
        <EmptyState
          icon={<WalletIcon />}
          title="Belum ada data untuk membuat rekomendasi"
          description="Tambahkan rekening dan catat transaksi pertamamu dulu."
          action={<Button href="/accounts" size="sm">Tambah Rekening</Button>}
        />
      ) : (
        <div className="space-y-4">
          <Card className="bg-brand text-white" padding="lg">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-white/70 text-sm">Rencana Pemasukan Bulanan</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(advice.rencanaPemasukanBulanan)}</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => { setShowForm((v) => !v); setPemasukan(""); setFormError(""); }}>
                {advice.hasPlan ? "Ubah" : "Atur"}
              </Button>
            </div>
          </Card>

          {showForm && (
            <Card as="form" onSubmit={handleSavePlan} padding="lg">
              <h3 className="font-semibold text-text-primary mb-3">Atur Rencana Pemasukan Bulan Ini</h3>
              {formError && <p className="text-sm text-danger-text mb-3">{formError}</p>}
              <InputRupiah id="pemasukan" label="Rencana Pemasukan" value={pemasukan} onChange={setPemasukan} required />
              <div className="flex gap-2 mt-4 max-w-xs">
                <Button type="button" variant="secondary" fullWidth onClick={() => setShowForm(false)}>Batal</Button>
                <Button type="submit" fullWidth loading={saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
              </div>
            </Card>
          )}

          {advice.alokasi.length === 0 ? (
            <EmptyState
              icon={<WalletIcon />}
              title="Atur rencana pemasukan bulananmu"
              description="Isi rencana pemasukan bulanan untuk melihat rekomendasi alokasi anggaran sesuai level kekayaanmu."
              action={<Button size="sm" onClick={() => setShowForm(true)}>Atur Sekarang</Button>}
            />
          ) : (
            <div className="space-y-3">
              {advice.alokasi.map((item, i) => {
                const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
                return (
                  <Card key={item.kategori}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color.bg} ${color.text}`}>{item.kategori}</span>
                      <span className="text-xs text-text-muted">{item.persen}%</span>
                    </div>
                    <p className="text-lg font-bold text-text-primary">{formatCurrency(item.nominal)}</p>
                    <div className="mt-2 h-1.5 bg-surface-hover rounded-full overflow-hidden">
                      <div className={`h-full ${color.bar}`} style={{ width: `${item.persen}%` }} />
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
