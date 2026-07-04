"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: "danger" | "warning" | "default";
  onConfirm: () => void;
  onCancel: () => void;
  // Medium #12 (bug hunt): busy guard — tanpa ini, klik ganda pada tombol
  // konfirmasi saat aksi (mis. DELETE) masih berjalan bisa memicu request
  // duplikat. Saat `busy`, tombol konfirmasi menampilkan spinner + disabled,
  // dan Batal/Escape/backdrop-click juga dinonaktifkan sampai aksi selesai.
  busy?: boolean;
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Ya, Lanjutkan",
  confirmVariant = "danger",
  onConfirm,
  onCancel,
  busy = false,
}: ConfirmModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerElRef = useRef<Element | null>(null);

  // Focus restoration: remember whatever had focus (the button that opened
  // the dialog) before we steal focus, and give it back once the dialog
  // closes — otherwise keyboard/screen-reader users lose their place.
  useEffect(() => {
    if (open) {
      triggerElRef.current = document.activeElement;
      cancelRef.current?.focus();
    } else if (triggerElRef.current instanceof HTMLElement) {
      triggerElRef.current.focus();
      triggerElRef.current = null;
    }
  }, [open]);

  // Body scroll lock: prevent background content from scrolling behind the
  // modal on mobile while it's open.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (!busy) onCancel();
        return;
      }

      // Focus trap: keep Tab/Shift+Tab cycling within the dialog's focusable
      // elements instead of leaking focus out to the page behind the backdrop.
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const buttonVariant = confirmVariant === "danger" ? "danger" : confirmVariant === "warning" ? "warning" : "primary";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={busy ? undefined : onCancel}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div ref={dialogRef} className="relative bg-surface border border-border rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h2 id="confirm-modal-title" className="text-base font-semibold text-text-primary mb-2">
          {title}
        </h2>
        <p className="text-sm text-text-secondary leading-relaxed mb-6">{message}</p>
        <div className="flex gap-3">
          <Button ref={cancelRef} variant="secondary" onClick={onCancel} disabled={busy} fullWidth>
            Batal
          </Button>
          <Button variant={buttonVariant} onClick={onConfirm} loading={busy} fullWidth>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
