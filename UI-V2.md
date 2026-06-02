# UI-V2 — Restructure, Celestial Reframe & De-identification

A 12-phase pass executed top to bottom. Every phase verified with
`npm test` (64/64 passing throughout) and `npm run build` (green throughout).

## Per-phase summary

### Phase 0 — Rebuild reactive background under celestial names
The reactive background system was rolled back between sessions; rebuilt
under celestial naming so no franchise vocabulary lives in user-facing
filepaths.
- `src/theme.config.js` — `TIER_BY_RANK` mapping (`Ember/Spark/Flare/Star/
  Nova/Supernova` → locked rank colors), all visual tunables, `LABELS.*`
  strings.
- `src/components/background/` — `TimeOfDayTint`, `Depth` (was DungeonDepth),
  `TierAura` (was RankAura), `Constellation`, `Embers` (was StreakEmbers),
  `ThresholdVignette` (was BossVignette), `FilmGrain`.
- `src/components/background/supernova/` (was monarch/) — `SupernovaTheme`,
  `SupernovaCorona`, `SupernovaShaft`, `SupernovaVignette`, `SupernovaMotes`.
- Hooks: `useReducedMotion`, `useNow15min`, `useSharedCanvasLoop` (one rAF,
  document.hidden aware).
- App.jsx mounts `ReactiveBackground` once next to the root div. Sidebar
  initially carried a `BG MOTION` toggle here; it later moved to Settings.

### Phase 1 — Inline styles → CSS Modules
- `src/styles.module.css` mirrors the legacy `S` token bag 1:1.
- All **24** components migrated from `style={S.foo}` / `style={{...S.foo,
  ...rest}}` to `className={styles.foo} style={...rest}`.
- Legacy `src/styles.js` deleted.
- Pattern: static styles in CSS Modules, dynamic state-driven values stay
  inline. Pixel-identical pure refactor.

### Phase 2 — Celestial vocabulary + de-identification
- "Boss challenge" / "Boss locked" / "Boss cleared" → "Trial" / "Trial
  locked" / "Trial passed". Strings sourced from `LABELS.trial.*` in
  `theme.config.js`.
- `BossChallenge.jsx` → `TrialPanel.jsx`. Dashboard import updated.
- `RankHero` rank-mark: big serif **celestial name** + small mono letter
  chip (the secondary mark, per the agreed call).
- `notify("Promoted to rank D")` → `notify("Tier up — Spark")`.
- MCP description string updated.
- Glow softened to ~0.55× (`theme.config.glow.panelAuraAlphaMultiplier = 0.55`)
  on heroCard / addBtn / advBtn / nextBtn / toast. Color tokens unchanged.

### Phase 3 — Border token
`--border` swapped from `#1C2E48` (slate-blue) to `rgba(255, 255, 255, 0.06)`
in `index.css`. Recorded as `theme.config.panel.border`. Edges read
consistently across the time-of-day tint AND the Supernova void.

### Phase 4 — Dashboard IA reframe
Two visually separable zones, mobile-first.
- **TODAY** zone: `SlimRankHeader` (compact celestial name + thin gate bar +
  one next-action line + Advance affordance when ready) → `HabitsPanel`
  (moved to the top — first habit checkbox now sits above the 375 px fold).
- Serif **Becoming** divider.
- **BECOMING** zone: `ArcTrajectory` (Phase 12), `IdentityPortrait` (with
  hero-promoted identity statements), `TrialPanel`, full `RankHero`,
  `CatCard` grid.
- The "Your behavior says you're …" line now renders 22–28 px **Instrument
  Serif** italic, sitting first in the portrait panel.

### Phase 5 — RankHero hierarchy
Replaced the seven-equal-stats strip with a clear hierarchy.
- **Row 1**: tier mark + Advance button.
- **Row 2**: bottleneck-first **NEXT** line in italic serif (e.g. "980 XP to
  Flare" / "1 more large signature quest" / "Habit consistency · 2/3 weeks
  ≥ 85%" / "Threshold open — advance"). `resolveBottleneck()` chooses one
  line based on the gate that's blocking.
- **Row 3**: threshold bar.
- **Row 4**: tap-to-reveal **DETAIL** row with GATE XP / NEXT / QUAL /
  TODAY / DONE / STREAK.

### Phase 6 — GoalsView: tabs → single scroll
- Tab row removed entirely.
- Four sections always visible, each preceded by a sticky serif header
  (`Habits` / `Milestones` / `Quit habits` / `Quests`) with a count badge
  and a per-section `+ Add` button.
- Top "+ Add" button defaults to adding a habit (most common path).

### Phase 7 — `/settings` view
- New `SettingsView.jsx` collecting Profile, Background motion, AI Agent,
  Claude Connector, Reset, Sign out.
- Sidebar footer's clickable profile chip routes to `/settings`. Inline
  toggles in the sidebar footer (BG MOTION, AI AGENT, etc.) **removed** —
  settings live in one place now.
- BottomNav gained a 4th `Settings` tab so the route is reachable on mobile
  without opening the nav drawer.

### Phase 8 — Thin-line SVG nav icon set
- `src/components/icons/NavIcons.jsx`: `DashboardIcon`, `GoalsIcon`,
  `ReportsIcon`, `HistoryIcon`, `SettingsIcon`, plus a `BrandMark` diamond
  glyph that replaces the `◈` logo.
- 1.5px stroke, `currentColor`, rounded caps/joins — matches the line-and-
  glow aesthetic.
- Sidebar (expanded + collapsed icon-bar) and BottomNav both consume the set.
- **Untouched** (SACRED): the six category glyphs `♡ ◇ △ ✦ ✿ ○` in
  `constants.js`.

### Phase 9 — FreshArcHero (crafted empty state)
- `FreshArcHero.jsx` — dim 14-star constellation with one lit star, hero
  serif line "Your first step lights the sky.", a quiet "You're walking
  toward {arcGoal}." body, and a "+ Define your first habit" affordance.
- Mounts in Dashboard's Today zone when `state.arc.status === "active"` AND
  there are no habits AND no completions yet.
- Reduced-motion suppresses the lit-star pulse; the typographic moment
  remains.

### Phase 10 — Identity portrait over time
- Completed-level archive docs now include `catScoresAtCompletion`. Written
  by both client (`App.jsx#advanceLevel`) and server
  (`api/mcp.js#toolAdvanceLevel`).
- App.jsx fetches the catScores of the level completed **3 levels back**
  (configurable in `theme.config.radarHistory.levelsBack`) for the current
  arc; passes through Dashboard → IdentityPortrait → RadarChart.
- `RadarChart` overlays a faint dashed polygon for the historical shape
  underneath the current one. Shared axis scale, so growth reads as the
  current shape expanding past the dashed line.
- Legend: `── THEN · Level X    ──── NOW`. New users with no history see
  "Your baseline — return to see how far you've grown."
- **No write-time computation**; the overlay is read directly off stored
  history.

### Phase 11 — Ascension moment
- `AscensionMoment.jsx` — full-viewport editorial overlay fired exactly
  once when `rankAfter.promoted === true` in `App.jsx#advanceLevel`.
- ~3s timed dismiss, skippable on any click/keypress (`Esc`, `Enter`).
- Standard (Spark…Nova): tier-colored radial bloom, celestial name in
  italic serif (clamp 44–88 px), one line of editorial copy (templated
  per tier in `theme.config.ascension.perTierCopy`).
- **Supernova**: crimson-gold treatment, larger name (clamp 56–120 px),
  slightly longer hold, `serifFontStack` from the Supernova theme config.
- Reduced-motion: removes all animation; the typographic moment still
  lands as a static overlay.

### Phase 12 — Arc as a trajectory
- `ArcTrajectory.jsx` — SVG sky-arc inside the Becoming zone.
- Quadratic bezier path from start to goal terminus.
- Past levels: small dim dots evenly distributed along 85% of the arc.
- Current position: tier-colored marker with a drop-shadow glow + serif
  label "Level N · Spark".
- Goal terminus: faint diamond glyph + tiny `GOAL` mono label.
- Quiet serif line below: "Walking toward {arcGoal}. · N levels in".
- Renders only when `state.arc.status === "active"`. Compresses gracefully
  past 12 waypoints.

## Preserved strengths — confirmed intact

- ✓ Locked rank colors `E #64748B / D #22C55E / C #3B82F6 / B #60A5FA /
  A #F59E0B / S #EF4444` in `constants.js` — untouched throughout.
- ✓ Six category glyphs `♡ ◇ △ ✦ ✿ ○` — untouched. NavIcons swap is
  scoped to nav/structural glyphs only.
- ✓ Instrument Serif + JetBrains Mono pairing — still the signature.
- ✓ Rank-mark showpiece — glowing presentation preserved; the primary
  identity moved to the celestial name with the letter as a small chip
  (per the agreed call).
- ✓ Bottom-sheet modal pattern — untouched.
- ✓ `:active { transform: scale(0.97) }` + `--easing-spring` tactility —
  global rules in `index.css`, untouched.

## Franchise vocabulary — confirmed clean

A whole-tree scan for `monarch | sovereign | hunter | dungeon` in
user-facing JSX strings returns **zero matches**. Remaining occurrences are
limited to code comments (rename breadcrumbs like *"Formerly DungeonDepth"*)
and a few generic English uses of "sovereignty" / "locked" in unrelated
contexts. The Firestore field `state.level.boss` is intentionally
**not** migrated — it's existing user data and the spec explicitly opted to
leave it; in code it's only an internal var, never user-visible.

`Boss challenge` strings are all replaced with `Trial`. Internal renames
shipped: `BossChallenge.jsx` → `TrialPanel.jsx`; the `evaluateBoss` function
and `state.level.boss` Firestore field were intentionally left to avoid
risk to live data and tests (consistent with the agreed scope on the
"internal renames" question).

## Deferred (not built — listed for record)

Per the spec, these were not built in this pass:
- Daily Focus mode (swipeable single-habit card stack).
- Streak as a luminous star-thread instead of a number.
- Home/lock-screen widget (rank brightness + next habit).
- Restrained completion sound + haptics (with mute toggle).
- Optional light "day" theme variant.

Additional follow-ups noted during the pass:
- Internal rename of `evaluateBoss → evaluateTrial` and `state.level.boss
  → state.level.trial` (deliberately deferred to avoid risk; flagged here).
- A small `Streak` star-thread could replace the `STREAK Nd` stat in
  `RankHero`'s DETAIL row when the deferred streak-as-star-thread item is
  picked up.

## File inventory (new + materially changed)

**New**
```
src/theme.config.js
src/styles.module.css
src/components/SlimRankHeader.jsx
src/components/TrialPanel.jsx                 (renamed from BossChallenge.jsx)
src/components/SettingsView.jsx
src/components/FreshArcHero.jsx
src/components/AscensionMoment.jsx
src/components/ArcTrajectory.jsx
src/components/icons/NavIcons.jsx
src/components/background/
  ReactiveBackground.jsx, background.css,
  TimeOfDayTint.jsx, Depth.jsx, TierAura.jsx,
  Constellation.jsx, Embers.jsx, ThresholdVignette.jsx, FilmGrain.jsx
  hooks/useReducedMotion.js, useNow15min.js, useSharedCanvasLoop.js
  supernova/SupernovaTheme.jsx, SupernovaCorona.jsx,
            SupernovaShaft.jsx, SupernovaVignette.jsx, SupernovaMotes.jsx
```

**Materially changed**
```
src/App.jsx                 ReactiveBackground mount + bg props,
                            AscensionMoment trigger + render,
                            historicalCatScores fetch,
                            settings route + sidebarProps cleanup
src/index.css               --border swapped to rgba(255,255,255,0.06)
src/components/Sidebar.jsx  SVG nav icons + BrandMark; footer = profile chip
src/components/BottomNav.jsx SVG nav icons; 4th Settings tab
src/components/Dashboard.jsx Two-zone layout, fresh-arc gating, trajectory
src/components/RankHero.jsx  Bottleneck-first hierarchy + DETAIL row
src/components/IdentityPortrait.jsx Hero serif identity line, radar overlay
src/components/RadarChart.jsx Optional compareScores overlay
src/components/GoalsView.jsx Tabs collapsed; sticky section headers
src/components/AddSheet.jsx, SetupWizard.jsx, QuestSheet.jsx,
src/components/RankPanel.jsx, RadarPanel.jsx, etc.   CSS Modules migration
api/mcp.js                  catScoresAtCompletion archive + Trial strings
```

**Removed**
```
src/styles.js               (replaced by styles.module.css)
src/components/BossChallenge.jsx  (replaced by TrialPanel.jsx)
```

## Verification posture
- `npm test` → **64/64 passing** at every phase.
- `npm run build` → **green** at every phase.
- No new failing lint output; no new console warnings introduced.
