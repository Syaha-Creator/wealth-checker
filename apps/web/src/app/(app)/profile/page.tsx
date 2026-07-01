"use client";

import { useEffect, useState } from "react";
import { signOut } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { ConfirmModal } from "@/components/ConfirmModal";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

type Profile = {
  id: string;
  name: string;
  email: string;
  profile: {
    tanggalLahir: string | null;
    rencanaUsiaPensiun: number | null;
    rencanaUsiaWarisan: number | null;
    anggotaKeluargaDitanggung: number | null;
    pemasukanBulananRataRata: string | null;
    pengeluaranBulananRataRata: string | null;
  } | null;
};

function formatRupiah(val: string) {
  const num = val.replace(/\D/g, "");
  return num ? Number(num).toLocaleString("id-ID") : "";
}

function parseRupiah(val: string) {
  return Number(val.replace(/\D/g, "")) || null;
}

function formatRp(val: number) {
  return val.toLocaleString("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
}

async function apiFetch(path: string, method = "GET", body?: unknown) {
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

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [fetchError, setFetchError] = useState("");
  const [showResetWarning, setShowResetWarning] = useState(false);

  const [tanggalLahir, setTanggalLahir] = useState("");
  const [usiaPensiun, setUsiaPensiun] = useState("");
  const [usiaWarisan, setUsiaWarisan] = useState("");
  const [anggota, setAnggota] = useState("");
  const [pemasukanRencana, setPemasukanRencana] = useState("");
  const [pengeluaranRencana, setPengeluaranRencana] = useState("");

  useEffect(() => {
    apiFetch("/api/profile")
      .then((data: Profile) => {
        setProfile(data);
        if (data.profile) {
          setTanggalLahir(data.profile.tanggalLahir ?? "");
          setUsiaPensiun(String(data.profile.rencanaUsiaPensiun ?? "55"));
          setUsiaWarisan(String(data.profile.rencanaUsiaWarisan ?? "75"));
          setAnggota(String(data.profile.anggotaKeluargaDitanggung ?? "1"));
          const p = Number(data.profile.pemasukanBulananRataRata ?? 0);
          const k = Number(data.profile.pengeluaranBulananRataRata ?? 0);
          if (p > 0) setPemasukanRencana(p.toLocaleString("id-ID"));
          if (k > 0) setPengeluaranRencana(k.toLocaleString("id-ID"));
        }
      })
      .catch((err: unknown) => {
        setFetchError(err instanceof Error ? err.message : "Gagal memuat profil");
      })
      .finally(() => setLoading(false));
  }, []);

  const sisaRencana = (parseRupiah(pemasukanRencana) ?? 0) - (parseRupiah(pengeluaranRencana) ?? 0);
  const anggotaNum = Number(anggota) || 1;
  const pengeluaranPerAnggota = anggotaNum > 0 ? Math.round((parseRupiah(pengeluaranRencana) ?? 0) / anggotaNum) : 0;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setSaveError("");
    try {
      await apiFetch("/api/profile", "PUT", {
        tanggalLahir: tanggalLahir || null,
        rencanaUsiaPensiun: Number(usiaPensiun) || null,
        rencanaUsiaWarisan: Number(usiaWarisan) || null,
        anggotaKeluargaDitanggung: Number(anggota) || 1,
        pemasukanBulananRataRata: parseRupiah(pemasukanRencana),
        pengeluaranBulananRataRata: parseRupiah(pengeluaranRencana),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Gagal menyimpan perubahan");
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/auth/login");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" aria-label="Memuat..." />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="rounded-2xl bg-red-50 border border-red-100 p-6 text-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="mx-auto mb-3 text-red-400" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-sm font-medium text-red-700 mb-1">Gagal memuat profil</p>
          <p className="text-xs text-red-500 mb-4">{fetchError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Profil</h1>

      {/* User info */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center" aria-hidden="true">
            <span className="text-emerald-700 font-bold text-lg">
              {(profile?.name ?? "U")[0].toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-semibold text-gray-900">{profile?.name}</p>
            <p className="text-sm text-gray-500">{profile?.email}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4 mb-4">
        {/* Data Pribadi */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Data Pribadi</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="tanggal-lahir" className="block text-sm font-medium text-gray-700 mb-1">Tanggal Lahir</label>
              <input
                id="tanggal-lahir"
                type="date"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-shadow"
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
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-shadow"
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
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-shadow"
                  value={usiaWarisan}
                  onChange={(e) => setUsiaWarisan(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Rencana Keuangan */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Rencana Keuangan</h2>
          <p className="text-xs text-gray-400 mb-4">
            Digunakan sebagai estimasi saat belum ada data transaksi. Akan otomatis digantikan data aktual seiring waktu.
          </p>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="anggota-keluarga" className="block text-sm font-medium text-gray-700 mb-1">Anggota ditanggung</label>
                <input
                  id="anggota-keluarga"
                  type="number"
                  min={1} max={20}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-shadow"
                  value={anggota}
                  onChange={(e) => setAnggota(e.target.value)}
                />
              </div>
              <div className="flex flex-col justify-end">
                {pengeluaranPerAnggota > 0 && (
                  <div className="px-3 py-2.5 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-400">Per anggota</p>
                    <p className="text-sm font-semibold text-gray-700">{formatRp(pengeluaranPerAnggota)}</p>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="pemasukan-rencana" className="block text-sm font-medium text-gray-700 mb-1">Pemasukan bulanan rata-rata</label>
              <div className="flex items-center border border-gray-200 rounded-lg focus-within:ring-2 focus-within:ring-emerald-400 transition-shadow">
                <span className="pl-3 text-sm text-gray-400 shrink-0">Rp</span>
                <input
                  id="pemasukan-rencana"
                  type="text"
                  inputMode="numeric"
                  className="flex-1 px-2 py-2.5 text-sm bg-transparent focus:outline-none"
                  placeholder="0"
                  value={pemasukanRencana}
                  onChange={(e) => setPemasukanRencana(formatRupiah(e.target.value))}
                />
              </div>
            </div>

            <div>
              <label htmlFor="pengeluaran-rencana" className="block text-sm font-medium text-gray-700 mb-1">Pengeluaran bulanan rata-rata</label>
              <div className="flex items-center border border-gray-200 rounded-lg focus-within:ring-2 focus-within:ring-emerald-400 transition-shadow">
                <span className="pl-3 text-sm text-gray-400 shrink-0">Rp</span>
                <input
                  id="pengeluaran-rencana"
                  type="text"
                  inputMode="numeric"
                  className="flex-1 px-2 py-2.5 text-sm bg-transparent focus:outline-none"
                  placeholder="0"
                  value={pengeluaranRencana}
                  onChange={(e) => setPengeluaranRencana(formatRupiah(e.target.value))}
                />
              </div>
            </div>

            {/* Sisa kalkulasi otomatis */}
            {(parseRupiah(pemasukanRencana) || parseRupiah(pengeluaranRencana)) ? (
              <div className={`flex items-center justify-between px-4 py-3 rounded-xl ${
                sisaRencana >= 0 ? "bg-emerald-50 border border-emerald-100" : "bg-red-50 border border-red-100"
              }`}>
                <span className="text-sm font-medium text-gray-600">Rencana Sisa Uang Bulanan</span>
                <span className={`text-sm font-bold ${sisaRencana >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                  {sisaRencana >= 0 ? "+" : ""}{formatRp(sisaRencana)}
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Save button + feedback */}
        {saved && (
          <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm rounded-xl flex items-center gap-2" role="status">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
            Profil berhasil disimpan
          </div>
        )}
        {saveError && (
          <div className="p-3 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl flex items-start gap-2" role="alert">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="shrink-0 mt-0.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {saveError}
          </div>
        )}
        <button
          type="submit"
          disabled={saving}
          className="w-full py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 disabled:opacity-60 transition-colors"
        >
          {saving ? "Menyimpan..." : "Simpan Perubahan"}
        </button>
      </form>

      {/* Quick links */}
      <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50 mb-4">
        <button
          onClick={() => setShowResetWarning(true)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors text-left"
        >
          <span className="text-sm font-medium text-gray-700">Setup ulang data keuangan</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-gray-400 shrink-0" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      <ConfirmModal
        open={showResetWarning}
        title="Perhatian: Data Tidak Dihapus"
        message="Setup ulang akan MENAMBAHKAN data baru di atas data yang sudah ada, bukan menggantikannya. Hapus rekening, aset, dan utang lama terlebih dahulu sebelum melakukan setup ulang."
        confirmLabel="Lanjutkan Setup"
        confirmVariant="warning"
        onConfirm={() => { setShowResetWarning(false); router.push("/onboarding"); }}
        onCancel={() => setShowResetWarning(false)}
      />

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        className="w-full py-3 border border-red-200 text-red-600 text-sm font-medium rounded-xl hover:bg-red-50 transition-colors"
      >
        Keluar dari Akun
      </button>
    </div>
  );
}
