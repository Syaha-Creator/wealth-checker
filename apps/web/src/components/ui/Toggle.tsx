"use client";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  id?: string;
}

export function Toggle({ checked, onChange, label, disabled, id }: ToggleProps) {
  const labelId = id ? `${id}-label` : undefined;

  return (
    <div className={`inline-flex items-center gap-2.5 ${disabled ? "opacity-60" : ""}`}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={label ? labelId : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 ${
          disabled ? "cursor-not-allowed" : "cursor-pointer"
        } ${checked ? "bg-brand" : "bg-border"}`}
      >
        <span
          className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
      {label && (
        <span
          id={labelId}
          className={`text-sm font-medium text-text-secondary ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
          onClick={() => {
            if (!disabled) onChange(!checked);
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
