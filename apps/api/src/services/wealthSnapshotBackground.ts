import { db } from "@wealth/db";
import { createWealthSnapshot } from "./wealth";
import { logger } from "../lib/logger";

/**
 * Fire-and-forget wealth snapshot after a financial mutation.
 * Failures must not fail the HTTP response — but must be queryable in logs.
 */
export function snapshotWealthInBackground(
  householdId: string,
  userId: string,
  requestId?: string,
): void {
  createWealthSnapshot(db, householdId, userId).catch((err) => {
    logger.error(
      "wealth_snapshot_failed",
      { householdId, userId, ...(requestId ? { requestId } : {}) },
      err,
    );
  });
}
