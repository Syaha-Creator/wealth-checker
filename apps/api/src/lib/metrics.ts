/**
 * In-process RED-ish counters for Prometheus text scrape at GET /metrics.
 * Process-local only (resets on restart) — enough for single-replica VPS.
 */

type PathStats = {
  count: number;
  err5xx: number;
  durationMsSum: number;
};

const totals = {
  httpRequestsTotal: 0,
  httpRequests5xxTotal: 0,
  httpDurationMsSum: 0,
};

/** Bounded cardinality: path → stats (UUIDs/numeric ids collapsed). */
const byPath = new Map<string, PathStats>();
const MAX_PATHS = 80;

const SKIP_PATHS = new Set(["/metrics", "/health", "/health/ready"]);

export function normalizeMetricPath(path: string): string {
  const bare = path.split("?")[0] ?? path;
  return bare
    .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, "/:id")
    .replace(/\/\d+(?=\/|$)/g, "/:id");
}

export function recordHttpRequest(path: string, status: number, durationMs: number): void {
  if (SKIP_PATHS.has(path.split("?")[0] ?? path)) return;
  const ms = Math.max(0, durationMs);
  totals.httpRequestsTotal += 1;
  totals.httpDurationMsSum += ms;
  if (status >= 500) totals.httpRequests5xxTotal += 1;

  const key = normalizeMetricPath(path);
  let stats = byPath.get(key);
  if (!stats) {
    if (byPath.size >= MAX_PATHS) return;
    stats = { count: 0, err5xx: 0, durationMsSum: 0 };
    byPath.set(key, stats);
  }
  stats.count += 1;
  stats.durationMsSum += ms;
  if (status >= 500) stats.err5xx += 1;
}

function escapeLabel(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function renderPrometheusMetrics(): string {
  const lines: string[] = [
    "# HELP http_requests_total Total HTTP requests (excluding health/metrics).",
    "# TYPE http_requests_total counter",
    `http_requests_total ${totals.httpRequestsTotal}`,
    "# HELP http_requests_5xx_total Total HTTP 5xx responses.",
    "# TYPE http_requests_5xx_total counter",
    `http_requests_5xx_total ${totals.httpRequests5xxTotal}`,
    "# HELP http_request_duration_ms_sum Sum of request durations in milliseconds.",
    "# TYPE http_request_duration_ms_sum counter",
    `http_request_duration_ms_sum ${totals.httpDurationMsSum}`,
    "# HELP http_requests_by_path_total HTTP requests by normalized path.",
    "# TYPE http_requests_by_path_total counter",
  ];

  for (const [path, stats] of byPath) {
    lines.push(
      `http_requests_by_path_total{path="${escapeLabel(path)}"} ${stats.count}`,
    );
  }

  lines.push(
    "# HELP http_requests_5xx_by_path_total HTTP 5xx by normalized path.",
    "# TYPE http_requests_5xx_by_path_total counter",
  );
  for (const [path, stats] of byPath) {
    if (stats.err5xx === 0) continue;
    lines.push(
      `http_requests_5xx_by_path_total{path="${escapeLabel(path)}"} ${stats.err5xx}`,
    );
  }

  lines.push(
    "# HELP http_request_duration_ms_sum_by_path Duration sum by normalized path.",
    "# TYPE http_request_duration_ms_sum_by_path counter",
  );
  for (const [path, stats] of byPath) {
    lines.push(
      `http_request_duration_ms_sum_by_path{path="${escapeLabel(path)}"} ${stats.durationMsSum}`,
    );
  }

  lines.push(
    "# HELP process_uptime_seconds Process uptime in seconds.",
    "# TYPE process_uptime_seconds gauge",
    `process_uptime_seconds ${process.uptime()}`,
  );

  return `${lines.join("\n")}\n`;
}

/** Test helper — reset counters between unit tests. */
export function resetMetricsForTests(): void {
  totals.httpRequestsTotal = 0;
  totals.httpRequests5xxTotal = 0;
  totals.httpDurationMsSum = 0;
  byPath.clear();
}
