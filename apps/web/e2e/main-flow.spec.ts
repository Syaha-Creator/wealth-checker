import { test, expect, type Page } from "@playwright/test";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uniqueEmail() {
  return `e2e+${Date.now()}@wealthchecker.test`;
}

/**
 * Fails fast with a readable message if the page shows an error alert
 * (role="alert") instead of navigating. Without this, a rejected API call
 * (e.g. CORS/auth misconfiguration) just looks like a generic waitForURL
 * timeout with no indication of the real cause.
 *
 * Next.js's App Router injects its own always-present `<next-route-announcer>`
 * shadow-DOM element with role="alert" (for screen-reader route announcements)
 * on every page. It's visually hidden via clip-rect rather than display:none,
 * so Playwright's isVisible() still reports it as visible, and its locator
 * pierces shadow DOM so it matches `[role="alert"]` too. It starts out empty,
 * so we only treat a match as a real error once it has non-empty text —
 * that's enough to distinguish it from the app's own error boxes below.
 */
async function assertNoErrorAlert(page: Page) {
  const alerts = page.locator('[role="alert"]');
  const count = await alerts.count();
  for (let i = 0; i < count; i++) {
    const alert = alerts.nth(i);
    if (!(await alert.isVisible().catch(() => false))) continue;
    const message = (await alert.innerText().catch(() => "")).trim();
    if (message) {
      throw new Error(`Form menampilkan error, navigasi dibatalkan: "${message}"`);
    }
  }
}

async function clickAndWaitForUrl(page: Page, selector: string, urlPattern: RegExp, timeout = 20_000) {
  await page.click(selector);
  // Give the async submit handler a moment to resolve/reject before checking for an alert.
  await page.waitForTimeout(700);
  await assertNoErrorAlert(page);
  await page.waitForURL(urlPattern, { timeout, waitUntil: "commit" });
}

/** Like clickAndWaitForUrl, but for forms (Profil, Dream Tracker) that save via
 * fetch and update in-place instead of navigating — nothing to waitForURL on. */
async function clickAndSettle(page: Page, selector: string) {
  await page.click(selector);
  await page.waitForTimeout(700);
  await assertNoErrorAlert(page);
}

// ─── Single end-to-end flow (one browser context = cookies shared) ────────────
//
// Using test.step() inside a single test keeps the browser context alive
// across all steps, so session cookies persist from register through to the
// final balance check. Individual test() calls each get a fresh context, which
// would require re-logging-in for every step.

test("Full user flow: register → onboarding → dashboard → transaksi → verifikasi saldo", async ({ page }) => {
  const email = uniqueEmail();
  const password = "TestPassword123!";
  const name = "E2E Tester";

  // ── Step 1: Register ─────────────────────────────────────────────────────
  await test.step("Register akun baru", async () => {
    await page.goto("/auth/register");

    // Wait for the form to be ready — the page shows a spinner while checking
    // session, then renders the form once it knows the user is not logged in.
    await expect(page.locator('button[type="submit"]')).toBeVisible({ timeout: 15_000 });

    await page.fill("#name", name);
    await page.fill("#email", email);
    await page.fill("#password", password);

    // New user → redirect to /onboarding
    await clickAndWaitForUrl(page, 'button[type="submit"]', /\/onboarding/, 20_000);
  });

  // ── Step 2: Onboarding — isi profil & rekening ───────────────────────────
  await test.step("Onboarding step 1: simpan profil", async () => {
    // Verify we landed on onboarding
    await expect(page.locator("text=Setup Keuangan Awal")).toBeVisible({ timeout: 10_000 });

    // Step 1 is Profil — just click Lanjut (fields have defaults)
    await page.click('button:has-text("Lanjut")');
    await page.waitForTimeout(500);
    await assertNoErrorAlert(page);

    // Should move to step 2 (Rekening)
    await expect(page.locator("text=Rekening & Tabungan")).toBeVisible({ timeout: 10_000 });
  });

  await test.step("Onboarding step 2: tambah rekening BCA 1.000.000", async () => {
    // Fill in account name
    await page.fill("#nama-rekening", "BCA Tabungan");

    // Fill opening balance — InputRupiah component uses input#saldo-rekening
    // We type the raw number, the component formats it on change
    await page.fill("#saldo-rekening", "1000000");

    // Add the account to the local list
    await page.click('button:has-text("+ Tambah Rekening")');

    // Verify the item appeared in the list
    await expect(page.locator("text=BCA Tabungan")).toBeVisible();

    // Click Lanjut — this saves to DB and advances to step 3
    await page.click('button:has-text("Lanjut")');
    await page.waitForTimeout(500);
    await assertNoErrorAlert(page);
    await expect(page.locator("text=Aset Setara Kas")).toBeVisible({ timeout: 10_000 });
  });

  await test.step("Onboarding steps 3-6: lewati langkah opsional", async () => {
    // Steps 3-5 are optional (Aset Likuid, Aset Fisik, Utang)
    for (let i = 3; i <= 5; i++) {
      await page.click('button:has-text("Lewati langkah ini")');
      await page.waitForTimeout(300);
      await assertNoErrorAlert(page);
    }

    // Step 6 (Piutang) — skip and finish
    await page.click('button:has-text("Lewati & Selesai")');
    await page.waitForTimeout(500);
    await assertNoErrorAlert(page);
  });

  await test.step("Success screen tampil, klik ke Dashboard", async () => {
    await expect(page.locator("text=Setup Selesai!")).toBeVisible({ timeout: 15_000 });
    await page.click('button:has-text("Lihat Dashboard")');
    await page.waitForURL(/\/dashboard/, { timeout: 15_000, waitUntil: "commit" });
  });

  // ── Step 3: Dashboard — verifikasi kekayaan bersih ───────────────────────
  await test.step("Dashboard menampilkan Kekayaan Bersih", async () => {
    // Kekayaan Bersih card always present
    await expect(page.locator("text=Kekayaan Bersih")).toBeVisible({ timeout: 15_000 });

    // With 1.000.000 in cash and no debt, formatRp(1000000) → "Rp 1.0jt".
    // Multiple dashboard cards show the same value when there's only one
    // account, so match the first occurrence rather than requiring uniqueness.
    await expect(page.locator("text=1.0jt").first()).toBeVisible({ timeout: 10_000 });

    // Account list should show BCA Tabungan
    await expect(page.locator("text=BCA Tabungan").first()).toBeVisible();
  });

  // ── Step 4: Catat pengeluaran Rp 50.000 ─────────────────────────────────
  await test.step("Tambah pengeluaran Rp 50.000 - Makanan", async () => {
    await page.goto("/transactions/new?type=pengeluaran");
    await expect(page.locator("h1")).toContainText("Catat Transaksi", { timeout: 10_000 });

    // Nominal — main input uses inputMode="numeric"
    await page.fill("#nominal", "50000");

    // Kategori — HTML5 datalist autocomplete via #kategori
    await page.fill("#kategori", "Makanan");

    // Rincian
    await page.fill("#rincian", "Makan siang e2e");

    // Should redirect to transaction list
    await clickAndWaitForUrl(page, 'button[type="submit"]', /\/transactions$/, 15_000);
  });

  // ── Step 5: Verifikasi transaksi muncul di riwayat ───────────────────────
  await test.step("Transaksi muncul di riwayat", async () => {
    // Transaction list loaded
    await expect(page.locator("text=Riwayat Transaksi")).toBeVisible({ timeout: 10_000 });

    // The pengeluaran row — nominal 50.000, category Makanan
    await expect(page.locator("text=Makanan").first()).toBeVisible({ timeout: 10_000 });

    // Amount shown as "50.000" (toLocaleString id-ID formatting)
    await expect(page.locator("text=50.000").first()).toBeVisible();
  });

  // ── Step 6: Dashboard saldo berubah jadi 950.000 ─────────────────────────
  await test.step("Dashboard: saldo rekening berkurang ke Rp 950rb", async () => {
    await page.goto("/dashboard");
    await expect(page.locator("text=Kekayaan Bersih")).toBeVisible({ timeout: 15_000 });

    // 1.000.000 - 50.000 = 950.000 → formatRp(950000) = "Rp 950rb"
    await expect(page.locator("text=950rb").first()).toBeVisible({ timeout: 10_000 });
  });

  // ── Step 7-10 (Sprint 15 regression): halaman Fase 2 baru harus render
  // tanpa error untuk user yang sudah memiliki data dasar (rekening + 1
  // transaksi) dari langkah-langkah di atas — Sprint 11-14.
  await test.step("Halaman Aset (Sprint 11/12) tampil tanpa error", async () => {
    await page.goto("/assets");
    await expect(page.locator('[role="tab"]:has-text("Barang")')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[role="tab"]:has-text("Investasi")')).toBeVisible();
    await page.waitForTimeout(500);
    await assertNoErrorAlert(page);
    await expect(page.locator("text=Belum ada barang tercatat")).toBeVisible({ timeout: 10_000 });
  });

  await test.step("Halaman Utang & Piutang (Sprint 8/9) tampil tanpa error", async () => {
    await page.goto("/debts");
    await expect(page.locator("text=Utang & Piutang")).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(500);
    await assertNoErrorAlert(page);
    await expect(page.locator("text=Belum ada utang tercatat")).toBeVisible({ timeout: 10_000 });
  });

  await test.step("Financial Health Check-up (Sprint 13) menampilkan level yang benar", async () => {
    await page.goto("/health-checkup");
    await expect(page.locator("text=Financial Health Check-up")).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(500);
    await assertNoErrorAlert(page);
    // Rekening 950.000 kas, tanpa utang, belum ada investasi (totalLiquidAssets = 0)
    // → uangBersih > 0 tapi totalLiquidAssets <= 0 → level 4 (Punya Dana Darurat).
    // Lihat calculateWealthLevel() di services/wealth.ts.
    await expect(page.locator("text=Punya Dana Darurat")).toBeVisible({ timeout: 10_000 });
  });

  await test.step("Budgeting Advisor (Sprint 14) — atur rencana lalu lihat alokasi", async () => {
    await page.goto("/budgeting");
    await expect(page.locator("text=Budgeting Advisor")).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(500);
    await assertNoErrorAlert(page);

    // Belum punya rencana → tombol di empty state ("Atur Sekarang"), bukan tombol
    // "Atur" di hero card, agar tidak ambigu (keduanya cocok dengan substring "Atur").
    await page.click('button:has-text("Atur Sekarang")');
    await page.fill("#pemasukan", "5000000");
    await page.click('button[type="submit"]:has-text("Simpan")');
    await page.waitForTimeout(700);
    await assertNoErrorAlert(page);

    // Level 4 (Punya Dana Darurat): kategori "Kebutuhan Pokok" 40% dari 5.000.000 = 2.000.000
    await expect(page.locator("text=Kebutuhan Pokok")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("text=2.000.000").first()).toBeVisible({ timeout: 10_000 });
  });

  await test.step("Mutasi Rekening (Sprint 15) menampilkan riwayat transaksi rekening", async () => {
    await page.goto("/accounts");
    await page.click('a[aria-label="Lihat mutasi rekening BCA Tabungan"]');
    await page.waitForURL(/\/accounts\/.+\/mutasi/, { timeout: 10_000, waitUntil: "commit" });
    await page.waitForTimeout(500);
    await assertNoErrorAlert(page);
    await expect(page.locator("text=Saldo Saat Ini")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("text=Pengeluaran").first()).toBeVisible({ timeout: 10_000 });
  });

  // ── Fase 3 regression (Sprint 16-22): halaman baru harus render tanpa error
  // untuk user yang sudah punya data dasar dari langkah-langkah di atas, dan
  // alur lintas modul (goal terhubung rekening, rencana pensiun terintegrasi
  // dengan profil) harus bekerja end-to-end lewat UI asli.
  await test.step("Halaman Analisa (Sprint 20) tampil tanpa error di semua tab", async () => {
    await page.goto("/analytics");
    await expect(page.locator('[role="tab"]:has-text("Kekayaan Bersih")')).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(500);
    await assertNoErrorAlert(page);

    for (const tab of ["Laba Rugi Bulanan", "Budgeting", "Dana Darurat", "Kebutuhan Pokok", "Pemasukan"]) {
      await page.click(`[role="tab"]:has-text("${tab}")`);
      await page.waitForTimeout(500);
      await assertNoErrorAlert(page);
    }
  });

  await test.step("Dream Tracker (Sprint 21) — tambah impian terhubung rekening, progress otomatis dari saldo", async () => {
    await page.goto("/dream-tracker");
    await expect(page.locator("text=Dream Tracker")).toBeVisible({ timeout: 10_000 });

    await page.click('button:has-text("Tambah")');
    await page.fill("#goal-nama", "Liburan E2E");
    await page.fill("#goal-target", "1000000");
    await page.selectOption("#goal-account", { label: "BCA Tabungan" });
    await clickAndSettle(page, 'button[type="submit"]:has-text("Simpan")');

    await expect(page.locator("text=Liburan E2E")).toBeVisible({ timeout: 10_000 });
    // Saldo rekening 950.000 dari target 1.000.000 → progress 95%, bukan 0/manual.
    await expect(page.locator('[role="progressbar"][aria-label="Progress Liburan E2E"]')).toHaveAttribute("aria-valuenow", "95");
  });

  await test.step("Profil — lengkapi tanggal lahir & rencana keuangan (prasyarat Rencana Pensiun)", async () => {
    await page.goto("/profile");
    await expect(page.locator("text=Data Pribadi")).toBeVisible({ timeout: 10_000 });

    await page.fill("#tanggal-lahir", "1996-01-01");
    await page.fill("#usia-pensiun", "56");
    await page.fill("#usia-warisan", "81");
    await page.fill("#pemasukan-rencana", "10000000");
    await page.fill("#pengeluaran-rencana", "6000000");
    await clickAndSettle(page, 'button[type="submit"]:has-text("Simpan Perubahan")');

    await expect(page.locator("text=Profil berhasil disimpan")).toBeVisible({ timeout: 10_000 });
  });

  await test.step("Rencana Pensiun & Warisan (Sprint 22) menampilkan target dana terintegrasi dengan profil", async () => {
    await page.goto("/retirement-plan");
    await expect(page.locator("text=Total Dana Pensiun & Warisan Dibutuhkan")).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(500);
    await assertNoErrorAlert(page);

    await expect(page.locator("text=Dana Dibutuhkan Sebelum Pensiun")).toBeVisible();
    await expect(page.locator("text=Kapan Utang Bisa Lunas?")).toBeVisible();
    // Sudah lunas (tidak ada utang) → pesan "bisa dilunasi sekarang", bukan estimasi bulan.
    await expect(page.locator("text=Utang bisa dilunasi sekarang")).toBeVisible();
  });
});
