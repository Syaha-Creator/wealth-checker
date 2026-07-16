// Dream Tracker (Fase 3 Sprint 21) — pure function, pola sama dengan
// assetSummary.ts/debtReceivable.ts agar bisa di-unit-test tanpa database.

export interface DreamGoalProgress {
  id: string;
  namaGoal: string;
  accountId: string | null;
  targetNominal: number;
  saldoSaatIni: number;
  persentase: number;
  tercapai: boolean;
  sisaMenujuTarget: number;
  /** true jika goal ter-link ke rekening yang sudah dihapus / tidak di household */
  accountMissing: boolean;
}

/**
 * `saldoSaatIni` sudah ditentukan di route (live dari `accounts.saldoCache`
 * jika `accountId` diisi, kalau tidak dari kolom `saldo_manual`) — di sini
 * murni derivasi angka progress agar unit-testable tanpa database.
 */
export function calculateDreamGoalProgress(
  goal: { id: string; namaGoal: string; accountId: string | null; targetNominal: string | number },
  saldoSaatIni: number,
  options: { accountMissing?: boolean } = {},
): DreamGoalProgress {
  const targetNominal = Number(goal.targetNominal);
  const persentase = targetNominal > 0 ? Math.min(100, Math.round((saldoSaatIni / targetNominal) * 1000) / 10) : 0;

  return {
    id: goal.id,
    namaGoal: goal.namaGoal,
    accountId: goal.accountId,
    targetNominal,
    saldoSaatIni,
    persentase,
    tercapai: saldoSaatIni >= targetNominal && targetNominal > 0,
    sisaMenujuTarget: Math.max(0, targetNominal - saldoSaatIni),
    accountMissing: options.accountMissing ?? false,
  };
}
