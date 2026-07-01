import type { Context, Next } from "hono";
import { auth } from "../lib/auth";
import type { AppEnv } from "../types";

export async function requireAuth(c: Context<AppEnv>, next: Next) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) return c.json({ error: "Unauthorized" }, 401);
  c.set("userId", session.user.id);
  c.set("user", session.user);
  await next();
}
