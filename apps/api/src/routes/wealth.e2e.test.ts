import { describe, it, expect, beforeAll } from "vitest";

/**
 * End-to-end regression test for Sprint 15 ("Audit ulang calculateWealthSummary()
 * ... end-to-end test dengan data lengkap"). Exercises the full stack — real
 * HTTP requests against a running API + Postgres — combining utang, piutang,
 * aset barang, dan investasi sekaligus in a single user's data, then verifies:
 *
 *   1. GET /api/wealth/summary aggregates every component correctly and
 *      derives the expected wealthLevel.
 *   2. GET /api/wealth/health-checkup returns content consistent with that level.
 *   3. GET /api/budgeting-advice allocates the budget plan using that level's
 *      reference percentages.
 *   4. GET /api/accounts/:id/mutasi's derived running balance reconciles
 *      exactly with the account's actual saldoCache (Sprint 15 — Mutasi Rekening).
 *
 * Like transactions.concurrency.test.ts, this self-skips unless E2E_API_URL
 * is set (wired into the same CI step — see .github/workflows/deploy.yml).
 */

const E2E_API_URL = process.env.E2E_API_URL;

async function api(cookie: string, path: string, method: string, body?: unknown) {
  const res = await fetch(`${E2E_API_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = res.status === 204 ? null : await res.json().catch(() => null);
  return { status: res.status, body: json };
}

async function registerAndLogin(): Promise<string> {
  const email = `wealth-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const res = await fetch(`${E2E_API_URL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "test-password-12345", name: "Wealth E2E Test User" }),
  });
  if (!res.ok) throw new Error(`sign-up failed: ${res.status} ${await res.text()}`);
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) throw new Error("sign-up did not return a session cookie");
  return setCookie.split(";")[0];
}

function currentYm(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

describe.skipIf(!E2E_API_URL)("Wealth end-to-end (Sprint 15) — requires E2E_API_URL", () => {
  let cookie: string;
  let accountId: string;

  // Rencana angka (lihat komentar di setiap langkah untuk derivasi manual):
  //   saldoAwal rekening         : 10.000.000
  //   + pinjaman_utang           :  5.000.000  → utang tersisa  5.000.000
  //   - pemberian_piutang        :  2.000.000  → piutang        2.000.000
  //   - beli_investasi (100x10rb):  1.000.000  → investasi      1.000.000
  //   - beli_barang (5x1jt)      :  5.000.000  → barang         5.000.000
  //   = saldoCache akhir         :  7.000.000
  //
  //   uang          = kas(7jt) + investasi(1jt) + piutang(2jt) = 10.000.000
  //   totalAset     = uang(10jt) + barang(5jt)                 = 15.000.000
  //   kekayaanBersih= totalAset(15jt) - utang(5jt)              = 10.000.000
  //   level: kekayaanBersih(10jt) < uang*3(30jt) → level 5 (Dana Pensiun)
  beforeAll(async () => {
    cookie = await registerAndLogin();
    const acc = await api(cookie, "/api/accounts", "POST", { nama: "Rekening Wealth E2E", saldoAwal: 10_000_000 });
    accountId = (acc.body as { id: string }).id;

    const pinjam = await api(cookie, "/api/transactions", "POST", {
      tanggal: "2026-01-01", type: "pinjaman_utang", accountId, pemberiUtang: `Bank E2E ${Date.now()}`, nominal: 5_000_000,
    });
    expect(pinjam.status).toBe(201);

    const piutang = await api(cookie, "/api/transactions", "POST", {
      tanggal: "2026-01-02", type: "pemberian_piutang", accountId, peminjam: `Teman E2E ${Date.now()}`, nominal: 2_000_000,
    });
    expect(piutang.status).toBe(201);

    const investasi = await api(cookie, "/api/transactions", "POST", {
      tanggal: "2026-01-03", type: "beli_investasi", accountId, namaAset: `Saham E2E ${Date.now()}`, jumlah: 100, hargaSatuan: 10_000,
    });
    expect(investasi.status).toBe(201);

    const barang = await api(cookie, "/api/transactions", "POST", {
      tanggal: "2026-01-04", type: "beli_barang", accountId, namaAset: `Emas E2E ${Date.now()}`, jumlah: 5, hargaSatuan: 1_000_000,
    });
    expect(barang.status).toBe(201);
  });

  it("GET /api/wealth/summary mengagregasi utang+piutang+aset+investasi dan menghasilkan level yang benar", async () => {
    const { status, body } = await api(cookie, "/api/wealth/summary", "GET");
    expect(status).toBe(200);
    const summary = body as {
      totalKas: string; totalLiquidAssets: string; totalFixedAssets: string;
      totalReceivables: string; totalUtang: string; totalAset: string;
      kekayaanBersih: string; wealthLevel: number; wealthLevelName: string;
    };

    expect(Number(summary.totalKas)).toBe(7_000_000);
    expect(Number(summary.totalLiquidAssets)).toBe(1_000_000);
    expect(Number(summary.totalFixedAssets)).toBe(5_000_000);
    expect(Number(summary.totalReceivables)).toBe(2_000_000);
    expect(Number(summary.totalUtang)).toBe(5_000_000);
    expect(Number(summary.totalAset)).toBe(15_000_000);
    expect(Number(summary.kekayaanBersih)).toBe(10_000_000);
    expect(summary.wealthLevel).toBe(5);
    expect(summary.wealthLevelName).toBe("Dana Pensiun");
  });

  it("GET /api/wealth/health-checkup mengembalikan diagnosa/saran/ciri konsisten dengan level 5", async () => {
    const { status, body } = await api(cookie, "/api/wealth/health-checkup", "GET");
    expect(status).toBe(200);
    const checkup = body as { wealthLevel: number; wealthLevelName: string; diagnosa: string; saran: string; ciri: string[] };
    expect(checkup.wealthLevel).toBe(5);
    expect(checkup.wealthLevelName).toBe("Dana Pensiun");
    expect(checkup.diagnosa.length).toBeGreaterThan(0);
    expect(checkup.saran.length).toBeGreaterThan(0);
    expect(checkup.ciri.length).toBe(3);
  });

  it("GET /api/budgeting-advice mengalokasikan rencana pemasukan sesuai persentase referensi level 5", async () => {
    const plan = await api(cookie, "/api/budget-plans", "POST", {
      rencanaPemasukanBulanan: 10_000_000, bulanTahun: currentYm(),
    });
    expect(plan.status).toBe(201);

    const { status, body } = await api(cookie, "/api/budgeting-advice", "GET");
    expect(status).toBe(200);
    const advice = body as { wealthLevel: number; alokasi: { kategori: string; persen: number; nominal: number }[]; totalPersen: number };
    expect(advice.wealthLevel).toBe(5);
    expect(advice.totalPersen).toBe(100);
    // Seed migration 0003: level 5 = Kebutuhan Pokok 35, Investasi Pensiun 35, Gaya Hidup 20, Dana Warisan 10
    expect(advice.alokasi).toEqual([
      { kategori: "Kebutuhan Pokok", persen: 35, nominal: 3_500_000 },
      { kategori: "Investasi Pensiun", persen: 35, nominal: 3_500_000 },
      { kategori: "Gaya Hidup", persen: 20, nominal: 2_000_000 },
      { kategori: "Dana Warisan", persen: 10, nominal: 1_000_000 },
    ]);
  });

  it("GET /api/accounts/:id/mutasi — saldo berjalan turunan rekonsiliasi persis dengan saldoCache aktual", async () => {
    const { status, body } = await api(cookie, `/api/accounts/${accountId}/mutasi`, "GET");
    expect(status).toBe(200);
    const mutasi = body as {
      account: { saldoCache: number }; saldoAwalTurunan: number; konsisten: boolean;
      mutasi: { delta: number; saldoSetelah: number }[];
    };

    expect(mutasi.account.saldoCache).toBe(7_000_000);
    expect(mutasi.saldoAwalTurunan).toBe(10_000_000); // saldoAwal asli saat akun dibuat
    expect(mutasi.konsisten).toBe(true);
    expect(mutasi.mutasi).toHaveLength(4);
    // Ditampilkan terbaru dulu: beli_barang (-5jt) adalah entri pertama, saldo akhir 7jt
    expect(mutasi.mutasi[0].delta).toBe(-5_000_000);
    expect(mutasi.mutasi[0].saldoSetelah).toBe(7_000_000);
  });
});
