import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className = "" }: EmptyStateProps) {
  return (
    <div className={`text-center py-12 px-4 ${className}`}>
      {icon && (
        <div className="w-12 h-12 mx-auto mb-3 flex items-center justify-center rounded-full bg-surface-hover text-text-muted" aria-hidden="true">
          {icon}
        </div>
      )}
      <p className="text-sm font-medium text-text-secondary">{title}</p>
      {description && <p className="text-xs text-text-muted mt-1 max-w-xs mx-auto">{description}</p>}
      {action && <div className="mt-4 inline-flex">{action}</div>}
    </div>
  );
}
