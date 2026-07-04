import type { PushSender, PushSubscriptionRow, PushPayload } from "./types";
import { PushSendError } from "./types";

// Sprint 24 (Fase 4) — TIDAK ADA app mobile Flutter di repo ini saat ini, jadi
// adapter ini belum pernah benar-benar terpakai di production. Disiapkan
// sebagai forward-compat: begitu app Android/iOS ada dan FCM_SERVER_KEY diisi,
// platform "android"/"ios" otomatis terkirim tanpa perlu ubah scheduler/route.
//
// Sengaja pakai FCM Legacy HTTP API (fetch biasa, tanpa dependency SDK
// `firebase-admin` yang berat/native) — cukup untuk kebutuhan kirim single
// notification per token. Kalau nanti perlu fitur lanjutan (topic messaging,
// batch besar), migrasi ke FCM HTTP v1 + OAuth2 service account adalah upgrade
// terpisah, bukan blocker untuk fitur ini.
const FCM_LEGACY_ENDPOINT = "https://fcm.googleapis.com/fcm/send";

export const fcmSender: PushSender = {
  async send(sub: PushSubscriptionRow, payload: PushPayload): Promise<void> {
    const serverKey = process.env.FCM_SERVER_KEY;
    if (!serverKey) {
      throw new PushSendError(
        "FCM_SERVER_KEY belum diset — notifikasi mobile (android/ios) tidak aktif sampai kredensial FCM diisi",
        false,
      );
    }

    const res = await fetch(FCM_LEGACY_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `key=${serverKey}`,
      },
      body: JSON.stringify({
        to: sub.endpoint, // device token
        notification: { title: payload.title, body: payload.body },
        data: payload.url ? { url: payload.url } : undefined,
      }),
    });

    if (!res.ok) {
      // 401/400 dengan token invalid biasanya permanent, tapi FCM legacy API
      // mengembalikan detail di body (bukan status code) — parse best-effort.
      const body = await res.json().catch(() => null) as { results?: { error?: string }[] } | null;
      const errorCode = body?.results?.[0]?.error;
      const permanent = errorCode === "NotRegistered" || errorCode === "InvalidRegistration";
      throw new PushSendError(`FCM gagal kirim: ${errorCode ?? res.statusText}`, permanent);
    }
  },
};
