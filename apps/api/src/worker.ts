// Entrypoint proses BACKGROUND WORKER (Sprint 24, Fase 4) — dijalankan sebagai
// container/proses TERPISAH dari HTTP API (lihat docker-compose.yml service
// `worker`), supaya beban cron notifikasi tidak berbagi event loop dengan
// request HTTP yang dilayani `index.ts`.
import "./lib/env";
import { Worker } from "bullmq";
import { db } from "@wealth/db";
import { getRedis } from "./lib/redis";
import { REMINDER_QUEUE_NAME } from "./lib/queue";
import { reminderJobHandler, reconcileAllReminderJobs } from "./services/notificationScheduler";

const worker = new Worker(
  REMINDER_QUEUE_NAME,
  async (job) => {
    const { userId } = job.data as { userId: string };
    return reminderJobHandler(db, userId);
  },
  { connection: getRedis(), concurrency: 5 },
);

worker.on("completed", (job, result) => {
  console.log(`[worker] reminder job ${job.id} selesai:`, result);
});

worker.on("failed", (job, err) => {
  console.error(`[worker] reminder job ${job?.id} gagal:`, err);
});

// Boot-time reconciliation — lihat komentar di reconcileAllReminderJobs().
reconcileAllReminderJobs(db)
  .then((count) => console.log(`[worker] ${count} reminder job direkonsiliasi saat startup`))
  .catch((err) => console.error("[worker] gagal rekonsiliasi reminder job saat startup", err));

console.log("🔔 Wealth Checker notification worker berjalan");
