export type HouseholdRole = "owner" | "editor" | "viewer";

export type AppVariables = {
  /** Correlation ID — set by requestIdMiddleware on every request. */
  requestId: string;
  userId: string;
  user: { id: string; name: string; email: string };
  // Sprint 27 (Fase 4): diset oleh middleware resolveHousehold — household
  // yang aktif untuk request ini (dari header X-Household-Id, atau default
  // household pertama user kalau header tidak dikirim).
  householdId: string;
  householdRole: HouseholdRole;
};

export type AppEnv = { Variables: AppVariables };
