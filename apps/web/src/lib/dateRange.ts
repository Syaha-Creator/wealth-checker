/** Fase 3 Sprint 20 — helper rentang tanggal untuk filter global Analisa. */

export interface DateRange {
  from: string; // "YYYY-MM-DD"
  to: string;
}

export type DateRangePresetId = "bulan-ini" | "3-bulan" | "6-bulan" | "tahun-ini" | "custom";

export const DATE_RANGE_PRESETS: { id: DateRangePresetId; label: string }[] = [
  { id: "bulan-ini", label: "Bulan Ini" },
  { id: "3-bulan", label: "3 Bulan Terakhir" },
  { id: "6-bulan", label: "6 Bulan Terakhir" },
  { id: "tahun-ini", label: "Tahun Ini" },
  { id: "custom", label: "Custom" },
];

/**
 * Format tanggal lokal (bukan `toISOString()`, yang mengonversi ke UTC dan
 * bisa menggeser tanggal untuk timezone timur UTC seperti WIB).
 */
function toLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function computePresetRange(preset: DateRangePresetId, referenceDate = new Date()): DateRange {
  const today = toLocalISODate(referenceDate);
  const y = referenceDate.getFullYear();
  const m = referenceDate.getMonth();

  switch (preset) {
    case "bulan-ini":
      return { from: toLocalISODate(new Date(y, m, 1)), to: today };
    case "3-bulan":
      return { from: toLocalISODate(new Date(y, m - 2, 1)), to: today };
    case "6-bulan":
      return { from: toLocalISODate(new Date(y, m - 5, 1)), to: today };
    case "tahun-ini":
      return { from: toLocalISODate(new Date(y, 0, 1)), to: today };
    case "custom":
    default:
      return { from: today, to: today };
  }
}

/** Preset aktif berdasarkan `range` saat ini — "custom" jika tidak cocok satupun. */
export function detectActivePreset(range: DateRange, referenceDate = new Date()): DateRangePresetId {
  for (const { id } of DATE_RANGE_PRESETS) {
    if (id === "custom") continue;
    const preset = computePresetRange(id, referenceDate);
    if (preset.from === range.from && preset.to === range.to) return id;
  }
  return "custom";
}
