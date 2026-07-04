// Shared between transactions.ts (POST/PATCH/DELETE balance effects) and
// accountMutation.ts (mutasi rekening running-balance derivation) — bug hunt
// Low #2: these two sets used to be duplicated verbatim in both files with no
// shared source of truth. A future transaction type added to one but not the
// other would silently desync the mutasi running-balance math from the actual
// balance effects applied by the transactions routes, with no compiler/test
// signal to catch the drift.

/** Transaction types that deduct from the source account (`accountId`). */
export const DEBIT_TYPES = new Set([
  "pengeluaran", "bayar_utang", "pemberian_piutang",
  "beli_barang", "beli_investasi", "transfer",
]);

/** Transaction types that add to the source account (`accountId`). */
export const CREDIT_TYPES = new Set([
  "pendapatan", "pinjaman_utang", "penerimaan_piutang",
  "jual_barang", "jual_investasi",
]);
