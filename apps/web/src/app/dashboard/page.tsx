"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "@/lib/auth-client";

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
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}Rp ${(abs / 1_000_000_000).toFixed(1)}M`;
  if (abs >= 1_000_000) return `${sign}Rp ${(abs / 1_000_000).toFixed(1)}jt`;
  return `${sign}Rp ${abs.toLocaleString("id-ID")}`;
}

const LEVEL_BADGE: Record<number, { color: string; bg: string; label: string }> = {
  1: { color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", label: "Bergantung" },
  2: { color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20", label: "Solvency" },
  3: { color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20", label: "Stability" },
  4: { color: "text-lime-400", bg: "bg-lime-500/10 border-lime-500/20", label: "Safety" },
  5: { color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", label: "Freedom" },
  6: { color: "text-emerald-300", bg: "bg-emerald-400/10 border-emerald-400/20", label: "Abundance" },
  7: { color: "text-cyan-300", bg: "bg-cyan-400/10 border-cyan-400/20", label: "Legacy" },
};

function StatCard({
  label,
  value,
  sub,
  positive,
}: {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
}) {
  return (
    <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4">
      <p className="text-slate-400 text-xs mb-1.5">{label}</p>
      <p className={`font-semibold text-base ${positive === false ? "text-red-400" : "text-white"}`}>
        {value}
      </p>
      {sub && <p className="text-slate-500 text-xs mt-0.5">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [summary, setSummary] = useState<WealthSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [summaryError, setSummaryError] = useState("");

  // Guard: redirect ke login jika tidak ada session
  useEffect(() => {
    if (!isPending && !session) {
      router.replace("/auth/login");
    }
  }, [session, isPending, router]);

  useEffect(() => {
    if (!session) return;
    fetch("/api/wealth/summary", { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error("Gagal memuat data.");
        return r.json();
      })
      .then(setSummary)
      .catch((e) => setSummaryError(e.message))
      .finally(() => setLoadingSummary(false));
  }, [session]);

  async function handleLogout() {
    await signOut();
    router.push("/");
  }

  if (isPending || (!session && !isPending)) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const level = LEVEL_BADGE[summary?.wealthLevel ?? 1];

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Navbar */}
      <nav className="border-b border-slate-800 px-6 py-4 sticky top-0 bg-slate-950/90 backdrop-blur z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center text-slate-950 font-bold text-xs">
              W
            </div>
            <span className="font-semibold">WealthChecker</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-slate-400 text-sm hidden sm:block">
              {session.user.name}
            </span>
            <button
              onClick={handleLogout}
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              Keluar
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold">
            Halo, {session.user.name.split(" ")[0]} 👋
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Berikut ringkasan kekayaan bersih kamu
          </p>
        </div>

        {/* Loading */}
        {loadingSummary && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Error */}
        {summaryError && !loadingSummary && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
            {summaryError}
          </div>
        )}

        {summary && !loadingSummary && (
          <>
            {/* Net Worth + Level */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
                <p className="text-slate-400 text-sm mb-1">Kekayaan Bersih</p>
                <p className={`text-4xl font-bold ${summary.netWorth < 0 ? "text-red-400" : "text-white"}`}>
                  {formatRupiah(summary.netWorth)}
                </p>
                <div className="mt-3 flex gap-4 text-xs">
                  <span className="text-emerald-400">
                    ↑ {formatRupiah(summary.totalLiquidAssets + summary.totalFixedAssets)} aset
                  </span>
                  <span className="text-red-400">
                    ↓ {formatRupiah(summary.totalDebts)} utang
                  </span>
                </div>
              </div>

              <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
                <p className="text-slate-400 text-sm mb-2">Level Finansial</p>
                <div className="flex items-baseline gap-3">
                  <p className={`text-4xl font-bold ${level.color}`}>
                    Level {summary.wealthLevel}
                  </p>
                </div>
                <span
                  className={`inline-block mt-2 text-xs font-medium px-2.5 py-1 rounded-full border ${level.bg} ${level.color}`}
                >
                  {summary.wealthLevelName || level.label}
                </span>
                {summary.monthlyPassiveIncome > 0 && summary.monthlyExpenses > 0 && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>Passive income coverage</span>
                      <span>
                        {Math.min(
                          Math.round(
                            (summary.monthlyPassiveIncome / summary.monthlyExpenses) * 100
                          ),
                          100
                        )}
                        %
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{
                          width: `${Math.min(
                            (summary.monthlyPassiveIncome / summary.monthlyExpenses) * 100,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
              <StatCard label="Aset Likuid" value={formatRupiah(summary.totalLiquidAssets)} />
              <StatCard label="Aset Tetap" value={formatRupiah(summary.totalFixedAssets)} />
              <StatCard
                label="Total Utang"
                value={formatRupiah(summary.totalDebts)}
                positive={false}
              />
              <StatCard
                label="Passive Income/bln"
                value={formatRupiah(summary.monthlyPassiveIncome)}
              />
            </div>

            {/* Empty state */}
            {summary.netWorth === 0 &&
              summary.totalLiquidAssets === 0 &&
              summary.totalFixedAssets === 0 && (
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6 text-center">
                  <div className="text-3xl mb-3">🚀</div>
                  <p className="text-emerald-400 font-semibold mb-2">
                    Mulai perjalanan finansial kamu!
                  </p>
                  <p className="text-slate-400 text-sm max-w-sm mx-auto">
                    Tambahkan akun, catat aset dan utang kamu untuk mulai melacak kekayaan bersih.
                  </p>
                </div>
              )}
          </>
        )}
      </main>
    </div>
  );
}
