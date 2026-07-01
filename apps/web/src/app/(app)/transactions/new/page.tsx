"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

type Account = { id: string; nama: string; saldoCache: string };
type Categories = { pendapatan: string[]; pengeluaran: string[] };

type TxType = "pendapatan" | "pengeluaran" | "transfer";

const TX_TYPES: { value: TxType; label: string; color: string }[] = [
  { value: "pendapatan", label: "Pemasukan", color: "emerald" },
  { value: "pengeluaran", label: "Pengeluaran", color: "red" },
  { value: "transfer", label: "Transfer", color: "blue" },
];

const DEBIT_TYPES = new Set(["pengeluaran", "transfer"]);

// Fallback defaults in case API call fails
const KATEGORI_PENDAPATAN_FALLBACK = ["Gaji", "Proyek", "Dividen", "Bonus", "Hadiah", "Lainnya"];
const KATEGORI_PENGELUARAN_FALLBACK = ["Makanan", "Transportasi", "Utilitas", "Belanja", "Kesehatan", "Hiburan", "Pendidikan", "Lainnya"];

function formatRupiah(val: string) {
  const num = val.replace(/\D/g, "");
  return num ? Number(num).toLocaleString("id-ID") : "";
}

function formatRp(val: number) {
  return val.toLocaleString("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
}

function parseRupiah(val: string) {
  return Number(val.replace(/\D/g, ""));
}

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
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 pointer-events-none shrink-0" aria-hidden="true">
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
    // Fetch accounts
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
    // Fetch categories from API (includes user history)
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
  const nominalParsed = parseRupiah(nominal);
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
      setError(`Saldo tidak mencukupi. Saldo tersedia ${formatRp(saldoTersedia)}`);
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

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          aria-label="Kembali"
          className="p-2 -ml-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <h1 className="text-xl font-bold text-gray-900">Catat Transaksi</h1>
      </div>

      {/* Type selector */}
      <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-xl" role="group" aria-label="Tipe transaksi">
        {TX_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => { setType(t.value); setKategori(""); setError(""); }}
            aria-pressed={type === t.value}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              type === t.value
                ? t.value === "pendapatan"
                  ? "bg-white text-emerald-700 shadow-sm"
                  : t.value === "pengeluaran"
                  ? "bg-white text-red-600 shadow-sm"
                  : "bg-white text-blue-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Transfer warning — not enough accounts */}
      {type === "transfer" && !canTransfer && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-amber-500 shrink-0 mt-0.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <p className="text-sm text-amber-700">
            Transfer membutuhkan minimal 2 rekening. <a href="/accounts" className="font-medium underline">Tambah rekening</a> terlebih dahulu.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl flex items-start gap-2" role="alert">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-red-500 shrink-0 mt-0.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {error}
          </div>
        )}

        {/* Nominal */}
        <div className={`bg-white rounded-2xl p-5 border transition-colors ${
          isOverBalance ? "border-red-300 bg-red-50/30" : "border-gray-100"
        }`}>
          <label htmlFor="nominal" className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Nominal</label>
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-light ${
              isOverBalance ? "text-red-500" :
              type === "pendapatan" ? "text-emerald-600" :
              type === "pengeluaran" ? "text-red-500" : "text-blue-600"
            }`} aria-hidden="true">Rp</span>
            <input
              id="nominal"
              type="text"
              inputMode="numeric"
              className={`flex-1 text-3xl font-bold bg-transparent focus:outline-none ${
                isOverBalance ? "text-red-600" :
                type === "pendapatan" ? "text-emerald-700" :
                type === "pengeluaran" ? "text-red-600" : "text-blue-700"
              }`}
              placeholder="0"
              value={nominal}
              onChange={(e) => setNominal(formatRupiah(e.target.value))}
              required
            />
          </div>

          {/* Saldo indicator for debit types */}
          {isDebit && selectedAccount && (
            <div className={`mt-3 pt-3 border-t flex items-center justify-between ${
              isOverBalance ? "border-red-200" : "border-gray-100"
            }`}>
              <span className="text-xs text-gray-400">Saldo {selectedAccount.nama}</span>
              <span className={`text-xs font-semibold ${isOverBalance ? "text-red-600" : "text-gray-600"}`}>
                {formatRp(saldoTersedia)}
                {isOverBalance && (
                  <span className="ml-1.5 text-red-500">
                    (kurang {formatRp(nominalParsed - saldoTersedia)})
                  </span>
                )}
              </span>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
          {/* Tanggal */}
          <div className="flex items-center px-5 py-3">
            <label htmlFor="tanggal" className="text-sm text-gray-500 w-28">Tanggal</label>
            <input
              id="tanggal"
              type="date"
              className="flex-1 text-sm text-gray-900 bg-transparent focus:outline-none text-right"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              required
            />
          </div>

          {/* Rekening asal */}
          <div className="flex items-center px-5 py-3">
            <label htmlFor="account" className="text-sm text-gray-500 w-28">
              {type === "transfer" ? "Dari Rekening" : "Rekening"}
            </label>
            <div className="flex-1 flex items-center gap-1 justify-end">
              <select
                id="account"
                className="text-sm text-gray-900 bg-transparent focus:outline-none text-right appearance-none"
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
              <label htmlFor="to-account" className="text-sm text-gray-500 w-28">Ke Rekening</label>
              <div className="flex-1 flex items-center gap-1 justify-end">
                <select
                  id="to-account"
                  className="text-sm text-gray-900 bg-transparent focus:outline-none text-right appearance-none"
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
              <label htmlFor="kategori" className="text-sm text-gray-500 w-28">Kategori</label>
              <div className="flex-1 flex items-center gap-1 justify-end">
                <input
                  id="kategori"
                  list="kategori-options"
                  type="text"
                  className="flex-1 text-sm text-gray-900 bg-transparent focus:outline-none text-right min-w-0"
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
            <label htmlFor="rincian" className="text-sm text-gray-500 w-28">Rincian</label>
            <input
              id="rincian"
              type="text"
              className="flex-1 text-sm text-gray-900 bg-transparent focus:outline-none text-right"
              placeholder="Opsional"
              value={rincian}
              onChange={(e) => setRincian(e.target.value)}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || accounts.length === 0 || (type === "transfer" && !canTransfer) || isOverBalance}
          className={`w-full py-4 font-semibold text-white rounded-2xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
            type === "pendapatan"
              ? "bg-emerald-600 hover:bg-emerald-700"
              : type === "pengeluaran"
              ? "bg-red-500 hover:bg-red-600"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {loading
            ? "Menyimpan..."
            : isOverBalance
            ? "Saldo Tidak Mencukupi"
            : `Simpan ${type === "pendapatan" ? "Pemasukan" : type === "pengeluaran" ? "Pengeluaran" : "Transfer"}`}
        </button>
      </form>
    </div>
  );
}

export default function NewTransactionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" aria-label="Memuat..." />
        </div>
      }
    >
      <NewTransactionForm />
    </Suspense>
  );
}
