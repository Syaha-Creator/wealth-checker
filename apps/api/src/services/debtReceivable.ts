// Logika bisnis Utang & Piutang (Fase 2 Sprint 8 & 9) yang diekstrak sebagai
// pure function agar bisa di-unit-test tanpa database — pola yang sama dengan
// calculateWealthLevel di wealth.ts.

export interface GuardResult {
  allowed: boolean;
  error?: string;
}

/** Guard: cicilan tidak boleh melebihi sisa saldo utang. */
export function canPayDebt(sisaSaldo: number, nominal: number): GuardResult {
  if (nominal > sisaSaldo) {
    return {
      allowed: false,
      error: `Nominal cicilan melebihi sisa utang. Sisa utang: Rp ${sisaSaldo.toLocaleString("id-ID")}`,
    };
  }
  return { allowed: true };
}

/** Guard: penerimaan pembayaran tidak boleh melebihi sisa piutang. */
export function canReceiveReceivable(sisaSaldo: number, nominal: number): GuardResult {
  if (nominal > sisaSaldo) {
    return {
      allowed: false,
      error: `Nominal penerimaan melebihi sisa piutang. Sisa piutang: Rp ${sisaSaldo.toLocaleString("id-ID")}`,
    };
  }
  return { allowed: true };
}

interface DebtRow {
  id: string;
  pemberiUtang: string;
  tipe: string;
  saldoAwal: string | number;
  sisaSaldo: string | number;
}

export interface DebtSummaryItem {
  id: string;
  pemberiUtang: string;
  tipe: string;
  totalPinjaman: number;
  totalTerbayar: number;
  sisaSaldo: number;
  progressPercent: number;
  lunas: boolean;
}

export interface DebtSummary {
  totalPinjaman: number;
  totalTerbayar: number;
  totalSisaSaldo: number;
  progressPercent: number;
  perPemberi: DebtSummaryItem[];
}

function progressOf(paid: number, total: number): number {
  return total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
}

/** Ringkasan "Pemberi Utang vs Sisa Utang" — menggantikan tabel ringkasan di sheet asli. */
export function calculateDebtSummary(rows: DebtRow[]): DebtSummary {
  const perPemberi: DebtSummaryItem[] = rows.map((d) => {
    const saldoAwal = Number(d.saldoAwal);
    const sisaSaldo = Number(d.sisaSaldo);
    const totalTerbayar = saldoAwal - sisaSaldo;
    return {
      id: d.id,
      pemberiUtang: d.pemberiUtang,
      tipe: d.tipe,
      totalPinjaman: saldoAwal,
      totalTerbayar,
      sisaSaldo,
      progressPercent: progressOf(totalTerbayar, saldoAwal),
      lunas: sisaSaldo <= 0,
    };
  }).sort((a, b) => b.sisaSaldo - a.sisaSaldo);

  const totalPinjaman = perPemberi.reduce((s, d) => s + d.totalPinjaman, 0);
  const totalTerbayar = perPemberi.reduce((s, d) => s + d.totalTerbayar, 0);
  const totalSisaSaldo = perPemberi.reduce((s, d) => s + d.sisaSaldo, 0);

  return {
    totalPinjaman,
    totalTerbayar,
    totalSisaSaldo,
    progressPercent: progressOf(totalTerbayar, totalPinjaman),
    perPemberi,
  };
}

interface ReceivableRow {
  id: string;
  peminjam: string;
  saldoAwal: string | number;
  sisaSaldo: string | number;
}

export interface ReceivableSummaryItem {
  id: string;
  peminjam: string;
  totalDipinjamkan: number;
  totalDiterima: number;
  sisaSaldo: number;
  progressPercent: number;
  lunas: boolean;
}

export interface ReceivableSummary {
  totalDipinjamkan: number;
  totalDiterima: number;
  totalSisaSaldo: number;
  progressPercent: number;
  perPeminjam: ReceivableSummaryItem[];
}

/** Ringkasan "Peminjam vs Sisa Piutang" — menggantikan tabel ringkasan di sheet asli. */
export function calculateReceivableSummary(rows: ReceivableRow[]): ReceivableSummary {
  const perPeminjam: ReceivableSummaryItem[] = rows.map((r) => {
    const saldoAwal = Number(r.saldoAwal);
    const sisaSaldo = Number(r.sisaSaldo);
    const totalDiterima = saldoAwal - sisaSaldo;
    return {
      id: r.id,
      peminjam: r.peminjam,
      totalDipinjamkan: saldoAwal,
      totalDiterima,
      sisaSaldo,
      progressPercent: progressOf(totalDiterima, saldoAwal),
      lunas: sisaSaldo <= 0,
    };
  }).sort((a, b) => b.sisaSaldo - a.sisaSaldo);

  const totalDipinjamkan = perPeminjam.reduce((s, r) => s + r.totalDipinjamkan, 0);
  const totalDiterima = perPeminjam.reduce((s, r) => s + r.totalDiterima, 0);
  const totalSisaSaldo = perPeminjam.reduce((s, r) => s + r.sisaSaldo, 0);

  return {
    totalDipinjamkan,
    totalDiterima,
    totalSisaSaldo,
    progressPercent: progressOf(totalDiterima, totalDipinjamkan),
    perPeminjam,
  };
}
