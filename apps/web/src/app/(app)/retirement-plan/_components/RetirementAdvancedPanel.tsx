"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatCurrency, formatCurrencyShort } from "@/lib/format";
import { apiFetch as apiFetchRaw } from "@/lib/apiFetch";
import { useToast } from "@/components/ui/Toast";

interface RetirementAssumptionsData {
  inflasiPersen: number | string;
  returnInvestasiPersen: number | string;
  useAdvancedFormula: boolean;
}

interface AdvancedPlanResponse {
  hasProfile: true;
  plan: {
    danaDibutuhkanSebelumPensiun: number;
    danaDibutuhkanSelamaPensiun: number;
    totalDanaPensiunWarisan: number;
    danaDibutuhkanSekarang: number;
    asumsi: { inflasiPersen: number; returnInvestasiPersen: number };
  };
}

async function apiFetch(path: string, method = "GET", body?: unknown) {
  const res = await apiFetchRaw(`${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Gagal");
  }
  return res.json();
}

interface RetirementAdvancedPanelProps {
  totalDanaPensiunWarisanSimple: number;
}

/**
 * Sprint 26 (Fase 4) — mode "Lanjutan": formula present-value/inflasi-adjusted
 * di samping mode "Sederhana" (default, tidak diubah). Komponen ini
 * mengelola state asumsi + fetch plan mode=advanced sendiri, terpisah dari
 * RetirementPlanPage supaya halaman utama tidak terpengaruh kalau bagian ini gagal.
 *
 * Mount hanya membaca (GET). PATCH assumptions hanya saat user klik "Terapkan Asumsi".
 */
export function RetirementAdvancedPanel({ totalDanaPensiunWarisanSimple }: RetirementAdvancedPanelProps) {
  const { showToast } = useToast();
  const [inflasiPersen, setInflasiPersen] = useState(5);
  const [returnInvestasiPersen, setReturnInvestasiPersen] = useState(8);
  const [advancedPlan, setAdvancedPlan] = useState<AdvancedPlanResponse["plan"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      setLoading(true);
      setError("");
      try {
        const data: RetirementAssumptionsData = await apiFetch("/api/wealth/retirement-assumptions");
        if (cancelled) return;
        const inflasi = Number(data.inflasiPersen);
        const returnInvestasi = Number(data.returnInvestasiPersen);
        setInflasiPersen(inflasi);
        setReturnInvestasiPersen(returnInvestasi);

        // Read-only: pakai asumsi tersimpan di server. Jangan PATCH di mount —
        // membuka panel tidak boleh mengubah useAdvancedFormula / rates.
        const plan: AdvancedPlanResponse = await apiFetch("/api/wealth/retirement-plan?mode=advanced");
        if (cancelled) return;
        setAdvancedPlan(plan.plan);
      } catch (err: unknown) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Gagal memuat proyeksi mode lanjutan");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPreview();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    if (!Number.isFinite(inflasiPersen) || !Number.isFinite(returnInvestasiPersen)) {
      const msg = "Isi asumsi inflasi dan return dengan angka yang valid";
      setError(msg);
      showToast({ type: "error", message: msg });
      return;
    }
    setSaving(true);
    setError("");
    try {
      await apiFetch("/api/wealth/retirement-assumptions", "PATCH", {
        inflasiPersen,
        returnInvestasiPersen,
        useAdvancedFormula: true,
      });
      const plan: AdvancedPlanResponse = await apiFetch("/api/wealth/retirement-plan?mode=advanced");
      setAdvancedPlan(plan.plan);
      showToast({ type: "success", message: "Asumsi pensiun berhasil diterapkan" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menerapkan asumsi";
      setError(msg);
      showToast({ type: "error", message: msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-brand/30">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h2 className="text-sm font-semibold text-text-secondary">Mode Lanjutan: Present Value &amp; Inflasi</h2>
          <p className="text-xs text-text-muted mt-1">
            Nilai uang menyusut karena inflasi. Mode ini menghitung berapa dana yang benar-benar kamu butuhkan di masa depan (nilai rupiah saat itu), lalu berapa yang perlu kamu investasikan <em>hari ini</em> supaya cukup — dengan asumsi hasil investasi tertentu per tahun.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div>
          <label htmlFor="inflasi-persen" className="block text-xs font-medium text-text-secondary mb-1">Asumsi Inflasi (%/tahun)</label>
          <input
            id="inflasi-persen"
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={Number.isFinite(inflasiPersen) ? inflasiPersen : ""}
            onChange={(e) => {
              const raw = e.target.value;
              setInflasiPersen(raw === "" ? Number.NaN : Number(raw));
            }}
            className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </div>
        <div>
          <label htmlFor="return-investasi-persen" className="block text-xs font-medium text-text-secondary mb-1">Asumsi Return Investasi (%/tahun)</label>
          <input
            id="return-investasi-persen"
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={Number.isFinite(returnInvestasiPersen) ? returnInvestasiPersen : ""}
            onChange={(e) => {
              const raw = e.target.value;
              setReturnInvestasiPersen(raw === "" ? Number.NaN : Number(raw));
            }}
            className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </div>
      </div>

      <Button type="button" size="sm" variant="secondary" loading={saving} onClick={handleSave}>
        Terapkan Asumsi
      </Button>

      {error && <p className="text-sm text-danger-text mt-3">{error}</p>}

      {loading && !advancedPlan ? (
        <div className="h-20 flex items-center justify-center mt-3">
          <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" aria-label="Memuat..." />
        </div>
      ) : advancedPlan ? (
        <div className="mt-4 pt-4 border-t border-border">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">Perbandingan Sederhana vs Lanjutan</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-text-muted">Sederhana (nilai hari ini)</p>
              <p className="text-base font-bold text-text-primary mt-1">{formatCurrencyShort(totalDanaPensiunWarisanSimple)}</p>
              <p className="text-xs text-text-muted mt-0.5">{formatCurrency(totalDanaPensiunWarisanSimple)}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Lanjutan (nilai saat pensiun, inflasi-adjusted)</p>
              <p className="text-base font-bold text-brand mt-1">{formatCurrencyShort(advancedPlan.totalDanaPensiunWarisan)}</p>
              <p className="text-xs text-text-muted mt-0.5">{formatCurrency(advancedPlan.totalDanaPensiunWarisan)}</p>
            </div>
          </div>
          <div className="mt-4 p-3 rounded-xl bg-brand-soft border border-brand-soft-border">
            <p className="text-xs text-text-secondary">Lump sum yang perlu diinvestasikan sekarang (asumsi return {advancedPlan.asumsi.returnInvestasiPersen}%/tahun):</p>
            <p className="text-lg font-bold text-brand mt-1">{formatCurrency(advancedPlan.danaDibutuhkanSekarang)}</p>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
