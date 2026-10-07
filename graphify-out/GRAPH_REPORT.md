# Graph Report - Level-d  (2026-10-06)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 744 nodes · 1900 edges · 24 communities (20 shown, 4 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 49 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2504ea57`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21

## God Nodes (most connected - your core abstractions)
1. `App()` - 70 edges
2. `react` - 39 edges
3. `calcBaseXP()` - 22 edges
4. `tzToday()` - 21 edges
5. `useIsMobile()` - 19 edges
6. `GoalsView()` - 19 edges
7. `getGamificationConfig()` - 19 edges
8. `CAT_META` - 19 edges
9. `completeHabit()` - 18 edges
10. `THEME_CONFIG` - 17 edges

## Surprising Connections (you probably didn't know these)
- `advanceLevel()` --indirect_call--> `currentLevel()`  [INFERRED]
  src/App.jsx → api/mcp.js
- `deleteGoal()` --indirect_call--> `currentLevel()`  [INFERRED]
  src/App.jsx → api/mcp.js
- `deleteQuest()` --indirect_call--> `currentLevel()`  [INFERRED]
  src/App.jsx → api/mcp.js
- `editGoal()` --indirect_call--> `currentLevel()`  [INFERRED]
  src/App.jsx → api/mcp.js
- `complete()` --calls--> `tzToday()`  [EXTRACTED]
  tests/checkin/fixture.jsx → src/gamification/time.js

## Import Cycles
- None detected.

## Communities (24 total, 4 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (62): react, ANCHOR_LABELS, ANCHOR_PLACEHOLDERS, EMPTY_ANCHOR, ArcTrajectory(), CatCard(), perfColor(), CategoryModal() (+54 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (53): firebase, react-dom, @sentry/browser, @vercel/analytics, App(), addGoal(), addGoals(), addQuest() (+45 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (42): toolCompleteHabit(), toolListGoals(), resistQuitHabit(), succumbQuitHabit(), prepareDashboardWrite(), applyCheckinCommand(), now, schedule (+34 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (46): AscensionMoment(), Constellation(), generateStars(), mulberry32(), paintScene(), Depth(), Embers(), makeParticle() (+38 more)

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (55): ALL_CATEGORIES, arcDocPath(), authenticate(), canEditStructural(), currentLevel(), db(), DIFFICULTIES, evaluateGatesForCurrent() (+47 more)

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (41): AddSheet(), handleSubmit(), packAnchor(), packExtras(), packIdentities(), packSurge(), AgentSuggestModal(), toggle() (+33 more)

### Community 6 - "Community 6"
Cohesion: 0.12
Nodes (35): completeHabit(), HabitsPanel(), handleComplete(), DAILY_XP_CAP, evaluateBoss(), weekCompletionRate(), DEFAULT_GAMIFICATION_CONFIG, getGamificationConfig() (+27 more)

### Community 7 - "Community 7"
Cohesion: 0.09
Nodes (23): { app, BrowserWindow, Menu, Tray, ipcMain, powerMonitor, screen, dialog }, path, createWidget(), openSettings(), { popupBounds }, resizeWidget(), { serveWidget }, showWidget() (+15 more)

### Community 8 - "Community 8"
Cohesion: 0.11
Nodes (31): AddSheet(), App(), addGoal(), advanceLevel(), completeHabitual(), completeMilestoneStep(), CAT_META, CatCard() (+23 more)

### Community 9 - "Community 9"
Cohesion: 0.12
Nodes (27): BadgeCard(), EmptyHint(), navArrow, pctLabel(), PERIODS, ReportsView(), StatCard(), completionsForWeek() (+19 more)

### Community 10 - "Community 10"
Cohesion: 0.08
Nodes (16): { app, BrowserWindow, shell, Menu }, path, { contextBridge, ipcRenderer }, electron, buf, __dirname, png, root (+8 more)

### Community 11 - "Community 11"
Cohesion: 0.14
Nodes (15): initAdmin(), inspectDoc(), main(), main(), parseMode(), estimateDocBytes(), FIRESTORE_DOC_LIMIT_BYTES, isOverDocWarnThreshold() (+7 more)

### Community 12 - "Community 12"
Cohesion: 0.14
Nodes (21): authenticateUser(), db(), generateKey(), handler(), initAdmin(), listKeys(), newKey(), revokeKey() (+13 more)

### Community 13 - "Community 13"
Cohesion: 0.20
Nodes (10): main, name, private, type, version, cross-env, electron-builder, vite (+2 more)

### Community 14 - "Community 14"
Cohesion: 0.32
Nodes (9): ApiKeysModal(), handleGenerate(), handleRevoke(), refresh(), call(), fmtDate(), Row(), Section() (+1 more)

### Community 15 - "Community 15"
Cohesion: 0.18
Nodes (11): build, appId, asar, directories, files, productName, win, output (+3 more)

### Community 16 - "Community 16"
Cohesion: 0.20
Nodes (10): dependencies, firebase, firebase-admin, react, react-dom, @sentry/browser, @sentry/node, @upstash/ratelimit (+2 more)

### Community 17 - "Community 17"
Cohesion: 0.20
Nodes (10): scripts, build, dev, electron:build, electron:dev, electron:ico, preview, test (+2 more)

### Community 18 - "Community 18"
Cohesion: 0.28
Nodes (8): DIFFICULTIES, FREQUENCIES, HABIT_TEMPLATES, handler(), MILESTONE_TEMPLATES, parseClaudeJson(), sanitize(), USER_CATEGORIES

### Community 19 - "Community 19"
Cohesion: 0.29
Nodes (7): devDependencies, cross-env, electron, electron-builder, vite, vite-plugin-pwa, @vitejs/plugin-react

## Knowledge Gaps
- **125 isolated node(s):** `ANCHOR_LABELS`, `ANCHOR_PLACEHOLDERS`, `EMPTY_ANCHOR`, `BANDS`, `bossLockStyle` (+120 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 187 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Community 0` to `Community 1`, `Community 2`, `Community 3`, `Community 5`, `Community 6`, `Community 8`, `Community 9`, `Community 13`, `Community 14`?**
  _High betweenness centrality (0.297) - this node is a cross-community bridge._
- **Why does `electron` connect `Community 10` to `Community 13`, `Community 7`?**
  _High betweenness centrality (0.117) - this node is a cross-community bridge._
- **Why does `firebase-admin` connect `Community 12` to `Community 11`, `Community 4`, `Community 13`?**
  _High betweenness centrality (0.086) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `App()` (e.g. with `handleSignOut()` and `readCollapsed()`) actually correct?**
  _`App()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `ANCHOR_LABELS`, `ANCHOR_PLACEHOLDERS`, `EMPTY_ANCHOR` to the rest of the system?**
  _125 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06609195402298851 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.05185185185185185 - nodes in this community are weakly interconnected._