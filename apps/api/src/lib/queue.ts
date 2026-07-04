import { Queue } from "bullmq";
import { getRedis } from "./redis";

export const REMINDER_QUEUE_NAME = "notification-reminders";

// Lazy singleton — sama alasan dengan getRedis(): jangan connect saat modul
// ini di-import, hanya saat benar-benar dipakai (routes/notifications.ts saat
// preference diubah, atau worker.ts saat proses job).
let queue: Queue | null = null;

export function getReminderQueue(): Queue {
  if (!queue) {
    queue = new Queue(REMINDER_QUEUE_NAME, { connection: getRedis() });
  }
  return queue;
}
