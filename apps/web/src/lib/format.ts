/** Shared formatting helpers for Rupiah currency, dates, and numeric input masking. */

export function formatRupiahInput(val: string): string {
  const digits = val.replace(/\D/g, "");
  return digits ? Number(digits).toLocaleString("id-ID") : "";
}

export function parseRupiahInput(val: string): number {
  return Number(val.replace(/\D/g, "")) || 0;
}

export function formatCurrency(val: number | string): string {
  return Number(val).toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });
}

/** Abbreviated form for tight spaces, e.g. dashboard hero cards: "Rp 1,2jt". */
export function formatCurrencyShort(val: number | string): string {
  const num = Number(val);
  const abs = Math.abs(num);
  if (abs >= 1_000_000_000) return `Rp ${(num / 1_000_000_000).toFixed(1)}M`;
  if (abs >= 1_000_000) return `Rp ${(num / 1_000_000).toFixed(1)}jt`;
  if (abs >= 1_000) return `Rp ${(num / 1_000).toFixed(0)}rb`;
  return `Rp ${num.toLocaleString("id-ID")}`;
}

export function formatDateLong(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatMonthLabel(ym: string): string {
  const [year, month] = ym.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
}

/** Bentuk singkat untuk label sumbu chart, mis. "4 Jan" (Fase 3 — grafik Analisa). */
export function formatDateShort(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

/** "Jan 2026" — label bulan singkat untuk chart (Fase 3 — Laba Rugi Bulanan). */
export function formatMonthShort(ym: string): string {
  const [year, month] = ym.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("id-ID", { month: "short", year: "numeric" });
}
