import Link from "next/link";

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
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-emerald-950 text-white flex flex-col">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-slate-950 font-bold text-sm" aria-hidden="true">
            W
          </div>
          <span className="font-semibold text-white">WealthChecker</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/auth/login"
            className="text-sm text-slate-400 hover:text-white transition-colors px-4 py-2"
          >
            Masuk
          </Link>
          <Link
            href="/auth/register"
            className="text-sm bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Mulai Gratis
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20 max-w-4xl mx-auto w-full">
        <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium px-3 py-1.5 rounded-full mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
          Beta — Gratis untuk semua pengguna
        </div>

        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-white leading-tight mb-6">
          Lacak perjalanan{" "}
          <span className="text-emerald-400">kebebasan finansial</span>{" "}
          kamu
        </h1>

        <p className="text-lg text-slate-400 max-w-2xl leading-relaxed mb-10">
          Pantau aset likuid, investasi, utang, dan progres menuju financial
          freedom — semuanya dalam satu dashboard yang bersih dan sederhana.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/auth/register"
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-8 py-3.5 rounded-xl text-base transition-colors"
          >
            Mulai Sekarang →
          </Link>
          <Link
            href="/auth/register"
            className="border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white px-8 py-3.5 rounded-xl text-base transition-colors"
          >
            Daftar Gratis
          </Link>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-20 w-full text-left">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 hover:border-emerald-500/30 transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3">
                {f.icon}
              </div>
              <h3 className="font-semibold text-white mb-1.5">{f.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-slate-600 text-sm">
        © {new Date().getFullYear()} WealthChecker · Dibuat untuk kebebasan finansial
      </footer>
    </div>
  );
}
