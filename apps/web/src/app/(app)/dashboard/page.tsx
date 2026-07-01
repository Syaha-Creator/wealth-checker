"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

type WealthSummary = {
  totalAset: number;
  totalUtang: number;
  kekayaanBersih: number;
  totalKas: number;
  totalLiquidAssets: number;
  totalFixedAssets: number;
  totalReceivables: number;
  wealthLevel: number;
  wealthLevelName: string;
};

type MonthlySnapshot = {
  bulan: string;
  pemasukan: number;
  pengeluaran: number;
  sisaUangBulanan: number;
};

type MonthlyCashFlow = {
  bulanIni: MonthlySnapshot;
  bulanLalu: MonthlySnapshot;
  rataRata3Bulan: { pemasukan: number; pengeluaran: number; sisaUangBulanan: number };
  hidupTanpaGajiBulan: number | null;
};

const LEVEL_CONFIG = [
  { label: "Pailit", desc: "Utang melebihi aset", color: "bg-red-100 text-red-700" },
  { label: "Terjerat Utang", desc: "Utang lebih besar dari kekayaan", color: "bg-orange-100 text-orange-700" },
  { label: "Terlihat Kaya", desc: "Barang banyak tapi kas minus", color: "bg-amber-100 text-amber-700" },
  { label: "Gaji ke Gaji", desc: "Belum punya dana darurat", color: "bg-yellow-100 text-yellow-700" },
  { label: "Punya Dana Darurat", desc: "Sudah aman jika darurat", color: "bg-lime-100 text-lime-700" },
  { label: "Dana Pensiun", desc: "Sudah menyiapkan masa depan", color: "bg-emerald-100 text-emerald-700" },
  { label: "Punya Warisan", desc: "Level kebebasan finansial tertinggi", color: "bg-teal-100 text-teal-700" },
];

function formatRp(val: number) {
  if (Math.abs(val) >= 1_000_000_000) return `Rp ${(val / 1_000_000_000).toFixed(1)}M`;
  if (Math.abs(val) >= 1_000_000) return `Rp ${(val / 1_000_000).toFixed(1)}jt`;
  if (Math.abs(val) >= 1_000) return `Rp ${(val / 1_000).toFixed(0)}rb`;
  return `Rp ${val.toLocaleString("id-ID")}`;
}

function formatRpFull(val: number) {
  return val.toLocaleString("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
}

type Account = { id: string; nama: string; saldoCache: string };

function formatMonthLabel(ym: string) {
  const [year, month] = ym.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("id-ID", {
    month: "long", year: "numeric",
  });
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [summary, setSummary] = useState<WealthSummary | null>(null);
  const [cashFlow, setCashFlow] = useState<MonthlyCashFlow | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session) return;
    Promise.all([
      fetch(`${API}/api/wealth/summary`, { credentials: "include" }).then((r) => {
        if (!r.ok) throw new Error("Gagal memuat ringkasan kekayaan");
        return r.json();
      }),
      fetch(`${API}/api/accounts`, { credentials: "include" }).then((r) => {
        if (!r.ok) throw new Error("Gagal memuat rekening");
        return r.json();
      }),
      fetch(`${API}/api/wealth/monthly-cash-flow`, { credentials: "include" }).then((r) => {
        if (!r.ok) return null;
        return r.json();
      }),
    ])
      .then(([w, a, cf]) => {
        setSummary(w);
        setAccounts(Array.isArray(a) ? a.filter((acc: Account & { isActive: boolean }) => acc.isActive) : []);
        if (cf) setCashFlow(cf);
      })
      .catch((err: Error) => {
        setError(err.message ?? "Gagal memuat data. Coba muat ulang halaman.");
      })
      .finally(() => setLoading(false));
  }, [session]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/auth/login");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" aria-label="Memuat..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="rounded-2xl bg-red-50 border border-red-100 p-6 text-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="mx-auto mb-3 text-red-400" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-sm font-medium text-red-700 mb-1">Gagal memuat dashboard</p>
          <p className="text-xs text-red-500 mb-4">{error}</p>
          <button
            onClick={() => { setError(""); setLoading(true); }}
            className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  const level = summary?.wealthLevel ?? 0;
  const levelCfg = LEVEL_CONFIG[level] ?? LEVEL_CONFIG[0];
  const kn = summary?.kekayaanBersih ?? 0;

  const isNewUser = !summary || (summary.totalAset === 0 && summary.totalUtang === 0);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-gray-500">Selamat datang,</p>
          <h1 className="text-xl font-bold text-gray-900">{session?.user?.name}</h1>
        </div>
        <button
          onClick={handleSignOut}
          aria-label="Keluar dari akun"
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Keluar
        </button>
      </div>

      {/* Onboarding prompt */}
      {isNewUser && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
          <p className="text-sm font-semibold text-emerald-800">Mulai setup keuangan Anda</p>
          <p className="text-sm text-emerald-700 mt-1">
            Isi data awal untuk menghitung kekayaan bersih dan level kebebasan finansial Anda.
          </p>
          <Link
            href="/onboarding"
            className="mt-3 inline-block px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Mulai Setup →
          </Link>
        </div>
      )}

      {/* Kekayaan Bersih */}
      <div className={`rounded-2xl p-5 mb-4 ${kn >= 0 ? "bg-emerald-600" : "bg-red-500"}`}>
        <p className="text-sm text-white/70">Kekayaan Bersih</p>
        <p className="text-3xl font-bold text-white mt-1">{formatRp(kn)}</p>
        <p className="text-sm text-white/80 mt-0.5">{formatRpFull(kn)}</p>
        <div className="mt-4 flex items-center gap-2">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${levelCfg.color}`}>
            Level {level} · {levelCfg.label}
          </span>
        </div>
      </div>

      {/* Breakdown: Aset vs Utang */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500">Total Aset</p>
            <p className="text-lg font-bold text-gray-900 mt-1">{formatRp(summary.totalAset)}</p>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between text-xs text-gray-400">
                <span>Kas</span>
                <span>{formatRp(summary.totalKas)}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-400">
                <span>Investasi</span>
                <span>{formatRp(summary.totalLiquidAssets)}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-400">
                <span>Barang</span>
                <span>{formatRp(summary.totalFixedAssets)}</span>
              </div>
              {summary.totalReceivables > 0 && (
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Piutang</span>
                  <span>{formatRp(summary.totalReceivables)}</span>
                </div>
              )}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500">Total Utang</p>
            <p className="text-lg font-bold text-red-600 mt-1">{formatRp(summary.totalUtang)}</p>
            <div className="mt-2 pt-2 border-t border-gray-50">
              <p className="text-xs text-gray-400">{levelCfg.desc}</p>
            </div>
            {/* Level progress bar */}
            <div className="mt-3">
              <div className="flex gap-0.5 mt-1" role="progressbar" aria-valuenow={level} aria-valuemin={0} aria-valuemax={6} aria-label={`Level kebebasan finansial: ${level} dari 6`}>
                {[0, 1, 2, 3, 4, 5, 6].map((l) => (
                  <div
                    key={l}
                    className={`h-1.5 flex-1 rounded-full ${l <= level ? "bg-emerald-500" : "bg-gray-100"}`}
                  />
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">Level {level} dari 6</p>
            </div>
          </div>
        </div>
      )}

      {/* Rekening */}
      {accounts.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-700">Rekening</h2>
            <Link href="/accounts" className="text-xs text-emerald-600 font-medium hover:text-emerald-700 transition-colors">Lihat semua</Link>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {accounts.slice(0, 4).map((acc) => (
              <div key={acc.id} className="bg-white rounded-xl border border-gray-100 p-3">
                <p className="text-xs text-gray-500 truncate">{acc.nama}</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">
                  {formatRp(Number(acc.saldoCache))}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Arus Kas Bulan Ini */}
      {cashFlow && (cashFlow.bulanIni.pemasukan > 0 || cashFlow.bulanIni.pengeluaran > 0) && (
        <div className="mb-4 bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Arus Kas Bulan Ini</h2>
            <span className="text-xs text-gray-400">{formatMonthLabel(cashFlow.bulanIni.bulan)}</span>
          </div>

          {/* Pemasukan vs Pengeluaran bar */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-emerald-50 rounded-xl p-3">
              <p className="text-xs text-emerald-600 font-medium mb-1">Pemasukan</p>
              <p className="text-sm font-bold text-emerald-700">{formatRp(cashFlow.bulanIni.pemasukan)}</p>
            </div>
            <div className="bg-red-50 rounded-xl p-3">
              <p className="text-xs text-red-500 font-medium mb-1">Pengeluaran</p>
              <p className="text-sm font-bold text-red-600">{formatRp(cashFlow.bulanIni.pengeluaran)}</p>
            </div>
          </div>

          {/* Sisa */}
          <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl ${
            cashFlow.bulanIni.sisaUangBulanan >= 0 ? "bg-emerald-600" : "bg-red-500"
          }`}>
            <p className="text-xs font-medium text-white/80">Sisa Uang Bulan Ini</p>
            <p className="text-sm font-bold text-white">
              {cashFlow.bulanIni.sisaUangBulanan >= 0 ? "+" : ""}
              {formatRp(cashFlow.bulanIni.sisaUangBulanan)}
            </p>
          </div>

          {/* Rata-rata 3 bulan & hidup tanpa gaji */}
          <div className="mt-3 pt-3 border-t border-gray-50 space-y-1.5">
            <div className="flex justify-between text-xs text-gray-400">
              <span>Rata-rata sisa 3 bln</span>
              <span className={cashFlow.rataRata3Bulan.sisaUangBulanan >= 0 ? "text-emerald-600 font-medium" : "text-red-500 font-medium"}>
                {cashFlow.rataRata3Bulan.sisaUangBulanan >= 0 ? "+" : ""}
                {formatRp(cashFlow.rataRata3Bulan.sisaUangBulanan)}
              </span>
            </div>
            {cashFlow.hidupTanpaGajiBulan !== null && (
              <div className="flex justify-between text-xs text-gray-400">
                <span>Hidup tanpa gaji</span>
                <span className="text-gray-700 font-medium">{cashFlow.hidupTanpaGajiBulan} bulan</span>
              </div>
            )}
          </div>

          {/* Bulan lalu perbandingan */}
          {(cashFlow.bulanLalu.pemasukan > 0 || cashFlow.bulanLalu.pengeluaran > 0) && (
            <div className="mt-3 pt-3 border-t border-gray-50">
              <p className="text-xs text-gray-400 mb-1.5">{formatMonthLabel(cashFlow.bulanLalu.bulan)}</p>
              <div className="flex justify-between text-xs">
                <span className="text-emerald-600">+{formatRp(cashFlow.bulanLalu.pemasukan)}</span>
                <span className="text-red-500">-{formatRp(cashFlow.bulanLalu.pengeluaran)}</span>
                <span className={`font-semibold ${cashFlow.bulanLalu.sisaUangBulanan >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                  {cashFlow.bulanLalu.sisaUangBulanan >= 0 ? "+" : ""}{formatRp(cashFlow.bulanLalu.sisaUangBulanan)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick actions */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Catat Cepat</h2>
        <div className="grid grid-cols-3 gap-2">
          <Link href="/transactions/new?type=pendapatan" className="flex flex-col items-center gap-2 p-3 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-emerald-600" strokeLinecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 5 5 12"/></svg>
            <span className="text-xs font-medium text-emerald-700">Pemasukan</span>
          </Link>
          <Link href="/transactions/new?type=pengeluaran" className="flex flex-col items-center gap-2 p-3 bg-red-50 rounded-xl hover:bg-red-100 transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-red-500" strokeLinecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="5 12 12 19 19 12"/></svg>
            <span className="text-xs font-medium text-red-600">Pengeluaran</span>
          </Link>
          <Link href="/transactions/new?type=transfer" className="flex flex-col items-center gap-2 p-3 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-blue-500" strokeLinecap="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            <span className="text-xs font-medium text-blue-600">Transfer</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
