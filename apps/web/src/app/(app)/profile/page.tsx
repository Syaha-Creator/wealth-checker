"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

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
  } | null;
};

async function apiFetch(path: string, method = "GET", body?: unknown) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error("Gagal");
  if (res.status === 204) return null;
  return res.json();
}

export default function ProfilePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [tanggalLahir, setTanggalLahir] = useState("");
  const [usiaPensiun, setUsiaPensiun] = useState("");
  const [usiaWarisan, setUsiaWarisan] = useState("");
  const [anggota, setAnggota] = useState("");

  useEffect(() => {
    apiFetch("/api/profile")
      .then((data: Profile) => {
        setProfile(data);
        if (data.profile) {
          setTanggalLahir(data.profile.tanggalLahir ?? "");
          setUsiaPensiun(String(data.profile.rencanaUsiaPensiun ?? "55"));
          setUsiaWarisan(String(data.profile.rencanaUsiaWarisan ?? "75"));
          setAnggota(String(data.profile.anggotaKeluargaDitanggung ?? "1"));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await apiFetch("/api/profile", "PUT", {
        tanggalLahir: tanggalLahir || null,
        rencanaUsiaPensiun: Number(usiaPensiun) || null,
        rencanaUsiaWarisan: Number(usiaWarisan) || null,
        anggotaKeluargaDitanggung: Number(anggota) || 1,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
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
        <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Profil</h1>

      {/* User info */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
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

      {/* Profile form */}
      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Data Keuangan</h2>
        {saved && (
          <div className="mb-4 p-3 bg-emerald-50 text-emerald-700 text-sm rounded-lg">
            Profil berhasil disimpan
          </div>
        )}
        <div className="space-y-4">
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
              value={anggota}
              onChange={(e) => setAnggota(e.target.value)}
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="mt-5 w-full py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-60 transition-colors"
        >
          {saving ? "Menyimpan..." : "Simpan Perubahan"}
        </button>
      </form>

      {/* Quick links */}
      <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50 mb-4">
        <a
          href="/onboarding"
          className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
        >
          <span className="text-sm font-medium text-gray-700">Setup ulang data keuangan</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-gray-400"><polyline points="9 18 15 12 9 6"/></svg>
        </a>
      </div>

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
