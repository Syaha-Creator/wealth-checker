import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("notifyAlert", () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true });

  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockClear();
    delete process.env.ALERT_WEBHOOK_URL;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("no-op kalau ALERT_WEBHOOK_URL kosong", async () => {
    const { notifyAlert } = await import("./alertWebhook");
    notifyAlert("http_5xx", { path: "/x" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("mengirim payload Discord content untuk webhook Discord", async () => {
    process.env.ALERT_WEBHOOK_URL =
      "https://discord.com/api/webhooks/123/abc";
    const { notifyAlert } = await import("./alertWebhook");
    notifyAlert("http_5xx", { path: "/api/x", status: 500 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as { content: string };
    expect(body.content).toContain("http_5xx");
    expect(body.content).toContain("path: `/api/x`");
  });
});
