import { pgTable, uuid, text, boolean, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { authUser } from "./auth";
import { households } from "./households";

export const userChecklistItems = pgTable("user_checklist_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => authUser.id, { onDelete: "cascade" }),
  householdId: uuid("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  itemKey: text("item_key").notNull(),
  isChecked: boolean("is_checked").notNull().default(false),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  householdIdx: index("idx_user_checklist_items_household").on(t.householdId),
  householdCategoryItemUniqueIdx: uniqueIndex("idx_user_checklist_items_household_category_item_unique").on(
    t.householdId,
    t.category,
    t.itemKey,
  ),
}));
