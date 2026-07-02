// Moving Average Cost Engine — Fase 2 Sprint 10.
// Dipakai oleh transaksi beli/jual barang (fixed_assets) dan investasi
// (liquid_assets) untuk menghitung harga_beli_rata_rata berjalan dan
// untung/rugi saat jual, mengikuti pseudocode PRD Bagian 5.3.

/**
 * Hitung harga beli rata-rata (weighted average cost) setelah pembelian baru.
 *
 * new_avg = ((existing_qty × existing_avg) + (new_qty × new_price)) / (existing_qty + new_qty)
 */
export function calculateMovingAverageCost(
  existingQty: number,
  existingAvgCost: number,
  newQty: number,
  newPrice: number,
): number {
  const totalQty = existingQty + newQty;
  // Tidak seharusnya terjadi (beli selalu newQty > 0), tapi hindari division by zero
  if (totalQty === 0) return 0;
  return ((existingQty * existingAvgCost) + (newQty * newPrice)) / totalQty;
}

/**
 * Hitung untung/rugi dari penjualan sebagian/seluruh aset.
 *
 * profit_loss = (sell_price - current_avg_cost) × sell_qty
 */
export function calculateProfitLoss(
  sellQty: number,
  sellPrice: number,
  currentAvgCost: number,
): number {
  return (sellPrice - currentAvgCost) * sellQty;
}

/**
 * Guard: tidak bisa jual lebih dari jumlah yang dimiliki saat ini.
 */
export function canSell(ownedQty: number, sellQty: number): { allowed: boolean; error?: string } {
  if (sellQty > ownedQty) {
    return {
      allowed: false,
      error: `Jumlah tidak mencukupi. Dimiliki: ${ownedQty}, diminta: ${sellQty}`,
    };
  }
  return { allowed: true };
}

/**
 * Hitung state aset (jumlah + avg cost) setelah sebuah penjualan.
 * Jual semua (remainingQty ~ 0) me-reset avg_cost ke 0 — tidak ada lagi
 * holding untuk dijadikan basis harga rata-rata berikutnya.
 */
export function applySale(
  ownedQty: number,
  ownedAvgCost: number,
  sellQty: number,
): { remainingQty: number; avgCost: number } {
  const remainingQty = ownedQty - sellQty;
  // Toleransi floating point kecil dianggap 0 (mis. 0.30000000000000004)
  const isFullySold = Math.abs(remainingQty) < 1e-9;
  return {
    remainingQty: isFullySold ? 0 : remainingQty,
    avgCost: isFullySold ? 0 : ownedAvgCost,
  };
}
