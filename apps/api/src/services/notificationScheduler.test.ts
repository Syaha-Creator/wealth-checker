import { describe, it, expect } from "vitest";
import { shouldSendReminder, reminderCronFromTime } from "./notificationScheduler";

describe("shouldSendReminder", () => {
  it("tidak kirim jika sudah ada transaksi hari ini", () => {
    expect(shouldSendReminder(true, true)).toBe(false);
  });

  it("kirim jika belum ada transaksi hari ini dan reminder aktif", () => {
    expect(shouldSendReminder(true, false)).toBe(true);
  });

  it("tidak kirim jika preference nonaktif, meski belum ada transaksi", () => {
    expect(shouldSendReminder(false, false)).toBe(false);
  });

  it("tidak kirim jika preference nonaktif dan sudah ada transaksi", () => {
    expect(shouldSendReminder(false, true)).toBe(false);
  });
});

describe("reminderCronFromTime", () => {
  it("mengubah HH:MM ke pattern cron 5-field", () => {
    expect(reminderCronFromTime("20:00", "Asia/Jakarta")).toEqual({ pattern: "0 20 * * *", tz: "Asia/Jakarta" });
  });

  it("menerima format HH:MM:SS (dari kolom time Postgres)", () => {
    expect(reminderCronFromTime("07:30:00", "Asia/Jakarta")).toEqual({ pattern: "30 7 * * *", tz: "Asia/Jakarta" });
  });

  it("melempar error untuk jam di luar rentang", () => {
    expect(() => reminderCronFromTime("25:00", "Asia/Jakarta")).toThrow();
  });

  it("melempar error untuk menit di luar rentang", () => {
    expect(() => reminderCronFromTime("10:75", "Asia/Jakarta")).toThrow();
  });

  it("melempar error untuk format yang tidak valid", () => {
    expect(() => reminderCronFromTime("malam", "Asia/Jakarta")).toThrow();
  });
});
