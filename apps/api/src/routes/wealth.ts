import { Hono } from "hono";
import { db } from "@wealth/db";
import { requireAuth } from "../middleware/auth";
import { calculateWealthSummary } from "../services/wealth";

export const wealthRoutes = new Hono();

wealthRoutes.use("*", requireAuth);

wealthRoutes.get("/summary", async (c) => {
  const userId = c.get("userId") as string;
  const summary = await calculateWealthSummary(db, userId);
  return c.json(summary);
});
