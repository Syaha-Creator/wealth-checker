"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageShell } from "@/components/ui/PageShell";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { RequiredMark } from "@/components/ui/Input";
import { formatRupiahInput, parseRupiahInput, formatCurrency } from "@/lib/format";
import { apiFetch as apiFetchRaw } from "@/lib/apiFetch";

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
  return res.json();
}

const ChevronDown = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-text-muted pointer-events-none shrink-0" aria-hidden="true">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const AccountIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <line x1="2" y1="10" x2="22" y2="10" />
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
  const [fieldErrors, setFieldErrors] = useState<{ nominal?: string; accountId?: string; toAccountId?: string }>({});
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  // Bug hunt / audit temuan 2: hanya 3 dari 11 tipe transaksi bisa dicatat di
  // sini — 8 tipe lain (utang/piutang/aset) punya form domain-spesifik sendiri
  // (rata-rata harga berjalan, penautan cicilan, dst) di halaman Utang/Aset.
  // "Lainnya" adalah tab ke-4 yang murni UI (tidak mengubah `type`) yang
  // mengarahkan pengguna ke halaman yang benar alih-alih jalan buntu.
  const [showOther, setShowOther] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetchRaw(`/api/accounts`, { credentials: "include" })
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
      .catch(() => {})
      .finally(() => { if (!cancelled) setAccountsLoaded(true); });
    // Categories endpoint includes user history, not just the defaults
    apiFetchRaw(`/api/transactions/categories`, { credentials: "include" })
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

  const validate = () => {
    const errs: { nominal?: string; accountId?: string; toAccountId?: string } = {};
    if (!nominal || nominalParsed === 0) {
      errs.nominal = "Masukkan nominal transaksi";
    } else if (isOverBalance) {
      errs.nominal = `Saldo tidak mencukupi. Saldo tersedia ${formatCurrency(saldoTersedia)}`;
    }
    if (!accountId) {
      errs.accountId = "Pilih rekening";
    }
    if (type === "transfer") {
      if (!canTransfer) {
        errs.toAccountId = "Butuh minimal 2 rekening untuk transfer";
      } else if (!toAccountId) {
        errs.toAccountId = "Pilih rekening tujuan";
      } else if (accountId === toAccountId) {
        errs.toAccountId = "Rekening asal dan tujuan tidak boleh sama";
      }
    }
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) {
      setError("Periksa kembali isian yang ditandai merah di bawah.");
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

  // Blocked before the user can even try: without a rekening there is nowhere
  // to record the transaction against, so show a clear way out instead of a
  // silently-disabled submit button.
  if (accountsLoaded && accounts.length === 0) {
    return (
      <PageShell width="narrow">
        <PageHeader title="Catat Transaksi" onBack={() => router.back()} />
        <EmptyState
          icon={<AccountIcon />}
          title="Belum ada rekening"
          description="Anda perlu membuat rekening terlebih dahulu sebelum bisa mencatat transaksi apa pun."
          action={<Button href="/accounts">Tambah Rekening Pertama</Button>}
          className="bg-surface rounded-2xl border border-border"
        />
      </PageShell>
    );
  }

  return (
    <PageShell width="narrow">
      <PageHeader title="Catat Transaksi" onBack={() => router.back()} />

      <div className="max-w-xl mx-auto min-w-0">

      {/* Type selector */}
      <div className="flex gap-2 mb-6 bg-surface-hover p-1 rounded-xl" role="group" aria-label="Tipe transaksi">
        {TX_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => { setType(t.value); setKategori(""); setError(""); setFieldErrors({}); setShowOther(false); }}
            aria-pressed={!showOther && type === t.value}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              !showOther && type === t.value ? t.activeClass : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {t.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowOther(true)}
          aria-pressed={showOther}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
            showOther ? "bg-surface text-text-primary shadow-sm" : "text-text-muted hover:text-text-secondary"
          }`}
        >
          Lainnya
        </button>
      </div>

      {showOther ? (
        <div className="space-y-3">
          <p className="text-sm text-text-muted mb-1">
            Tipe transaksi ini punya form khusus di halamannya sendiri (mis. menghitung harga rata-rata aset atau menautkan cicilan), jadi dicatat langsung dari sana:
          </p>
          <Link
            href="/debts"
            className="flex items-center justify-between gap-3 p-4 bg-surface rounded-2xl border border-border hover:border-border-strong hover:bg-surface-hover transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-10 h-10 rounded-full bg-warning-soft text-warning-text flex items-center justify-center shrink-0" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-primary">Utang & Piutang</p>
                <p className="text-xs text-text-muted">Pinjam/bayar utang, atau beri/terima piutang</p>
              </div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-text-muted shrink-0" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
          </Link>
          <Link
            href="/assets"
            className="flex items-center justify-between gap-3 p-4 bg-surface rounded-2xl border border-border hover:border-border-strong hover:bg-surface-hover transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-10 h-10 rounded-full bg-info-soft text-info-text flex items-center justify-center shrink-0" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" /><path d="M3 8l9 5 9-5M12 13v8" /></svg>
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-primary">Aset & Investasi</p>
                <p className="text-xs text-text-muted">Beli/jual barang, atau beli/cairkan investasi</p>
              </div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-text-muted shrink-0" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
          </Link>
        </div>
      ) : (
      <>
      {/* Transfer warning — not enough accounts */}
      {type === "transfer" && !canTransfer && (
        <div className="mb-4 p-3 bg-warning-soft border border-warning-soft-border rounded-xl flex items-start gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-warning shrink-0 mt-0.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <p className="text-sm text-warning-text">
            Transfer membutuhkan minimal 2 rekening. <Link href="/accounts" className="font-medium underline">Tambah rekening</Link> terlebih dahulu.
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
          isOverBalance || fieldErrors.nominal ? "border-danger bg-danger-soft/40" : "border-border"
        }`}>
          <label htmlFor="nominal" className="block text-xs font-medium text-text-muted mb-2 uppercase tracking-wide">Nominal<RequiredMark /></label>
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
              aria-invalid={fieldErrors.nominal ? true : undefined}
              aria-describedby={fieldErrors.nominal ? "nominal-error" : undefined}
              className={`flex-1 min-w-0 text-3xl font-bold bg-transparent focus:outline-none text-text-primary ${
                isOverBalance ? "text-danger-text" :
                type === "pendapatan" ? "text-brand" :
                type === "pengeluaran" ? "text-danger-text" : "text-info-text"
              }`}
              placeholder="0"
              value={nominal}
              onChange={(e) => { setNominal(formatRupiahInput(e.target.value)); setFieldErrors((f) => ({ ...f, nominal: undefined })); }}
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
          {fieldErrors.nominal && (
            <p id="nominal-error" role="alert" className="text-xs text-danger-text mt-2">{fieldErrors.nominal}</p>
          )}
        </div>

        <div className="bg-surface rounded-2xl border border-border divide-y divide-border">
          {/* Tanggal */}
          <div className="flex items-center px-5 py-3">
            <label htmlFor="tanggal" className="text-sm text-text-muted w-28">Tanggal<RequiredMark /></label>
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
          <div className={`px-5 py-3 ${fieldErrors.accountId ? "bg-danger-soft/40" : ""}`}>
            <div className="flex items-center">
              <label htmlFor="account" className="text-sm text-text-muted w-28">
                {type === "transfer" ? "Dari Rekening" : "Rekening"}<RequiredMark />
              </label>
              <div className="flex-1 flex items-center gap-1 justify-end">
                <select
                  id="account"
                  aria-invalid={fieldErrors.accountId ? true : undefined}
                  aria-describedby={fieldErrors.accountId ? "account-error" : undefined}
                  className="text-sm text-text-primary bg-transparent focus:outline-none text-right appearance-none"
                  value={accountId}
                  onChange={(e) => { setAccountId(e.target.value); setError(""); setFieldErrors((f) => ({ ...f, accountId: undefined })); }}
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.nama}</option>
                  ))}
                  {accounts.length === 0 && <option value="">Tidak ada rekening</option>}
                </select>
                <ChevronDown />
              </div>
            </div>
            {fieldErrors.accountId && (
              <p id="account-error" role="alert" className="text-xs text-danger-text mt-1 text-right">{fieldErrors.accountId}</p>
            )}
          </div>

          {/* Rekening tujuan (transfer) */}
          {type === "transfer" && (
            <div className={`px-5 py-3 ${fieldErrors.toAccountId ? "bg-danger-soft/40" : ""}`}>
              <div className="flex items-center">
                <label htmlFor="to-account" className="text-sm text-text-muted w-28">Ke Rekening<RequiredMark /></label>
                <div className="flex-1 flex items-center gap-1 justify-end">
                  <select
                    id="to-account"
                    aria-invalid={fieldErrors.toAccountId ? true : undefined}
                    aria-describedby={fieldErrors.toAccountId ? "to-account-error" : undefined}
                    className="text-sm text-text-primary bg-transparent focus:outline-none text-right appearance-none"
                    value={toAccountId}
                    onChange={(e) => { setToAccountId(e.target.value); setFieldErrors((f) => ({ ...f, toAccountId: undefined })); }}
                  >
                    {transferAccounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.nama}</option>
                    ))}
                    {transferAccounts.length === 0 && <option value="">—</option>}
                  </select>
                  <ChevronDown />
                </div>
              </div>
              {fieldErrors.toAccountId && (
                <p id="to-account-error" role="alert" className="text-xs text-danger-text mt-1 text-right">{fieldErrors.toAccountId}</p>
              )}
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
      </>
      )}

      {/* Ringkasan rekening — di desktop tampil di bawah form (kolom sempit ter-center) */}
      {!showOther && (
      <div className="hidden md:block mt-6">
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
      )}
      </div>
    </PageShell>
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
