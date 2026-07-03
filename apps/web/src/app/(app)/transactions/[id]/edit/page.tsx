"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { RequiredMark } from "@/components/ui/Input";
import { formatRupiahInput, parseRupiahInput } from "@/lib/format";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

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
  const res = await fetch(`${API}${path}`, {
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

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`${API}/api/transactions/${id}`, { credentials: "include" }).then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? "Transaksi tidak ditemukan" : "Gagal memuat transaksi");
        return r.json();
      }),
      fetch(`${API}/api/accounts`, { credentials: "include" }).then((r) => r.json()),
      fetch(`${API}/api/transactions/categories`, { credentials: "include" }).then((r) => r.json()).catch(() => null),
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
    if (!nominal || nominalParsed <= 0) {
      setError("Masukkan nominal transaksi");
      return;
    }
    if (isTransfer && (!accountId || !toAccountId)) {
      setError("Rekening asal dan tujuan wajib diisi untuk transfer");
      return;
    }
    if (isTransfer && accountId === toAccountId) {
      setError("Rekening asal dan tujuan tidak boleh sama");
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
      router.push("/transactions");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan perubahan");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl">
        <PageHeader title="Edit Transaksi" onBack={() => router.back()} />
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" aria-label="Memuat..." />
        </div>
      </div>
    );
  }

  if (loadError || !trx) {
    return (
      <div className="max-w-4xl">
        <PageHeader title="Edit Transaksi" onBack={() => router.back()} />
        <div className="p-4 bg-danger-soft border border-danger-soft-border rounded-xl text-sm text-danger-text" role="alert">
          {loadError || "Transaksi tidak ditemukan"}
        </div>
      </div>
    );
  }

  if (isAssetType) {
    return (
      <div className="max-w-4xl">
        <PageHeader title="Edit Transaksi" onBack={() => router.back()} />
        <div className="p-4 bg-warning-soft border border-warning-soft-border rounded-xl text-sm text-warning-text" role="alert">
          Transaksi beli/jual aset tidak bisa diedit karena mempengaruhi harga rata-rata berjalan. Catat transaksi penyesuaian baru jika diperlukan.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <PageHeader title="Edit Transaksi" onBack={() => router.back()} />

      <div className="max-w-xl">
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
          <div className="bg-surface rounded-2xl p-5 border border-border">
            <label htmlFor="nominal" className="block text-xs font-medium text-text-muted mb-2 uppercase tracking-wide">Nominal<RequiredMark /></label>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-light text-text-primary" aria-hidden="true">Rp</span>
              <input
                id="nominal"
                type="text"
                inputMode="numeric"
                className="flex-1 min-w-0 text-3xl font-bold bg-transparent focus:outline-none text-text-primary"
                placeholder="0"
                value={nominal}
                onChange={(e) => setNominal(formatRupiahInput(e.target.value))}
                required
              />
            </div>
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
            <div className="flex items-center px-5 py-3">
              <label htmlFor="account" className="text-sm text-text-muted w-28">
                {isTransfer ? "Dari Rekening" : "Rekening"}<RequiredMark />
              </label>
              <div className="flex-1 flex items-center gap-1 justify-end">
                <select
                  id="account"
                  className="text-sm text-text-primary bg-transparent focus:outline-none text-right appearance-none"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                >
                  {accountOptions.map((a) => (
                    <option key={a.id} value={a.id}>{a.nama}{!a.isActive ? " (nonaktif)" : ""}</option>
                  ))}
                  {accountOptions.length === 0 && <option value="">Tidak ada rekening</option>}
                </select>
                <ChevronDown />
              </div>
            </div>

            {/* Rekening tujuan (transfer) */}
            {isTransfer && (
              <div className="flex items-center px-5 py-3">
                <label htmlFor="to-account" className="text-sm text-text-muted w-28">Ke Rekening<RequiredMark /></label>
                <div className="flex-1 flex items-center gap-1 justify-end">
                  <select
                    id="to-account"
                    className="text-sm text-text-primary bg-transparent focus:outline-none text-right appearance-none"
                    value={toAccountId}
                    onChange={(e) => setToAccountId(e.target.value)}
                  >
                    {toAccountOptions.map((a) => (
                      <option key={a.id} value={a.id}>{a.nama}{!a.isActive ? " (nonaktif)" : ""}</option>
                    ))}
                    {toAccountOptions.length === 0 && <option value="">—</option>}
                  </select>
                  <ChevronDown />
                </div>
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
    </div>
  );
}
