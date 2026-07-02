-- Migration 0004: missing indexes on userId columns
-- Mirrors the pattern from migration 0003 for the transactions table.
-- Without these, every accounts/debts/receivables/liquid_assets/fixed_assets
-- query filtered by user_id does a full table scan as data grows.

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_accounts_user" ON "accounts" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_debts_user" ON "debts" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_receivables_user" ON "receivables" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_liquid_assets_user" ON "liquid_assets" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_fixed_assets_user" ON "fixed_assets" ("user_id");
