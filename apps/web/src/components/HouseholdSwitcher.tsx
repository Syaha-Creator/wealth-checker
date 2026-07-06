"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { apiFetch, getActiveHouseholdId, setActiveHouseholdId } from "@/lib/apiFetch";

interface HouseholdListItem {
  id: string;
  nama: string;
  role: "owner" | "editor" | "viewer";
  memberCount: number;
}

function ChevronDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function HouseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d="M3 10.5L12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 001 1h12a1 1 0 001-1V9.5" />
    </svg>
  );
}

// Sprint 27 (Fase 4): switcher household — sengaja tetap disembunyikan kalau
// user hanya punya 1 household (mayoritas user baru) supaya tidak menambah
// noise di nav untuk kasus yang paling umum.
export function HouseholdSwitcher({ className = "" }: { className?: string }) {
  const [households, setHouseholds] = useState<HouseholdListItem[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/households")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((list: HouseholdListItem[]) => {
        if (cancelled) return;
        setHouseholds(list);
        const stored = getActiveHouseholdId();
        const storedStillValid = stored !== null && list.some((h) => h.id === stored);
        // Bugfix: kalau household yang tersimpan di localStorage sudah tidak
        // valid lagi (mis. owner mengeluarkan user ini dari household tsb —
        // lihat DELETE /households/members/:userId), JANGAN cuma fallback di
        // state lokal komponen ini — apiFetch() membaca localStorage LANGSUNG
        // di setiap request (lihat lib/apiFetch.ts), jadi tanpa persist balik
        // ke localStorage di sini, seluruh fetch household-scoped lain di app
        // (dashboard, transaksi, dst) akan terus mengirim id basi itu dan
        // selamanya kena 403 "Anda bukan anggota household ini" sampai user
        // membersihkan localStorage manual.
        const resolvedId = storedStillValid ? stored : list[0]?.id ?? null;
        if (!storedStillValid) setActiveHouseholdId(resolvedId);
        setActiveId(resolvedId);
      })
      .catch(() => {
        if (!cancelled) setHouseholds([]);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleSwitch = async (householdId: string) => {
    if (householdId === activeId) { setOpen(false); return; }
    setSwitching(true);
    try {
      const res = await apiFetch("/api/households/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ householdId }),
      });
      if (!res.ok) throw new Error();
      setActiveHouseholdId(householdId);
      window.location.reload();
    } catch {
      setSwitching(false);
      setOpen(false);
    }
  };

  if (!households || households.length <= 1) return null;

  const active = households.find((h) => h.id === activeId) ?? households[0];

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={switching}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors border border-border"
      >
        <HouseIcon />
        <span className="flex-1 min-w-0 truncate text-left">{active.nama}</span>
        <ChevronDownIcon />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 md:right-auto md:w-64 mt-1.5 bg-surface border border-border rounded-xl shadow-lg z-50 py-1.5 max-h-72 overflow-y-auto"
        >
          {households.map((h) => (
            <button
              key={h.id}
              type="button"
              role="option"
              aria-selected={h.id === activeId}
              onClick={() => handleSwitch(h.id)}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors ${
                h.id === activeId ? "text-brand bg-brand-soft" : "text-text-secondary hover:bg-surface-hover"
              }`}
            >
              <span className="min-w-0 truncate">{h.nama}</span>
              <span className="text-xs text-text-muted shrink-0">{h.memberCount} orang</span>
            </button>
          ))}
          <div className="border-t border-border mt-1.5 pt-1.5">
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm text-brand hover:bg-surface-hover transition-colors"
            >
              Kelola Household
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
