"use client";

import { useEffect, useState } from "react";
import { signOut } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { ConfirmModal } from "@/components/ConfirmModal";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { InputRupiah } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { PageShell } from "@/components/ui/PageShell";
import { ThemeToggle } from "@/components/ThemeToggle";
import { formatCurrency, parseRupiahInput } from "@/lib/format";
import { NotificationSettings } from "./_components/NotificationSettings";
import { apiFetch as apiFetchRaw } from "@/lib/apiFetch";
import { useToast } from "@/components/ui/Toast";
import { HouseholdSettings } from "./_components/HouseholdSettings";

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

function formatRupiahDisplay(val: string) {
  const num = val.replace(/\D/g, "");
  return num ? Number(num).toLocaleString("id-ID") : "";
}

async function apiFetch(path: string, method = "GET", body?: unknown) {
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

export default function ProfilePage() {
  const router = useRouter();
  const { showToast } = useToast();
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

  const sisaRencana = parseRupiahInput(pemasukanRencana) - parseRupiahInput(pengeluaranRencana);
  const anggotaNum = Number(anggota) || 1;
  const pengeluaranPerAnggota = anggotaNum > 0 ? Math.round(parseRupiahInput(pengeluaranRencana) / anggotaNum) : 0;

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
        pemasukanBulananRataRata: parseRupiahInput(pemasukanRencana) || null,
        pengeluaranBulananRataRata: parseRupiahInput(pengeluaranRencana) || null,
      });
      setSaved(true);
      showToast({ type: "success", message: "Profil berhasil diperbarui" });
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan perubahan";
      setSaveError(msg);
      showToast({ type: "error", message: msg });
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
      <PageShell width="wide">
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-9 w-20 rounded-lg" />
        </div>
        <Card className="mb-6">
          <div className="flex items-center gap-3">
            <Skeleton className="w-12 h-12 rounded-full shrink-0" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
        </Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="space-y-4">
            <Skeleton className="h-4 w-28 mb-2" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-10 rounded-lg" />
              <Skeleton className="h-10 rounded-lg" />
            </div>
          </Card>
          <Card className="space-y-4">
            <Skeleton className="h-4 w-32 mb-2" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </Card>
        </div>
      </PageShell>
    );
  }

  if (fetchError) {
    return (
      <PageShell width="wide">
        <Card className="max-w-lg mx-auto text-center">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="mx-auto mb-3 text-danger" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <p className="text-sm font-medium text-danger-text mb-1">Gagal memuat profil</p>
        <p className="text-xs text-text-muted mb-4">{fetchError}</p>
        <Button variant="danger" size="sm" onClick={() => window.location.reload()}>
          Coba Lagi
        </Button>
      </Card>
      </PageShell>
    );
  }

  return (
    <PageShell width="wide">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-text-primary">Profil</h1>
        <ThemeToggle variant="pill" />
      </div>

      {/* User info */}
      <Card className="mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-brand-soft flex items-center justify-center shrink-0" aria-hidden="true">
            <span className="text-brand font-bold text-lg">
              {(profile?.name ?? "U")[0].toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-text-primary truncate">{profile?.name}</p>
            <p className="text-sm text-text-muted truncate">{profile?.email}</p>
          </div>
        </div>
      </Card>

      <form onSubmit={handleSave}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 items-start">
          {/* Data Pribadi */}
          <Card>
            <h2 className="text-base font-semibold text-text-primary mb-4">Data Pribadi</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="tanggal-lahir" className="block text-sm font-medium text-text-secondary mb-1">Tanggal Lahir</label>
                <input
                  id="tanggal-lahir"
                  type="date"
                  className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/30 transition-shadow"
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
                    className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/30 transition-shadow"
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
                    className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/30 transition-shadow"
                    value={usiaWarisan}
                    onChange={(e) => setUsiaWarisan(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="anggota-keluarga" className="block text-sm font-medium text-text-secondary mb-1">Anggota ditanggung</label>
                <input
                  id="anggota-keluarga"
                  type="number"
                  min={1} max={20}
                  className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/30 transition-shadow"
                  value={anggota}
                  onChange={(e) => setAnggota(e.target.value)}
                />
              </div>
              {pengeluaranPerAnggota > 0 && (
                <div className="px-3 py-2.5 bg-surface-hover rounded-lg">
                  <p className="text-xs text-text-muted">Estimasi pengeluaran per anggota</p>
                  <p className="text-sm font-semibold text-text-secondary">{formatCurrency(pengeluaranPerAnggota)}</p>
                </div>
              )}
            </div>
          </Card>

          {/* Rencana Keuangan */}
          <Card>
            <h2 className="text-base font-semibold text-text-primary mb-1">Rencana Keuangan</h2>
            <p className="text-xs text-text-muted mb-4">
              Digunakan sebagai estimasi saat belum ada data transaksi. Akan otomatis digantikan data aktual seiring waktu.
            </p>
            <div className="space-y-4">
              <InputRupiah
                id="pemasukan-rencana"
                label="Pemasukan bulanan rata-rata"
                value={pemasukanRencana}
                onChange={(v) => setPemasukanRencana(formatRupiahDisplay(v))}
              />

              <InputRupiah
                id="pengeluaran-rencana"
                label="Pengeluaran bulanan rata-rata"
                value={pengeluaranRencana}
                onChange={(v) => setPengeluaranRencana(formatRupiahDisplay(v))}
              />

              {/* Sisa kalkulasi otomatis */}
              {(parseRupiahInput(pemasukanRencana) || parseRupiahInput(pengeluaranRencana)) ? (
                <div className={`flex items-center justify-between px-4 py-3 rounded-xl ${
                  sisaRencana >= 0 ? "bg-brand-soft border border-brand-soft-border" : "bg-danger-soft border border-danger-soft-border"
                }`}>
                  <span className="text-sm font-medium text-text-secondary">Rencana Sisa Uang Bulanan</span>
                  <span className={`text-sm font-bold ${sisaRencana >= 0 ? "text-brand" : "text-danger-text"}`}>
                    {sisaRencana >= 0 ? "+" : ""}{formatCurrency(sisaRencana)}
                  </span>
                </div>
              ) : null}
            </div>
          </Card>
        </div>

        {/* Save button + feedback */}
        <div className="space-y-3 mb-6">
          {saved && (
            <div className="p-3 bg-brand-soft border border-brand-soft-border text-brand text-sm rounded-xl flex items-center gap-2" role="status">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
              Profil berhasil disimpan
            </div>
          )}
          {saveError && (
            <div className="p-3 bg-danger-soft border border-danger-soft-border text-danger-text text-sm rounded-xl flex items-start gap-2" role="alert">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="shrink-0 mt-0.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {saveError}
            </div>
          )}
          <Button type="submit" size="lg" className="w-full sm:w-auto sm:min-w-56" loading={saving}>
            {saving ? "Menyimpan..." : "Simpan Perubahan"}
          </Button>
        </div>
      </form>

      <div className="mb-6">
        <NotificationSettings />
      </div>

      <div className="mb-6">
        <HouseholdSettings />
      </div>

      {/* Quick links + sign out */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card padding="none" className="overflow-hidden">
          <button
            onClick={() => setShowResetWarning(true)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-surface-hover transition-colors text-left"
          >
            <span className="text-sm font-medium text-text-secondary">Setup ulang data keuangan</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-text-muted shrink-0" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </Card>

        <Button variant="outline-danger" fullWidth onClick={handleSignOut}>
          Keluar dari Akun
        </Button>
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
    </PageShell>
  );
}
