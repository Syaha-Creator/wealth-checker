import { describe, it, expect } from "vitest";
import { isPasswordValid, getPasswordChecks } from "./passwordValidation";

describe("passwordValidation", () => {
  it("menerima password yang memenuhi semua syarat", () => {
    expect(isPasswordValid("Secret1a")).toBe(true);
    expect(getPasswordChecks("Secret1a").every((c) => c.ok)).toBe(true);
  });

  it("menolak password terlalu pendek / tanpa huruf besar / tanpa angka", () => {
    expect(isPasswordValid("Ab1")).toBe(false);
    expect(isPasswordValid("secret1a")).toBe(false);
    expect(isPasswordValid("SecretAA")).toBe(false);
  });
});
