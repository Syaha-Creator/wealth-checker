"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageShell } from "@/components/ui/PageShell";
import { DateRangeFilter } from "@/components/ui/DateRangeFilter";
import { Tabs, tabPanelId, tabButtonId } from "@/components/ui/Tabs";
import { ExportButtons } from "@/components/ExportButtons";
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
const TABS_ID_PREFIX = "analytics";

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("kekayaan-bersih");
  const [range, setRange] = useState<DateRange>(() => computePresetRange("3-bulan"));

  const activeTabMeta = TABS.find((t) => t.id === activeTab)!;

  return (
    <PageShell width="wide">
      <PageHeader title="Analisa" subtitle="Pantau kesehatan keuanganmu dari berbagai sudut" />

      <ExportButtons range={range} className="mb-4" />

      <Tabs
        items={TABS}
        value={activeTab}
        onChange={setActiveTab}
        idPrefix={TABS_ID_PREFIX}
        aria-label="Sub-laporan Analisa"
        className="mb-4"
      />

      {activeTabMeta.needsDateFilter ? (
        <DateRangeFilter value={range} onChange={setRange} className="mb-4" />
      ) : (
        <p className="text-xs text-text-muted mb-4">Dana darurat dihitung dari kondisi keuanganmu saat ini, tidak bergantung pada filter tanggal.</p>
      )}

      <div
        role="tabpanel"
        id={tabPanelId(TABS_ID_PREFIX, activeTab)}
        aria-labelledby={tabButtonId(TABS_ID_PREFIX, activeTab)}
        tabIndex={0}
      >
        {activeTab === "kekayaan-bersih" && <WealthHistoryReport range={range} />}
        {activeTab === "laba-rugi" && <MonthlyPLReport range={range} />}
        {activeTab === "budgeting" && <BudgetVsActualReport range={range} />}
        {activeTab === "dana-darurat" && <EmergencyFundReport />}
        {activeTab === "kebutuhan-pokok" && <EssentialExpensesReport range={range} />}
        {activeTab === "pemasukan" && <IncomeReport range={range} />}
      </div>
    </PageShell>
  );
}
