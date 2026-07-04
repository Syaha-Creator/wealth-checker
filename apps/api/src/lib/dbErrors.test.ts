import { describe, expect, it } from "vitest";
import { isUniqueViolation } from "./dbErrors";

describe("isUniqueViolation", () => {
  it("returns true when code and constraint name both match", () => {
    const err = { code: "23505", constraint_name: "idx_debts_user_pemberi_unique" };
    expect(isUniqueViolation(err, "idx_debts_user_pemberi_unique")).toBe(true);
  });

  it("returns false when code matches but constraint name differs (different unique index)", () => {
    const err = { code: "23505", constraint_name: "some_other_constraint" };
    expect(isUniqueViolation(err, "idx_debts_user_pemberi_unique")).toBe(false);
  });

  it("returns false for non-unique-violation Postgres errors (e.g. foreign key)", () => {
    const err = { code: "23503", constraint_name: "idx_debts_user_pemberi_unique" };
    expect(isUniqueViolation(err, "idx_debts_user_pemberi_unique")).toBe(false);
  });

  it("returns false for arbitrary thrown values (not a Postgres error at all)", () => {
    expect(isUniqueViolation(new Error("boom"), "idx_debts_user_pemberi_unique")).toBe(false);
    expect(isUniqueViolation(null, "idx_debts_user_pemberi_unique")).toBe(false);
    expect(isUniqueViolation(undefined, "idx_debts_user_pemberi_unique")).toBe(false);
  });
});
