# Challenges

The feature is implemented locally in `src/challenges`, `api/challenges`, and the
existing app navigation. It reuses Firebase Auth, Firestore and the Firebase
Admin API pattern. Personal quests and XP do not participate in Challenges.
No deployment, real invitation delivery or external account change is performed.

## Agreements and defaults

- Exactly two participants. Creator invites a **verified sign-in email**. Invitations
  last seven days, are single-use, and send no email. Share the generated fragment
  link manually; the invited account also has an inbox. Invite responses contain
  only inviter/expiry, never rules or challenge contents. Acceptance reserves the
  partner slot atomically; accepting a quest agreement is a separate action.
- Creator and partner can propose a complete replacement agreement. Submission
  counts as proposer approval. Only the other participant can accept or reject.
  One pending/scheduled agreement at a time avoids ambiguous overlapping changes.
- Initial rules activate immediately on acceptance. Later changes activate the
  following Monday, including acceptance on Monday. Historical versions remain
  immutable. New challenges start flexible weekly quotas on the next Monday,
  including activation partway through a Monday, to allow a full seven-day week.
- The agreed IANA timezone is immutable for that challenge. Personal timezone or
  device changes do not move its boundaries. A different agreed timezone requires
  a new challenge; existing history remains intact.
- Daily/selected-weekday obligations close at local midnight. Weekly quotas close
  at Sunday midnight. Server time, never a submitted client timestamp, chooses the
  completion date. Records are append-only even while their period is open.
- At most one completion per quest/person/date, including surge. Extra effort is
  a self-reported flag against the agreed written threshold. Timer/check-in proof
  is self-reported; no partner verification is added. Photos are PNG/JPEG/WebP,
  up to 160 KB, and stored in separate private Firestore documents. No Firebase
  Storage bucket or public download URLs are used.
- Daily misses remain visible individually but aggregate to one missed day per
  participant/date. Weekly shortfalls remain separate and are summed by quest.
  Surge days require every due daily/weekday quest complete and at least one
  extra-effort completion. Weekly quest surges count distinct dates independently.
- One commitment per missed day/weekly shortfall; at most one reward per person/week.
  Each person can report their own fulfillment/claim. History retains settled items,
  completion proof, rule versions, rejected proposals and closed accounting periods.

## Required setup before live use

1. Configure **the existing Firebase project** on the trusted API server:
   `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (or
   `GOOGLE_APPLICATION_CREDENTIALS` for local development). Match the project used
   by the existing `VITE_FIREBASE_*` client configuration. The service account needs
   Firestore access and Firebase Auth token verification/revocation access.
   These secrets must never have a `VITE_` prefix. Current local `.env` contains
   client settings only; live server configuration was not inspected or changed.
2. Review and apply `firestore.rules` to that same project **before enabling this
   API**. These rules preserve the inspected client paths (`users`, `levels`, `arcs`,
   `completions`, `xpAudit`) and make all challenge/invite/job paths server-only.
   The repository previously contained no deployed rules snapshot; compare with
   the live rules and retain any additional existing personal-data restrictions.
   A broad permissive wildcard elsewhere can override these denies: Firestore
   combines matching allows with OR. Rules must be tested as a whole.
3. Set a strong random `CRON_SECRET` in the API environment. `vercel.json` includes
   a daily UTC job for `/api/challenges/reconcile`. Deployment must enable that job;
   another trusted scheduler can call the same GET endpoint with
   `Authorization: Bearer <CRON_SECRET>`. No scheduler has been provisioned here.
   Closed writes are rejected immediately by date boundaries. The daily job
   materializes closed ledgers even if neither user opens the app, typically
   within 24 hours. Reads also reconcile immediately. Scheduler delivery may lag;
   deterministic IDs and durable per-challenge/scan cursors make retries safe.
   Monitor job failures. Very large backlogs process 35 dates per challenge per
   invocation; dashboard refresh or subsequent scheduled scans continue them.
4. Deploy the existing app and API together when authorized. The Vercel CLI was
   absent at task start; `npm i -g vercel` enables `vercel env pull`, deployment
   inspection and logs. Deployment was explicitly outside this task's authorization.

Firebase Admin bypasses client rules, so every API action independently checks
membership, verified invitation identity, assignment and own-record authority.
References: [Firebase server/client security](https://firebase.google.com/docs/firestore/security/overview),
[Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions),
[Vercel cron management](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

## Local development and verification

- `npm run dev:challenges` serves Vite and the real authenticated Challenges API
  on `http://localhost:5173`. It loads the server settings above from `.env` without
  exposing them to client code. Missing credentials produce an actionable error.
  Normal `npm run dev`/`npm run preview` are frontend-only, as before.
- `npm test` runs existing checks plus pure domain, trusted-service and API tests.
  The deterministic test adapter serializes transactions and enforces reads before
  writes. It is test-only, never a production fallback.
- `npm run build` builds the app, PWA and widget.
- Install Firebase CLI and Playwright as local test tools, with Java 21+ and Chrome,
  then run `npm run test:challenges:e2e`. `PLAYWRIGHT_MODULE` may point to an existing
  Playwright installation; `CHALLENGE_BROWSER_CHANNEL` defaults to `chrome`.
  `firebase.challenges.json` isolates this verification to
  **demo-leveld-challenges**, the Auth emulator (29099) and Firestore emulator (28080).
  The browser fixture uses real emulator sign-in and the production API handler.
  It tests the two-account flows, proof types, closure, settlement, reload,
  rejection, history, mobile overflow, direct client security rules, and the full
  desktop/mobile app navigation. It checks that existing personal quests and XP
  remain unchanged. Screenshots
  go to ignored `test-results/challenges`. The fixtures are not production entries.

No live two-account or deployed scheduler verification is implied by local tests.

## Production deployment — October 13, 2026

Deployed to the existing `life-rpg` production project at
https://life-rpg-gold.vercel.app (deployment `dpl_HYWB1dxozo7pv4r19mzhE6BoCYnD`).
The production Firebase Admin variables were already configured. Added the missing
production `CRON_SECRET` as a secret; the daily reconciliation job is included in
the deployed Vercel configuration. The existing Firestore rules for the deployed
client's `progress-analysis` project deny challenge/invitation/job collections by
default. Those live rules were inspected and preserved; no Firebase rules or
participant accounts were changed.

Production build and 116 tests passed. Live HTTP checks verified app/bundle delivery,
401 responses for missing/invalid Challenges tokens, and 401 for an unauthenticated
cron request. Real participant sign-in and a scheduled cron execution have not yet
been exercised. The full two-account flow remains verified against local emulators.

The API Admin helper is in `src/server/firebaseAdmin.js` because `.vercelignore`
excludes maintenance scripts. Test tooling, screenshots and debug logs are also
excluded from deployment uploads.

## Verification performed

- `npm test`: **116 passed**, no failures or skips, including the existing
  check-in/widget and gamification tests plus Challenges domain/access/API tests.
- `npm run build`: **passed** for the website, PWA and Electron widget assets.
  Existing nonblocking Firebase chunk-size and stale Browserslist warnings remain.
- Firebase Auth/Firestore emulator + Chrome/Playwright test: **passed**. Real
  Firestore transactions were tested with concurrent invitation redemption,
  eight same-day completion requests, repeated finalization and retained settlement.
  Client SDK reads/writes were denied for participants, nonparticipants and
  anonymous callers across challenge data, photo proof, invitation and job state.
- Browser verification: **passed** with separate Alice/Bob sessions, including
  invitation navigation in an already-open tab, mutual approval, check-in/photo/
  timer proof, day/week closure, punishment fulfillment, reward claiming, reload,
  rejection, history and no horizontal overflow on mobile. Both accounts also
  opened Challenges through the full existing app navigation. Personal quest
  status, existing fields and XP remained intact. Desktop/mobile screenshots were
  inspected under `test-results/challenges/app-alice.png` and `app-bob.png`.
- `git diff --check`: **passed**. Existing uncommitted check-in/widget work was
  preserved. Temporary downloaded test tools and generated artifacts are ignored.

The emulator CLI on this Windows environment left its Java process after shutdown;
only processes matching this repository's emulator binary and the demo project
were stopped after verification. No live account or deployment was touched.
