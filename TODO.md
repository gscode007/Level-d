# TODO — scaling and known gaps

Tracked here so they don't get lost in commit messages.

## Before letting anyone else use this

- [ ] **MCP server: replace API-key auth with OAuth 2.0 Authorization Code + PKCE.**
  - **What's there now:** `api/mcp.js` validates requests via per-user API keys (`Authorization: Bearer lvld_…`) stored as SHA-256 hashes in Firestore at `apiKeys/{hash}`. Acceptable for personal use (one Anthropic account, one Firestore user, you trust where the key lives).
  - **Why it fails at scale:** every non-technical user would need to manually copy/paste API keys into claude.ai. Keys can't be scoped to specific tools, can't expire automatically, and revocation is all-or-nothing. Anthropic's connector marketplace expects OAuth.
  - **What replaces it:** standard OAuth 2.1 flow — Level-d hosts `/authorize` + `/token` endpoints, returns short-lived access tokens, refresh tokens for renewal, scopes per tool. Then list Level-d in claude.ai's connector directory.
  - **Trigger this when:** more than ~3 users, OR before any public/marketing mention of the connector.

## Other known gaps

- [ ] **AI Agent (`api/agent/generate.js`)** — built but on hold. No rate limiting, no auth, no abuse protection. Currently behind the `aiAgentEnabled` flag in user state, which defaults to off and is only flippable via the sidebar dev toggle. Before turning that toggle on for non-dev users: add auth + rate limit.

- [ ] **Electron build artifacts** — `electron/main.cjs` and `npm run electron:build` still work, but the desktop binary is no longer a shipping surface. Either remove the build script or repurpose Electron as a thin PWA wrapper.

- [ ] **No history of weekly check-ins** — only the latest is stored (`state.lastWeeklyCheckin`). A history panel would help users see identity drift over time.
