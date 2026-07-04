"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ConfirmModal } from "@/components/ConfirmModal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { RequiredMark } from "@/components/ui/Input";
import { Skeleton, SkeletonHero } from "@/components/ui/Skeleton";
import { formatCurrency, formatRupiahInput, parseRupiahInput } from "@/lib/format";
import { SEMUA_REKENING } from "@/lib/institutions";

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

function AccountIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  );
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
  const [koreksiId, setKoreksiId] = useState<string | null>(null);
  const [koreksiValue, setKoreksiValue] = useState("");
  const [koreksiError, setKoreksiError] = useState("");
  const [koreksiSaving, setKoreksiSaving] = useState(false);
  const [modal, setModal] = useState<ModalState>({
    open: false,
    title: "",
    message: "",
    confirmLabel: "Ya, Lanjutkan",
    confirmVariant: "danger",
    onConfirm: () => {},
  });

  // Medium #12 (bug hunt): busy guard untuk ConfirmModal — dilempar ke `busy`
  // prop agar tombol konfirmasi disabled+spinner selama request async berjalan,
  // mencegah double-submit dari klik ganda.
  const [modalBusy, setModalBusy] = useState(false);
  const closeModal = () => { setModal((m) => ({ ...m, open: false })); setModalBusy(false); };

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
      await apiFetch("/api/accounts", "POST", { nama, saldoAwal: parseRupiahInput(saldo) });
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
        setModalBusy(true);
        try {
          await apiFetch(`/api/accounts/${id}`, "PATCH", { isActive: false });
          await refetch();
        } catch (err: unknown) {
          setFetchError(err instanceof Error ? err.message : "Gagal menonaktifkan rekening");
        } finally {
          closeModal();
        }
      },
    });
  };

  const openKoreksi = (acc: Account) => {
    setKoreksiId(acc.id);
    setKoreksiValue(formatRupiahInput(String(Math.round(Number(acc.saldoCache)))));
    setKoreksiError("");
  };

  const closeKoreksi = () => {
    setKoreksiId(null);
    setKoreksiValue("");
    setKoreksiError("");
  };

  const handleKoreksiSubmit = (acc: Account, e: React.FormEvent) => {
    e.preventDefault();
    const nilaiBaru = parseRupiahInput(koreksiValue);
    setModal({
      open: true,
      title: "Koreksi Saldo",
      message: `Saldo "${acc.nama}" akan diubah langsung dari ${formatCurrency(acc.saldoCache)} menjadi ${formatCurrency(nilaiBaru)}. Ini menimpa saldo hasil hitungan histori transaksi dan TIDAK membuat catatan transaksi baru — hanya gunakan untuk mengoreksi selisih (mis. saldo awal yang salah dicatat).`,
      confirmLabel: "Ya, Koreksi Saldo",
      confirmVariant: "warning",
      onConfirm: async () => {
        setModalBusy(true);
        setKoreksiSaving(true);
        try {
          await apiFetch(`/api/accounts/${acc.id}`, "PATCH", { saldo: nilaiBaru });
          closeKoreksi();
          await refetch();
        } catch (err: unknown) {
          setKoreksiError(err instanceof Error ? err.message : "Gagal mengoreksi saldo");
        } finally {
          setKoreksiSaving(false);
          closeModal();
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
        setModalBusy(true);
        try {
          await apiFetch(`/api/accounts/${id}`, "DELETE");
          await refetch();
        } catch (err: unknown) {
          setFetchError(err instanceof Error ? err.message : "Gagal menghapus — pastikan tidak ada transaksi terkait.");
        } finally {
          closeModal();
        }
      },
    });
  };

  const totalSaldo = accounts.filter((a) => a.isActive).reduce((s, a) => s + Number(a.saldoCache), 0);

  return (
    <div>
      <ConfirmModal
        open={modal.open}
        title={modal.title}
        message={modal.message}
        confirmLabel={modal.confirmLabel}
        confirmVariant={modal.confirmVariant}
        onConfirm={modal.onConfirm}
        onCancel={closeModal}
        busy={modalBusy}
      />

      <PageHeader
        title="Rekening"
        subtitle="Kas dan tabungan Anda"
        action={
          <Button onClick={() => setShowForm(true)} aria-label="Tambah rekening baru" size="sm">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth={2} strokeLinecap="round"/></svg>
            Tambah
          </Button>
        }
      />

      <div className="max-w-5xl">
        {/* Total */}
        {loading ? (
          <SkeletonHero className="h-24 mb-6" />
        ) : (
          <div className="bg-brand text-white rounded-2xl p-5 sm:p-6 mb-6">
            <p className="text-white/70 text-sm">Total Saldo Aktif</p>
            <p className="text-2xl sm:text-3xl font-bold mt-1">{formatCurrency(totalSaldo)}</p>
          </div>
        )}

        {/* Fetch error banner */}
        {fetchError && (
          <div className="mb-4 p-3 bg-danger-soft border border-danger-soft-border rounded-xl flex items-start gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-danger shrink-0 mt-0.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <div className="flex-1">
              <p className="text-sm text-danger-text" role="alert">{fetchError}</p>
            </div>
            <button onClick={() => refetch()} className="text-xs text-danger-text font-medium hover:underline shrink-0">Coba lagi</button>
          </div>
        )}

        {/* Form tambah */}
        {showForm && (
          <Card as="form" onSubmit={handleAdd} className="mb-6 max-w-xl" padding="lg">
            <h3 className="font-semibold text-text-primary mb-4">Rekening Baru</h3>
            {error && <p className="text-sm text-danger-text mb-3">{error}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="acc-nama" className="block text-sm font-medium text-text-secondary mb-1">Nama Rekening<RequiredMark /></label>
                <input
                  id="acc-nama"
                  list="rekening-options"
                  className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/30"
                  placeholder="Cth: BCA, GoPay, atau ketik nama lain"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  autoComplete="off"
                  required
                />
                <datalist id="rekening-options">
                  {SEMUA_REKENING.map((r) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
              </div>
              <div>
                <label htmlFor="acc-saldo" className="block text-sm font-medium text-text-secondary mb-1">Saldo Awal</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm" aria-hidden="true">Rp</span>
                  <input
                    id="acc-saldo"
                    type="text"
                    inputMode="numeric"
                    className="w-full pl-10 pr-3 py-2.5 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/30"
                    placeholder="0"
                    value={saldo}
                    onChange={(e) => setSaldo(formatRupiahInput(e.target.value))}
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-4 max-w-xs">
              <Button type="button" variant="secondary" fullWidth onClick={() => { setShowForm(false); setError(""); }}>
                Batal
              </Button>
              <Button type="submit" fullWidth loading={saving}>
                {saving ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </Card>
        )}

        {/* List */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : accounts.length === 0 && !fetchError ? (
          <EmptyState
            icon={<AccountIcon />}
            title="Belum ada rekening"
            description="Tambahkan rekening pertama Anda"
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {accounts.map((acc) => (
              <Card key={acc.id} className={`transition-opacity ${acc.isActive ? "" : "opacity-60"}`}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="font-semibold text-text-primary truncate">{acc.nama}</p>
                    {!acc.isActive && <Badge>Nonaktif</Badge>}
                  </div>
                  <div className="flex gap-0.5 shrink-0 -mr-1 -mt-1">
                    <Link
                      href={`/accounts/${acc.id}/mutasi`}
                      aria-label={`Lihat mutasi rekening ${acc.nama}`}
                      className="p-1.5 text-text-muted hover:text-brand transition-colors rounded-lg hover:bg-brand-soft"
                      title="Mutasi Rekening"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>
                    </Link>
                    <button
                      onClick={() => (koreksiId === acc.id ? closeKoreksi() : openKoreksi(acc))}
                      aria-label={`Koreksi saldo rekening ${acc.nama}`}
                      aria-pressed={koreksiId === acc.id}
                      className="p-1.5 text-text-muted hover:text-info transition-colors rounded-lg hover:bg-info-soft"
                      title="Koreksi Saldo"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                    </button>
                    {acc.isActive && (
                      <button
                        onClick={() => handleDeactivate(acc.id, acc.nama)}
                        aria-label={`Nonaktifkan rekening ${acc.nama}`}
                        className="p-1.5 text-text-muted hover:text-warning transition-colors rounded-lg hover:bg-warning-soft"
                        title="Nonaktifkan"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true"><path d="M18.36 6.64a9 9 0 11-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(acc.id, acc.nama)}
                      aria-label={`Hapus rekening ${acc.nama}`}
                      className="p-1.5 text-text-muted hover:text-danger transition-colors rounded-lg hover:bg-danger-soft"
                      title="Hapus"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                    </button>
                  </div>
                </div>
                <p className="text-lg font-bold text-brand">{formatCurrency(acc.saldoCache)}</p>

                {koreksiId === acc.id && (
                  <form onSubmit={(e) => handleKoreksiSubmit(acc, e)} className="mt-3 pt-3 border-t border-border space-y-2">
                    {koreksiError && <p className="text-xs text-danger-text">{koreksiError}</p>}
                    <label htmlFor={`koreksi-${acc.id}`} className="block text-xs font-medium text-text-muted">
                      Saldo baru (koreksi manual)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm" aria-hidden="true">Rp</span>
                      <input
                        id={`koreksi-${acc.id}`}
                        type="text"
                        inputMode="numeric"
                        className="w-full pl-10 pr-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-info/30"
                        value={koreksiValue}
                        onChange={(e) => setKoreksiValue(formatRupiahInput(e.target.value))}
                        autoFocus
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="secondary" size="sm" fullWidth onClick={closeKoreksi}>
                        Batal
                      </Button>
                      <Button type="submit" variant="info" size="sm" fullWidth loading={koreksiSaving}>
                        Simpan
                      </Button>
                    </div>
                  </form>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
