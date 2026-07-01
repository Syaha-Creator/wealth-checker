import { test, expect, type Page } from "@playwright/test";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uniqueEmail() {
  return `e2e+${Date.now()}@wealthchecker.test`;
}

async function fillRupiah(page: Page, locator: string, amount: string) {
  await page.fill(locator, amount);
}

async function waitForRedirect(page: Page, path: string) {
  await page.waitForURL((url) => url.pathname === path, { timeout: 15_000 });
}

// ─── Main flow ───────────────────────────────────────────────────────────────

test.describe("Main user flow", () => {
  const email = uniqueEmail();
  const password = "TestPassword123!";
  const name = "E2E Tester";

  // ── 1. Register ─────────────────────────────────────────────────────────
  test("1. Register a new account", async ({ page }) => {
    await page.goto("/auth/register");
    await expect(page.locator("h1, h2").first()).toBeVisible();

    await page.fill('input[type="text"], input[name="name"]', name);
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');

    // New user should be redirected to onboarding
    await waitForRedirect(page, "/onboarding");
    await expect(page).toHaveURL(/\/onboarding/);
  });

  // ── 2. Login with same account (verify session works) ───────────────────
  test("2. Login with registered account", async ({ page }) => {
    await page.goto("/auth/login");
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');

    // After login, existing user with no onboarding data goes to /onboarding,
    // or directly /dashboard if session carries over from previous test.
    await page.waitForURL((url) => ["/dashboard", "/onboarding"].includes(url.pathname), {
      timeout: 15_000,
    });
    expect(["/dashboard", "/onboarding"]).toContain(new URL(page.url()).pathname);
  });

  // ── 3. Onboarding: add BCA account with Rp 1.000.000 ───────────────────
  test("3. Complete onboarding — add BCA account", async ({ page }) => {
    await page.goto("/auth/login");
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await waitForRedirect(page, "/onboarding");

    // Expect step 1 to be visible (add first account)
    await expect(page.locator("text=rekening").first()).toBeVisible({ timeout: 10_000 });

    // Fill in account name
    const accountInput = page.locator('input[placeholder*="BCA"], input[name*="nama"], input[placeholder*="Nama"]').first();
    await accountInput.fill("BCA Tabungan");

    // Fill in opening balance
    await fillRupiah(page, 'input[inputmode="numeric"]', "1000000");

    // Submit the account form
    const submitBtn = page.locator('button[type="submit"]').first();
    await submitBtn.click();

    // After the first required step the user can skip remaining optional steps
    const skipBtn = page.locator("text=Lewati").first();
    if (await skipBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await skipBtn.click();
    }
  });

  // ── 4. Finish onboarding and arrive at success / dashboard ─────────────
  test("4. Finish onboarding — reach dashboard", async ({ page }) => {
    await page.goto("/onboarding");

    // Skip all remaining optional steps until we reach success or dashboard
    for (let i = 0; i < 8; i++) {
      const skipBtn = page.locator("text=Lewati").first();
      const dashboardBtn = page.locator("text=Ke Dashboard, text=Dashboard").first();
      const isDashboard = page.url().includes("/dashboard");

      if (isDashboard) break;

      if (await dashboardBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await dashboardBtn.click();
        break;
      }

      if (await skipBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await skipBtn.click();
      } else {
        break;
      }
    }

    await page.waitForURL((url) => url.pathname === "/dashboard", { timeout: 20_000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });

  // ── 5. Dashboard shows net worth ────────────────────────────────────────
  test("5. Dashboard shows kekayaan bersih", async ({ page }) => {
    await page.goto("/dashboard");
    // The dashboard should render some wealth/balance figure
    await expect(page.locator("text=Kekayaan, text=Bersih, text=Rp").first()).toBeVisible({
      timeout: 15_000,
    });
  });

  // ── 6. Add a pengeluaran transaction ───────────────────────────────────
  test("6. Add pengeluaran Rp 50.000 — Makanan", async ({ page }) => {
    await page.goto("/transactions/new?type=pengeluaran");

    // Verify we are on the right page
    await expect(page.locator("h1")).toContainText("Transaksi");

    // Nominal
    await page.fill('input[inputmode="numeric"]', "50000");

    // Category via datalist — type into the kategori input
    const kategoriInput = page.locator("#kategori");
    await kategoriInput.fill("Makanan");

    // Rincian
    await page.fill("#rincian", "Makan siang e2e");

    // Submit
    await page.click('button[type="submit"]');

    // Should redirect to transaction list
    await waitForRedirect(page, "/transactions");
    await expect(page).toHaveURL(/\/transactions/);
  });

  // ── 7. Transaction appears in the list ─────────────────────────────────
  test("7. Transaction appears in riwayat", async ({ page }) => {
    await page.goto("/transactions");
    await expect(page.locator("text=Makanan, text=Makan siang").first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator("text=50.000, text=50,000").first()).toBeVisible({ timeout: 5_000 });
  });

  // ── 8. Dashboard reflects updated balance ──────────────────────────────
  test("8. Dashboard reflects reduced balance after expense", async ({ page }) => {
    await page.goto("/dashboard");
    // Balance should be 950.000 (1.000.000 − 50.000)
    // We just verify a number in the 900.000 range appears somewhere on the page
    await expect(page.locator("text=950, text=Rp 950").first()).toBeVisible({ timeout: 15_000 });
  });
});
