"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { HouseholdSwitcher } from "@/components/HouseholdSwitcher";

interface NavItem {
  href: string;
  label: string;
  icon: (active: boolean) => ReactNode;
  special?: boolean;
}

const dashboardItem: NavItem = {
  href: "/dashboard",
  label: "Dashboard",
  icon: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
};

const accountsItem: NavItem = {
  href: "/accounts",
  label: "Rekening",
  icon: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  ),
};

const debtsItem: NavItem = {
  href: "/debts",
  label: "Utang & Piutang",
  icon: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  ),
};

const assetsItem: NavItem = {
  // Sprint 11/12: satu item gabungan "Aset" untuk barang & investasi (bukan
  // dua item terpisah) — lihat catatan Medium #10 di bug-hunt plan soal nav
  // mobile yang sudah padat.
  href: "/assets",
  label: "Aset",
  icon: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" />
      <path d="M3 8l9 5 9-5M12 13v8" />
    </svg>
  ),
};

const catatItem: NavItem = {
  href: "/transactions/new",
  label: "Catat",
  icon: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="8" x2="12" y2="16" stroke="currentColor" strokeWidth={2.5} />
      <line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth={2.5} />
    </svg>
  ),
  special: true,
};

const riwayatItem: NavItem = {
  href: "/transactions",
  label: "Riwayat",
  icon: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="13" y2="16" />
    </svg>
  ),
};

const analisaItem: NavItem = {
  // Fase 3 Sprint 20: Analisa terpadu (kekayaan bersih, laba rugi, budgeting,
  // dana darurat, kebutuhan pokok, pemasukan).
  href: "/analytics",
  label: "Analisa",
  icon: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
};

const dreamItem: NavItem = {
  // Fase 3 Sprint 21: Dream Tracker.
  href: "/dream-tracker",
  label: "Impian",
  icon: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21c-4.5-3-8-6.5-8-10.5A5.5 5.5 0 0112 6a5.5 5.5 0 018 4.5c0 4-3.5 7.5-8 10.5z" />
    </svg>
  ),
};

const profileItem: NavItem = {
  href: "/profile",
  label: "Profil",
  icon: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
};

// Reachable only via Dashboard's secondary hub list and the mobile "Lainnya"
// hub — not important/frequent enough to earn a primary nav slot, but still
// need to count toward active-state detection below.
const budgetingItem: NavItem = {
  href: "/budgeting",
  label: "Budgeting Advisor",
  icon: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12V7H5a2 2 0 010-4h14v4" />
      <path d="M3 5v14a2 2 0 002 2h16v-5" />
      <path d="M18 12a2 2 0 000 4h4v-4z" />
    </svg>
  ),
};

const retirementItem: NavItem = {
  href: "/retirement-plan",
  label: "Rencana Pensiun & Warisan",
  icon: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  ),
};

const healthItem: NavItem = {
  href: "/health-checkup",
  label: "Financial Health Check-up",
  icon: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 10-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z" />
    </svg>
  ),
};

const moreItem: NavItem = {
  href: "/more",
  label: "Lainnya",
  icon: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" aria-hidden="true">
      <circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  ),
};

// Desktop sidebar: full set of destinations, grouped so the four
// "kelola data keuangan" pages (previously mixed in with everything else)
// read as one cluster instead of nine flat, same-weight items.
const desktopGroups: { label?: string; items: NavItem[] }[] = [
  { items: [dashboardItem, catatItem, riwayatItem, analisaItem] },
  { label: "Data Keuangan", items: [accountsItem, debtsItem, assetsItem, dreamItem] },
  { items: [profileItem] },
];

// Mobile bottom nav: only the 5 items used often enough to deserve a
// thumb-reachable slot (was 9 — see audit finding 1.1). Everything else
// (Rekening/Utang/Aset/Impian/Profil/Budgeting/Retirement/Health) lives
// behind the "Lainnya" hub at /more.
const mobileNavItems: NavItem[] = [dashboardItem, riwayatItem, catatItem, analisaItem, moreItem];

// Any route not covered by a primary mobile tab rolls up into "Lainnya" for
// active-state purposes, so the mobile nav still highlights something
// sensible while browsing e.g. /accounts or /profile.
const secondaryItems: NavItem[] = [accountsItem, debtsItem, assetsItem, dreamItem, profileItem, budgetingItem, retirementItem, healthItem, moreItem];
const allItemsForActiveMatch: NavItem[] = [dashboardItem, riwayatItem, catatItem, analisaItem, ...secondaryItems];

// Pick the most specific (longest) matching href so nested routes like
// /transactions/new don't also light up the /transactions nav item.
function useActiveHref(pathname: string) {
  return allItemsForActiveMatch
    .map((item) => item.href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];
}

export function AppNav() {
  const pathname = usePathname();
  const activeHref = useActiveHref(pathname);
  const isSecondaryActive = secondaryItems.some((item) => item.href === activeHref);

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden md:flex flex-col fixed left-0 top-0 h-full w-60 bg-surface border-r border-border z-40 py-6" aria-label="Navigasi utama">
        <div className="px-6 mb-8 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand flex items-center justify-center text-brand-text-on font-bold text-xs shrink-0" aria-hidden="true">W</div>
          <span className="text-base font-bold text-text-primary">Wealth Checker</span>
        </div>
        <div className="px-3 mb-4">
          <HouseholdSwitcher />
        </div>
        <div className="flex flex-col gap-1 px-3 flex-1">
          {desktopGroups.map((group, gi) => (
            <div key={gi} className={gi > 0 ? "mt-3 pt-3 border-t border-border" : ""}>
              {group.label && (
                <p className="px-3 mb-1 text-xs font-semibold text-text-muted uppercase tracking-wide">{group.label}</p>
              )}
              {group.items.map((item) => {
                const active = item.href === activeHref;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-label={item.label}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      item.special
                        ? "bg-brand text-brand-text-on hover:bg-brand-hover my-1"
                        : active
                        ? "bg-brand-soft text-brand"
                        : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                    }`}
                  >
                    <span className={item.special ? "text-brand-text-on" : active ? "text-brand" : "text-text-muted"}>
                      {item.icon(active)}
                    </span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
        <div className="px-3 pt-3 border-t border-border">
          <ThemeToggle variant="pill" className="w-full justify-start" />
        </div>
      </nav>

      {/* Mobile bottom nav — 5 items max (Dashboard, Riwayat, Catat, Analisa,
          Lainnya) so every tap target stays comfortably above the 44px
          minimum even on the narrowest supported phones (~360px). */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-border z-40 safe-area-pb" aria-label="Navigasi utama">
        <div className="flex items-end justify-between px-1 pt-2 pb-3">
          {mobileNavItems.map((item) => {
            const active = item.href === moreItem.href ? isSecondaryActive : item.href === activeHref;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 flex-1 min-w-0 px-0.5 min-h-11 justify-center ${
                  item.special ? "-mt-4" : ""
                }`}
              >
                {item.special ? (
                  <span className="w-14 h-14 rounded-full bg-brand text-brand-text-on flex items-center justify-center shadow-lg shadow-brand/30">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden="true">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </span>
                ) : (
                  <span className={active ? "text-brand" : "text-text-muted"}>
                    {item.icon(active)}
                  </span>
                )}
                <span className={`text-[10px] font-medium truncate max-w-full ${
                  item.special ? "text-brand" : active ? "text-brand" : "text-text-muted"
                }`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
