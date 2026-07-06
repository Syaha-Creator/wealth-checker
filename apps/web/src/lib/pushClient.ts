"use client";

// Wrapper tipis di atas Web Push API browser (Sprint 24, Fase 4) — TIDAK
// melakukan panggilan ke API kita sendiri, murni interaksi dengan
// navigator.serviceWorker / PushManager. Pemanggil (NotificationSettings.tsx)
// yang bertanggung jawab mengirim hasilnya ke POST/DELETE /api/notifications/subscribe.

export function isPushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

// applicationServerKey butuh Uint8Array, bukan string base64 — konversi standar
// dari dokumentasi Web Push (base64url, bukan base64 biasa).
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register("/sw.js");
}

export interface SubscribePayload {
  platform: "web";
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Minta izin notifikasi + subscribe ke push. Melempar error kalau ditolak/gagal. */
export async function subscribeToPush(vapidPublicKey: string): Promise<SubscribePayload> {
  if (!isPushSupported()) throw new Error("Browser ini tidak mendukung push notification");
  // Tanpa guard ini, kunci kosong (NEXT_PUBLIC_VAPID_PUBLIC_KEY belum di-set di
  // env deploy) baru ketahuan lewat DOMException mentah dari pushManager.subscribe()
  // ("applicationServerKey is not valid") — pesan yang membingungkan untuk user.
  if (!vapidPublicKey) throw new Error("Push notification belum dikonfigurasi di server");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Izin notifikasi ditolak — aktifkan lewat setelan browser untuk melanjutkan");

  const registration = await registerServiceWorker();
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
  });

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("Subscription push tidak lengkap — coba lagi");
  }

  return { platform: "web", endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth };
}

/** Ambil endpoint subscription aktif di browser ini (untuk DELETE /subscribe), null jika belum ada. */
export async function getCurrentSubscriptionEndpoint(): Promise<string | null> {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  return subscription?.endpoint ?? null;
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  await subscription?.unsubscribe();
}
