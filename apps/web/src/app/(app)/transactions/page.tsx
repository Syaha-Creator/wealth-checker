"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ConfirmModal } from "@/components/ConfirmModal";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

type Transaction = {
  id: string;
  tanggal: string;
  type: string;
  kategori: string | null;
  rincian: string | null;
  nominal: string;
  createdAt: string;
};

type ModalState = {
  open: boolean;
  id: string;
};

const TYPE_CONFIG: Record<string, { label: string; color: string; sign: string }> = {
  pendapatan: { label: "Pemasukan", color: "text-emerald-600", sign: "+" },
  pengeluaran: { label: "Pengeluaran", color: "text-red-500", sign: "-" },
  transfer: { label: "Transfer", color: "text-blue-500", sign: "" },
  pinjaman_utang: { label: "Pinjam Utang", color: "text-amber-600", sign: "+" },
  bayar_utang: { label: "Bayar Utang", color: "text-purple-600", sign: "-" },
  pemberian_piutang: { label: "Beri Piutang", color: "text-orange-500", sign: "-" },
  penerimaan_piutang: { label: "Terima Piutang", color: "text-teal-600", sign: "+" },
  beli_barang: { label: "Beli Barang", color: "text-red-400", sign: "-" },
  jual_barang: { label: "Jual Barang", color: "text-green-500", sign: "+" },
  beli_investasi: { label: "Investasi", color: "text-indigo-500", sign: "-" },
  jual_investasi: { label: "Cairkan Investasi", color: "text-indigo-400", sign: "+" },
};

function formatRp(val: string) {
  return Number(val).toLocaleString("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
}

function groupByDate(txs: Transaction[]) {
  const groups: Record<string, Transaction[]> = {};
  for (const t of txs) {
    if (!groups[t.tanggal]) groups[t.tanggal] = [];
    groups[t.tanggal].push(t);
  }
  return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
}

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("id-ID", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [deleteModal, setDeleteModal] = useState<ModalState>({ open: false, id: "" });
  const [deleteError, setDeleteError] = useState("");

  const refetch = useCallback(async () => {
    setLoading(true);
    setFetchError("");
    try {
      const res = await fetch(`${API}/api/transactions?limit=100`, { credentials: "include" });
      if (!res.ok) throw new Error("Gagal memuat transaksi");
      const data = await res.json();
      setTransactions(data);
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : "Gagal memuat transaksi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch(`${API}/api/transactions?limit=100`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Gagal memuat transaksi");
        return res.json();
      })
      .then((data: Transaction[]) => setTransactions(data))
      .catch((err: unknown) => {
        setFetchError(err instanceof Error ? err.message : "Gagal memuat transaksi");
        setTransactions([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleDeleteConfirm = async () => {
    const id = deleteModal.id;
    setDeleteModal({ open: false, id: "" });
    setDeleteError("");
    try {
      const res = await fetch(`${API}/api/transactions/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Gagal menghapus transaksi");
      await refetch();
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : "Gagal menghapus transaksi");
    }
  };

  const groups = groupByDate(transactions);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <ConfirmModal
        open={deleteModal.open}
        title="Hapus Transaksi"
        message="Hapus transaksi ini? Saldo rekening terkait akan dikembalikan ke kondisi sebelum transaksi."
        confirmLabel="Hapus"
        confirmVariant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteModal({ open: false, id: "" })}
      />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Riwayat Transaksi</h1>
          <p className="text-sm text-gray-500 mt-0.5">{transactions.length} transaksi</p>
        </div>
        <Link
          href="/transactions/new"
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth={2} strokeLinecap="round"/></svg>
          Catat
        </Link>
      </div>

      {/* Fetch error banner */}
      {fetchError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2" role="alert">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-red-500 shrink-0 mt-0.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <div className="flex-1">
            <p className="text-sm text-red-700">{fetchError}</p>
          </div>
          <button onClick={() => refetch()} className="text-xs text-red-600 font-medium hover:underline shrink-0">Coba lagi</button>
        </div>
      )}

      {/* Delete error banner */}
      {deleteError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2" role="alert">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-red-500 shrink-0 mt-0.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <p className="text-sm text-red-700 flex-1">{deleteError}</p>
          <button onClick={() => setDeleteError("")} aria-label="Tutup notifikasi error" className="text-red-400 hover:text-red-600 shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" aria-label="Memuat..." />
        </div>
      ) : transactions.length === 0 && !fetchError ? (
        <div className="text-center py-16 text-gray-400">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="mx-auto mb-3 opacity-40" aria-hidden="true">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
            <rect x="9" y="3" width="6" height="4" rx="1" />
          </svg>
          <p className="text-sm font-medium">Belum ada transaksi</p>
          <p className="text-xs mt-1">Mulai catat pemasukan atau pengeluaran Anda</p>
          <Link
            href="/transactions/new"
            className="mt-4 inline-block px-5 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Catat Sekarang
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(([date, txs]) => (
            <div key={date}>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                {formatDate(date)}
              </h3>
              <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
                {txs.map((tx) => {
                  const cfg = TYPE_CONFIG[tx.type] ?? { label: tx.type, color: "text-gray-600", sign: "" };
                  return (
                    <div key={tx.id} className="flex items-center px-4 py-3.5 gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        tx.type === "pendapatan" ? "bg-emerald-50 text-emerald-600" :
                        tx.type === "pengeluaran" ? "bg-red-50 text-red-500" :
                        tx.type === "transfer" ? "bg-blue-50 text-blue-500" :
                        "bg-gray-50 text-gray-500"
                      }`} aria-hidden="true">
                        {cfg.sign || "→"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {tx.rincian || tx.kategori || cfg.label}
                        </p>
                        <p className="text-xs text-gray-400">
                          {cfg.label}{tx.kategori && ` · ${tx.kategori}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <p className={`text-sm font-semibold ${cfg.color}`}>
                          {cfg.sign}{formatRp(tx.nominal)}
                        </p>
                        <button
                          onClick={() => setDeleteModal({ open: true, id: tx.id })}
                          aria-label={`Hapus transaksi ${tx.rincian || tx.kategori || cfg.label}`}
                          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
