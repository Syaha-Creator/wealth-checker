import { describe, it, expect, vi, afterEach } from "vitest";
import { createLogger } from "./logger";

describe("createLogger (structured JSON)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes JSON with level, event, and bindings", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const log = createLogger({ requestId: "req-1" });
    log.info("http_request", { method: "GET", path: "/health", status: 200 });

    expect(spy).toHaveBeenCalledOnce();
    const payload = JSON.parse(String(spy.mock.calls[0][0]));
    expect(payload.level).toBe("info");
    expect(payload.event).toBe("http_request");
    expect(payload.requestId).toBe("req-1");
    expect(payload.method).toBe("GET");
    expect(payload.path).toBe("/health");
    expect(payload.status).toBe(200);
    expect(payload.ts).toBeTruthy();
  });

  it("serializes Error on error level", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const log = createLogger();
    log.error("unhandled_error", { path: "/x" }, new Error("boom"));

    const payload = JSON.parse(String(spy.mock.calls[0][0]));
    expect(payload.level).toBe("error");
    expect(payload.event).toBe("unhandled_error");
    expect(payload.errName).toBe("Error");
    expect(payload.errMessage).toBe("boom");
    expect(payload.errStack).toContain("Error: boom");
  });

  it("child() merges bindings", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const log = createLogger({ service: "test" }).child({ jobId: "j1" });
    log.warn("job_failed", { userId: "u1" });

    const payload = JSON.parse(String(spy.mock.calls[0][0]));
    expect(payload.jobId).toBe("j1");
    expect(payload.userId).toBe("u1");
  });
});
