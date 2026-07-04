import webpush from "web-push";
import type { PushSender, PushSubscriptionRow, PushPayload } from "./types";
import { PushSendError } from "./types";

let configured = false;

function ensureConfigured(): void {
  if (configured) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:support@wealth.velrox.cloud";
  if (!publicKey || !privateKey) {
    throw new PushSendError(
      "VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY belum diset — generate dengan `npx web-push generate-vapid-keys` dan isi di .env",
      false,
    );
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export const webPushSender: PushSender = {
  async send(sub: PushSubscriptionRow, payload: PushPayload): Promise<void> {
    ensureConfigured();
    if (!sub.p256dh || !sub.auth) {
      throw new PushSendError("Web push subscription tidak lengkap (p256dh/auth kosong)", true);
    }

    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth },
    };

    try {
      await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
    } catch (err: unknown) {
      // web-push melempar WebPushError dengan `.statusCode` — 404/410 berarti
      // browser sudah membuang subscription ini (uninstall/unsubscribe), jangan
      // diretry, hapus dari DB (lihat services/notificationScheduler.ts).
      const statusCode = (err as { statusCode?: number })?.statusCode;
      const permanent = statusCode === 404 || statusCode === 410;
      throw new PushSendError(err instanceof Error ? err.message : "Gagal mengirim web push", permanent);
    }
  },
};
