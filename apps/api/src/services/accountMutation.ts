// Mutasi Rekening (Fase 2 Sprint 15) — pure function, pola sama dengan
// debtReceivable.ts/assetSummary.ts agar bisa di-unit-test tanpa database.
//
// CATATAN DESAIN: tabel `accounts` hanya menyimpan `saldoCache` (saldo saat
// ini), bukan `saldoAwal` historis. Saldo awal untuk histori mutasi diturunkan
// (derive) dari `saldoCache saat ini - total seluruh delta transaksi` — bukan
// dibaca dari kolom terpisah. `konsisten` di bawah pada dasarnya selalu true
// by construction (saldoAwal diturunkan justru agar total delta pas kembali
// ke saldoCache) — flag ini murni untuk mendeteksi bug logika di deltaFor()
// sendiri (mis. transaksi non-uang yang salah ikut terhitung), bukan mendeteksi
// anomali data eksternal.

const DEBIT_TYPES = new Set([
  "pengeluaran", "bayar_utang", "pemberian_piutang",
  "beli_barang", "beli_investasi", "transfer",
]);
const CREDIT_TYPES = new Set([
  "pendapatan", "pinjaman_utang", "penerimaan_piutang",
  "jual_barang", "jual_investasi",
]);

export interface MutationTransaction {
  id: string;
  tanggal: string;
  createdAt: string | Date;
  type: string;
  kategori: string | null;
  rincian: string | null;
  nominal: string | number;
  accountId: string | null;
  // Untuk type === "transfer", rekening tujuan disimpan di kolom polymorphic
  // `relatedEntityId` (BUKAN kolom `toAccountId` terpisah — lihat
  // packages/db/src/schema/transactions.ts). Untuk tipe lain, relatedEntityId
  // menunjuk ke entitas lain (debt/receivable/asset id) dan diabaikan di sini.
  relatedEntityId: string | null;
}

export interface MutationRow {
  id: string;
  tanggal: string;
  type: string;
  kategori: string | null;
  rincian: string | null;
  nominal: number;
  delta: number;
  saldoSetelah: number;
}

/**
 * Delta ke rekening `accountId` untuk satu transaksi. 0 jika transaksi ini
 * tidak menyentuh rekening tersebut sama sekali (harusnya tidak pernah terjadi
 * kalau caller sudah memfilter dengan benar, tapi tetap aman/predictable).
 */
function deltaFor(accountId: string, t: MutationTransaction): number {
  const nominal = Number(t.nominal);
  if (t.accountId === accountId) {
    return DEBIT_TYPES.has(t.type) ? -nominal : CREDIT_TYPES.has(t.type) ? nominal : 0;
  }
  if (t.type === "transfer" && t.relatedEntityId === accountId) {
    return nominal; // transfer masuk ke rekening ini
  }
  return 0;
}

export interface AccountMutationResult {
  rows: MutationRow[]; // urut kronologis menaik (tanggal lama → baru)
  saldoAwalTurunan: number;
  saldoAkhir: number;
  konsisten: boolean; // saldoAkhir hasil kalkulasi === saldoCache saat ini
}

export function calculateAccountMutations(
  accountId: string,
  saldoCacheSaatIni: number,
  transaksi: MutationTransaction[],
): AccountMutationResult {
  const totalDelta = transaksi.reduce((s, t) => s + deltaFor(accountId, t), 0);
  const saldoAwalTurunan = saldoCacheSaatIni - totalDelta;

  const sorted = [...transaksi].sort((a, b) => {
    if (a.tanggal !== b.tanggal) return a.tanggal < b.tanggal ? -1 : 1;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  let saldo = saldoAwalTurunan;
  const rows: MutationRow[] = sorted.map((t) => {
    const nominal = Number(t.nominal);
    const delta = deltaFor(accountId, t);
    saldo += delta;
    return { id: t.id, tanggal: t.tanggal, type: t.type, kategori: t.kategori, rincian: t.rincian, nominal, delta, saldoSetelah: saldo };
  });

  return {
    rows,
    saldoAwalTurunan,
    saldoAkhir: saldo,
    // Toleransi kecil untuk floating-point drift (lihat catatan desain LOW di plan bug hunt)
    konsisten: Math.abs(saldo - saldoCacheSaatIni) < 0.01,
  };
}
