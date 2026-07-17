import { logger } from "./logger";

/**
 * Optional ops alert hook. Set ALERT_WEBHOOK_URL to a Discord/Slack/generic
 * incoming webhook. Discord URLs get a `content` payload; others get JSON
 * `{ event, service, ts, ...fields }`.
 */
export function notifyAlert(
  event: string,
  fields: Record<string, unknown> = {},
): void {
  const url = process.env.ALERT_WEBHOOK_URL?.trim();
  if (!url) return;

  const ts = new Date().toISOString();
  const isDiscord = url.includes("discord.com/api/webhooks");

  const payload = isDiscord
    ? {
        content: [
          `**wealth-checker-api** \`${event}\``,
          `ts: ${ts}`,
          ...Object.entries(fields).map(([k, v]) => `${k}: \`${String(v)}\``),
        ].join("\n"),
      }
    : {
        event,
        service: "wealth-checker-api",
        ts,
        ...fields,
      };

  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch((err) => {
    logger.warn("alert_webhook_failed", { event }, err);
  });
}
