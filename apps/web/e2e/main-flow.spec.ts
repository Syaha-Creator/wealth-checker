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
 */
async function assertNoErrorAlert(page: Page) {
  const alert = page.locator('[role="alert"]').first();
  if (await alert.isVisible().catch(() => false)) {
    const message = await alert.innerText().catch(() => "(tidak bisa membaca pesan error)");
    throw new Error(`Form menampilkan error, navigasi dibatalkan: "${message.trim()}"`);
  }
}

async function clickAndWaitForUrl(page: Page, selector: string, urlPattern: RegExp, timeout = 20_000) {
  await page.click(selector);
  // Give the async submit handler a moment to resolve/reject before checking for an alert.
  await page.waitForTimeout(700);
  await assertNoErrorAlert(page);
  await page.waitForURL(urlPattern, { timeout, waitUntil: "commit" });
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

    // With 1.000.000 in cash and no debt, formatRp(1000000) → "Rp 1.0jt"
    await expect(page.locator("text=1.0jt")).toBeVisible({ timeout: 10_000 });

    // Account list should show BCA Tabungan
    await expect(page.locator("text=BCA Tabungan")).toBeVisible();
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
});
