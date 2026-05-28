/**
 * Timezone-aware "completion day" resolution — pure, no React / Firebase.
 *
 * Why this exists: the client computed "today" in the browser's timezone while
 * the MCP server computed it in UTC. For any non-UTC user those disagree around
 * local midnight, causing double-counts or wrong streak resets. This module is
 * the single shared source of "what civil day is it for this user", used by
 * both the client and the MCP server.
 *
 * `tzDateString` deliberately returns the SAME format as Date.prototype
 * .toDateString() ("Fri May 29 2026") so it is a drop-in replacement for the
 * legacy `todayStr()` — existing `lastCompletions` / `lastHabitDate` /
 * `decayAppliedOn` values stay comparable, so there is no data migration and a
 * user whose browser tz already matched their real tz sees identical behavior.
 *
 * `tzDayKeyISO` returns "YYYY-MM-DD" for use as a stable idempotency key.
 */

// Resolve the user's IANA timezone: explicit on state, else the runtime's zone,
// else UTC. Never throws.
export function resolveTimeZone(state) {
  if (state && typeof state.timezone === "string" && state.timezone) return state.timezone;
  try {
    const z = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (z) return z;
  } catch { /* ignore */ }
  return "UTC";
}

// The runtime's own IANA zone (used to backfill state.timezone on first load).
export function detectTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

// Civil date in `tz`, formatted like Date.prototype.toDateString().
export function tzDateString(date, tz) {
  const d = date instanceof Date ? date : new Date(date);
  try {
    // Re-read the instant as wall-clock in tz, then format as a plain date.
    return new Date(d.toLocaleString("en-US", { timeZone: tz })).toDateString();
  } catch {
    return d.toDateString();
  }
}

// Civil date in `tz` as "YYYY-MM-DD" (stable, safe for use in a document id).
export function tzDayKeyISO(date, tz) {
  const d = date instanceof Date ? date : new Date(date);
  try {
    // en-CA renders ISO-ordered YYYY-MM-DD.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

// Convenience: today / yesterday as civil-date strings in `tz`.
export function tzToday(tz, now = new Date()) {
  return tzDateString(now, tz);
}

export function tzYesterday(tz, now = new Date()) {
  const d = new Date(now);
  d.setDate(d.getDate() - 1);
  return tzDateString(d, tz);
}
