"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatCurrencyShort } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";
import type { DateRange } from "@/lib/dateRange";
import { ReportSkeleton, ReportError, ReportEmpty } from "./ReportStates";

function WalletIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path d="M21 12V7H5a2 2 0 010-4h14v4" />
      <path d="M3 5v14a2 2 0 002 2h16v-5" />
      <path d="M18 12a2 2 0 000 4h4v-4z" />
    </svg>
  );
}

interface BudgetVsActualItem {
  kategori: string;
  rencanaNominal: number;
  aktualNominal: number;
  selisih: number;
  selisihPersen: number | null;
  overBudget: boolean;
}

interface BudgetVsActualResponse {
  wealthLevel: number;
  hasPlan: boolean;
  pendapatan: { rencanaNominal: number; aktualNominal: number } | null;
  alokasi: BudgetVsActualItem[];
}

const DONUT_COLORS = ["var(--brand)", "var(--info)", "var(--warning)", "var(--danger)"];

/** Sprint 18 — sub-laporan 3.6.3: Budgeting Aktual vs Rencana. */
export function BudgetVsActualReport({ range }: { range: DateRange }) {
  const { data, loading, error, reload } = useApiResource<BudgetVsActualResponse>(
    `/api/analytics/budget-vs-actual?from=${range.from}&to=${range.to}`,
  );

  if (loading) return <ReportSkeleton />;
  if (error) return <ReportError message={error} onRetry={reload} />;
  if (!data || data.wealthLevel === -1) return <ReportEmpty description="Lengkapi data kekayaanmu dulu (rekening, aset, utang) untuk melihat perbandingan budgeting." />;
  if (!data.hasPlan) {
    return (
      <EmptyState
        icon={<WalletIcon />}
        title="Belum ada rencana pemasukan bulan ini"
        description="Atur rencana pemasukan bulanan di Budgeting Advisor untuk melihat perbandingan aktual vs rencana."
        action={<Button href="/budgeting" size="sm">Atur Rencana Pemasukan</Button>}
      />
    );
  }

  const donutData = data.alokasi.filter((a) => a.aktualNominal > 0).map((a) => ({ name: a.kategori, value: a.aktualNominal }));

  return (
    <div className="space-y-3">
      {data.pendapatan && (
        <Card>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-info-soft text-info-text">Pendapatan</span>
            <span className="text-xs text-text-muted">Rencana {formatCurrencyShort(data.pendapatan.rencanaNominal)}</span>
          </div>
          <p className="text-lg font-bold text-text-primary mt-1">{formatCurrency(data.pendapatan.aktualNominal)}</p>
        </Card>
      )}

      {donutData.length > 0 && (
        <Card>
          <p className="text-xs text-text-muted mb-2">Distribusi Aktual Pengeluaran per Kategori</p>
          <div className="h-48 sm:h-56 lg:h-64" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={donutData} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2}>
                  {donutData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <p className="sr-only">
            Distribusi pengeluaran aktual: {donutData.map((d) => `${d.name} ${formatCurrency(d.value)}`).join(", ")}.
          </p>
        </Card>
      )}

      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Perbandingan rencana dan aktual alokasi anggaran per kategori</caption>
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="px-4 py-2.5 font-medium text-text-muted text-xs">Kategori</th>
                <th scope="col" className="px-4 py-2.5 font-medium text-text-muted text-xs text-right">Rencana</th>
                <th scope="col" className="px-4 py-2.5 font-medium text-text-muted text-xs text-right">Aktual</th>
                <th scope="col" className="px-4 py-2.5 font-medium text-text-muted text-xs text-right">Selisih</th>
              </tr>
            </thead>
            <tbody>
              {data.alokasi.map((item) => (
                <tr key={item.kategori} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 text-text-primary font-medium whitespace-nowrap">{item.kategori}</td>
                  <td className="px-4 py-2.5 text-right text-text-secondary">{formatCurrencyShort(item.rencanaNominal)}</td>
                  <td className="px-4 py-2.5 text-right text-text-secondary">{formatCurrencyShort(item.aktualNominal)}</td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${item.overBudget ? "text-danger-text" : "text-brand"}`}>
                    {item.selisih >= 0 ? "+" : ""}{formatCurrencyShort(item.selisih)}
                    {item.selisihPersen !== null && <span className="text-xs font-normal ml-1">({item.selisihPersen >= 0 ? "+" : ""}{item.selisihPersen}%)</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
