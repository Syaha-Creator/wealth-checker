/** Shared tip for the dual write paths: cash-moving transaction vs declaration. */
export function DualPathHint({
  cashLabel,
  declareLabel,
}: {
  cashLabel: string;
  declareLabel: string;
}) {
  return (
    <p className="text-xs text-text-secondary mb-3 rounded-lg border border-border bg-bg px-3 py-2">
      Dua cara mencatat — pilih <span className="font-medium text-text-primary">satu</span>, jangan
      keduanya untuk item yang sama:{" "}
      <span className="font-medium text-text-primary">{cashLabel}</span> mengubah saldo rekening;{" "}
      <span className="font-medium text-text-primary">{declareLabel}</span> hanya mengubah catatan
      kekayaan (tanpa menyentuh kas). Mencampur keduanya = double-count.
    </p>
  );
}
