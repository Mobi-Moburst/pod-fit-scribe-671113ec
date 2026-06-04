// Shared structured JSON logger for HubSpot edge functions.
// Each call emits a single JSON line to Supabase Edge Function logs.
// Nothing is sent to HubSpot — this is local observability only.

export type LogLevel = "info" | "warn" | "error" | "debug";

export interface LogContext {
  fn: string;
  requestId: string;
  orgId?: string | null;
  userEmail?: string | null;
  [k: string]: unknown;
}

function redact(value: unknown): unknown {
  if (typeof value !== "string") return value;
  // Redact anything that looks like a bearer token or long secret-ish string.
  if (value.length > 60 && /^[A-Za-z0-9._\-]+$/.test(value)) return "[redacted]";
  return value;
}

function safeJson(obj: Record<string, unknown>): string {
  try {
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (/(api[_-]?key|token|secret|password|pat)/i.test(k)) {
        cleaned[k] = "[redacted]";
      } else {
        cleaned[k] = redact(v);
      }
    }
    return JSON.stringify(cleaned);
  } catch {
    return JSON.stringify({ logger_error: "serialize_failed" });
  }
}

export function newRequestId(): string {
  return crypto.randomUUID();
}

export function createLogger(ctx: LogContext) {
  const base = { ...ctx };

  function emit(level: LogLevel, event: string, extra?: Record<string, unknown>) {
    const line = safeJson({
      ts: new Date().toISOString(),
      level,
      event,
      ...base,
      ...(extra || {}),
    });
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  }

  return {
    info: (event: string, extra?: Record<string, unknown>) => emit("info", event, extra),
    warn: (event: string, extra?: Record<string, unknown>) => emit("warn", event, extra),
    error: (event: string, extra?: Record<string, unknown>) => emit("error", event, extra),
    debug: (event: string, extra?: Record<string, unknown>) => emit("debug", event, extra),
    child: (extra: Record<string, unknown>) => createLogger({ ...base, ...extra } as LogContext),
  };
}

export type HubspotLogger = ReturnType<typeof createLogger>;

const GATEWAY_URL = "https://connector-gateway.lovable.dev/hubspot";

/**
 * Fetch wrapper that logs every HubSpot gateway call (method, path, status, latency, bytes).
 * Mirrors the regular fetch signature — drop-in replacement.
 */
export async function loggedHubspotFetch(
  logger: HubspotLogger,
  url: string,
  init: RequestInit,
  meta?: Record<string, unknown>,
): Promise<Response> {
  const started = Date.now();
  const method = (init.method || "GET").toUpperCase();
  const path = url.startsWith(GATEWAY_URL) ? url.slice(GATEWAY_URL.length) : url;
  try {
    const resp = await fetch(url, init);
    const latency_ms = Date.now() - started;
    const lvl: LogLevel = resp.ok ? "info" : "warn";
    logger[lvl]("hubspot_gateway_call", {
      method,
      path,
      status: resp.status,
      ok: resp.ok,
      latency_ms,
      ...(meta || {}),
    });
    return resp;
  } catch (err) {
    logger.error("hubspot_gateway_error", {
      method,
      path,
      latency_ms: Date.now() - started,
      message: err instanceof Error ? err.message : String(err),
      ...(meta || {}),
    });
    throw err;
  }
}
