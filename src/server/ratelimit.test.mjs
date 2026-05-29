import { test } from "node:test";
import assert from "node:assert/strict";

import { toLimitResult, checkCompletionRateLimit } from "./ratelimit.js";

test("toLimitResult: success → allowed, no retry", () => {
  const r = toLimitResult(true, Date.now() + 60000);
  assert.equal(r.allowed, true);
  assert.equal(r.retryAfter, 0);
});

test("toLimitResult: breach → not allowed, retryAfter rounded up to >=1s", () => {
  const now = 1_000_000;
  assert.equal(toLimitResult(false, now + 4200, now).retryAfter, 5); // ceil(4.2)
  assert.equal(toLimitResult(false, now + 1, now).retryAfter, 1);    // floor would be 0 → clamped to 1
  assert.equal(toLimitResult(false, now - 100, now).retryAfter, 1);  // already reset → still >=1
});

test("checkCompletionRateLimit fails OPEN when Upstash is not configured", async () => {
  // No UPSTASH_REDIS_REST_URL/TOKEN in the test env → limiter is null.
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  const r = await checkCompletionRateLimit("user-1");
  assert.deepEqual(r, { allowed: true, retryAfter: 0 });
});

// A.3 — fail-open Redis failure is reported to Sentry once, still passes through.
test("Redis failure → Sentry.captureException called once AND pass-through (fail-open)", async () => {
  let calls = 0;
  let captured = null;
  const throwingLimiter = { limit: async () => { throw new Error("redis down"); } };
  const res = await checkCompletionRateLimit("u1", {
    limiter: throwingLimiter,
    captureError: (e) => { calls += 1; captured = e; },
  });
  assert.equal(calls, 1, "exactly one capture");
  assert.equal(captured.message, "redis down");
  assert.deepEqual(res, { allowed: true, retryAfter: 0 }, "fail-open pass-through unchanged");
});

test("a healthy limiter is NOT reported and still applies the limit", async () => {
  let calls = 0;
  const okLimiter = { limit: async () => ({ success: false, reset: Date.now() + 3000 }) };
  const res = await checkCompletionRateLimit("u1", { limiter: okLimiter, captureError: () => { calls += 1; } });
  assert.equal(calls, 0, "no spurious capture on the happy path");
  assert.equal(res.allowed, false);
  assert.ok(res.retryAfter >= 1);
});
