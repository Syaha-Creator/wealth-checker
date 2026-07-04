"use client";

import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppNav } from "@/components/AppNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { HouseholdSwitcher } from "@/components/HouseholdSwitcher";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && !session) {
      router.replace("/auth/login");
    }
  }, [session, isPending, router]);

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-bg">
      <AppNav />

      {/* Mobile top bar: brand + household switcher + theme toggle (sidebar carries these on desktop) */}
      <div className="md:hidden flex items-center justify-between gap-2 px-4 py-3 bg-surface border-b border-border sticky top-0 z-30">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-6 h-6 rounded-md bg-brand flex items-center justify-center text-brand-text-on font-bold text-[11px]" aria-hidden="true">W</div>
          <span className="text-sm font-bold text-text-primary hidden sm:inline">Wealth Checker</span>
        </div>
        <div className="flex-1 max-w-[55%]">
          <HouseholdSwitcher />
        </div>
        <ThemeToggle />
      </div>

      {/* Content area: sidebar offset + wider column on desktop, bottom-nav padding on mobile */}
      <main className="md:ml-60 pb-24 md:pb-10 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">{children}</div>
      </main>
    </div>
  );
}
