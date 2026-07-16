import { describe, it, expect } from "vitest";
import { calculateDreamGoalProgress } from "./dreamGoals";

function goal(overrides: Partial<{ id: string; namaGoal: string; accountId: string | null; targetNominal: string | number }> = {}) {
  return {
    id: "goal-1",
    namaGoal: "Liburan ke Jepang",
    accountId: null,
    targetNominal: 20_000_000,
    ...overrides,
  };
}

describe("calculateDreamGoalProgress (Sprint 21 — Dream Tracker)", () => {
  it("persentase = saldo/target*100, dibulatkan 1 desimal", () => {
    const result = calculateDreamGoalProgress(goal({ targetNominal: 20_000_000 }), 5_000_000);
    expect(result.persentase).toBe(25);
    expect(result.tercapai).toBe(false);
    expect(result.sisaMenujuTarget).toBe(15_000_000);
  });

  it("saldo >= target → persentase di-cap 100, tercapai true", () => {
    const result = calculateDreamGoalProgress(goal({ targetNominal: 10_000_000 }), 12_000_000);
    expect(result.persentase).toBe(100);
    expect(result.tercapai).toBe(true);
    expect(result.sisaMenujuTarget).toBe(0);
  });

  it("saldo tepat sama dengan target → tercapai true, sisa 0", () => {
    const result = calculateDreamGoalProgress(goal({ targetNominal: 10_000_000 }), 10_000_000);
    expect(result.persentase).toBe(100);
    expect(result.tercapai).toBe(true);
  });

  it("saldo 0 → persentase 0, tidak error/NaN", () => {
    const result = calculateDreamGoalProgress(goal({ targetNominal: 10_000_000 }), 0);
    expect(result.persentase).toBe(0);
    expect(result.tercapai).toBe(false);
    expect(result.sisaMenujuTarget).toBe(10_000_000);
  });

  it("target 0 (edge case data tidak valid) → persentase 0, bukan Infinity/NaN, tercapai false", () => {
    const result = calculateDreamGoalProgress(goal({ targetNominal: 0 }), 5_000_000);
    expect(result.persentase).toBe(0);
    expect(result.tercapai).toBe(false);
    expect(result.sisaMenujuTarget).toBe(0);
  });

  it("persentase pecahan dibulatkan 1 desimal (mis. 33.33% -> 33.3%)", () => {
    const result = calculateDreamGoalProgress(goal({ targetNominal: 3_000_000 }), 1_000_000);
    expect(result.persentase).toBe(33.3);
  });

  it("meneruskan id/namaGoal/accountId/targetNominal apa adanya", () => {
    const result = calculateDreamGoalProgress(goal({ id: "abc", namaGoal: "Rumah", accountId: "acc-1", targetNominal: "500000000" }), 100_000_000);
    expect(result.id).toBe("abc");
    expect(result.namaGoal).toBe("Rumah");
    expect(result.accountId).toBe("acc-1");
    expect(result.targetNominal).toBe(500_000_000);
    expect(result.accountMissing).toBe(false);
  });

  it("accountMissing=true diteruskan ke hasil (rekening terhapus)", () => {
    const result = calculateDreamGoalProgress(goal({ accountId: "missing-acc" }), 0, { accountMissing: true });
    expect(result.accountMissing).toBe(true);
    expect(result.saldoSaatIni).toBe(0);
  });
});
