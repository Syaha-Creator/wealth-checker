"use client";

import { useEffect, useState } from "react";

interface WealthSummary {
  totalLiquidAssets: number;
  totalFixedAssets: number;
  totalDebts: number;
  netWorth: number;
  wealthLevel: number;
  wealthLevelName: string;
  monthlyPassiveIncome: number;
  monthlyExpenses: number;
}

function formatRupiah(value: number) {
  if (Math.abs(value) >= 1_000_000_000) {
    return `Rp ${(value / 1_000_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000_000) {
    return `Rp ${(value / 1_000_000).toFixed(1)}jt`;
  }
  return `Rp ${value.toLocaleString("id-ID")}`;
}

const LEVEL_COLORS: Record<number, string> = {
  1: "text-red-400",
  2: "text-orange-400",
  3: "text-yellow-400",
  4: "text-lime-400",
  5: "text-emerald-400",
  6: "text-emerald-300",
  7: "text-cyan-300",
};

export default function DashboardPage() {
  const [summary, setSummary] = useState<WealthSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/wealth/summary", { credentials: "include" })
      .then((r) => {
        if (r.status === 401) {
          window.location.href = "/auth/login";
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (data) setSummary(data);
      })
      .catch(() => setError("Gagal memuat data."))
      .finally(() => setLoading(false));
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/sign-out", { method: "POST", credentials: "include" });
    window.location.href = "/";
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Navbar */}
      <nav className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center text-slate-950 font-bold text-xs">
              W
            </div>
            <span className="font-semibold">WealthChecker</span>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            Keluar
          </button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">Ringkasan kekayaan bersih kamu</p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {summary && (
          <>
            {/* Net worth & level */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
                <p className="text-slate-400 text-sm mb-1">Kekayaan Bersih</p>
                <p className="text-3xl font-bold text-white">
                  {formatRupiah(summary.netWorth)}
                </p>
                <div className="mt-3 flex gap-3 text-xs text-slate-400">
                  <span className="text-emerald-400">
                    +{formatRupiah(summary.totalLiquidAssets + summary.totalFixedAssets)} aset
                  </span>
                  <span className="text-red-400">−{formatRupiah(summary.totalDebts)} utang</span>
                </div>
              </div>

              <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
                <p className="text-slate-400 text-sm mb-1">Level Finansial</p>
                <p
                  className={`text-3xl font-bold ${
                    LEVEL_COLORS[summary.wealthLevel] ?? "text-white"
                  }`}
                >
                  Level {summary.wealthLevel}
                </p>
                <p className="text-slate-300 text-sm mt-1">{summary.wealthLevelName}</p>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
              {[
                { label: "Aset Likuid", value: summary.totalLiquidAssets, color: "emerald" },
                { label: "Aset Tetap", value: summary.totalFixedAssets, color: "blue" },
                { label: "Total Utang", value: summary.totalDebts, color: "red" },
                { label: "Passive Income/bln", value: summary.monthlyPassiveIncome, color: "purple" },
              ].map((s) => (
                <div
                  key={s.label}
                  className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-4"
                >
                  <p className="text-slate-400 text-xs mb-1">{s.label}</p>
                  <p className="text-white font-semibold text-sm">{formatRupiah(s.value)}</p>
                </div>
              ))}
            </div>

            {/* Empty state CTA */}
            {summary.netWorth === 0 && (
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6 text-center">
                <p className="text-emerald-400 font-medium mb-2">
                  Mulai lacak kekayaan kamu!
                </p>
                <p className="text-slate-400 text-sm">
                  Tambahkan akun, aset, dan utang untuk melihat ringkasan finansial kamu.
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
