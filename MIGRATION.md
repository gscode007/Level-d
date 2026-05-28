# Gamification mechanics — migration note

Four mechanics were layered onto Level-d: streak multipliers + comeback bonus,
surge mode, quests, and an opt-in boss challenge. This note records the schema
changes and confirms existing data is preserved.

## Bottom line: no migration script, zero data loss

Every new field is **additive and optional**, resolved with a default when
absent. Existing Firestore user docs work unchanged on first load — nothing is
rewritten, deleted, or recomputed at deploy time. Existing habits, completions,
streaks, and `catScores` totals carry over untouched.

## Schema changes (all additive / optional)

| Location | New field | Shape | Default when absent |
|---|---|---|---|
| `state` | `quests` | `Quest[]` (top-level, survives chapter advance) | `[]` (`mkDefault`) / treated as `[]` |
| `state` | `gamificationConfig` | partial override of the central config | none → `DEFAULT_GAMIFICATION_CONFIG` |
| `goal` (habitual) | `surge` | `{ target: string, multiplier: number }` | none → no surge variant |
| `level` (chapter) | `boss` | `{ enabled, habitCompletionRate, trailingWeeks, signatureQuestsRequired }` | none → advancement behaves exactly as before |

**Quest shape:** `{ id, title, dimension, band, xp, status: "active"|"completed",
signature, chapterId|null, createdAt, completedAt?, xpAwarded? }`.

No existing field changed type or meaning. Streak data (`state.streaks`,
per-habit streak counts) is read by the new reward logic but its computation is
**unchanged**.

## Behavioral changes to be aware of

- **Baseline XP is byte-for-byte identical.** A habit completed with no streak,
  no surge, and no comeback awards exactly what it did before. Locked by
  `npm test` (`baseline XP is byte-for-byte calcBaseXP …`).
- **Streak reward model changed (intentional, per decision).** The old additive
  streak bonus (`+10/+25/+60/+150`) was **replaced** by a streak *multiplier*
  (`x1.2` at 7d, `x1.5` at 21d). Already-earned XP in `catScores` is not
  recomputed — only future completions use the new formula. The no-streak case
  is unaffected.
- **Quest XP** credits `catScores`/ranks only and is **exempt from the
  per-category daily habit cap** (`DAILY_XP_CAP`), so that protected
  habit-capping behavior is untouched.
- **MCP:** all existing endpoints keep their names, signatures, and return
  shapes. `list_goals` gains an additive `surge` field. New endpoints:
  `list_quests`, `add_quest`, `complete_quest`. `complete_quest` marks a quest
  done but leaves XP pending; the client awards it on next load via
  `reconcileQuestXP` (idempotent; scoped to the current/unlinked chapter so XP
  is never double-awarded or misattributed). `complete_habit` and
  `advance_level` are unchanged — the boss gate applies to the **in-app**
  advance button only.

## Central config — every tunable + default

All tunables live in [`src/gamification.config.js`](src/gamification.config.js)
(`DEFAULT_GAMIFICATION_CONFIG`), imported by both the client and the MCP server.
Per-user overrides go in `state.gamificationConfig` and are deep-merged over the
defaults by `getGamificationConfig(state)`; malformed overrides fall back safely.

| Tunable | Default | Meaning |
|---|---|---|
| `combinedMultiplierCeiling` | `2.0` | clamp on `streakMult × surgeMult` |
| `streak.tiers` | `7d → 1.2`, `21d → 1.5` | streak XP multiplier tiers (dominant lever) |
| `streak.baseMultiplier` | `1.0` | below the lowest tier |
| `comeback.enabled` | `true` | never-miss-twice bonus on/off |
| `comeback.bonusPct` | `0.25` | `+25%` of base XP, additive, ceiling-exempt |
| `surge.defaultMultiplier` | `1.2` | modest kicker (< max streak multiplier) |
| `quests.bands` | `small 20 / medium 50 / large 120` | flat quest XP by band |
| `quests.defaultBand` | `medium` | default band for new quests |
| `boss.habitCompletionRate` | `0.85` | per-week completion threshold |
| `boss.trailingWeeks` | `3` | number of trailing completed weeks evaluated |
| `boss.signatureQuestsRequired` | `1` | signature quests completed in the chapter |

### XP stacking rule (implemented in `src/gamification/xp.js`)

```
final = round( baseXP * clamp(streakMult * surgeMult, ceiling) ) + comebackBonus
```

The combined multiplier is clamped to the ceiling; the comeback bonus is
additive, applied after the clamp, and is **not** subject to the ceiling. The
existing per-category daily cap still clamps the final per-completion habit
award.

## Tests

`npm test` runs `node --test` against the pure modules (no new dependencies):
- `src/gamification/xp.test.mjs` — baseline equality, streak tiers, surge,
  combined-multiplier ceiling, comeback (additive + ceiling-exempt), config
  override merge.
- `src/gamification/boss.test.mjs` — opt-in gating, the 3-weeks + signature
  composite, per-chapter overrides.

## Manual verification checklist (UI needs a live Firebase session)

The pure XP/boss math is covered by `npm test`; `npm run build` confirms the
bundle compiles. The following require running the app against real data:

- **Phase 1/baseline:** complete a habit with no streak → same XP as before;
  chapters still load; ranks unchanged.
- **Phase 2:** a 7-day streak shows `x1.2` in the XP pop; completing after a
  missed day shows "Back on track" and the comeback bonus.
- **Phase 3:** add a surge variant in the habit form; the ⚡ button awards the
  surge-multiplied XP; the checkbox still awards baseline; streak advances the
  same either way.
- **Phase 4:** add/complete/delete a quest in the Quests tab; XP lands on the
  quest's dimension; quests survive chapter advancement; `add_quest` /
  `complete_quest` / `list_quests` work from the MCP connector and the XP
  reconciles on next app open.
- **Phase 5:** enable the boss on a rank-complete chapter; the advance button is
  replaced by the boss-locked pill; the card shows weeks-at-target and signature
  progress; disabling it restores the normal advance button.
