import type { MutationRow } from "../services/accountMutation";

function isInRange(tanggal: string, from?: string, to?: string): boolean {
  if (from && tanggal < from) return false;
  if (to && tanggal > to) return false;
  return true;
}

function lastSaldoSetelahBefore(allRows: MutationRow[], beforeDate: string, saldoAwalTurunan: number): number {
  let saldo = saldoAwalTurunan;
  for (const row of allRows) {
    if (row.tanggal < beforeDate) {
      saldo = row.saldoSetelah;
    }
  }
  return saldo;
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
  saldoCache?: number,
): { filteredRows: MutationRow[]; saldoSebelumPeriode: number } {
  if (!from && !to) {
    return { filteredRows: allRows, saldoSebelumPeriode: saldoAwalTurunan };
  }

  const filteredRows = allRows.filter((row) => isInRange(row.tanggal, from, to));

  if (filteredRows.length === 0) {
    if (allRows.length === 0) {
      return { filteredRows, saldoSebelumPeriode: saldoAwalTurunan };
    }

    const firstTxDate = allRows[0].tanggal;
    const lastTxDate = allRows[allRows.length - 1].tanggal;
    const rangeStart = from ?? to!;
    const rangeEnd = to ?? from!;

    // 1. Rentang seluruhnya sebelum transaksi pertama
    if (rangeEnd < firstTxDate) {
      return { filteredRows, saldoSebelumPeriode: saldoAwalTurunan };
    }

    // 3. Rentang seluruhnya setelah transaksi terakhir
    if (rangeStart > lastTxDate) {
      return {
        filteredRows,
        saldoSebelumPeriode: saldoCache ?? allRows[allRows.length - 1].saldoSetelah,
      };
    }

    // 2. Celah antar transaksi — saldoSetelah tx terakhir sebelum `from`
    const anchor = from ?? rangeStart;
    return {
      filteredRows,
      saldoSebelumPeriode: lastSaldoSetelahBefore(allRows, anchor, saldoAwalTurunan),
    };
  }

  const firstInRangeIndex = allRows.findIndex((row) => isInRange(row.tanggal, from, to));
  const saldoSebelumPeriode =
    firstInRangeIndex === 0
      ? saldoAwalTurunan
      : allRows[firstInRangeIndex - 1].saldoSetelah;

  return { filteredRows, saldoSebelumPeriode };
}
