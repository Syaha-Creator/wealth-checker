import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: class MockResend {
    emails = { send: mockSend };
    constructor(_apiKey: string) {}
  },
}));

describe("sendPasswordResetEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.RESEND_API_KEY = "re_test_key_placeholder";
    delete process.env.RESEND_FROM_EMAIL;
  });

  it("memanggil Resend dengan parameter benar", async () => {
    mockSend.mockResolvedValue({ data: { id: "email-id-123" }, error: null });

    const { sendPasswordResetEmail } = await import("./email");
    await sendPasswordResetEmail({
      to: "user@example.com",
      resetUrl: "https://api.example.com/reset-password/abc?callbackURL=...",
    });

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith({
      from: "onboarding@resend.dev",
      to: "user@example.com",
      subject: "Reset Kata Sandi Wealth Checker",
      html: expect.stringContaining("https://api.example.com/reset-password/abc?callbackURL=..."),
    });
  });

  it("throw error jelas kalau Resend API gagal", async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: { message: "Invalid API key", name: "validation_error" },
    });

    const { sendPasswordResetEmail } = await import("./email");

    await expect(
      sendPasswordResetEmail({
        to: "user@example.com",
        resetUrl: "https://example.com/reset",
      }),
    ).rejects.toThrow("Gagal mengirim email reset password: Invalid API key");
  });

  it("throw error kalau RESEND_API_KEY tidak diset", async () => {
    delete process.env.RESEND_API_KEY;

    const { sendPasswordResetEmail } = await import("./email");

    await expect(
      sendPasswordResetEmail({
        to: "user@example.com",
        resetUrl: "https://example.com/reset",
      }),
    ).rejects.toThrow("RESEND_API_KEY tidak diset");
  });
});

describe("sendVerificationEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.RESEND_API_KEY = "re_test_key_placeholder";
    delete process.env.RESEND_FROM_EMAIL;
  });

  it("memanggil Resend dengan parameter benar", async () => {
    mockSend.mockResolvedValue({ data: { id: "email-id-456" }, error: null });

    const { sendVerificationEmail } = await import("./email");
    await sendVerificationEmail({
      to: "user@example.com",
      verifyUrl: "https://api.example.com/api/auth/verify-email?token=abc&callbackURL=/",
    });

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith({
      from: "onboarding@resend.dev",
      to: "user@example.com",
      subject: "Verifikasi Email Wealth Checker",
      html: expect.stringContaining(
        "https://api.example.com/api/auth/verify-email?token=abc&callbackURL=/",
      ),
    });
  });

  it("throw error jelas kalau Resend API gagal", async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: { message: "Invalid API key", name: "validation_error" },
    });

    const { sendVerificationEmail } = await import("./email");

    await expect(
      sendVerificationEmail({
        to: "user@example.com",
        verifyUrl: "https://example.com/verify",
      }),
    ).rejects.toThrow("Gagal mengirim email verifikasi: Invalid API key");
  });
});

describe("sendHouseholdInviteEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.RESEND_API_KEY = "re_test_key_placeholder";
    delete process.env.RESEND_FROM_EMAIL;
  });

  it("memanggil Resend dengan link undangan", async () => {
    mockSend.mockResolvedValue({ data: { id: "email-id-789" }, error: null });

    const { sendHouseholdInviteEmail } = await import("./email");
    await sendHouseholdInviteEmail({
      to: "member@example.com",
      inviteUrl: "https://wealth.velrox.cloud/household/accept-invite?token=abc",
      role: "editor",
    });

    expect(mockSend).toHaveBeenCalledWith({
      from: "onboarding@resend.dev",
      to: "member@example.com",
      subject: "Undangan Household Wealth Checker",
      html: expect.stringContaining("accept-invite?token=abc"),
    });
  });
});
