"use client";

import { DATE_RANGE_PRESETS, computePresetRange, detectActivePreset } from "@/lib/dateRange";
import type { DateRange } from "@/lib/dateRange";

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

/**
 * Filter tanggal global (Fase 3 Sprint 20) — preset cepat + custom. Dipasang
 * sekali di halaman Analisa terpadu, state-nya di-pass ke semua sub-laporan
 * agar refresh bersamaan saat rentang diubah.
 */
export function DateRangeFilter({ value, onChange, className = "" }: DateRangeFilterProps) {
  const activePreset = detectActivePreset(value);

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Preset rentang tanggal">
        {DATE_RANGE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            aria-pressed={activePreset === preset.id}
            onClick={() => {
              if (preset.id !== "custom") onChange(computePresetRange(preset.id));
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              activePreset === preset.id
                ? "bg-brand text-brand-text-on"
                : "bg-surface-hover text-text-secondary hover:bg-border/40"
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {activePreset === "custom" && (
        <div className="flex items-center gap-2 mt-2.5">
          <input
            type="date"
            aria-label="Dari tanggal"
            value={value.from}
            max={value.to}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
            className="px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
          <span className="text-text-muted text-sm">–</span>
          <input
            type="date"
            aria-label="Sampai tanggal"
            value={value.to}
            min={value.from}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
            className="px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </div>
      )}
    </div>
  );
}
