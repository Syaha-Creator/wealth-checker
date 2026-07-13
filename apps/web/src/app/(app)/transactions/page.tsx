"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { ConfirmModal } from "@/components/ConfirmModal";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageShell } from "@/components/ui/PageShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonRow } from "@/components/ui/Skeleton";
import { formatCurrency, formatDateLong, formatMonthLabel } from "@/lib/format";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/components/ui/Toast";


type Transaction = {
  id: string;
  tanggal: string;
  type: string;
  kategori: string | null;
  rincian: string | null;
  accountId: string | null;
  nominal: string;
  createdAt: string;
};

type Account = { id: string; nama: string };

type ModalState = {
  open: boolean;
  id: string;
};

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; sign: string }> = {
  pendapatan: { label: "Pemasukan", color: "text-brand", bg: "bg-brand-soft", sign: "+" },
  pengeluaran: { label: "Pengeluaran", color: "text-danger-text", bg: "bg-danger-soft", sign: "-" },
  transfer: { label: "Transfer", color: "text-info-text", bg: "bg-info-soft", sign: "" },
  pinjaman_utang: { label: "Pinjam Utang", color: "text-warning-text", bg: "bg-warning-soft", sign: "+" },
  bayar_utang: { label: "Bayar Utang", color: "text-warning-text", bg: "bg-warning-soft", sign: "-" },
  pemberian_piutang: { label: "Beri Piutang", color: "text-warning-text", bg: "bg-warning-soft", sign: "-" },
  penerimaan_piutang: { label: "Terima Piutang", color: "text-brand", bg: "bg-brand-soft", sign: "+" },
  beli_barang: { label: "Beli Barang", color: "text-danger-text", bg: "bg-danger-soft", sign: "-" },
  jual_barang: { label: "Jual Barang", color: "text-brand", bg: "bg-brand-soft", sign: "+" },
  beli_investasi: { label: "Investasi", color: "text-info-text", bg: "bg-info-soft", sign: "-" },
  jual_investasi: { label: "Cairkan Investasi", color: "text-info-text", bg: "bg-info-soft", sign: "+" },
};

const FILTER_TYPES = [
  { value: "semua", label: "Semua" },
  { value: "pendapatan", label: "Pemasukan" },
  { value: "pengeluaran", label: "Pengeluaran" },
  { value: "transfer", label: "Transfer" },
  { value: "lainnya", label: "Lainnya" },
];

const CORE_TYPES = new Set(["pendapatan", "pengeluaran", "transfer"]);
const PAGE_SIZE = 50;

function groupByDate(txs: Transaction[]) {
  const groups: Record<string, Transaction[]> = {};
  for (const t of txs) {
    if (!groups[t.tanggal]) groups[t.tanggal] = [];
    groups[t.tanggal].push(t);
  }
  return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
}

function getMonthOptions(txs: Transaction[]) {
  const months = new Set<string>();
  for (const t of txs) {
    months.add(t.tanggal.slice(0, 7)); // "YYYY-MM"
  }
  return Array.from(months).sort((a, b) => b.localeCompare(a));
}

function FilterIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
    </svg>
  );
}

function TransactionsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
    </svg>
  );
}

export default function TransactionsPage() {
  const { showToast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  // Skalabilitas (audit temuan 5): dulu hardcap limit=200 tanpa cara mengakses
  // transaksi lama sama sekali. Sekarang dimuat per halaman (PAGE_SIZE) dengan
  // tombol "Muat lebih banyak" — hasMore=true selagi halaman terakhir yang
  // diambil masih penuh (indikasi kemungkinan ada data selanjutnya).
  const [hasMore, setHasMore] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [deleteModal, setDeleteModal] = useState<ModalState>({ open: false, id: "" });
  const [deleteError, setDeleteError] = useState("");
  // Medium #12 (bug hunt): busy guard untuk ConfirmModal — lihat catatan di accounts/page.tsx.
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [filterType, setFilterType] = useState("semua");
  const [filterMonth, setFilterMonth] = useState("semua");
  const [filterAccount, setFilterAccount] = useState("semua");
  const [searchText, setSearchText] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const fetchPage = useCallback(async (offset: number, limit: number) => {
    const res = await apiFetch(`/api/transactions?limit=${limit}&offset=${offset}`, { credentials: "include" });
    if (!res.ok) throw new Error("Gagal memuat transaksi");
    return (await res.json()) as Transaction[];
  }, []);

  // Refetch dari awal — dipakai setelah hapus transaksi. Memuat ulang sebanyak
  // yang sudah pernah dimuat sebelumnya supaya kedalaman scroll pengguna tidak
  // tiba-tiba menyusut kembali ke halaman pertama.
  const refetch = useCallback(async () => {
    setLoading(true);
    setFetchError("");
    try {
      const currentCount = Math.max(PAGE_SIZE, transactions.length);
      const data = await fetchPage(0, currentCount);
      setTransactions(data);
      setHasMore(data.length === currentCount);
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : "Gagal memuat transaksi");
    } finally {
      setLoading(false);
    }
  }, [fetchPage, transactions.length]);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const data = await fetchPage(transactions.length, PAGE_SIZE);
      setTransactions((prev) => [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE);
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : "Gagal memuat transaksi berikutnya");
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, transactions.length]);

  // Initial load: inline fetch to avoid calling setState via callback inside effect
  useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/transactions?limit=${PAGE_SIZE}&offset=0`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Gagal memuat transaksi");
        return res.json();
      })
      .then((data: Transaction[]) => {
        if (!cancelled) {
          setTransactions(data);
          setHasMore(data.length === PAGE_SIZE);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setFetchError(err instanceof Error ? err.message : "Gagal memuat transaksi");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    apiFetch(`/api/accounts`, { credentials: "include" })
      .then((res) => res.json())
      .then((data: Account[]) => {
        if (!cancelled) setAccounts(data);
      })
      .catch(() => {}); // filter rekening tidak kritis — diamkan saja jika gagal
    return () => { cancelled = true; };
  }, []);

  const monthOptions = useMemo(() => getMonthOptions(transactions), [transactions]);
  // Hanya tampilkan pilihan rekening yang benar-benar dipakai transaksi yang ada
  const accountOptions = useMemo(
    () => accounts.filter((a) => transactions.some((t) => t.accountId === a.id)),
    [accounts, transactions]
  );

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      if (filterType !== "semua") {
        if (filterType === "lainnya") {
          if (CORE_TYPES.has(tx.type)) return false;
        } else {
          if (tx.type !== filterType) return false;
        }
      }
      if (filterMonth !== "semua") {
        if (!tx.tanggal.startsWith(filterMonth)) return false;
      }
      if (filterAccount !== "semua") {
        if (tx.accountId !== filterAccount) return false;
      }
      if (searchText.trim()) {
        const q = searchText.toLowerCase();
        const inRincian = tx.rincian?.toLowerCase().includes(q) ?? false;
        const inKategori = tx.kategori?.toLowerCase().includes(q) ?? false;
        const inLabel = TYPE_CONFIG[tx.type]?.label.toLowerCase().includes(q) ?? false;
        if (!inRincian && !inKategori && !inLabel) return false;
      }
      return true;
    });
  }, [transactions, filterType, filterMonth, filterAccount, searchText]);

  const totalPemasukan = useMemo(() =>
    filtered.filter((t) => t.type === "pendapatan").reduce((s, t) => s + Number(t.nominal), 0),
    [filtered]
  );
  const totalPengeluaran = useMemo(() =>
    filtered.filter((t) => t.type === "pengeluaran").reduce((s, t) => s + Number(t.nominal), 0),
    [filtered]
  );

  const groups = groupByDate(filtered);
  const isFiltering = filterType !== "semua" || filterMonth !== "semua" || filterAccount !== "semua" || searchText.trim() !== "";
  const resetFilters = () => { setFilterType("semua"); setFilterMonth("semua"); setFilterAccount("semua"); setSearchText(""); };

  const handleDeleteConfirm = async () => {
    const id = deleteModal.id;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      const res = await apiFetch(`/api/transactions/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Gagal menghapus transaksi" }));
        throw new Error(body.error ?? "Gagal menghapus transaksi");
      }
      showToast({ type: "success", message: "Transaksi berhasil dihapus" });
      await refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menghapus transaksi";
      setDeleteError(msg);
      showToast({ type: "error", message: msg });
    } finally {
      setDeleteBusy(false);
      setDeleteModal({ open: false, id: "" });
    }
  };

  return (
    <PageShell width="full">
      <ConfirmModal
        open={deleteModal.open}
        title="Hapus Transaksi"
        message="Hapus transaksi ini? Saldo rekening terkait akan dikembalikan ke kondisi sebelum transaksi."
        confirmLabel="Hapus"
        confirmVariant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteModal({ open: false, id: "" })}
        busy={deleteBusy}
      />

      <PageHeader
        title="Riwayat Transaksi"
        subtitle={
          <>
            {isFiltering ? `${filtered.length} dari ${transactions.length}` : `${transactions.length}`} transaksi
            {hasMore && <span className="ml-1 text-text-muted">termuat{isFiltering ? " (mungkin ada lebih)" : ""}</span>}
          </>
        }
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters((v) => !v)}
              aria-label="Filter transaksi"
              aria-pressed={showFilters}
              className={`lg:hidden p-2.5 rounded-lg border transition-colors ${
                isFiltering
                  ? "bg-brand-soft border-brand-soft-border text-brand"
                  : showFilters
                  ? "bg-surface-hover border-border text-text-primary"
                  : "border-border text-text-muted hover:bg-surface-hover"
              }`}
            >
              <FilterIcon />
            </button>
            <Button href="/transactions/new" size="sm">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth={2} strokeLinecap="round"/></svg>
              Catat
            </Button>
          </div>
        }
      />

      <div className="lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-6 lg:items-start">
        {/* Filter panel — collapsible on mobile/tablet, persistent sidebar on desktop */}
        <div className={`${showFilters ? "block" : "hidden"} lg:block mb-4 lg:mb-0 lg:sticky lg:top-6`}>
          <Card className="space-y-4">
            <div className="hidden lg:flex items-center gap-2">
              <FilterIcon />
              <h2 className="text-sm font-semibold text-text-primary">Filter</h2>
            </div>

            {/* Search */}
            <div className="relative">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="true">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                placeholder="Cari transaksi..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              />
            </div>

            {/* Type filter pills */}
            <div>
              <p className="text-xs text-text-muted mb-2 font-medium">Tipe</p>
              <div className="flex flex-wrap gap-1.5">
                {FILTER_TYPES.map((ft) => (
                  <button
                    key={ft.value}
                    onClick={() => setFilterType(ft.value)}
                    aria-pressed={filterType === ft.value}
                    className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                      filterType === ft.value
                        ? "bg-brand border-brand text-brand-text-on"
                        : "border-border text-text-secondary hover:border-border-strong"
                    }`}
                  >
                    {ft.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Month filter */}
            {monthOptions.length > 1 && (
              <div>
                <p className="text-xs text-text-muted mb-2 font-medium">Bulan</p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setFilterMonth("semua")}
                    aria-pressed={filterMonth === "semua"}
                    className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                      filterMonth === "semua"
                        ? "bg-brand border-brand text-brand-text-on"
                        : "border-border text-text-secondary hover:border-border-strong"
                    }`}
                  >
                    Semua
                  </button>
                  {monthOptions.map((m) => (
                    <button
                      key={m}
                      onClick={() => setFilterMonth(m)}
                      aria-pressed={filterMonth === m}
                      className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                        filterMonth === m
                          ? "bg-brand border-brand text-brand-text-on"
                          : "border-border text-text-secondary hover:border-border-strong"
                      }`}
                    >
                      {formatMonthLabel(m)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Account filter */}
            {accountOptions.length > 1 && (
              <div>
                <p className="text-xs text-text-muted mb-2 font-medium">Rekening</p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setFilterAccount("semua")}
                    aria-pressed={filterAccount === "semua"}
                    className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                      filterAccount === "semua"
                        ? "bg-brand border-brand text-brand-text-on"
                        : "border-border text-text-secondary hover:border-border-strong"
                    }`}
                  >
                    Semua
                  </button>
                  {accountOptions.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => setFilterAccount(a.id)}
                      aria-pressed={filterAccount === a.id}
                      className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                        filterAccount === a.id
                          ? "bg-brand border-brand text-brand-text-on"
                          : "border-border text-text-secondary hover:border-border-strong"
                      }`}
                    >
                      {a.nama}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Reset filters */}
            {isFiltering && (
              <button
                onClick={resetFilters}
                className="text-xs text-danger-text hover:text-danger font-medium"
              >
                Hapus semua filter
              </button>
            )}
          </Card>
        </div>

        {/* Main column: summary + list */}
        <div>
          {/* Summary for filtered/month view */}
          {(filterType === "semua" || filterType === "pendapatan" || filterType === "pengeluaran") &&
            (totalPemasukan > 0 || totalPengeluaran > 0) && (
            <div className="mb-4 grid grid-cols-2 gap-3 max-w-md lg:max-w-lg">
              <div className="bg-brand-soft border border-brand-soft-border rounded-xl p-3">
                <p className="text-xs text-brand font-medium mb-0.5">Total Pemasukan</p>
                <p className="text-sm font-bold text-brand">
                  +{formatCurrency(totalPemasukan)}
                </p>
              </div>
              <div className="bg-danger-soft border border-danger-soft-border rounded-xl p-3">
                <p className="text-xs text-danger-text font-medium mb-0.5">Total Pengeluaran</p>
                <p className="text-sm font-bold text-danger-text">
                  -{formatCurrency(totalPengeluaran)}
                </p>
              </div>
            </div>
          )}

          {/* Error banners */}
          {fetchError && (
            <div className="mb-4 p-3 bg-danger-soft border border-danger-soft-border rounded-xl flex items-start gap-2" role="alert">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-danger shrink-0 mt-0.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <div className="flex-1">
                <p className="text-sm text-danger-text">{fetchError}</p>
              </div>
              <button onClick={() => refetch()} className="text-xs text-danger-text font-medium hover:underline shrink-0">Coba lagi</button>
            </div>
          )}

          {deleteError && (
            <div className="mb-4 p-3 bg-danger-soft border border-danger-soft-border rounded-xl flex items-start gap-2" role="alert">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-danger shrink-0 mt-0.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <p className="text-sm text-danger-text flex-1">{deleteError}</p>
              <button onClick={() => setDeleteError("")} aria-label="Tutup notifikasi error" className="text-danger/70 hover:text-danger shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          )}

          {/* Content */}
          {loading ? (
            <Card padding="none" className="divide-y divide-border overflow-hidden">
              {[0, 1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)}
            </Card>
          ) : filtered.length === 0 && !fetchError ? (
            <EmptyState
              icon={<TransactionsIcon />}
              title={isFiltering ? "Tidak ada transaksi yang sesuai filter" : "Belum ada transaksi"}
              description={isFiltering ? undefined : "Mulai catat pemasukan atau pengeluaran Anda"}
              action={
                isFiltering ? (
                  <Button variant="ghost" size="sm" onClick={resetFilters}>
                    Hapus filter
                  </Button>
                ) : (
                  <Button href="/transactions/new" size="sm">Catat Sekarang</Button>
                )
              }
            />
          ) : (
            <div className="space-y-6">
              {groups.map(([date, txs]) => (
                <div key={date}>
                  <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
                    {formatDateLong(date)}
                  </h3>
                  <Card padding="none" className="divide-y divide-border overflow-hidden">
                    {txs.map((tx) => {
                      const cfg = TYPE_CONFIG[tx.type] ?? { label: tx.type, color: "text-text-secondary", bg: "bg-surface-hover", sign: "" };
                      return (
                        <div key={tx.id} className="flex items-center px-4 py-3.5 gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${cfg.bg} ${cfg.color}`} aria-hidden="true">
                            {cfg.sign || "→"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-text-primary truncate">
                              {tx.rincian || tx.kategori || cfg.label}
                            </p>
                            <p className="text-xs text-text-muted">
                              {cfg.label}{tx.kategori && ` · ${tx.kategori}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <p className={`text-sm font-semibold ${cfg.color} mr-1`}>
                              {cfg.sign}{formatCurrency(tx.nominal)}
                            </p>
                            <IconButton
                              href={`/transactions/${tx.id}/edit`}
                              variant="info"
                              aria-label={`Edit transaksi ${tx.rincian || tx.kategori || cfg.label}`}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                            </IconButton>
                            <IconButton
                              onClick={() => setDeleteModal({ open: true, id: tx.id })}
                              variant="danger"
                              aria-label={`Hapus transaksi ${tx.rincian || tx.kategori || cfg.label}`}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                            </IconButton>
                          </div>
                        </div>
                      );
                    })}
                  </Card>
                </div>
              ))}
            </div>
          )}

          {/* Load more — replaces the old hardcoded limit=200 cap (audit
              temuan 5) so transaksi lama tetap bisa diakses secara bertahap. */}
          {!loading && hasMore && (
            <div className="mt-6 flex justify-center">
              <Button variant="secondary" size="sm" onClick={loadMore} loading={loadingMore}>
                {loadingMore ? "Memuat..." : "Muat Lebih Banyak"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
