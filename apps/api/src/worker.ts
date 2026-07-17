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
import { createLogger } from "./lib/logger";

const log = createLogger({ service: "wealth-checker-worker" });

const worker = new Worker(
  REMINDER_QUEUE_NAME,
  async (job) => {
    const { userId } = job.data as { userId: string };
    return reminderJobHandler(db, userId);
  },
  { connection: getRedis(), concurrency: 5 },
);

worker.on("completed", (job, result) => {
  log.info("reminder_job_completed", {
    jobId: job.id,
    userId: (job.data as { userId?: string })?.userId,
    result,
  });
});

worker.on("failed", (job, err) => {
  log.error(
    "reminder_job_failed",
    {
      jobId: job?.id,
      userId: (job?.data as { userId?: string } | undefined)?.userId,
      attemptsMade: job?.attemptsMade,
    },
    err,
  );
});

// Boot-time reconciliation — lihat komentar di reconcileAllReminderJobs().
reconcileAllReminderJobs(db)
  .then((count) => log.info("reminder_jobs_reconciled", { count }))
  .catch((err) => log.error("reminder_jobs_reconcile_failed", {}, err));

log.info("worker_started", {});
