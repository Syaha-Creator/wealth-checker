"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Card } from "@/components/ui/Card";
import { formatCurrency, formatCurrencyShort, formatDateShort } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";
import type { DateRange } from "@/lib/dateRange";
import { ReportSkeleton, ReportError, ReportEmpty } from "./ReportStates";

interface WealthHistoryResponse {
  history: { tanggal: string; kekayaanBersih: number }[];
  delta: number;
}

/** Sprint 17 — sub-laporan 3.6.1: grafik kekayaan bersih dari waktu ke waktu. */
export function WealthHistoryReport({ range }: { range: DateRange }) {
  const { data, loading, error, reload } = useApiResource<WealthHistoryResponse>(
    `/api/wealth/wealth-history?from=${range.from}&to=${range.to}`,
  );

  if (loading) return <ReportSkeleton />;
  if (error) return <ReportError message={error} onRetry={reload} />;
  if (!data || data.history.length === 0) return <ReportEmpty description="Belum ada snapshot kekayaan bersih di rentang tanggal ini — catat transaksi untuk mulai membangun grafik." />;

  const { history, delta } = data;
  const deltaPositive = delta >= 0;

  // Teks alternatif untuk screen reader (Sprint 23 — chart SVG tidak accessible
  // secara native): ringkasan awal→akhir periode dalam bentuk kalimat.
  const summaryText = `Kekayaan bersih dari ${formatCurrency(history[0].kekayaanBersih)} pada ${history[0].tanggal} menjadi ${formatCurrency(history[history.length - 1].kekayaanBersih)} pada ${history[history.length - 1].tanggal}, ${deltaPositive ? "naik" : "turun"} ${formatCurrency(Math.abs(delta))}.`;

  return (
    <div className="space-y-3">
      <Card>
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-text-muted">Perubahan Periode Ini</p>
          <span className={`text-sm font-bold ${deltaPositive ? "text-brand" : "text-danger-text"}`}>
            {deltaPositive ? "+" : ""}{formatCurrencyShort(delta)}
          </span>
        </div>
        <p className="sr-only">{summaryText}</p>
        <div className="h-64" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="tanggal" tickFormatter={formatDateShort} tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} minTickGap={30} />
              <YAxis tickFormatter={(v) => formatCurrencyShort(v)} tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} width={64} />
              <Tooltip
                formatter={(value) => [formatCurrency(Number(value)), "Kekayaan Bersih"]}
                labelFormatter={(label) => formatDateShort(String(label))}
                contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
              />
              <Line type="monotone" dataKey="kekayaanBersih" stroke="var(--brand)" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
