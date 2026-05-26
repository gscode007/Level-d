# TODO — scaling and known gaps

Tracked here so they don't get lost in commit messages.

## Done

- [x] **OAuth 2.1 + Dynamic Client Registration for the MCP server.** Implemented in `api/oauth/*` and `src/components/OAuthAuthorize.jsx`. claude.ai's custom-connector UI auto-discovers `/.well-known/oauth-authorization-server`, registers itself via `/api/oauth/register`, sends the user to `/oauth/authorize` for approval, and exchanges the code for an `lvldo_…` access token at `/api/oauth/token`. `api/mcp.js` accepts both `lvld_` (static API keys, for stdio clients) and `lvldo_` (OAuth) bearer tokens.

## Before letting anyone else use this

- [ ] **OAuth refresh tokens.** Access tokens currently live 90 days with no refresh path. claude.ai will silently break when they expire; user has to remove + re-add the connector. Add `grant_type=refresh_token` to `/api/oauth/token` and shorten access-token TTL to ~1h once refresh works.
- [ ] **OAuth scopes.** All tokens currently get full `mcp` scope (read + write everything). Split into `mcp.read` and `mcp.write` so users can mint read-only tokens.
- [ ] **Token revocation endpoint** (`/api/oauth/revoke`, RFC 7009). Right now revoking a connector requires deleting the row from Firestore by hand.

## Other known gaps

- [ ] **AI Agent (`api/agent/generate.js`)** — built but on hold. No rate limiting, no auth, no abuse protection. Currently behind the `aiAgentEnabled` flag in user state, which defaults to off and is only flippable via the sidebar dev toggle. Before turning that toggle on for non-dev users: add auth + rate limit.

- [ ] **Electron build artifacts** — `electron/main.cjs` and `npm run electron:build` still work, but the desktop binary is no longer a shipping surface. Either remove the build script or repurpose Electron as a thin PWA wrapper.

- [ ] **No history of weekly check-ins** — only the latest is stored (`state.lastWeeklyCheckin`). A history panel would help users see identity drift over time.
