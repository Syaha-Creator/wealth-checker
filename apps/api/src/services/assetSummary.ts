// Ringkasan Aset Barang & Investasi (Fase 2 Sprint 11 & 12) — pure function,
// pola sama dengan debtReceivable.ts agar bisa di-unit-test tanpa database.

interface AssetRow {
  id: string;
  namaAset: string;
  jumlah: string | number;
  hargaBeliRataRata: string | number;
}

export interface AssetSummaryItem {
  id: string;
  namaAset: string;
  jumlah: number;
  hargaBeliRataRata: number;
  nilaiSaatIni: number;
}

export interface AssetSummary {
  totalNilai: number;
  totalUntungRugi: number;
  items: AssetSummaryItem[];
}

/**
 * `untungRugiRows` berasal dari histori transaksi jual (jual_barang/jual_investasi)
 * — bug hunt catatan desain: transaksi beli/jual TIDAK bisa dihapus/diedit
 * (moving average tidak bisa di-replay), jadi SUM ini selalu akurat mewakili
 * seluruh histori realized profit/loss, tidak seperti sisaSaldo debt/receivable
 * yang bisa berubah lewat reversal.
 */
export function calculateAssetSummary(
  rows: AssetRow[],
  untungRugiRows: { untungRugi: string | number | null }[],
): AssetSummary {
  const items: AssetSummaryItem[] = rows
    .map((r) => {
      const jumlah = Number(r.jumlah);
      const hargaBeliRataRata = Number(r.hargaBeliRataRata);
      return {
        id: r.id,
        namaAset: r.namaAset,
        jumlah,
        hargaBeliRataRata,
        nilaiSaatIni: jumlah * hargaBeliRataRata,
      };
    })
    .sort((a, b) => b.nilaiSaatIni - a.nilaiSaatIni);

  const totalNilai = items.reduce((s, i) => s + i.nilaiSaatIni, 0);
  const totalUntungRugi = untungRugiRows.reduce((s, t) => s + Number(t.untungRugi ?? 0), 0);

  return { totalNilai, totalUntungRugi, items };
}
