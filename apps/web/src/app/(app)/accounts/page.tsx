"use client";

import { useEffect, useState, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

type Account = {
  id: string;
  nama: string;
  saldoCache: string;
  isActive: boolean;
  createdAt: string;
};

function formatRp(val: string | number) {
  return Number(val).toLocaleString("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
}

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
  if (res.status === 204) return null;
  return res.json();
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  // Start as true so the initial fetch shows loading without calling setLoading in useEffect
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [nama, setNama] = useState("");
  const [saldo, setSaldo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // refetch is used from event handlers only (not from useEffect directly)
  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/accounts", "GET");
      setAccounts(data);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch: setState only inside async .then()/.finally() — not synchronously in effect body
  useEffect(() => {
    apiFetch("/api/accounts", "GET")
      .then((data: Account[]) => setAccounts(data))
      .catch(() => setAccounts([]))
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiFetch("/api/accounts", "POST", { nama, saldoAwal: parseRupiah(saldo) });
      setNama(""); setSaldo(""); setShowForm(false);
      await refetch();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm("Nonaktifkan rekening ini?")) return;
    try {
      await apiFetch(`/api/accounts/${id}`, "PATCH", { isActive: false });
      await refetch();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Gagal");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus rekening? Ini hanya bisa dilakukan jika belum ada transaksi.")) return;
    try {
      await apiFetch(`/api/accounts/${id}`, "DELETE");
      await refetch();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Gagal menghapus — pastikan tidak ada transaksi terkait.");
    }
  };

  const totalSaldo = accounts.filter((a) => a.isActive).reduce((s, a) => s + Number(a.saldoCache), 0);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Rekening</h1>
          <p className="text-sm text-gray-500 mt-0.5">Kas dan tabungan Anda</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth={2} strokeLinecap="round"/></svg>
          Tambah
        </button>
      </div>

      {/* Total */}
      <div className="bg-emerald-600 text-white rounded-2xl p-5 mb-6">
        <p className="text-emerald-200 text-sm">Total Saldo</p>
        <p className="text-2xl font-bold mt-1">{formatRp(totalSaldo)}</p>
      </div>

      {/* Form tambah */}
      {showForm && (
        <form onSubmit={handleAdd} className="bg-white rounded-xl border border-gray-100 p-5 mb-4">
          <h3 className="font-semibold text-gray-900 mb-4">Rekening Baru</h3>
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nama Rekening</label>
              <input
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                placeholder="Cth: BCA, Gopay, Tunai"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Saldo Awal</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">Rp</span>
                <input
                  type="text"
                  inputMode="numeric"
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  placeholder="0"
                  value={saldo}
                  onChange={(e) => setSaldo(formatRupiah(e.target.value))}
                />
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={() => { setShowForm(false); setError(""); }}
              className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="mx-auto mb-3 opacity-40">
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <line x1="2" y1="10" x2="22" y2="10" />
          </svg>
          <p className="text-sm">Belum ada rekening</p>
          <p className="text-xs mt-1">Tambahkan rekening pertama Anda</p>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((acc) => (
            <div key={acc.id} className={`bg-white rounded-xl border p-4 ${acc.isActive ? "border-gray-100" : "border-gray-100 opacity-60"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">{acc.nama}</p>
                    {!acc.isActive && (
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">Nonaktif</span>
                    )}
                  </div>
                  <p className="text-lg font-bold text-emerald-700 mt-0.5">{formatRp(acc.saldoCache)}</p>
                </div>
                <div className="flex gap-2">
                  {acc.isActive && (
                    <button
                      onClick={() => handleDeactivate(acc.id)}
                      className="p-2 text-gray-400 hover:text-amber-500 transition-colors"
                      title="Nonaktifkan"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M18.36 6.64a9 9 0 11-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(acc.id)}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    title="Hapus"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
