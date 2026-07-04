import { describe, it, expect } from "vitest";
import { householdNameForUser } from "./household";

describe("householdNameForUser (Sprint 27 — Multi-User/Household)", () => {
  it("membuat nama household dari nama user", () => {
    expect(householdNameForUser("Budi")).toBe("Keluarga Budi");
  });

  it("membuang whitespace di sekitar nama", () => {
    expect(householdNameForUser("  Siti  ")).toBe("Keluarga Siti");
  });

  it("fallback ke 'Saya' jika nama kosong", () => {
    expect(householdNameForUser("")).toBe("Keluarga Saya");
    expect(householdNameForUser("   ")).toBe("Keluarga Saya");
  });
});
