CREATE TYPE "public"."debt_type" AS ENUM('utang_biasa', 'kartu_kredit');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('pendapatan', 'pengeluaran', 'pinjaman_utang', 'bayar_utang', 'pemberian_piutang', 'penerimaan_piutang', 'beli_barang', 'jual_barang', 'beli_investasi', 'jual_investasi', 'transfer');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"nama" varchar(255) NOT NULL,
	"tanggal_lahir" date,
	"rencana_usia_pensiun" integer,
	"rencana_usia_warisan" integer,
	"anggota_keluarga_ditanggung" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"nama" varchar(255) NOT NULL,
	"saldo_cache" numeric(20, 2) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fixed_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"nama_aset" varchar(255) NOT NULL,
	"jumlah" numeric(20, 4) DEFAULT '0' NOT NULL,
	"harga_beli_rata_rata" numeric(20, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "liquid_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"nama_aset" varchar(255) NOT NULL,
	"jumlah" numeric(20, 4) DEFAULT '0' NOT NULL,
	"harga_beli_rata_rata" numeric(20, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "debts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"pemberi_utang" varchar(255) NOT NULL,
	"tipe" "debt_type" DEFAULT 'utang_biasa' NOT NULL,
	"saldo_awal" numeric(20, 2) DEFAULT '0' NOT NULL,
	"sisa_saldo" numeric(20, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receivables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"peminjam" varchar(255) NOT NULL,
	"saldo_awal" numeric(20, 2) DEFAULT '0' NOT NULL,
	"sisa_saldo" numeric(20, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
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
CREATE TABLE "budget_allocation_reference" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "budget_allocation_reference_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"level" integer NOT NULL,
	"kategori_1_nama" varchar(100),
	"kategori_1_persen" numeric(5, 2),
	"kategori_2_nama" varchar(100),
	"kategori_2_persen" numeric(5, 2),
	"kategori_3_nama" varchar(100),
	"kategori_3_persen" numeric(5, 2),
	"kategori_4_nama" varchar(100),
	"kategori_4_persen" numeric(5, 2)
);
--> statement-breakpoint
CREATE TABLE "budget_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"rencana_pemasukan_bulanan" numeric(20, 2) NOT NULL,
	"bulan_tahun" varchar(7) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dream_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"nama_goal" varchar(255) NOT NULL,
	"account_id" uuid,
	"target_nominal" numeric(20, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wealth_level_reference" (
	"level" integer PRIMARY KEY NOT NULL,
	"nama_level" varchar(100) NOT NULL,
	"diagnosa" text NOT NULL,
	"saran" text NOT NULL,
	"ciri_1" text,
	"ciri_2" text,
	"ciri_3" text
);
--> statement-breakpoint
CREATE TABLE "wealth_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tanggal" date NOT NULL,
	"total_aset" numeric(20, 2) NOT NULL,
	"total_utang" numeric(20, 2) NOT NULL,
	"kekayaan_bersih" numeric(20, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liquid_assets" ADD CONSTRAINT "liquid_assets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debts" ADD CONSTRAINT "debts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_plans" ADD CONSTRAINT "budget_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dream_goals" ADD CONSTRAINT "dream_goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wealth_snapshots" ADD CONSTRAINT "wealth_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;