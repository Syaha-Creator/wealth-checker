import { describe, it, expect } from "vitest";
import { InMemoryChecklistStore } from "../services/checklist";
import {
  checklistListQuerySchema,
  checklistPatchBodySchema,
  checklistItemKeyParam,
} from "./checklist";

const HH_A = "11111111-1111-1111-1111-111111111111";
const HH_B = "22222222-2222-2222-2222-222222222222";
const USER_A = "user-a";
const USER_B = "user-b";

describe("GET /api/checklist — in-memory store", () => {
  it("tanpa data existing → array kosong", () => {
    const store = new InMemoryChecklistStore();
    expect(store.list(HH_A, "legacy_planning")).toEqual([]);
  });

  it("GET setelah beberapa PATCH → hanya category yang di-filter", () => {
    const store = new InMemoryChecklistStore();
    store.upsert(HH_A, USER_A, "legacy_planning", "buat_surat_wasiat", true);
    store.upsert(HH_A, USER_A, "legacy_planning", "tentukan_ahli_waris", false);
    store.upsert(HH_A, USER_A, "budgeting_tips", "catat_pengeluaran_harian", true);

    const legacy = store.list(HH_A, "legacy_planning");
    expect(legacy).toHaveLength(2);
    expect(legacy.map((r) => r.itemKey).sort()).toEqual(["buat_surat_wasiat", "tentukan_ahli_waris"]);
    expect(legacy.every((r) => r.itemKey !== "catat_pengeluaran_harian")).toBe(true);

    const tips = store.list(HH_A, "budgeting_tips");
    expect(tips).toHaveLength(1);
    expect(tips[0].itemKey).toBe("catat_pengeluaran_harian");
  });

  it("isolasi household — item household lain tidak muncul", () => {
    const store = new InMemoryChecklistStore();
    store.upsert(HH_A, USER_A, "legacy_planning", "buat_surat_wasiat", true);
    store.upsert(HH_B, USER_B, "legacy_planning", "buat_surat_wasiat", false);

    const listA = store.list(HH_A, "legacy_planning");
    expect(listA).toHaveLength(1);
    expect(listA[0].isChecked).toBe(true);

    const listB = store.list(HH_B, "legacy_planning");
    expect(listB).toHaveLength(1);
    expect(listB[0].isChecked).toBe(false);
  });
});

describe("PATCH /api/checklist/:itemKey — in-memory store", () => {
  it("toggle item baru → tersimpan dengan benar", () => {
    const store = new InMemoryChecklistStore();
    const saved = store.upsert(HH_A, USER_A, "legacy_planning", "buat_surat_wasiat", true);

    expect(saved.itemKey).toBe("buat_surat_wasiat");
    expect(saved.isChecked).toBe(true);
    expect(saved.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const listed = store.list(HH_A, "legacy_planning");
    expect(listed).toHaveLength(1);
    expect(listed[0].isChecked).toBe(true);
  });

  it("toggle item yang sudah ada → UPDATE, bukan INSERT baru", () => {
    const store = new InMemoryChecklistStore();
    store.upsert(HH_A, USER_A, "legacy_planning", "buat_surat_wasiat", true);
    store.upsert(HH_A, USER_B, "legacy_planning", "buat_surat_wasiat", false);

    expect(store.countUnique(HH_A, "legacy_planning", "buat_surat_wasiat")).toBe(1);

    const listed = store.list(HH_A, "legacy_planning");
    expect(listed).toHaveLength(1);
    expect(listed[0].isChecked).toBe(false);
  });
});

describe("GET/PATCH /api/checklist — validasi Zod", () => {
  it("GET menolak tanpa category (400)", () => {
    const parsed = checklistListQuerySchema.safeParse({});
    expect(parsed.success).toBe(false);
  });

  it("PATCH menolak body tidak valid (400)", () => {
    const missingChecked = checklistPatchBodySchema.safeParse({ category: "legacy_planning" });
    expect(missingChecked.success).toBe(false);

    const missingCategory = checklistPatchBodySchema.safeParse({ checked: true });
    expect(missingCategory.success).toBe(false);
  });

  it("PATCH menolak itemKey kosong di URL param (400)", () => {
    const parsed = checklistItemKeyParam.safeParse({ itemKey: "" });
    expect(parsed.success).toBe(false);
  });
});
