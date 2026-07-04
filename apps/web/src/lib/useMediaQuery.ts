"use client";

import { useEffect, useState } from "react";

// Recharts props like `<YAxis width>` need a real pixel number, not a
// Tailwind class, so components that want responsive chart internals (axis
// width, tick count, etc.) subscribe to a media query via this hook instead.
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}
