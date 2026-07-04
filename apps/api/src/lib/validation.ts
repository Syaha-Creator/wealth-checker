import type { Context } from "hono";
import type { ZodError } from "zod";

// Bug hunt Medium #4: @hono/zod-validator's default failure response is
// `c.json(result, 400)`, which serializes the raw ZodError object as `error`.
// Every frontend `apiFetch` does `throw new Error(err.error ?? "Gagal")` —
// stringifying that object literally produces "[object Object]" in the UI.
// Pass this as the third arg to every `zValidator(...)` call so failures
// return the first validation issue's message as a plain string instead.
export function zodErrorHook(
  result: { success: true } | { success: false; error: ZodError },
  c: Context,
) {
  if (!result.success) {
    return c.json({ error: result.error.issues[0]?.message ?? "Input tidak valid" }, 400);
  }
}

// Bug hunt (Issue 9): batas atas untuk field moneter/kuantitas numerik.
// Kolom `numeric` Postgres presisi arbitrary, tapi nilainya selalu dibaca/ditulis
// lewat `Number()` di JS (lihat services/wealth.ts, lib/format.ts) — di atas
// Number.MAX_SAFE_INTEGER (2^53 ≈ 9.007e15) presisi float bisa hilang tanpa
// error yang terlihat (nilai yang tersimpan diam-diam beda dari yang diinput).
// 1 kuadriliun Rupiah jauh di atas kebutuhan realistis aplikasi personal
// finance ini (jauh melebihi APBN Indonesia), jadi aman dipakai sebagai batas
// aman sebelum mendekati titik presisi float mulai longgar.
export const MAX_MONETARY_VALUE = 1_000_000_000_000_000; // Rp 1 kuadriliun
