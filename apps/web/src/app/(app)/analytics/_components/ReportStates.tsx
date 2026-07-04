import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

/** Skeleton loader seragam untuk tiap kartu sub-laporan Analisa (Sprint 20). */
export function ReportSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-32 w-full rounded-xl" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-4 w-full" />
      ))}
    </div>
  );
}

export function ReportError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="text-center py-6" role="alert">
      <p className="text-sm text-danger-text mb-3">{message}</p>
      <Button variant="secondary" size="sm" onClick={onRetry}>Coba Lagi</Button>
    </div>
  );
}

function EmptyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path d="M3 3v18h18" />
      <path d="M7 14l4-4 3 3 5-6" />
    </svg>
  );
}

export function ReportEmpty({ description = "Coba ubah rentang tanggal atau catat transaksi terlebih dahulu." }: { description?: string }) {
  return (
    <EmptyState
      icon={<EmptyIcon />}
      title="Belum ada data di rentang tanggal ini"
      description={description}
    />
  );
}
