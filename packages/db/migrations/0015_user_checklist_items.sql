-- Migration 0015: Checklist generik per household (legacy planning, budgeting tips, dll).
-- Backend hanya menyimpan status checked/unchecked per item_key — label dimiliki client.

--> statement-breakpoint
CREATE TABLE "user_checklist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"category" text NOT NULL,
	"item_key" text NOT NULL,
	"is_checked" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_checklist_items" ADD CONSTRAINT "user_checklist_items_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_checklist_items" ADD CONSTRAINT "user_checklist_items_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_user_checklist_items_household" ON "user_checklist_items" USING btree ("household_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_checklist_items_household_category_item_unique" ON "user_checklist_items" USING btree ("household_id","category","item_key");
