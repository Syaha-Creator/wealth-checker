/**
 * E2E verification — Edit/Hapus Aset, Utang, Piutang.
 * Uses a fresh registered user (no hardcoded credentials) so CI is self-contained.
 * Run: bunx playwright test e2e/edit-delete-verification.spec.ts --reporter=list
 */
import { test, expect, type Page } from "@playwright/test";
import path from "path";
import fs from "fs";
import { registerAndOnboard, seedFixedAsset } from "./helpers";

const SCREENSHOT_DIR = path.join(__dirname, "../verification-screenshots");
const TEST_DEBT_NAME = `Utang E2E ${Date.now()}`;
const TEST_RECEIVABLE_NAME = `Piutang E2E ${Date.now()}`;

type WealthSummary = {
  kekayaanBersih: number;
  totalAset: number;
  totalUtang: number;
  totalFixedAssets: number;
  totalReceivables: number;
};

async function wealthSummary(page: Page): Promise<WealthSummary> {
  return page.evaluate(async () => {
    const r = await fetch("/api/wealth/summary", { credentials: "include" });
    if (!r.ok) throw new Error(`wealth/summary ${r.status}`);
    return r.json();
  });
}

async function shot(page: Page, name: string) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`), fullPage: true });
}

test("Manual E2E: edit/hapus aset, utang, piutang", async ({ page }) => {
  const log: string[] = [];
  const note = (s: string) => {
    log.push(s);
    console.log(s);
  };

  await registerAndOnboard(page);
  await seedFixedAsset(page, "Barang Edit E2E");
  note("✓ Register + seed aset sukses");

  // ── EDIT ASET ─────────────────────────────────────────────────────────────
  const wBeforeEdit = await wealthSummary(page);
  note(`[EDIT ASET] Kekayaan Bersih SEBELUM: Rp ${wBeforeEdit.kekayaanBersih.toLocaleString("id-ID")}`);
  note(`[EDIT ASET] Total Aset SEBELUM: Rp ${wBeforeEdit.totalAset.toLocaleString("id-ID")}`);

  await page.goto("/assets");
  await page.waitForSelector("text=Total Nilai Barang", { timeout: 15_000 });
  await shot(page, "01-assets-before-edit");

  const editAssetBtn = page.getByRole("button", { name: /Edit barang/i }).first();
  await expect(editAssetBtn).toBeVisible({ timeout: 10_000 });
  const assetNameBefore = (await editAssetBtn.getAttribute("aria-label"))?.replace(/^Edit barang /i, "") ?? "";
  await editAssetBtn.click();
  await shot(page, "02-assets-edit-form-open");

  const jumlahInput = page.locator('input[id^="edit-jumlah-"]').first();
  const oldJumlah = await jumlahInput.inputValue();
  const newJumlah = String(Math.max(0.01, Number(oldJumlah) + 1));
  await jumlahInput.fill(newJumlah);
  await page.locator('form:has(input[id^="edit-jumlah-"])').first().getByRole("button", { name: "Simpan" }).click();
  await page.waitForTimeout(1500);
  await expect(page.locator(`text=${assetNameBefore}`).first()).toBeVisible();
  await shot(page, "03-assets-after-edit");

  const wAfterEdit = await wealthSummary(page);
  note(`[EDIT ASET] Kekayaan Bersih SESUDAH: Rp ${wAfterEdit.kekayaanBersih.toLocaleString("id-ID")} (delta ${wAfterEdit.kekayaanBersih - wBeforeEdit.kekayaanBersih})`);

  await page.goto("/dashboard");
  await page.waitForSelector("text=Kekayaan Bersih", { timeout: 15_000 });
  await shot(page, "04-dashboard-after-edit-asset");

  // ── HAPUS UTANG (buat dulu via deklarasi) ─────────────────────────────────
  await page.goto("/debts");
  await page.waitForSelector("text=Total Sisa Utang", { timeout: 15_000 });
  await page.getByRole("button", { name: /Utang Baru/i }).click();
  await page.getByRole("tab", { name: "Utang yang Sudah Ada" }).click();
  await page.locator("#debt-pemberi").fill(TEST_DEBT_NAME);
  await page.locator("#debt-nominal").fill("999999");
  await page.getByRole("button", { name: "Simpan Deklarasi" }).click();
  await page.waitForTimeout(2000);
  await expect(page.getByText(TEST_DEBT_NAME)).toBeVisible({ timeout: 10_000 });
  await shot(page, "05-debts-test-debt-created");

  const wBeforeDeleteDebt = await wealthSummary(page);
  note(`[HAPUS UTANG] Kekayaan Bersih SEBELUM: Rp ${wBeforeDeleteDebt.kekayaanBersih.toLocaleString("id-ID")}`);

  await page.getByRole("button", { name: new RegExp(`Hapus utang ${TEST_DEBT_NAME}`, "i") }).click();
  await shot(page, "06-debts-delete-confirm-dialog");
  await page.getByRole("button", { name: "Hapus", exact: true }).last().click();
  await page.waitForTimeout(2000);
  await expect(page.getByText(TEST_DEBT_NAME)).not.toBeVisible({ timeout: 10_000 });
  await shot(page, "07-debts-after-delete");

  const wAfterDeleteDebt = await wealthSummary(page);
  const debtDelta = wAfterDeleteDebt.kekayaanBersih - wBeforeDeleteDebt.kekayaanBersih;
  note(`[HAPUS UTANG] Kekayaan Bersih SESUDAH: Rp ${wAfterDeleteDebt.kekayaanBersih.toLocaleString("id-ID")} (delta +${debtDelta.toLocaleString("id-ID")}, expected ~+999999)`);

  await page.goto("/dashboard");
  await shot(page, "08-dashboard-after-delete-debt");

  // ── EDIT UTANG (nama) ─────────────────────────────────────────────────────
  const EDIT_DEBT_NEW = `Bank Edit E2E ${Date.now()}`;
  await page.goto("/debts");
  await page.getByRole("button", { name: /Utang Baru/i }).click();
  await page.getByRole("tab", { name: "Utang yang Sudah Ada" }).click();
  await page.locator("#debt-pemberi").fill("Utang Edit Sementara");
  await page.locator("#debt-nominal").fill("500000");
  await page.getByRole("button", { name: "Simpan Deklarasi" }).click();
  await page.waitForTimeout(1500);
  await expect(page.getByText("Utang Edit Sementara")).toBeVisible();
  await shot(page, "09-debts-before-edit-name");

  await page.getByRole("button", { name: /Edit utang Utang Edit Sementara/i }).click();
  await shot(page, "10-debts-edit-form-open");
  await page.locator('input[id^="edit-debt-pemberi-"]').fill(EDIT_DEBT_NEW);
  await page.locator('form:has(input[id^="edit-debt-pemberi-"])').getByRole("button", { name: "Simpan" }).click();
  await page.waitForTimeout(1500);
  await expect(page.getByText(EDIT_DEBT_NEW)).toBeVisible();
  await shot(page, "11-debts-after-edit-name");
  note(`[EDIT UTANG] Nama diubah: Utang Edit Sementara → ${EDIT_DEBT_NEW}`);

  await page.getByRole("button", { name: new RegExp(`Hapus utang ${EDIT_DEBT_NEW}`, "i") }).click();
  await page.getByRole("button", { name: "Hapus", exact: true }).last().click();
  await page.waitForTimeout(1500);

  // ── EDIT PIUTANG (nama) ───────────────────────────────────────────────────
  const EDIT_REC_NEW = `Peminjam Edit E2E ${Date.now()}`;
  await page.getByRole("tab", { name: "Piutang" }).click();
  await page.getByRole("button", { name: /Piutang Baru/i }).click();
  await page.getByRole("tab", { name: "Piutang yang Sudah Ada" }).click();
  await page.locator("#rec-peminjam").fill(TEST_RECEIVABLE_NAME);
  await page.locator("#rec-nominal").fill("250000");
  await page.getByRole("button", { name: "Simpan Deklarasi" }).click();
  await page.waitForTimeout(1500);
  await expect(page.getByText(TEST_RECEIVABLE_NAME)).toBeVisible();
  await shot(page, "12-receivables-before-edit-name");

  await page.getByRole("button", { name: new RegExp(`Edit piutang ${TEST_RECEIVABLE_NAME}`, "i") }).click();
  await shot(page, "13-receivables-edit-form-open");
  await page.locator('input[id^="edit-rec-peminjam-"]').fill(EDIT_REC_NEW);
  await page.locator('form:has(input[id^="edit-rec-peminjam-"])').getByRole("button", { name: "Simpan" }).click();
  await page.waitForTimeout(1500);
  await expect(page.getByText(EDIT_REC_NEW)).toBeVisible();
  await shot(page, "14-receivables-after-edit-name");
  note(`[EDIT PIUTANG] Nama diubah: ${TEST_RECEIVABLE_NAME} → ${EDIT_REC_NEW}`);

  await page.getByRole("button", { name: new RegExp(`Hapus piutang ${EDIT_REC_NEW}`, "i") }).click();
  await page.getByRole("button", { name: "Hapus", exact: true }).last().click();
  await page.waitForTimeout(1500);

  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  fs.writeFileSync(path.join(SCREENSHOT_DIR, "verification-log.txt"), log.join("\n"), "utf8");

  expect(wAfterEdit.kekayaanBersih).toBeGreaterThan(wBeforeEdit.kekayaanBersih);
  expect(debtDelta).toBe(999_999);
});
