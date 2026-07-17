import { pgTable, uuid, text, varchar, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { authUser } from "./auth";
import { households } from "./households";

/** Shape tersimpan di kolom assumptions (Sprint 29 Scenario Planner). */
export type InsightScenarioAssumptionsJson = {
  pemasukanDeltaPersen: number;
  pengeluaranDeltaPersen: number;
  cicilanBaru?: number;
  mode: "simple" | "advanced";
  inflasiPersen?: number;
  returnInvestasiPersen?: number;
};

// Sprint 29 (Fase 5A): skenario Insight tersimpan — simulasi only, bukan ledger.
// Batas max 5 per (user_id, household_id) ditegakkan di API, bukan DB constraint.
export const insightScenarios = pgTable("insight_scenarios", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => authUser.id, { onDelete: "cascade" }),
  householdId: uuid("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
  nama: varchar("nama", { length: 120 }).notNull(),
  assumptions: jsonb("assumptions").$type<InsightScenarioAssumptionsJson>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  userHouseholdIdx: index("idx_insight_scenarios_user_household").on(t.userId, t.householdId),
  householdIdx: index("idx_insight_scenarios_household").on(t.householdId),
}));
