"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageShell } from "@/components/ui/PageShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, InputRupiah } from "@/components/ui/Input";
import { Toggle } from "@/components/ui/Toggle";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency, formatRupiahInput, parseRupiahInput } from "@/lib/format";
import { apiFetch, apiJson } from "@/lib/apiFetch";

type Snapshot = {
  kekayaanBersih: number;
  wealthLevel: number;
  wealthLevelName: string;
  totalAset: number;
  totalUtang: number;
  sisaUangBulanan: number;
  fundingTarget: number;
  selisihMenujuTarget: number;
};

type PreviewResponse = {
  baseline: Snapshot;
  after: Snapshot;
  diff: {
    kekayaanBersih: number;
    wealthLevel: number;
    sisaUangBulanan: number;
    fundingTarget: number;
    selisihMenujuTarget: number;
  };
  assumptions: Assumptions;
  notice: string;
};

type Assumptions = {
  pemasukanDeltaPersen: number;
  pengeluaranDeltaPersen: number;
  cicilanBaru?: number;
  mode: "simple" | "advanced";
};

type SavedScenario = {
  id: string;
  nama: string;
  assumptions: Assumptions;
  createdAt: string;
};

function formatSigned(n: number): string {
  const abs = formatCurrency(Math.abs(n));
  if (n > 0) return `+${abs}`;
  if (n < 0) return `−${formatCurrency(Math.abs(n))}`;
  return abs;
}

function SnapshotCard({
  title,
  snap,
  accent,
}: {
  title: string;
  snap: Snapshot;
  accent: "muted" | "brand";
}) {
  return (
    <Card className={accent === "brand" ? "border-brand/30 ring-1 ring-brand/15" : ""}>
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-3">{title}</p>
      <p className="text-2xl font-bold text-text-primary tabular-nums">{formatCurrency(snap.kekayaanBersih)}</p>
      <p className="text-sm text-text-secondary mt-1">
        Level {snap.wealthLevel >= 0 ? snap.wealthLevel : "—"}
        {snap.wealthLevelName ? ` · ${snap.wealthLevelName}` : ""}
      </p>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-text-muted">Sisa uang / bln</dt>
          <dd className="font-medium tabular-nums text-text-primary">{formatCurrency(snap.sisaUangBulanan)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-text-muted">Target dana pensiun</dt>
          <dd className="font-medium tabular-nums text-text-primary">{formatCurrency(snap.fundingTarget)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-text-muted">Gap ke target</dt>
          <dd className="font-medium tabular-nums text-text-primary">{formatCurrency(snap.selisihMenujuTarget)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-text-muted">Total utang</dt>
          <dd className="font-medium tabular-nums text-text-primary">{formatCurrency(snap.totalUtang)}</dd>
        </div>
      </dl>
    </Card>
  );
}

export default function ScenarioPlannerPage() {
  const [pemasukanDelta, setPemasukanDelta] = useState(0);
  const [pengeluaranDelta, setPengeluaranDelta] = useState(0);
  const [cicilanBaru, setCicilanBaru] = useState(0);
  const [cicilanDisplay, setCicilanDisplay] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<SavedScenario[]>([]);
  const [remaining, setRemaining] = useState(5);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const refreshSaved = useCallback(async () => {
    try {
      const data = await apiJson<{ scenarios: SavedScenario[]; remaining: number }>(
        "/api/insights/scenarios",
      );
      setSaved(data.scenarios);
      setRemaining(data.remaining);
    } catch {
      // daftar tersimpan opsional — preview tetap jalan
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiJson<{ scenarios: SavedScenario[]; remaining: number }>("/api/insights/scenarios")
      .then((data) => {
        if (!cancelled) {
          setSaved(data.scenarios);
          setRemaining(data.remaining);
        }
      })
      .catch(() => {
        /* optional */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        if (!cancelled) setLoading(true);
        if (!cancelled) setError("");
        const body: Assumptions = {
          pemasukanDeltaPersen: pemasukanDelta,
          pengeluaranDeltaPersen: pengeluaranDelta,
          cicilanBaru: cicilanBaru > 0 ? cicilanBaru : undefined,
          mode: advanced ? "advanced" : "simple",
        };
        try {
          const r = await apiFetch("/api/insights/scenario/preview", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const json = await r.json();
          if (!r.ok) throw new Error(json.error ?? "Gagal memuat simulasi");
          if (!cancelled) {
            setPreview(json as PreviewResponse);
            setLoading(false);
          }
        } catch (err) {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : "Gagal memuat simulasi");
            setPreview(null);
            setLoading(false);
          }
        }
      })();
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [pemasukanDelta, pengeluaranDelta, cicilanBaru, advanced]);

  async function handleSave() {
    const nama = saveName.trim();
    if (!nama) {
      setSaveError("Isi nama skenario dulu");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      await apiJson("/api/insights/scenarios", "POST", {
        nama,
        assumptions: {
          pemasukanDeltaPersen: pemasukanDelta,
          pengeluaranDeltaPersen: pengeluaranDelta,
          cicilanBaru: cicilanBaru > 0 ? cicilanBaru : undefined,
          mode: advanced ? "advanced" : "simple",
        },
      });
      setSaveName("");
      await refreshSaved();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiJson(`/api/insights/scenarios/${id}`, "DELETE");
      await refreshSaved();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Gagal menghapus");
    }
  }

  function applySaved(s: SavedScenario) {
    setPemasukanDelta(s.assumptions.pemasukanDeltaPersen);
    setPengeluaranDelta(s.assumptions.pengeluaranDeltaPersen);
    const cicilan = s.assumptions.cicilanBaru ?? 0;
    setCicilanBaru(cicilan);
    setCicilanDisplay(cicilan > 0 ? formatRupiahInput(String(cicilan)) : "");
    setAdvanced(s.assumptions.mode === "advanced");
  }

  return (
    <PageShell width="wide">
      <PageHeader
        title="Scenario Planner"
        subtitle="Ubah asumsi dan lihat dampaknya — tanpa mengubah catatan keuangan"
      />

      <div
        className="mb-6 rounded-xl border border-info-soft-border bg-info-soft px-4 py-3 text-sm text-info-text"
        role="status"
      >
        Simulasi — tidak mengubah catatan keuangan kamu
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Card>
          <h2 className="text-sm font-semibold text-text-primary mb-4">Asumsi</h2>

          <label className="block mb-5">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-text-secondary">Pemasukan</span>
              <span className="font-medium tabular-nums text-text-primary" data-testid="pemasukan-delta-label">
                {pemasukanDelta > 0 ? "+" : ""}
                {pemasukanDelta}%
              </span>
            </div>
            <input
              type="range"
              min={-50}
              max={50}
              step={1}
              value={pemasukanDelta}
              onChange={(e) => setPemasukanDelta(Number(e.target.value))}
              className="w-full accent-brand"
              aria-label="Delta pemasukan persen"
              data-testid="pemasukan-slider"
            />
          </label>

          <label className="block mb-5">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-text-secondary">Pengeluaran</span>
              <span className="font-medium tabular-nums text-text-primary">
                {pengeluaranDelta > 0 ? "+" : ""}
                {pengeluaranDelta}%
              </span>
            </div>
            <input
              type="range"
              min={-50}
              max={50}
              step={1}
              value={pengeluaranDelta}
              onChange={(e) => setPengeluaranDelta(Number(e.target.value))}
              className="w-full accent-brand"
              aria-label="Delta pengeluaran persen"
              data-testid="pengeluaran-slider"
            />
          </label>

          <div className="mb-5">
            <InputRupiah
              label="Cicilan baru (pokok utang, opsional)"
              value={cicilanDisplay}
              onChange={(v) => {
                setCicilanDisplay(v);
                setCicilanBaru(parseRupiahInput(v));
              }}
              hint="Menambah utang pada neraca simulasi saja"
            />
          </div>

          <Toggle
            id="scenario-mode-advanced"
            checked={advanced}
            onChange={setAdvanced}
            label="Mode pensiun lanjutan (PV & inflasi)"
          />
        </Card>

        <div className="space-y-4">
          {error && (
            <Card className="text-center" role="alert">
              <p className="text-sm font-medium text-danger-text mb-1">Tidak bisa menampilkan simulasi</p>
              <p className="text-xs text-text-muted">{error}</p>
            </Card>
          )}

          {loading && !preview && (
            <div className="space-y-3">
              <Skeleton className="h-40 w-full rounded-xl" />
              <Skeleton className="h-40 w-full rounded-xl" />
            </div>
          )}

          {preview && (
            <>
              <div className="grid gap-4 sm:grid-cols-2" data-testid="scenario-before-after">
                <SnapshotCard title="Sebelum" snap={preview.baseline} accent="muted" />
                <SnapshotCard title="Sesudah" snap={preview.after} accent="brand" />
              </div>
              <Card>
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-2">Selisih</p>
                <ul className="text-sm space-y-1.5">
                  <li className="flex justify-between gap-3">
                    <span className="text-text-muted">Kekayaan bersih</span>
                    <span className="tabular-nums font-medium" data-testid="diff-kekayaan">
                      {formatSigned(preview.diff.kekayaanBersih)}
                    </span>
                  </li>
                  <li className="flex justify-between gap-3">
                    <span className="text-text-muted">Level</span>
                    <span className="tabular-nums font-medium">
                      {preview.diff.wealthLevel > 0 ? "+" : ""}
                      {preview.diff.wealthLevel}
                    </span>
                  </li>
                  <li className="flex justify-between gap-3">
                    <span className="text-text-muted">Sisa uang / bln</span>
                    <span className="tabular-nums font-medium">{formatSigned(preview.diff.sisaUangBulanan)}</span>
                  </li>
                  <li className="flex justify-between gap-3">
                    <span className="text-text-muted">Gap ke target</span>
                    <span className="tabular-nums font-medium">{formatSigned(preview.diff.selisihMenujuTarget)}</span>
                  </li>
                </ul>
              </Card>
            </>
          )}
        </div>
      </div>

      <Card className="mt-6">
        <h2 className="text-sm font-semibold text-text-primary mb-1">Skenario tersimpan</h2>
        <p className="text-xs text-text-muted mb-4">Maksimal 5 skenario · sisa slot: {remaining}</p>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-end mb-4">
          <div className="flex-1">
            <Input
              label="Nama skenario"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Mis. Naik gaji 10%"
              maxLength={120}
            />
          </div>
          <Button onClick={handleSave} loading={saving} disabled={remaining <= 0} className="sm:mb-0.5">
            Simpan skenario
          </Button>
        </div>
        {saveError && (
          <p className="text-xs text-danger-text mb-3" role="alert">
            {saveError}
          </p>
        )}

        {saved.length === 0 ? (
          <p className="text-sm text-text-muted">Belum ada skenario tersimpan.</p>
        ) : (
          <ul className="divide-y divide-border">
            {saved.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                <button
                  type="button"
                  className="text-left min-w-0 hover:text-brand transition-colors"
                  onClick={() => applySaved(s)}
                >
                  <p className="text-sm font-medium text-text-primary truncate">{s.nama}</p>
                  <p className="text-xs text-text-muted">
                    Pemasukan {s.assumptions.pemasukanDeltaPersen > 0 ? "+" : ""}
                    {s.assumptions.pemasukanDeltaPersen}% · Pengeluaran{" "}
                    {s.assumptions.pengeluaranDeltaPersen > 0 ? "+" : ""}
                    {s.assumptions.pengeluaranDeltaPersen}% ·{" "}
                    {s.assumptions.mode === "advanced" ? "Lanjutan" : "Sederhana"}
                  </p>
                </button>
                <Button variant="ghost" size="sm" onClick={() => void handleDelete(s.id)}>
                  Hapus
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </PageShell>
  );
}
