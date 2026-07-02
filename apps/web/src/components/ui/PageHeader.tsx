import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  onBack?: () => void;
  className?: string;
}

function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export function PageHeader({ title, subtitle, action, onBack, className = "" }: PageHeaderProps) {
  return (
    <div className={`flex items-center justify-between gap-3 mb-6 ${className}`}>
      <div className="flex items-center gap-2 min-w-0">
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Kembali"
            className="p-2 -ml-2 text-text-muted hover:text-text-primary rounded-lg hover:bg-surface-hover transition-colors shrink-0"
          >
            <BackIcon />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-text-primary truncate">{title}</h1>
          {subtitle && <p className="text-sm text-text-muted mt-0.5 truncate">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
