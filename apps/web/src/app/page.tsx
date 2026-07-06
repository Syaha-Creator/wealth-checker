import Link from "next/link";
import { LandingNav } from "@/components/landing/LandingNav";
import { DashboardPreview } from "@/components/landing/DashboardPreview";

const FEATURES = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
      </svg>
    ),
    title: "Level Kebebasan Finansial",
    desc: "Lihat posisimu dari Level 0–6 dengan diagnosa dan saran langkah berikutnya yang personal.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
      </svg>
    ),
    title: "Rekening & Arus Kas",
    desc: "Kelola kas, tabungan, dan e-wallet. Pantau pemasukan vs pengeluaran bulan ini secara real-time.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
    title: "Analisa & Laporan",
    desc: "Grafik kekayaan bersih, laba rugi bulanan, budgeting, dan dana darurat — semua dalam satu halaman Analisa.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    ),
    title: "Utang, Piutang & Aset",
    desc: "Catat cicilan utang, piutang ke teman, barang, dan investasi — termasuk harga rata-rata otomatis.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    title: "Dream Tracker & Pensiun",
    desc: "Tetapkan impian finansial, lacak progress, dan proyeksikan kebutuhan dana pensiun & warisan.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
    title: "Rumah Tangga Bersama",
    desc: "Undang pasangan atau anggota keluarga untuk melacak keuangan rumah tangga dalam satu workspace.",
  },
];

const STEPS = [
  {
    step: "01",
    title: "Daftar & setup rekening",
    desc: "Buat akun gratis, lalu tambahkan rekening bank, e-wallet, atau tabungan pertama kamu.",
  },
  {
    step: "02",
    title: "Catat transaksi harian",
    desc: "Pemasukan, pengeluaran, transfer, utang, aset — semua tercatat dalam hitungan detik.",
  },
  {
    step: "03",
    title: "Pantau level & rencana",
    desc: "Dashboard menunjukkan kekayaan bersih, level kebebasan finansial, dan progress impianmu.",
  },
];

const TRUST_POINTS = [
  "Gratis selama beta",
  "Bahasa Indonesia & format Rupiah",
  "Mode gelap & terang",
  "Data milik kamu sendiri",
];

export default function Home() {
  return (
    <div className="min-h-screen bg-bg text-text-primary flex flex-col relative overflow-x-hidden">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div
          className="absolute inset-x-0 -top-32 h-96 bg-brand/12 blur-3xl"
          style={{ maskImage: "radial-gradient(ellipse 70% 60% at 50% 0%, black, transparent)" }}
        />
        <div
          className="absolute -right-32 top-1/3 h-72 w-72 bg-info/8 blur-3xl rounded-full"
        />
      </div>

      <LandingNav />

      {/* Hero */}
      <section className="relative px-4 sm:px-6 pt-12 pb-20 lg:pt-16 lg:pb-28">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 bg-brand-soft border border-brand-soft-border text-brand text-xs font-medium px-3 py-1.5 rounded-full mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" aria-hidden="true" />
              Beta — Gratis untuk semua pengguna
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-bold tracking-tight text-text-primary leading-[1.1] mb-5">
              Kendalikan keuanganmu,{" "}
              <span className="text-brand">satu dashboard</span>{" "}
              untuk semua
            </h1>

            <p className="text-lg text-text-secondary max-w-xl mx-auto lg:mx-0 leading-relaxed mb-8">
              Wealth Checker membantu kamu melacak kekayaan bersih, arus kas, utang, aset,
              dan progress menuju kebebasan finansial — tanpa spreadsheet yang rumit.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-8">
              <Link
                href="/auth/register"
                className="inline-flex items-center justify-center bg-brand hover:bg-brand-hover text-brand-text-on font-semibold px-8 py-3.5 rounded-xl text-base transition-colors shadow-sm"
              >
                Mulai Sekarang
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="ml-1" aria-hidden="true">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
              <Link
                href="/auth/login"
                className="inline-flex items-center justify-center border border-border-strong hover:border-brand text-text-secondary hover:text-text-primary px-8 py-3.5 rounded-xl text-base transition-colors bg-surface/50"
              >
                Sudah punya akun
              </Link>
            </div>

            <ul className="flex flex-wrap gap-x-5 gap-y-2 justify-center lg:justify-start">
              {TRUST_POINTS.map((point) => (
                <li key={point} className="flex items-center gap-1.5 text-xs text-text-muted">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="text-brand shrink-0" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {point}
                </li>
              ))}
            </ul>
          </div>

          <div className="order-first lg:order-last">
            <DashboardPreview />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="fitur" className="relative px-4 sm:px-6 py-20 bg-surface/50 border-y border-border">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <p className="text-xs font-semibold text-brand uppercase tracking-wide mb-2">Fitur Lengkap</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-text-primary mb-4">
              Semua yang kamu butuhkan untuk lacak keuangan
            </h2>
            <p className="text-text-secondary leading-relaxed">
              Dari pencatatan harian sampai perencanaan jangka panjang — dirancang khusus
              untuk kebiasaan finansial pengguna Indonesia.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
            {FEATURES.map((f) => (
              <article
                key={f.title}
                className="bg-surface border border-border rounded-2xl p-6 hover:border-brand/40 hover:shadow-sm transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-brand-soft border border-brand-soft-border flex items-center justify-center text-brand mb-4">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-text-primary mb-2">{f.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{f.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="cara-kerja" className="relative px-4 sm:px-6 py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <p className="text-xs font-semibold text-brand uppercase tracking-wide mb-2">Cara Kerja</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-text-primary mb-4">
              Mulai dalam 3 langkah sederhana
            </h2>
            <p className="text-text-secondary leading-relaxed">
              Tidak perlu setup rumit. Onboarding terpandu akan membantumu siap dalam beberapa menit.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {STEPS.map((s, i) => (
              <div key={s.step} className="relative text-center md:text-left">
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-[calc(50%+2rem)] right-0 h-px bg-border" aria-hidden="true" />
                )}
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand text-brand-text-on font-bold text-lg mb-4">
                  {s.step}
                </div>
                <h3 className="font-semibold text-text-primary text-lg mb-2">{s.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="mulai" className="relative px-4 sm:px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <div className="bg-brand rounded-3xl p-8 sm:p-12 text-center text-brand-text-on relative overflow-hidden">
            <div
              className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"
              aria-hidden="true"
            />
            <div className="relative">
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">
                Siap lacak perjalanan kebebasan finansialmu?
              </h2>
              <p className="text-brand-text-on/80 max-w-lg mx-auto mb-8 leading-relaxed">
                Bergabung sekarang dan mulai dari nol — atau impor saldo awal rekeningmu.
                Setup pertama hanya butuh beberapa menit.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href="/auth/register"
                  className="inline-flex items-center justify-center bg-surface text-text-primary hover:bg-surface-hover font-semibold px-8 py-3.5 rounded-xl text-base transition-colors"
                >
                  Buat Akun Gratis
                </Link>
                <Link
                  href="/auth/login"
                  className="inline-flex items-center justify-center border border-brand-text-on/30 hover:border-brand-text-on/60 text-brand-text-on font-medium px-8 py-3.5 rounded-xl text-base transition-colors"
                >
                  Masuk ke Akun
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-border mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand flex items-center justify-center text-brand-text-on font-bold text-xs" aria-hidden="true">
              W
            </div>
            <span className="text-sm font-medium text-text-primary">Wealth Checker</span>
          </div>
          <p className="text-sm text-text-muted text-center">
            © {new Date().getFullYear()} Wealth Checker · Dibuat untuk kebebasan finansial
          </p>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/auth/login" className="text-text-muted hover:text-text-primary transition-colors">
              Masuk
            </Link>
            <Link href="/auth/register" className="text-brand hover:text-brand-hover font-medium transition-colors">
              Daftar
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
