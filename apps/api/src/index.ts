import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { authRoutes } from "./routes/auth";
import { accountRoutes } from "./routes/accounts";
import { transactionRoutes } from "./routes/transactions";
import { wealthRoutes } from "./routes/wealth";

const ALLOWED_ORIGINS = [
  "https://wealth.velrox.cloud",
  "http://localhost:3010",
  "http://localhost:3000",
];

const app = new Hono();

app.use("*", logger());

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return origin; // same-origin (no CORS header needed)
      if (ALLOWED_ORIGINS.includes(origin)) return origin;
      return null; // reject
    },
    allowHeaders: ["Content-Type", "Authorization", "Cookie"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["Set-Cookie"],
    credentials: true,
    maxAge: 86400,
  })
);

app.get("/health", (c) =>
  c.json({ status: "ok", service: "wealth-checker-api", ts: new Date().toISOString() })
);

app.route("/api/auth", authRoutes);
app.route("/api/accounts", accountRoutes);
app.route("/api/transactions", transactionRoutes);
app.route("/api/wealth", wealthRoutes);

// 404 handler
app.notFound((c) => c.json({ error: "Not found" }, 404));

const port = Number(process.env.PORT) || 3011;
console.log(`🚀 Wealth Checker API running on port ${port}`);

export default { port, fetch: app.fetch };
