"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageShell } from "@/components/ui/PageShell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { RequiredMark } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatRupiahInput, parseRupiahInput } from "@/lib/format";
import { apiFetch as apiFetchRaw } from "@/lib/apiFetch";
import { useToast } from "@/components/ui/Toast";

type Account = { id: string; nama: string; saldoCache: string; isActive: boolean };
type Categories = { pendapatan: string[]; pengeluaran: string[] };

type Transaction = {
  id: string;
  tanggal: string;
  type: string;
  kategori: string | null;
  rincian: string | null;
  accountId: string | null;
  relatedEntityId: string | null;
  nominal: string;
};

// Sama seperti label di halaman list — dipertahankan lokal di sini karena tiap
// halaman punya konfigurasi tampilannya sendiri (lihat transactions/page.tsx).
const TYPE_LABEL: Record<string, string> = {
  pendapatan: "Pemasukan",
  pengeluaran: "Pengeluaran",
  transfer: "Transfer",
  pinjaman_utang: "Pinjam Utang",
  bayar_utang: "Bayar Utang",
  pemberian_piutang: "Beri Piutang",
  penerimaan_piutang: "Terima Piutang",
  beli_barang: "Beli Barang",
  jual_barang: "Jual Barang",
  beli_investasi: "Investasi",
  jual_investasi: "Cairkan Investasi",
};

const ASSET_TYPES = new Set(["beli_barang", "jual_barang", "beli_investasi", "jual_investasi"]);

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
  return res.json();
}

const ChevronDown = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-text-muted pointer-events-none shrink-0" aria-hidden="true">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

export default function EditTransactionPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { showToast } = useToast();
  const id = params.id;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [trx, setTrx] = useState<Transaction | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Categories>({ pendapatan: [], pengeluaran: [] });

  const [tanggal, setTanggal] = useState("");
  const [nominal, setNominal] = useState("");
  const [kategori, setKategori] = useState("");
  const [rincian, setRincian] = useState("");
  const [accountId, setAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ nominal?: string; accountId?: string; toAccountId?: string }>({});

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiFetchRaw(`/api/transactions/${id}`, { credentials: "include" }).then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? "Transaksi tidak ditemukan" : "Gagal memuat transaksi");
        return r.json();
      }),
      apiFetchRaw(`/api/accounts`, { credentials: "include" }).then((r) => r.json()),
      apiFetchRaw(`/api/transactions/categories`, { credentials: "include" }).then((r) => r.json()).catch(() => null),
    ])
      .then(([txData, accData, catData]: [Transaction, Account[], Categories | null]) => {
        if (cancelled) return;
        setTrx(txData);
        setTanggal(txData.tanggal);
        setNominal(txData.nominal ? Number(txData.nominal).toLocaleString("id-ID") : "");
        setKategori(txData.kategori ?? "");
        setRincian(txData.rincian ?? "");
        setAccountId(txData.accountId ?? "");
        if (txData.type === "transfer") setToAccountId(txData.relatedEntityId ?? "");
        setAccounts(accData);
        if (catData) setCategories(catData);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Gagal memuat transaksi");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id]);

  const isAssetType = trx ? ASSET_TYPES.has(trx.type) : false;
  const isTransfer = trx?.type === "transfer";
  const showKategori = trx && !isTransfer && !isAssetType;
  const kategoriOptions = trx?.type === "pendapatan" ? categories.pendapatan : categories.pengeluaran;

  // Sertakan rekening yang sedang dipakai transaksi ini meski sudah nonaktif,
  // supaya dropdown tidak diam-diam berpindah ke rekening lain saat render.
  const accountOptions = accounts.filter((a) => a.isActive || a.id === accountId);
  const toAccountOptions = accounts.filter((a) => (a.isActive || a.id === toAccountId) && a.id !== accountId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trx) return;

    const nominalParsed = parseRupiahInput(nominal);
    const errs: { nominal?: string; accountId?: string; toAccountId?: string } = {};
    if (!nominal || nominalParsed <= 0) {
      errs.nominal = "Masukkan nominal transaksi";
    }
    if (!accountId) {
      errs.accountId = "Pilih rekening";
    }
    if (isTransfer) {
      if (!toAccountId) {
        errs.toAccountId = "Pilih rekening tujuan";
      } else if (accountId === toAccountId) {
        errs.toAccountId = "Rekening asal dan tujuan tidak boleh sama";
      }
    }
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) {
      setError("Periksa kembali isian yang ditandai merah di bawah.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await apiFetch(`/api/transactions/${id}`, "PATCH", {
        tanggal,
        kategori: showKategori ? (kategori || undefined) : undefined,
        rincian: rincian || undefined,
        accountId: accountId || undefined,
        toAccountId: isTransfer ? toAccountId : undefined,
        nominal: nominalParsed,
      });
      showToast({ type: "success", message: "Transaksi berhasil diperbarui" });
      router.push("/transactions");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan perubahan";
      setError(msg);
      showToast({ type: "error", message: msg });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageShell width="narrow">
        <PageHeader title="Edit Transaksi" onBack={() => router.back()} />
        <div className="max-w-xl mx-auto">
          <Skeleton className="h-5 w-40 mb-4" />
          <div className="space-y-4">
            <Skeleton className="h-24 rounded-2xl" />
            <div className="bg-surface rounded-2xl border border-border divide-y divide-border overflow-hidden">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between px-5 py-3">
                  <Skeleton className="h-3.5 w-20" />
                  <Skeleton className="h-3.5 w-24" />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-11 flex-1 rounded-xl" />
              <Skeleton className="h-11 flex-1 rounded-xl" />
            </div>
          </div>
        </div>
      </PageShell>
    );
  }

  if (loadError || !trx) {
    return (
      <PageShell width="narrow">
        <PageHeader title="Edit Transaksi" onBack={() => router.back()} />
        <div className="max-w-xl mx-auto p-4 bg-danger-soft border border-danger-soft-border rounded-xl text-sm text-danger-text" role="alert">
          {loadError || "Transaksi tidak ditemukan"}
        </div>
      </PageShell>
    );
  }

  if (isAssetType) {
    return (
      <PageShell width="narrow">
        <PageHeader title="Edit Transaksi" onBack={() => router.back()} />
        <div className="max-w-xl mx-auto p-4 bg-warning-soft border border-warning-soft-border rounded-xl text-sm text-warning-text" role="alert">
          Transaksi beli/jual aset tidak bisa diedit karena mempengaruhi harga rata-rata berjalan. Catat transaksi penyesuaian baru jika diperlukan.
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell width="narrow">
      <PageHeader title="Edit Transaksi" onBack={() => router.back()} />

      <div className="max-w-xl mx-auto">
        {/* Tipe transaksi — read-only, tidak bisa diubah lewat edit */}
        <div className="mb-4 flex items-center gap-2">
          <span className="text-xs text-text-muted">Tipe transaksi</span>
          <Badge variant="neutral">{TYPE_LABEL[trx.type] ?? trx.type}</Badge>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-danger-soft border border-danger-soft-border text-danger-text text-sm rounded-xl flex items-start gap-2" role="alert">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-danger shrink-0 mt-0.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </div>
          )}

          {/* Nominal */}
          <div className={`bg-surface rounded-2xl p-5 border transition-colors ${fieldErrors.nominal ? "border-danger bg-danger-soft/40" : "border-border"}`}>
            <label htmlFor="nominal" className="block text-xs font-medium text-text-muted mb-2 uppercase tracking-wide">Nominal<RequiredMark /></label>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-light text-text-primary" aria-hidden="true">Rp</span>
              <input
                id="nominal"
                type="text"
                inputMode="numeric"
                aria-invalid={fieldErrors.nominal ? true : undefined}
                aria-describedby={fieldErrors.nominal ? "nominal-error" : undefined}
                className="flex-1 min-w-0 text-3xl font-bold bg-transparent focus:outline-none text-text-primary"
                placeholder="0"
                value={nominal}
                onChange={(e) => { setNominal(formatRupiahInput(e.target.value)); setFieldErrors((f) => ({ ...f, nominal: undefined })); }}
                required
              />
            </div>
            {fieldErrors.nominal && (
              <p id="nominal-error" role="alert" className="text-xs text-danger-text mt-2">{fieldErrors.nominal}</p>
            )}
          </div>

          <div className="bg-surface rounded-2xl border border-border divide-y divide-border">
            {/* Tanggal */}
            <div className="flex items-center px-5 py-3">
              <label htmlFor="tanggal" className="text-sm text-text-muted w-28">Tanggal<RequiredMark /></label>
              <input
                id="tanggal"
                type="date"
                className="flex-1 text-sm text-text-primary bg-transparent focus:outline-none text-right"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                required
              />
            </div>

            {/* Rekening asal */}
            <div className={`px-5 py-3 ${fieldErrors.accountId ? "bg-danger-soft/40" : ""}`}>
              <div className="flex items-center">
                <label htmlFor="account" className="text-sm text-text-muted w-28">
                  {isTransfer ? "Dari Rekening" : "Rekening"}<RequiredMark />
                </label>
                <div className="flex-1 flex items-center gap-1 justify-end">
                  <select
                    id="account"
                    aria-invalid={fieldErrors.accountId ? true : undefined}
                    aria-describedby={fieldErrors.accountId ? "account-error" : undefined}
                    className="text-sm text-text-primary bg-transparent focus:outline-none text-right appearance-none"
                    value={accountId}
                    onChange={(e) => { setAccountId(e.target.value); setFieldErrors((f) => ({ ...f, accountId: undefined })); }}
                  >
                    {accountOptions.map((a) => (
                      <option key={a.id} value={a.id}>{a.nama}{!a.isActive ? " (nonaktif)" : ""}</option>
                    ))}
                    {accountOptions.length === 0 && <option value="">Tidak ada rekening</option>}
                  </select>
                  <ChevronDown />
                </div>
              </div>
              {fieldErrors.accountId && (
                <p id="account-error" role="alert" className="text-xs text-danger-text mt-1 text-right">{fieldErrors.accountId}</p>
              )}
            </div>

            {/* Rekening tujuan (transfer) */}
            {isTransfer && (
              <div className={`px-5 py-3 ${fieldErrors.toAccountId ? "bg-danger-soft/40" : ""}`}>
                <div className="flex items-center">
                  <label htmlFor="to-account" className="text-sm text-text-muted w-28">Ke Rekening<RequiredMark /></label>
                  <div className="flex-1 flex items-center gap-1 justify-end">
                    <select
                      id="to-account"
                      aria-invalid={fieldErrors.toAccountId ? true : undefined}
                      aria-describedby={fieldErrors.toAccountId ? "to-account-error" : undefined}
                      className="text-sm text-text-primary bg-transparent focus:outline-none text-right appearance-none"
                      value={toAccountId}
                      onChange={(e) => { setToAccountId(e.target.value); setFieldErrors((f) => ({ ...f, toAccountId: undefined })); }}
                    >
                      {toAccountOptions.map((a) => (
                        <option key={a.id} value={a.id}>{a.nama}{!a.isActive ? " (nonaktif)" : ""}</option>
                      ))}
                      {toAccountOptions.length === 0 && <option value="">—</option>}
                    </select>
                    <ChevronDown />
                  </div>
                </div>
                {fieldErrors.toAccountId && (
                  <p id="to-account-error" role="alert" className="text-xs text-danger-text mt-1 text-right">{fieldErrors.toAccountId}</p>
                )}
              </div>
            )}

            {/* Kategori — datalist autocomplete */}
            {showKategori && (
              <div className="flex items-center px-5 py-3">
                <label htmlFor="kategori" className="text-sm text-text-muted w-28">Kategori</label>
                <div className="flex-1 flex items-center gap-1 justify-end">
                  <input
                    id="kategori"
                    list="kategori-options"
                    type="text"
                    className="flex-1 text-sm text-text-primary bg-transparent focus:outline-none text-right min-w-0"
                    placeholder="Pilih atau ketik..."
                    value={kategori}
                    onChange={(e) => setKategori(e.target.value)}
                    autoComplete="off"
                  />
                  <datalist id="kategori-options">
                    {kategoriOptions.map((k) => (
                      <option key={k} value={k} />
                    ))}
                  </datalist>
                </div>
              </div>
            )}

            {/* Rincian */}
            <div className="flex items-center px-5 py-3">
              <label htmlFor="rincian" className="text-sm text-text-muted w-28">Rincian</label>
              <input
                id="rincian"
                type="text"
                className="flex-1 text-sm text-text-primary bg-transparent focus:outline-none text-right"
                placeholder="Opsional"
                value={rincian}
                onChange={(e) => setRincian(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="secondary" fullWidth onClick={() => router.back()}>
              Batal
            </Button>
            <Button type="submit" fullWidth loading={saving} disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </div>
        </form>
      </div>
    </PageShell>
  );
}
