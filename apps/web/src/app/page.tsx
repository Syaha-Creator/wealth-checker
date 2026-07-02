import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

const features = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
      </svg>
    ),
    title: "Level Kebebasan Finansial",
    desc: "Tau posisi kamu di mana — dari Level 1 sampai Level 7 financial freedom.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
    title: "Ringkasan Kekayaan Bersih",
    desc: "Hitung total aset minus utang secara otomatis, update real-time.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    title: "Lacak Dream Goals",
    desc: "Set target finansial dan pantau progres kamu setiap bulan.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-bg text-text-primary flex flex-col relative overflow-hidden">
      {/* Ambient brand glow — subtle in both themes */}
      <div
        className="pointer-events-none absolute inset-x-0 -top-40 h-120 bg-brand/10 blur-3xl"
        style={{ maskImage: "radial-gradient(ellipse 60% 60% at 50% 0%, black, transparent)" }}
        aria-hidden="true"
      />

      {/* Navbar */}
      <nav className="relative flex items-center justify-between px-6 py-5 max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center text-brand-text-on font-bold text-sm" aria-hidden="true">
            W
          </div>
          <span className="font-semibold text-text-primary">WealthChecker</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/auth/login"
            className="text-sm text-text-secondary hover:text-text-primary transition-colors px-4 py-2"
          >
            Masuk
          </Link>
          <Link
            href="/auth/register"
            className="text-sm bg-brand hover:bg-brand-hover text-brand-text-on font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Mulai Gratis
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="relative flex-1 flex flex-col items-center justify-center text-center px-6 py-20 max-w-4xl mx-auto w-full">
        <div className="inline-flex items-center gap-2 bg-brand-soft border border-brand-soft-border text-brand text-xs font-medium px-3 py-1.5 rounded-full mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" aria-hidden="true" />
          Beta — Gratis untuk semua pengguna
        </div>

        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-text-primary leading-tight mb-6">
          Lacak perjalanan{" "}
          <span className="text-brand">kebebasan finansial</span>{" "}
          kamu
        </h1>

        <p className="text-lg text-text-secondary max-w-2xl leading-relaxed mb-10">
          Pantau aset likuid, investasi, utang, dan progres menuju financial
          freedom — semuanya dalam satu dashboard yang bersih dan sederhana.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/auth/register"
            className="bg-brand hover:bg-brand-hover text-brand-text-on font-semibold px-8 py-3.5 rounded-xl text-base transition-colors"
          >
            Mulai Sekarang →
          </Link>
          <Link
            href="/auth/register"
            className="border border-border-strong hover:border-brand text-text-secondary hover:text-text-primary px-8 py-3.5 rounded-xl text-base transition-colors"
          >
            Daftar Gratis
          </Link>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-20 w-full text-left">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-surface border border-border rounded-xl p-5 hover:border-brand/40 transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-brand-soft border border-brand-soft-border flex items-center justify-center text-brand mb-3">
                {f.icon}
              </div>
              <h3 className="font-semibold text-text-primary mb-1.5">{f.title}</h3>
              <p className="text-sm text-text-secondary leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative text-center py-6 text-text-muted text-sm">
        © {new Date().getFullYear()} WealthChecker · Dibuat untuk kebebasan finansial
      </footer>
    </div>
  );
}
