"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { formatRupiahInput, parseRupiahInput, formatCurrency } from "@/lib/format";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

type Account = { id: string; nama: string; saldoCache: string };
type Categories = { pendapatan: string[]; pengeluaran: string[] };

type TxType = "pendapatan" | "pengeluaran" | "transfer";

const TX_TYPES: { value: TxType; label: string; activeClass: string }[] = [
  { value: "pendapatan", label: "Pemasukan", activeClass: "bg-surface text-brand shadow-sm" },
  { value: "pengeluaran", label: "Pengeluaran", activeClass: "bg-surface text-danger-text shadow-sm" },
  { value: "transfer", label: "Transfer", activeClass: "bg-surface text-info-text shadow-sm" },
];

const DEBIT_TYPES = new Set(["pengeluaran", "transfer"]);

// Fallback defaults in case API call fails
const KATEGORI_PENDAPATAN_FALLBACK = ["Gaji", "Proyek", "Dividen", "Bonus", "Hadiah", "Lainnya"];
const KATEGORI_PENGELUARAN_FALLBACK = ["Makanan", "Transportasi", "Utilitas", "Belanja", "Kesehatan", "Hiburan", "Pendidikan", "Lainnya"];

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

function NewTransactionForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialType = (() => {
    const param = searchParams.get("type");
    if (param === "pendapatan" || param === "pengeluaran" || param === "transfer") return param;
    return "pengeluaran" as TxType;
  })();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Categories>({
    pendapatan: KATEGORI_PENDAPATAN_FALLBACK,
    pengeluaran: KATEGORI_PENGELUARAN_FALLBACK,
  });
  const [type, setType] = useState<TxType>(initialType);
  const [tanggal, setTanggal] = useState(new Date().toISOString().split("T")[0]);
  const [nominal, setNominal] = useState("");
  const [kategori, setKategori] = useState("");
  const [rincian, setRincian] = useState("");
  const [accountId, setAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/api/accounts`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const active = data.filter((a: Account & { isActive: boolean }) => a.isActive);
        setAccounts(active);
        if (active.length > 0) {
          setAccountId(active[0].id);
          if (active.length > 1) setToAccountId(active[1].id);
        }
      })
      .catch(() => {});
    // Categories endpoint includes user history, not just the defaults
    fetch(`${API}/api/transactions/categories`, { credentials: "include" })
      .then((r) => r.json())
      .then((data: Categories) => {
        if (cancelled) return;
        setCategories(data);
      })
      .catch(() => {}); // silently fall back to defaults
    return () => { cancelled = true; };
  }, []);

  const selectedAccount = accounts.find((a) => a.id === accountId);
  const saldoTersedia = selectedAccount ? Number(selectedAccount.saldoCache) : 0;
  const nominalParsed = parseRupiahInput(nominal);
  const isDebit = DEBIT_TYPES.has(type);
  const isOverBalance = isDebit && nominalParsed > 0 && nominalParsed > saldoTersedia;

  const kategoriOptions = type === "pendapatan" ? categories.pendapatan : categories.pengeluaran;
  const transferAccounts = accounts.filter((a) => a.id !== accountId);
  const canTransfer = accounts.length >= 2;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nominal || nominalParsed === 0) {
      setError("Masukkan nominal transaksi");
      return;
    }
    if (isOverBalance) {
      setError(`Saldo tidak mencukupi. Saldo tersedia ${formatCurrency(saldoTersedia)}`);
      return;
    }
    if (type === "transfer" && !canTransfer) {
      setError("Butuh minimal 2 rekening untuk transfer");
      return;
    }
    if (type === "transfer" && accountId === toAccountId) {
      setError("Rekening asal dan tujuan tidak boleh sama");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await apiFetch("/api/transactions", "POST", {
        tanggal,
        type,
        kategori: kategori || undefined,
        rincian: rincian || undefined,
        accountId: accountId || undefined,
        toAccountId: type === "transfer" ? toAccountId : undefined,
        nominal: nominalParsed,
      });
      router.push("/transactions");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setLoading(false);
    }
  };

  const toAccount = accounts.find((a) => a.id === toAccountId);
  const showPreview = nominalParsed > 0;
  const fromBalanceAfter = type === "pendapatan"
    ? saldoTersedia + nominalParsed
    : saldoTersedia - nominalParsed;
  const toBalanceAfter = toAccount ? Number(toAccount.saldoCache) + nominalParsed : 0;

  return (
    <div className="max-w-4xl">
      <PageHeader title="Catat Transaksi" onBack={() => router.back()} />

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-6 lg:items-start">
      <div className="max-w-xl min-w-0">

      {/* Type selector */}
      <div className="flex gap-2 mb-6 bg-surface-hover p-1 rounded-xl" role="group" aria-label="Tipe transaksi">
        {TX_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => { setType(t.value); setKategori(""); setError(""); }}
            aria-pressed={type === t.value}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              type === t.value ? t.activeClass : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Transfer warning — not enough accounts */}
      {type === "transfer" && !canTransfer && (
        <div className="mb-4 p-3 bg-warning-soft border border-warning-soft-border rounded-xl flex items-start gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-warning shrink-0 mt-0.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <p className="text-sm text-warning-text">
            Transfer membutuhkan minimal 2 rekening. <a href="/accounts" className="font-medium underline">Tambah rekening</a> terlebih dahulu.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-danger-soft border border-danger-soft-border text-danger-text text-sm rounded-xl flex items-start gap-2" role="alert">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-danger shrink-0 mt-0.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {error}
          </div>
        )}

        {/* Nominal */}
        <div className={`bg-surface rounded-2xl p-5 border transition-colors ${
          isOverBalance ? "border-danger bg-danger-soft/40" : "border-border"
        }`}>
          <label htmlFor="nominal" className="block text-xs font-medium text-text-muted mb-2 uppercase tracking-wide">Nominal</label>
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-light ${
              isOverBalance ? "text-danger" :
              type === "pendapatan" ? "text-brand" :
              type === "pengeluaran" ? "text-danger" : "text-info-text"
            }`} aria-hidden="true">Rp</span>
            <input
              id="nominal"
              type="text"
              inputMode="numeric"
              className={`flex-1 min-w-0 text-3xl font-bold bg-transparent focus:outline-none text-text-primary ${
                isOverBalance ? "text-danger-text" :
                type === "pendapatan" ? "text-brand" :
                type === "pengeluaran" ? "text-danger-text" : "text-info-text"
              }`}
              placeholder="0"
              value={nominal}
              onChange={(e) => setNominal(formatRupiahInput(e.target.value))}
              required
            />
          </div>

          {/* Saldo indicator for debit types */}
          {isDebit && selectedAccount && (
            <div className={`mt-3 pt-3 border-t flex items-center justify-between ${
              isOverBalance ? "border-danger-soft-border" : "border-border"
            }`}>
              <span className="text-xs text-text-muted">Saldo {selectedAccount.nama}</span>
              <span className={`text-xs font-semibold ${isOverBalance ? "text-danger-text" : "text-text-secondary"}`}>
                {formatCurrency(saldoTersedia)}
                {isOverBalance && (
                  <span className="ml-1.5 text-danger-text">
                    (kurang {formatCurrency(nominalParsed - saldoTersedia)})
                  </span>
                )}
              </span>
            </div>
          )}
        </div>

        <div className="bg-surface rounded-2xl border border-border divide-y divide-border">
          {/* Tanggal */}
          <div className="flex items-center px-5 py-3">
            <label htmlFor="tanggal" className="text-sm text-text-muted w-28">Tanggal</label>
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
              {type === "transfer" ? "Dari Rekening" : "Rekening"}
            </label>
            <div className="flex-1 flex items-center gap-1 justify-end">
              <select
                id="account"
                className="text-sm text-text-primary bg-transparent focus:outline-none text-right appearance-none"
                value={accountId}
                onChange={(e) => { setAccountId(e.target.value); setError(""); }}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.nama}</option>
                ))}
                {accounts.length === 0 && <option value="">Tidak ada rekening</option>}
              </select>
              <ChevronDown />
            </div>
          </div>

          {/* Rekening tujuan (transfer) */}
          {type === "transfer" && (
            <div className="flex items-center px-5 py-3">
              <label htmlFor="to-account" className="text-sm text-text-muted w-28">Ke Rekening</label>
              <div className="flex-1 flex items-center gap-1 justify-end">
                <select
                  id="to-account"
                  className="text-sm text-text-primary bg-transparent focus:outline-none text-right appearance-none"
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                >
                  {transferAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.nama}</option>
                  ))}
                  {transferAccounts.length === 0 && <option value="">—</option>}
                </select>
                <ChevronDown />
              </div>
            </div>
          )}

          {/* Kategori — datalist autocomplete (pilih dari histori atau ketik bebas) */}
          {type !== "transfer" && (
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

        <Button
          type="submit"
          fullWidth
          size="lg"
          loading={loading}
          disabled={loading || accounts.length === 0 || (type === "transfer" && !canTransfer) || isOverBalance}
          variant={type === "pendapatan" ? "primary" : type === "pengeluaran" ? "danger" : "info"}
        >
          {loading
            ? "Menyimpan..."
            : isOverBalance
            ? "Saldo Tidak Mencukupi"
            : `Simpan ${type === "pendapatan" ? "Pemasukan" : type === "pengeluaran" ? "Pengeluaran" : "Transfer"}`}
        </Button>
      </form>
      </div>

      {/* Ringkasan rekening — desktop only, mirrors the inline saldo indicator with more context */}
      <div className="hidden lg:block lg:sticky lg:top-6 mt-8 lg:mt-0">
        <div className="bg-surface rounded-2xl border border-border p-5">
          <h2 className="text-sm font-semibold text-text-primary mb-4">Ringkasan Rekening</h2>

          {selectedAccount ? (
            <div className="space-y-3">
              <div>
                <p className="text-xs text-text-muted">{type === "transfer" ? "Dari" : "Rekening"}</p>
                <p className="text-sm font-medium text-text-primary truncate">{selectedAccount.nama}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-text-muted">Saldo saat ini</span>
                  <span className="text-sm font-semibold text-text-secondary">{formatCurrency(saldoTersedia)}</span>
                </div>
                {showPreview && (
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-text-muted">Setelah transaksi</span>
                    <span className={`text-sm font-bold ${fromBalanceAfter < 0 ? "text-danger-text" : "text-text-primary"}`}>
                      {formatCurrency(fromBalanceAfter)}
                    </span>
                  </div>
                )}
              </div>

              {type === "transfer" && toAccount && (
                <div className="pt-3 border-t border-border">
                  <p className="text-xs text-text-muted">Ke</p>
                  <p className="text-sm font-medium text-text-primary truncate">{toAccount.nama}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-text-muted">Saldo saat ini</span>
                    <span className="text-sm font-semibold text-text-secondary">{formatCurrency(Number(toAccount.saldoCache))}</span>
                  </div>
                  {showPreview && (
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-text-muted">Setelah transaksi</span>
                      <span className="text-sm font-bold text-brand">{formatCurrency(toBalanceAfter)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-text-muted">Belum ada rekening untuk ditampilkan.</p>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

export default function NewTransactionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" aria-label="Memuat..." />
        </div>
      }
    >
      <NewTransactionForm />
    </Suspense>
  );
}
