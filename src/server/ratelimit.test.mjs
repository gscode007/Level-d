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
