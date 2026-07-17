import type { Context, Next } from "hono";
import { logger } from "../lib/logger";
import { recordHttpRequest } from "../lib/metrics";
import { notifyAlert } from "../lib/alertWebhook";
import type { AppEnv } from "../types";

export const REQUEST_ID_HEADER = "X-Request-Id";

/**
 * Accept or generate a request ID, attach to context + response header,
 * and emit one structured http_request log after the handler finishes.
 */
export async function requestIdMiddleware(c: Context<AppEnv>, next: Next) {
  const incoming = c.req.header(REQUEST_ID_HEADER)?.trim();
  const requestId = incoming && incoming.length > 0 ? incoming.slice(0, 128) : crypto.randomUUID();
  c.set("requestId", requestId);
  c.header(REQUEST_ID_HEADER, requestId);

  const started = Date.now();
  await next();

  const durationMs = Date.now() - started;
  const status = c.res.status;
  recordHttpRequest(c.req.path, status, durationMs);

  logger.info("http_request", {
    requestId,
    method: c.req.method,
    path: c.req.path,
    status,
    durationMs,
  });

  if (status >= 500) {
    notifyAlert("http_5xx", {
      requestId,
      method: c.req.method,
      path: c.req.path,
      status,
    });
  }
}
