"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1 mb-8" role="progressbar" aria-valuenow={current} aria-valuemin={1} aria-valuemax={6} aria-label={`Langkah ${current} dari 6`}>
      {STEPS.map((s, i) => (
        <div key={s.num} className="flex items-center">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
            s.num < current ? "bg-emerald-600 text-white" :
            s.num === current ? "bg-emerald-600 text-white ring-2 ring-emerald-200" :
            "bg-gray-100 text-gray-400"
          }`} aria-hidden="true">
            {s.num < current ? (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth={1.8} strokeLinecap="round"/></svg>
            ) : s.num}
          </div>
          {i < STEPS.length - 1 && (
            <div className={`h-0.5 w-4 mx-0.5 transition-colors ${s.num < current ? "bg-emerald-600" : "bg-gray-100"}`} aria-hidden="true" />
          )}
        </div>
      ))}
    </div>
  );
}

function InputRupiah({
  label, value, onChange, placeholder, required, id,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; required?: boolean; id?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" aria-hidden="true">Rp</span>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          placeholder={placeholder ?? "0"}
          value={value}
          onChange={(e) => onChange(formatRupiah(e.target.value))}
          required={required}
        />
      </div>
    </div>
  );
}

function ListItem({ label, value, onRemove, removeLabel }: { label: string; value: string; onRemove: () => void; removeLabel: string }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
      <div>
        <span className="text-sm font-medium text-gray-800">{label}</span>
        <span className="text-sm text-gray-500 ml-2">{value}</span>
      </div>
      <button
        onClick={onRemove}
        aria-label={removeLabel}
        className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"/></svg>
      </button>
    </div>
  );
}

function SavedBadge({ count, label }: { count: number; label: string }) {
  if (count === 0) return null;
  return (
    <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"/></svg>
      {count} {label} sudah tersimpan
    </div>
  );
}

// ─── Success Screen ───────────────────────────────────────────────────────────

function SuccessScreen({ onGoToDashboard }: { onGoToDashboard: () => void }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-emerald-600" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Setup Selesai!</h1>
        <p className="text-gray-500 text-sm leading-relaxed mb-8">
          Data keuangan awal Anda berhasil disimpan. Sekarang Anda bisa melihat
          posisi kekayaan bersih dan level kebebasan finansial Anda.
        </p>
        <button
          onClick={onGoToDashboard}
          className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-2xl transition-colors"
        >
          Lihat Dashboard →
        </button>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

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

  // Save current step's data to DB, then advance to next step
  const handleNext = async (skip = false) => {
    setLoading(true);
    setError("");
    try {
      if (step === 1) {
        // Always save profile even on skip (harmless upsert)
        await apiFetch("/api/profile", "PUT", {
          tanggalLahir: tanggalLahir || null,
          rencanaUsiaPensiun: Number(usiaPensiun) || null,
          rencanaUsiaWarisan: Number(usiaWarisan) || null,
          anggotaKeluargaDitanggung: Number(anggotaKeluarga) || 1,
        });
      } else if (step === 2 && !skip) {
        for (const r of rekeningList) {
          await apiFetch("/api/accounts", "POST", { nama: r.nama, saldoAwal: parseRupiah(r.saldo) });
        }
        setSavedRekening((n) => n + rekeningList.length);
        setRekeningList([]);
      } else if (step === 3 && !skip) {
        for (const a of liquidList) {
          await apiFetch("/api/assets/liquid", "POST", {
            namaAset: a.nama,
            jumlah: Number(a.jumlah),
            hargaBeliRataRata: parseRupiah(a.harga),
          });
        }
        setSavedLiquid((n) => n + liquidList.length);
        setLiquidList([]);
      } else if (step === 4 && !skip) {
        for (const a of fixedList) {
          await apiFetch("/api/assets/fixed", "POST", {
            namaAset: a.nama,
            jumlah: Number(a.jumlah),
            hargaBeliRataRata: parseRupiah(a.harga),
          });
        }
        setSavedFixed((n) => n + fixedList.length);
        setFixedList([]);
      } else if (step === 5 && !skip) {
        for (const d of utangList) {
          await apiFetch("/api/debts", "POST", {
            pemberiUtang: d.pemberi,
            tipe: d.tipe,
            saldoAwal: parseRupiah(d.sisa),
          });
        }
        setSavedUtang((n) => n + utangList.length);
        setUtangList([]);
      } else if (step === 6) {
        // Final step: save piutang then complete
        if (!skip) {
          for (const p of piutangList) {
            await apiFetch("/api/debts/receivables", "POST", {
              peminjam: p.peminjam,
              saldoAwal: parseRupiah(p.sisa),
            });
          }
          setSavedPiutang((n) => n + piutangList.length);
          setPiutangList([]);
        }
        setCompleted(true);
        return;
      }

      setStep((s) => Math.min(6, s + 1) as Step);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  // Loading / unauthenticated
  if (isPending || !session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" aria-label="Memuat..." />
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
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-8 px-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Setup Keuangan Awal</h1>
            <p className="text-sm text-gray-500 mt-1">
              Langkah {step} dari {STEPS.length} — {stepTitle}
              {isOptional && <span className="ml-1.5 text-xs text-gray-400">(opsional)</span>}
            </p>
          </div>
          {/* "Ke Dashboard" saves current progress first */}
          <Link
            href="/dashboard"
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors mt-1 whitespace-nowrap"
          >
            Ke Dashboard →
          </Link>
        </div>

        <StepIndicator current={step} />

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl flex items-start gap-2" role="alert">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="shrink-0 mt-0.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </div>
          )}

          {/* Step 1: Profil */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900 mb-1">Data Diri</h2>
                <p className="text-sm text-gray-500 mb-4">Digunakan untuk menghitung target kebebasan finansial Anda.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama</label>
                <input
                  type="text"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
                  value={session?.user?.name ?? ""}
                  disabled
                  aria-disabled="true"
                />
              </div>
              <div>
                <label htmlFor="tanggal-lahir" className="block text-sm font-medium text-gray-700 mb-1">Tanggal Lahir</label>
                <input
                  id="tanggal-lahir"
                  type="date"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  value={tanggalLahir}
                  onChange={(e) => setTanggalLahir(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="usia-pensiun" className="block text-sm font-medium text-gray-700 mb-1">Rencana Pensiun (usia)</label>
                  <input
                    id="usia-pensiun"
                    type="number"
                    min={30} max={99}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    value={usiaPensiun}
                    onChange={(e) => setUsiaPensiun(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="usia-warisan" className="block text-sm font-medium text-gray-700 mb-1">Rencana Warisan (usia)</label>
                  <input
                    id="usia-warisan"
                    type="number"
                    min={30} max={120}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    value={usiaWarisan}
                    onChange={(e) => setUsiaWarisan(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="anggota-keluarga" className="block text-sm font-medium text-gray-700 mb-1">Anggota keluarga ditanggung</label>
                <input
                  id="anggota-keluarga"
                  type="number"
                  min={1} max={20}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  value={anggotaKeluarga}
                  onChange={(e) => setAnggotaKeluarga(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Step 2: Rekening */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Rekening & Tabungan</h2>
                <p className="text-sm text-gray-500 mt-1">Tambahkan semua rekening kas dan tabungan beserta saldo saat ini.</p>
              </div>
              <SavedBadge count={savedRekening} label="rekening" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="nama-rekening" className="block text-sm font-medium text-gray-700 mb-1">Nama Rekening</label>
                  <input
                    id="nama-rekening"
                    type="text"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    placeholder="Cth: BCA, Tunai"
                    value={namaRekening}
                    onChange={(e) => setNamaRekening(e.target.value)}
                  />
                </div>
                <InputRupiah id="saldo-rekening" label="Saldo Saat Ini" value={saldoRekening} onChange={setSaldoRekening} />
              </div>
              <button
                type="button"
                className="w-full py-2 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors disabled:opacity-50"
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
                  <p className="text-xs text-gray-400 text-center py-3">Belum ada rekening ditambahkan</p>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Aset Setara Kas */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Aset Setara Kas</h2>
                <p className="text-sm text-gray-500 mt-1">Emas, saham, reksa dana, obligasi — aset yang bisa dicairkan.</p>
              </div>
              <SavedBadge count={savedLiquid} label="aset" />
              <div>
                <label htmlFor="nama-liquid" className="block text-sm font-medium text-gray-700 mb-1">Nama Aset</label>
                <input
                  id="nama-liquid"
                  type="text"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  placeholder="Cth: Emas Antam, Saham BBCA"
                  value={namaLiquid}
                  onChange={(e) => setNamaLiquid(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="jumlah-liquid" className="block text-sm font-medium text-gray-700 mb-1">Jumlah / Lot</label>
                  <input
                    id="jumlah-liquid"
                    type="number"
                    min={0} step="any"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    placeholder="0"
                    value={jumlahLiquid}
                    onChange={(e) => setJumlahLiquid(e.target.value)}
                  />
                </div>
                <InputRupiah id="harga-liquid" label="Harga Beli / Satuan" value={hargaLiquid} onChange={setHargaLiquid} />
              </div>
              <button
                type="button"
                className="w-full py-2 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors disabled:opacity-50"
                disabled={!namaLiquid || !jumlahLiquid}
                onClick={() => {
                  if (!namaLiquid || !jumlahLiquid) return;
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
                  <p className="text-xs text-gray-400 text-center py-3">Kosongkan jika tidak ada</p>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Aset Tidak Lancar */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Aset Tidak Lancar</h2>
                <p className="text-sm text-gray-500 mt-1">Rumah, kendaraan, elektronik — aset yang tidak mudah dicairkan.</p>
              </div>
              <SavedBadge count={savedFixed} label="aset" />
              <div>
                <label htmlFor="nama-fixed" className="block text-sm font-medium text-gray-700 mb-1">Nama Aset</label>
                <input
                  id="nama-fixed"
                  type="text"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  placeholder="Cth: Rumah, Motor Honda"
                  value={namaFixed}
                  onChange={(e) => setNamaFixed(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="jumlah-fixed" className="block text-sm font-medium text-gray-700 mb-1">Jumlah</label>
                  <input
                    id="jumlah-fixed"
                    type="number"
                    min={0} step="any"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    placeholder="0"
                    value={jumlahFixed}
                    onChange={(e) => setJumlahFixed(e.target.value)}
                  />
                </div>
                <InputRupiah id="harga-fixed" label="Harga Beli / Satuan" value={hargaFixed} onChange={setHargaFixed} />
              </div>
              <button
                type="button"
                className="w-full py-2 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors disabled:opacity-50"
                disabled={!namaFixed || !jumlahFixed}
                onClick={() => {
                  if (!namaFixed || !jumlahFixed) return;
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
                  <p className="text-xs text-gray-400 text-center py-3">Kosongkan jika tidak ada</p>
                )}
              </div>
            </div>
          )}

          {/* Step 5: Utang */}
          {step === 5 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Utang & Kartu Kredit</h2>
                <p className="text-sm text-gray-500 mt-1">Semua kewajiban finansial yang belum lunas.</p>
              </div>
              <SavedBadge count={savedUtang} label="utang" />
              <div>
                <label htmlFor="tipe-utang" className="block text-sm font-medium text-gray-700 mb-1">Tipe</label>
                <select
                  id="tipe-utang"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  value={tipeUtang}
                  onChange={(e) => setTipeUtang(e.target.value as "utang_biasa" | "kartu_kredit")}
                >
                  <option value="utang_biasa">Utang Biasa</option>
                  <option value="kartu_kredit">Kartu Kredit / Paylater</option>
                </select>
              </div>
              <div>
                <label htmlFor="pemberi-utang" className="block text-sm font-medium text-gray-700 mb-1">
                  {tipeUtang === "kartu_kredit" ? "Nama Kartu / Penyedia" : "Nama Pemberi Pinjaman"}
                </label>
                <input
                  id="pemberi-utang"
                  type="text"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  placeholder={tipeUtang === "kartu_kredit" ? "Cth: BCA Platinum" : "Cth: Bank BRI, Pak Budi"}
                  value={pemberiUtang}
                  onChange={(e) => setPemberiUtang(e.target.value)}
                />
              </div>
              <InputRupiah id="sisa-utang" label="Sisa Tagihan / Utang" value={sisaUtang} onChange={setSisaUtang} />
              <button
                type="button"
                className="w-full py-2 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors disabled:opacity-50"
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
                  <p className="text-xs text-gray-400 text-center py-3">Kosongkan jika tidak ada utang</p>
                )}
              </div>
            </div>
          )}

          {/* Step 6: Piutang */}
          {step === 6 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Piutang</h2>
                <p className="text-sm text-gray-500 mt-1">Uang yang dipinjamkan ke orang lain dan belum kembali.</p>
              </div>
              <SavedBadge count={savedPiutang} label="piutang" />
              <div>
                <label htmlFor="peminjam" className="block text-sm font-medium text-gray-700 mb-1">Nama Peminjam</label>
                <input
                  id="peminjam"
                  type="text"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  placeholder="Cth: Bu Sari, Teman"
                  value={peminjam}
                  onChange={(e) => setPeminjam(e.target.value)}
                />
              </div>
              <InputRupiah id="sisa-piutang" label="Sisa Piutang" value={sisaPiutang} onChange={setSisaPiutang} />
              <button
                type="button"
                className="w-full py-2 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors disabled:opacity-50"
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
                  <p className="text-xs text-gray-400 text-center py-3">Kosongkan jika tidak ada piutang</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="mt-6 space-y-3">
          <div className="flex gap-3">
            {step > 1 && (
              <button
                onClick={goBack}
                disabled={loading}
                className="flex-1 py-3 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors text-sm disabled:opacity-50"
              >
                Kembali
              </button>
            )}
            {step < 6 ? (
              <button
                onClick={() => handleNext(false)}
                disabled={loading}
                className="flex-1 py-3 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-colors text-sm disabled:opacity-60"
              >
                {loading ? "Menyimpan..." : "Lanjut"}
              </button>
            ) : (
              <button
                onClick={() => handleNext(false)}
                disabled={loading}
                className="flex-1 py-3 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-colors text-sm disabled:opacity-60"
              >
                {loading ? "Menyimpan..." : "Selesai & Simpan"}
              </button>
            )}
          </div>

          {/* Skip button for optional steps */}
          {isOptional && (
            <button
              onClick={() => handleNext(true)}
              disabled={loading}
              className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            >
              {step < 6 ? "Lewati langkah ini →" : "Lewati & Selesai →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
