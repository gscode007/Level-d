import { test } from "node:test";
import assert from "node:assert/strict";

import { tzDateString, tzDayKeyISO, tzToday, tzYesterday, resolveTimeZone, detectTimeZone } from "./time.js";

const KOLKATA = "Asia/Kolkata";       // UTC+5:30
const LA = "America/Los_Angeles";     // UTC-8 (PST) / UTC-7 (PDT)

// 2026-05-29T19:00:00Z:
//   Kolkata = 2026-05-30 00:30  → next civil day
//   LA      = 2026-05-29 12:00  → same civil day
test("UTC instant resolves to the correct civil day per timezone (the streak bug)", () => {
  const instant = new Date("2026-05-29T19:00:00Z");
  assert.equal(tzDayKeyISO(instant, KOLKATA), "2026-05-30");
  assert.equal(tzDayKeyISO(instant, LA), "2026-05-29");
  assert.equal(tzDayKeyISO(instant, "UTC"), "2026-05-29");
});

test("UTC+5:30 midnight boundary: 18:29Z same day, 18:31Z next day in Kolkata", () => {
  // Kolkata is UTC+5:30, so local midnight is 18:30Z.
  assert.equal(tzDayKeyISO(new Date("2026-05-29T18:29:00Z"), KOLKATA), "2026-05-29");
  assert.equal(tzDayKeyISO(new Date("2026-05-29T18:31:00Z"), KOLKATA), "2026-05-30");
});

test("UTC-8 boundary: a late-evening LA completion stays on the LA day, not UTC's next day", () => {
  // 2026-01-15T06:00:00Z = 2026-01-14 22:00 PST → still Jan 14 in LA, Jan 15 in UTC.
  const instant = new Date("2026-01-15T06:00:00Z");
  assert.equal(tzDayKeyISO(instant, LA), "2026-01-14");
  assert.equal(tzDayKeyISO(instant, "UTC"), "2026-01-15");
});

test("client (browser tz) and server (UTC) now agree when both use the user's stored tz", () => {
  const instant = new Date("2026-05-29T20:00:00Z"); // Kolkata 01:30 next day
  // Server previously computed UTC; now it uses the user's tz and matches the client.
  const serverDay = tzDayKeyISO(instant, KOLKATA);
  const clientDay = tzDayKeyISO(instant, KOLKATA);
  assert.equal(serverDay, clientDay);
  assert.equal(serverDay, "2026-05-30");
});

test("tzDateString keeps the legacy toDateString() format (drop-in, no migration)", () => {
  const instant = new Date("2026-05-29T12:00:00Z");
  const s = tzDateString(instant, "UTC");
  // e.g. "Fri May 29 2026"
  assert.match(s, /^[A-Z][a-z]{2} [A-Z][a-z]{2} \d{2} \d{4}$/);
  assert.equal(s, new Date("2026-05-29T12:00:00Z").toUTCString().slice(0, 3) + " May 29 2026");
});

test("tzToday / tzYesterday differ by one civil day", () => {
  const now = new Date("2026-05-29T12:00:00Z");
  assert.equal(tzToday("UTC", now), "Fri May 29 2026");
  assert.equal(tzYesterday("UTC", now), "Thu May 28 2026");
});

test("resolveTimeZone prefers state.timezone, falls back safely", () => {
  assert.equal(resolveTimeZone({ timezone: KOLKATA }), KOLKATA);
  assert.equal(typeof resolveTimeZone({}), "string");
  assert.equal(typeof resolveTimeZone(null), "string");
  assert.equal(typeof detectTimeZone(), "string");
});
