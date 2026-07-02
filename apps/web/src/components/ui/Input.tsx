import { forwardRef, useState } from "react";
import type { InputHTMLAttributes, SelectHTMLAttributes, ReactNode } from "react";
import { formatRupiahInput } from "@/lib/format";

// Consistent "wajib diisi" indicator — reuse everywhere a required field's
// label is rendered, so the marker stays visually identical across forms.
export function RequiredMark() {
  return (
    <span className="text-danger ml-0.5" aria-hidden="true">
      *
    </span>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  endAdornment?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, id, className = "", required, endAdornment, ...rest },
  ref
) {
  return (
    <div>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-text-secondary mb-1">
          {label}
          {required && <RequiredMark />}
        </label>
      )}
      <div className="relative">
        <input
          ref={ref}
          id={id}
          required={required}
          className={`w-full px-3 py-2.5 ${endAdornment ? "pr-10" : ""} bg-surface border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand/30 transition-shadow ${
            error ? "border-danger" : "border-border"
          } ${className}`}
          {...rest}
        />
        {endAdornment && (
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2">{endAdornment}</div>
        )}
      </div>
      {hint && !error && <p className="text-xs text-text-muted mt-1">{hint}</p>}
      {error && <p className="text-xs text-danger-text mt-1">{error}</p>}
    </div>
  );
});

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.94 10.94 0 0112 20c-7 0-11-8-11-8a20.3 20.3 0 015.06-6.06M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a20.36 20.36 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

type PasswordInputProps = Omit<InputProps, "type" | "endAdornment">;

// Wraps Input with a show/hide toggle — reuses the same endAdornment slot
// so password fields stay visually consistent with other inputs.
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  props,
  ref
) {
  const [visible, setVisible] = useState(false);
  return (
    <Input
      ref={ref}
      type={visible ? "text" : "password"}
      endAdornment={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Sembunyikan password" : "Tampilkan password"}
          className="p-1.5 text-text-muted hover:text-text-secondary transition-colors rounded-md"
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      }
      {...props}
    />
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
          {required && <RequiredMark />}
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
          {required && <RequiredMark />}
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
