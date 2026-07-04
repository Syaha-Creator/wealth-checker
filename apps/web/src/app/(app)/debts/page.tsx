"use client";

import { useEffect, useState, useCallback } from "react";
import type { FormEvent } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, InputRupiah, RequiredMark, Select } from "@/components/ui/Input";
import { SkeletonHero, Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency, parseRupiahInput } from "@/lib/format";
import { SEMUA_KARTU_KREDIT_PAYLATER } from "@/lib/institutions";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

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
  const [showAddForm, setShowAddForm] = useState(false);
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

  const resetAddForm = () => {
    setPemberiUtang(""); setTipe("utang_biasa"); setNominal(""); setAccountId(""); setTanggal(todayStr()); setFormError("");
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true); setFormError("");
    try {
      await apiFetch("/api/transactions", "POST", {
        tanggal, type: "pinjaman_utang", pemberiUtang, debtTipe: tipe,
        accountId, nominal: parseRupiahInput(nominal),
      });
      resetAddForm();
      setShowAddForm(false);
      await onChanged();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const openPayForm = (id: string) => {
    setPayingId(id); setPayNominal(""); setPayAccountId(""); setPayTanggal(todayStr()); setPayError("");
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
      await onChanged();
    } catch (err: unknown) {
      setPayError(err instanceof Error ? err.message : "Gagal mencatat pembayaran");
    } finally {
      setPaySaving(false);
    }
  };

  if (accountsLoaded && accounts.length === 0) {
    return (
      <EmptyState
        icon={<DebtIcon />}
        title="Belum ada rekening aktif"
        description="Tambahkan rekening dulu untuk mencatat utang & pembayaran cicilan"
        action={<Button href="/accounts" size="sm">Tambah Rekening</Button>}
      />
    );
  }

  const items = summary?.perPemberi ?? [];

  return (
    <div>
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
          <h3 className="font-semibold text-text-primary mb-4">Utang Baru</h3>
          {formError && <p role="alert" className="text-sm text-danger-text mb-3">{formError}</p>}
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
            <InputRupiah id="debt-nominal" label="Nominal Pinjaman" value={nominal} onChange={setNominal} required />
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
          </div>
          <div className="flex gap-2 mt-4 max-w-xs">
            <Button type="button" variant="secondary" fullWidth onClick={() => { setShowAddForm(false); resetAddForm(); }}>Batal</Button>
            <Button type="submit" fullWidth loading={saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
          </div>
        </Card>
      )}

      {items.length === 0 ? (
        <EmptyState icon={<DebtIcon />} title="Belum ada utang tercatat" description="Catat pinjaman baru untuk mulai melacak cicilan Anda" />
      ) : (
        <div className="space-y-3">
          {items.map((d) => (
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
                {!d.lunas && (
                  <Button size="sm" variant="outline" onClick={() => (payingId === d.id ? setPayingId(null) : openPayForm(d.id))}>
                    Bayar Cicilan
                  </Button>
                )}
              </div>
              <p className={`text-lg font-bold ${d.lunas ? "text-brand" : "text-danger-text"}`}>{formatCurrency(d.sisaSaldo)}</p>
              <div className="mt-2"><ProgressBar percent={d.progressPercent} /></div>

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
                    <div className="flex gap-2 max-w-xs">
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
  const [showAddForm, setShowAddForm] = useState(false);
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

  const resetAddForm = () => {
    setPeminjam(""); setNominal(""); setAccountId(""); setTanggal(todayStr()); setFormError("");
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true); setFormError("");
    try {
      await apiFetch("/api/transactions", "POST", {
        tanggal, type: "pemberian_piutang", peminjam,
        accountId, nominal: parseRupiahInput(nominal),
      });
      resetAddForm();
      setShowAddForm(false);
      await onChanged();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const openReceiveForm = (id: string) => {
    setReceivingId(id); setRecvNominal(""); setRecvAccountId(""); setRecvTanggal(todayStr()); setRecvError("");
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
      await onChanged();
    } catch (err: unknown) {
      setRecvError(err instanceof Error ? err.message : "Gagal mencatat penerimaan");
    } finally {
      setRecvSaving(false);
    }
  };

  if (accountsLoaded && accounts.length === 0) {
    return (
      <EmptyState
        icon={<ReceivableIcon />}
        title="Belum ada rekening aktif"
        description="Tambahkan rekening dulu untuk mencatat piutang & penerimaan pembayaran"
        action={<Button href="/accounts" size="sm">Tambah Rekening</Button>}
      />
    );
  }

  const items = summary?.perPeminjam ?? [];

  return (
    <div>
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
          <h3 className="font-semibold text-text-primary mb-4">Piutang Baru</h3>
          {formError && <p role="alert" className="text-sm text-danger-text mb-3">{formError}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              id="rec-peminjam"
              label="Nama Peminjam"
              placeholder="Cth: Bu Sari, Teman"
              value={peminjam}
              onChange={(e) => setPeminjam(e.target.value)}
              required
            />
            <InputRupiah id="rec-nominal" label="Nominal Dipinjamkan" value={nominal} onChange={setNominal} required />
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
          </div>
          <div className="flex gap-2 mt-4 max-w-xs">
            <Button type="button" variant="secondary" fullWidth onClick={() => { setShowAddForm(false); resetAddForm(); }}>Batal</Button>
            <Button type="submit" fullWidth loading={saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
          </div>
        </Card>
      )}

      {items.length === 0 ? (
        <EmptyState icon={<ReceivableIcon />} title="Belum ada piutang tercatat" description="Catat pemberian pinjaman baru untuk mulai melacak pembayarannya" />
      ) : (
        <div className="space-y-3">
          {items.map((r) => (
            <Card key={r.id}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-text-primary truncate">{r.peminjam}</p>
                    {r.lunas && <Badge variant="success">Lunas</Badge>}
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">Total dipinjamkan: {formatCurrency(r.totalDipinjamkan)}</p>
                </div>
                {!r.lunas && (
                  <Button size="sm" variant="outline" onClick={() => (receivingId === r.id ? setReceivingId(null) : openReceiveForm(r.id))}>
                    Terima Pembayaran
                  </Button>
                )}
              </div>
              <p className={`text-lg font-bold ${r.lunas ? "text-brand" : "text-warning-text"}`}>{formatCurrency(r.sisaSaldo)}</p>
              <div className="mt-2"><ProgressBar percent={r.progressPercent} /></div>

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
                    <div className="flex gap-2 max-w-xs">
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
    <div className="max-w-3xl">
      <PageHeader title="Utang & Piutang" subtitle="Lacak pinjaman dan piutang Anda" />

      <div className="flex gap-1 p-1 bg-surface-hover rounded-xl mb-6 max-w-xs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === "utang"}
          onClick={() => setTab("utang")}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${tab === "utang" ? "bg-surface text-text-primary shadow-sm" : "text-text-muted hover:text-text-secondary"}`}
        >
          Utang
        </button>
        <button
          role="tab"
          aria-selected={tab === "piutang"}
          onClick={() => setTab("piutang")}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${tab === "piutang" ? "bg-surface text-text-primary shadow-sm" : "text-text-muted hover:text-text-secondary"}`}
        >
          Piutang
        </button>
      </div>

      {fetchError && <ErrorBanner message={fetchError} onRetry={refetch} />}

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
  );
}
