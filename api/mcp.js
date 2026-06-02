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
import { getGamificationConfig } from "../src/gamification.config.js";
import { resolveTimeZone, tzToday } from "../src/gamification/time.js";
import { completeHabitTransactional, completeQuestTransactional } from "../src/server/completions.js";
import { initSentry, captureError } from "../src/server/sentry.js";
import { checkCompletionRateLimit } from "../src/server/ratelimit.js";
import { applyQualifyingLevel, levelsToNextRank, rankRequirements } from "../src/gamification/rank.js";
import { evaluateGates, progressionSummary } from "../src/gamification/progression.js";

const RATE_LIMITED_TOOLS = new Set(["complete_habit", "complete_quest"]);

initSentry(); // no-op unless SENTRY_DSN is set

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
const USER_CATEGORIES     = ["Emotional", "Intellectual", "Physical", "Creational", "Self-Care"];
const ALL_CATEGORIES      = [...USER_CATEGORIES, "Resilience"];
const HABIT_TEMPLATES     = ["Basic", "Standard", "Intensive", "Precision"];
const MILESTONE_TEMPLATES = ["Completion", "Consistency", "Performance", "Control", "Transformation"];
const DIFFICULTIES        = ["Easy", "Medium", "Hard"];
const FREQUENCIES         = [2, 3, 4, 5, 6, 7];
const QUEST_BANDS         = ["small", "medium", "large"];
const QUEST_STATUSES      = ["active", "completed"];
const RANKS               = ["E", "D", "C", "B", "A", "S"];
const WEEKLY_MS           = 7 * 24 * 60 * 60 * 1000;
const EDIT_WINDOW_MS      = 3 * 24 * 60 * 60 * 1000; // mirrors INITIAL_EDIT_WINDOW_MS

function genId() {
  return Math.random().toString(36).slice(2, 10);
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

// ── Arc / progression helpers ───────────────────────────────────────────────
// An arc is "active" when the user has called start_arc and not yet
// complete_arc'd. While inactive, advance_level falls back to its legacy
// single-gate behavior so existing users see no change.
function isArcActive(state) {
  return state?.arc?.status === "active";
}

// Per-arc subcollection paths. Each arc is its own doc so we can hold per-arc
// history (a future feature like "review past arcs") without growing the root
// user doc — same pattern as the Layer-2 xpAudit subcollection.
function arcDocPath(uid, arcId)   { return `users/${uid}/arcs/${arcId}`; }
function levelsCollPath(uid)      { return `users/${uid}/levels`; }
function levelDocPath(uid, lvlId) { return `users/${uid}/levels/${lvlId}`; }

// Reads xpAudit since `sinceTs` and returns { totalCompletions, surgeCompletions }.
// Only used for the S-rank `surgePct` signature sub-check; other ranks don't
// touch this query. A completion is "surge" iff its persisted breakdown shows
// surgeMultiplier > 1 (the only persisted signal — see src/server/audit.js).
async function loadSurgeStatsSince(uid, sinceTs) {
  if (!sinceTs) return { totalCompletions: 0, surgeCompletions: 0 };
  const snap = await db()
    .collection(`users/${uid}/xpAudit`)
    .where("kind", "==", "habit_completion")
    .where("ts", ">=", sinceTs)
    .get();
  let total = 0, surge = 0;
  snap.forEach(d => {
    total++;
    const mult = d.get("breakdown")?.surgeMultiplier;
    if (typeof mult === "number" && mult > 1) surge++;
  });
  return { totalCompletions: total, surgeCompletions: surge };
}

// Convenience: evaluate gates for the current level, fetching surge stats lazily
// only when the current rank needs them (S today, plus any future rank that
// references surgePct).
async function evaluateGatesForCurrent(uid, state, lv, cfg) {
  const rank = state?.rank?.current || "E";
  const needsSurge = rankRefsSurgePct(rankRequirements(rank, cfg)?.signature);
  const extras = {};
  if (needsSurge) {
    extras.surgeStats = await loadSurgeStatsSince(uid, lv?.startedAt || 0);
  }
  return evaluateGates(state, lv, rank, cfg, extras);
}

function rankRefsSurgePct(sig) {
  if (!sig) return false;
  if (sig.kind === "surgePct") return true;
  if (sig.kind === "composite") return (sig.requirements || []).some(rankRefsSurgePct);
  return false;
}

// Decorate a level with arc metadata. Pure — does not mutate.
function stampLevelForArc(level, { arcId, rank, sequenceInRank, sequenceInArc }) {
  return {
    ...level,
    arcId,
    rank,
    sequenceInRank,
    sequenceInArc,
    displayName: `Level ${sequenceInArc}`,
    title: `Level ${sequenceInArc}`, // system-set, not user-customizable under arc mode
  };
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
    description: "Returns the user's identity portrait: chapter title, identity statements per dimension, scores, ranks, and the strongest emerging identity. When an arc is active, also includes a `progression` block with the arc goal, current rank + qualifying-levels-toward-next-rank, the level's display name (e.g. 'Level 4'), and the dual-gate evaluation (XP gate current/required/met + boss gate completion-rate/signature/met + canAdvance).",
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
    name: "add_milestone",
    description: "Creates a milestone — a one-time objective broken into steps (e.g. 'Finish the course' → step per module). The category earns the XP, split across the steps. Use this for big goals with discrete progress, not repeatable habits.",
    inputSchema: {
      type: "object",
      required: ["name", "category", "template", "difficulty", "steps"],
      properties: {
        name:       { type: "string", description: "Short objective, under ~8 words." },
        category:   { type: "string", enum: USER_CATEGORIES, description: "Identity dimension that earns the XP." },
        template:   { type: "string", enum: MILESTONE_TEMPLATES, description: "Total-XP template. Completion=30, Consistency=40, Performance=60, Control=70, Transformation=120 (before difficulty/category modifiers). XP is split evenly across the steps." },
        difficulty: { type: "string", enum: DIFFICULTIES, description: "Multiplier: Easy=1×, Medium=1.5×, Hard=2×." },
        steps:      { type: "array", items: { type: "string" }, minItems: 1, maxItems: 8, description: "1–8 step names, in order. Each starts incomplete." },
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
  {
    name: "update_chapter",
    description: "Patches the current chapter's setup (title, identity statements, weights, required rank). Partial updates allowed — pass only the fields you want to change. Use markSetupComplete=true to also dismiss the SetupWizard (useful when filling in setup for a brand new user). The Level-d browser tab does not auto-refresh; the user must reload to see changes. NOTE: when an arc is active, the `title` field is rejected — levels are system-named 'Level N'. Identity statements, weights, and requiredRank stay editable.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Chapter name (e.g. 'Building the Foundation')." },
        categoryGoals: {
          type: "object",
          description: "Identity statement per dimension. Partial OK — only listed dimensions are updated. Keys must be from USER_CATEGORIES.",
          additionalProperties: { type: "string" },
        },
        weights: {
          type: "object",
          description: "Weight % per dimension. If provided, MUST include all 5 USER_CATEGORIES and the integers MUST sum to exactly 100. Resilience is always 0.",
          additionalProperties: { type: "integer", minimum: 0, maximum: 100 },
        },
        requiredRank: { type: "string", enum: RANKS, description: "Rank to reach to complete this chapter." },
        markSetupComplete: { type: "boolean", description: "Set setupDone=true after patching. Use this when finishing initial setup so the user doesn't see the wizard again." },
      },
    },
  },
  {
    name: "advance_level",
    description: "Creates the next level. WITHOUT an active arc (legacy path) it simply creates a new chapter and resets per-chapter scores/streaks/completions. WITH an active arc it first evaluates the dual-gate (XP + boss) against the user's current rank; if either gate fails it returns {ok:false, canAdvance:false, gates:{...}} WITHOUT advancing and WITHOUT throwing — call get_identity_portrait to see exactly what's missing. On gate pass: writes the completed level to users/{uid}/levels, may promote the rank (E→D→C→B→A→S; never drops; S is the ceiling), creates the next level with the system-set name 'Level N', and resets per-chapter scores. Under an active arc, the `title` arg is ignored (levels are system-named). categoryGoals/weights are still respected.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Chapter name for the new level. IGNORED when an arc is active — levels are system-named 'Level N'." },
        categoryGoals: {
          type: "object",
          description: "Identity statement per USER_CATEGORY dimension.",
          additionalProperties: { type: "string" },
        },
        weights: {
          type: "object",
          description: "Weight % per dimension. If provided, MUST include all 5 USER_CATEGORIES and sum to 100.",
          additionalProperties: { type: "integer", minimum: 0, maximum: 100 },
        },
        requiredRank: { type: "string", enum: RANKS, description: "Legacy single-gate threshold. Vestigial when an arc is active (the arc's rank-driven dual-gate governs advancement)." },
      },
    },
  },
  {
    name: "start_arc",
    description: "Starts a new arc — the top-level master goal that frames a multi-year journey. Only ONE arc can be active at a time; calling this while an arc is active returns an error. On start: the user's current chapter is relabeled 'Level 1' and stamped as the first level of the new arc (existing XP/habits/quests are preserved), and the user's progression rank is initialized to E. From then on, advance_level enforces a rank-driven dual-gate (XP threshold × rank multiplier, plus a trailing-window habit completion rate and a rank-specific signature requirement). Rank climbs E → D → C → B → A → S and never drops. S is the ceiling; arc completion is user-declared via complete_arc.",
    inputSchema: {
      type: "object",
      required: ["goal"],
      properties: {
        goal: { type: "string", description: "The master goal that defines this arc (3–8 year aspiration). Short and concrete." },
      },
    },
  },
  {
    name: "complete_arc",
    description: "Declares the active arc complete. Only valid when the user is at rank S AND has cleared the configured number of consecutive qualifying S-rank levels (3 by default). Requires confirm=true so the call is intentional. Marks the arc complete and stamps completedAt; does NOT auto-start a new arc.",
    inputSchema: {
      type: "object",
      required: ["confirm"],
      properties: {
        confirm: { type: "boolean", description: "Must be literally true to proceed. Guards against accidental completion." },
      },
    },
  },
  {
    name: "update_goal",
    description: "Edits an existing goal (habit, milestone, or quit-habit). Use list_goals first to get the goalId. Partial updates allowed. Structural fields (name, template, difficulty, frequency, identities, category, milestoneSteps) may be locked outside the first 3 days of a level for goals that were created during initial setup — anchor/notes/ifThenFallback are always editable. Tool returns an error listing any locked fields rather than silently dropping them.",
    inputSchema: {
      type: "object",
      required: ["goalId"],
      properties: {
        goalId:     { type: "string", description: "The goal's id (from list_goals)." },
        name:       { type: "string", description: "Short verb-led name, under 8 words." },
        category:   { type: "string", enum: USER_CATEGORIES, description: "Primary dimension. Not editable for quitHabit (always Resilience)." },
        template:   { type: "string", description: "For habitual/quitHabit: one of HABIT_TEMPLATES (Basic/Standard/Intensive/Precision). For milestone: one of MILESTONE_TEMPLATES (Completion/Consistency/Performance/Control/Transformation)." },
        difficulty: { type: "string", enum: DIFFICULTIES },
        frequency:  { type: "integer", enum: FREQUENCIES, description: "Times per week. Only valid for habitual / quitHabit." },
        identities: { type: "array", items: { type: "string", enum: USER_CATEGORIES }, description: "Habitual only: list of identities this habit votes for (full list including primary; null/empty clears multi-identity)." },
        milestoneSteps: {
          type: "array",
          description: "Milestone only: replace the full step list. Each step is { name, completed? }.",
          items: {
            type: "object",
            required: ["name"],
            properties: {
              name: { type: "string" },
              completed: { type: "boolean", description: "Default false. Set true to mark done." },
            },
          },
        },
        anchor: {
          type: "object",
          description: "Implementation-intention anchor (cue/location/action/prep). Patches partially — fields you omit keep their existing value. Always editable.",
          properties: {
            cue:      { type: "string", description: "Trigger ('after morning coffee')." },
            location: { type: "string", description: "Where the action happens." },
            action:   { type: "string", description: "Concrete action ('5-min brain dump in gray notebook')." },
            prep:     { type: "string", description: "Optional prep step." },
          },
        },
        notes:          { type: "string", description: "Free-text notes. Pass empty string to clear. Always editable." },
        ifThenFallback: { type: "string", description: "Coping intention for failure case ('If I miss morning coffee, then I will...'). Always editable." },
      },
    },
  },
  {
    name: "list_quests",
    description: "Lists the user's quests — one-off side objectives, separate from recurring habits. Returns title, identity dimension, XP reward, status, signature flag, and chapter link per quest.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["all", "active", "completed"], description: "Filter by status. Default: all." },
      },
    },
  },
  {
    name: "add_quest",
    description: "Creates a one-off quest (completable once), separate from recurring habits. XP is a flat reward from a band: small / medium / large. Mark signature=true for quests that define what advancement looks like (these count toward this level's trial). Links to the current level by default.",
    inputSchema: {
      type: "object",
      required: ["title", "dimension"],
      properties: {
        title:     { type: "string", description: "Short objective, under ~12 words." },
        dimension: { type: "string", enum: USER_CATEGORIES, description: "Identity dimension that earns the XP." },
        band:      { type: "string", enum: QUEST_BANDS, description: "XP band: small / medium / large. Default: medium." },
        signature: { type: "boolean", description: "Mark as a signature quest for the current chapter. Default false." },
        chapterLinked: { type: "boolean", description: "Link to the current chapter (default true). Pass false for a standalone quest." },
      },
    },
  },
  {
    name: "complete_quest",
    description: "Marks a quest completed. Returns the quest and its XP reward. No-ops if already completed. The XP lands in the user's scores when they next open the app (mirrors complete_habit).",
    inputSchema: {
      type: "object",
      required: ["questId"],
      properties: {
        questId: { type: "string", description: "The quest's id, as returned by list_quests / add_quest." },
      },
    },
  },
];

// ── Tool handlers ───────────────────────────────────────────────────────────
async function toolListGoals(uid, args) {
  const state = await loadUser(uid);
  const lv = currentLevel(state);
  if (!lv) return { goals: [] };
  const today = tzToday(resolveTimeZone(state)); // user's timezone, matches the client
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
      surge: g.surge ? { target: g.surge.target, multiplier: g.surge.multiplier } : undefined,
      doneToday: state.lastCompletions?.[g.id] === today,
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
  const base = {
    chapterTitle: lv.title,
    levelNumber: lv.num,
    requiredRank: lv.requiredRank,
    dimensions: dims,
    strongestDimension: strongest?.dimension,
    strongestIdentity: strongest?.identity,
  };
  // When an arc is active, also expose the progression block (additive — the
  // legacy fields above remain so existing connectors don't break).
  if (isArcActive(state)) {
    const cfg = getGamificationConfig(state);
    const extras = {};
    const rank = state?.rank?.current || "E";
    if (rankRefsSurgePct(rankRequirements(rank, cfg)?.signature)) {
      extras.surgeStats = await loadSurgeStatsSince(uid, lv.startedAt || 0);
    }
    base.progression = progressionSummary(state, lv, cfg, extras);
  }
  return base;
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

async function toolAddMilestone(uid, args) {
  const state = await loadUser(uid);
  const lv = currentLevel(state);
  if (!lv) throw new Error("No active chapter.");
  if (!args?.name?.trim()) throw new Error("name is required");
  if (!USER_CATEGORIES.includes(args.category)) throw new Error(`category must be one of ${USER_CATEGORIES.join(", ")}`);
  if (!MILESTONE_TEMPLATES.includes(args.template)) throw new Error(`template must be one of ${MILESTONE_TEMPLATES.join(", ")}`);
  if (!DIFFICULTIES.includes(args.difficulty)) throw new Error(`difficulty must be one of ${DIFFICULTIES.join(", ")}`);
  if (!Array.isArray(args.steps)) throw new Error("steps must be an array of step names");

  const steps = args.steps
    .filter(s => typeof s === "string" && s.trim())
    .map(s => ({ name: s.trim().slice(0, 80), completed: false }))
    .slice(0, 8);
  if (steps.length === 0) throw new Error("steps must contain at least one non-empty name");

  const goal = {
    id: genId(),
    name: args.name.trim().slice(0, 80),
    type: "milestone",
    category: args.category,
    template: args.template,
    difficulty: args.difficulty,
    milestoneSteps: steps,
    completions: [],
  };

  const newLevels = state.levels.map(l => l.id === lv.id ? { ...l, goals: [...(l.goals || []), goal] } : l);
  await saveUser(uid, { ...state, levels: newLevels });
  return { ok: true, goal };
}

async function toolCompleteHabit(uid, args) {
  if (!args?.goalId) throw new Error("goalId is required");
  // Atomic + idempotent: a transaction with a (habit, day) ledger key. day is
  // resolved in the user's timezone inside the transaction. Return shape is
  // unchanged from before; a duplicate maps to the existing alreadyDoneToday
  // signal (status 409 semantically; the JSON-RPC envelope stays 200, never 500).
  const r = await completeHabitTransactional(db(), uid, args.goalId);
  if (r.status === 404 || r.status === 400) throw new Error(r.error);
  if (r.status === 409) {
    return { ok: false, alreadyDoneToday: true, streak: r.streak };
  }
  return {
    ok: true,
    streak: r.streak,
    completedAt: r.completedAt,
    note: "XP and Resilience updates land when the user next opens the app.",
  };
}

// Validation shared by update_chapter and advance_level
function validateChapterPatch(args) {
  const errors = [];
  if (args.title !== undefined && (typeof args.title !== "string" || args.title.length > 120)) {
    errors.push("title must be a string under 120 chars");
  }
  if (args.requiredRank !== undefined && !RANKS.includes(args.requiredRank)) {
    errors.push(`requiredRank must be one of ${RANKS.join(", ")}`);
  }
  if (args.categoryGoals !== undefined) {
    if (typeof args.categoryGoals !== "object" || args.categoryGoals === null) {
      errors.push("categoryGoals must be an object");
    } else {
      for (const k of Object.keys(args.categoryGoals)) {
        if (!USER_CATEGORIES.includes(k)) errors.push(`categoryGoals key "${k}" is not a valid dimension`);
        if (typeof args.categoryGoals[k] !== "string") errors.push(`categoryGoals["${k}"] must be a string`);
      }
    }
  }
  if (args.weights !== undefined) {
    if (typeof args.weights !== "object" || args.weights === null) {
      errors.push("weights must be an object");
    } else {
      for (const c of USER_CATEGORIES) {
        if (args.weights[c] === undefined) errors.push(`weights is missing "${c}" (all 5 USER_CATEGORIES required when weights is provided)`);
      }
      const extraKeys = Object.keys(args.weights).filter(k => !USER_CATEGORIES.includes(k) && k !== "Resilience");
      if (extraKeys.length) errors.push(`weights has unknown keys: ${extraKeys.join(", ")}`);
      const sum = USER_CATEGORIES.reduce((s, c) => s + (Number(args.weights[c]) || 0), 0);
      if (sum !== 100) errors.push(`weights must sum to exactly 100 (got ${sum})`);
    }
  }
  return errors;
}

// Builds a normalized weights object (always pins Resilience=0)
function normalizeWeights(weightsArg) {
  const w = { Resilience: 0 };
  for (const c of USER_CATEGORIES) w[c] = Math.max(0, Math.min(100, Math.round(Number(weightsArg[c]))));
  return w;
}

async function toolUpdateChapter(uid, args) {
  if (!args || Object.keys(args).length === 0) throw new Error("No fields to update.");
  const errors = validateChapterPatch(args);
  if (errors.length) throw new Error(errors.join("; "));

  const state = await loadUser(uid);
  const lv = currentLevel(state);
  if (!lv) throw new Error("No active chapter.");

  // Levels under an active arc are system-named ("Level N"). Reject explicit
  // title changes so the user can't drift the data model away from arc-mode.
  if (args.title !== undefined && isArcActive(state)) {
    throw new Error("Levels are system-named while an arc is active (the title is automatically 'Level N'). Remove the `title` argument and try again.");
  }

  const patch = {};
  const updated = [];
  if (args.title !== undefined)         { patch.title = args.title; updated.push("title"); }
  if (args.categoryGoals !== undefined) { patch.categoryGoals = { ...(lv.categoryGoals || {}), ...args.categoryGoals }; updated.push("categoryGoals"); }
  if (args.weights !== undefined)       { patch.weights = normalizeWeights(args.weights); updated.push("weights"); }
  if (args.requiredRank !== undefined)  { patch.requiredRank = args.requiredRank; updated.push("requiredRank"); }

  const newLevels = state.levels.map(l => l.id === lv.id ? { ...l, ...patch } : l);
  const newState = { ...state, levels: newLevels };
  if (args.markSetupComplete) {
    newState.setupDone = true;
    updated.push("setupDone");
  }
  await saveUser(uid, newState);

  const updatedLevel = newLevels.find(l => l.id === lv.id);
  return {
    ok: true,
    updated,
    chapter: {
      number: updatedLevel.num,
      title: updatedLevel.title,
      categoryGoals: updatedLevel.categoryGoals,
      weights: updatedLevel.weights,
      requiredRank: updatedLevel.requiredRank,
    },
    setupDone: newState.setupDone === true,
    note: "User must reload the Level-d app to see changes — no real-time sync yet.",
  };
}

async function toolAdvanceLevel(uid, args = {}) {
  // Strip `title` from validation/patch under arc mode (system-named levels).
  // We still read it lower so we can warn the caller it was ignored.
  const errors = validateChapterPatch(args);
  if (errors.length) throw new Error(errors.join("; "));

  const state = await loadUser(uid);
  const lv = currentLevel(state);

  // ── Arc-active path — evaluate the rank dual-gate before advancing ────
  if (isArcActive(state) && lv) {
    const cfg = getGamificationConfig(state);
    const gates = await evaluateGatesForCurrent(uid, state, lv, cfg);
    if (!gates.canAdvance) {
      // No throw — return structured status so the caller can show the user
      // exactly what's missing. Response intentionally additive.
      return {
        ok: false,
        canAdvance: false,
        rank: {
          current: state.rank.current,
          qualifyingLevelsAtRank: state.rank.qualifyingLevelsAtRank,
          levelsToNextRank: levelsToNextRank(state.rank, cfg),
        },
        level: {
          displayName: lv.displayName || lv.title,
          sequenceInArc: lv.sequenceInArc || null,
          rank: lv.rank || null,
        },
        gates,
        note: "Gate not met. Level has NOT advanced. Inspect `gates.xp` and `gates.boss` to see what's still required.",
      };
    }

    // Both gates passed → archive the just-completed level to the subcollection,
    // promote rank if the qualifying threshold was hit, and create the next
    // system-named level.
    const rankBefore = { ...state.rank };
    const rankAfter  = applyQualifyingLevel(rankBefore, cfg);

    const completedDoc = {
      arcId: state.arc.id,
      levelId: lv.id,
      displayName: lv.displayName || `Level ${lv.sequenceInArc || 1}`,
      rank: rankBefore.current,
      sequenceInRank: lv.sequenceInRank || 1,
      sequenceInArc:  lv.sequenceInArc  || 1,
      startedAt:   lv.startedAt || null,
      completedAt: Date.now(),
      xpAtCompletion: gates.xp.current,
      // Phase 10: per-dimension catScores at completion (radar delta overlay).
      catScoresAtCompletion: { ...(state.catScores || {}) },
      gatesAtCompletion: gates,
      promoted: rankAfter.promoted,
      promotedTo: rankAfter.promoted ? rankAfter.current : null,
    };
    await db().doc(levelDocPath(uid, lv.id)).set(completedDoc);

    const nextSequenceInArc  = (lv.sequenceInArc || 1) + 1;
    const nextSequenceInRank = rankAfter.promoted ? 1 : (lv.sequenceInRank || 1) + 1;

    const baseLevel = {
      id: genId(),
      num: (state.levels?.length || 0) + 1,
      categoryGoals: {
        ...Object.fromEntries(ALL_CATEGORIES.map(c => [c, ""])),
        ...(args.categoryGoals || {}),
      },
      weights: args.weights
        ? normalizeWeights(args.weights)
        : (lv.weights || {
            ...Object.fromEntries(USER_CATEGORIES.map(c => [c, Math.floor(100 / USER_CATEGORIES.length)])),
            Resilience: 0,
          }),
      requiredRank: args.requiredRank || lv.requiredRank || "A",
      goals: [],
      startedAt: Date.now(),
    };
    const newLevel = stampLevelForArc(baseLevel, {
      arcId: state.arc.id,
      rank: rankAfter.current,
      sequenceInRank: nextSequenceInRank,
      sequenceInArc:  nextSequenceInArc,
    });

    const newState = {
      ...state,
      rank: { current: rankAfter.current, qualifyingLevelsAtRank: rankAfter.qualifyingLevelsAtRank },
      levels: [...(state.levels || []), newLevel],
      currentLevelId: newLevel.id,
      // Under arc mode every advance is setup-complete (the arc carries the
      // long-term intent; per-level setup wizard is unnecessary).
      setupDone: true,
      catScores: Object.fromEntries(ALL_CATEGORIES.map(c => [c, 0])),
      catRanks:  Object.fromEntries(ALL_CATEGORIES.map(c => [c, "E"])),
      streaks: {},
      lastCompletions: {},
      lastHabitDate: null,
      decayAppliedOn: null,
      consecutiveMissed: 0,
      dailyCatXP: {},
      lastWeeklyCheckin: null,
    };
    await saveUser(uid, newState);

    const sRankConsecutive = rankAfter.current === "S" ? rankAfter.qualifyingLevelsAtRank : 0;
    const arcCompletionReady = rankAfter.current === "S"
      && sRankConsecutive >= cfg.progression.arcCompletion.consecutiveSRankLevels;

    return {
      ok: true,
      canAdvance: true,
      titleArgIgnored: args.title !== undefined ? true : undefined,
      rank: {
        before: rankBefore.current,
        after: rankAfter.current,
        promoted: rankAfter.promoted,
        qualifyingLevelsAtRank: rankAfter.qualifyingLevelsAtRank,
        levelsToNextRank: levelsToNextRank(rankAfter, cfg),
      },
      completedLevel: {
        displayName: completedDoc.displayName,
        rank: completedDoc.rank,
        xpAtCompletion: completedDoc.xpAtCompletion,
      },
      newLevel: {
        displayName: newLevel.displayName,
        rank: newLevel.rank,
        sequenceInRank: newLevel.sequenceInRank,
        sequenceInArc:  newLevel.sequenceInArc,
        weights: newLevel.weights,
        categoryGoals: newLevel.categoryGoals,
      },
      arcCompletionReady,
      note: arcCompletionReady
        ? "Arc-completion threshold reached at S rank. Call complete_arc with confirm=true to mark the arc done."
        : "New level active. User must reload Level-d to see it.",
    };
  }

  // ── Legacy path (no arc) — preserve exact existing behavior ──────────
  const nextNum = (state.levels?.length || 0) + 1;

  const newLevel = {
    id: genId(),
    num: nextNum,
    title: args.title || "",
    categoryGoals: {
      ...Object.fromEntries(ALL_CATEGORIES.map(c => [c, ""])),
      ...(args.categoryGoals || {}),
    },
    weights: args.weights
      ? normalizeWeights(args.weights)
      : {
          ...Object.fromEntries(USER_CATEGORIES.map(c => [c, Math.floor(100 / USER_CATEGORIES.length)])),
          Resilience: 0,
        },
    requiredRank: args.requiredRank || "A",
    goals: [],
    startedAt: Date.now(),
  };

  // setupDone iff Claude supplied all four core fields — otherwise the user
  // will see the wizard on next load so they can fill in the gaps.
  const fullSetup = !!(args.title && args.categoryGoals && args.weights && args.requiredRank);

  const newState = {
    ...state,
    levels: [...(state.levels || []), newLevel],
    currentLevelId: newLevel.id,
    setupDone: fullSetup,
    catScores: Object.fromEntries(ALL_CATEGORIES.map(c => [c, 0])),
    catRanks:  Object.fromEntries(ALL_CATEGORIES.map(c => [c, "E"])),
    streaks: {},
    lastCompletions: {},
    lastHabitDate: null,
    decayAppliedOn: null,
    consecutiveMissed: 0,
    dailyCatXP: {},
    lastWeeklyCheckin: null,
  };
  await saveUser(uid, newState);

  return {
    ok: true,
    levelNumber: nextNum,
    setupDone: fullSetup,
    chapter: {
      title: newLevel.title,
      categoryGoals: newLevel.categoryGoals,
      weights: newLevel.weights,
      requiredRank: newLevel.requiredRank,
    },
    note: fullSetup
      ? "New chapter active and fully set up. User must reload Level-d to see it."
      : "New chapter active but setup is incomplete — user will see the SetupWizard on next app load. Call update_chapter to fill in the remaining fields and pass markSetupComplete=true to skip the wizard.",
  };
}

// ── Arc lifecycle: start_arc / complete_arc ────────────────────────────────
async function toolStartArc(uid, args) {
  const goal = (args?.goal || "").trim();
  if (!goal) throw new Error("goal is required and must be a non-empty string");
  if (goal.length > 280) throw new Error("goal must be 280 chars or fewer");

  const state = await loadUser(uid);
  if (isArcActive(state)) {
    throw new Error(`An arc is already active ("${state.arc.goal}"). Complete it via complete_arc before starting a new one.`);
  }
  const lv = currentLevel(state);
  if (!lv) throw new Error("No active chapter to anchor the new arc to.");

  const arcId = genId();
  const startDate = Date.now();
  const arcDoc = {
    id: arcId,
    goal,
    startDate,
    status: "active",
    completedAt: null,
  };

  // Decorate the user's CURRENT level as Level 1 of the new arc. Preserves
  // accumulated XP / habits / streaks — the arc layer is additive.
  const stampedCurrent = stampLevelForArc(lv, {
    arcId,
    rank: "E",
    sequenceInRank: 1,
    sequenceInArc:  1,
  });
  const newLevels = state.levels.map(l => l.id === lv.id ? stampedCurrent : l);

  await db().doc(arcDocPath(uid, arcId)).set(arcDoc);

  const newState = {
    ...state,
    arc: { id: arcId, goal, startDate, status: "active" },
    rank: { current: "E", qualifyingLevelsAtRank: 0 },
    levels: newLevels,
  };
  await saveUser(uid, newState);

  return {
    ok: true,
    arc: { id: arcId, goal, startDate, status: "active" },
    rank: { current: "E", qualifyingLevelsAtRank: 0 },
    level: {
      displayName: stampedCurrent.displayName,
      rank: stampedCurrent.rank,
      sequenceInRank: stampedCurrent.sequenceInRank,
      sequenceInArc:  stampedCurrent.sequenceInArc,
    },
    note: "Arc started. The current chapter has been relabeled 'Level 1' and your rank set to E. Existing XP, habits, and quests are preserved. From now on, advance_level enforces the rank dual-gate.",
  };
}

async function toolCompleteArc(uid, args) {
  if (args?.confirm !== true) {
    throw new Error("confirm must be literally true to complete the arc (guards against accidental calls).");
  }
  const state = await loadUser(uid);
  if (!isArcActive(state)) throw new Error("No active arc to complete.");
  const cfg = getGamificationConfig(state);
  const needed = cfg.progression.arcCompletion.consecutiveSRankLevels;
  const rank = state.rank || { current: "E", qualifyingLevelsAtRank: 0 };

  if (rank.current !== "S") {
    throw new Error(`Arc completion requires rank S; current rank is ${rank.current}.`);
  }
  if ((rank.qualifyingLevelsAtRank || 0) < needed) {
    throw new Error(`Arc completion requires ${needed} consecutive qualifying S-rank levels; you have ${rank.qualifyingLevelsAtRank || 0}.`);
  }

  const completedAt = Date.now();
  await db().doc(arcDocPath(uid, state.arc.id)).set(
    { status: "complete", completedAt },
    { merge: true }
  );

  const newState = {
    ...state,
    arc: { ...state.arc, status: "complete", completedAt },
  };
  await saveUser(uid, newState);

  return {
    ok: true,
    arc: { id: state.arc.id, goal: state.arc.goal, status: "complete", completedAt },
    note: "Arc marked complete. start_arc can now begin a new one.",
  };
}

// Mirrors src/utils.js canEditGoal — structural fields lock 3 days after
// level.startedAt for goals that were created during initial setup
// (locked: true). User-added goals (no locked flag) are always editable.
function canEditStructural(goal, level) {
  if (!goal) return false;
  if (!goal.locked) return true;
  return Date.now() - (level?.startedAt || 0) < EDIT_WINDOW_MS;
}

async function toolUpdateGoal(uid, args) {
  if (!args?.goalId) throw new Error("goalId is required");

  const state = await loadUser(uid);
  const lv = currentLevel(state);
  if (!lv) throw new Error("No active chapter.");
  const goalIdx = (lv.goals || []).findIndex(g => g.id === args.goalId);
  if (goalIdx === -1) throw new Error(`No goal with id ${args.goalId}`);
  const goal = lv.goals[goalIdx];

  const patch = {};
  const updated = [];
  const lockedFields = [];
  const canStructural = canEditStructural(goal, lv);

  // Always-editable: anchor / notes / ifThenFallback
  if (args.anchor !== undefined) {
    if (typeof args.anchor !== "object" || args.anchor === null) throw new Error("anchor must be an object");
    const newAnchor = { ...(goal.anchor || {}) };
    for (const k of ["cue", "location", "action", "prep"]) {
      if (args.anchor[k] !== undefined) {
        if (typeof args.anchor[k] !== "string") throw new Error(`anchor.${k} must be a string`);
        const v = args.anchor[k].trim();
        if (v) newAnchor[k] = v.slice(0, 200);
        else   delete newAnchor[k]; // empty string clears that field
      }
    }
    patch.anchor = Object.keys(newAnchor).length ? newAnchor : null;
    updated.push("anchor");
  }
  if (args.notes !== undefined) {
    if (typeof args.notes !== "string") throw new Error("notes must be a string");
    patch.notes = args.notes.trim() ? args.notes.trim().slice(0, 1000) : null;
    updated.push("notes");
  }
  if (args.ifThenFallback !== undefined) {
    if (typeof args.ifThenFallback !== "string") throw new Error("ifThenFallback must be a string");
    patch.ifThenFallback = args.ifThenFallback.trim() ? args.ifThenFallback.trim().slice(0, 500) : null;
    updated.push("ifThenFallback");
  }

  // Structural — gated by canEditStructural
  function structural(field, validateAndSet) {
    if (args[field] === undefined) return;
    if (!canStructural) { lockedFields.push(field); return; }
    validateAndSet();
    updated.push(field);
  }

  structural("name", () => {
    if (typeof args.name !== "string" || !args.name.trim()) throw new Error("name must be a non-empty string");
    patch.name = args.name.trim().slice(0, 80);
  });
  structural("difficulty", () => {
    if (!DIFFICULTIES.includes(args.difficulty)) throw new Error(`difficulty must be one of ${DIFFICULTIES.join(", ")}`);
    patch.difficulty = args.difficulty;
  });
  structural("template", () => {
    const allowed = goal.type === "milestone" ? MILESTONE_TEMPLATES : HABIT_TEMPLATES;
    if (!allowed.includes(args.template)) throw new Error(`template for ${goal.type} must be one of ${allowed.join(", ")}`);
    patch.template = args.template;
  });
  structural("category", () => {
    if (goal.type === "quitHabit") throw new Error("category cannot be changed for quitHabit (always Resilience)");
    if (!USER_CATEGORIES.includes(args.category)) throw new Error(`category must be one of ${USER_CATEGORIES.join(", ")}`);
    patch.category = args.category;
  });
  structural("frequency", () => {
    if (goal.type !== "habitual" && goal.type !== "quitHabit") throw new Error("frequency is only valid for habitual / quitHabit");
    if (!FREQUENCIES.includes(Number(args.frequency))) throw new Error(`frequency must be one of ${FREQUENCIES.join(", ")}`);
    patch.frequency = Number(args.frequency);
  });
  structural("identities", () => {
    if (goal.type !== "habitual") throw new Error("identities is only valid for habitual goals");
    if (!Array.isArray(args.identities)) throw new Error("identities must be an array");
    const valid = args.identities.filter(i => USER_CATEGORIES.includes(i));
    const primary = patch.category || goal.category;
    if (!valid.length) {
      patch.identities = null; // clears multi-identity
    } else {
      const deduped = [primary, ...valid.filter(i => i !== primary)];
      patch.identities = deduped.length > 1 ? deduped : null;
    }
  });
  structural("milestoneSteps", () => {
    if (goal.type !== "milestone") throw new Error("milestoneSteps is only valid for milestone goals");
    if (!Array.isArray(args.milestoneSteps) || args.milestoneSteps.length < 1) throw new Error("milestoneSteps must be a non-empty array");
    patch.milestoneSteps = args.milestoneSteps
      .filter(s => s?.name && typeof s.name === "string" && s.name.trim())
      .map(s => ({ name: s.name.trim().slice(0, 80), completed: !!s.completed }))
      .slice(0, 8);
    if (patch.milestoneSteps.length === 0) throw new Error("milestoneSteps must contain at least one valid step");
  });

  if (Object.keys(patch).length === 0) {
    if (lockedFields.length) throw new Error(`All requested fields are locked outside the initial 3-day edit window: ${lockedFields.join(", ")}. Only anchor / notes / ifThenFallback remain editable.`);
    throw new Error("No fields provided to update.");
  }

  const newGoals = lv.goals.map(g => g.id === goal.id ? { ...g, ...patch } : g);
  const newLevels = state.levels.map(l => l.id === lv.id ? { ...l, goals: newGoals } : l);
  await saveUser(uid, { ...state, levels: newLevels });

  return {
    ok: true,
    goalId: goal.id,
    updated,
    locked: lockedFields,
    goal: { ...goal, ...patch },
    note: lockedFields.length
      ? `Some fields were not applied because the goal's 3-day edit window has passed: ${lockedFields.join(", ")}.`
      : "User must reload Level-d to see changes.",
  };
}

// ── Quests ──────────────────────────────────────────────────────────────────
function mapQuest(q) {
  return {
    id: q.id,
    title: q.title,
    dimension: q.dimension,
    band: q.band,
    xp: q.xp,
    status: q.status,
    signature: !!q.signature,
    chapterId: q.chapterId || null,
    completedAt: q.completedAt || null,
  };
}

async function toolListQuests(uid, args) {
  const state = await loadUser(uid);
  const filter = args?.status || "all";
  const quests = (state.quests || [])
    .filter(q => filter === "all" || (q.status || "active") === filter)
    .map(mapQuest);
  return { count: quests.length, quests };
}

async function toolAddQuest(uid, args) {
  const state = await loadUser(uid);
  const lv = currentLevel(state);
  if (!lv) throw new Error("No active chapter.");
  if (!args?.title?.trim()) throw new Error("title is required");
  if (!USER_CATEGORIES.includes(args.dimension)) throw new Error(`dimension must be one of ${USER_CATEGORIES.join(", ")}`);
  if (args.band !== undefined && !QUEST_BANDS.includes(args.band)) throw new Error(`band must be one of ${QUEST_BANDS.join(", ")}`);

  const cfg = getGamificationConfig(state);
  const band = QUEST_BANDS.includes(args.band) ? args.band : cfg.quests.defaultBand;
  const chapterLinked = args.chapterLinked !== false; // default true

  const quest = {
    id: genId(),
    title: args.title.trim().slice(0, 120),
    dimension: args.dimension,
    band,
    xp: cfg.quests.bands[band],
    status: "active",
    signature: args.signature === true,
    chapterId: chapterLinked ? lv.id : null,
    createdAt: Date.now(),
  };
  await saveUser(uid, { ...state, quests: [...(state.quests || []), quest] });
  return { ok: true, quest: mapQuest(quest) };
}

async function toolCompleteQuest(uid, args) {
  if (!args?.questId) throw new Error("questId is required");
  // Atomic + idempotent on (uid, questId) via a transaction + ledger key.
  // Return shape unchanged; duplicates map to the existing alreadyCompleted
  // signal, never a 500.
  const r = await completeQuestTransactional(db(), uid, args.questId);
  if (r.status === 404) throw new Error(r.error);
  if (r.status === 409) {
    return { ok: false, alreadyCompleted: true, quest: mapQuest(r.quest) };
  }
  return {
    ok: true,
    quest: mapQuest(r.quest),
    note: "Quest marked complete. The +" + r.quest.xp + " XP lands when the user next opens the app.",
  };
}

const HANDLERS = {
  list_goals:             toolListGoals,
  get_identity_portrait:  toolGetIdentityPortrait,
  get_weekly_summary:     toolGetWeeklySummary,
  add_habit:              toolAddHabit,
  add_milestone:          toolAddMilestone,
  complete_habit:         toolCompleteHabit,
  update_chapter:         toolUpdateChapter,
  advance_level:          toolAdvanceLevel,
  start_arc:              toolStartArc,
  complete_arc:           toolCompleteArc,
  update_goal:            toolUpdateGoal,
  list_quests:            toolListQuests,
  add_quest:              toolAddQuest,
  complete_quest:         toolCompleteQuest,
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
    if (RATE_LIMITED_TOOLS.has(toolName)) {
      const { allowed, retryAfter } = await checkCompletionRateLimit(uid);
      if (!allowed) {
        // 429-semantics. The JSON-RPC HTTP envelope stays 200 so the connector
        // parses the result; the limit is surfaced as a tool error with the
        // retry hint, never a 500.
        return rpcResult(id, {
          content: [{ type: "text", text: `Rate limit exceeded — too many completions. Retry after ${retryAfter}s. (HTTP 429)` }],
          isError: true,
        });
      }
    }
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
    await captureError(e, { where: "authenticate" });
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
    await captureError(e, { where: "handleRpc", uid });
    return res.status(500).json(rpcError(body?.id ?? null, -32603, "Internal error", String(e)));
  }
}
