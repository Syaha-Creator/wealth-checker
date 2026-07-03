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

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
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
      <div className="relative bg-surface border border-border rounded-2xl shadow-xl w-full max-w-sm p-6">
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
