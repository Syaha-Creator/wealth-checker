import { describe, it, expect } from "vitest";
import { safeRedirectTarget } from "./safeRedirect";

describe("safeRedirectTarget", () => {
  it("menerima path relatif aman", () => {
    expect(safeRedirectTarget("/onboarding")).toBe("/onboarding");
    expect(safeRedirectTarget("/household/accept-invite?token=abc")).toBe(
      "/household/accept-invite?token=abc",
    );
  });

  it("menolak open-redirect", () => {
    expect(safeRedirectTarget(null)).toBeNull();
    expect(safeRedirectTarget("")).toBeNull();
    expect(safeRedirectTarget("//evil.example")).toBeNull();
    expect(safeRedirectTarget("https://evil.example")).toBeNull();
    expect(safeRedirectTarget("onboarding")).toBeNull();
  });
});
