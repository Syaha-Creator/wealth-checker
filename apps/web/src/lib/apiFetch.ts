// Sprint 27 (Fase 4): wrapper tipis di atas `fetch` bawaan browser — satu-satunya
// perbedaan dari fetch biasa adalah otomatis menyertakan `credentials: "include"`
// (sudah jadi konvensi di semua pemanggilan API sebelum sprint ini) DAN header
// `X-Household-Id` kalau user sedang aktif di household selain yang default
// (lihat household switcher di AppNav.tsx). Middleware `resolveHousehold` di
// backend memvalidasi ulang membership user terhadap header ini di setiap
// request — header ini hanya "preferensi tampilan", bukan sumber kebenaran
// otorisasi (lihat middleware/household.ts di apps/api).
const API = process.env.NEXT_PUBLIC_API_URL ?? "";

export const ACTIVE_HOUSEHOLD_STORAGE_KEY = "wealth-checker:active-household-id";
export const HOUSEHOLD_HEADER = "X-Household-Id";

export function getActiveHouseholdId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_HOUSEHOLD_STORAGE_KEY);
}

export function setActiveHouseholdId(householdId: string | null): void {
  if (typeof window === "undefined") return;
  if (householdId) {
    window.localStorage.setItem(ACTIVE_HOUSEHOLD_STORAGE_KEY, householdId);
  } else {
    window.localStorage.removeItem(ACTIVE_HOUSEHOLD_STORAGE_KEY);
  }
  // Household switcher (AppNav) di tab/komponen lain ikut listen event ini
  // supaya UI selalu konsisten dengan localStorage tanpa perlu full reload —
  // "storage" event bawaan browser TIDAK terpicu di tab yang sama yang menulisnya.
  window.dispatchEvent(new CustomEvent("wealth-checker:household-changed", { detail: householdId }));
}

/** Drop-in replacement untuk `fetch(`${API}${path}`, init)` — lihat catatan di atas modul ini. */
export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const householdId = getActiveHouseholdId();
  const headers = new Headers(init.headers);
  if (householdId) headers.set(HOUSEHOLD_HEADER, householdId);

  return fetch(`${API}${path}`, { ...init, credentials: "include", headers });
}
