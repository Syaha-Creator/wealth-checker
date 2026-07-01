"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

type Account = { id: string; nama: string; saldoCache: string };

type TxType = "pendapatan" | "pengeluaran" | "transfer";

const TX_TYPES: { value: TxType; label: string; color: string }[] = [
  { value: "pendapatan", label: "Pemasukan", color: "emerald" },
  { value: "pengeluaran", label: "Pengeluaran", color: "red" },
  { value: "transfer", label: "Transfer", color: "blue" },
];

const KATEGORI_PENDAPATAN = ["Gaji", "Proyek", "Dividen", "Bonus", "Hadiah", "Lainnya"];
const KATEGORI_PENGELUARAN = ["Makanan", "Transportasi", "Utilitas", "Belanja", "Kesehatan", "Hiburan", "Pendidikan", "Lainnya"];

function formatRupiah(val: string) {
  const num = val.replace(/\D/g, "");
  return num ? Number(num).toLocaleString("id-ID") : "";
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

export default function NewTransactionPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [type, setType] = useState<TxType>("pengeluaran");
  const [tanggal, setTanggal] = useState(new Date().toISOString().split("T")[0]);
  const [nominal, setNominal] = useState("");
  const [kategori, setKategori] = useState("");
  const [rincian, setRincian] = useState("");
  const [accountId, setAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/api/accounts", "GET")
      .then((data) => {
        const active = data.filter((a: Account & { isActive: boolean }) => a.isActive);
        setAccounts(active);
        if (active.length > 0) setAccountId(active[0].id);
      })
      .catch(() => {});
  }, []);

  const kategoriOptions = type === "pendapatan" ? KATEGORI_PENDAPATAN : KATEGORI_PENGELUARAN;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nominal || parseRupiah(nominal) === 0) {
      setError("Masukkan nominal transaksi");
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
        nominal: parseRupiah(nominal),
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
        <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-400 hover:text-gray-600">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Catat Transaksi</h1>
        </div>
      </div>

      {/* Type selector */}
      <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-xl">
        {TX_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => { setType(t.value); setKategori(""); }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              type === t.value
                ? t.value === "pendapatan"
                  ? "bg-white text-emerald-700 shadow-sm"
                  : t.value === "pengeluaran"
                  ? "bg-white text-red-600 shadow-sm"
                  : "bg-white text-blue-600 shadow-sm"
                : "text-gray-500"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>}

        {/* Nominal */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Nominal</label>
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-light ${
              type === "pendapatan" ? "text-emerald-600" : type === "pengeluaran" ? "text-red-500" : "text-blue-600"
            }`}>Rp</span>
            <input
              type="text"
              inputMode="numeric"
              className={`flex-1 text-3xl font-bold bg-transparent focus:outline-none ${
                type === "pendapatan" ? "text-emerald-700" : type === "pengeluaran" ? "text-red-600" : "text-blue-700"
              }`}
              placeholder="0"
              value={nominal}
              onChange={(e) => setNominal(formatRupiah(e.target.value))}
              required
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
          {/* Tanggal */}
          <div className="flex items-center px-5 py-3">
            <label className="text-sm text-gray-500 w-28">Tanggal</label>
            <input
              type="date"
              className="flex-1 text-sm text-gray-900 bg-transparent focus:outline-none text-right"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              required
            />
          </div>

          {/* Rekening asal */}
          <div className="flex items-center px-5 py-3">
            <label className="text-sm text-gray-500 w-28">
              {type === "transfer" ? "Dari Rekening" : "Rekening"}
            </label>
            <select
              className="flex-1 text-sm text-gray-900 bg-transparent focus:outline-none text-right appearance-none"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.nama}</option>
              ))}
              {accounts.length === 0 && <option value="">Tidak ada rekening</option>}
            </select>
          </div>

          {/* Rekening tujuan (transfer) */}
          {type === "transfer" && (
            <div className="flex items-center px-5 py-3">
              <label className="text-sm text-gray-500 w-28">Ke Rekening</label>
              <select
                className="flex-1 text-sm text-gray-900 bg-transparent focus:outline-none text-right appearance-none"
                value={toAccountId}
                onChange={(e) => setToAccountId(e.target.value)}
              >
                {accounts.filter((a) => a.id !== accountId).map((a) => (
                  <option key={a.id} value={a.id}>{a.nama}</option>
                ))}
              </select>
            </div>
          )}

          {/* Kategori */}
          {type !== "transfer" && (
            <div className="flex items-center px-5 py-3">
              <label className="text-sm text-gray-500 w-28">Kategori</label>
              <select
                className="flex-1 text-sm text-gray-900 bg-transparent focus:outline-none text-right appearance-none"
                value={kategori}
                onChange={(e) => setKategori(e.target.value)}
              >
                <option value="">Pilih kategori</option>
                {kategoriOptions.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
          )}

          {/* Rincian */}
          <div className="flex items-center px-5 py-3">
            <label className="text-sm text-gray-500 w-28">Rincian</label>
            <input
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
          disabled={loading || accounts.length === 0}
          className={`w-full py-4 font-semibold text-white rounded-2xl transition-colors disabled:opacity-60 ${
            type === "pendapatan"
              ? "bg-emerald-600 hover:bg-emerald-700"
              : type === "pengeluaran"
              ? "bg-red-500 hover:bg-red-600"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {loading ? "Menyimpan..." : `Simpan ${type === "pendapatan" ? "Pemasukan" : type === "pengeluaran" ? "Pengeluaran" : "Transfer"}`}
        </button>
      </form>
    </div>
  );
}
