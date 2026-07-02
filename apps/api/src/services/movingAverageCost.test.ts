import { describe, it, expect } from "vitest";
import { calculateMovingAverageCost, calculateProfitLoss, canSell, applySale } from "./movingAverageCost";

describe("calculateMovingAverageCost", () => {
  it("beli pertama kali (existing_qty = 0) → avg = harga beli pertama", () => {
    expect(calculateMovingAverageCost(0, 0, 10, 5000)).toBe(5000);
  });

  it("beli tambahan dengan harga sama → avg tidak berubah", () => {
    expect(calculateMovingAverageCost(10, 5000, 10, 5000)).toBe(5000);
  });

  it("beli tambahan dengan harga lebih tinggi → avg bergerak naik", () => {
    // 10 lot @ 5000 + 10 lot @ 7000 → avg = (50000 + 70000) / 20 = 6000
    expect(calculateMovingAverageCost(10, 5000, 10, 7000)).toBe(6000);
  });

  it("beli tambahan dengan harga lebih rendah → avg bergerak turun", () => {
    // 10 lot @ 5000 + 30 lot @ 1000 → avg = (50000 + 30000) / 40 = 2000
    expect(calculateMovingAverageCost(10, 5000, 30, 1000)).toBe(2000);
  });

  it("beli dalam qty tidak simetris → weighted average benar", () => {
    // 1 lot @ 100000 + 100 lot @ 1000 → avg = (100000 + 100000) / 101 ≈ 1980.2
    expect(calculateMovingAverageCost(1, 100_000, 100, 1_000)).toBeCloseTo(1980.198, 2);
  });

  it("edge: existing dan new keduanya 0 → return 0 (hindari division by zero)", () => {
    expect(calculateMovingAverageCost(0, 0, 0, 0)).toBe(0);
  });
});

describe("calculateProfitLoss", () => {
  it("jual di atas avg cost → untung positif", () => {
    // Jual 5 @ 8000, avg cost 5000 → untung = (8000-5000)*5 = 15000
    expect(calculateProfitLoss(5, 8000, 5000)).toBe(15000);
  });

  it("jual di bawah avg cost → rugi (negatif)", () => {
    expect(calculateProfitLoss(5, 3000, 5000)).toBe(-10000);
  });

  it("jual tepat di avg cost → untung/rugi = 0", () => {
    expect(calculateProfitLoss(10, 5000, 5000)).toBe(0);
  });

  it("jual semua holding → untung dihitung dari qty penuh", () => {
    expect(calculateProfitLoss(100, 12000, 10000)).toBe(200_000);
  });
});

describe("canSell (guard jual melebihi kepemilikan)", () => {
  it("menolak jual melebihi jumlah yang dimiliki", () => {
    const result = canSell(10, 15);
    expect(result.allowed).toBe(false);
    expect(result.error).toMatch(/tidak mencukupi/i);
  });

  it("mengizinkan jual sebagian dari yang dimiliki", () => {
    expect(canSell(10, 5).allowed).toBe(true);
  });

  it("mengizinkan jual tepat sejumlah yang dimiliki (batas pas)", () => {
    const result = canSell(10, 10);
    expect(result.allowed).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("menolak jual saat kepemilikan 0", () => {
    expect(canSell(0, 1).allowed).toBe(false);
  });
});

describe("applySale (update jumlah & avg_cost setelah jual)", () => {
  it("jual sebagian → jumlah berkurang, avg_cost TIDAK berubah", () => {
    const result = applySale(100, 5000, 40);
    expect(result.remainingQty).toBe(60);
    expect(result.avgCost).toBe(5000);
  });

  it("jual semua (tepat sejumlah dimiliki) → jumlah = 0, avg_cost di-reset ke 0", () => {
    const result = applySale(50, 5000, 50);
    expect(result.remainingQty).toBe(0);
    expect(result.avgCost).toBe(0);
  });

  it("edge: floating point residue dianggap fully sold (mis. 0.1+0.2 sisa)", () => {
    const result = applySale(0.3, 1000, 0.3);
    expect(result.remainingQty).toBe(0);
    expect(result.avgCost).toBe(0);
  });

  it("jual kecil dari holding besar → sisa tetap presisi", () => {
    const result = applySale(1000, 250, 1);
    expect(result.remainingQty).toBe(999);
    expect(result.avgCost).toBe(250);
  });
});
