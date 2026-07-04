"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { DateRange } from "@/lib/dateRange";
import { apiFetch } from "@/lib/apiFetch";


interface ExportButtonsProps {
  range: DateRange;
  className?: string;
}

async function downloadExport(format: "pdf" | "excel", range: DateRange): Promise<string | null> {
  const res = await apiFetch(`/api/export/${format}?from=${range.from}&to=${range.to}`, { credentials: "include" });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    return body?.error ?? `Gagal export ${format.toUpperCase()} (${res.status})`;
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `wealth-checker-${range.from}_${range.to}.${format === "pdf" ? "pdf" : "xlsx"}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
  return null;
}

/** Sprint 25 (Fase 4) — tombol export laporan PDF/Excel, dipakai di halaman Analisa. */
export function ExportButtons({ range, className = "" }: ExportButtonsProps) {
  const [loading, setLoading] = useState<"pdf" | "excel" | null>(null);
  const [error, setError] = useState("");

  const handleExport = async (format: "pdf" | "excel") => {
    setLoading(format);
    setError("");
    try {
      const err = await downloadExport(format, range);
      if (err) setError(err);
    } catch {
      setError(`Gagal export ${format.toUpperCase()}`);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" loading={loading === "pdf"} disabled={loading !== null} onClick={() => handleExport("pdf")}>
          Export PDF
        </Button>
        <Button type="button" variant="outline" size="sm" loading={loading === "excel"} disabled={loading !== null} onClick={() => handleExport("excel")}>
          Export Excel
        </Button>
      </div>
      {error && <p className="text-xs text-danger-text mt-2">{error}</p>}
    </div>
  );
}
