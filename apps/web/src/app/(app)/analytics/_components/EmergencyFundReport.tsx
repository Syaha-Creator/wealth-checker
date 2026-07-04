"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";
import { ReportSkeleton, ReportError, ReportEmpty } from "./ReportStates";

interface EmergencyFundResponse {
  danaDarurat: number;
  status: "cukup" | "belum_cukup";
  bulanTertanggung: number | null;
}

/** Sprint 18 — sub-laporan 3.6.4: Dana Darurat. Tidak bergantung pada filter tanggal (snapshot kondisi saat ini). */
export function EmergencyFundReport() {
  const { data, loading, error, reload } = useApiResource<EmergencyFundResponse>("/api/analytics/emergency-fund");

  if (loading) return <ReportSkeleton lines={1} />;
  if (error) return <ReportError message={error} onRetry={reload} />;
  if (!data) return <ReportEmpty />;

  const cukup = data.status === "cukup";

  return (
    <Card className={cukup ? "bg-brand text-white" : "bg-danger text-white"} padding="lg">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-white/70 text-sm">Dana Darurat</p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(data.danaDarurat)}</p>
        </div>
        <Badge variant={cukup ? "success" : "danger"} className="!bg-white/20 !text-white !border-white/20">
          {cukup ? "Cukup" : "Belum Cukup"}
        </Badge>
      </div>
      <p className="text-sm text-white/80 mt-3">
        {data.bulanTertanggung === null
          ? "Belum ada data rencana pengeluaran bulanan untuk menghitung daya tahan dana darurat."
          : data.bulanTertanggung >= 0
          ? `Dana ini bisa menanggung sekitar ${data.bulanTertanggung} bulan pengeluaran.`
          : "Dana darurat masih minus — utang melebihi uang likuid yang tersedia."}
      </p>
    </Card>
  );
}
