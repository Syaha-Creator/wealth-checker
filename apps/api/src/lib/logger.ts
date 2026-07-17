/**
 * Structured JSON logger (observability P0).
 * Stable `event` names + machine-readable fields — no string interpolation.
 * Never log secrets, tokens, or full request bodies.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogFields = Record<string, unknown>;

export interface Logger {
  debug: (event: string, fields?: LogFields) => void;
  info: (event: string, fields?: LogFields) => void;
  warn: (event: string, fields?: LogFields, err?: unknown) => void;
  error: (event: string, fields?: LogFields, err?: unknown) => void;
  child: (bindings: LogFields) => Logger;
}

function serializeError(err: unknown): LogFields | undefined {
  if (err instanceof Error) {
    return { errName: err.name, errMessage: err.message, errStack: err.stack };
  }
  if (err !== undefined) {
    return { errMessage: String(err) };
  }
  return undefined;
}

function write(level: LogLevel, event: string, bindings: LogFields, fields?: LogFields, err?: unknown): void {
  const line = {
    level,
    event,
    ts: new Date().toISOString(),
    service: process.env.SERVICE_NAME ?? "wealth-checker-api",
    ...bindings,
    ...fields,
    ...serializeError(err),
  };
  const out = JSON.stringify(line);
  if (level === "error") console.error(out);
  else if (level === "warn") console.warn(out);
  else console.log(out);
}

export function createLogger(bindings: LogFields = {}): Logger {
  return {
    debug: (event, fields) => write("debug", event, bindings, fields),
    info: (event, fields) => write("info", event, bindings, fields),
    warn: (event, fields, err) => write("warn", event, bindings, fields, err),
    error: (event, fields, err) => write("error", event, bindings, fields, err),
    child: (extra) => createLogger({ ...bindings, ...extra }),
  };
}

export const logger = createLogger();
