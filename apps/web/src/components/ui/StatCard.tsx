import type { ReactNode } from "react";

type Tone = "neutral" | "brand" | "danger" | "warning" | "info";

const toneText: Record<Tone, string> = {
  neutral: "text-text-primary",
  brand: "text-brand",
  danger: "text-danger-text",
  warning: "text-warning-text",
  info: "text-info-text",
};

const toneBg: Record<Tone, string> = {
  neutral: "bg-surface-hover text-text-secondary",
  brand: "bg-brand-soft text-brand",
  danger: "bg-danger-soft text-danger-text",
  warning: "bg-warning-soft text-warning-text",
  info: "bg-info-soft text-info-text",
};

interface StatCardProps {
  label: string;
  value: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
  trend?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function StatCard({ label, value, tone = "neutral", icon, trend, footer, className = "" }: StatCardProps) {
  return (
    <div className={`bg-surface rounded-2xl border border-border p-4 ${className}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-muted font-medium">{label}</p>
        {icon && (
          <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${toneBg[tone]}`} aria-hidden="true">
            {icon}
          </span>
        )}
      </div>
      <p className={`text-lg font-bold mt-1.5 ${toneText[tone]}`}>{value}</p>
      {trend && <div className="mt-1">{trend}</div>}
      {footer && <div className="mt-2 pt-2 border-t border-border/60">{footer}</div>}
    </div>
  );
}
