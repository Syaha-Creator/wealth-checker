"use client";

import { useEffect, useState, useCallback } from "react";
import type { FormEvent } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageShell } from "@/components/ui/PageShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, InputRupiah, RequiredMark, Select } from "@/components/ui/Input";
import { SkeletonHero, Skeleton } from "@/components/ui/Skeleton";
import { Tabs, tabPanelId, tabButtonId } from "@/components/ui/Tabs";
import { formatCurrency, parseRupiahInput } from "@/lib/format";
import { apiFetch as apiFetchRaw } from "@/lib/apiFetch";

type Account = { id: string; nama: string; saldoCache: string; isActive: boolean };

type AssetRow = { id: string; namaAset: string; jumlah: string; hargaBeliRataRata: string };

type AssetSummaryItem = {
  id: string; namaAset: string; jumlah: number; hargaBeliRataRata: number; nilaiSaatIni: number;
};
type AssetSummary = { totalNilai: number; totalUntungRugi: number; items: AssetSummaryItem[] };

type AssetKind = "barang" | "investasi";

const ASSET_TABS_ID_PREFIX = "assets";
const ASSET_TABS: { id: AssetKind; label: string }[] = [
  { id: "barang", label: "Barang" },
  { id: "investasi", label: "Investasi" },
];

async function apiFetch(path: string, method: string, body?: unknown) {
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
  if (res.status === 204) return null;
  return res.json();
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function PlusIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth={2} strokeLinecap="round" /></svg>;
}

function BarangIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" />
      <path d="M3 8l9 5 9-5M12 13v8" />
    </svg>
  );
}

function InvestasiIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path d="M3 3v18h18" />
      <path d="M7 14l4-4 3 3 5-6" />
    </svg>
  );
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="mb-4 p-3 bg-danger-soft border border-danger-soft-border rounded-xl flex items-start gap-2" role="alert">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-danger shrink-0 mt-0.5" aria-hidden="true"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
      <p className="text-sm text-danger-text flex-1">{message}</p>
      {onRetry && <button onClick={onRetry} className="text-xs text-danger-text font-medium hover:underline shrink-0">Coba lagi</button>}
    </div>
  );
}

// ─── Tab: Barang / Investasi (parameterized — sama pola untuk keduanya) ──────

function AssetTab({
  kind, summary, allRows, accounts, accountsLoaded, onChanged,
}: {
  kind: AssetKind;
  summary: AssetSummary | null;
  allRows: AssetRow[];
  accounts: Account[];
  accountsLoaded: boolean;
  onChanged: () => Promise<void>;
}) {
  const buyType = kind === "barang" ? "beli_barang" : "beli_investasi";
  const sellType = kind === "barang" ? "jual_barang" : "jual_investasi";
  const label = kind === "barang" ? "Barang" : "Investasi";
  const Icon = kind === "barang" ? BarangIcon : InvestasiIcon;

  const [showAddForm, setShowAddForm] = useState(false);
  const [namaAset, setNamaAset] = useState("");
  const [jumlah, setJumlah] = useState("");
  const [hargaSatuan, setHargaSatuan] = useState("");
  const [accountId, setAccountId] = useState("");
  const [tanggal, setTanggal] = useState(todayStr());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [sellingId, setSellingId] = useState<string | null>(null);
  const [sellJumlah, setSellJumlah] = useState("");
  const [sellHargaSatuan, setSellHargaSatuan] = useState("");
  const [sellAccountId, setSellAccountId] = useState("");
  const [sellTanggal, setSellTanggal] = useState(todayStr());
  const [sellSaving, setSellSaving] = useState(false);
  const [sellError, setSellError] = useState("");
  // Audit temuan 5 (skalabilitas): daftar aset murni scroll vertikal tanpa
  // pencarian — muncul begitu daftar cukup panjang untuk butuh itu.
  const [search, setSearch] = useState("");

  const resetAddForm = () => {
    setNamaAset(""); setJumlah(""); setHargaSatuan(""); setAccountId(""); setTanggal(todayStr()); setFormError("");
  };

  // Sprint 11/12: saat nama aset yang diketik cocok dengan aset yang sudah ada
  // (case-insensitive), tampilkan harga rata-rata berjalan saat ini sebagai
  // referensi — tidak otomatis mengisi field (harga beli baru bisa berbeda).
  const matchedExisting = allRows.find((r) => r.namaAset.toLowerCase() === namaAset.trim().toLowerCase());

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true); setFormError("");
    try {
      await apiFetch("/api/transactions", "POST", {
        tanggal, type: buyType, namaAset, jumlah: Number(jumlah), hargaSatuan: parseRupiahInput(hargaSatuan), accountId,
      });
      resetAddForm();
      setShowAddForm(false);
      await onChanged();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const openSellForm = (id: string) => {
    setSellingId(id); setSellJumlah(""); setSellHargaSatuan(""); setSellAccountId(""); setSellTanggal(todayStr()); setSellError("");
  };

  const handleSell = async (e: FormEvent, item: AssetSummaryItem) => {
    e.preventDefault();
    setSellSaving(true); setSellError("");
    try {
      await apiFetch("/api/transactions", "POST", {
        tanggal: sellTanggal, type: sellType, namaAset: item.namaAset,
        jumlah: Number(sellJumlah), hargaSatuan: parseRupiahInput(sellHargaSatuan), accountId: sellAccountId,
      });
      setSellingId(null);
      await onChanged();
    } catch (err: unknown) {
      setSellError(err instanceof Error ? err.message : "Gagal mencatat penjualan");
    } finally {
      setSellSaving(false);
    }
  };

  if (accountsLoaded && accounts.length === 0) {
    return (
      <EmptyState
        icon={<Icon />}
        title="Belum ada rekening aktif"
        description={`Tambahkan rekening dulu untuk mencatat ${kind === "barang" ? "pembelian barang" : "investasi"}`}
        action={<Button href="/accounts" size="sm">Tambah Rekening</Button>}
      />
    );
  }

  const items = summary?.items ?? [];
  const untungRugi = summary?.totalUntungRugi ?? 0;
  const filteredItems = search.trim()
    ? items.filter((item) => item.namaAset.toLowerCase().includes(search.trim().toLowerCase()))
    : items;

  return (
    <div>
      <div className="bg-brand text-white rounded-2xl p-5 sm:p-6 mb-6">
        <p className="text-white/70 text-sm">Total Nilai {label}</p>
        <p className="text-2xl sm:text-3xl font-bold mt-1">{formatCurrency(summary?.totalNilai ?? 0)}</p>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-white/70">Untung/Rugi Terealisasi:</span>
          <span className={`text-xs font-semibold ${untungRugi >= 0 ? "text-white" : "text-white"}`}>
            {untungRugi >= 0 ? "+" : ""}{formatCurrency(untungRugi)}
          </span>
        </div>
      </div>

      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={() => setShowAddForm((v) => !v)}>
          <PlusIcon /> Beli {label}
        </Button>
      </div>

      {showAddForm && (
        <Card as="form" onSubmit={handleAdd} padding="lg" className="mb-6">
          <h3 className="font-semibold text-text-primary mb-4">Beli {label}</h3>
          {formError && <p role="alert" className="text-sm text-danger-text mb-3">{formError}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="asset-nama" className="block text-sm font-medium text-text-secondary mb-1">
                Nama {label}
                <RequiredMark />
              </label>
              <input
                id="asset-nama"
                list="asset-nama-options"
                className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/30"
                placeholder={kind === "barang" ? "Cth: Emas 10gr, Laptop" : "Cth: Saham BBCA, Reksadana"}
                value={namaAset}
                onChange={(e) => setNamaAset(e.target.value)}
                autoComplete="off"
                required
              />
              <datalist id="asset-nama-options">
                {allRows.map((r) => <option key={r.id} value={r.namaAset} />)}
              </datalist>
              {matchedExisting && (
                <p className="text-xs text-text-muted mt-1">
                  Harga rata-rata saat ini: {formatCurrency(matchedExisting.hargaBeliRataRata)} · Kepemilikan: {Number(matchedExisting.jumlah).toLocaleString("id-ID")}
                </p>
              )}
            </div>
            <Input
              id="asset-jumlah"
              type="number"
              step="any"
              min="0.01"
              label="Jumlah/Unit"
              value={jumlah}
              onChange={(e) => setJumlah(e.target.value)}
              required
            />
            <InputRupiah id="asset-harga" label="Harga Satuan" value={hargaSatuan} onChange={setHargaSatuan} required />
            <Select
              id="asset-account"
              label="Rekening Sumber"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              required
            >
              <option value="">Pilih rekening</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.nama}</option>)}
            </Select>
            <Input id="asset-tanggal" type="date" label="Tanggal" value={tanggal} onChange={(e) => setTanggal(e.target.value)} required />
          </div>
          <div className="flex gap-2 mt-4 max-w-sm">
            <Button type="button" variant="secondary" fullWidth onClick={() => { setShowAddForm(false); resetAddForm(); }}>Batal</Button>
            <Button type="submit" fullWidth loading={saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
          </div>
        </Card>
      )}

      {items.length === 0 ? (
        <EmptyState icon={<Icon />} title={`Belum ada ${label.toLowerCase()} tercatat`} description={`Catat pembelian ${label.toLowerCase()} untuk mulai melacak nilai & keuntungannya`} />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 xl:gap-4">
          {items.length > 5 && (
            <div className="relative col-span-full">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="true">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder={`Cari nama ${label.toLowerCase()}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label={`Cari ${label.toLowerCase()}`}
                className="w-full pl-8 pr-3 py-2 text-sm bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              />
            </div>
          )}
          {filteredItems.length === 0 && (
            <p className="col-span-full text-sm text-text-muted text-center py-6">Tidak ada {label.toLowerCase()} yang cocok dengan &quot;{search}&quot;</p>
          )}
          {filteredItems.map((item) => {
            const sellJumlahValue = Number(sellJumlah) || 0;
            const sellExceedsOwned = sellJumlahValue > item.jumlah;
            const sellHargaValue = parseRupiahInput(sellHargaSatuan);
            const estimasiUntungRugi = (sellHargaValue - item.hargaBeliRataRata) * sellJumlahValue;

            return (
              <Card key={item.id}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-text-primary truncate">{item.namaAset}</p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {item.jumlah.toLocaleString("id-ID")} unit · avg {formatCurrency(item.hargaBeliRataRata)}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => (sellingId === item.id ? setSellingId(null) : openSellForm(item.id))}>
                    Jual
                  </Button>
                </div>
                <p className="text-lg font-bold text-text-primary">{formatCurrency(item.nilaiSaatIni)}</p>

                {sellingId === item.id && (
                  <form onSubmit={(e) => handleSell(e, item)} className="mt-4 pt-4 border-t border-border space-y-3">
                    {sellError && <p className="text-sm text-danger-text">{sellError}</p>}
                    <Input
                      id={`sell-jumlah-${item.id}`}
                      type="number"
                      step="any"
                      min="0.01"
                      label="Jumlah Dijual"
                      value={sellJumlah}
                      onChange={(e) => setSellJumlah(e.target.value)}
                      hint={sellExceedsOwned ? undefined : `Kepemilikan: ${item.jumlah.toLocaleString("id-ID")} unit`}
                      error={sellExceedsOwned ? `Jumlah melebihi kepemilikan (${item.jumlah.toLocaleString("id-ID")} unit)` : undefined}
                      required
                    />
                    <InputRupiah
                      id={`sell-harga-${item.id}`}
                      label="Harga Jual per Unit"
                      value={sellHargaSatuan}
                      onChange={setSellHargaSatuan}
                      hint={sellJumlahValue > 0 && sellHargaValue > 0 ? `Estimasi ${estimasiUntungRugi >= 0 ? "untung" : "rugi"}: ${formatCurrency(Math.abs(estimasiUntungRugi))}` : undefined}
                      required
                    />
                    <Select
                      id={`sell-account-${item.id}`}
                      label="Rekening Tujuan"
                      value={sellAccountId}
                      onChange={(e) => setSellAccountId(e.target.value)}
                      required
                    >
                      <option value="">Pilih rekening</option>
                      {accounts.map((a) => <option key={a.id} value={a.id}>{a.nama}</option>)}
                    </Select>
                    <Input id={`sell-tanggal-${item.id}`} type="date" label="Tanggal" value={sellTanggal} onChange={(e) => setSellTanggal(e.target.value)} required />
                    <div className="flex gap-2 max-w-sm">
                      <Button type="button" variant="secondary" fullWidth onClick={() => setSellingId(null)}>Batal</Button>
                      <Button type="submit" fullWidth loading={sellSaving} disabled={sellExceedsOwned}>{sellSaving ? "Memproses..." : "Jual"}</Button>
                    </div>
                  </form>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function AssetsPage() {
  const [tab, setTab] = useState<AssetKind>("barang");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [fixedSummary, setFixedSummary] = useState<AssetSummary | null>(null);
  const [liquidSummary, setLiquidSummary] = useState<AssetSummary | null>(null);
  const [fixedAll, setFixedAll] = useState<AssetRow[]>([]);
  const [liquidAll, setLiquidAll] = useState<AssetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");

  const refetch = useCallback(async () => {
    setFetchError("");
    try {
      const [accData, fixedSumData, liquidSumData, fixedAllData, liquidAllData] = await Promise.all([
        apiFetch("/api/accounts", "GET") as Promise<Account[]>,
        apiFetch("/api/assets/fixed/summary", "GET") as Promise<AssetSummary>,
        apiFetch("/api/assets/liquid/summary", "GET") as Promise<AssetSummary>,
        apiFetch("/api/assets/fixed?all=true", "GET") as Promise<AssetRow[]>,
        apiFetch("/api/assets/liquid?all=true", "GET") as Promise<AssetRow[]>,
      ]);
      setAccounts(accData.filter((a) => a.isActive));
      setAccountsLoaded(true);
      setFixedSummary(fixedSumData);
      setLiquidSummary(liquidSumData);
      setFixedAll(fixedAllData);
      setLiquidAll(liquidAllData);
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : "Gagal memuat data aset");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load: inline fetch to avoid calling setState synchronously in the effect body.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiFetch("/api/accounts", "GET") as Promise<Account[]>,
      apiFetch("/api/assets/fixed/summary", "GET") as Promise<AssetSummary>,
      apiFetch("/api/assets/liquid/summary", "GET") as Promise<AssetSummary>,
      apiFetch("/api/assets/fixed?all=true", "GET") as Promise<AssetRow[]>,
      apiFetch("/api/assets/liquid?all=true", "GET") as Promise<AssetRow[]>,
    ])
      .then(([accData, fixedSumData, liquidSumData, fixedAllData, liquidAllData]) => {
        if (cancelled) return;
        setAccounts(accData.filter((a) => a.isActive));
        setAccountsLoaded(true);
        setFixedSummary(fixedSumData);
        setLiquidSummary(liquidSumData);
        setFixedAll(fixedAllData);
        setLiquidAll(liquidAllData);
      })
      .catch((err: unknown) => {
        if (!cancelled) setFetchError(err instanceof Error ? err.message : "Gagal memuat data aset");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <PageShell width="wide">
      <PageHeader title="Aset" subtitle="Lacak barang & investasi Anda" />

      <Tabs
        items={ASSET_TABS}
        value={tab}
        onChange={setTab}
        idPrefix={ASSET_TABS_ID_PREFIX}
        aria-label="Barang atau Investasi"
        fitted
        className="mb-6 max-w-sm"
      />

      {fetchError && <ErrorBanner message={fetchError} onRetry={refetch} />}

      <div
        role="tabpanel"
        id={tabPanelId(ASSET_TABS_ID_PREFIX, tab)}
        aria-labelledby={tabButtonId(ASSET_TABS_ID_PREFIX, tab)}
        tabIndex={0}
      >
        {loading ? (
          <div className="space-y-4">
            <SkeletonHero className="h-28" />
            <div className="flex justify-end"><Skeleton className="h-9 w-32 rounded-xl" /></div>
            {[0, 1].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
          </div>
        ) : tab === "barang" ? (
          <AssetTab kind="barang" summary={fixedSummary} allRows={fixedAll} accounts={accounts} accountsLoaded={accountsLoaded} onChanged={refetch} />
        ) : (
          <AssetTab kind="investasi" summary={liquidSummary} allRows={liquidAll} accounts={accounts} accountsLoaded={accountsLoaded} onChanged={refetch} />
        )}
      </div>
    </PageShell>
  );
}
