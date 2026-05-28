/**
 * Per-user sliding-window rate limit for the MCP completion tools (the external
 * abuse surface). Upstash Redis via REST, env-guarded: with no
 * UPSTASH_REDIS_REST_URL/TOKEN it FAILS OPEN (no limiting), so dev and
 * unconfigured deploys behave exactly as before and a limiter outage can never
 * block legitimate completions.
 *
 * Default 30 completions/minute/user (configurable via
 * gamification.config limits.rateLimit.completionsPerMinute).
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { DEFAULT_GAMIFICATION_CONFIG } from "../gamification.config.js";

let limiter;
let initialized = false;

function getLimiter() {
  if (initialized) return limiter;
  initialized = true;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) { limiter = null; return null; }
  const perMin = DEFAULT_GAMIFICATION_CONFIG.limits.rateLimit.completionsPerMinute;
  limiter = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(perMin, "60 s"),
    prefix: "lvld:complete",
    analytics: false,
  });
  return limiter;
}

// Pure: map an Upstash result to our { allowed, retryAfter(seconds) } shape.
export function toLimitResult(success, reset, now = Date.now()) {
  return { allowed: !!success, retryAfter: success ? 0 : Math.max(1, Math.ceil((reset - now) / 1000)) };
}

// Returns { allowed, retryAfter }. Fail-open on any error or missing config.
export async function checkCompletionRateLimit(uid) {
  const rl = getLimiter();
  if (!rl) return { allowed: true, retryAfter: 0 };
  try {
    const { success, reset } = await rl.limit(`u:${uid}`);
    return toLimitResult(success, reset);
  } catch {
    return { allowed: true, retryAfter: 0 };
  }
}
