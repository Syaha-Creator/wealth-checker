-- Migration 0002: Unifikasi user_id
-- Hapus semua tabel bisnis lama (masih kosong), drop tabel users lama,
-- buat ulang dengan user_id TEXT yang merujuk ke Better Auth's "user" table.

--> statement-breakpoint
DROP TABLE IF EXISTS "budget_plans" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "dream_goals" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "wealth_snapshots" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "transactions" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "receivables" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "debts" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "fixed_assets" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "liquid_assets" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "accounts" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "users" CASCADE;

--> statement-breakpoint
CREATE TABLE "user_profile" (
	"id" text PRIMARY KEY NOT NULL,
	"tanggal_lahir" date,
	"rencana_usia_pensiun" integer,
	"rencana_usia_warisan" integer,
	"anggota_keluarga_ditanggung" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"nama" varchar(255) NOT NULL,
	"saldo_cache" numeric(20, 2) NOT NULL DEFAULT '0',
	"is_active" boolean NOT NULL DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "liquid_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"nama_aset" varchar(255) NOT NULL,
	"jumlah" numeric(20, 4) NOT NULL DEFAULT '0',
	"harga_beli_rata_rata" numeric(20, 2) NOT NULL DEFAULT '0',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fixed_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"nama_aset" varchar(255) NOT NULL,
	"jumlah" numeric(20, 4) NOT NULL DEFAULT '0',
	"harga_beli_rata_rata" numeric(20, 2) NOT NULL DEFAULT '0',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "debts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"pemberi_utang" varchar(255) NOT NULL,
	"tipe" "debt_type" NOT NULL DEFAULT 'utang_biasa',
	"saldo_awal" numeric(20, 2) NOT NULL DEFAULT '0',
	"sisa_saldo" numeric(20, 2) NOT NULL DEFAULT '0',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receivables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"peminjam" varchar(255) NOT NULL,
	"saldo_awal" numeric(20, 2) NOT NULL DEFAULT '0',
	"sisa_saldo" numeric(20, 2) NOT NULL DEFAULT '0',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"tanggal" date NOT NULL,
	"type" "transaction_type" NOT NULL,
	"kategori" varchar(255),
	"rincian" text,
	"account_id" uuid,
	"related_entity_id" uuid,
	"nominal" numeric(20, 2) NOT NULL,
	"untung_rugi" numeric(20, 2),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wealth_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"tanggal" date NOT NULL,
	"total_aset" numeric(20, 2) NOT NULL,
	"total_utang" numeric(20, 2) NOT NULL,
	"kekayaan_bersih" numeric(20, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dream_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"nama_goal" varchar(255) NOT NULL,
	"account_id" uuid,
	"target_nominal" numeric(20, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"rencana_pemasukan_bulanan" numeric(20, 2) NOT NULL,
	"bulan_tahun" varchar(7) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_id_user_id_fk" FOREIGN KEY ("id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "liquid_assets" ADD CONSTRAINT "liquid_assets_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "debts" ADD CONSTRAINT "debts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "wealth_snapshots" ADD CONSTRAINT "wealth_snapshots_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dream_goals" ADD CONSTRAINT "dream_goals_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "budget_plans" ADD CONSTRAINT "budget_plans_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
