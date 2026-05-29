# Firestore migration & rollback — pre-scale hardening

This app's datastore is **Firestore (NoSQL)**, not SQL — there is no DDL, so
there are no `.sql` migration files. Schema changes are additive document
fields and new subcollections, applied lazily at write time. Every change below
is **additive and backward-compatible**: existing documents keep their values
and a rollback is "stop reading/writing the new field" (no destructive
operation, no data loss).

There is **no migration script to run**. The one piece of backfill logic ships
in the app (timezone, below) and is idempotent.

---

## 1. `state.timezone` (string, IANA) — Layer 0.4

- **Forward:** On app load, if `state.timezone` is absent it is set to the
  device zone (`detectTimeZone()`) and persisted on the next write. Existing
  users are backfilled transparently on their next session.
- **Read fallback:** `resolveTimeZone(state)` returns the runtime zone when the
  field is missing, so behavior is unchanged until the backfill lands.
- **Rollback:** Stop reading `state.timezone` (revert to `new Date().toDateString()`).
  The leftover field is inert. No data loss.

## 2. `goal.completionLog` (array) — added in Layer 0.2, **removed in Layer 2**

- **History:** Introduced as the in-doc write-time XP breakdown, then removed
  because it duplicated the `xpAudit` subcollection and grew the user doc toward
  Firestore's 1 MB ceiling.
- **Current state:** The app no longer writes `completionLog`. Any values
  written during the brief 0.2 window are harmless and ignored by all readers.
- **Cleanup (optional, non-urgent):** `completionLog` can be deleted from goals
  with a one-off pass (`FieldValue.delete()`), but leaving it costs only space.
- **Rollback:** N/A (nothing reads it).

## 3. `users/{uid}/completionKeys/*` (subcollection) — Layer 0.3

- **Purpose:** Idempotency ledger. Doc id = `habit_{habitId}_{YYYY-MM-DD}` or
  `quest_{questId}`. Created with `tx.create` inside the completion transaction
  — the DB-level uniqueness guarantee (Firestore's equivalent of a UNIQUE
  constraint).
- **Forward:** Created on demand by the MCP completion path. No backfill needed
  (absence of a key just means "not yet completed via the transactional path").
- **Rollback:** Delete the subcollection and revert the MCP handlers to the
  prior application-level check. Completions still de-dupe at day granularity
  via `state.lastCompletions`, just without the atomic guarantee.

## 4. `users/{uid}/xpAudit/*` (subcollection) — Layer 1.3

- **Purpose:** Append-only audit log of completion/XP events. Written
  transactionally by the MCP server and best-effort by the client. Lives outside
  the user doc, so it does not count toward the 1 MB ceiling.
- **Forward:** Created on demand. No backfill (it is forward-looking history).
- **Rollback:** Stop writing audit rows; optionally delete the subcollection.
  No effect on gameplay — XP totals live in `catScores`, not here.

## 5. `goal.surge`, `state.quests`, `level.boss`, `state.gamificationConfig`

- These additive fields predate this hardening pass (feature work) but are
  noted for completeness: all optional, all default-resolved when absent, all
  roll back by ignoring the field. No migration required.

---

## Verifying a rollback is safe

Because every change is additive:
1. Reading old documents (without the new fields) already works — the read
   fallbacks were written first.
2. Reading new documents after a code rollback works — the extra fields/
   subcollections are simply not read.
3. No field changed type or semantics, so there is no value to migrate back.
