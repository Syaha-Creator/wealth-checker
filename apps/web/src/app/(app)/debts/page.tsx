"use client";

import { useEffect, useState, useCallback } from "react";
import type { FormEvent } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageShell } from "@/components/ui/PageShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, InputRupiah, RequiredMark, Select } from "@/components/ui/Input";
import { SkeletonHero, Skeleton } from "@/components/ui/Skeleton";
import { Tabs, tabPanelId, tabButtonId } from "@/components/ui/Tabs";
import { formatCurrency, formatRupiahInput, parseRupiahInput } from "@/lib/format";
import { SEMUA_KARTU_KREDIT_PAYLATER } from "@/lib/institutions";
import { apiFetch as apiFetchRaw, notifyWealthChanged } from "@/lib/apiFetch";
import { ConfirmModal } from "@/components/ConfirmModal";
import { IconButton } from "@/components/ui/IconButton";
import { useToast } from "@/components/ui/Toast";

const DEBT_SALDO_LOCKED_HINT =
  "Utang ini sudah punya histori cicilan — sesuaikan sisa lewat transaksi Bayar Cicilan (atau edit/hapus cicilan yang salah).";
const DEBT_SALDO_EDITABLE_HINT =
  "Belum ada cicilan tercatat. Kamu bisa koreksi sisa utang di sini jika angka awal salah.";
const RECEIVABLE_SALDO_LOCKED_HINT =
  "Piutang ini sudah punya histori penerimaan — sesuaikan sisa lewat transaksi Terima (atau edit/hapus penerimaan yang salah).";
const RECEIVABLE_SALDO_EDITABLE_HINT =
  "Belum ada penerimaan tercatat. Kamu bisa koreksi sisa piutang di sini jika angka awal salah.";

const DEBT_TABS_ID_PREFIX = "debts";
const DEBT_TABS: { id: "utang" | "piutang"; label: string }[] = [
  { id: "utang", label: "Utang" },
  { id: "piutang", label: "Piutang" },
];

type AddMode = "transaksi" | "deklarasi";

const DEBT_ADD_MODE_TABS: { id: AddMode; label: string }[] = [
  { id: "transaksi", label: "Utang Baru" },
  { id: "deklarasi", label: "Utang yang Sudah Ada" },
];

const RECEIVABLE_ADD_MODE_TABS: { id: AddMode; label: string }[] = [
  { id: "transaksi", label: "Piutang Baru" },
  { id: "deklarasi", label: "Piutang yang Sudah Ada" },
];

type Account = { id: string; nama: string; saldoCache: string; isActive: boolean };

type DebtItem = {
  id: string; pemberiUtang: string; tipe: string;
  totalPinjaman: number; totalTerbayar: number; sisaSaldo: number;
  progressPercent: number; lunas: boolean;
};
type DebtSummary = {
  totalPinjaman: number; totalTerbayar: number; totalSisaSaldo: number;
  progressPercent: number; perPemberi: DebtItem[];
};

type ReceivableItem = {
  id: string; peminjam: string;
  totalDipinjamkan: number; totalDiterima: number; sisaSaldo: number;
  progressPercent: number; lunas: boolean;
};
type ReceivableSummary = {
  totalDipinjamkan: number; totalDiterima: number; totalSisaSaldo: number;
  progressPercent: number; perPeminjam: ReceivableItem[];
};

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
  if (res.status === 204) return null;
  return res.json();
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function PlusIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth={2} strokeLinecap="round" /></svg>;
}

function DebtIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  );
}

function ReceivableIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </svg>
  );
}

function ProgressBar({ percent, colorClass = "bg-brand", trackClass = "bg-border" }: { percent: number; colorClass?: string; trackClass?: string }) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div
      className={`w-full h-1.5 ${trackClass} rounded-full overflow-hidden`}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={`h-full ${colorClass} rounded-full transition-all`} style={{ width: `${clamped}%` }} />
    </div>
  );
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="mb-4 p-3 bg-danger-soft border border-danger-soft-border rounded-xl flex items-start gap-2" role="alert">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-danger shrink-0 mt-0.5" aria-hidden="true"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
      <p className="text-sm text-danger-text flex-1">{message}</p>
      {onRetry && <button onClick={onRetry} className="text-xs text-danger-text font-medium hover:underline shrink-0">Coba lagi</button>}
    </div>
  );
}

// ─── Tab: Utang ─────────────────────────────────────────────────────────────

function DebtTab({
  summary, accounts, accountsLoaded, onChanged,
}: {
  summary: DebtSummary | null;
  accounts: Account[];
  accountsLoaded: boolean;
  onChanged: () => Promise<void>;
}) {
  const { showToast } = useToast();
  const [showAddForm, setShowAddForm] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>("transaksi");
  const [pemberiUtang, setPemberiUtang] = useState("");
  const [tipe, setTipe] = useState<"utang_biasa" | "kartu_kredit">("utang_biasa");
  const [nominal, setNominal] = useState("");
  const [accountId, setAccountId] = useState("");
  const [tanggal, setTanggal] = useState(todayStr());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [payingId, setPayingId] = useState<string | null>(null);
  const [payNominal, setPayNominal] = useState("");
  const [payAccountId, setPayAccountId] = useState("");
  const [payTanggal, setPayTanggal] = useState(todayStr());
  const [paySaving, setPaySaving] = useState(false);
  const [payError, setPayError] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPemberiUtang, setEditPemberiUtang] = useState("");
  const [editTipe, setEditTipe] = useState<"utang_biasa" | "kartu_kredit">("utang_biasa");
  const [editSisaSaldo, setEditSisaSaldo] = useState("");
  const [editCanAdjustSaldo, setEditCanAdjustSaldo] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const [deleteModal, setDeleteModal] = useState<{ open: boolean; id: string; nama: string }>({ open: false, id: "", nama: "" });
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  // Audit temuan 5 (skalabilitas): daftar kreditur murni scroll vertikal
  // tanpa pencarian — muncul begitu daftar cukup panjang untuk butuh itu.
  const [search, setSearch] = useState("");

  const resetAddForm = () => {
    setAddMode("transaksi");
    setPemberiUtang(""); setTipe("utang_biasa"); setNominal(""); setAccountId(""); setTanggal(todayStr()); setFormError("");
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true); setFormError("");
    try {
      if (addMode === "transaksi") {
        await apiFetch("/api/transactions", "POST", {
          tanggal, type: "pinjaman_utang", pemberiUtang, debtTipe: tipe,
          accountId, nominal: parseRupiahInput(nominal),
        });
      } else {
        const sisa = parseRupiahInput(nominal);
        await apiFetch("/api/debts", "POST", {
          pemberiUtang,
          tipe,
          saldoAwal: sisa,
        });
      }
      resetAddForm();
      setShowAddForm(false);
      notifyWealthChanged();
      showToast({
        type: "success",
        message: addMode === "transaksi" ? "Utang baru berhasil dicatat" : "Utang berhasil ditambahkan",
      });
      await onChanged();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan";
      setFormError(msg);
      showToast({ type: "error", message: msg });
    } finally {
      setSaving(false);
    }
  };

  const openPayForm = (id: string) => {
    setEditingId(null);
    setPayingId(id); setPayNominal(""); setPayAccountId(""); setPayTanggal(todayStr()); setPayError("");
  };

  const openEditForm = (d: DebtItem) => {
    setPayingId(null);
    setEditingId(d.id);
    setEditPemberiUtang(d.pemberiUtang);
    setEditTipe(d.tipe === "kartu_kredit" ? "kartu_kredit" : "utang_biasa");
    // API menolak koreksi saldo setelah ada bayar_utang — proxy UI: totalTerbayar === 0.
    const canAdjust = d.totalTerbayar === 0;
    setEditCanAdjustSaldo(canAdjust);
    setEditSisaSaldo(canAdjust ? formatRupiahInput(String(Math.round(d.sisaSaldo))) : "");
    setEditError("");
  };

  const handleEdit = async (e: FormEvent, id: string) => {
    e.preventDefault();
    setEditSaving(true); setEditError("");
    try {
      const payload: {
        pemberiUtang: string;
        tipe: "utang_biasa" | "kartu_kredit";
        saldoAwal?: number;
        sisaSaldo?: number;
      } = {
        pemberiUtang: editPemberiUtang,
        tipe: editTipe,
      };
      if (editCanAdjustSaldo) {
        const sisa = parseRupiahInput(editSisaSaldo);
        // Belum ada cicilan → set saldoAwal = sisaSaldo agar "total pinjaman" ikut selaras.
        payload.saldoAwal = sisa;
        payload.sisaSaldo = sisa;
      }
      await apiFetch(`/api/debts/${id}`, "PATCH", payload);
      setEditingId(null);
      notifyWealthChanged();
      showToast({ type: "success", message: "Utang berhasil diperbarui" });
      await onChanged();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan perubahan";
      setEditError(msg);
      showToast({ type: "error", message: msg });
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setDeleteBusy(true); setDeleteError("");
    try {
      await apiFetch(`/api/debts/${deleteModal.id}`, "DELETE");
      setDeleteModal({ open: false, id: "", nama: "" });
      setEditingId(null);
      setPayingId(null);
      notifyWealthChanged();
      showToast({ type: "success", message: "Utang berhasil dihapus" });
      await onChanged();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menghapus utang";
      setDeleteError(msg);
      showToast({ type: "error", message: msg });
    } finally {
      setDeleteBusy(false);
    }
  };

  const handlePay = async (e: FormEvent, debtId: string) => {
    e.preventDefault();
    setPaySaving(true); setPayError("");
    try {
      await apiFetch("/api/transactions", "POST", {
        tanggal: payTanggal, type: "bayar_utang", relatedDebtId: debtId,
        accountId: payAccountId, nominal: parseRupiahInput(payNominal),
      });
      setPayingId(null);
      notifyWealthChanged();
      showToast({ type: "success", message: "Pembayaran utang berhasil dicatat" });
      await onChanged();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal mencatat pembayaran";
      setPayError(msg);
      showToast({ type: "error", message: msg });
    } finally {
      setPaySaving(false);
    }
  };

  const items = summary?.perPemberi ?? [];

  if (accountsLoaded && accounts.length === 0 && items.length === 0 && !showAddForm) {
    return (
      <EmptyState
        icon={<DebtIcon />}
        title="Belum ada rekening aktif"
        description="Tambahkan rekening untuk mencatat pinjaman baru, atau deklarasikan utang yang sudah ada tanpa dampak kas."
        action={
          <div className="flex flex-wrap gap-2 justify-center">
            <Button href="/accounts" size="sm">Tambah Rekening</Button>
            <Button size="sm" variant="outline" onClick={() => { setAddMode("deklarasi"); setShowAddForm(true); }}>
              Utang yang Sudah Ada
            </Button>
          </div>
        }
      />
    );
  }

  const filteredItems = search.trim()
    ? items.filter((d) => d.pemberiUtang.toLowerCase().includes(search.trim().toLowerCase()))
    : items;

  return (
    <div>
      <ConfirmModal
        open={deleteModal.open}
        title="Hapus Utang"
        message={`Hapus utang "${deleteModal.nama}"? Hanya bisa dilakukan jika belum ada transaksi pinjaman/cicilan terkait.`}
        confirmLabel="Hapus"
        confirmVariant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => { if (!deleteBusy) setDeleteModal({ open: false, id: "", nama: "" }); }}
        busy={deleteBusy}
      />
      {deleteError && !deleteModal.open && (
        <p role="alert" className="text-sm text-danger-text mb-3">{deleteError}</p>
      )}

      <div className="bg-brand text-white rounded-2xl p-5 sm:p-6 mb-6">
        <p className="text-white/70 text-sm">Total Sisa Utang</p>
        <p className="text-2xl sm:text-3xl font-bold mt-1">{formatCurrency(summary?.totalSisaSaldo ?? 0)}</p>
        <div className="flex justify-between text-xs text-white/70 mt-3 gap-2">
          <span className="truncate">Pinjaman: {formatCurrency(summary?.totalPinjaman ?? 0)}</span>
          <span className="truncate">Terbayar: {formatCurrency(summary?.totalTerbayar ?? 0)}</span>
        </div>
        <div className="mt-2"><ProgressBar percent={summary?.progressPercent ?? 0} colorClass="bg-white" trackClass="bg-white/20" /></div>
      </div>

      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={() => setShowAddForm((v) => !v)}>
          <PlusIcon /> Utang Baru
        </Button>
      </div>

      {showAddForm && (
        <Card as="form" onSubmit={handleAdd} padding="lg" className="mb-6">
          <h3 className="font-semibold text-text-primary mb-4">Tambah Utang</h3>
          <Tabs
            items={DEBT_ADD_MODE_TABS}
            value={addMode}
            onChange={setAddMode}
            idPrefix="debt-add-mode"
            aria-label="Cara menambah utang"
            fitted
            className="mb-4 max-w-lg"
          />
          {formError && <p role="alert" className="text-sm text-danger-text mb-3">{formError}</p>}
          {addMode === "transaksi" && accounts.length === 0 && (
            <p className="text-sm text-warning-text mb-3">Belum ada rekening aktif. Tambahkan rekening dulu atau pilih &quot;Utang yang Sudah Ada&quot;.</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Tipe"
              value={tipe}
              onChange={(e) => setTipe(e.target.value as "utang_biasa" | "kartu_kredit")}
              required
            >
              <option value="utang_biasa">Utang Biasa</option>
              <option value="kartu_kredit">Kartu Kredit</option>
            </Select>
            <div>
              <label htmlFor="debt-pemberi" className="block text-sm font-medium text-text-secondary mb-1">
                {tipe === "kartu_kredit" ? "Nama Kartu / Penyedia" : "Nama Pemberi Pinjaman"}
                <RequiredMark />
              </label>
              <input
                id="debt-pemberi"
                list="debt-pemberi-options"
                className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/30"
                placeholder={tipe === "kartu_kredit" ? "Cth: BCA, Kredivo" : "Cth: Bank BRI, Pak Budi"}
                value={pemberiUtang}
                onChange={(e) => setPemberiUtang(e.target.value)}
                autoComplete="off"
                required
              />
              <datalist id="debt-pemberi-options">
                {SEMUA_KARTU_KREDIT_PAYLATER.map((n) => <option key={n} value={n} />)}
              </datalist>
            </div>
            <InputRupiah
              id="debt-nominal"
              label={addMode === "deklarasi" ? "Sisa Saldo Saat Ini" : "Nominal Pinjaman"}
              value={nominal}
              onChange={setNominal}
              required
            />
            {addMode === "transaksi" && (
              <>
                <Select
                  id="debt-account"
                  label="Rekening Tujuan"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  required
                >
                  <option value="">Pilih rekening</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.nama}</option>)}
                </Select>
                <Input id="debt-tanggal" type="date" label="Tanggal" value={tanggal} onChange={(e) => setTanggal(e.target.value)} required />
              </>
            )}
          </div>
          <div className="flex gap-2 mt-4 max-w-sm">
            <Button type="button" variant="secondary" fullWidth onClick={() => { setShowAddForm(false); resetAddForm(); }}>Batal</Button>
            <Button
              type="submit"
              fullWidth
              loading={saving}
              disabled={addMode === "transaksi" && accounts.length === 0}
            >
              {saving ? "Menyimpan..." : addMode === "deklarasi" ? "Simpan Deklarasi" : "Simpan"}
            </Button>
          </div>
        </Card>
      )}

      {items.length === 0 ? (
        <EmptyState icon={<DebtIcon />} title="Belum ada utang tercatat" description="Catat pinjaman baru untuk mulai melacak cicilan Anda" />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 xl:gap-4 items-start">
          {items.length > 5 && (
            <div className="relative col-span-full">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="true">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Cari nama pemberi pinjaman..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Cari utang"
                className="w-full pl-8 pr-3 py-2 text-sm bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              />
            </div>
          )}
          {filteredItems.length === 0 && (
            <p className="col-span-full text-sm text-text-muted text-center py-6">Tidak ada utang yang cocok dengan &quot;{search}&quot;</p>
          )}
          {filteredItems.map((d) => (
            <Card key={d.id}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-text-primary truncate">{d.pemberiUtang}</p>
                    {d.tipe === "kartu_kredit" && <Badge variant="info">Kartu Kredit</Badge>}
                    {d.lunas && <Badge variant="success">Lunas</Badge>}
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">Total pinjaman: {formatCurrency(d.totalPinjaman)}</p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0 -mr-1 -mt-1">
                  {!d.lunas && (
                    <Button size="sm" variant="outline" onClick={() => (payingId === d.id ? setPayingId(null) : openPayForm(d.id))}>
                      Bayar Cicilan
                    </Button>
                  )}
                  <IconButton
                    onClick={() => (editingId === d.id ? setEditingId(null) : openEditForm(d))}
                    size="sm"
                    variant="info"
                    aria-label={`Edit utang ${d.pemberiUtang}`}
                    aria-pressed={editingId === d.id}
                    title="Edit"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                  </IconButton>
                  <div className="w-px h-5 bg-border mx-1" aria-hidden="true" />
                  <IconButton
                    onClick={() => setDeleteModal({ open: true, id: d.id, nama: d.pemberiUtang })}
                    size="sm"
                    variant="danger"
                    aria-label={`Hapus utang ${d.pemberiUtang}`}
                    title="Hapus"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                  </IconButton>
                </div>
              </div>
              <p className={`text-lg font-bold ${d.lunas ? "text-brand" : "text-danger-text"}`}>{formatCurrency(d.sisaSaldo)}</p>
              <div className="mt-2"><ProgressBar percent={d.progressPercent} /></div>

              {editingId === d.id && (
                <form onSubmit={(e) => handleEdit(e, d.id)} className="mt-4 pt-4 border-t border-border space-y-3">
                  {editError && <p className="text-sm text-danger-text">{editError}</p>}
                  <p className="text-xs text-text-muted">
                    {editCanAdjustSaldo ? DEBT_SALDO_EDITABLE_HINT : DEBT_SALDO_LOCKED_HINT}
                  </p>
                  <Select
                    id={`edit-debt-tipe-${d.id}`}
                    label="Tipe"
                    value={editTipe}
                    onChange={(e) => setEditTipe(e.target.value as "utang_biasa" | "kartu_kredit")}
                    required
                  >
                    <option value="utang_biasa">Utang Biasa</option>
                    <option value="kartu_kredit">Kartu Kredit</option>
                  </Select>
                  <div>
                    <label htmlFor={`edit-debt-pemberi-${d.id}`} className="block text-sm font-medium text-text-secondary mb-1">
                      {editTipe === "kartu_kredit" ? "Nama Kartu / Penyedia" : "Nama Pemberi Pinjaman"}
                      <RequiredMark />
                    </label>
                    <input
                      id={`edit-debt-pemberi-${d.id}`}
                      list="debt-pemberi-options"
                      className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/30"
                      value={editPemberiUtang}
                      onChange={(e) => setEditPemberiUtang(e.target.value)}
                      autoComplete="off"
                      required
                    />
                  </div>
                  {editCanAdjustSaldo && (
                    <InputRupiah
                      id={`edit-debt-sisa-${d.id}`}
                      label="Sisa Utang (koreksi)"
                      value={editSisaSaldo}
                      onChange={setEditSisaSaldo}
                      hint="Mengubah total pinjaman dan sisa menjadi angka ini"
                      required
                    />
                  )}
                  <div className="flex gap-2 max-w-sm">
                    <Button type="button" variant="secondary" fullWidth onClick={() => setEditingId(null)}>Batal</Button>
                    <Button type="submit" fullWidth loading={editSaving}>{editSaving ? "Menyimpan..." : "Simpan"}</Button>
                  </div>
                </form>
              )}

              {payingId === d.id && (() => {
                // Medium #11 (bug hunt): client-side cap vs sisaSaldo — server
                // sudah guard ini (atomic conditional UPDATE), tapi UX lebih
                // responsif kalau user langsung lihat error sebelum submit,
                // konsisten dengan pola di transactions/new.
                const payNominalValue = parseRupiahInput(payNominal);
                const payExceedsLimit = payNominalValue > d.sisaSaldo;
                return (
                  <form onSubmit={(e) => handlePay(e, d.id)} className="mt-4 pt-4 border-t border-border space-y-3">
                    {payError && <p className="text-sm text-danger-text">{payError}</p>}
                    <InputRupiah
                      id={`pay-nominal-${d.id}`}
                      label="Nominal Cicilan"
                      value={payNominal}
                      onChange={setPayNominal}
                      hint={payExceedsLimit ? undefined : `Sisa utang: ${formatCurrency(d.sisaSaldo)}`}
                      error={payExceedsLimit ? `Nominal melebihi sisa utang (${formatCurrency(d.sisaSaldo)})` : undefined}
                      required
                    />
                    <Select
                      id={`pay-account-${d.id}`}
                      label="Rekening Sumber"
                      value={payAccountId}
                      onChange={(e) => setPayAccountId(e.target.value)}
                      required
                    >
                      <option value="">Pilih rekening</option>
                      {accounts.map((a) => <option key={a.id} value={a.id}>{a.nama}</option>)}
                    </Select>
                    <Input id={`pay-tanggal-${d.id}`} type="date" label="Tanggal" value={payTanggal} onChange={(e) => setPayTanggal(e.target.value)} required />
                    <div className="flex gap-2 max-w-sm">
                      <Button type="button" variant="secondary" fullWidth onClick={() => setPayingId(null)}>Batal</Button>
                      <Button type="submit" fullWidth loading={paySaving} disabled={payExceedsLimit}>{paySaving ? "Memproses..." : "Bayar"}</Button>
                    </div>
                  </form>
                );
              })()}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Piutang ───────────────────────────────────────────────────────────

function ReceivableTab({
  summary, accounts, accountsLoaded, onChanged,
}: {
  summary: ReceivableSummary | null;
  accounts: Account[];
  accountsLoaded: boolean;
  onChanged: () => Promise<void>;
}) {
  const { showToast } = useToast();
  const [showAddForm, setShowAddForm] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>("transaksi");
  const [peminjam, setPeminjam] = useState("");
  const [nominal, setNominal] = useState("");
  const [accountId, setAccountId] = useState("");
  const [tanggal, setTanggal] = useState(todayStr());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [receivingId, setReceivingId] = useState<string | null>(null);
  const [recvNominal, setRecvNominal] = useState("");
  const [recvAccountId, setRecvAccountId] = useState("");
  const [recvTanggal, setRecvTanggal] = useState(todayStr());
  const [recvSaving, setRecvSaving] = useState(false);
  const [recvError, setRecvError] = useState("");
  const [search, setSearch] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPeminjam, setEditPeminjam] = useState("");
  const [editSisaSaldo, setEditSisaSaldo] = useState("");
  const [editCanAdjustSaldo, setEditCanAdjustSaldo] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const [deleteModal, setDeleteModal] = useState<{ open: boolean; id: string; nama: string }>({ open: false, id: "", nama: "" });
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const resetAddForm = () => {
    setAddMode("transaksi");
    setPeminjam(""); setNominal(""); setAccountId(""); setTanggal(todayStr()); setFormError("");
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true); setFormError("");
    try {
      if (addMode === "transaksi") {
        await apiFetch("/api/transactions", "POST", {
          tanggal, type: "pemberian_piutang", peminjam,
          accountId, nominal: parseRupiahInput(nominal),
        });
      } else {
        const sisa = parseRupiahInput(nominal);
        await apiFetch("/api/debts/receivables", "POST", {
          peminjam,
          saldoAwal: sisa,
        });
      }
      resetAddForm();
      setShowAddForm(false);
      notifyWealthChanged();
      showToast({
        type: "success",
        message: addMode === "transaksi" ? "Piutang baru berhasil dicatat" : "Piutang berhasil ditambahkan",
      });
      await onChanged();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan";
      setFormError(msg);
      showToast({ type: "error", message: msg });
    } finally {
      setSaving(false);
    }
  };

  const openReceiveForm = (id: string) => {
    setEditingId(null);
    setReceivingId(id); setRecvNominal(""); setRecvAccountId(""); setRecvTanggal(todayStr()); setRecvError("");
  };

  const openEditForm = (r: ReceivableItem) => {
    setReceivingId(null);
    setEditingId(r.id);
    setEditPeminjam(r.peminjam);
    const canAdjust = r.totalDiterima === 0;
    setEditCanAdjustSaldo(canAdjust);
    setEditSisaSaldo(canAdjust ? formatRupiahInput(String(Math.round(r.sisaSaldo))) : "");
    setEditError("");
  };

  const handleEdit = async (e: FormEvent, id: string) => {
    e.preventDefault();
    setEditSaving(true); setEditError("");
    try {
      const payload: { peminjam: string; saldoAwal?: number; sisaSaldo?: number } = {
        peminjam: editPeminjam,
      };
      if (editCanAdjustSaldo) {
        const sisa = parseRupiahInput(editSisaSaldo);
        payload.saldoAwal = sisa;
        payload.sisaSaldo = sisa;
      }
      await apiFetch(`/api/debts/receivables/${id}`, "PATCH", payload);
      setEditingId(null);
      notifyWealthChanged();
      showToast({ type: "success", message: "Piutang berhasil diperbarui" });
      await onChanged();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan perubahan";
      setEditError(msg);
      showToast({ type: "error", message: msg });
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setDeleteBusy(true); setDeleteError("");
    try {
      await apiFetch(`/api/debts/receivables/${deleteModal.id}`, "DELETE");
      setDeleteModal({ open: false, id: "", nama: "" });
      setEditingId(null);
      setReceivingId(null);
      notifyWealthChanged();
      showToast({ type: "success", message: "Piutang berhasil dihapus" });
      await onChanged();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menghapus piutang";
      setDeleteError(msg);
      showToast({ type: "error", message: msg });
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleReceive = async (e: FormEvent, receivableId: string) => {
    e.preventDefault();
    setRecvSaving(true); setRecvError("");
    try {
      await apiFetch("/api/transactions", "POST", {
        tanggal: recvTanggal, type: "penerimaan_piutang", relatedReceivableId: receivableId,
        accountId: recvAccountId, nominal: parseRupiahInput(recvNominal),
      });
      setReceivingId(null);
      notifyWealthChanged();
      showToast({ type: "success", message: "Penerimaan piutang berhasil dicatat" });
      await onChanged();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal mencatat penerimaan";
      setRecvError(msg);
      showToast({ type: "error", message: msg });
    } finally {
      setRecvSaving(false);
    }
  };

  const items = summary?.perPeminjam ?? [];

  if (accountsLoaded && accounts.length === 0 && items.length === 0 && !showAddForm) {
    return (
      <EmptyState
        icon={<ReceivableIcon />}
        title="Belum ada rekening aktif"
        description="Tambahkan rekening untuk mencatat piutang baru, atau deklarasikan piutang yang sudah ada tanpa dampak kas."
        action={
          <div className="flex flex-wrap gap-2 justify-center">
            <Button href="/accounts" size="sm">Tambah Rekening</Button>
            <Button size="sm" variant="outline" onClick={() => { setAddMode("deklarasi"); setShowAddForm(true); }}>
              Piutang yang Sudah Ada
            </Button>
          </div>
        }
      />
    );
  }

  const filteredItems = search.trim()
    ? items.filter((r) => r.peminjam.toLowerCase().includes(search.trim().toLowerCase()))
    : items;

  return (
    <div>
      <ConfirmModal
        open={deleteModal.open}
        title="Hapus Piutang"
        message={`Hapus piutang "${deleteModal.nama}"? Hanya bisa dilakukan jika belum ada transaksi pemberian/penerimaan terkait.`}
        confirmLabel="Hapus"
        confirmVariant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => { if (!deleteBusy) setDeleteModal({ open: false, id: "", nama: "" }); }}
        busy={deleteBusy}
      />
      {deleteError && !deleteModal.open && (
        <p role="alert" className="text-sm text-danger-text mb-3">{deleteError}</p>
      )}

      <div className="bg-brand text-white rounded-2xl p-5 sm:p-6 mb-6">
        <p className="text-white/70 text-sm">Total Sisa Piutang</p>
        <p className="text-2xl sm:text-3xl font-bold mt-1">{formatCurrency(summary?.totalSisaSaldo ?? 0)}</p>
        <div className="flex justify-between text-xs text-white/70 mt-3 gap-2">
          <span className="truncate">Dipinjamkan: {formatCurrency(summary?.totalDipinjamkan ?? 0)}</span>
          <span className="truncate">Diterima: {formatCurrency(summary?.totalDiterima ?? 0)}</span>
        </div>
        <div className="mt-2"><ProgressBar percent={summary?.progressPercent ?? 0} colorClass="bg-white" trackClass="bg-white/20" /></div>
      </div>

      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={() => setShowAddForm((v) => !v)}>
          <PlusIcon /> Piutang Baru
        </Button>
      </div>

      {showAddForm && (
        <Card as="form" onSubmit={handleAdd} padding="lg" className="mb-6">
          <h3 className="font-semibold text-text-primary mb-4">Tambah Piutang</h3>
          <Tabs
            items={RECEIVABLE_ADD_MODE_TABS}
            value={addMode}
            onChange={setAddMode}
            idPrefix="receivable-add-mode"
            aria-label="Cara menambah piutang"
            fitted
            className="mb-4 max-w-lg"
          />
          {formError && <p role="alert" className="text-sm text-danger-text mb-3">{formError}</p>}
          {addMode === "transaksi" && accounts.length === 0 && (
            <p className="text-sm text-warning-text mb-3">Belum ada rekening aktif. Tambahkan rekening dulu atau pilih &quot;Piutang yang Sudah Ada&quot;.</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              id="rec-peminjam"
              label="Nama Peminjam"
              placeholder="Cth: Bu Sari, Teman"
              value={peminjam}
              onChange={(e) => setPeminjam(e.target.value)}
              required
            />
            <InputRupiah
              id="rec-nominal"
              label={addMode === "deklarasi" ? "Sisa Saldo Saat Ini" : "Nominal Dipinjamkan"}
              value={nominal}
              onChange={setNominal}
              required
            />
            {addMode === "transaksi" && (
              <>
                <Select
                  id="rec-account"
                  label="Rekening Sumber"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  required
                >
                  <option value="">Pilih rekening</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.nama}</option>)}
                </Select>
                <Input id="rec-tanggal" type="date" label="Tanggal" value={tanggal} onChange={(e) => setTanggal(e.target.value)} required />
              </>
            )}
          </div>
          <div className="flex gap-2 mt-4 max-w-sm">
            <Button type="button" variant="secondary" fullWidth onClick={() => { setShowAddForm(false); resetAddForm(); }}>Batal</Button>
            <Button
              type="submit"
              fullWidth
              loading={saving}
              disabled={addMode === "transaksi" && accounts.length === 0}
            >
              {saving ? "Menyimpan..." : addMode === "deklarasi" ? "Simpan Deklarasi" : "Simpan"}
            </Button>
          </div>
        </Card>
      )}

      {items.length === 0 ? (
        <EmptyState icon={<ReceivableIcon />} title="Belum ada piutang tercatat" description="Catat pemberian pinjaman baru untuk mulai melacak pembayarannya" />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 xl:gap-4 items-start">
          {items.length > 5 && (
            <div className="relative col-span-full">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="true">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Cari nama peminjam..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Cari piutang"
                className="w-full pl-8 pr-3 py-2 text-sm bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              />
            </div>
          )}
          {filteredItems.length === 0 && (
            <p className="col-span-full text-sm text-text-muted text-center py-6">Tidak ada piutang yang cocok dengan &quot;{search}&quot;</p>
          )}
          {filteredItems.map((r) => (
            <Card key={r.id}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-text-primary truncate">{r.peminjam}</p>
                    {r.lunas && <Badge variant="success">Lunas</Badge>}
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">Total dipinjamkan: {formatCurrency(r.totalDipinjamkan)}</p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0 -mr-1 -mt-1">
                  {!r.lunas && (
                    <Button size="sm" variant="outline" onClick={() => (receivingId === r.id ? setReceivingId(null) : openReceiveForm(r.id))}>
                      Terima Pembayaran
                    </Button>
                  )}
                  <IconButton
                    onClick={() => (editingId === r.id ? setEditingId(null) : openEditForm(r))}
                    size="sm"
                    variant="info"
                    aria-label={`Edit piutang ${r.peminjam}`}
                    aria-pressed={editingId === r.id}
                    title="Edit"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                  </IconButton>
                  <div className="w-px h-5 bg-border mx-1" aria-hidden="true" />
                  <IconButton
                    onClick={() => setDeleteModal({ open: true, id: r.id, nama: r.peminjam })}
                    size="sm"
                    variant="danger"
                    aria-label={`Hapus piutang ${r.peminjam}`}
                    title="Hapus"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                  </IconButton>
                </div>
              </div>
              <p className={`text-lg font-bold ${r.lunas ? "text-brand" : "text-warning-text"}`}>{formatCurrency(r.sisaSaldo)}</p>
              <div className="mt-2"><ProgressBar percent={r.progressPercent} /></div>

              {editingId === r.id && (
                <form onSubmit={(e) => handleEdit(e, r.id)} className="mt-4 pt-4 border-t border-border space-y-3">
                  {editError && <p className="text-sm text-danger-text">{editError}</p>}
                  <p className="text-xs text-text-muted">
                    {editCanAdjustSaldo ? RECEIVABLE_SALDO_EDITABLE_HINT : RECEIVABLE_SALDO_LOCKED_HINT}
                  </p>
                  <Input
                    id={`edit-rec-peminjam-${r.id}`}
                    label="Nama Peminjam"
                    value={editPeminjam}
                    onChange={(e) => setEditPeminjam(e.target.value)}
                    required
                  />
                  {editCanAdjustSaldo && (
                    <InputRupiah
                      id={`edit-rec-sisa-${r.id}`}
                      label="Sisa Piutang (koreksi)"
                      value={editSisaSaldo}
                      onChange={setEditSisaSaldo}
                      hint="Mengubah total dipinjamkan dan sisa menjadi angka ini"
                      required
                    />
                  )}
                  <div className="flex gap-2 max-w-sm">
                    <Button type="button" variant="secondary" fullWidth onClick={() => setEditingId(null)}>Batal</Button>
                    <Button type="submit" fullWidth loading={editSaving}>{editSaving ? "Menyimpan..." : "Simpan"}</Button>
                  </div>
                </form>
              )}

              {receivingId === r.id && (() => {
                // Medium #11 (bug hunt): sama seperti DebtTab di atas.
                const recvNominalValue = parseRupiahInput(recvNominal);
                const recvExceedsLimit = recvNominalValue > r.sisaSaldo;
                return (
                  <form onSubmit={(e) => handleReceive(e, r.id)} className="mt-4 pt-4 border-t border-border space-y-3">
                    {recvError && <p className="text-sm text-danger-text">{recvError}</p>}
                    <InputRupiah
                      id={`recv-nominal-${r.id}`}
                      label="Nominal Diterima"
                      value={recvNominal}
                      onChange={setRecvNominal}
                      hint={recvExceedsLimit ? undefined : `Sisa piutang: ${formatCurrency(r.sisaSaldo)}`}
                      error={recvExceedsLimit ? `Nominal melebihi sisa piutang (${formatCurrency(r.sisaSaldo)})` : undefined}
                      required
                    />
                    <Select
                      id={`recv-account-${r.id}`}
                      label="Rekening Tujuan"
                      value={recvAccountId}
                      onChange={(e) => setRecvAccountId(e.target.value)}
                      required
                    >
                      <option value="">Pilih rekening</option>
                      {accounts.map((a) => <option key={a.id} value={a.id}>{a.nama}</option>)}
                    </Select>
                    <Input id={`recv-tanggal-${r.id}`} type="date" label="Tanggal" value={recvTanggal} onChange={(e) => setRecvTanggal(e.target.value)} required />
                    <div className="flex gap-2 max-w-sm">
                      <Button type="button" variant="secondary" fullWidth onClick={() => setReceivingId(null)}>Batal</Button>
                      <Button type="submit" fullWidth loading={recvSaving} disabled={recvExceedsLimit}>{recvSaving ? "Memproses..." : "Terima"}</Button>
                    </div>
                  </form>
                );
              })()}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function DebtsPage() {
  const [tab, setTab] = useState<"utang" | "piutang">("utang");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [debtSummary, setDebtSummary] = useState<DebtSummary | null>(null);
  const [receivableSummary, setReceivableSummary] = useState<ReceivableSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");

  const refetch = useCallback(async () => {
    setFetchError("");
    try {
      const [accData, debtData, recData] = await Promise.all([
        apiFetch("/api/accounts", "GET") as Promise<Account[]>,
        apiFetch("/api/debts/summary", "GET") as Promise<DebtSummary>,
        apiFetch("/api/debts/receivables/summary", "GET") as Promise<ReceivableSummary>,
      ]);
      setAccounts(accData.filter((a) => a.isActive));
      setAccountsLoaded(true);
      setDebtSummary(debtData);
      setReceivableSummary(recData);
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : "Gagal memuat data utang & piutang");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load: inline fetch to avoid calling setState via callback inside effect
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiFetch("/api/accounts", "GET") as Promise<Account[]>,
      apiFetch("/api/debts/summary", "GET") as Promise<DebtSummary>,
      apiFetch("/api/debts/receivables/summary", "GET") as Promise<ReceivableSummary>,
    ])
      .then(([accData, debtData, recData]) => {
        if (cancelled) return;
        setAccounts(accData.filter((a) => a.isActive));
        setAccountsLoaded(true);
        setDebtSummary(debtData);
        setReceivableSummary(recData);
      })
      .catch((err: unknown) => {
        if (!cancelled) setFetchError(err instanceof Error ? err.message : "Gagal memuat data utang & piutang");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <PageShell width="wide">
      <PageHeader title="Utang & Piutang" subtitle="Lacak pinjaman dan piutang Anda" />

      <Tabs
        items={DEBT_TABS}
        value={tab}
        onChange={setTab}
        idPrefix={DEBT_TABS_ID_PREFIX}
        aria-label="Utang atau Piutang"
        fitted
        className="mb-6 max-w-sm"
      />

      {fetchError && <ErrorBanner message={fetchError} onRetry={refetch} />}

      <div
        role="tabpanel"
        id={tabPanelId(DEBT_TABS_ID_PREFIX, tab)}
        aria-labelledby={tabButtonId(DEBT_TABS_ID_PREFIX, tab)}
        tabIndex={0}
      >
        {loading ? (
          <div className="space-y-4">
            <SkeletonHero className="h-28" />
            <div className="flex justify-end"><Skeleton className="h-9 w-32 rounded-xl" /></div>
            {[0, 1].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
          </div>
        ) : tab === "utang" ? (
          <DebtTab summary={debtSummary} accounts={accounts} accountsLoaded={accountsLoaded} onChanged={refetch} />
        ) : (
          <ReceivableTab summary={receivableSummary} accounts={accounts} accountsLoaded={accountsLoaded} onChanged={refetch} />
        )}
      </div>
    </PageShell>
  );
}
