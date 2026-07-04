"use client";

import { Fragment, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatCurrency, formatCurrencyShort } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";
import type { DateRange } from "@/lib/dateRange";
import { ReportSkeleton, ReportError, ReportEmpty } from "./ReportStates";

const DEFAULT_ESSENTIAL_CATEGORIES = ["Konsumsi", "Transportasi", "Utilitas", "Kesehatan", "Pendidikan"];
const STORAGE_KEY = "wealth-checker.essentialCategories";

interface EssentialExpensesResponse {
  categories: string[];
  items: { kategori: string; rincianList: { rincian: string; total: number }[]; subtotal: number }[];
  grandTotal: number;
}

function loadCategories(): string[] {
  if (typeof window === "undefined") return DEFAULT_ESSENTIAL_CATEGORIES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_ESSENTIAL_CATEGORIES;
  } catch {
    return DEFAULT_ESSENTIAL_CATEGORIES;
  }
}

/** Sprint 19 — sub-laporan 3.6.5: Kebutuhan Pokok (breakdown dua level + filter kategori custom di localStorage). */
export function EssentialExpensesReport({ range }: { range: DateRange }) {
  // Lazy initializer (bukan useEffect + setState) — pola aman untuk baca
  // localStorage yang hydration-safe: render SSR pertama pakai default
  // (window belum ada), render pertama di client (saat hydrate) membaca
  // localStorage yang sesungguhnya, tanpa flash konten default→tersimpan.
  const [categories, setCategories] = useState<string[]>(() => loadCategories());
  const [showEditor, setShowEditor] = useState(false);
  const [newCategory, setNewCategory] = useState("");

  const persist = (next: string[]) => {
    setCategories(next);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const { data, loading, error, reload } = useApiResource<EssentialExpensesResponse>(
    `/api/analytics/essential-expenses?from=${range.from}&to=${range.to}&kategori=${encodeURIComponent(categories.join(","))}`,
  );

  const categoryEditor = (
    <div className="mb-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-muted">Kategori kebutuhan pokok: {categories.join(", ")}</p>
        <Button variant="ghost" size="sm" onClick={() => setShowEditor((v) => !v)}>{showEditor ? "Tutup" : "Ubah Kategori"}</Button>
      </div>
      {showEditor && (
        <Card padding="sm" className="mt-2">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {categories.map((kat) => (
              <span key={kat} className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-surface-hover text-text-secondary">
                {kat}
                <button
                  type="button"
                  aria-label={`Hapus kategori ${kat}`}
                  onClick={() => persist(categories.filter((k) => k !== kat))}
                  className="text-text-muted hover:text-danger-text"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Tambah kategori..."
              aria-label="Tambah kategori kebutuhan pokok"
              className="flex-1"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const trimmed = newCategory.trim();
                if (trimmed && !categories.includes(trimmed)) persist([...categories, trimmed]);
                setNewCategory("");
              }}
            >
              Tambah
            </Button>
          </div>
        </Card>
      )}
    </div>
  );

  if (loading) return <>{categoryEditor}<ReportSkeleton /></>;
  if (error) return <>{categoryEditor}<ReportError message={error} onRetry={reload} /></>;
  if (!data || data.items.length === 0) return <>{categoryEditor}<ReportEmpty /></>;

  return (
    <div className="space-y-3">
      {categoryEditor}
      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Rincian pengeluaran kebutuhan pokok per kategori dan rincian</caption>
            <tbody>
              {data.items.map((item) => (
                <Fragment key={item.kategori}>
                  <tr className="bg-surface-hover border-b border-border">
                    <td className="px-4 py-2 font-semibold text-text-primary" colSpan={2}>{item.kategori}</td>
                    <td className="px-4 py-2 font-semibold text-text-primary text-right">{formatCurrency(item.subtotal)}</td>
                  </tr>
                  {item.rincianList.map((r) => (
                    <tr key={`${item.kategori}-${r.rincian}`} className="border-b border-border last:border-0">
                      <td className="px-4 py-2" />
                      <td className="px-4 py-2 text-text-secondary">{r.rincian}</td>
                      <td className="px-4 py-2 text-right text-text-secondary">{formatCurrencyShort(r.total)}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
              <tr className="border-t-2 border-border">
                <td className="px-4 py-2.5 font-bold text-text-primary" colSpan={2}>Grand Total</td>
                <td className="px-4 py-2.5 font-bold text-text-primary text-right">{formatCurrency(data.grandTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
