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

// Better Auth rejects state-changing requests with a missing/null Origin
// header (its own CSRF-style check, independent of Hono's CORS middleware —
// see `MISSING_OR_NULL_ORIGIN`), regardless of `trustedOrigins`. Node's
// `fetch` never sends `Origin` automatically like a browser does, so it must
// be set explicitly here, matching an origin api-e2e actually trusts (see
// `ADDITIONAL_TRUSTED_ORIGINS` in docker-compose.e2e.yml).
const TEST_ORIGIN = process.env.E2E_TEST_ORIGIN ?? "http://localhost:4000";

async function api(cookie: string, path: string, method: string, body?: unknown) {
  const res = await fetch(`${E2E_API_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookie, Origin: TEST_ORIGIN },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = res.status === 204 ? null : await res.json().catch(() => null);
  return { status: res.status, body: json };
}

async function registerAndLogin(): Promise<string> {
  const email = `wealth-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const res = await fetch(`${E2E_API_URL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: TEST_ORIGIN },
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
  //   uangBersih    = uang(10jt) - utang(5jt)                   =  5.000.000
  //   level: sudah investasi (1jt) tapi < uangBersih (5jt) → level 5 (Dana Pensiun)
  //   (bug hunt High #2 fix — level 3-6 sekarang berbasis uangBersih/totalLiquidAssets, bukan kekayaanBersih/uang)
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

// ─── Sprint 16 (Fase 3): Wealth Snapshots Engine ─────────────────────────────
describe.skipIf(!E2E_API_URL)("Wealth Snapshots (Sprint 16) — requires E2E_API_URL", () => {
  let cookie: string;
  let accountId: string;

  function todayStr(): string {
    return new Date().toISOString().slice(0, 10);
  }

  beforeAll(async () => {
    cookie = await registerAndLogin();
    const acc = await api(cookie, "/api/accounts", "POST", { nama: "Rekening Snapshot E2E", saldoAwal: 1_000_000 });
    accountId = (acc.body as { id: string }).id;
  });

  it("transaksi memicu snapshot yang muncul di wealth-history dan idempotent per hari", async () => {
    const today = todayStr();

    const pendapatan = await api(cookie, "/api/transactions", "POST", {
      tanggal: today, type: "pendapatan", accountId, kategori: "Gaji", nominal: 2_000_000,
    });
    expect(pendapatan.status).toBe(201);

    // snapshot dibuat fire-and-forget setelah response — beri waktu event loop
    // untuk menyelesaikannya sebelum query wealth-history.
    await new Promise((r) => setTimeout(r, 300));

    const history1 = await api(cookie, `/api/wealth/wealth-history?from=${today}&to=${today}`, "GET");
    expect(history1.status).toBe(200);
    const h1 = history1.body as { history: { tanggal: string; kekayaanBersih: number }[]; delta: number };
    expect(h1.history).toHaveLength(1);
    expect(h1.history[0].kekayaanBersih).toBe(3_000_000); // 1jt saldoAwal + 2jt pendapatan

    // Transaksi kedua di HARI YANG SAMA — snapshot harus di-update (bukan duplikat baris baru).
    const pengeluaran = await api(cookie, "/api/transactions", "POST", {
      tanggal: today, type: "pengeluaran", accountId, kategori: "Makanan", nominal: 500_000,
    });
    expect(pengeluaran.status).toBe(201);
    await new Promise((r) => setTimeout(r, 300));

    const history2 = await api(cookie, `/api/wealth/wealth-history?from=${today}&to=${today}`, "GET");
    expect(history2.status).toBe(200);
    const h2 = history2.body as { history: { tanggal: string; kekayaanBersih: number }[] };
    expect(h2.history).toHaveLength(1); // masih 1 baris — idempotent, bukan duplikat
    expect(h2.history[0].kekayaanBersih).toBe(2_500_000); // 3jt - 500rb
  });
});

// ─── Sprint 23 (Fase 3): Analytics, Dream Tracker & Retirement Plan ──────────
// Alur end-to-end lintas modul Fase 3 — verifikasi bahwa endpoint-endpoint
// baru terintegrasi dengan benar terhadap data nyata (bukan hanya pure-function
// unit test di analytics.test.ts/dreamGoals.test.ts/wealth.test.ts).
describe.skipIf(!E2E_API_URL)("Analytics, Dream Tracker & Retirement Plan (Sprint 23) — requires E2E_API_URL", () => {
  let cookie: string;
  let accountId: string;

  beforeAll(async () => {
    cookie = await registerAndLogin();
    const acc = await api(cookie, "/api/accounts", "POST", { nama: "Rekening Fase3 E2E", saldoAwal: 5_000_000 });
    accountId = (acc.body as { id: string }).id;

    await api(cookie, "/api/transactions", "POST", {
      tanggal: "2026-01-05", type: "pendapatan", accountId, kategori: "Gaji", nominal: 8_000_000,
    });
    await api(cookie, "/api/transactions", "POST", {
      tanggal: "2026-01-10", type: "pengeluaran", accountId, kategori: "Konsumsi", rincian: "Belanja bulanan", nominal: 1_500_000,
    });
  });

  it("GET /api/analytics/monthly-pl mengagregasi pendapatan/pengeluaran bulan tersebut dari transaksi nyata", async () => {
    const { status, body } = await api(cookie, "/api/analytics/monthly-pl?from=2026-01-01&to=2026-01-31", "GET");
    expect(status).toBe(200);
    const rows = body as { bulan: string; pendapatan: number; pengeluaran: number; tabungan: number; tabunganNegatif: boolean }[];
    const jan = rows.find((r) => r.bulan === "2026-01");
    expect(jan).toBeDefined();
    expect(jan!.pendapatan).toBe(8_000_000);
    expect(jan!.pengeluaran).toBe(1_500_000);
    expect(jan!.tabungan).toBe(6_500_000);
    expect(jan!.tabunganNegatif).toBe(false);
  });

  it("GET /api/analytics/essential-expenses mengelompokkan pengeluaran kategori Konsumsi", async () => {
    const { status, body } = await api(cookie, "/api/analytics/essential-expenses?from=2026-01-01&to=2026-01-31", "GET");
    expect(status).toBe(200);
    const result = body as { items: { kategori: string; subtotal: number }[]; grandTotal: number };
    expect(result.grandTotal).toBe(1_500_000);
    expect(result.items.find((i) => i.kategori === "Konsumsi")?.subtotal).toBe(1_500_000);
  });

  it("GET /api/analytics/income mengembalikan breakdown pemasukan dengan persentase 100% (satu sumber)", async () => {
    const { status, body } = await api(cookie, "/api/analytics/income?from=2026-01-01&to=2026-01-31", "GET");
    expect(status).toBe(200);
    const result = body as { items: { kategori: string; total: number; persentaseDariTotal: number; isTerbesar: boolean }[]; grandTotal: number };
    expect(result.grandTotal).toBe(8_000_000);
    expect(result.items[0]).toMatchObject({ kategori: "Gaji", total: 8_000_000, persentaseDariTotal: 100, isTerbesar: true });
  });

  it("GET /api/analytics/emergency-fund menghitung dana darurat dari kas saat ini", async () => {
    const { status, body } = await api(cookie, "/api/analytics/emergency-fund", "GET");
    expect(status).toBe(200);
    const result = body as { danaDarurat: number; status: string; bulanTertanggung: number | null };
    // 5jt saldoAwal + 8jt pendapatan - 1.5jt pengeluaran = 11.5jt, tidak ada utang
    expect(result.danaDarurat).toBe(11_500_000);
  });

  it("Dream goal linked-account: progress otomatis ikut saldo rekening tanpa update manual", async () => {
    const create = await api(cookie, "/api/dream-goals", "POST", {
      namaGoal: "Liburan E2E", targetNominal: 20_000_000, accountId,
    });
    expect(create.status).toBe(201);
    const goalId = (create.body as { id: string }).id;

    // Saldo rekening saat ini: 5jt + 8jt - 1.5jt = 11.5jt → 11.5/20 = 57.5%
    const list1 = await api(cookie, "/api/dream-goals", "GET");
    const goal1 = (list1.body as { id: string; saldoSaatIni: number; persentase: number; tercapai: boolean }[]).find((g) => g.id === goalId);
    expect(goal1?.saldoSaatIni).toBe(11_500_000);
    expect(goal1?.persentase).toBe(57.5);
    expect(goal1?.tercapai).toBe(false);

    // Tambah transaksi baru di rekening yang sama → progress goal ikut naik otomatis,
    // tanpa perlu PATCH manual ke dream-goal (ini yang membedakan dari saldoManual).
    const tambahan = await api(cookie, "/api/transactions", "POST", {
      tanggal: "2026-01-15", type: "pendapatan", accountId, kategori: "Bonus", nominal: 8_500_000,
    });
    expect(tambahan.status).toBe(201);

    const list2 = await api(cookie, "/api/dream-goals", "GET");
    const goal2 = (list2.body as { id: string; saldoSaatIni: number; persentase: number; tercapai: boolean }[]).find((g) => g.id === goalId);
    // 11.5jt + 8.5jt = 20jt = tepat target → 100%, tercapai
    expect(goal2?.saldoSaatIni).toBe(20_000_000);
    expect(goal2?.persentase).toBe(100);
    expect(goal2?.tercapai).toBe(true);
  });

  it("Rencana Pensiun & Warisan: profil belum lengkap → hasProfile false, bukan error", async () => {
    const { status, body } = await api(cookie, "/api/wealth/retirement-plan", "GET");
    expect(status).toBe(200);
    expect((body as { hasProfile: boolean }).hasProfile).toBe(false);
  });

  it("Rencana Pensiun & Warisan: setelah profil dilengkapi, plan terintegrasi dengan kekayaan bersih saat ini", async () => {
    const profileUpdate = await api(cookie, "/api/profile", "PUT", {
      tanggalLahir: "1996-01-01",
      rencanaUsiaPensiun: 56,
      rencanaUsiaWarisan: 81,
      pemasukanBulananRataRata: 10_000_000,
      pengeluaranBulananRataRata: 5_000_000,
    });
    expect(profileUpdate.status).toBe(200);

    const { status, body } = await api(cookie, "/api/wealth/retirement-plan", "GET");
    expect(status).toBe(200);
    const result = body as {
      hasProfile: boolean;
      plan: { danaDibutuhkanSelamaPensiun: number; totalDanaPensiunWarisan: number };
      sisaUangBulanan: number;
      danaTerkumpulSaatIni: number;
    };
    expect(result.hasProfile).toBe(true);
    expect(result.sisaUangBulanan).toBe(5_000_000);
    // usiaWarisan(81) - usiaPensiun(56) = 25 tahun x 12 x 5jt
    expect(result.plan.danaDibutuhkanSelamaPensiun).toBe(25 * 12 * 5_000_000);
    // Kekayaan bersih saat ini: rekening (5jt+8jt-1.5jt+8.5jt=20jt) + goal tidak menambah aset baru
    expect(result.danaTerkumpulSaatIni).toBe(20_000_000);
  });
});
