/**
 * E2E verification — Toast notifications on add/edit/delete actions.
 * Uses a fresh registered user (no hardcoded credentials) so CI is self-contained.
 * Run: bunx playwright test e2e/toast-verification.spec.ts --reporter=list
 */
import { test, expect, type Page } from "@playwright/test";
import path from "path";
import fs from "fs";
import { registerAndOnboard, seedFixedAsset } from "./helpers";

const SCREENSHOT_DIR = path.join(__dirname, "../verification-screenshots");

async function shot(page: Page, name: string) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`), fullPage: true });
}

async function expectToast(page: Page, text: string | RegExp) {
  const toast = page.getByTestId("toast").filter({ hasText: text });
  await expect(toast).toBeVisible({ timeout: 10_000 });
  return toast;
}

test("Toast muncul untuk tambah, edit, dan hapus di 3 halaman berbeda", async ({ page }) => {
  await registerAndOnboard(page);
  await seedFixedAsset(page, "Barang Toast E2E");

  // ── TAMBAH: Rekening ──────────────────────────────────────────────────────
  await page.goto("/accounts");
  await page.getByRole("button", { name: "Tambah rekening baru" }).click();
  const accName = `Rek Toast ${Date.now()}`;
  await page.fill("#acc-nama", accName);
  await page.fill("#acc-saldo", "100000");
  await page.getByRole("button", { name: "Simpan" }).click();
  await expectToast(page, "Rekening berhasil ditambahkan");
  await shot(page, "toast-01-add-account");

  // ── EDIT: Aset ────────────────────────────────────────────────────────────
  await page.goto("/assets");
  await page.waitForSelector("text=Total Nilai Barang", { timeout: 15_000 });
  const editAssetBtn = page.getByRole("button", { name: /Edit barang/i }).first();
  await expect(editAssetBtn).toBeVisible({ timeout: 10_000 });
  await editAssetBtn.click();
  const jumlahInput = page.locator('input[id^="edit-jumlah-"]').first();
  const oldJumlah = await jumlahInput.inputValue();
  await jumlahInput.fill(String(Math.max(0.01, Number(oldJumlah) + 0.01)));
  await page.locator('form:has(input[id^="edit-jumlah-"])').first().getByRole("button", { name: "Simpan" }).click();
  await expectToast(page, "Aset berhasil diperbarui");
  await shot(page, "toast-02-edit-asset");

  // ── HAPUS: Utang (buat dulu lalu hapus) ───────────────────────────────────
  await page.goto("/debts");
  await page.waitForSelector("text=Total Sisa Utang", { timeout: 15_000 });
  await page.getByRole("button", { name: "Utang Baru" }).click();
  const debtName = `Utang Toast ${Date.now()}`;
  await page.getByRole("tab", { name: "Utang yang Sudah Ada" }).click();
  await page.fill("#debt-pemberi", debtName);
  await page.fill("#debt-nominal", "50000");
  await page.getByRole("button", { name: "Simpan Deklarasi" }).click();
  await expectToast(page, "Utang berhasil ditambahkan");
  await page.getByRole("button", { name: new RegExp(`Hapus utang ${debtName}`, "i") }).click();
  await page.getByRole("button", { name: "Hapus", exact: true }).click();
  await expectToast(page, "Utang berhasil dihapus");
  await shot(page, "toast-03-delete-debt");
});
