/**
 * Vercel serverless function — POST /api/mcp
 *
 * Minimal MCP (Model Context Protocol) JSON-RPC server. Lets claude.ai
 * connect to Level-d as a custom connector and read/write the user's data.
 *
 * Required env vars in Vercel:
 *   FIREBASE_PROJECT_ID     — from Firebase console > Project settings
 *   FIREBASE_CLIENT_EMAIL   — from the service-account JSON
 *   FIREBASE_PRIVATE_KEY    — from the service-account JSON (paste with \n preserved)
 *
 * Auth model:
 *   Authorization: Bearer lvld_<32 chars>
 *   The key's SHA-256 hash is stored in apiKeys/{hash} -> { uid }.
 *
 * See TODO.md for the scaling-time switch to OAuth 2.1.
 */

import crypto from "node:crypto";
import admin from "firebase-admin";

// ── Firebase Admin initialization (once per cold start) ─────────────────────
function db() {
  if (!admin.apps.length) {
    const projectId   = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey    = process.env.FIREBASE_PRIVATE_KEY;
    if (!projectId || !clientEmail || !privateKey) {
      throw new Error("Firebase admin env vars not set (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)");
    }
    // Vercel stores newlines as literal \n in env vars — restore them.
    if (privateKey.includes("\\n")) privateKey = privateKey.replace(/\\n/g, "\n");
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  }
  return admin.firestore();
}

// ── Auth ────────────────────────────────────────────────────────────────────
function sha256(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

// Accepts two token shapes:
//   lvld_…   – static per-user API key (apiKeys collection, for Claude Desktop / custom clients)
//   lvldo_…  – OAuth 2.1 access token issued via /api/oauth/token (oauthAccessTokens collection)
// claude.ai's custom-connector UI only does OAuth, so the lvldo_ path is the
// one that's actually used from the web app.
async function authenticate(req) {
  const auth = req.headers["authorization"] || req.headers["Authorization"];
  if (!auth || !auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  const hash = sha256(token);

  if (token.startsWith("lvld_")) {
    const snap = await db().doc(`apiKeys/${hash}`).get();
    if (!snap.exists) return null;
    const { uid } = snap.data();
    if (!uid) return null;
    db().doc(`apiKeys/${hash}`).update({ lastUsed: admin.firestore.FieldValue.serverTimestamp() }).catch(() => {});
    return uid;
  }

  if (token.startsWith("lvldo_")) {
    const snap = await db().doc(`oauthAccessTokens/${hash}`).get();
    if (!snap.exists) return null;
    const data = snap.data();
    if (!data.uid) return null;
    if (data.expiresAt && data.expiresAt.toMillis() < Date.now()) return null;
    db().doc(`oauthAccessTokens/${hash}`).update({ lastUsed: admin.firestore.FieldValue.serverTimestamp() }).catch(() => {});
    return data.uid;
  }

  return null;
}

// ── Domain helpers (mirror src/utils.js + src/constants.js) ─────────────────
const USER_CATEGORIES   = ["Emotional", "Intellectual", "Physical", "Creational", "Self-Care"];
const HABIT_TEMPLATES   = ["Basic", "Standard", "Intensive", "Precision"];
const DIFFICULTIES      = ["Easy", "Medium", "Hard"];
const FREQUENCIES       = [2, 3, 4, 5, 6, 7];
const WEEKLY_MS         = 7 * 24 * 60 * 60 * 1000;

function genId() {
  return Math.random().toString(36).slice(2, 10);
}
function todayStr() {
  return new Date().toDateString();
}
function getGoalIdentities(g) {
  return g?.identities?.length ? g.identities : [g?.category].filter(Boolean);
}
async function loadUser(uid) {
  const snap = await db().doc(`users/${uid}`).get();
  if (!snap.exists) throw new Error("User has no Level-d data yet — sign in to the app once first.");
  return snap.data();
}
async function saveUser(uid, state) {
  await db().doc(`users/${uid}`).set(state);
}
function currentLevel(state) {
  return (state.levels || []).find(l => l.id === state.currentLevelId) || state.levels?.[0];
}

// ── MCP tool definitions ────────────────────────────────────────────────────
const TOOLS = [
  {
    name: "list_goals",
    description: "Lists the user's current goals (habits, milestones, quit-habits) for the active chapter. Returns name, type, category, identities, completion stats, and streak per goal.",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["all", "habitual", "milestone", "quitHabit"], description: "Filter by goal type. Default: all." },
      },
    },
  },
  {
    name: "get_identity_portrait",
    description: "Returns the user's identity portrait: chapter title, identity statements per dimension, scores, ranks, and the strongest emerging identity.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_weekly_summary",
    description: "Returns this week's votes per identity (habit completions in the last 7 days, distributed across each identity a habit votes for). Useful for weekly reflection.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "add_habit",
    description: "Creates a new daily/weekly habit. The primary category earns XP; secondary identities are visual votes only. Use this for repeatable behaviors that earn XP per completion.",
    inputSchema: {
      type: "object",
      required: ["name", "category", "template", "difficulty", "frequency"],
      properties: {
        name:       { type: "string", description: "Short verb-led name, under 8 words." },
        category:   { type: "string", enum: USER_CATEGORIES, description: "Primary identity dimension that earns the XP." },
        template:   { type: "string", enum: HABIT_TEMPLATES, description: "XP template. Basic=5xp, Standard=10, Intensive=18, Precision=12." },
        difficulty: { type: "string", enum: DIFFICULTIES, description: "Multiplier: Easy=1×, Medium=1.5×, Hard=2×." },
        frequency:  { type: "integer", enum: FREQUENCIES, description: "Times per week. 7=daily." },
        identities: { type: "array", items: { type: "string", enum: USER_CATEGORIES }, description: "Optional: additional identities this habit votes for (visual only, no extra XP)." },
      },
    },
  },
  {
    name: "complete_habit",
    description: "Marks a habit completed for today. Returns the new streak and XP earned. No-ops if already completed today.",
    inputSchema: {
      type: "object",
      required: ["goalId"],
      properties: {
        goalId: { type: "string", description: "The goal's id, as returned by list_goals." },
      },
    },
  },
];

// ── Tool handlers ───────────────────────────────────────────────────────────
async function toolListGoals(uid, args) {
  const state = await loadUser(uid);
  const lv = currentLevel(state);
  if (!lv) return { goals: [] };
  const filter = args?.type || "all";
  const goals = (lv.goals || [])
    .filter(g => filter === "all" || g.type === filter)
    .map(g => ({
      id: g.id,
      name: g.name,
      type: g.type,
      category: g.category,
      identities: getGoalIdentities(g),
      template: g.template,
      difficulty: g.difficulty,
      frequency: g.frequency,
      doneToday: state.lastCompletions?.[g.id] === todayStr(),
      streak: state.streaks?.[g.id] || 0,
      currentStreak: g.currentStreak,
      bestStreak: g.bestStreak,
      milestoneStepsDone: g.milestoneSteps ? g.milestoneSteps.filter(s => s.completed).length : undefined,
      milestoneStepsTotal: g.milestoneSteps?.length,
    }));
  return { chapterTitle: lv.title, count: goals.length, goals };
}

async function toolGetIdentityPortrait(uid) {
  const state = await loadUser(uid);
  const lv = currentLevel(state);
  if (!lv) return { error: "No active chapter." };
  const dims = USER_CATEGORIES.map(cat => ({
    dimension: cat,
    identity: (lv.categoryGoals?.[cat] || "").trim() || null,
    score: state.catScores?.[cat] || 0,
    rank: state.catRanks?.[cat] || "E",
    weight: lv.weights?.[cat] || 0,
  }));
  const strongest = [...dims].sort((a, b) => b.score - a.score)[0];
  return {
    chapterTitle: lv.title,
    levelNumber: lv.num,
    requiredRank: lv.requiredRank,
    dimensions: dims,
    strongestDimension: strongest?.dimension,
    strongestIdentity: strongest?.identity,
  };
}

async function toolGetWeeklySummary(uid) {
  const state = await loadUser(uid);
  const lv = currentLevel(state);
  if (!lv) return { error: "No active chapter." };
  const cutoff = Date.now() - WEEKLY_MS;
  const votes = Object.fromEntries(USER_CATEGORIES.map(c => [c, 0]));
  let totalCompletions = 0;
  for (const g of lv.goals || []) {
    if (g.type !== "habitual") continue;
    const recent = (g.completions || []).filter(ts => ts >= cutoff).length;
    if (!recent) continue;
    totalCompletions += recent;
    for (const id of getGoalIdentities(g)) {
      if (votes[id] !== undefined) votes[id] += recent;
    }
  }
  const breakdown = USER_CATEGORIES.map(cat => ({
    dimension: cat,
    identity: (lv.categoryGoals?.[cat] || "").trim() || null,
    votes: votes[cat],
    tone: votes[cat] <= 0 ? "none" : votes[cat] <= 2 ? "thin" : "alive",
  }));
  return {
    chapterTitle: lv.title,
    daysCovered: 7,
    totalCompletions,
    breakdown,
    lastCheckin: state.lastWeeklyCheckin || null,
  };
}

async function toolAddHabit(uid, args) {
  const state = await loadUser(uid);
  const lv = currentLevel(state);
  if (!lv) throw new Error("No active chapter.");
  if (!args?.name?.trim()) throw new Error("name is required");
  if (!USER_CATEGORIES.includes(args.category)) throw new Error(`category must be one of ${USER_CATEGORIES.join(", ")}`);
  if (!HABIT_TEMPLATES.includes(args.template)) throw new Error(`template must be one of ${HABIT_TEMPLATES.join(", ")}`);
  if (!DIFFICULTIES.includes(args.difficulty)) throw new Error(`difficulty must be one of ${DIFFICULTIES.join(", ")}`);
  if (!FREQUENCIES.includes(Number(args.frequency))) throw new Error(`frequency must be one of ${FREQUENCIES.join(", ")}`);

  const goal = {
    id: genId(),
    name: args.name.trim().slice(0, 80),
    type: "habitual",
    category: args.category,
    template: args.template,
    difficulty: args.difficulty,
    frequency: Number(args.frequency),
    completions: [],
  };
  if (Array.isArray(args.identities) && args.identities.length) {
    const valid = args.identities.filter(i => USER_CATEGORIES.includes(i));
    const all = [goal.category, ...valid.filter(i => i !== goal.category)];
    if (all.length > 1) goal.identities = all;
  }

  const newLevels = state.levels.map(l => l.id === lv.id ? { ...l, goals: [...(l.goals || []), goal] } : l);
  await saveUser(uid, { ...state, levels: newLevels });
  return { ok: true, goal };
}

async function toolCompleteHabit(uid, args) {
  const state = await loadUser(uid);
  const lv = currentLevel(state);
  if (!lv) throw new Error("No active chapter.");
  if (!args?.goalId) throw new Error("goalId is required");
  const goal = (lv.goals || []).find(g => g.id === args.goalId);
  if (!goal) throw new Error(`No goal with id ${args.goalId}`);
  if (goal.type !== "habitual") throw new Error("complete_habit only works on habitual goals — use a different tool for milestones/quit-habits.");

  const t = todayStr();
  if (state.lastCompletions?.[goal.id] === t) {
    return { ok: false, alreadyDoneToday: true, streak: state.streaks?.[goal.id] || 0 };
  }

  // Streak: continues only if completed yesterday
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toDateString();
  const newStreak = state.lastCompletions?.[goal.id] === yStr ? (state.streaks?.[goal.id] || 0) + 1 : 1;

  const ts = Date.now();
  const newLevels = state.levels.map(l => l.id === lv.id
    ? { ...l, goals: l.goals.map(g => g.id === goal.id ? { ...g, completions: [...(g.completions || []), ts] } : g) }
    : l);

  const newState = {
    ...state,
    levels: newLevels,
    lastCompletions: { ...(state.lastCompletions || {}), [goal.id]: t },
    streaks: { ...(state.streaks || {}), [goal.id]: newStreak },
    lastHabitDate: t,
    consecutiveMissed: 0,
  };
  await saveUser(uid, newState);
  return { ok: true, streak: newStreak, completedAt: ts, note: "XP and Resilience updates land when the user next opens the app." };
}

const HANDLERS = {
  list_goals:             toolListGoals,
  get_identity_portrait:  toolGetIdentityPortrait,
  get_weekly_summary:     toolGetWeeklySummary,
  add_habit:              toolAddHabit,
  complete_habit:         toolCompleteHabit,
};

// ── JSON-RPC dispatcher ─────────────────────────────────────────────────────
function rpcResult(id, result) { return { jsonrpc: "2.0", id, result }; }
function rpcError(id, code, message, data) {
  const error = { code, message };
  if (data !== undefined) error.data = data;
  return { jsonrpc: "2.0", id, error };
}

async function handleRpc(msg, uid) {
  const { id, method, params } = msg;

  if (method === "initialize") {
    return rpcResult(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "level-d", version: "0.1.0" },
    });
  }

  // Client-side notification, no response expected
  if (method === "notifications/initialized") return null;

  if (method === "tools/list") {
    return rpcResult(id, { tools: TOOLS });
  }

  if (method === "tools/call") {
    const toolName = params?.name;
    const toolArgs = params?.arguments || {};
    const handler = HANDLERS[toolName];
    if (!handler) return rpcError(id, -32602, `Unknown tool: ${toolName}`);
    try {
      const result = await handler(uid, toolArgs);
      return rpcResult(id, {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      });
    } catch (e) {
      return rpcResult(id, {
        content: [{ type: "text", text: `Error: ${e.message}` }],
        isError: true,
      });
    }
  }

  return rpcError(id, -32601, `Method not found: ${method}`);
}

// ── HTTP handler ────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // CORS — claude.ai's connector validator probes from the browser.
  // Allow GET so the liveness probe doesn't 405 (which the UI reports as
  // "couldn't reach the MCP server"). Allow Mcp-Session-Id for the
  // Streamable HTTP transport even though we don't yet use sessions.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Mcp-Session-Id, MCP-Protocol-Version");
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
  if (req.method === "OPTIONS") return res.status(204).end();

  // GET = liveness/discovery probe. Return server info so the connector UI
  // sees a valid response instead of treating 405 as "unreachable".
  // We don't yet support server-initiated SSE streaming, which is the other
  // legitimate use of GET in the Streamable HTTP transport spec.
  if (req.method === "GET") {
    return res.status(200).json({
      name: "level-d",
      version: "0.1.0",
      protocol: "mcp",
      transport: "streamable-http",
      notice: "This endpoint speaks MCP JSON-RPC. POST a JSON-RPC message with a Bearer lvld_ token in Authorization.",
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let uid;
  try {
    uid = await authenticate(req);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
  if (!uid) {
    return res.status(401).json({ error: "Invalid or missing API key. Get one from the Level-d sidebar → API Keys." });
  }

  const body = req.body;
  if (!body || typeof body !== "object") {
    return res.status(400).json({ error: "Body must be a JSON-RPC message or batch." });
  }

  try {
    // Batch
    if (Array.isArray(body)) {
      const responses = (await Promise.all(body.map(m => handleRpc(m, uid)))).filter(Boolean);
      return res.status(200).json(responses);
    }
    // Single
    const response = await handleRpc(body, uid);
    if (response === null) return res.status(204).end();
    return res.status(200).json(response);
  } catch (e) {
    return res.status(500).json(rpcError(body?.id ?? null, -32603, "Internal error", String(e)));
  }
}
