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

  const alokasi: BudgetAllocationItem[] = raw
    .filter((r) => r.nama && Number(r.persen) > 0)
    .map((r) => {
      const persen = Number(r.persen);
      return {
        kategori: r.nama as string,
        persen,
        nominal: Math.round(rencanaPemasukanBulanan * (persen / 100)),
      };
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
