"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, SkeletonHero } from "@/components/ui/Skeleton";
import { formatCurrency, formatDateLong } from "@/lib/format";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

type MutationRow = {
  id: string;
  tanggal: string;
  type: string;
  kategori: string | null;
  rincian: string | null;
  nominal: number;
  delta: number;
  saldoSetelah: number;
};

type MutasiResponse = {
  account: { id: string; nama: string; saldoCache: number };
  saldoAwalTurunan: number;
  konsisten: boolean;
  mutasi: MutationRow[];
};

// Sama seperti label di transactions/page.tsx & transactions/[id]/edit — dipertahankan
// lokal karena tiap halaman punya konfigurasi tampilannya sendiri.
const TYPE_LABEL: Record<string, string> = {
  pendapatan: "Pemasukan",
  pengeluaran: "Pengeluaran",
  transfer: "Transfer",
  pinjaman_utang: "Pinjam Utang",
  bayar_utang: "Bayar Utang",
  pemberian_piutang: "Beri Piutang",
  penerimaan_piutang: "Terima Piutang",
  beli_barang: "Beli Barang",
  jual_barang: "Jual Barang",
  beli_investasi: "Investasi",
  jual_investasi: "Cairkan Investasi",
};

function HistoryIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="13" y2="16" />
    </svg>
  );
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="text-center max-w-lg mx-auto" role="alert">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="mx-auto mb-3 text-danger" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <p className="text-sm font-medium text-danger-text mb-1">Gagal memuat mutasi rekening</p>
      <p className="text-xs text-text-muted mb-4">{message}</p>
      <Button variant="danger" size="sm" onClick={onRetry}>Coba Lagi</Button>
    </Card>
  );
}

export default function MutasiRekeningPage() {
  const params = useParams<{ id: string }>();
  const accountId = params.id;
  const [data, setData] = useState<MutasiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/api/accounts/${accountId}/mutasi`, { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? "Rekening tidak ditemukan" : "Gagal memuat mutasi rekening");
        return r.json();
      })
      .then((json: MutasiResponse) => {
        if (!cancelled) setData(json);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Gagal memuat data");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [accountId, retryKey]);

  return (
    <div className="max-w-2xl">
      <PageHeader
        title={data ? `Mutasi ${data.account.nama}` : "Mutasi Rekening"}
        subtitle="Riwayat transaksi & saldo berjalan"
        onBack={() => window.history.back()}
      />

      {loading ? (
        <div className="space-y-3">
          <SkeletonHero className="h-20" />
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : error ? (
        <ErrorBanner message={error} onRetry={() => { setError(""); setLoading(true); setRetryKey((k) => k + 1); }} />
      ) : !data ? null : (
        <div>
          <div className="bg-brand text-white rounded-2xl p-5 mb-6">
            <p className="text-white/70 text-sm">Saldo Saat Ini</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(data.account.saldoCache)}</p>
          </div>

          {data.mutasi.length === 0 ? (
            <EmptyState
              icon={<HistoryIcon />}
              title="Belum ada mutasi"
              description="Rekening ini belum memiliki transaksi tercatat"
            />
          ) : (
            <div className="space-y-2">
              {data.mutasi.map((row) => (
                <Card key={row.id} padding="sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">
                        {TYPE_LABEL[row.type] ?? row.type}
                        {row.kategori ? ` · ${row.kategori}` : ""}
                      </p>
                      <p className="text-xs text-text-muted mt-0.5">{formatDateLong(row.tanggal)}</p>
                      {row.rincian && <p className="text-xs text-text-muted mt-0.5 truncate">{row.rincian}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-semibold ${row.delta >= 0 ? "text-brand" : "text-danger-text"}`}>
                        {row.delta >= 0 ? "+" : ""}{formatCurrency(row.delta)}
                      </p>
                      <p className="text-xs text-text-muted mt-0.5">Saldo: {formatCurrency(row.saldoSetelah)}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
