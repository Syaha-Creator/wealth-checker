// Bug hunt follow-up: migration 0005/0006 menambahkan unique index functional
// (user_id, lower(nama)) pada debts/receivables/liquid_assets/fixed_assets/budget_plans
// untuk menutup race "find-or-create by name" di POST /transactions. Tapi endpoint
// CRUD langsung (POST/PATCH debts, receivables, assets) masih melakukan plain
// INSERT/UPDATE — kalau nama sudah dipakai, Postgres melempar unique_violation
// (code 23505) yang tanpa penanganan ini akan lolos ke global error handler
// sebagai 500 generic, bukan 409 yang jelas untuk user.
//
// postgres.js (driver di packages/db/src/client.ts) melampirkan field error
// mentah dari wire protocol Postgres langsung ke objek error yang dilempar,
// termasuk `code` dan `constraint_name`.
interface PostgresDriverError {
  code?: string;
  constraint_name?: string;
}

export function isUniqueViolation(err: unknown, constraintName: string): boolean {
  const e = err as PostgresDriverError;
  return e?.code === "23505" && e?.constraint_name === constraintName;
}
