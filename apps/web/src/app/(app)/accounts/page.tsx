"use client";

import { useEffect, useState, useCallback } from "react";
import { ConfirmModal } from "@/components/ConfirmModal";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

type Account = {
  id: string;
  nama: string;
  saldoCache: string;
  isActive: boolean;
  createdAt: string;
};

type ModalState = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  confirmVariant: "danger" | "warning" | "default";
  onConfirm: () => void;
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
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [nama, setNama] = useState("");
  const [saldo, setSaldo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<ModalState>({
    open: false,
    title: "",
    message: "",
    confirmLabel: "Ya, Lanjutkan",
    confirmVariant: "danger",
    onConfirm: () => {},
  });

  const closeModal = () => setModal((m) => ({ ...m, open: false }));

  const refetch = useCallback(async () => {
    setLoading(true);
    setFetchError("");
    try {
      const data = await apiFetch("/api/accounts", "GET");
      setAccounts(data);
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : "Gagal memuat rekening");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    apiFetch("/api/accounts", "GET")
      .then((data: Account[]) => setAccounts(data))
      .catch((err: unknown) => {
        setFetchError(err instanceof Error ? err.message : "Gagal memuat rekening");
        setAccounts([]);
      })
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

  const handleDeactivate = (id: string, accountName: string) => {
    setModal({
      open: true,
      title: "Nonaktifkan Rekening",
      message: `Rekening "${accountName}" akan dinonaktifkan. Rekening tidak akan muncul di transaksi baru, tapi riwayat tetap tersimpan.`,
      confirmLabel: "Nonaktifkan",
      confirmVariant: "warning",
      onConfirm: async () => {
        closeModal();
        try {
          await apiFetch(`/api/accounts/${id}`, "PATCH", { isActive: false });
          await refetch();
        } catch (err: unknown) {
          setFetchError(err instanceof Error ? err.message : "Gagal menonaktifkan rekening");
        }
      },
    });
  };

  const handleDelete = (id: string, accountName: string) => {
    setModal({
      open: true,
      title: "Hapus Rekening",
      message: `Hapus rekening "${accountName}"? Tindakan ini hanya bisa dilakukan jika belum ada transaksi terkait dan tidak bisa dibatalkan.`,
      confirmLabel: "Hapus",
      confirmVariant: "danger",
      onConfirm: async () => {
        closeModal();
        try {
          await apiFetch(`/api/accounts/${id}`, "DELETE");
          await refetch();
        } catch (err: unknown) {
          setFetchError(err instanceof Error ? err.message : "Gagal menghapus — pastikan tidak ada transaksi terkait.");
        }
      },
    });
  };

  const totalSaldo = accounts.filter((a) => a.isActive).reduce((s, a) => s + Number(a.saldoCache), 0);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <ConfirmModal
        open={modal.open}
        title={modal.title}
        message={modal.message}
        confirmLabel={modal.confirmLabel}
        confirmVariant={modal.confirmVariant}
        onConfirm={modal.onConfirm}
        onCancel={closeModal}
      />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Rekening</h1>
          <p className="text-sm text-gray-500 mt-0.5">Kas dan tabungan Anda</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          aria-label="Tambah rekening baru"
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth={2} strokeLinecap="round"/></svg>
          Tambah
        </button>
      </div>

      {/* Total */}
      <div className="bg-emerald-600 text-white rounded-2xl p-5 mb-6">
        <p className="text-emerald-200 text-sm">Total Saldo Aktif</p>
        <p className="text-2xl font-bold mt-1">{formatRp(totalSaldo)}</p>
      </div>

      {/* Fetch error banner */}
      {fetchError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-red-500 shrink-0 mt-0.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <div className="flex-1">
            <p className="text-sm text-red-700">{fetchError}</p>
          </div>
          <button onClick={() => refetch()} className="text-xs text-red-600 font-medium hover:underline shrink-0">Coba lagi</button>
        </div>
      )}

      {/* Form tambah */}
      {showForm && (
        <form onSubmit={handleAdd} className="bg-white rounded-xl border border-gray-100 p-5 mb-4">
          <h3 className="font-semibold text-gray-900 mb-4">Rekening Baru</h3>
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
          <div className="space-y-3">
            <div>
              <label htmlFor="acc-nama" className="block text-sm font-medium text-gray-700 mb-1">Nama Rekening</label>
              <input
                id="acc-nama"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                placeholder="Cth: BCA, Gopay, Tunai"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="acc-saldo" className="block text-sm font-medium text-gray-700 mb-1">Saldo Awal</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" aria-hidden="true">Rp</span>
                <input
                  id="acc-saldo"
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
              className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-60 transition-colors"
            >
              {saving ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" aria-label="Memuat..." />
        </div>
      ) : accounts.length === 0 && !fetchError ? (
        <div className="text-center py-12 text-gray-400">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="mx-auto mb-3 opacity-40" aria-hidden="true">
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <line x1="2" y1="10" x2="22" y2="10" />
          </svg>
          <p className="text-sm">Belum ada rekening</p>
          <p className="text-xs mt-1">Tambahkan rekening pertama Anda</p>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((acc) => (
            <div key={acc.id} className={`bg-white rounded-xl border p-4 transition-opacity ${acc.isActive ? "border-gray-100" : "border-gray-100 opacity-60"}`}>
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
                <div className="flex gap-1">
                  {acc.isActive && (
                    <button
                      onClick={() => handleDeactivate(acc.id, acc.nama)}
                      aria-label={`Nonaktifkan rekening ${acc.nama}`}
                      className="p-2 text-gray-400 hover:text-amber-500 transition-colors rounded-lg hover:bg-amber-50"
                      title="Nonaktifkan"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true"><path d="M18.36 6.64a9 9 0 11-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(acc.id, acc.nama)}
                    aria-label={`Hapus rekening ${acc.nama}`}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                    title="Hapus"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
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
