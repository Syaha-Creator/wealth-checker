import { describe, it, expect } from "vitest";
import { calculateAccountMutations } from "./accountMutation";

const ACC = "acc-1";
const OTHER_ACC = "acc-2";

function tx(overrides: Partial<{
  id: string; tanggal: string; createdAt: string; type: string;
  kategori: string | null; rincian: string | null; nominal: string | number;
  accountId: string | null; relatedEntityId: string | null;
}>) {
  return {
    id: "tx-1", tanggal: "2026-01-01", createdAt: "2026-01-01T00:00:00Z", type: "pendapatan",
    kategori: null, rincian: null, nominal: "0", accountId: ACC, relatedEntityId: null,
    ...overrides,
  };
}

describe("calculateAccountMutations (Sprint 15 — Mutasi Rekening)", () => {
  it("pendapatan (credit) menambah saldo, pengeluaran (debit) mengurangi saldo", () => {
    const result = calculateAccountMutations(ACC, 150_000, [
      tx({ id: "t1", tanggal: "2026-01-01", type: "pendapatan", nominal: "100000" }),
      tx({ id: "t2", tanggal: "2026-01-02", type: "pengeluaran", nominal: "50000" }),
    ]);
    // Saldo naik 100rb lalu turun 50rb → total delta +50rb, saldo awal turunan = 150rb - 50rb = 100rb
    expect(result.saldoAwalTurunan).toBe(100_000);
    expect(result.rows[0].saldoSetelah).toBe(200_000); // 100rb + 100rb pendapatan
    expect(result.rows[1].saldoSetelah).toBe(150_000); // 200rb - 50rb pengeluaran
    expect(result.saldoAkhir).toBe(150_000);
    expect(result.konsisten).toBe(true);
  });

  it("transfer keluar (accountId = rekening ini) mengurangi saldo", () => {
    const result = calculateAccountMutations(ACC, 50_000, [
      tx({ id: "t1", type: "transfer", nominal: "50000", accountId: ACC, relatedEntityId: OTHER_ACC }),
    ]);
    expect(result.rows[0].delta).toBe(-50_000);
    expect(result.saldoAwalTurunan).toBe(100_000);
  });

  it("transfer masuk (relatedEntityId = rekening ini, tipe transfer) menambah saldo", () => {
    const result = calculateAccountMutations(ACC, 150_000, [
      tx({ id: "t1", type: "transfer", nominal: "50000", accountId: OTHER_ACC, relatedEntityId: ACC }),
    ]);
    expect(result.rows[0].delta).toBe(50_000);
    expect(result.saldoAwalTurunan).toBe(100_000);
  });

  it("relatedEntityId cocok tapi type BUKAN transfer (mis. bayar_utang → id utang) tidak dihitung sebagai transfer masuk", () => {
    const result = calculateAccountMutations(ACC, 100_000, [
      tx({ id: "t1", type: "bayar_utang", nominal: "50000", accountId: OTHER_ACC, relatedEntityId: ACC }),
    ]);
    expect(result.rows[0].delta).toBe(0);
  });

  it("bayar_utang & pemberian_piutang (debit) mengurangi saldo; pinjaman_utang & penerimaan_piutang (credit) menambah", () => {
    const result = calculateAccountMutations(ACC, 100_000, [
      tx({ id: "t1", tanggal: "2026-01-01", type: "pinjaman_utang", nominal: "200000" }),
      tx({ id: "t2", tanggal: "2026-01-02", type: "bayar_utang", nominal: "80000" }),
      tx({ id: "t3", tanggal: "2026-01-03", type: "pemberian_piutang", nominal: "30000" }),
      tx({ id: "t4", tanggal: "2026-01-04", type: "penerimaan_piutang", nominal: "10000" }),
    ]);
    expect(result.rows.map((r) => r.delta)).toEqual([200_000, -80_000, -30_000, 10_000]);
    expect(result.saldoAkhir).toBe(100_000);
    expect(result.konsisten).toBe(true);
  });

  it("beli_investasi/beli_barang (debit) mengurangi saldo; jual_investasi/jual_barang (credit) menambah", () => {
    const result = calculateAccountMutations(ACC, 500_000, [
      tx({ id: "t1", tanggal: "2026-01-01", type: "beli_investasi", nominal: "300000" }),
      tx({ id: "t2", tanggal: "2026-01-02", type: "jual_investasi", nominal: "400000" }),
    ]);
    expect(result.rows.map((r) => r.delta)).toEqual([-300_000, 400_000]);
  });

  it("transaksi diurutkan kronologis menaik (tanggal lama → baru) walau input tidak berurutan", () => {
    const result = calculateAccountMutations(ACC, 100, [
      tx({ id: "t3", tanggal: "2026-03-01", nominal: "0" }),
      tx({ id: "t1", tanggal: "2026-01-01", nominal: "0" }),
      tx({ id: "t2", tanggal: "2026-02-01", nominal: "0" }),
    ]);
    expect(result.rows.map((r) => r.id)).toEqual(["t1", "t2", "t3"]);
  });

  it("tanggal sama diurutkan berdasarkan createdAt", () => {
    const result = calculateAccountMutations(ACC, 100, [
      tx({ id: "b", tanggal: "2026-01-01", createdAt: "2026-01-01T10:00:00Z", nominal: "0" }),
      tx({ id: "a", tanggal: "2026-01-01", createdAt: "2026-01-01T08:00:00Z", nominal: "0" }),
    ]);
    expect(result.rows.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("tidak ada transaksi sama sekali → saldoAwalTurunan = saldoAkhir = saldoCache, konsisten true", () => {
    const result = calculateAccountMutations(ACC, 250_000, []);
    expect(result.saldoAwalTurunan).toBe(250_000);
    expect(result.saldoAkhir).toBe(250_000);
    expect(result.rows).toEqual([]);
    expect(result.konsisten).toBe(true);
  });
});
