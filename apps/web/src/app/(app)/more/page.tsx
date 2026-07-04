"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";

interface MoreLink {
  href: string;
  label: string;
  description: string;
  iconBg: string;
  iconColor: string;
  icon: React.ReactNode;
}

const ChevronRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-text-muted shrink-0" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
);

function LinkRow({ item }: { item: MoreLink }) {
  return (
    <Link href={item.href} className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-surface-hover transition-colors border-b border-border last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        <span className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${item.iconBg} ${item.iconColor}`} aria-hidden="true">
          {item.icon}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">{item.label}</p>
          <p className="text-xs text-text-muted truncate">{item.description}</p>
        </div>
      </div>
      <ChevronRight />
    </Link>
  );
}

// Restrukturisasi navigasi mobile (audit UI/UX temuan 1.1): bottom nav
// dipangkas dari 9 menjadi 5 item (Dashboard, Riwayat, Catat, Analisa,
// Lainnya). Semua tujuan yang tersisa — termasuk 3 halaman perencanaan yang
// sebelumnya hanya bisa diakses lewat hub di Dashboard — dikumpulkan di sini
// supaya tetap satu-dua tap jauhnya, meniru pola "Lainnya"/"More" di
// aplikasi perbankan Indonesia (Livin', Jenius, GoPay, dst).
const KELOLA_LINKS: MoreLink[] = [
  {
    href: "/accounts",
    label: "Rekening",
    description: "Kas dan tabungan Anda",
    iconBg: "bg-brand-soft",
    iconColor: "text-brand",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>,
  },
  {
    href: "/debts",
    label: "Utang & Piutang",
    description: "Lacak pinjaman dan piutang Anda",
    iconBg: "bg-warning-soft",
    iconColor: "text-warning-text",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5M2 12l10 5 10-5" /></svg>,
  },
  {
    href: "/assets",
    label: "Aset",
    description: "Lacak barang & investasi Anda",
    iconBg: "bg-info-soft",
    iconColor: "text-info-text",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" /><path d="M3 8l9 5 9-5M12 13v8" /></svg>,
  },
  {
    href: "/dream-tracker",
    label: "Impian",
    description: "Lacak progres tujuan finansialmu",
    iconBg: "bg-danger-soft",
    iconColor: "text-danger-text",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M12 21c-4.5-3-8-6.5-8-10.5A5.5 5.5 0 0112 6a5.5 5.5 0 018 4.5c0 4-3.5 7.5-8 10.5z" /></svg>,
  },
];

const PERENCANAAN_LINKS: MoreLink[] = [
  {
    href: "/health-checkup",
    label: "Financial Health Check-up",
    description: "Diagnosa lengkap kondisi keuanganmu",
    iconBg: "bg-brand-soft",
    iconColor: "text-brand",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 10-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z" /></svg>,
  },
  {
    href: "/budgeting",
    label: "Budgeting Advisor",
    description: "Rencana alokasi anggaran bulanan",
    iconBg: "bg-info-soft",
    iconColor: "text-info-text",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M21 12V7H5a2 2 0 010-4h14v4" /><path d="M3 5v14a2 2 0 002 2h16v-5" /><path d="M18 12a2 2 0 000 4h4v-4z" /></svg>,
  },
  {
    href: "/retirement-plan",
    label: "Rencana Pensiun & Warisan",
    description: "Proyeksi dana menuju pensiun",
    iconBg: "bg-brand-soft",
    iconColor: "text-brand",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" fill="currentColor" /></svg>,
  },
];

const AKUN_LINKS: MoreLink[] = [
  {
    href: "/profile",
    label: "Profil",
    description: "Data akun, tema, dan notifikasi",
    iconBg: "bg-surface-hover",
    iconColor: "text-text-secondary",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
  },
];

export default function MorePage() {
  return (
    <div className="max-w-3xl">
      <PageHeader title="Lainnya" subtitle="Semua fitur Wealth Checker dalam satu tempat" />

      <div className="space-y-6">
        <div>
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2 px-1">Kelola Keuangan</h2>
          <Card padding="none" className="overflow-hidden">
            {KELOLA_LINKS.map((item) => <LinkRow key={item.href} item={item} />)}
          </Card>
        </div>

        <div>
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2 px-1">Perencanaan</h2>
          <Card padding="none" className="overflow-hidden">
            {PERENCANAAN_LINKS.map((item) => <LinkRow key={item.href} item={item} />)}
          </Card>
        </div>

        <div>
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2 px-1">Akun</h2>
          <Card padding="none" className="overflow-hidden">
            {AKUN_LINKS.map((item) => <LinkRow key={item.href} item={item} />)}
          </Card>
        </div>
      </div>
    </div>
  );
}
