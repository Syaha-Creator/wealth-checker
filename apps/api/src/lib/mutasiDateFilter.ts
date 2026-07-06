import type { MutationRow } from "../services/accountMutation";

function isInRange(tanggal: string, from?: string, to?: string): boolean {
  if (from && tanggal < from) return false;
  if (to && tanggal > to) return false;
  return true;
}

/**
 * Post-filter mutasi setelah calculateAccountMutations() — running balance
 * (`saldoSetelah`) tetap dari histori lengkap; hanya baris di luar rentang
 * yang di-drop dari response.
 */
export function applyMutasiDateFilter(
  allRows: MutationRow[],
  saldoAwalTurunan: number,
  from?: string,
  to?: string,
): { filteredRows: MutationRow[]; saldoSebelumPeriode: number } {
  if (!from && !to) {
    return { filteredRows: allRows, saldoSebelumPeriode: saldoAwalTurunan };
  }

  let firstInRangeIndex = -1;
  for (let i = 0; i < allRows.length; i++) {
    if (isInRange(allRows[i].tanggal, from, to)) {
      firstInRangeIndex = i;
      break;
    }
  }

  const filteredRows = allRows.filter((row) => isInRange(row.tanggal, from, to));

  let saldoSebelumPeriode: number;
  if (firstInRangeIndex === -1) {
    // Tidak ada baris dalam rentang — saldo di awal periode kosong: jika `from`
    // setelah seluruh histori, pakai saldoSetelah transaksi terakhir; selain itu
    // fallback ke saldoAwalTurunan (mis. `to` sebelum transaksi pertama).
    if (from && allRows.length > 0 && allRows.every((r) => r.tanggal < from)) {
      saldoSebelumPeriode = allRows[allRows.length - 1].saldoSetelah;
    } else {
      saldoSebelumPeriode = saldoAwalTurunan;
    }
  } else if (firstInRangeIndex === 0) {
    saldoSebelumPeriode = saldoAwalTurunan;
  } else {
    saldoSebelumPeriode = allRows[firstInRangeIndex - 1].saldoSetelah;
  }

  return { filteredRows, saldoSebelumPeriode };
}
