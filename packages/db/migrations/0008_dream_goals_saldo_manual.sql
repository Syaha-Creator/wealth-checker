-- Migration 0008: kolom saldo_manual di dream_goals (Fase 3 Sprint 21 —
-- Dream Tracker). Dream goal bisa dilacak dua cara: link ke rekening
-- (accountId sudah ada — saldo diambil live dari accounts.saldoCache), ATAU
-- input saldo manual untuk goal yang tidak terkait rekening spesifik (mis.
-- ditabung tunai/campuran). Nullable karena hanya dipakai jika accountId NULL.

--> statement-breakpoint
ALTER TABLE "dream_goals"
  ADD COLUMN IF NOT EXISTS "saldo_manual" numeric(20, 2);
