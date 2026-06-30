import { Hono } from "hono";
import { auth } from "../lib/auth";

export const authRoutes = new Hono();

authRoutes.on(["GET", "POST"], "/*", (c) => auth.handler(c.req.raw));
