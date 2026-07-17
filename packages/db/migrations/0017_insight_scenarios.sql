-- Migration 0017: Insight scenarios (Sprint 29 / Fase 5A) — skenario tersimpan.
-- Max 5 per user+household ditegakkan di API.

--> statement-breakpoint
CREATE TABLE "insight_scenarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"household_id" uuid NOT NULL,
	"nama" varchar(120) NOT NULL,
	"assumptions" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "insight_scenarios" ADD CONSTRAINT "insight_scenarios_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "insight_scenarios" ADD CONSTRAINT "insight_scenarios_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_insight_scenarios_user_household" ON "insight_scenarios" USING btree ("user_id","household_id");
--> statement-breakpoint
CREATE INDEX "idx_insight_scenarios_household" ON "insight_scenarios" USING btree ("household_id");
