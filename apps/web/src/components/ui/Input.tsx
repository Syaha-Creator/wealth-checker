import { forwardRef } from "react";
import type { InputHTMLAttributes, SelectHTMLAttributes, ReactNode } from "react";
import { formatRupiahInput } from "@/lib/format";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, id, className = "", required, ...rest },
  ref
) {
  return (
    <div>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-text-secondary mb-1">
          {label}
          {required && <span className="text-danger ml-0.5" aria-hidden="true">*</span>}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        required={required}
        className={`w-full px-3 py-2.5 bg-surface border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand/30 transition-shadow ${
          error ? "border-danger" : "border-border"
        } ${className}`}
        {...rest}
      />
      {hint && !error && <p className="text-xs text-text-muted mt-1">{hint}</p>}
      {error && <p className="text-xs text-danger-text mt-1">{error}</p>}
    </div>
  );
});

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  children?: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, id, className = "", children, required, ...rest },
  ref
) {
  return (
    <div>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-text-secondary mb-1">
          {label}
          {required && <span className="text-danger ml-0.5" aria-hidden="true">*</span>}
        </label>
      )}
      <select
        ref={ref}
        id={id}
        required={required}
        className={`w-full px-3 py-2.5 bg-surface border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/30 transition-shadow ${
          error ? "border-danger" : "border-border"
        } ${className}`}
        {...rest}
      >
        {children}
      </select>
    </div>
  );
});

interface InputRupiahProps {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  id?: string;
  hint?: string;
  error?: string;
}

export function InputRupiah({ label, value, onChange, placeholder, required, id, hint, error }: InputRupiahProps) {
  return (
    <div>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-text-secondary mb-1">
          {label}
          {required && <span className="text-danger ml-0.5" aria-hidden="true">*</span>}
        </label>
      )}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm" aria-hidden="true">Rp</span>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          className={`w-full pl-10 pr-3 py-2.5 bg-surface border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand/30 transition-shadow ${
            error ? "border-danger" : "border-border"
          }`}
          placeholder={placeholder ?? "0"}
          value={value}
          onChange={(e) => onChange(formatRupiahInput(e.target.value))}
          required={required}
        />
      </div>
      {hint && !error && <p className="text-xs text-text-muted mt-1">{hint}</p>}
      {error && <p className="text-xs text-danger-text mt-1">{error}</p>}
    </div>
  );
}
