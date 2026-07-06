import { describe, it, expect } from "vitest";
import { transactionsListQuerySchema } from "../lib/transactionsListQuerySchema";

type TxRow = {
  id: string;
  tanggal: string;
  createdAt: string;
  kategori: string | null;
  type: string;
};

/** Mirror SQL WHERE + ORDER BY + LIMIT/OFFSET dari GET /api/transactions */
function matchesListFilters(
  row: TxRow,
  from?: string,
  to?: string,
  kategori?: string,
): boolean {
  if (from && row.tanggal < from) return false;
  if (to && row.tanggal > to) return false;
  if (kategori && (row.kategori?.toLowerCase() ?? "") !== kategori.toLowerCase()) return false;
  return true;
}

function listTransactionsPage(
  allRows: TxRow[],
  opts: { from?: string; to?: string; kategori?: string; limit: number; offset: number },
): TxRow[] {
  const filtered = allRows.filter((row) =>
    matchesListFilters(row, opts.from, opts.to, opts.kategori),
  );
  return filtered
    .sort(
      (a, b) =>
        b.tanggal.localeCompare(a.tanggal) || b.createdAt.localeCompare(a.createdAt),
    )
    .slice(opts.offset, opts.offset + opts.limit);
}

function tx(
  id: string,
  tanggal: string,
  kategori: string | null,
  createdAt = `${tanggal}T12:00:00Z`,
): TxRow {
  return { id, tanggal, createdAt, kategori, type: "pengeluaran" };
}

const FIXTURE: TxRow[] = [
  tx("jan-makanan-1", "2026-01-05", "Makanan", "2026-01-05T10:00:00Z"),
  tx("jan-makanan-2", "2026-01-10", "Makanan", "2026-01-10T10:00:00Z"),
  tx("jan-transport", "2026-01-12", "Transportasi", "2026-01-12T10:00:00Z"),
  tx("feb-makanan-1", "2026-02-01", "Makanan", "2026-02-01T10:00:00Z"),
  tx("feb-makanan-2", "2026-02-15", "Makanan", "2026-02-15T10:00:00Z"),
  tx("feb-makanan-3", "2026-02-20", "Makanan", "2026-02-20T10:00:00Z"),
  tx("mar-makanan", "2026-03-01", "Makanan", "2026-03-01T10:00:00Z"),
  tx("mar-belanja", "2026-03-05", "Belanja", "2026-03-05T10:00:00Z"),
];

describe("GET /api/transactions — list query schema", () => {
  it("tanpa from/to/kategori — default limit/offset seperti sebelumnya", () => {
    const parsed = transactionsListQuerySchema.parse({});
    expect(parsed).toEqual({ limit: 50, offset: 0 });
  });

  it("menolak from > to dengan 400 (validasi zod)", () => {
    const parsed = transactionsListQuerySchema.safeParse({
      from: "2026-03-01",
      to: "2026-01-01",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe("from harus <= to");
    }
  });
});

describe("GET /api/transactions — filter & pagination (kontrak SQL)", () => {
  it("tanpa filter mengembalikan seluruh dataset dengan pagination default", () => {
    const page = listTransactionsPage(FIXTURE, { limit: 50, offset: 0 });
    const expected = [...FIXTURE].sort(
      (a, b) =>
        b.tanggal.localeCompare(a.tanggal) || b.createdAt.localeCompare(a.createdAt),
    );
    expect(page).toEqual(expected);
    expect(page).toHaveLength(8);
  });

  it("filter from/to membatasi baris berdasarkan tanggal (inclusive)", () => {
    const page = listTransactionsPage(FIXTURE, {
      from: "2026-01-01",
      to: "2026-01-31",
      limit: 50,
      offset: 0,
    });
    expect(page.map((r) => r.id)).toEqual(["jan-transport", "jan-makanan-2", "jan-makanan-1"]);
  });

  it("filter kategori case-insensitive exact match", () => {
    const page = listTransactionsPage(FIXTURE, {
      kategori: "makanan",
      limit: 50,
      offset: 0,
    });
    expect(page.every((r) => r.kategori?.toLowerCase() === "makanan")).toBe(true);
    expect(page).toHaveLength(6);
    expect(page.some((r) => r.kategori === "Transportasi")).toBe(false);
  });

  it("filter + pagination: offset halaman kedua dari hasil yang sudah difilter", () => {
    const filter = { from: "2026-02-01", to: "2026-02-28", kategori: "Makanan" };
    const page1 = listTransactionsPage(FIXTURE, { ...filter, limit: 2, offset: 0 });
    const page2 = listTransactionsPage(FIXTURE, { ...filter, limit: 2, offset: 2 });

    expect(page1.map((r) => r.id)).toEqual(["feb-makanan-3", "feb-makanan-2"]);
    expect(page2.map((r) => r.id)).toEqual(["feb-makanan-1"]);

    const allFilteredIds = [...page1, ...page2].map((r) => r.id);
    expect(new Set(allFilteredIds).size).toBe(allFilteredIds.length);
    expect(allFilteredIds).toEqual(["feb-makanan-3", "feb-makanan-2", "feb-makanan-1"]);

    // Tanpa filter di DB, offset=2 limit=2 mengambil slice dataset mentah — bukan halaman 2 hasil filter
    const rawPage = listTransactionsPage(FIXTURE, { limit: 2, offset: 2 });
    expect(rawPage.map((r) => r.id)).toEqual(["feb-makanan-3", "feb-makanan-2"]);
    expect(rawPage.map((r) => r.id)).not.toEqual(page2.map((r) => r.id));
  });
});
