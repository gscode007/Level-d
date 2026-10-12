# Independent Level’d widget

The desktop entry point runs a separate, frameless, always-on-top habit widget.
It does not load App.jsx, show the dashboard, launch a browser, or require Vite.
Between check-ins its window is hidden. When due, a fixed popup appears centered
on the monitor containing the pointer, matching that monitor’s aspect ratio at
about 72% of the available size. It cannot be moved, resized, minimized, or closed.
Completing, continuing with the saved schedule, or rescheduling hides it again. No dashboard is opened.

## Run and install

1. Run `npm run build` to build both website and widget entries.
2. Run `npm run widget:start` for a manual launch, or `npm run widget:install`
   to register and start the per-user Windows task `Leveld Check-in Widget`.
3. Sign in once inside the widget using the same Google account as Level’d.

The task starts at Windows login, runs on battery, and can restart after a crash.
It is launched by Windows, independently of Codex, the dashboard, or a terminal.
It uses the Electron runtime installed in this repository; keep this folder in
place. No elevated Windows account or Firebase service-account credential is used.

The widget serves only its bundled page and static assets over localhost:5174.
The stable origin preserves existing sign-in and reminder preferences from the
previous local desktop version. Stop the earlier Vite/desktop process before
starting it. Google sign-in requires localhost in Firebase authorized domains.
`npm run electron:dev` remains available for development, using Vite explicitly.

To remove automatic startup, stop and unregister only `Leveld Check-in Widget`
in Windows Task Scheduler. Use its tray menu to quit between check-ins.

## Strict behavior

Check-ins default to every two hours between 09:00 and 22:00, in device time.
Use **Check-in settings** from the tray icon to change timing or open **Check in now**.
Settings and first-time sign-in can be hidden with **Done**; active check-ins
offer completion, continuing with the saved schedule, or an optional custom time.
An active check-in has three resolution paths:

1. Record all remaining habitual goals.
2. **Continue with schedule**: leave unfinished quests pending and schedule the
   next check-in using the saved interval and reminder hours. This clears any
   earlier custom-time override and resets its reschedule count.
3. Optionally choose another check-in time: 15/30/60 minutes, or a custom time between one
   minute and 24 hours ahead. Explicit times override the normal reminder window.

There is no skip, missed-today, Escape dismissal, or backdrop dismissal.
Close/minimize and tray Quit cannot dismiss an active check-in. OS shutdown and
force termination remain possible. Global settings are accessible between
check-ins, never as an alternative dismissal for an active one.

Partial completions are saved before the remaining habits are postponed. Weekly
targets that have been met are excluded. Milestones and quit-habits keep their
existing dashboard flows. Current-day completions are recorded; the widget does
not invent or backdate yesterday’s activity.

## Data and synchronization

The widget signs into Firebase directly and subscribes to the current user’s
progress. It uses a transaction to check today’s completion against fresh state,
apply the shared XP/streak/cap rules, and increment widgetRevision. Duplicate
completion attempts do not award XP twice. Completion writes require a network
connection; on failure the habit remains unresolved, with an explicit error and
reschedule controls. Timing and active check-ins persist locally per account.

The updated website listens for widget revisions and refreshes when they change.
An older in-flight dashboard save is rejected instead of overwriting a widget
completion. Dashboard offline changes are kept in a local pending record and
retried on reconnect; if a widget updated the same account in the meantime, the
user is told to retry the unsynced dashboard change against refreshed progress.

The updated website was deployed to https://life-rpg-gold.vercel.app on
2026-09-27 with live synchronization and conflict protection. Reload any dashboard
tabs opened before deployment to load the revision guard. The widget itself
requires no website deployment.

## Verification

The widget includes an Add side quest form in both its settings view and the
active check-in. It supports identity dimensions, reward bands, signature quests,
and current chapter linking. New quests are saved transactionally to the existing
account quest list with a widget revision, so open dashboards refresh safely.
Adding a quest does not award XP or dismiss an active check-in. Failed saves retain
the draft; reconnect and retry to save it.

Active side quests for the current chapter and unlinked side quests also appear
in the check-in checklist, including quests added while the popup is open. They
show their flat XP reward and can be marked complete in the widget. Completion
updates XP and rank transactionally and only once, marks XP as awarded to avoid
dashboard reconciliation awarding it again, and refreshes open dashboards through
the widget revision. Side quests count as remaining check-in items, even after
all daily or weekly quests have been recorded; choose a later time if unfinished.

Website Settings → Desktop check-ins controls frequency, active hours, enabled
state, and an explicit next check-in time. Commands sync through the account to
the desktop widget, which acknowledges them after saving locally. Pending changes
are shown as waiting; expired times are rejected without dismissing a check-in.
The website shows the last widget sync and its reported next check-in. Settings
changes cannot dismiss an active check-in; choosing a valid later time can.
The desktop widget must be connected to the same account and online to apply
website changes. Existing local scheduling continues when it is offline.

- `npm test`: scheduling, XP, idempotency, transaction revisions, and stale-save
  protection, alongside the existing domain tests.
- `npm run build`: both production entries and the website service worker.
- `tests/checkin/browser-test.mjs`: modal and native window checks with the local
  Vite fixture. Set CHECKIN_TEST_DESKTOP=1 for native checks.
- `tests/checkin/standalone-test.mjs`: launches built assets without Vite using an
  isolated profile and temporary local port. Checks first-run sign-in, hidden idle mode and
  centered settings, one window only, and rejection of dashboard/source requests.

Browser tests need Playwright. PLAYWRIGHT_MODULE can point to an existing bundled
module, and CHECKIN_BROWSER_CHANNEL=msedge uses the installed Edge browser. Tests
never access your real account. `npm run electron:build` packages the built widget
assets into the portable Windows executable.
