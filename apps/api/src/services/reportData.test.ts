import { describe, it, expect } from "vitest";
import { monthsBetween, monthsInRange, TRANSACTION_LIST_MAX_MONTHS } from "./reportData";

describe("monthsBetween", () => {
  it("1 bulan yang sama = 1", () => {
    expect(monthsBetween("2026-01-01", "2026-01-31")).toBe(1);
  });

  it("rentang 3 bulan penuh (Jan-Mar) = 3", () => {
    expect(monthsBetween("2026-01-01", "2026-03-31")).toBe(3);
  });

  it("rentang lintas tahun dihitung benar", () => {
    expect(monthsBetween("2025-11-01", "2026-02-28")).toBe(4);
  });

  it("rentang 1 tahun penuh = 12", () => {
    expect(monthsBetween("2026-01-01", "2026-12-31")).toBe(12);
  });
});

describe("monthsInRange", () => {
  it("mengembalikan daftar YYYY-MM untuk rentang 1 bulan", () => {
    expect(monthsInRange("2026-01-05", "2026-01-20")).toEqual(["2026-01"]);
  });

  it("mengembalikan daftar YYYY-MM lintas tahun", () => {
    expect(monthsInRange("2025-11-15", "2026-02-01")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
});

describe("TRANSACTION_LIST_MAX_MONTHS", () => {
  it("konsisten dengan PRD (daftar transaksi hanya untuk rentang <= 3 bulan)", () => {
    expect(TRANSACTION_LIST_MAX_MONTHS).toBe(3);
    expect(monthsBetween("2026-01-01", "2026-03-31")).toBeLessThanOrEqual(TRANSACTION_LIST_MAX_MONTHS);
    expect(monthsBetween("2026-01-01", "2026-04-01")).toBeGreaterThan(TRANSACTION_LIST_MAX_MONTHS);
  });
});
