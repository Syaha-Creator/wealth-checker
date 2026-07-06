/** Mock dashboard card for the landing hero — pure CSS, no screenshots. */
export function DashboardPreview() {
  return (
    <div className="relative w-full max-w-md mx-auto lg:mx-0 lg:max-w-none">
      <div
        className="absolute -inset-4 rounded-3xl bg-brand/10 blur-2xl"
        aria-hidden="true"
      />
      <div className="relative bg-surface border border-border rounded-2xl shadow-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <p className="text-xs text-text-muted">Kekayaan Bersih</p>
            <p className="text-2xl font-bold text-text-primary mt-0.5">Rp 248,5 jt</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-brand-soft text-brand border border-brand-soft-border">
            Level 4
          </span>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-brand-soft rounded-xl p-3 border border-brand-soft-border">
              <p className="text-[11px] text-brand font-medium">Pemasukan</p>
              <p className="text-sm font-bold text-brand mt-1">+Rp 12,4 jt</p>
            </div>
            <div className="bg-danger-soft rounded-xl p-3 border border-danger-soft-border">
              <p className="text-[11px] text-danger-text font-medium">Pengeluaran</p>
              <p className="text-sm font-bold text-danger-text mt-1">-Rp 8,1 jt</p>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs text-text-muted mb-2">
              <span>Progress Level 4 → 5</span>
              <span>68%</span>
            </div>
            <div className="h-2 bg-surface-hover rounded-full overflow-hidden" role="presentation">
              <div className="h-full w-[68%] bg-brand rounded-full" />
            </div>
          </div>

          <div className="space-y-2">
            {[
              { label: "BCA Tabungan", amount: "Rp 42,0 jt", color: "text-brand" },
              { label: "Reksadana", amount: "Rp 85,5 jt", color: "text-info-text" },
              { label: "Utang KPR", amount: "Rp 120,0 jt", color: "text-danger-text" },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                <span className="text-text-secondary truncate">{row.label}</span>
                <span className={`font-semibold shrink-0 ml-2 ${row.color}`}>{row.amount}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
