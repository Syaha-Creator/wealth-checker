import { getRedis } from "./redis";

/**
 * Rate limit sederhana berbasis Redis (SET key val EX seconds NX) — atomic,
 * aman dari race condition antar request konkuren (tidak seperti pola
 * GET-lalu-SET yang bisa TOCTOU). Return true kalau REQUEST INI diizinkan
 * (berhasil mengklaim slot), false kalau masih dalam cooldown.
 */
export async function checkRateLimit(key: string, windowSeconds: number): Promise<boolean> {
  const result = await getRedis().set(key, "1", "EX", windowSeconds, "NX");
  return result === "OK";
}
