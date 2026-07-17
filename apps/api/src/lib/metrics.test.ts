import { describe, it, expect, beforeEach } from "vitest";
import {
  recordHttpRequest,
  renderPrometheusMetrics,
  resetMetricsForTests,
} from "./metrics";

describe("metrics", () => {
  beforeEach(() => {
    resetMetricsForTests();
  });

  it("mencatat request dan 5xx, mengabaikan /health dan /metrics", () => {
    recordHttpRequest("/api/accounts", 200, 12);
    recordHttpRequest("/api/accounts", 500, 40);
    recordHttpRequest("/health", 200, 1);
    recordHttpRequest("/metrics", 200, 1);

    const body = renderPrometheusMetrics();
    expect(body).toContain("http_requests_total 2");
    expect(body).toContain("http_requests_5xx_total 1");
    expect(body).toContain("http_request_duration_ms_sum 52");
  });
});
