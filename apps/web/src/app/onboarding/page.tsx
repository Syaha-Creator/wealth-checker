"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { InputRupiah, RequiredMark } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { parseRupiahInput } from "@/lib/format";
import { SEMUA_REKENING, SEMUA_KARTU_KREDIT_PAYLATER } from "@/lib/institutions";
import { apiFetch as apiFetchRaw } from "@/lib/apiFetch";
import { useToast } from "@/components/ui/Toast";

type Step = 1 | 2 | 3 | 4 | 5 | 6;

const STEPS = [
  { num: 1, label: "Profil" },
  { num: 2, label: "Rekening" },
  { num: 3, label: "Aset Likuid" },
  { num: 4, label: "Aset Fisik" },
  { num: 5, label: "Utang" },
  { num: 6, label: "Piutang" },
];

const OPTIONAL_STEPS = [3, 4, 5, 6];

// Bug hunt (Issue 3): step 2 (Rekening) sengaja TIDAK dipaksa harus diisi —
// dulu ini membuat user yang skip step ini (0 rekening) terjebak: login akan
// selalu melempar mereka balik ke /onboarding karena "sudah onboarding" hanya
// dicek dari jumlah rekening. Sekarang "sudah onboarding" ditentukan dari
// wealthLevel (lihat /auth/login), yang juga menghitung aset likuid/tidak
// lancar/utang — jadi user yang hanya mengisi aset/utang tanpa rekening bank
// tetap dianggap sudah onboarding dan tidak diminta ulang.

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function apiFetch(path: string, method: string, body?: unknown) {
  const res = await apiFetchRaw(`${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    // Bug hunt (Issue 6): dulu melempar raw response text (bisa berupa JSON
    // error Zod yang teknis) langsung sebagai error message — samakan dengan
    // pola apiFetch di halaman profil (parse JSON, ambil field `error`).
    const errBody = await res.json().catch(() => null);
    throw new Error(errBody?.error ?? "Terjadi kesalahan. Coba lagi.");
  }
  return res.json();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1 mb-8" role="progressbar" aria-valuenow={current} aria-valuemin={1} aria-valuemax={6} aria-label={`Langkah ${current} dari 6`}>
      {STEPS.map((s, i) => (
        <div key={s.num} className="flex items-center flex-1 last:flex-none">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors shrink-0 ${
            s.num < current ? "bg-brand text-brand-text-on" :
            s.num === current ? "bg-brand text-brand-text-on ring-2 ring-brand-soft-border" :
            "bg-surface-hover text-text-muted"
          }`} aria-hidden="true">
            {s.num < current ? (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"/></svg>
            ) : s.num}
          </div>
          {i < STEPS.length - 1 && (
            <div className={`h-0.5 flex-1 mx-1 transition-colors ${s.num < current ? "bg-brand" : "bg-border"}`} aria-hidden="true" />
          )}
        </div>
      ))}
    </div>
  );
}

function ListItem({ label, value, onRemove, removeLabel }: { label: string; value: string; onRemove: () => void; removeLabel: string }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 bg-surface-hover rounded-lg">
      <div>
        <span className="text-sm font-medium text-text-primary">{label}</span>
        <span className="text-sm text-text-muted ml-2">{value}</span>
      </div>
      <button
        onClick={onRemove}
        aria-label={removeLabel}
        className="text-text-muted hover:text-danger transition-colors p-1 rounded"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"/></svg>
      </button>
    </div>
  );
}

function SavedBadge({ count, label }: { count: number; label: string }) {
  if (count === 0) return null;
  return (
    <div className="flex items-center gap-1.5 text-xs text-brand bg-brand-soft px-3 py-1.5 rounded-lg">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"/></svg>
      {count} {label} sudah tersimpan
    </div>
  );
}

// ─── Success Screen ───────────────────────────────────────────────────────────

function SuccessScreen({ onGoToDashboard }: { onGoToDashboard: () => void }) {
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="w-20 h-20 rounded-full bg-brand-soft flex items-center justify-center mx-auto mb-6">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-brand" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-text-primary mb-2">Setup Selesai!</h1>
        <p className="text-text-secondary text-sm leading-relaxed mb-8">
          Data keuangan awal Anda berhasil disimpan. Sekarang Anda bisa melihat
          posisi kekayaan bersih dan level kebebasan finansial Anda.
        </p>
        <Button onClick={onGoToDashboard} fullWidth size="lg">
          Lihat Dashboard →
        </Button>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const STEP_SUCCESS_MESSAGES: Record<Step, string> = {
  1: "Profil berhasil disimpan",
  2: "Rekening berhasil ditambahkan",
  3: "Aset likuid berhasil ditambahkan",
  4: "Aset fisik berhasil ditambahkan",
  5: "Utang berhasil ditambahkan",
  6: "Piutang berhasil ditambahkan",
};

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const { showToast } = useToast();

  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState(false);

  // Track saved counts per step (for display after saving)
  const [savedRekening, setSavedRekening] = useState(0);
  const [savedLiquid, setSavedLiquid] = useState(0);
  const [savedFixed, setSavedFixed] = useState(0);
  const [savedUtang, setSavedUtang] = useState(0);
  const [savedPiutang, setSavedPiutang] = useState(0);

  // Session guard
  useEffect(() => {
    if (!isPending && !session) {
      router.replace("/auth/login");
    }
  }, [session, isPending, router]);

  // Step 1: Profil
  const [tanggalLahir, setTanggalLahir] = useState("");
  const [usiaPensiun, setUsiaPensiun] = useState("55");
  const [usiaWarisan, setUsiaWarisan] = useState("75");
  const [anggotaKeluarga, setAnggotaKeluarga] = useState("1");
  // Rencana pemasukan/pengeluaran bulanan — dipakai dashboard
  // sebagai fallback arus kas sebelum ada data transaksi
  const [pemasukanBulanan, setPemasukanBulanan] = useState("");
  const [pengeluaranBulanan, setPengeluaranBulanan] = useState("");

  // Step 2: Rekening
  const [namaRekening, setNamaRekening] = useState("");
  const [saldoRekening, setSaldoRekening] = useState("");
  const [rekeningList, setRekeningList] = useState<{ nama: string; saldo: string }[]>([]);

  // Step 3: Aset Setara Kas
  const [namaLiquid, setNamaLiquid] = useState("");
  const [jumlahLiquid, setJumlahLiquid] = useState("");
  const [hargaLiquid, setHargaLiquid] = useState("");
  const [liquidList, setLiquidList] = useState<{ nama: string; jumlah: string; harga: string }[]>([]);

  // Step 4: Aset Tidak Lancar
  const [namaFixed, setNamaFixed] = useState("");
  const [jumlahFixed, setJumlahFixed] = useState("");
  const [hargaFixed, setHargaFixed] = useState("");
  const [fixedList, setFixedList] = useState<{ nama: string; jumlah: string; harga: string }[]>([]);

  // Step 5: Utang
  const [pemberiUtang, setPemberiUtang] = useState("");
  const [sisaUtang, setSisaUtang] = useState("");
  const [tipeUtang, setTipeUtang] = useState<"utang_biasa" | "kartu_kredit">("utang_biasa");
  const [utangList, setUtangList] = useState<{ pemberi: string; sisa: string; tipe: string }[]>([]);

  // Step 6: Piutang
  const [peminjam, setPeminjam] = useState("");
  const [sisaPiutang, setSisaPiutang] = useState("");
  const [piutangList, setPiutangList] = useState<{ peminjam: string; sisa: string }[]>([]);

  const goBack = () => { setError(""); setStep((s) => Math.max(1, s - 1) as Step); };

  // Persist whatever the user has entered for a given step. Shared by
  // handleNext (advance to next step) and handleGoToDashboard (leave early
  // without losing in-progress data for the current step).
  const savePendingForStep = async (targetStep: Step, skip: boolean) => {
    if (targetStep === 1) {
      // Always save profile even on skip (harmless upsert)
      await apiFetch("/api/profile", "PUT", {
        tanggalLahir: tanggalLahir || null,
        rencanaUsiaPensiun: Number(usiaPensiun) || null,
        rencanaUsiaWarisan: Number(usiaWarisan) || null,
        anggotaKeluargaDitanggung: Number(anggotaKeluarga) || 1,
        // Kirim rencana pemasukan/pengeluaran bulanan
        pemasukanBulananRataRata: pemasukanBulanan ? parseRupiahInput(pemasukanBulanan) : null,
        pengeluaranBulananRataRata: pengeluaranBulanan ? parseRupiahInput(pengeluaranBulanan) : null,
      });
      return;
    }
    if (skip) return;
    if (targetStep === 2) {
      // Remove each item from the list right after it saves
      // so a partial failure only retries the un-saved items
      const pending = [...rekeningList];
      for (const r of pending) {
        await apiFetch("/api/accounts", "POST", { nama: r.nama, saldoAwal: parseRupiahInput(r.saldo) });
        setSavedRekening((n) => n + 1);
        setRekeningList((prev) => prev.slice(1));
      }
    } else if (targetStep === 3) {
      const pending = [...liquidList];
      for (const a of pending) {
        await apiFetch("/api/assets/liquid", "POST", {
          namaAset: a.nama,
          jumlah: Number(a.jumlah),
          hargaBeliRataRata: parseRupiahInput(a.harga),
        });
        setSavedLiquid((n) => n + 1);
        setLiquidList((prev) => prev.slice(1));
      }
    } else if (targetStep === 4) {
      const pending = [...fixedList];
      for (const a of pending) {
        await apiFetch("/api/assets/fixed", "POST", {
          namaAset: a.nama,
          jumlah: Number(a.jumlah),
          hargaBeliRataRata: parseRupiahInput(a.harga),
        });
        setSavedFixed((n) => n + 1);
        setFixedList((prev) => prev.slice(1));
      }
    } else if (targetStep === 5) {
      const pending = [...utangList];
      for (const d of pending) {
        await apiFetch("/api/debts", "POST", {
          pemberiUtang: d.pemberi,
          tipe: d.tipe,
          saldoAwal: parseRupiahInput(d.sisa),
        });
        setSavedUtang((n) => n + 1);
        setUtangList((prev) => prev.slice(1));
      }
    } else if (targetStep === 6) {
      const pending = [...piutangList];
      for (const p of pending) {
        await apiFetch("/api/debts/receivables", "POST", {
          peminjam: p.peminjam,
          saldoAwal: parseRupiahInput(p.sisa),
        });
        setSavedPiutang((n) => n + 1);
        setPiutangList((prev) => prev.slice(1));
      }
    }
  };

  // Save current step's data to DB, then advance to next step
  const handleNext = async (skip = false) => {
    setLoading(true);
    setError("");
    try {
      await savePendingForStep(step, skip);
      if (step === 6) {
        if (!skip) showToast({ type: "success", message: STEP_SUCCESS_MESSAGES[6] });
        setCompleted(true);
        return;
      }
      if (!skip) showToast({ type: "success", message: STEP_SUCCESS_MESSAGES[step] });
      setStep((s) => Math.min(6, s + 1) as Step);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Terjadi kesalahan. Coba lagi.";
      setError(msg);
      showToast({ type: "error", message: msg });
    } finally {
      setLoading(false);
    }
  };

  // "Ke Dashboard" must save the current step's in-progress data first —
  // previously this was a plain link that discarded it.
  const handleGoToDashboard = async () => {
    setLoading(true);
    setError("");
    try {
      await savePendingForStep(step, false);
      showToast({ type: "success", message: "Data onboarding berhasil disimpan" });
      router.push("/dashboard");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Gagal menyimpan. Coba lagi.";
      setError(msg);
      showToast({ type: "error", message: msg });
    } finally {
      setLoading(false);
    }
  };

  // Loading / unauthenticated
  if (isPending || !session) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" aria-label="Memuat..." />
      </div>
    );
  }

  // Success screen
  if (completed) {
    return <SuccessScreen onGoToDashboard={() => router.push("/dashboard")} />;
  }

  const stepTitle = STEPS[step - 1].label;
  const isOptional = OPTIONAL_STEPS.includes(step);

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center py-8 px-4">
      <div className="w-full max-w-lg md:max-w-2xl">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 gap-3">
          <div>
            <h1 className="text-xl font-bold text-text-primary">Setup Keuangan Awal</h1>
            <p className="text-sm text-text-muted mt-1">
              Langkah {step} dari {STEPS.length} — {stepTitle}
              {isOptional && <span className="ml-1.5 text-xs text-text-muted">(opsional)</span>}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <ThemeToggle />
            {/* Saves current step's progress before leaving */}
            <button
              type="button"
              onClick={handleGoToDashboard}
              disabled={loading}
              className="text-xs text-text-muted hover:text-text-primary transition-colors px-2 py-2 whitespace-nowrap disabled:opacity-50"
            >
              Ke Dashboard →
            </button>
          </div>
        </div>

        <StepIndicator current={step} />

        <div key={step} className="bg-surface rounded-2xl p-6 shadow-sm border border-border animate-step-in md:p-8">
          {error && (
            <div className="mb-4 p-3 bg-danger-soft border border-danger-soft-border text-danger-text text-sm rounded-xl flex items-start gap-2" role="alert">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="shrink-0 mt-0.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </div>
          )}

          {/* Step 1: Profil */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-text-primary mb-1">Data Diri</h2>
                <p className="text-sm text-text-muted mb-4">Digunakan untuk menghitung target kebebasan finansial Anda.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Nama</label>
                <input
                  type="text"
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-surface-hover text-text-muted cursor-not-allowed"
                  value={session?.user?.name ?? ""}
                  disabled
                  aria-disabled="true"
                />
              </div>
              <div>
                <label htmlFor="tanggal-lahir" className="block text-sm font-medium text-text-secondary mb-1">Tanggal Lahir</label>
                <input
                  id="tanggal-lahir"
                  type="date"
                  className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/30"
                  value={tanggalLahir}
                  onChange={(e) => setTanggalLahir(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="usia-pensiun" className="block text-sm font-medium text-text-secondary mb-1">Rencana Pensiun (usia)</label>
                  <input
                    id="usia-pensiun"
                    type="number"
                    min={30} max={99}
                    className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/30"
                    value={usiaPensiun}
                    onChange={(e) => setUsiaPensiun(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="usia-warisan" className="block text-sm font-medium text-text-secondary mb-1">Rencana Warisan (usia)</label>
                  <input
                    id="usia-warisan"
                    type="number"
                    min={30} max={120}
                    className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/30"
                    value={usiaWarisan}
                    onChange={(e) => setUsiaWarisan(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="anggota-keluarga" className="block text-sm font-medium text-text-secondary mb-1">Anggota keluarga ditanggung</label>
                <input
                  id="anggota-keluarga"
                  type="number"
                  min={1} max={20}
                  className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/30"
                  value={anggotaKeluarga}
                  onChange={(e) => setAnggotaKeluarga(e.target.value)}
                />
              </div>
              {/* Rencana pemasukan/pengeluaran bulanan — dipakai
                  dashboard sebagai fallback arus kas sebelum ada transaksi */}
              <div className="grid grid-cols-2 gap-3">
                <InputRupiah
                  id="pemasukan-bulanan"
                  label="Rata-rata Pemasukan/Bulan"
                  value={pemasukanBulanan}
                  onChange={setPemasukanBulanan}
                />
                <InputRupiah
                  id="pengeluaran-bulanan"
                  label="Rata-rata Pengeluaran/Bulan"
                  value={pengeluaranBulanan}
                  onChange={setPengeluaranBulanan}
                />
              </div>
            </div>
          )}

          {/* Step 2: Rekening */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-text-primary">Rekening & Tabungan</h2>
                <p className="text-sm text-text-muted mt-1">Tambahkan semua rekening kas dan tabungan beserta saldo saat ini.</p>
              </div>
              <SavedBadge count={savedRekening} label="rekening" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="nama-rekening" className="block text-sm font-medium text-text-secondary mb-1">Nama Rekening<RequiredMark /></label>
                  <input
                    id="nama-rekening"
                    type="text"
                    list="rekening-options"
                    className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/30"
                    placeholder="Cth: BCA, GoPay, atau ketik nama lain"
                    value={namaRekening}
                    onChange={(e) => setNamaRekening(e.target.value)}
                    autoComplete="off"
                  />
                  <datalist id="rekening-options">
                    {SEMUA_REKENING.map((r) => (
                      <option key={r} value={r} />
                    ))}
                  </datalist>
                </div>
                <InputRupiah id="saldo-rekening" label="Saldo Saat Ini" value={saldoRekening} onChange={setSaldoRekening} />
              </div>
              <button
                type="button"
                className="w-full py-2 text-sm font-medium text-brand bg-brand-soft hover:bg-brand-soft-border/60 rounded-lg transition-colors disabled:opacity-50"
                disabled={!namaRekening}
                onClick={() => {
                  if (!namaRekening) return;
                  setRekeningList((p) => [...p, { nama: namaRekening, saldo: saldoRekening }]);
                  setNamaRekening("");
                  setSaldoRekening("");
                }}
              >
                + Tambah Rekening
              </button>
              <div className="space-y-2">
                {rekeningList.map((r, i) => (
                  <ListItem
                    key={i}
                    label={r.nama}
                    value={`Rp ${r.saldo || "0"}`}
                    removeLabel={`Hapus rekening ${r.nama}`}
                    onRemove={() => setRekeningList((p) => p.filter((_, j) => j !== i))}
                  />
                ))}
                {rekeningList.length === 0 && savedRekening === 0 && (
                  <p className="text-xs text-text-muted text-center py-3">Belum ada rekening ditambahkan</p>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Aset Setara Kas */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-text-primary">Aset Setara Kas</h2>
                <p className="text-sm text-text-muted mt-1">Emas, saham, reksa dana, obligasi — aset yang bisa dicairkan.</p>
              </div>
              <SavedBadge count={savedLiquid} label="aset" />
              <div>
                <label htmlFor="nama-liquid" className="block text-sm font-medium text-text-secondary mb-1">Nama Aset<RequiredMark /></label>
                <input
                  id="nama-liquid"
                  type="text"
                  className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/30"
                  placeholder="Cth: Emas Antam, Saham BBCA"
                  value={namaLiquid}
                  onChange={(e) => setNamaLiquid(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="jumlah-liquid" className="block text-sm font-medium text-text-secondary mb-1">Jumlah / Lot<RequiredMark /></label>
                  <input
                    id="jumlah-liquid"
                    type="number"
                    min={0} step="any"
                    className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/30"
                    placeholder="0"
                    value={jumlahLiquid}
                    onChange={(e) => setJumlahLiquid(e.target.value)}
                  />
                </div>
                <InputRupiah id="harga-liquid" label="Harga Beli / Satuan" value={hargaLiquid} onChange={setHargaLiquid} />
              </div>
              <button
                type="button"
                className="w-full py-2 text-sm font-medium text-brand bg-brand-soft hover:bg-brand-soft-border/60 rounded-lg transition-colors disabled:opacity-50"
                // Bug hunt (Issue 5): API mewajibkan jumlah > 0 (positive()) — kalau
                // cuma dicek truthy, "0"/"-5" lolos ke daftar lalu gagal saat disimpan
                // dan macet permanen (item gagal tidak pernah ke-remove dari list).
                disabled={!namaLiquid || !(Number(jumlahLiquid) > 0)}
                onClick={() => {
                  if (!namaLiquid || !(Number(jumlahLiquid) > 0)) return;
                  setLiquidList((p) => [...p, { nama: namaLiquid, jumlah: jumlahLiquid, harga: hargaLiquid }]);
                  setNamaLiquid(""); setJumlahLiquid(""); setHargaLiquid("");
                }}
              >
                + Tambah Aset
              </button>
              <div className="space-y-2">
                {liquidList.map((a, i) => (
                  <ListItem
                    key={i}
                    label={`${a.nama} (×${a.jumlah})`}
                    value={`Rp ${a.harga || "0"}/satuan`}
                    removeLabel={`Hapus aset ${a.nama}`}
                    onRemove={() => setLiquidList((p) => p.filter((_, j) => j !== i))}
                  />
                ))}
                {liquidList.length === 0 && savedLiquid === 0 && (
                  <p className="text-xs text-text-muted text-center py-3">Kosongkan jika tidak ada</p>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Aset Tidak Lancar */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-text-primary">Aset Tidak Lancar</h2>
                <p className="text-sm text-text-muted mt-1">Rumah, kendaraan, elektronik — aset yang tidak mudah dicairkan.</p>
              </div>
              <SavedBadge count={savedFixed} label="aset" />
              <div>
                <label htmlFor="nama-fixed" className="block text-sm font-medium text-text-secondary mb-1">Nama Aset<RequiredMark /></label>
                <input
                  id="nama-fixed"
                  type="text"
                  className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/30"
                  placeholder="Cth: Rumah, Motor Honda"
                  value={namaFixed}
                  onChange={(e) => setNamaFixed(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="jumlah-fixed" className="block text-sm font-medium text-text-secondary mb-1">Jumlah<RequiredMark /></label>
                  <input
                    id="jumlah-fixed"
                    type="number"
                    min={0} step="any"
                    className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/30"
                    placeholder="0"
                    value={jumlahFixed}
                    onChange={(e) => setJumlahFixed(e.target.value)}
                  />
                </div>
                <InputRupiah id="harga-fixed" label="Harga Beli / Satuan" value={hargaFixed} onChange={setHargaFixed} />
              </div>
              <button
                type="button"
                className="w-full py-2 text-sm font-medium text-brand bg-brand-soft hover:bg-brand-soft-border/60 rounded-lg transition-colors disabled:opacity-50"
                // Bug hunt (Issue 5): sama seperti aset likuid — jumlah harus > 0.
                disabled={!namaFixed || !(Number(jumlahFixed) > 0)}
                onClick={() => {
                  if (!namaFixed || !(Number(jumlahFixed) > 0)) return;
                  setFixedList((p) => [...p, { nama: namaFixed, jumlah: jumlahFixed, harga: hargaFixed }]);
                  setNamaFixed(""); setJumlahFixed(""); setHargaFixed("");
                }}
              >
                + Tambah Aset
              </button>
              <div className="space-y-2">
                {fixedList.map((a, i) => (
                  <ListItem
                    key={i}
                    label={`${a.nama} (×${a.jumlah})`}
                    value={`Rp ${a.harga || "0"}/satuan`}
                    removeLabel={`Hapus aset ${a.nama}`}
                    onRemove={() => setFixedList((p) => p.filter((_, j) => j !== i))}
                  />
                ))}
                {fixedList.length === 0 && savedFixed === 0 && (
                  <p className="text-xs text-text-muted text-center py-3">Kosongkan jika tidak ada</p>
                )}
              </div>
            </div>
          )}

          {/* Step 5: Utang */}
          {step === 5 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-text-primary">Utang & Kartu Kredit</h2>
                <p className="text-sm text-text-muted mt-1">Semua kewajiban finansial yang belum lunas.</p>
              </div>
              <SavedBadge count={savedUtang} label="utang" />
              <div>
                <label htmlFor="tipe-utang" className="block text-sm font-medium text-text-secondary mb-1">Tipe</label>
                <select
                  id="tipe-utang"
                  className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/30"
                  value={tipeUtang}
                  onChange={(e) => setTipeUtang(e.target.value as "utang_biasa" | "kartu_kredit")}
                >
                  <option value="utang_biasa">Utang Biasa</option>
                  <option value="kartu_kredit">Kartu Kredit / Paylater</option>
                </select>
              </div>
              <div>
                <label htmlFor="pemberi-utang" className="block text-sm font-medium text-text-secondary mb-1">
                  {tipeUtang === "kartu_kredit" ? "Nama Kartu / Penyedia" : "Nama Pemberi Pinjaman"}
                  <RequiredMark />
                </label>
                <input
                  id="pemberi-utang"
                  type="text"
                  list={tipeUtang === "kartu_kredit" ? "kartu-kredit-options" : undefined}
                  className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/30"
                  placeholder={tipeUtang === "kartu_kredit" ? "Cth: BCA, Kredivo, atau ketik nama lain" : "Cth: Bank BRI, Pak Budi"}
                  value={pemberiUtang}
                  onChange={(e) => setPemberiUtang(e.target.value)}
                  autoComplete="off"
                />
                {tipeUtang === "kartu_kredit" && (
                  <datalist id="kartu-kredit-options">
                    {SEMUA_KARTU_KREDIT_PAYLATER.map((k) => (
                      <option key={k} value={k} />
                    ))}
                  </datalist>
                )}
              </div>
              <InputRupiah id="sisa-utang" label="Sisa Tagihan / Utang" value={sisaUtang} onChange={setSisaUtang} />
              <button
                type="button"
                className="w-full py-2 text-sm font-medium text-brand bg-brand-soft hover:bg-brand-soft-border/60 rounded-lg transition-colors disabled:opacity-50"
                disabled={!pemberiUtang}
                onClick={() => {
                  if (!pemberiUtang) return;
                  setUtangList((p) => [...p, { pemberi: pemberiUtang, sisa: sisaUtang, tipe: tipeUtang }]);
                  setPemberiUtang(""); setSisaUtang("");
                }}
              >
                + Tambah Utang
              </button>
              <div className="space-y-2">
                {utangList.map((d, i) => (
                  <ListItem
                    key={i}
                    label={`${d.pemberi} (${d.tipe === "kartu_kredit" ? "Kartu Kredit" : "Utang"})`}
                    value={`Rp ${d.sisa || "0"}`}
                    removeLabel={`Hapus utang ${d.pemberi}`}
                    onRemove={() => setUtangList((p) => p.filter((_, j) => j !== i))}
                  />
                ))}
                {utangList.length === 0 && savedUtang === 0 && (
                  <p className="text-xs text-text-muted text-center py-3">Kosongkan jika tidak ada utang</p>
                )}
              </div>
            </div>
          )}

          {/* Step 6: Piutang */}
          {step === 6 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-text-primary">Piutang</h2>
                <p className="text-sm text-text-muted mt-1">Uang yang dipinjamkan ke orang lain dan belum kembali.</p>
              </div>
              <SavedBadge count={savedPiutang} label="piutang" />
              <div>
                <label htmlFor="peminjam" className="block text-sm font-medium text-text-secondary mb-1">Nama Peminjam<RequiredMark /></label>
                <input
                  id="peminjam"
                  type="text"
                  className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/30"
                  placeholder="Cth: Bu Sari, Teman"
                  value={peminjam}
                  onChange={(e) => setPeminjam(e.target.value)}
                />
              </div>
              <InputRupiah id="sisa-piutang" label="Sisa Piutang" value={sisaPiutang} onChange={setSisaPiutang} />
              <button
                type="button"
                className="w-full py-2 text-sm font-medium text-brand bg-brand-soft hover:bg-brand-soft-border/60 rounded-lg transition-colors disabled:opacity-50"
                disabled={!peminjam}
                onClick={() => {
                  if (!peminjam) return;
                  setPiutangList((p) => [...p, { peminjam, sisa: sisaPiutang }]);
                  setPeminjam(""); setSisaPiutang("");
                }}
              >
                + Tambah Piutang
              </button>
              <div className="space-y-2">
                {piutangList.map((p, i) => (
                  <ListItem
                    key={i}
                    label={p.peminjam}
                    value={`Rp ${p.sisa || "0"}`}
                    removeLabel={`Hapus piutang ${p.peminjam}`}
                    onRemove={() => setPiutangList((prev) => prev.filter((_, j) => j !== i))}
                  />
                ))}
                {piutangList.length === 0 && savedPiutang === 0 && (
                  <p className="text-xs text-text-muted text-center py-3">Kosongkan jika tidak ada piutang</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="mt-6 space-y-3">
          <div className="flex gap-3">
            {step > 1 && (
              <Button variant="secondary" onClick={goBack} disabled={loading} className="flex-1">
                Kembali
              </Button>
            )}
            <Button onClick={() => handleNext(false)} loading={loading} className="flex-1">
              {loading ? "Menyimpan..." : step < 6 ? "Lanjut" : "Selesai & Simpan"}
            </Button>
          </div>

          {/* Skip button for optional steps */}
          {isOptional && (
            <button
              onClick={() => handleNext(true)}
              disabled={loading}
              className="w-full py-2 text-sm text-text-muted hover:text-text-secondary transition-colors disabled:opacity-50"
            >
              {step < 6 ? "Lewati langkah ini →" : "Lewati & Selesai →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
