"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { Card } from "@/components/ui/Card";
import { formatCurrency, formatCurrencyShort, formatMonthShort } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";
import { useMediaQuery } from "@/lib/useMediaQuery";
import type { DateRange } from "@/lib/dateRange";
import { ReportSkeleton, ReportError, ReportEmpty } from "./ReportStates";

interface MonthlyPLRow {
  bulan: string;
  pendapatan: number;
  pinjamanMasuk: number;
  bayarUtang: number;
  piutangTerbayar: number;
  pengeluaran: number;
  tabungan: number;
  tabunganNegatif: boolean;
}

/** Sprint 17 — sub-laporan 3.6.2: Laba Rugi Bulanan. */
export function MonthlyPLReport({ range }: { range: DateRange }) {
  const { data, loading, error, reload } = useApiResource<MonthlyPLRow[]>(
    `/api/analytics/monthly-pl?from=${range.from}&to=${range.to}`,
  );
  const isNarrow = useMediaQuery("(max-width: 639px)");

  if (loading) return <ReportSkeleton />;
  if (error) return <ReportError message={error} onRetry={reload} />;
  if (!data || data.length === 0) return <ReportEmpty />;

  // Teks alternatif untuk screen reader — meniru pola sr-only di WealthHistoryReport.
  const first = data[0];
  const last = data[data.length - 1];
  const summaryText = data.length === 1
    ? `Laba rugi bulan ${formatMonthShort(first.bulan)}: pendapatan ${formatCurrency(first.pendapatan)}, pengeluaran ${formatCurrency(first.pengeluaran)}, tabungan ${formatCurrency(first.tabungan)}.`
    : `Laba rugi dari ${formatMonthShort(first.bulan)} hingga ${formatMonthShort(last.bulan)}: pendapatan terakhir ${formatCurrency(last.pendapatan)}, pengeluaran terakhir ${formatCurrency(last.pengeluaran)}, tabungan terakhir ${formatCurrency(last.tabungan)}.`;

  return (
    <div className="space-y-3">
      <Card>
        <p className="sr-only">{summaryText}</p>
        <div className="h-48 sm:h-56 lg:h-64" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="bulan" tickFormatter={formatMonthShort} tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => formatCurrencyShort(v)} tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} width={isNarrow ? 42 : 64} />
              <Tooltip
                formatter={(value, name) => [formatCurrency(Number(value)), String(name)]}
                labelFormatter={(label) => formatMonthShort(String(label))}
                contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="pendapatan" name="Pendapatan" fill="var(--brand)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="pengeluaran" name="Pengeluaran" fill="var(--danger)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Laba rugi per bulan: pendapatan, pengeluaran, dan tabungan</caption>
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="px-4 py-2.5 font-medium text-text-muted text-xs">Bulan</th>
                <th scope="col" className="px-4 py-2.5 font-medium text-text-muted text-xs text-right">Pendapatan</th>
                <th scope="col" className="px-4 py-2.5 font-medium text-text-muted text-xs text-right">Pengeluaran</th>
                <th scope="col" className="px-4 py-2.5 font-medium text-text-muted text-xs text-right">Tabungan</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.bulan} className={`border-b border-border last:border-0 ${row.tabunganNegatif ? "bg-danger-soft" : ""}`}>
                  <td className="px-4 py-2.5 text-text-primary font-medium whitespace-nowrap">{formatMonthShort(row.bulan)}</td>
                  <td className="px-4 py-2.5 text-right text-brand">{formatCurrencyShort(row.pendapatan)}</td>
                  <td className="px-4 py-2.5 text-right text-danger-text">{formatCurrencyShort(row.pengeluaran)}</td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${row.tabunganNegatif ? "text-danger-text" : "text-text-primary"}`}>
                    {row.tabungan >= 0 ? "+" : ""}{formatCurrencyShort(row.tabungan)}
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
