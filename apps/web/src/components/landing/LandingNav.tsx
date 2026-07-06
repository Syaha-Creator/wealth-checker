"use client";

import Link from "next/link";
import { useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";

const NAV_LINKS = [
  { href: "#fitur", label: "Fitur" },
  { href: "#cara-kerja", label: "Cara Kerja" },
  { href: "#mulai", label: "Mulai" },
];

export function LandingNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-bg/80 backdrop-blur-md">
      <nav className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4" aria-label="Navigasi utama">
        <Link href="/" className="flex items-center gap-2 shrink-0" onClick={() => setOpen(false)}>
          <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center text-brand-text-on font-bold text-sm" aria-hidden="true">
            W
          </div>
          <span className="font-semibold text-text-primary">Wealth Checker</span>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-text-secondary hover:text-text-primary px-3 py-2 rounded-lg hover:bg-surface-hover transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/auth/login"
            className="hidden sm:inline-flex text-sm text-text-secondary hover:text-text-primary px-3 py-2 rounded-lg hover:bg-surface-hover transition-colors"
          >
            Masuk
          </Link>
          <Link
            href="/auth/register"
            className="hidden sm:inline-flex text-sm bg-brand hover:bg-brand-hover text-brand-text-on font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Mulai Gratis
          </Link>
          <button
            type="button"
            className="md:hidden p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
            aria-label={open ? "Tutup menu" : "Buka menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>
        </div>
      </nav>

      {open && (
        <div className="md:hidden border-t border-border bg-surface px-4 py-4 space-y-1">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="block text-sm text-text-secondary hover:text-text-primary px-3 py-2.5 rounded-lg hover:bg-surface-hover transition-colors"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <div className="pt-3 mt-2 border-t border-border flex flex-col gap-2">
            <Link href="/auth/login" className="text-sm text-center text-text-secondary hover:text-text-primary px-3 py-2.5 rounded-lg border border-border" onClick={() => setOpen(false)}>
              Masuk
            </Link>
            <Link href="/auth/register" className="text-sm text-center bg-brand hover:bg-brand-hover text-brand-text-on font-medium px-3 py-2.5 rounded-lg" onClick={() => setOpen(false)}>
              Mulai Gratis
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
