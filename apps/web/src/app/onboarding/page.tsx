"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const STEPS = [
  { num: 1, label: "Profil" },
  { num: 2, label: "Rekening" },
  { num: 3, label: "Aset Likuid" },
  { num: 4, label: "Aset Fisik" },
  { num: 5, label: "Utang" },
  { num: 6, label: "Piutang" },
  { num: 7, label: "Bulanan" },
];

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

// ─── Sub-forms ────────────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1 mb-8">
      {STEPS.map((s, i) => (
        <div key={s.num} className="flex items-center">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
            s.num < current ? "bg-emerald-600 text-white" :
            s.num === current ? "bg-emerald-600 text-white ring-2 ring-emerald-200" :
            "bg-gray-100 text-gray-400"
          }`}>
            {s.num < current ? (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth={1.8} strokeLinecap="round"/></svg>
            ) : s.num}
          </div>
          {i < STEPS.length - 1 && (
            <div className={`h-0.5 w-4 mx-0.5 ${s.num < current ? "bg-emerald-600" : "bg-gray-100"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function InputRupiah({
  label, value, onChange, placeholder, required,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">Rp</span>
        <input
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

function ListItem({ label, value, onRemove }: { label: string; value: string; onRemove: () => void }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
      <div>
        <span className="text-sm font-medium text-gray-800">{label}</span>
        <span className="text-sm text-gray-500 ml-2">{value}</span>
      </div>
      <button onClick={onRemove} className="text-gray-400 hover:text-red-500 transition-colors p-1">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"/></svg>
      </button>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

  // Step 7: Rencana bulanan
  const [pemasukan, setPemasukan] = useState("");
  const [pengeluaran, setPengeluaran] = useState("");

  const goNext = () => setStep((s) => Math.min(7, s + 1) as Step);
  const goBack = () => setStep((s) => Math.max(1, s - 1) as Step);

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      // 1. Save profile
      await apiFetch("/api/profile", "PUT", {
        tanggalLahir: tanggalLahir || null,
        rencanaUsiaPensiun: Number(usiaPensiun) || null,
        rencanaUsiaWarisan: Number(usiaWarisan) || null,
        anggotaKeluargaDitanggung: Number(anggotaKeluarga) || 1,
      });

      // 2. Save rekening
      for (const r of rekeningList) {
        await apiFetch("/api/accounts", "POST", { nama: r.nama, saldoAwal: parseRupiah(r.saldo) });
      }

      // 3. Liquid assets
      for (const a of liquidList) {
        await apiFetch("/api/assets/liquid", "POST", {
          namaAset: a.nama,
          jumlah: Number(a.jumlah),
          hargaBeliRataRata: parseRupiah(a.harga),
        });
      }

      // 4. Fixed assets
      for (const a of fixedList) {
        await apiFetch("/api/assets/fixed", "POST", {
          namaAset: a.nama,
          jumlah: Number(a.jumlah),
          hargaBeliRataRata: parseRupiah(a.harga),
        });
      }

      // 5. Debts
      for (const d of utangList) {
        await apiFetch("/api/debts", "POST", {
          pemberiUtang: d.pemberi,
          tipe: d.tipe,
          saldoAwal: parseRupiah(d.sisa),
        });
      }

      // 6. Receivables
      for (const p of piutangList) {
        await apiFetch("/api/debts/receivables", "POST", {
          peminjam: p.peminjam,
          saldoAwal: parseRupiah(p.sisa),
        });
      }

      router.push("/dashboard");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const stepTitle = STEPS[step - 1].label;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-8 px-4">
      <div className="w-full max-w-lg">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Setup Keuangan Awal</h1>
          <p className="text-sm text-gray-500 mt-1">
            Langkah {step} dari 7 — {stepTitle}
          </p>
        </div>

        <StepIndicator current={step} />

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>
          )}

          {/* Step 1: Profil */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Data Diri</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama</label>
                <input
                  type="text"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-gray-50 text-gray-500"
                  value={session?.user?.name ?? ""}
                  disabled
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Lahir</label>
                <input
                  type="date"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  value={tanggalLahir}
                  onChange={(e) => setTanggalLahir(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rencana Pensiun (usia)</label>
                  <input
                    type="number"
                    min={30} max={99}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    value={usiaPensiun}
                    onChange={(e) => setUsiaPensiun(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rencana Warisan (usia)</label>
                  <input
                    type="number"
                    min={30} max={120}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    value={usiaWarisan}
                    onChange={(e) => setUsiaWarisan(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Anggota keluarga ditanggung</label>
                <input
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
              <h2 className="text-base font-semibold text-gray-900">Rekening & Tabungan</h2>
              <p className="text-sm text-gray-500">Tambahkan semua rekening kas dan tabungan beserta saldo saat ini.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nama Rekening</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    placeholder="Cth: BCA, Tunai"
                    value={namaRekening}
                    onChange={(e) => setNamaRekening(e.target.value)}
                  />
                </div>
                <InputRupiah label="Saldo Saat Ini" value={saldoRekening} onChange={setSaldoRekening} />
              </div>
              <button
                type="button"
                className="w-full py-2 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
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
                    onRemove={() => setRekeningList((p) => p.filter((_, j) => j !== i))}
                  />
                ))}
                {rekeningList.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-3">Belum ada rekening ditambahkan</p>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Aset Setara Kas */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-gray-900">Aset Setara Kas</h2>
              <p className="text-sm text-gray-500">Emas, saham, reksa dana, obligasi — aset yang bisa dicairkan.</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Aset</label>
                <input
                  type="text"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  placeholder="Cth: Emas Antam, Saham BBCA"
                  value={namaLiquid}
                  onChange={(e) => setNamaLiquid(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah / Lot</label>
                  <input
                    type="number"
                    min={0} step="any"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    placeholder="0"
                    value={jumlahLiquid}
                    onChange={(e) => setJumlahLiquid(e.target.value)}
                  />
                </div>
                <InputRupiah label="Harga Beli / Satuan" value={hargaLiquid} onChange={setHargaLiquid} />
              </div>
              <button
                type="button"
                className="w-full py-2 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
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
                    onRemove={() => setLiquidList((p) => p.filter((_, j) => j !== i))}
                  />
                ))}
                {liquidList.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-3">Kosongkan jika tidak ada</p>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Aset Tidak Lancar */}
          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-gray-900">Aset Tidak Lancar</h2>
              <p className="text-sm text-gray-500">Rumah, kendaraan, elektronik — aset yang tidak mudah dicairkan.</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Aset</label>
                <input
                  type="text"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  placeholder="Cth: Rumah, Motor Honda"
                  value={namaFixed}
                  onChange={(e) => setNamaFixed(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah</label>
                  <input
                    type="number"
                    min={0} step="any"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    placeholder="0"
                    value={jumlahFixed}
                    onChange={(e) => setJumlahFixed(e.target.value)}
                  />
                </div>
                <InputRupiah label="Harga Beli / Satuan" value={hargaFixed} onChange={setHargaFixed} />
              </div>
              <button
                type="button"
                className="w-full py-2 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
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
                    onRemove={() => setFixedList((p) => p.filter((_, j) => j !== i))}
                  />
                ))}
                {fixedList.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-3">Kosongkan jika tidak ada</p>
                )}
              </div>
            </div>
          )}

          {/* Step 5: Utang */}
          {step === 5 && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-gray-900">Utang & Kartu Kredit</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipe</label>
                <select
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  value={tipeUtang}
                  onChange={(e) => setTipeUtang(e.target.value as "utang_biasa" | "kartu_kredit")}
                >
                  <option value="utang_biasa">Utang Biasa</option>
                  <option value="kartu_kredit">Kartu Kredit / Paylater</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {tipeUtang === "kartu_kredit" ? "Nama Kartu / Penyedia" : "Nama Pemberi Pinjaman"}
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  placeholder={tipeUtang === "kartu_kredit" ? "Cth: BCA Platinum" : "Cth: Bank BRI, Pak Budi"}
                  value={pemberiUtang}
                  onChange={(e) => setPemberiUtang(e.target.value)}
                />
              </div>
              <InputRupiah label="Sisa Tagihan / Utang" value={sisaUtang} onChange={setSisaUtang} />
              <button
                type="button"
                className="w-full py-2 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
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
                    onRemove={() => setUtangList((p) => p.filter((_, j) => j !== i))}
                  />
                ))}
                {utangList.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-3">Kosongkan jika tidak ada utang</p>
                )}
              </div>
            </div>
          )}

          {/* Step 6: Piutang */}
          {step === 6 && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-gray-900">Piutang</h2>
              <p className="text-sm text-gray-500">Uang yang dipinjamkan ke orang lain dan belum kembali.</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Peminjam</label>
                <input
                  type="text"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  placeholder="Cth: Bu Sari, Teman"
                  value={peminjam}
                  onChange={(e) => setPeminjam(e.target.value)}
                />
              </div>
              <InputRupiah label="Sisa Piutang" value={sisaPiutang} onChange={setSisaPiutang} />
              <button
                type="button"
                className="w-full py-2 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
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
                    onRemove={() => setPiutangList((prev) => prev.filter((_, j) => j !== i))}
                  />
                ))}
                {piutangList.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-3">Kosongkan jika tidak ada piutang</p>
                )}
              </div>
            </div>
          )}

          {/* Step 7: Rencana bulanan */}
          {step === 7 && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-gray-900">Rencana Bulanan</h2>
              <p className="text-sm text-gray-500">
                Rata-rata pemasukan dan pengeluaran 12 bulan terakhir. Digunakan untuk menghitung
                sisa uang bulanan dan level kebebasan finansial.
              </p>
              <InputRupiah label="Pemasukan Bulanan Rata-rata" value={pemasukan} onChange={setPemasukan} required />
              <InputRupiah label="Pengeluaran Bulanan Rata-rata" value={pengeluaran} onChange={setPengeluaran} required />
              {pemasukan && pengeluaran && (
                <div className="p-3 bg-emerald-50 rounded-lg">
                  <p className="text-sm text-emerald-700 font-medium">
                    Sisa Uang Bulanan: Rp {formatRupiah(String(parseRupiah(pemasukan) - parseRupiah(pengeluaran)))}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex gap-3 mt-6">
          {step > 1 && (
            <button
              onClick={goBack}
              className="flex-1 py-3 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors text-sm"
            >
              Kembali
            </button>
          )}
          {step < 7 ? (
            <button
              onClick={goNext}
              className="flex-1 py-3 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-colors text-sm"
            >
              Lanjut
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 py-3 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-colors text-sm disabled:opacity-60"
            >
              {loading ? "Menyimpan..." : "Selesai & Lihat Dashboard"}
            </button>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Bisa dilewati dan diisi nanti dari halaman profil
        </p>
      </div>
    </div>
  );
}
