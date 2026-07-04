"use client";

export interface TabItem<T extends string> {
  id: T;
  label: string;
}

interface TabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  idPrefix: string;
  "aria-label": string;
  // Equal-width segmented control (best for 2-3 short items, e.g. Utang/Piutang)
  // vs. a horizontally-scrollable pill row (best for many/longer labels, e.g.
  // the 6 Analytics sub-reports). Both share the same visual "track" chrome so
  // the app has one tab language instead of several.
  fitted?: boolean;
  className?: string;
}

export function tabButtonId(idPrefix: string, tabId: string) {
  return `${idPrefix}-tab-${tabId}`;
}

export function tabPanelId(idPrefix: string, tabId: string) {
  return `${idPrefix}-panel-${tabId}`;
}

// Shared tab-bar component: unifies the previously divergent "pill with
// horizontal scroll" (Analytics) and "segmented control" (Debts/Assets)
// visual styles into a single component, and wires up aria-controls /
// aria-labelledby between each tab button and its panel (use `tabPanelId` /
// `tabButtonId` on the corresponding `role="tabpanel"` element).
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  idPrefix,
  "aria-label": ariaLabel,
  fitted = false,
  className = "",
}: TabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`flex gap-1 p-1 bg-surface-hover rounded-xl overflow-x-auto ${fitted ? "" : "-mx-1 px-1"} ${className}`}
    >
      {items.map((item) => {
        const selected = value === item.id;
        return (
          <button
            key={item.id}
            id={tabButtonId(idPrefix, item.id)}
            role="tab"
            type="button"
            aria-selected={selected}
            aria-controls={tabPanelId(idPrefix, item.id)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            className={`${fitted ? "flex-1" : "shrink-0"} px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              selected ? "bg-surface text-text-primary shadow-sm" : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
