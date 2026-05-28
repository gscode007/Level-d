/**
 * Client-side error reporting (Sentry). Env-guarded: with no VITE_SENTRY_DSN
 * set it is a complete no-op, so local dev and unconfigured deploys behave
 * exactly as before. Errors only.
 */
import * as Sentry from "@sentry/browser";

let started = false;

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (started || !dsn) return false;
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0, // free tier: error monitoring only, no perf traces
  });
  started = true;
  return true;
}

export function captureError(err, context) {
  try {
    if (started) Sentry.captureException(err, context ? { extra: context } : undefined);
  } catch { /* never let reporting break the app */ }
}
