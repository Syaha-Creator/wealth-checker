"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { DateRangeFilter } from "@/components/ui/DateRangeFilter";
import { computePresetRange } from "@/lib/dateRange";
import type { DateRange } from "@/lib/dateRange";
import { WealthHistoryReport } from "./_components/WealthHistoryReport";
import { MonthlyPLReport } from "./_components/MonthlyPLReport";
import { BudgetVsActualReport } from "./_components/BudgetVsActualReport";
import { EmergencyFundReport } from "./_components/EmergencyFundReport";
import { EssentialExpensesReport } from "./_components/EssentialExpensesReport";
import { IncomeReport } from "./_components/IncomeReport";

type TabId = "kekayaan-bersih" | "laba-rugi" | "budgeting" | "dana-darurat" | "kebutuhan-pokok" | "pemasukan";

const TABS: { id: TabId; label: string; needsDateFilter: boolean }[] = [
  { id: "kekayaan-bersih", label: "Kekayaan Bersih", needsDateFilter: true },
  { id: "laba-rugi", label: "Laba Rugi Bulanan", needsDateFilter: true },
  { id: "budgeting", label: "Budgeting", needsDateFilter: true },
  { id: "dana-darurat", label: "Dana Darurat", needsDateFilter: false },
  { id: "kebutuhan-pokok", label: "Kebutuhan Pokok", needsDateFilter: true },
  { id: "pemasukan", label: "Pemasukan", needsDateFilter: true },
];

/**
 * Fase 3 Sprint 20 — halaman Analisa terpadu. Menyatukan 6 sub-laporan
 * (Sprint 17-19) dalam satu halaman dengan tab navigasi dan filter tanggal
 * global. Setiap tab me-render komponennya sendiri dengan fetch independen
 * (lihat useApiResource) sehingga satu sub-laporan gagal/loading tidak
 * memengaruhi yang lain.
 */
export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("kekayaan-bersih");
  const [range, setRange] = useState<DateRange>(() => computePresetRange("3-bulan"));

  const activeTabMeta = TABS.find((t) => t.id === activeTab)!;

  return (
    <div className="max-w-3xl">
      <PageHeader title="Analisa" subtitle="Pantau kesehatan keuanganmu dari berbagai sudut" />

      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4 -mx-1 px-1" role="tablist" aria-label="Sub-laporan Analisa">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-brand text-brand-text-on"
                : "bg-surface text-text-secondary border border-border hover:bg-surface-hover"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTabMeta.needsDateFilter ? (
        <DateRangeFilter value={range} onChange={setRange} className="mb-4" />
      ) : (
        <p className="text-xs text-text-muted mb-4">Dana darurat dihitung dari kondisi keuanganmu saat ini, tidak bergantung pada filter tanggal.</p>
      )}

      <div role="tabpanel">
        {activeTab === "kekayaan-bersih" && <WealthHistoryReport range={range} />}
        {activeTab === "laba-rugi" && <MonthlyPLReport range={range} />}
        {activeTab === "budgeting" && <BudgetVsActualReport range={range} />}
        {activeTab === "dana-darurat" && <EmergencyFundReport />}
        {activeTab === "kebutuhan-pokok" && <EssentialExpensesReport range={range} />}
        {activeTab === "pemasukan" && <IncomeReport range={range} />}
      </div>
    </div>
  );
}
