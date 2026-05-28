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
  {
    name: "update_chapter",
    description: "Patches the current chapter's setup (title, identity statements, weights, required rank). Partial updates allowed — pass only the fields you want to change. Use markSetupComplete=true to also dismiss the SetupWizard (useful when filling in setup for a brand new user). The Level-d browser tab does not auto-refresh; the user must reload to see changes.",
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
    description: "Creates a new chapter (the next level). Resets per-chapter scores, streaks, and completions, but preserves history (the prior level stays in state.levels). If you provide ALL of title, categoryGoals, weights, and requiredRank, setupDone is automatically marked true so the user can start tracking immediately. Otherwise the SetupWizard will show on next app load. The browser tab does not auto-refresh.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Chapter name for the new level." },
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
        requiredRank: { type: "string", enum: RANKS },
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
    description: "Creates a one-off quest (completable once), separate from recurring habits. XP is a flat reward from a band: small / medium / large. Mark signature=true for quests that define what leveling up means (these count toward a chapter's boss challenge). Links to the current chapter by default.",
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
  const errors = validateChapterPatch(args);
  if (errors.length) throw new Error(errors.join("; "));

  const state = await loadUser(uid);
  const nextNum = (state.levels?.length || 0) + 1;

  // Build the new level. mkLevel in src/utils.js does the same shape — kept
  // inline here so this function has no client-bundle dependency.
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
  const state = await loadUser(uid);
  if (!args?.questId) throw new Error("questId is required");
  const quest = (state.quests || []).find(q => q.id === args.questId);
  if (!quest) throw new Error(`No quest with id ${args.questId}`);
  if (quest.status === "completed") {
    return { ok: false, alreadyCompleted: true, quest: mapQuest(quest) };
  }
  // Mark completed but leave XP pending — the app awards it (and reconciles)
  // on next load, mirroring complete_habit.
  const completed = { ...quest, status: "completed", completedAt: Date.now(), xpAwarded: false };
  const newQuests = (state.quests || []).map(q => q.id === quest.id ? completed : q);
  await saveUser(uid, { ...state, quests: newQuests });
  return {
    ok: true,
    quest: mapQuest(completed),
    note: "Quest marked complete. The +" + completed.xp + " XP lands when the user next opens the app.",
  };
}

const HANDLERS = {
  list_goals:             toolListGoals,
  get_identity_portrait:  toolGetIdentityPortrait,
  get_weekly_summary:     toolGetWeeklySummary,
  add_habit:              toolAddHabit,
  complete_habit:         toolCompleteHabit,
  update_chapter:         toolUpdateChapter,
  advance_level:          toolAdvanceLevel,
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
