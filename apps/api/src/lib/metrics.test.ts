import { describe, it, expect, beforeEach } from "vitest";
import {
  recordHttpRequest,
  renderPrometheusMetrics,
  resetMetricsForTests,
  normalizeMetricPath,
} from "./metrics";

describe("metrics", () => {
  beforeEach(() => {
    resetMetricsForTests();
  });

  it("normalizeMetricPath collapses ids", () => {
    expect(normalizeMetricPath("/api/accounts/42")).toBe("/api/accounts/:id");
    expect(
      normalizeMetricPath("/api/households/accept-invite/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"),
    ).toBe("/api/households/accept-invite/:id");
  });

  it("mencatat request dan 5xx per path, mengabaikan /health dan /metrics", () => {
    recordHttpRequest("/api/accounts", 200, 12);
    recordHttpRequest("/api/accounts/9", 500, 40);
    recordHttpRequest("/health", 200, 1);
    recordHttpRequest("/metrics", 200, 1);

    const body = renderPrometheusMetrics();
    expect(body).toContain("http_requests_total 2");
    expect(body).toContain("http_requests_5xx_total 1");
    expect(body).toContain('http_requests_by_path_total{path="/api/accounts"} 1');
    expect(body).toContain('http_requests_by_path_total{path="/api/accounts/:id"} 1');
    expect(body).toContain('http_requests_5xx_by_path_total{path="/api/accounts/:id"} 1');
  });
});
