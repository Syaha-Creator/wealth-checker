interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return <div className={`animate-pulse rounded-lg bg-surface-hover ${className}`} aria-hidden="true" />;
}

/** Shaped like a StatCard/summary card — used while dashboard/list data loads. */
export function SkeletonCard({ className = "" }: SkeletonProps) {
  return (
    <div className={`bg-surface rounded-2xl border border-border p-4 ${className}`} aria-hidden="true">
      <Skeleton className="h-3 w-20 mb-3" />
      <Skeleton className="h-6 w-28" />
    </div>
  );
}

export function SkeletonRow({ className = "" }: SkeletonProps) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3.5 ${className}`} aria-hidden="true">
      <Skeleton className="w-9 h-9 rounded-full shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="h-4 w-16 shrink-0" />
    </div>
  );
}

export function SkeletonHero({ className = "" }: SkeletonProps) {
  return (
    <div className={`rounded-2xl p-5 bg-surface-hover ${className}`} aria-hidden="true">
      <Skeleton className="h-3 w-24 mb-3 bg-border" />
      <Skeleton className="h-8 w-40 mb-2 bg-border" />
      <Skeleton className="h-4 w-32 bg-border" />
    </div>
  );
}
