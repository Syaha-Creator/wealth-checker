"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatCurrencyShort } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";
import type { DateRange } from "@/lib/dateRange";
import { ReportSkeleton, ReportError, ReportEmpty } from "./ReportStates";

interface IncomeItem {
  kategori: string;
  total: number;
  persentaseDariTotal: number;
  isTerbesar: boolean;
}

interface IncomeResponse {
  items: IncomeItem[];
  grandTotal: number;
}

const DONUT_COLORS = ["var(--brand)", "var(--info)", "var(--warning)", "var(--danger)", "var(--text-muted)"];

/** Sprint 19 — sub-laporan 3.6.6: Pemasukan. */
export function IncomeReport({ range }: { range: DateRange }) {
  const { data, loading, error, reload } = useApiResource<IncomeResponse>(
    `/api/analytics/income?from=${range.from}&to=${range.to}`,
  );

  if (loading) return <ReportSkeleton />;
  if (error) return <ReportError message={error} onRetry={reload} />;
  if (!data || data.items.length === 0) return <ReportEmpty />;

  const donutData = data.items.map((item) => ({ name: item.kategori, value: item.total }));

  return (
    <div className="space-y-3">
      <Card>
        <p className="text-xs text-text-muted">Total Pemasukan</p>
        <p className="text-2xl font-bold text-text-primary mt-1">{formatCurrency(data.grandTotal)}</p>
      </Card>

      <Card>
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
          Rincian pemasukan: {data.items.map((i) => `${i.kategori} ${formatCurrency(i.total)} (${i.persentaseDariTotal}%)`).join(", ")}.
        </p>
      </Card>

      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Rincian pemasukan per sumber kategori</caption>
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="px-4 py-2.5 font-medium text-text-muted text-xs">Sumber</th>
                <th scope="col" className="px-4 py-2.5 font-medium text-text-muted text-xs text-right">Nominal</th>
                <th scope="col" className="px-4 py-2.5 font-medium text-text-muted text-xs text-right">%</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.kategori} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 text-text-primary font-medium whitespace-nowrap">
                    {item.kategori}
                    {item.isTerbesar && <Badge variant="brand" className="ml-2">Terbesar</Badge>}
                  </td>
                  <td className="px-4 py-2.5 text-right text-text-secondary">{formatCurrencyShort(item.total)}</td>
                  <td className="px-4 py-2.5 text-right text-text-muted">{item.persentaseDariTotal}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
