"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "./apiFetch";


export interface ApiResourceState<T> {
  data: T | null;
  loading: boolean;
  error: string;
  reload: () => void;
}

/**
 * Fetch generik dengan loading/error per-resource (Fase 3 Sprint 20 — "setiap
 * sub-laporan fetch independen ... satu chart gagal tidak memblokir yang
 * lain"). Tiap komponen sub-laporan Analisa punya effect-nya sendiri, jadi
 * secara alami setara dengan Promise.allSettled: gagal di satu resource tidak
 * memengaruhi state resource lain.
 *
 * `path` bernilai `null` untuk skip fetch (mis. menunggu prasyarat lain siap).
 */
export function useApiResource<T>(path: string | null): ApiResourceState<T> {
  const [state, setState] = useState<Omit<ApiResourceState<T>, "reload">>({ data: null, loading: Boolean(path), error: "" });
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    // `path` null: nothing to subscribe to — skip the effect entirely rather
    // than setState-ing a derived "empty" value (that's just computed below,
    // no effect needed for it).
    if (!path) return;

    let cancelled = false;

    // setState calls live inside this async function (not directly in the
    // effect body) so the "kick off loading" update happens as a microtask,
    // matching the .then/.catch updates below in shape.
    async function load() {
      setState((s) => ({ ...s, loading: true, error: "" }));
      try {
        const res = await apiFetch(`${path}`, { credentials: "include" });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? `Gagal memuat data (${res.status})`);
        }
        const json: T = await res.json();
        if (!cancelled) setState({ data: json, loading: false, error: "" });
      } catch (err: unknown) {
        if (!cancelled) setState({ data: null, loading: false, error: err instanceof Error ? err.message : "Gagal memuat data" });
      }
    }
    load();

    return () => {
      cancelled = true;
    };
  }, [path, reloadKey]);

  if (!path) return { data: null, loading: false, error: "", reload };
  return { ...state, reload };
}
