"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}

interface ThemeToggleProps {
  className?: string;
  variant?: "icon" | "pill";
}

export function ThemeToggle({ className = "", variant = "icon" }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid rendering theme-dependent UI until mounted to prevent hydration mismatch.
  // Deferred via microtask so this isn't a direct synchronous setState-in-effect call.
  useEffect(() => {
    const markMounted = async () => setMounted(true);
    markMounted();
  }, []);

  const isDark = mounted && resolvedTheme === "dark";
  const toggle = () => setTheme(isDark ? "light" : "dark");

  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label={isDark ? "Ganti ke mode terang" : "Ganti ke mode gelap"}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors ${className}`}
      >
        {mounted ? (isDark ? <SunIcon /> : <MoonIcon />) : <span className="w-[18px] h-[18px]" />}
        {isDark ? "Mode Terang" : "Mode Gelap"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Ganti ke mode terang" : "Ganti ke mode gelap"}
      className={`inline-flex items-center justify-center w-9 h-9 rounded-lg text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors ${className}`}
    >
      {mounted ? (isDark ? <SunIcon /> : <MoonIcon />) : <span className="w-[18px] h-[18px]" />}
    </button>
  );
}
