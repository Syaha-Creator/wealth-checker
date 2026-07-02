import { describe, it, expect } from "vitest";
import {
  canPayDebt, canReceiveReceivable,
  calculateDebtSummary, calculateReceivableSummary,
} from "./debtReceivable";

describe("canPayDebt (guard cicilan melebihi sisa utang — Sprint 8)", () => {
  it("menolak cicilan yang melebihi sisa utang", () => {
    const result = canPayDebt(500_000, 600_000);
    expect(result.allowed).toBe(false);
    expect(result.error).toMatch(/melebihi sisa utang/i);
  });

  it("mengizinkan cicilan tepat sejumlah sisa utang (pelunasan penuh)", () => {
    const result = canPayDebt(500_000, 500_000);
    expect(result.allowed).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("mengizinkan cicilan sebagian dari sisa utang", () => {
    expect(canPayDebt(1_000_000, 250_000).allowed).toBe(true);
  });

  it("menolak cicilan saat sisa utang sudah 0 (sudah lunas)", () => {
    expect(canPayDebt(0, 1).allowed).toBe(false);
  });
});

describe("canReceiveReceivable (guard pembayaran melebihi sisa piutang — Sprint 9)", () => {
  it("menolak penerimaan yang melebihi sisa piutang", () => {
    const result = canReceiveReceivable(300_000, 400_000);
    expect(result.allowed).toBe(false);
    expect(result.error).toMatch(/melebihi sisa piutang/i);
  });

  it("mengizinkan penerimaan tepat sejumlah sisa piutang (pelunasan penuh)", () => {
    expect(canReceiveReceivable(300_000, 300_000).allowed).toBe(true);
  });

  it("mengizinkan penerimaan sebagian dari sisa piutang", () => {
    expect(canReceiveReceivable(1_000_000, 100_000).allowed).toBe(true);
  });
});

describe("calculateDebtSummary (ringkasan Pemberi Utang vs Sisa Utang)", () => {
  it("skenario pelunasan penuh → lunas true, progress 100%, sisaSaldo 0", () => {
    const summary = calculateDebtSummary([
      { id: "1", pemberiUtang: "Bank ABC", tipe: "utang_biasa", saldoAwal: "1000000", sisaSaldo: "0" },
    ]);
    expect(summary.perPemberi[0].lunas).toBe(true);
    expect(summary.perPemberi[0].progressPercent).toBe(100);
    expect(summary.totalSisaSaldo).toBe(0);
    expect(summary.progressPercent).toBe(100);
  });

  it("skenario cicilan sebagian → lunas false, progress sesuai persentase terbayar", () => {
    const summary = calculateDebtSummary([
      { id: "1", pemberiUtang: "Kartu Kredit XYZ", tipe: "kartu_kredit", saldoAwal: "2000000", sisaSaldo: "1500000" },
    ]);
    expect(summary.perPemberi[0].lunas).toBe(false);
    expect(summary.perPemberi[0].totalTerbayar).toBe(500_000);
    expect(summary.perPemberi[0].progressPercent).toBe(25);
  });

  it("agregasi multi-pemberi → total dijumlahkan dengan benar dan diurutkan sisaSaldo terbesar dulu", () => {
    const summary = calculateDebtSummary([
      { id: "1", pemberiUtang: "A", tipe: "utang_biasa", saldoAwal: "1000000", sisaSaldo: "200000" },
      { id: "2", pemberiUtang: "B", tipe: "utang_biasa", saldoAwal: "3000000", sisaSaldo: "3000000" },
    ]);
    expect(summary.totalPinjaman).toBe(4_000_000);
    expect(summary.totalTerbayar).toBe(800_000);
    expect(summary.totalSisaSaldo).toBe(3_200_000);
    expect(summary.perPemberi[0].pemberiUtang).toBe("B"); // sisaSaldo terbesar duluan
  });

  it("array kosong (belum ada utang) → semua total 0, tidak error", () => {
    const summary = calculateDebtSummary([]);
    expect(summary.totalPinjaman).toBe(0);
    expect(summary.progressPercent).toBe(0);
    expect(summary.perPemberi).toEqual([]);
  });
});

describe("calculateReceivableSummary (ringkasan Peminjam vs Sisa Piutang)", () => {
  it("skenario pelunasan penuh → lunas true, progress 100%", () => {
    const summary = calculateReceivableSummary([
      { id: "1", peminjam: "Budi", saldoAwal: "500000", sisaSaldo: "0" },
    ]);
    expect(summary.perPeminjam[0].lunas).toBe(true);
    expect(summary.perPeminjam[0].progressPercent).toBe(100);
  });

  it("skenario pembayaran sebagian → progress dihitung proporsional", () => {
    const summary = calculateReceivableSummary([
      { id: "1", peminjam: "Siti", saldoAwal: "1000000", sisaSaldo: "750000" },
    ]);
    expect(summary.perPeminjam[0].totalDiterima).toBe(250_000);
    expect(summary.perPeminjam[0].progressPercent).toBe(25);
    expect(summary.perPeminjam[0].lunas).toBe(false);
  });

  it("array kosong (belum ada piutang) → semua total 0, tidak error", () => {
    const summary = calculateReceivableSummary([]);
    expect(summary.totalDipinjamkan).toBe(0);
    expect(summary.perPeminjam).toEqual([]);
  });
});
