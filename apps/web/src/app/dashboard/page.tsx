"use client";

import { useEffect, useState } from "react";

interface WealthSummary {
  kasTabungan: number;
  asetSetaraKas: number;
  asetTidakLancar: number;
  uang: number;
  barang: number;
  totalAset: number;
  totalUtang: number;
  kekayaanBersih: number;
  level: number;
  levelInfo?: {
    namaLevel: string;
    diagnosa: string;
    saran: string;
  } | null;
}

const LEVEL_COLORS = [
  "bg-red-500", "bg-orange-500", "bg-yellow-500",
  "bg-lime-500", "bg-green-500", "bg-emerald-500", "bg-teal-500",
];

function formatRupiah(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<WealthSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/wealth/summary", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setSummary)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-gray-400">Memuat data...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 dark:bg-gray-900">
      <div className="mx-auto max-w-md space-y-4">
        <header className="flex items-center justify-between py-2">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Wealth Checker</h1>
          <a href="/transactions/add" className="rounded-full bg-blue-600 p-2 text-white">
            <span className="text-xl">+</span>
          </a>
        </header>

        {summary ? (
          <>
            {/* Kekayaan Bersih Card */}
            <div className="rounded-2xl bg-blue-600 p-6 text-white">
              <p className="text-sm opacity-80">Kekayaan Bersih</p>
              <p className="mt-1 text-3xl font-bold">{formatRupiah(summary.kekayaanBersih)}</p>
              <div className="mt-4 flex gap-4 text-sm">
                <div>
                  <p className="opacity-70">Aset</p>
                  <p className="font-semibold">{formatRupiah(summary.totalAset)}</p>
                </div>
                <div>
                  <p className="opacity-70">Utang</p>
                  <p className="font-semibold">{formatRupiah(summary.totalUtang)}</p>
                </div>
              </div>
            </div>

            {/* Level Card */}
            <div className="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
              <p className="text-sm text-gray-500 dark:text-gray-400">Level Kebebasan Finansial</p>
              <div className="mt-3 flex items-center gap-3">
                <div className={`flex h-14 w-14 items-center justify-center rounded-full text-2xl font-bold text-white ${LEVEL_COLORS[summary.level]}`}>
                  {summary.level}
                </div>
                <div>
                  <p className="font-bold text-gray-900 dark:text-white">{summary.levelInfo?.namaLevel ?? `Level ${summary.level}`}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{summary.levelInfo?.diagnosa ?? ""}</p>
                </div>
              </div>
              <div className="mt-3 flex gap-1">
                {[0, 1, 2, 3, 4, 5, 6].map((l) => (
                  <div key={l} className={`h-2 flex-1 rounded-full ${l <= summary.level ? LEVEL_COLORS[l] : "bg-gray-200 dark:bg-gray-700"}`} />
                ))}
              </div>
            </div>

            {/* Breakdown Card */}
            <div className="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
              <p className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">Breakdown Aset</p>
              <div className="space-y-2">
                {[
                  { label: "Kas & Tabungan", value: summary.kasTabungan, color: "text-blue-600" },
                  { label: "Aset Setara Kas", value: summary.asetSetaraKas, color: "text-green-600" },
                  { label: "Aset Tidak Lancar", value: summary.asetTidakLancar, color: "text-yellow-600" },
                  { label: "Total Utang", value: -summary.totalUtang, color: "text-red-600" },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">{item.label}</span>
                    <span className={`font-medium ${item.color}`}>{formatRupiah(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Catat Pemasukan", href: "/transactions/add?type=pendapatan", emoji: "💰" },
                { label: "Catat Pengeluaran", href: "/transactions/add?type=pengeluaran", emoji: "🛒" },
                { label: "Transfer", href: "/transactions/add?type=transfer", emoji: "🔄" },
                { label: "Rekening", href: "/accounts", emoji: "🏦" },
              ].map((action) => (
                <a
                  key={action.label}
                  href={action.href}
                  className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md dark:bg-gray-800"
                >
                  <span className="text-2xl">{action.emoji}</span>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{action.label}</span>
                </a>
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-2xl bg-white p-6 text-center shadow-sm dark:bg-gray-800">
            <p className="text-gray-500">Mulai dengan mengisi data keuangan Anda</p>
            <a href="/onboarding" className="mt-4 block rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white">
              Mulai Onboarding
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
