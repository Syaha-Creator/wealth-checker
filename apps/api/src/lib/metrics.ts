/**
 * In-process RED-ish counters for Prometheus text scrape at GET /metrics.
 * Process-local only (resets on restart) — enough for single-replica VPS.
 */

type Counters = {
  httpRequestsTotal: number;
  httpRequests5xxTotal: number;
  httpDurationMsSum: number;
};

const counters: Counters = {
  httpRequestsTotal: 0,
  httpRequests5xxTotal: 0,
  httpDurationMsSum: 0,
};

const SKIP_PATHS = new Set(["/metrics", "/health", "/health/ready"]);

export function recordHttpRequest(path: string, status: number, durationMs: number): void {
  if (SKIP_PATHS.has(path)) return;
  counters.httpRequestsTotal += 1;
  counters.httpDurationMsSum += Math.max(0, durationMs);
  if (status >= 500) counters.httpRequests5xxTotal += 1;
}

export function renderPrometheusMetrics(): string {
  const lines = [
    "# HELP http_requests_total Total HTTP requests (excluding health/metrics).",
    "# TYPE http_requests_total counter",
    `http_requests_total ${counters.httpRequestsTotal}`,
    "# HELP http_requests_5xx_total Total HTTP 5xx responses.",
    "# TYPE http_requests_5xx_total counter",
    `http_requests_5xx_total ${counters.httpRequests5xxTotal}`,
    "# HELP http_request_duration_ms_sum Sum of request durations in milliseconds.",
    "# TYPE http_request_duration_ms_sum counter",
    `http_request_duration_ms_sum ${counters.httpDurationMsSum}`,
    "# HELP process_uptime_seconds Process uptime in seconds.",
    "# TYPE process_uptime_seconds gauge",
    `process_uptime_seconds ${process.uptime()}`,
  ];
  return `${lines.join("\n")}\n`;
}

/** Test helper — reset counters between unit tests. */
export function resetMetricsForTests(): void {
  counters.httpRequestsTotal = 0;
  counters.httpRequests5xxTotal = 0;
  counters.httpDurationMsSum = 0;
}
