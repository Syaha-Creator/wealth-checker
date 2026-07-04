export interface PushPayload {
  title: string;
  body: string;
  url?: string; // deep-link dibuka saat notifikasi diklik
}

export interface PushSubscriptionRow {
  id: string;
  platform: "web" | "android" | "ios";
  endpoint: string;
  p256dh: string | null;
  auth: string | null;
}

export class PushSendError extends Error {
  // `permanent = true` → subscription tidak valid lagi (410 Gone / token
  // expired) dan harus dihapus dari notification_subscriptions, BUKAN diretry.
  // `permanent = false` → kegagalan sementara (network/5xx), aman diretry.
  constructor(message: string, public readonly permanent: boolean) {
    super(message);
    this.name = "PushSendError";
  }
}

export interface PushSender {
  send(sub: PushSubscriptionRow, payload: PushPayload): Promise<void>;
}
