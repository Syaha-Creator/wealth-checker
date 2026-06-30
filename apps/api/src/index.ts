import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { authRoutes } from "./routes/auth";
import { accountRoutes } from "./routes/accounts";
import { transactionRoutes } from "./routes/transactions";
import { wealthRoutes } from "./routes/wealth";

const app = new Hono();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3010",
    credentials: true,
  })
);

app.get("/health", (c) => c.json({ status: "ok", service: "wealth-checker-api" }));

app.route("/api/auth", authRoutes);
app.route("/api/accounts", accountRoutes);
app.route("/api/transactions", transactionRoutes);
app.route("/api/wealth", wealthRoutes);

const port = Number(process.env.PORT) || 3011;
console.log(`🚀 Wealth Checker API running on port ${port}`);

export default { port, fetch: app.fetch };
