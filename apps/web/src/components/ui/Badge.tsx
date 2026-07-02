import type { ReactNode } from "react";

type Variant = "neutral" | "brand" | "danger" | "warning" | "info" | "success";

const variants: Record<Variant, string> = {
  neutral: "bg-surface-hover text-text-secondary border border-border",
  brand: "bg-brand-soft text-brand border border-brand-soft-border",
  danger: "bg-danger-soft text-danger-text border border-danger-soft-border",
  warning: "bg-warning-soft text-warning-text border border-warning-soft-border",
  info: "bg-info-soft text-info-text border border-info-soft-border",
  success: "bg-brand-soft text-brand border border-brand-soft-border",
};

interface BadgeProps {
  variant?: Variant;
  children: ReactNode;
  className?: string;
}

export function Badge({ variant = "neutral", children, className = "" }: BadgeProps) {
  return (
    <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}
