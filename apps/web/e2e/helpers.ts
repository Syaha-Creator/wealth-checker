import { expect, type Page } from "@playwright/test";

export function uniqueEmail() {
  return `e2e+${Date.now()}-${Math.random().toString(36).slice(2, 8)}@wealthchecker.test`;
}

/**
 * Next.js App Router injects `<next-route-announcer role="alert">` (often empty).
 * Only treat non-empty visible alerts as form errors.
 */
export async function assertNoErrorAlert(page: Page) {
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
  await page.waitForTimeout(700);
  await assertNoErrorAlert(page);
  await page.waitForURL(urlPattern, { timeout, waitUntil: "commit" });
}

/** Register fresh user, minimal onboarding (profil + 1 rekening), land on dashboard. */
export async function registerAndOnboard(page: Page, opts?: { email?: string; password?: string }) {
  const email = opts?.email ?? uniqueEmail();
  const password = opts?.password ?? "TestPassword123!";

  await page.goto("/auth/register");
  await expect(page.locator('button[type="submit"]')).toBeVisible({ timeout: 15_000 });
  await page.fill("#name", "E2E Verify");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await clickAndWaitForUrl(page, 'button[type="submit"]', /\/onboarding/, 20_000);

  await expect(page.locator("text=Setup Keuangan Awal")).toBeVisible({ timeout: 10_000 });
  await page.click('button:has-text("Lanjut")');
  await page.waitForTimeout(500);
  await assertNoErrorAlert(page);
  await expect(page.locator("text=Rekening & Tabungan")).toBeVisible({ timeout: 10_000 });

  await page.fill("#nama-rekening", "BCA E2E");
  await page.fill("#saldo-rekening", "1000000");
  await page.click('button:has-text("+ Tambah Rekening")');
  await expect(page.locator("text=BCA E2E")).toBeVisible();
  await page.click('button:has-text("Lanjut")');
  await page.waitForTimeout(500);
  await assertNoErrorAlert(page);

  for (let i = 3; i <= 5; i++) {
    await page.click('button:has-text("Lewati langkah ini")');
    await page.waitForTimeout(300);
    await assertNoErrorAlert(page);
  }
  await page.click('button:has-text("Lewati & Selesai")');
  await page.waitForTimeout(500);
  await assertNoErrorAlert(page);

  await expect(page.locator("text=Setup Selesai!")).toBeVisible({ timeout: 15_000 });
  await page.click('button:has-text("Lihat Dashboard")');
  await page.waitForURL(/\/dashboard/, { timeout: 15_000, waitUntil: "commit" });

  return { email, password };
}

/** Declare a fixed asset (barang) without cash impact — for edit/toast tests. */
export async function seedFixedAsset(page: Page, name = "Barang E2E") {
  await page.goto("/assets");
  await page.waitForSelector("text=Total Nilai Barang", { timeout: 15_000 });
  await page.getByRole("button", { name: "Beli Barang" }).click();
  await page.getByRole("tab", { name: "Sudah Dimiliki" }).click();
  await page.fill("#asset-nama", name);
  await page.fill("#asset-jumlah", "1");
  await page.fill("#asset-harga", "1000000");
  await page.getByRole("button", { name: "Simpan Deklarasi" }).click();
  await page.waitForTimeout(1500);
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 10_000 });
}
