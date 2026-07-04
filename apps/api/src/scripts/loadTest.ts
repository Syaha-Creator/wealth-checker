// Fase 4 Sprint 28 — load test sederhana untuk endpoint analytics & export
// (paling berat secara komputasi: banyak query agregasi + generate file).
//
// SENGAJA ditulis pakai `fetch` polos (tanpa dependency baru seperti k6/
// autocannon) — konsisten dengan pola *.e2e.test.ts yang sudah ada
// (wealth.e2e.test.ts, households.e2e.test.ts, transactions.concurrency.test.ts),
// dan supaya bisa langsung dijalankan lewat `bun run` tanpa setup tambahan.
//
// JANGAN dijalankan terhadap staging/production — STAGING.md sudah
// mendokumentasikan staging **berbagi resource VPS dengan production**,
// jadi 100 concurrent request akan ganggu production. Jalankan ini HANYA
// terhadap stack lokal (docker-compose.e2e.yml) atau environment khusus
// yang memang terisolasi:
//
//   docker compose -f docker-compose.e2e.yml up -d --build
//   DATABASE_URL=postgresql://wealth:wealth_e2e_pass@localhost:5440/wealth_checker_e2e \
//     bun run db:migrate
//   LOADTEST_API_URL=http://localhost:4001 bun run apps/api/src/scripts/loadTest.ts
//
// Env vars:
//   LOADTEST_API_URL     wajib diisi (self-skip kalau kosong, seperti *.e2e.test.ts)
//   LOADTEST_CONCURRENCY default 100 — jumlah user simulasi (masing-masing household sendiri)
//   LOADTEST_ORIGIN       default http://localhost:4000 (Better Auth CSRF Origin check)

const API_URL = process.env.LOADTEST_API_URL;
const CONCURRENCY = Number(process.env.LOADTEST_CONCURRENCY ?? 100);
const ORIGIN = process.env.LOADTEST_ORIGIN ?? "http://localhost:4000";

if (!API_URL) {
  console.log("LOADTEST_API_URL tidak diset — lewati load test (lihat komentar di atas file ini untuk cara jalankan).");
  process.exit(0);
}

interface Timing {
  label: string;
  ms: number;
  status: number;
  ok: boolean;
}

async function timedFetch(label: string, cookie: string, path: string, method = "GET", body?: unknown): Promise<Timing> {
  const start = performance.now();
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers: { "Content-Type": "application/json", Cookie: cookie, Origin: ORIGIN },
      body: body ? JSON.stringify(body) : undefined,
    });
    // Drain body supaya waktu ukur mencakup transfer penuh (penting untuk PDF/Excel binary).
    await res.arrayBuffer();
    return { label, ms: performance.now() - start, status: res.status, ok: res.ok };
  } catch (err) {
    console.error(`  [${label}] request gagal:`, err);
    return { label, ms: performance.now() - start, status: 0, ok: false };
  }
}

async function registerUser(idx: number): Promise<string> {
  const email = `loadtest-${Date.now()}-${idx}-${Math.random().toString(36).slice(2)}@example.com`;
  const res = await fetch(`${API_URL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify({ email, password: "load-test-password-12345", name: `Load Test User ${idx}` }),
  });
  if (!res.ok) throw new Error(`sign-up gagal (user ${idx}): ${res.status} ${await res.text()}`);
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) throw new Error(`sign-up tidak mengembalikan session cookie (user ${idx})`);
  return setCookie.split(";")[0];
}

async function seedSomeData(cookie: string): Promise<void> {
  const accRes = await fetch(`${API_URL}/api/accounts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie, Origin: ORIGIN },
    body: JSON.stringify({ nama: "Kas Utama", saldoAwal: 1000000 }),
  });
  const acc = await accRes.json();

  const today = new Date().toISOString().slice(0, 10);
  for (let i = 0; i < 5; i++) {
    await fetch(`${API_URL}/api/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie, Origin: ORIGIN },
      body: JSON.stringify({
        tanggal: today,
        type: i % 2 === 0 ? "pendapatan" : "pengeluaran",
        kategori: i % 2 === 0 ? "Gaji" : "Makan",
        accountId: acc.id,
        nominal: 100000 + i * 1000,
      }),
    });
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

function summarize(label: string, timings: Timing[]) {
  const ms = timings.map((t) => t.ms).sort((a, b) => a - b);
  const errors = timings.filter((t) => !t.ok);
  console.log(
    `  ${label.padEnd(24)} n=${timings.length.toString().padEnd(4)} ` +
    `p50=${percentile(ms, 50).toFixed(0).padStart(5)}ms p95=${percentile(ms, 95).toFixed(0).padStart(5)}ms ` +
    `p99=${percentile(ms, 99).toFixed(0).padStart(5)}ms max=${ms[ms.length - 1]?.toFixed(0).padStart(5) ?? 0}ms ` +
    `errors=${errors.length}${errors.length > 0 ? ` (status codes: ${[...new Set(errors.map((e) => e.status))].join(",")})` : ""}`,
  );
}

async function main() {
  console.log(`Load test: ${CONCURRENCY} concurrent simulated users terhadap ${API_URL}`);

  console.log(`\n[1/3] Registrasi ${CONCURRENCY} user + seed data...`);
  const cookies: string[] = [];
  // Registrasi berurutan kecil-kecil batch (bukan full concurrency) — endpoint
  // auth/sign-up tidak jadi target ukur di load test ini, cukup persiapan data.
  const BATCH = 10;
  for (let i = 0; i < CONCURRENCY; i += BATCH) {
    const batch = await Promise.all(
      Array.from({ length: Math.min(BATCH, CONCURRENCY - i) }, (_, j) => registerUser(i + j)),
    );
    for (const cookie of batch) {
      await seedSomeData(cookie);
      cookies.push(cookie);
    }
  }
  console.log(`  ✓ ${cookies.length} user siap.`);

  const from = new Date();
  from.setMonth(from.getMonth() - 1);
  const fromStr = from.toISOString().slice(0, 10);
  const toStr = new Date().toISOString().slice(0, 10);

  console.log(`\n[2/3] Menembak endpoint analytics (${CONCURRENCY} concurrent request per endpoint)...`);
  const monthlyPl = await Promise.all(cookies.map((c) => timedFetch("GET /analytics/monthly-pl", c, `/api/analytics/monthly-pl?from=${fromStr}&to=${toStr}`)));
  summarize("analytics/monthly-pl", monthlyPl);

  const budgetVsActual = await Promise.all(cookies.map((c) => timedFetch("GET /analytics/budget-vs-actual", c, `/api/analytics/budget-vs-actual?from=${fromStr}&to=${toStr}`)));
  summarize("analytics/budget-vs-actual", budgetVsActual);

  const income = await Promise.all(cookies.map((c) => timedFetch("GET /analytics/income", c, `/api/analytics/income?from=${fromStr}&to=${toStr}`)));
  summarize("analytics/income", income);

  console.log(`\n[3/3] Menembak endpoint export (${CONCURRENCY} concurrent request per format — masing-masing user beda household, jadi rate limit 1x/menit per user TIDAK saling menghalangi)...`);
  const excel = await Promise.all(cookies.map((c) => timedFetch("GET /export/excel", c, `/api/export/excel?from=${fromStr}&to=${toStr}`)));
  summarize("export/excel", excel);

  const pdf = await Promise.all(cookies.map((c) => timedFetch("GET /export/pdf", c, `/api/export/pdf?from=${fromStr}&to=${toStr}`)));
  summarize("export/pdf", pdf);

  console.log("\nSelesai. Lihat docs/ARCHITECTURE.md § Load Testing untuk cara membaca hasil ini dan ambang batas yang diharapkan.");
}

main().catch((err) => {
  console.error("Load test gagal:", err);
  process.exit(1);
});
