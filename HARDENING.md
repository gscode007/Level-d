# level'd — Pre-Scale Hardening

Infrastructure correctness pass before first real-user distribution. Every
change is **additive**: existing endpoints keep their signatures, existing data
keeps its values, and users who don't trigger a new path are unaffected.

## Stack correction (important)

The hardening brief assumed **Next.js + Postgres + a connection pooler + SQL
migrations + cron**. This repo is actually:

- **Vite + React SPA** (not Next.js)
- **Firebase Firestore** — the entire user state is **one document per user**
  at `users/{uid}` — (not Postgres; no SQL, no pooler, no query planner)
- Vercel serverless functions in `api/` (the MCP server, OAuth, keys)
- No cron, no notification system

So the *mechanisms* the brief prescribed (PgBouncer, `EXPLAIN ANALYZE`, SQL
`UNIQUE` constraints, index scans, cron partitioning) have no target here. Each
layer's *intent* was re-expressed in Firestore/Vercel terms (confirmed with the
maintainer before implementation). The biggest real risk the Postgres framing
obscured — **a single document written via full-overwrite with no
transactions** — is exactly what Layer 0 fixes.

Tests: `npm test` (Node's built-in runner, no new deps) — **37 passing**.
Live-only evidence (P95 dashboards, Sentry feed, Lighthouse) must be captured
against a deploy; the env vars + steps are at the end.

---

## Layer 0 — Integrity ✅

| Sub | Change | Files |
|---|---|---|
| 0.4 | IANA `timezone` on state + shared tz-aware day helper; completion/streak/decay paths resolve "today" in the user's zone (client **and** MCP) | `src/gamification/time.js`, `src/App.jsx`, `src/utils.js`, `api/mcp.js` |
| 0.2 | Per-completion XP breakdown persisted at write time (`base / streakMult / surgeMult / comebackBonus`) | `src/gamification/xp.js` (`toCompletionRecord`) |
| 0.3 / 0.1 | Transactional **idempotency ledger** for completions — `tx.create` on a deterministic `(habit, day)` / `(quest)` key inside `runTransaction`; atomic, exactly-once | `src/server/completions.js`, `api/mcp.js` |

**The bug it fixes:** client computed "today" in browser TZ, MCP in UTC → non-UTC
users double-counted / mis-reset streaks around midnight; and the MCP
read-check-write was non-atomic → concurrent calls duplicated completions.

**Gate — PASS:**
- *50× concurrent completions, zero duplicates, no 500:* `node --test src/server/completions.test.mjs`
  → 50 concurrent → **exactly 1 completion, 1 ledger key, 1 audit row, 0 throws**; plus a
  true-race test proving the ledger `create` catches a stale application-level check.
- *XP read returns stored value:* total XP reads `catScores` (running totals), never re-aggregated; baseline-XP byte-identical test in `xp.test.mjs`.
- *UTC+5:30 streak:* `node --test src/gamification/time.test.mjs` → Kolkata 18:29Z = same day, 18:31Z = next day; UTC-8 boundary; client≡server agreement.

> Note: the idempotency tests run against an in-memory Firestore that models
> Firestore's transaction contract (optimistic concurrency + `create`-uniqueness).
> This proves the *logic* is exactly-once under that contract; a live 50-connection
> load test needs prod credentials.

---

## Layer 1 — Observability ✅

| Sub | Change | Files |
|---|---|---|
| 1.3 | Append-only **`users/{uid}/xpAudit`** subcollection. MCP writes the row *inside* the completion transaction (atomic); client appends best-effort | `src/server/audit.js`, `src/server/completions.js`, `src/observability/audit.js` |
| 1.2 | **Sentry** — browser (`VITE_SENTRY_DSN`) + serverless MCP (`SENTRY_DSN`, flush-before-freeze). No-op when DSN unset | `src/observability/sentry.js`, `src/server/sentry.js`, `api/mcp.js`, `src/main.jsx`, `src/App.jsx` |
| 1.1 | **Vercel Analytics** injected (no-op off-Vercel) | `src/main.jsx` |

**Gate:** "every completion writes an audit row" — PASS (unit test asserts exactly
one `xpAudit` row per completion under 50× concurrency). "Dashboard live / error
rate visible" requires a deploy with the DSNs + Analytics enabled (steps below).

---

## Layer 2 — Document-growth mitigation ✅

The real scaling cliff is **Firestore's 1,048,576-byte hard cap** on the single
user doc, not a missing index. The in-doc `completionLog` (added in 0.2)
duplicated the `xpAudit` subcollection and grew the doc unbounded. Removed it —
the breakdown now lives only in `xpAudit` (subcollections don't count toward the
parent doc). Added `estimateDocBytes` + a persist-time guard that reports to
Sentry once when the doc nears the configurable warn threshold (default 800 KB).

**Gate — before/after at 10× synthetic volume** (20 habits × ~730 completions),
`node --test src/gamification/docsize.test.mjs`:

| | doc size | vs 1 MB ceiling |
|---|---|---|
| **before** (in-doc `completionLog`) | **2,149,686 bytes** | **OVER — writes would fail** |
| **after** (`xpAudit` subcollection) | **207,526 bytes** | 90% smaller, < half ceiling |

Follow-up (flagged, not urgent): archive the slim `completions[]` to a
subcollection if it ever approaches the cap for extremely long-lived users.

---

## Layer 3 — Fan-out ✅ (3.1) / skipped (3.2)

- **3.1 Rate limiting:** per-user sliding window (default **30 completions/min**,
  configurable) on the MCP `complete_habit` / `complete_quest` tools via Upstash
  Redis. Env-guarded — **fails open** if `UPSTASH_REDIS_REST_*` unset, so a
  limiter outage never blocks legitimate completions. Breach → `isError` result
  with a Retry-After hint (429 semantics; JSON-RPC envelope stays 200, never 500).
  Files: `src/server/ratelimit.js`, `api/mcp.js`.
- **3.2 Cron partitioning: SKIPPED** — per the brief's edge case, there is no
  cron and no notification system in this app; building one that doesn't exist
  is out of scope.

**Gate:** 50× concurrent completion correctness is proven by
`completions.test.mjs`; the limiter sits additively on top. `node --test
src/server/ratelimit.test.mjs` covers fail-open + retry-after mapping.

---

## Layer 4 — Distribution (PWA) ✅

The client writes Firestore directly, so the Firebase-native offline completion
queue is **Firestore IndexedDB persistence** (`persistentLocalCache` +
multi-tab): offline writes queue locally and flush on reconnect; reads fall back
to cache. This is the correct adaptation of "Background Sync" for a Firestore
app. Zero-duplicate on replay is guaranteed by the day-granular idempotency
(client `lastCompletions` check + Layer 0.3 ledger). Also set workbox
`navigateFallback` so the shell opens offline (API/OAuth/well-known denylisted),
and added an offline status indicator. Manifest + SW already existed.

Files: `src/firebase.js`, `vite.config.js`, `src/hooks/useOnlineStatus.js`, `src/App.jsx`.

**Gate:** Lighthouse PWA ≥ 90 and offline-sync-zero-dup need a deploy to verify;
the zero-dup guarantee itself is unit-proven by the idempotency tests. Manual
check: DevTools → Offline → complete a habit → reconnect → exactly one completion.

---

## New config tunables (`src/gamification.config.js`)

All tunable, with per-user override via `state.gamificationConfig`:

| Key | Default | Layer |
|---|---|---|
| `limits.docSizeWarnBytes` | `800000` | 2 |
| `limits.rateLimit.completionsPerMinute` | `30` | 3 |

## New env vars (`.env.example`)

| Var | Purpose | Unset behavior |
|---|---|---|
| `VITE_SENTRY_DSN` | client error reporting | no-op |
| `SENTRY_DSN` | MCP server error reporting | no-op |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | rate limiting | fail-open (no limiting) |
| (Vercel Analytics) | latency | enable on the Vercel project; no var |

## Migrations / rollback

Firestore is schemaless — no `.sql` files. All changes are additive fields /
subcollections with read fallbacks; rollback = stop reading the field. Full
detail and per-change rollback steps: [`migrations/firestore-hardening.md`](migrations/firestore-hardening.md).

## Capturing the live-only evidence (your environment)

1. **Latency P95:** enable Analytics on the Vercel project → Observability →
   filter `/api/mcp`. Single-doc reads are O(1) fetches (no query planner), so
   the meaningful metric is MCP function P95, captured pre/post deploy.
2. **Errors:** set `SENTRY_DSN` + `VITE_SENTRY_DSN`; force an error and confirm
   it appears in the Sentry issue feed.
3. **Audit rows:** complete a habit, then inspect `users/{uid}/xpAudit` in the
   Firestore console — one row per completion.
4. **Rate limit:** set `UPSTASH_REDIS_REST_*`; call `complete_habit` >30×/min
   for one user → the isError/Retry-After result appears; others unaffected.
5. **PWA:** `npm run build && npm run preview`, run Lighthouse (PWA), and do the
   offline → reconnect single-completion check above.

---

## Closeout — A.1 / A.2 / A.3 (2026-05-29)

### A.1 — user-document audit (read-only)

`node scripts/audit-user-docs.js` run live against the **`progress-analysis`**
project:

```
inspected:                              4 docs
old-format (root completionLog[]):      0 docs
total completionLog entries to migrate: 0
max doc size:                           6,316 bytes
✓ No old-format arrays found — Layer 2 was clean from the start.
```

Clarification on the data model: `goal.completions[]` lives in the root doc **by
design** (Layer 2 kept it slim; subcollection archival is a flagged future
follow-up). The only field Layer 2 removed from the root was `goal.completionLog`
— and it did so by ceasing to write it, not by migrating entries. So A.2's only
possible target is stray `completionLog[]` leftovers.

### A.2 — migration outcome: **no migration needed**

A.1 found **0** docs with old-format arrays, so per the closeout rule the
migration is skipped. `node scripts/migrate-completions.js --dry-run` (live)
confirms: **4 skipped, 0 entries would move, no writes**. `--execute` was
intentionally **not run** (nothing to migrate).

The script (`scripts/migrate-completions.js`, logic in `src/server/migrate.js`)
is delivered anyway as idempotent insurance — a stale offline client could
theoretically sync a 0.2-era doc with `completionLog` after deploy. It is
idempotent (deterministic `mig_{goalId}_{ts}` ids; move + root-clear in one
transaction; re-run = no-op), handles partial prior migrations (existing rows
skipped, root cleared only after all entries confirmed), skips-not-errors on
clean docs, continues on per-doc failure, and flags >1MB / >450-entry docs for
manual follow-up. Proven by `src/server/migrate.test.mjs`.

### A.3 — fail-open Redis → Sentry: **wiring added in commit 0ad3fa0**

The Upstash rate-limit catch previously failed open silently. A `captureError`
call was added on that path (env-guarded; no-op without `SENTRY_DSN`) while the
fail-open behavior is unchanged. Verified by `src/server/ratelimit.test.mjs`: a
throwing limiter → `captureError` called exactly once **and** pass-through
`{allowed:true}` returned; a healthy limiter is not reported.

**Closeout status:** all three items complete. A.2 is a documented no-op
(Layer 2 was clean); A.1 tooling + A.3 wiring shipped. Full suite: 44 tests
passing.

---

## Arc / Rank / Level progression (2026-05-30)

A three-tier progression structure layered ON TOP of the existing chapter
system. **Additive.** No habit / XP / streak / surge / hardening / MCP
endpoint signatures changed. Engages only when the user calls `start_arc`;
until then, advance_level behaves exactly as before.

### Hierarchy
- **Arc** — one master goal (3–8 yr). One active at a time. Stored at
  `users/{uid}/arcs/{arcId}` (subcollection — root doc holds only
  `state.arc = { id, goal, startDate, status }` summary).
- **Level** — what the codebase calls a "chapter," reframed. Each level
  takes weeks to a month. **System-named "Level N"** (sequential within the
  arc) — not user-customizable while an arc is active. Completed levels are
  archived to `users/{uid}/levels/{levelId}` (subcollection — root array
  doesn't grow with arc history).
- **Rank** — E → D → C → B → A → S. Climbs as qualifying levels are
  completed. **Never drops. S is the ceiling.** Stored on root doc as
  `state.rank = { current, qualifyingLevelsAtRank }`.

### Dual-gate advancement (per current rank)
Both gates must pass for `advance_level` to advance under an arc:

- **Gate 1 (XP):** `accumulatedLevelXP >= baseThreshold × rank.xpMult`,
  where `accumulatedLevelXP = sum(catScores[USER_CATEGORIES])` (already
  resets per level, already includes quest XP via `reconcileQuestXP`).
- **Gate 2 (Boss):** trailing per-week habit completion rate ≥
  `rank.completion` across every week in `rank.windowWeeks` AND the
  rank-specific signature requirement is met. When `signature.kind ===
  "none"` the signature sub-check is skipped.

Gate failure → structured `{ ok:false, canAdvance:false, gates:{…} }` from
the MCP, **no throw**. Caller inspects `gates.xp` and `gates.boss` to see
exactly what's missing.

### Rank table (single source of truth: `gamification.config.js`)

| Rank | XP mult | Completion | Window  | Signature requirement                              | Qualifying levels to advance |
|------|---------|------------|---------|----------------------------------------------------|------------------------------|
| E    | 1.0     | 80%        | 3 weeks | none                                               | 3                            |
| D    | 1.1     | 83%        | 3 weeks | 1 signature quest, any band                        | 3                            |
| C    | 1.2     | 85%        | 3 weeks | 1 large-band signature quest                       | 3                            |
| B    | 1.3     | 88%        | 4 weeks | 1 large quest + 1 milestone completed              | 4                            |
| A    | 1.5     | 90%        | 4 weeks | 1 large quest + 1 milestone + any 21-day streak    | 5                            |
| S    | 1.75    | 92%        | 4 weeks | large quest + milestone + 21-day streak + 40% surge| Infinity (user-declared)     |

### `baseThreshold = 1800` — calibration

Strong-performer profile (the spec's target: clear E in ~3 weeks):

- 5 daily habits, Standard template × Medium difficulty × category modifier
  avg ≈ 1.12 → `round(10 × 1.5 × 1.12) ≈ 17 XP / completion`.
- 21 days × 5 habits = **105 completions** → raw `105 × 17 ≈ 1785 XP`.
- Streak ramp (week 1 ×1.0, week 2 ×1.0, week 3 averaging ×1.2 once the
  7-day tier hits) → effective ≈ ×1.07 → **~1910 XP**.
- Daily 60-XP-per-category cap (5 × 60 × 21 = 6300) is non-binding here.

Strong performer clears E in ~3 weeks; D needs `1800 × 1.1 = 1980` (~3.3
weeks); S needs `1800 × 1.75 = 3150` (sustained). Per-rank values live in
`gamification.config.js > progression`, fully overridable per user.

### MCP surface

- **NEW `start_arc({ goal })`** — errors if an arc is active. Stamps the
  current chapter as `Level 1`, initializes `state.rank = { current:"E",
  qualifyingLevelsAtRank:0 }`. Preserves existing XP, habits, quests.
- **EXTENDED `advance_level`** — under an arc: enforces the dual-gate;
  archives the completed level to `users/{uid}/levels/{lvlId}`; promotes
  rank when qualifying threshold hit; creates the next system-named level.
  Without an arc: legacy behavior unchanged.
- **NEW `complete_arc({ confirm:true })`** — only valid at S rank with
  ≥ `consecutiveSRankLevels` (default 3) qualifying S-rank levels cleared.
  User-declared, never automatic.
- **EXTENDED `get_identity_portrait`** — when an arc is active, response
  gains a `progression` block: `{ arc, rank:{current,
  qualifyingLevelsAtRank, levelsToNextRank}, level:{displayName, rank,
  sequenceInRank, sequenceInArc}, gates:{xp, boss, canAdvance} }`. Legacy
  fields unchanged.
- **HARDENED `update_chapter`** — rejects `title` when an arc is active
  (system-named levels). Other fields stay editable.

### Files

| What | Where |
|---|---|
| Rank table, baseThreshold, signature specs | `src/gamification.config.js` (`progression` block) |
| Pure rank counter (promotion, never-drop, S ceiling) | `src/gamification/rank.js` |
| Dual-gate evaluator + signature spec dispatcher | `src/gamification/progression.js` |
| Arc lifecycle + arc-mode advance | `api/mcp.js` (`toolStartArc`, `toolCompleteArc`, arc branch in `toolAdvanceLevel`) |
| Client gate enforcement + arc-mode advance | `src/App.jsx` (arc branch in `advanceLevel`, gate-driven `canAdvance`) |
| Arc header + Level N display | `src/components/Dashboard.jsx`, `src/components/RankHero.jsx` |

### Migration

Schemaless; **no migration required**.

- Existing users: `state.arc` / `state.rank` are simply absent →
  `isArcActive()` returns false → legacy single-gate behavior.
- Mid-chapter users who later call `start_arc`: the current chapter is
  stamped `Level 1` and rank initialized to E. **Existing catScores /
  habits / quests / streaks are preserved as-is.**
- Past `state.levels[]` entries are not backfilled with arc metadata
  (they pre-date the arc and don't need labels).

**Rollback:** stop reading `state.arc` and `state.rank` (legacy code path
ignores them); `users/{uid}/arcs/*` and `users/{uid}/levels/*`
subcollections remain on disk but stop receiving writes.

### Tests

`src/gamification/rank.test.mjs` and `src/gamification/progression.test.mjs`
cover: rank-specific gate math (E…S), never-drop on repeated calls, S
ceiling, full E→S walk, XP-only fail, boss-only fail, signature-spec
parsing (none / signatureQuests with band / milestonesCompleted /
streakAchieved / composite / surgePct fail-closed without stats),
progression-summary shape. Full suite: **64 passing.**
