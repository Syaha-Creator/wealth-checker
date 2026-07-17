"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { Skeleton } from "@/components/ui/Skeleton";
import { isPushSupported, subscribeToPush, unsubscribeFromPush, getCurrentSubscriptionEndpoint } from "@/lib/pushClient";
import { apiJson } from "@/lib/apiFetch";
import { useToast } from "@/components/ui/Toast";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

const apiFetch = apiJson;

type Preferences = {
  reminderEnabled: boolean;
  reminderTime: string; // "HH:MM" atau "HH:MM:SS"
  timezone: string;
};

function toTimeInputValue(t: string): string {
  return t.slice(0, 5); // "20:00:00" -> "20:00"
}

export function NotificationSettings() {
  const { showToast } = useToast();
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [isSubscribedHere, setIsSubscribedHere] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<Preferences>("/api/notifications/preferences"),
      getCurrentSubscriptionEndpoint(),
    ])
      .then(([data, endpoint]) => {
        setPrefs(data);
        setIsSubscribedHere(Boolean(endpoint));
      })
      .catch((err: unknown) => setMessage({ type: "error", text: err instanceof Error ? err.message : "Gagal memuat preferensi notifikasi" }))
      .finally(() => setLoading(false));
  }, []);

  const savePrefs = async (next: Preferences) => {
    setSaving(true);
    setMessage(null);
    try {
      const updated = await apiFetch<Preferences>("/api/notifications/preferences", "PATCH", next);
      setPrefs(updated);
      showToast({ type: "success", message: "Preferensi notifikasi berhasil disimpan" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan preferensi";
      setMessage({ type: "error", text: msg });
      showToast({ type: "error", message: msg });
    } finally {
      setSaving(false);
    }
  };

  const handleEnableDevice = async () => {
    setSubscribing(true);
    setMessage(null);
    try {
      const sub = await subscribeToPush(VAPID_PUBLIC_KEY);
      await apiFetch("/api/notifications/subscribe", "POST", sub);
      setIsSubscribedHere(true);
      setMessage({ type: "success", text: "Notifikasi berhasil diaktifkan di perangkat ini" });
      showToast({ type: "success", message: "Notifikasi push berhasil diaktifkan" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal mengaktifkan notifikasi";
      setMessage({ type: "error", text: msg });
      showToast({ type: "error", message: msg });
    } finally {
      setSubscribing(false);
    }
  };

  const handleDisableDevice = async () => {
    setSubscribing(true);
    setMessage(null);
    try {
      const endpoint = await getCurrentSubscriptionEndpoint();
      await unsubscribeFromPush();
      if (endpoint) await apiFetch("/api/notifications/subscribe", "DELETE", { endpoint });
      setIsSubscribedHere(false);
      showToast({ type: "success", message: "Notifikasi push berhasil dinonaktifkan" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menonaktifkan notifikasi";
      setMessage({ type: "error", text: msg });
      showToast({ type: "error", message: msg });
    } finally {
      setSubscribing(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setMessage(null);
    try {
      await apiFetch("/api/notifications/test", "POST");
      setMessage({ type: "success", text: "Notifikasi uji terkirim — cek notifikasi di perangkatmu" });
      showToast({ type: "info", message: "Notifikasi uji terkirim" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal mengirim notifikasi uji";
      setMessage({ type: "error", text: msg });
      showToast({ type: "error", message: msg });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <Skeleton className="h-4 w-48 mb-2" />
        <Skeleton className="h-3 w-64 mb-4" />
        <div className="flex items-center justify-between py-1">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-6 w-11 rounded-full" />
        </div>
      </Card>
    );
  }

  if (!prefs) return null;

  return (
    <Card>
      <h2 className="text-base font-semibold text-text-primary mb-1">Notifikasi Pengingat Harian</h2>
      <p className="text-xs text-text-muted mb-4">
        Dapatkan pengingat kalau belum mencatat transaksi apa pun di hari itu.
      </p>

      <div className="space-y-4">
        <Toggle
          id="reminder-enabled"
          checked={prefs.reminderEnabled}
          onChange={(checked) => savePrefs({ ...prefs, reminderEnabled: checked })}
          label={prefs.reminderEnabled ? "Pengingat aktif" : "Pengingat nonaktif"}
          disabled={saving}
        />

        <div>
          <label htmlFor="reminder-time" className="block text-sm font-medium text-text-secondary mb-1">Jam pengingat</label>
          <input
            id="reminder-time"
            type="time"
            className="w-full sm:w-40 px-3 py-2.5 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/30 transition-shadow"
            value={toTimeInputValue(prefs.reminderTime)}
            disabled={saving}
            onChange={(e) => setPrefs({ ...prefs, reminderTime: e.target.value })}
            onBlur={() => savePrefs(prefs)}
          />
        </div>

        {!isPushSupported() ? (
          <p className="text-xs text-text-muted px-3 py-2.5 bg-surface-hover rounded-lg">
            Browser ini tidak mendukung push notification.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {isSubscribedHere ? (
              <Button type="button" variant="outline" size="sm" loading={subscribing} onClick={handleDisableDevice}>
                Nonaktifkan di Perangkat Ini
              </Button>
            ) : (
              <Button type="button" variant="secondary" size="sm" loading={subscribing} onClick={handleEnableDevice}>
                Aktifkan Notifikasi di Perangkat Ini
              </Button>
            )}
            <Button type="button" variant="ghost" size="sm" loading={testing} disabled={!isSubscribedHere} onClick={handleTest}>
              Test Notifikasi
            </Button>
          </div>
        )}

        {message && (
          <div
            role={message.type === "error" ? "alert" : "status"}
            className={`p-3 text-sm rounded-xl ${
              message.type === "success"
                ? "bg-brand-soft border border-brand-soft-border text-brand"
                : "bg-danger-soft border border-danger-soft-border text-danger-text"
            }`}
          >
            {message.text}
          </div>
        )}
      </div>
    </Card>
  );
}
