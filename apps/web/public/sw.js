// Service worker minimal untuk Web Push (Sprint 24, Fase 4).
// Sengaja TIDAK melakukan caching/offline-first apa pun — satu-satunya
// tanggung jawabnya adalah menerima event `push` dari browser lalu
// menampilkannya sebagai notifikasi sistem, dan menangani klik pada notifikasi.

self.addEventListener("push", (event) => {
  let payload = { title: "Wealth Checker", body: "Ada pengingat baru untukmu." };
  try {
    if (event.data) payload = event.data.json();
  } catch {
    // Payload bukan JSON valid — pakai fallback di atas daripada gagal diam-diam.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      data: { url: payload.url ?? "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      const existing = clientsArr.find((c) => c.url.includes(self.location.origin));
      if (existing) {
        existing.focus();
        existing.navigate(url);
        return;
      }
      return self.clients.openWindow(url);
    }),
  );
});
