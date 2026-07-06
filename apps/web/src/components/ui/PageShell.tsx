import type { ReactNode } from "react";

export type PageWidth = "full" | "wide" | "narrow";

const WIDTH_CLASS: Record<PageWidth, string> = {
  full: "w-full",
  wide: "w-full max-w-6xl mx-auto",
  narrow: "w-full max-w-2xl mx-auto",
};

interface PageShellProps {
  width?: PageWidth;
  children: ReactNode;
  className?: string;
}

/**
 * Wrapper lebar halaman konsisten untuk desktop — satu container untuk
 * PageHeader + konten agar tidak ada mismatch header full-width vs body sempit.
 */
export function PageShell({ width = "full", children, className = "" }: PageShellProps) {
  return <div className={`${WIDTH_CLASS[width]} ${className}`}>{children}</div>;
}
