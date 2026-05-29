/**
 * Server-side error reporting (Sentry) for the serverless MCP function.
 * Env-guarded by SENTRY_DSN — no DSN means a complete no-op. In a serverless
 * runtime the function can freeze immediately after responding, so captureError
 * flushes before returning.
 */
import * as Sentry from "@sentry/node";

let started = false;

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (started || !dsn) return false;
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV || "development",
    tracesSampleRate: 0,
  });
  started = true;
  return true;
}

export async function captureError(err, context) {
  try {
    if (!started) return;
    Sentry.captureException(err, context ? { extra: context } : undefined);
    await Sentry.flush(2000);
  } catch { /* ignore */ }
}
