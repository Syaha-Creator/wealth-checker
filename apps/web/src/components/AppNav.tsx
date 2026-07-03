"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";

const navItems = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    href: "/accounts",
    label: "Rekening",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
      </svg>
    ),
  },
  {
    href: "/debts",
    label: "Utang",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    ),
  },
  {
    href: "/transactions/new",
    label: "Catat",
    icon: () => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="12" y1="8" x2="12" y2="16" stroke="currentColor" strokeWidth={2.5} />
        <line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth={2.5} />
      </svg>
    ),
    special: true,
  },
  {
    href: "/transactions",
    label: "Riwayat",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <line x1="9" y1="12" x2="15" y2="12" />
        <line x1="9" y1="16" x2="13" y2="16" />
      </svg>
    ),
  },
  {
    href: "/profile",
    label: "Profil",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
];

// Pick the most specific (longest) matching href so nested routes like
// /transactions/new don't also light up the /transactions nav item.
function useActiveHref(pathname: string) {
  return navItems
    .map((item) => item.href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];
}

export function AppNav() {
  const pathname = usePathname();
  const activeHref = useActiveHref(pathname);

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden md:flex flex-col fixed left-0 top-0 h-full w-60 bg-surface border-r border-border z-40 py-6" aria-label="Navigasi utama">
        <div className="px-6 mb-8 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand flex items-center justify-center text-brand-text-on font-bold text-xs shrink-0" aria-hidden="true">W</div>
          <span className="text-base font-bold text-text-primary">Wealth Checker</span>
        </div>
        <div className="flex flex-col gap-1 px-3 flex-1">
          {navItems.map((item) => {
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
        <div className="px-3 pt-3 border-t border-border">
          <ThemeToggle variant="pill" className="w-full justify-start" />
        </div>
      </nav>

      {/* Mobile bottom nav */}
      {/* Medium #10 (bug hunt): 6 item dengan `min-w-[56px]` fixed (336px) bisa
          overflow/clip di layar sempit (<=375px, mis. iPhone SE). Ganti ke
          `flex-1 min-w-0` agar tiap item menyusut proporsional mengikuti lebar
          viewport alih-alih memaksakan lebar minimum tetap. */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-border z-40 safe-area-pb" aria-label="Navigasi utama">
        <div className="flex items-end justify-between px-1 pt-2 pb-3">
          {navItems.map((item) => {
            const active = item.href === activeHref;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 flex-1 min-w-0 px-0.5 ${
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
