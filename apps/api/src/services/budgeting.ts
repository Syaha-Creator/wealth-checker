// Budgeting Advisor (Fase 2 Sprint 14) — pure function, pola sama dengan
// debtReceivable.ts/assetSummary.ts agar bisa di-unit-test tanpa database.

interface BudgetAllocationRefRow {
  level: number;
  kategori1Nama: string | null;
  kategori1Persen: string | number | null;
  kategori2Nama: string | null;
  kategori2Persen: string | number | null;
  kategori3Nama: string | null;
  kategori3Persen: string | number | null;
  kategori4Nama: string | null;
  kategori4Persen: string | number | null;
}

export interface BudgetAllocationItem {
  kategori: string;
  persen: number;
  nominal: number;
}

export interface BudgetingAdvice {
  level: number;
  rencanaPemasukanBulanan: number;
  alokasi: BudgetAllocationItem[];
  totalPersen: number;
  sisaTidakTeralokasi: number;
}

/**
 * nominal = rencanaPemasukanBulanan × persentase, dibulatkan ke rupiah penuh.
 * Kategori dengan nama null (level dengan <4 kategori aktif, mis. level 0)
 * difilter, bukan ditampilkan sebagai kategori kosong.
 */
export function calculateBudgetAllocation(
  rencanaPemasukanBulanan: number,
  ref: BudgetAllocationRefRow,
): BudgetingAdvice {
  const raw: { nama: string | null; persen: string | number | null }[] = [
    { nama: ref.kategori1Nama, persen: ref.kategori1Persen },
    { nama: ref.kategori2Nama, persen: ref.kategori2Persen },
    { nama: ref.kategori3Nama, persen: ref.kategori3Persen },
    { nama: ref.kategori4Nama, persen: ref.kategori4Persen },
  ];

  // Medium #3 (bug hunt): membulatkan tiap kategori secara independen bisa
  // membuat totalnya SEDIKIT melebihi rencanaPemasukanBulanan (mis. 9.999.999
  // dengan persentase 35/35/20/10% masing-masing dibulatkan sendiri jadi
  // 3.500.000+3.500.000+2.000.000+1.000.000=10.000.000, melebihi rencana),
  // sementara sisaTidakTeralokasi cuma di-clamp ke 0 dan diam-diam
  // menyembunyikan kelebihan itu. Fix: bulatkan nominal KUMULATIF (rencana ×
  // persentase kumulatif sejauh ini) lalu ambil selisihnya dari kumulatif
  // sebelumnya — setiap kategori menyerap tepat error pembulatan sejauh itu,
  // bukan cuma kategori terakhir, dan totalnya tidak akan pernah melebihi
  // rencana × totalPersen/100 (== rencana kalau totalPersen 100, seperti
  // seluruh data seed level 0-6).
  let kumulatifPersen = 0;
  let kumulatifNominal = 0;
  const alokasi: BudgetAllocationItem[] = raw
    .filter((r) => r.nama && Number(r.persen) > 0)
    .map((r) => {
      const persen = Number(r.persen);
      kumulatifPersen += persen;
      const targetKumulatif = Math.round(rencanaPemasukanBulanan * (kumulatifPersen / 100));
      const nominal = targetKumulatif - kumulatifNominal;
      kumulatifNominal = targetKumulatif;
      return { kategori: r.nama as string, persen, nominal };
    });

  const totalPersen = alokasi.reduce((s, a) => s + a.persen, 0);
  const totalNominal = alokasi.reduce((s, a) => s + a.nominal, 0);

  return {
    level: ref.level,
    rencanaPemasukanBulanan,
    alokasi,
    totalPersen,
    sisaTidakTeralokasi: Math.max(0, rencanaPemasukanBulanan - totalNominal),
  };
}
