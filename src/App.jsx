import { useState, useEffect, useCallback, useRef } from "react";
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, collection, query, orderBy, getDocs } from "firebase/firestore";
import { auth, db, googleProvider } from "./firebase";
import { getOverallScore, getRank, mkDefault, genId, mkLevel, applyResilienceDecay, reconcileQuestXP, calcBaseXP, getDailyCatXP, getThisWeekCount, getPrevWeekCount, canEditGoal, getWeeklyVotes, isCheckinDue } from "./utils";
import { RANKS, CATEGORIES, USER_CATEGORIES, DAILY_XP_CAP } from "./constants";
import { getGamificationConfig } from "./gamification.config.js";
import { computeHabitXP, habitBaseXP, toCompletionRecord } from "./gamification/xp.js";
import { evaluateBoss } from "./gamification/boss.js";
import { evaluateGates } from "./gamification/progression.js";
import { applyQualifyingLevel, levelsToNextRank } from "./gamification/rank.js";
import { getTier, THEME_CONFIG } from "./theme.config.js";
import { resolveTimeZone, detectTimeZone, tzToday, tzYesterday } from "./gamification/time.js";
import { captureError } from "./observability/sentry.js";
import { appendXpAudit } from "./observability/audit.js";
import { estimateDocBytes } from "./gamification/docsize.js";
import styles from "./styles.module.css";
import LoginScreen from "./components/LoginScreen";
import OAuthAuthorize from "./components/OAuthAuthorize";
import SetupWizard from "./components/SetupWizard";
import Sidebar from "./components/Sidebar";
import RankPanel from "./components/RankPanel";
import Dashboard from "./components/Dashboard";
import GoalsView from "./components/GoalsView";
import HistoryView from "./components/HistoryView";
import ReportsView from "./components/ReportsView";
import SettingsView from "./components/SettingsView";
import QuickNotePopup from "./components/QuickNotePopup";
import AscensionMoment from "./components/AscensionMoment";
import ReactiveBackground from "./components/background/ReactiveBackground";
import { useIsMobile } from "./hooks/useIsMobile";
import { useOnlineStatus } from "./hooks/useOnlineStatus";

const RESILIENCE_XP_PER_HABIT = 5;

function readCollapsed() {
  try { return localStorage.getItem("lrpg-sidebar-collapsed") === "true"; } catch { return false; }
}

export default function App() {
  const isMobile = useIsMobile();
  const online = useOnlineStatus();
  // undefined = auth loading, null = signed out, object = signed in
  const [user, setUser]             = useState(undefined);
  const [state, setState]           = useState(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [authError, setAuthError]   = useState(null);
  const [loadError, setLoadError]   = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [view, setView]             = useState("dashboard");
  const [toast, setToast]           = useState(null);
  const [addOpen, setAddOpen]       = useState(false);
  const [addType, setAddType]       = useState("habitual");
  const [editingGoalId, setEditingGoalId] = useState(null);
  const [recentCompletion, setRecentCompletion] = useState(null); // { goalId, ts } for quick-note popup
  // Phase 10: catScores from the level completed N levels back (default 3).
  // null = not loaded yet or no history; the radar then shows "now" only.
  const [historicalCatScores, setHistoricalCatScores] = useState(null);
  // Phase 11: the celestial tier just reached on the most recent advance.
  // null while no ascension is in flight; set to "Spark" / "Flare" / etc.
  // when a tier-up fires; cleared by AscensionMoment.onDone.
  const [ascensionTier, setAscensionTier] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  // Tracks the uid whose data we've successfully loaded. The persist effect
  // refuses to write unless this matches the current user — prevents a failed
  // load or a stale-promise from a previous account from clobbering Firestore.
  const loadedUidRef = useRef(null);
  // Warn (once per session) before the single user doc nears Firestore's 1MB cap.
  const docSizeWarnedRef = useRef(false);

  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }

  function handleTouchEnd(e) {
    if (drawerOpen) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    // Swipe right from anywhere — larger dx threshold to avoid false positives
    if (dx > 80 && Math.abs(dy) < 80) {
      setDrawerOpen(true);
    }
  }

  function toggleSidebar() {
    setSidebarCollapsed(v => {
      const next = !v;
      try { localStorage.setItem("lrpg-sidebar-collapsed", next); } catch {}
      return next;
    });
  }

  // ── Auth listener + handle redirect result ────────────────────────────────
  useEffect(() => {
    // Pick up the result if we came back from a redirect sign-in
    getRedirectResult(auth).catch(() => {});
    return onAuthStateChanged(auth, u => setUser(u || null));
  }, []);

  // ── Load data from Firestore; apply Resilience decay immediately ───────────
  useEffect(() => {
    if (!user) {
      setState(null);
      loadedUidRef.current = null;
      return;
    }

    const uid = user.uid;
    let cancelled = false;

    setDataLoading(true);
    setLoadError(null);
    loadedUidRef.current = null;

    getDoc(doc(db, "users", uid))
      .then(snap => {
        if (cancelled) return;
        const data = snap.exists() ? snap.data() : mkDefault();
        // Backfill the user's IANA timezone once so the client and the MCP
        // server resolve "today" identically (additive; defaults to this
        // device's zone, which matches the pre-change browser-local behavior).
        if (!data.timezone) data.timezone = detectTimeZone();
        const decayPatch = applyResilienceDecay(data);
        const afterDecay = decayPatch ? { ...data, ...decayPatch } : data;
        // Award XP for any quests completed via MCP since the last open.
        const questPatch = reconcileQuestXP(afterDecay);
        setState(questPatch ? { ...afterDecay, ...questPatch } : afterDecay);
        loadedUidRef.current = uid;
      })
      .catch(e => {
        if (cancelled) return;
        console.error("Failed to load user data:", e);
        captureError(e, { where: "loadUserData", uid });
        setLoadError(e);
      })
      .finally(() => {
        if (!cancelled) setDataLoading(false);
      });

    return () => { cancelled = true; };
  }, [user?.uid, refreshKey]);

  // ── Persist to Firestore on every state change ─────────────────────────────
  // Refuses to write unless loadedUidRef matches the current uid. A failed
  // load leaves loadedUidRef null, so a transient Firestore error can never
  // overwrite the user's real doc with default state.
  useEffect(() => {
    if (!user || !state) return;
    if (loadedUidRef.current !== user.uid) return;
    const bytes = estimateDocBytes(state);
    if (bytes >= getGamificationConfig(state).limits.docSizeWarnBytes && !docSizeWarnedRef.current) {
      docSizeWarnedRef.current = true;
      captureError(new Error(`User state doc is ${bytes} bytes, approaching Firestore's 1,048,576-byte limit`), { uid: user.uid, bytes });
    }
    setDoc(doc(db, "users", user.uid), state).catch(e => { console.error(e); captureError(e, { where: "persistState", uid: user.uid }); });
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  // Phase 10: fetch the catScores from the level completed `levelsBack` levels
  // back, so the identity portrait can overlay then-vs-now. Refreshes when the
  // arc changes or a new level is archived (state.levels length changes).
  // No-ops gracefully when there's no history yet.
  useEffect(() => {
    if (!user || !state?.arc?.id) { setHistoricalCatScores(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const colRef = collection(db, `users/${user.uid}/levels`);
        const snap = await getDocs(query(colRef, orderBy("completedAt", "desc")));
        // Only look within the current arc; older arcs don't compare cleanly.
        const docs = snap.docs.filter(d => d.get("arcId") === state.arc.id);
        const idx = THEME_CONFIG.radarHistory.levelsBack - 1; // 0-based
        const target = docs[idx];
        if (!target) { if (!cancelled) setHistoricalCatScores(null); return; }
        const cs = target.get("catScoresAtCompletion");
        if (!cs || cancelled) { if (!cancelled) setHistoricalCatScores(null); return; }
        setHistoricalCatScores({
          scores: cs,
          atLevel: target.get("displayName") || "an earlier level",
        });
      } catch (e) {
        console.error("[radarHistory] fetch failed:", e);
        if (!cancelled) setHistoricalCatScores(null);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.uid, state?.arc?.id, state?.levels?.length]);

  // ── Auth actions ───────────────────────────────────────────────────────────
  async function handleSignIn() {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      if (e.code === "auth/popup-closed-by-user" || e.code === "auth/cancelled-popup-request") {
        return; // user dismissed, no error
      }
      if (
        e.code === "auth/popup-blocked" ||
        e.code === "auth/unauthorized-domain" ||
        e.code === "auth/operation-not-supported-in-this-environment"
      ) {
        // Popup blocked or domain not authorized — fall back to redirect flow
        try {
          await signInWithRedirect(auth, googleProvider);
        } catch {
          setAuthError(`Auth error: ${e.code}`);
        }
        return;
      }
      setAuthError(`Sign-in error: ${e.code || e.message}`);
    }
  }

  function handleSignOut() {
    signOut(auth);
    setState(null);
    setView("dashboard");
  }

  function handleReset() {
    setState(mkDefault());
    setView("dashboard");
  }

  // ── State helpers ──────────────────────────────────────────────────────────
  const notify = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }, []);

  const currentLevel = state
    ? (state.levels.find(l => l.id === state.currentLevelId) || state.levels[0])
    : null;

  const updLv = useCallback((patch) => {
    setState(s => ({
      ...s,
      levels: s.levels.map(l => l.id === s.currentLevelId ? { ...l, ...patch } : l),
    }));
  }, []);

  // ── Game actions ───────────────────────────────────────────────────────────
  // The wizard now collects an arc goal (the master 3–8 yr aspiration) as its
  // first step and no longer prompts for a per-level requiredRank — under an
  // arc, the rank dual-gate (XP × rank multiplier + boss + signature) governs
  // advancement. finishSetup therefore: stamps the current level as Level 1
  // of a freshly-started arc, initializes state.rank to E, and persists the
  // arc summary to a per-arc subcollection (mirrors api/mcp.js#toolStartArc).
  function finishSetup(arcGoal, categoryGoals, weights, goals = [], quests = []) {
    // Initial goals/quests are stamped locked:true → editable for the first 3
    // days of the level (canEditGoal), immutable after.
    const stampedGoals = goals.map(g => ({ ...g, id: genId(), completions: g.completions || [], locked: true }));
    const cfg = getGamificationConfig(state);
    const stampedQuests = quests.map(q => {
      const band = cfg.quests.bands[q.band] !== undefined ? q.band : cfg.quests.defaultBand;
      return {
        id: genId(),
        title: (q.title || "").trim(),
        dimension: q.dimension,
        band,
        xp: cfg.quests.bands[band],
        status: "active",
        signature: !!q.signature,
        chapterId: q.chapterLinked === false ? null : currentLevel.id,
        createdAt: Date.now(),
        locked: true,
      };
    });

    const goal = (arcGoal || "").trim();
    if (goal && !state.arc) {
      const arcId = genId();
      const startDate = Date.now();
      const arcDoc = { id: arcId, goal, startDate, status: "active", completedAt: null };
      setDoc(doc(db, `users/${user.uid}/arcs/${arcId}`), arcDoc)
        .catch(e => { console.error(e); captureError(e, { where: "createArc", uid: user.uid }); });

      // Stamp the current chapter as Level 1 of the new arc. system-set title.
      const stampedLevels = state.levels.map(l => l.id === state.currentLevelId ? {
        ...l,
        arcId,
        rank: "E",
        sequenceInRank: 1,
        sequenceInArc:  1,
        displayName: "Level 1",
        title: "Level 1",
        categoryGoals,
        weights,
        // requiredRank kept on the document for back-compat; vestigial under arc mode
        requiredRank: l.requiredRank || "A",
        goals: stampedGoals,
      } : l);

      setState(s => ({
        ...s,
        arc: { id: arcId, goal, startDate, status: "active" },
        rank: { current: "E", qualifyingLevelsAtRank: 0 },
        levels: stampedLevels,
        setupDone: true,
        quests: [...(s.quests || []), ...stampedQuests],
      }));
    } else {
      // Fallback path — no arc goal supplied (legacy or already-arced user
      // re-running the wizard). Preserves the pre-arc shape exactly.
      updLv({ title: goal || "Becoming", categoryGoals, weights, requiredRank: "A", goals: stampedGoals });
      setState(s => ({ ...s, setupDone: true, quests: [...(s.quests || []), ...stampedQuests] }));
    }
    setView("dashboard");
  }

  function addGoal(goal) {
    updLv({ goals: [...currentLevel.goals, { ...goal, id: genId(), completions: [] }] });
    notify("Goal added");
  }

  // Batched append — needed for the Agent suggestion modal which adds many at
  // once. Calling addGoal in a loop would re-read the same currentLevel.goals
  // snapshot each time and drop all but the last addition.
  function addGoals(goals) {
    if (!goals?.length) return;
    const stamped = goals.map(g => ({ ...g, id: genId(), completions: g.completions || [] }));
    updLv({ goals: [...currentLevel.goals, ...stamped] });
    notify(`${stamped.length} goal${stamped.length === 1 ? "" : "s"} added`);
  }

  function deleteGoal(id) {
    const goal = currentLevel.goals.find(g => g.id === id);
    if (!canEditGoal(goal, currentLevel)) return;
    updLv({ goals: currentLevel.goals.filter(g => g.id !== id) });
  }

  function editGoal(id, patch) {
    const goal = currentLevel.goals.find(g => g.id === id);
    if (!goal) return;
    // Outside the edit window, only anchor/notes/fallback edits are allowed.
    const softKeys = ["anchor", "notes", "ifThenFallback"];
    const effectivePatch = canEditGoal(goal, currentLevel)
      ? patch
      : Object.fromEntries(Object.entries(patch).filter(([k]) => softKeys.includes(k)));
    if (Object.keys(effectivePatch).length === 0) return;
    updLv({ goals: currentLevel.goals.map(g => g.id === id ? { ...g, ...effectivePatch } : g) });
    notify("Saved");
  }

  function addCompletionNote(goalId, ts, note) {
    const trimmed = (note || "").trim();
    if (!trimmed) return;
    updLv({
      goals: currentLevel.goals.map(g => g.id === goalId
        ? { ...g, completionNotes: { ...(g.completionNotes || {}), [ts]: trimmed } }
        : g),
    });
  }

  // ── Quests (one-off, top-level so they survive chapter advancement) ────────
  function addQuest({ title, dimension, band, signature = false, chapterLinked = true }) {
    if (!title?.trim() || !USER_CATEGORIES.includes(dimension)) return;
    const cfg = getGamificationConfig(state);
    const resolvedBand = cfg.quests.bands[band] !== undefined ? band : cfg.quests.defaultBand;
    const quest = {
      id: genId(),
      title: title.trim(),
      dimension,
      band: resolvedBand,
      xp: cfg.quests.bands[resolvedBand],
      status: "active",
      signature: !!signature,
      chapterId: chapterLinked ? currentLevel.id : null,
      createdAt: Date.now(),
    };
    setState(s => ({ ...s, quests: [...(s.quests || []), quest] }));
    notify("Quest added");
  }

  function completeQuest(questId) {
    const quest = (state.quests || []).find(q => q.id === questId);
    if (!quest || quest.status === "completed") return;
    const dim = quest.dimension;
    const pts = quest.xp || 0;
    const newScores = { ...state.catScores };
    const newRanks  = { ...state.catRanks };
    if (USER_CATEGORIES.includes(dim)) {
      newScores[dim] = (newScores[dim] || 0) + pts;
      newRanks[dim]  = getRank(newScores[dim]);
    }
    setState(s => ({
      ...s,
      catScores: newScores,
      catRanks: newRanks,
      quests: (s.quests || []).map(q => q.id === questId
        ? { ...q, status: "completed", completedAt: Date.now(), xpAwarded: true }
        : q),
    }));
    appendXpAudit(user?.uid, { kind: "quest_completion", source: "app", questId, dimension: dim, xp: pts });
    notify(`◇ Quest complete · +${pts} XP · ${dim}`);
    if (navigator.vibrate) navigator.vibrate([10, 40, 10]);
  }

  function deleteQuest(questId) {
    const quest = (state.quests || []).find(q => q.id === questId);
    // Locked setup quests follow the same 3-day window as locked goals.
    if (quest && !canEditGoal(quest, currentLevel)) return;
    setState(s => ({ ...s, quests: (s.quests || []).filter(q => q.id !== questId) }));
  }

  function completeHabitual(goalId, opts = {}) {
    const goal = currentLevel.goals.find(g => g.id === goalId);
    if (!goal) return;
    // "Today" resolves in the user's IANA timezone so the client and the MCP
    // server agree on the civil day (same toDateString format as before).
    const tz = resolveTimeZone(state);
    const t = tzToday(tz);
    if (state.lastCompletions[goalId] === t) { notify("Already done today"); return; }

    // Surge completion is a superset of baseline — same completion + streak,
    // just a harder target and a bonus multiplier. Ignored if no surge variant.
    const isSurge = opts.surge === true && !!goal.surge;

    const freq = goal.frequency || 7;
    const isWeekly = freq < 7;

    const yStr = tzYesterday(tz);

    // ── Streak calculation (unchanged) ─────────────────────────────────────────
    const thisWeekCount   = isWeekly ? getThisWeekCount(goal.completions || []) : 0;
    const completingTarget = isWeekly && thisWeekCount + 1 >= freq;

    let newStreak;
    if (isWeekly) {
      if (completingTarget) {
        const prevWeekCount = getPrevWeekCount(goal.completions || []);
        const prevMet = prevWeekCount >= freq;
        newStreak = prevMet ? (state.streaks[goalId] || 0) + 1 : 1;
      } else {
        newStreak = state.streaks[goalId] || 0; // mid-week, don't change yet
      }
    } else {
      newStreak = state.lastCompletions[goalId] === yStr ? (state.streaks[goalId] || 0) + 1 : 1;
    }
    const newStreaks = { ...state.streaks, [goalId]: newStreak };

    // ── XP calculation ────────────────────────────────────────────────────────
    // The central XP module (src/gamification/xp.js) owns the stacking rule.
    // The streak multiplier reads the per-habit streak; for weekly habits it
    // only applies once the weekly target is met (mirrors the prior gating).
    // The comeback bonus fires on the first completion after a missed day —
    // daily habits with prior history whose last completion wasn't yesterday.
    // It is additive and ceiling-exempt; streak math itself is untouched.
    const cfg = getGamificationConfig(state);
    const baseXP = habitBaseXP(goal);
    const effectiveStreak = isWeekly ? (completingTarget ? newStreak : 0) : newStreak;
    const isComeback = !isWeekly && !!state.lastCompletions[goalId] && state.lastCompletions[goalId] !== yStr;
    const xpResult = computeHabitXP({ baseXP, streak: effectiveStreak, isSurge, goal, isComeback, config: cfg });
    const rawPts = xpResult.total;

    // Apply per-category daily XP cap
    const todayDailyCat = getDailyCatXP(state.dailyCatXP, goal.category, t);
    const pts    = Math.max(0, Math.min(rawPts, DAILY_XP_CAP - todayDailyCat));
    const todayDailyRes = getDailyCatXP(state.dailyCatXP, "Resilience", t);
    const resPts = Math.max(0, Math.min(RESILIENCE_XP_PER_HABIT, DAILY_XP_CAP - todayDailyRes));

    // Update daily tracking
    const newDailyCatXP = {
      ...state.dailyCatXP,
      [t]: {
        ...(state.dailyCatXP?.[t] || {}),
        [goal.category]: todayDailyCat + pts,
        Resilience: todayDailyRes + resPts,
      },
    };

    // Goal's own category XP
    const newScores = { ...state.catScores, [goal.category]: (state.catScores[goal.category] || 0) + pts };
    const newRanks  = { ...state.catRanks,  [goal.category]: getRank(newScores[goal.category]) };

    // Resilience auto-XP
    const newResScore = (newScores.Resilience || 0) + resPts;
    newScores.Resilience = newResScore;
    newRanks.Resilience  = getRank(newResScore);

    const completionTs = Date.now();
    // Write-time XP breakdown. To keep the single user doc under Firestore's 1MB
    // ceiling (Layer 2), the per-completion breakdown is NOT stored inline on the
    // goal — it goes to the append-only xpAudit subcollection below. completions[]
    // stays a slim number[] so every existing read site is untouched.
    const xpRecord = toCompletionRecord(completionTs, xpResult, { applied: pts, surge: isSurge });
    const newLevels = state.levels.map(l =>
      l.id === currentLevel.id
        ? { ...l, goals: l.goals.map(g => g.id === goalId
            ? { ...g, completions: [...(g.completions || []), completionTs] }
            : g) }
        : l
    );

    setState(s => ({
      ...s,
      levels: newLevels,
      catScores: newScores,
      catRanks: newRanks,
      streaks: newStreaks,
      lastCompletions: { ...s.lastCompletions, [goalId]: t },
      lastHabitDate: t,
      consecutiveMissed: 0,
      decayAppliedOn: t,
      dailyCatXP: newDailyCatXP,
    }));

    appendXpAudit(user?.uid, {
      kind: "habit_completion", source: "app", goalId, day: t, streak: newStreak, xp: pts,
      breakdown: {
        base: xpRecord.base,
        streakMultiplier: xpRecord.streakMultiplier,
        surgeMultiplier: xpRecord.surgeMultiplier,
        comebackBonus: xpRecord.comebackBonus,
      },
    });

    const surgeTag = isSurge ? " ⚡SURGE" : "";
    if (isComeback && xpResult.comebackBonus > 0) {
      notify(`◈ Back on track! +${pts} XP · ${goal.category}${surgeTag}`);
    } else {
      notify(`+${pts} XP · ${goal.category}${surgeTag}  +${resPts} RES`);
    }
    setRecentCompletion({ goalId, ts: completionTs, comeback: isComeback && xpResult.comebackBonus > 0 });
    if (navigator.vibrate) navigator.vibrate(isComeback ? [10, 40, 10] : 10);
  }

  function completeMilestoneStep(goalId, stepIdx) {
    const goal = currentLevel.goals.find(g => g.id === goalId);
    if (!goal) return;
    const step = goal.milestoneSteps[stepIdx];
    if (!step || step.completed) return;

    // XP from template or fall back to step weight
    let pts;
    if (goal.template && goal.difficulty) {
      const totalXP  = calcBaseXP(goal.template, goal.difficulty, goal.category, "milestone");
      const numSteps = goal.milestoneSteps.length;
      pts = numSteps > 0 ? Math.round(totalXP / numSteps) : totalXP;
    } else {
      pts = step.weight || 20;
    }

    const newScores = { ...state.catScores, [goal.category]: (state.catScores[goal.category] || 0) + pts };
    const newRanks  = { ...state.catRanks,  [goal.category]: getRank(newScores[goal.category]) };
    const updSteps  = goal.milestoneSteps.map((s, i) => i === stepIdx ? { ...s, completed: true } : s);
    const allDone   = updSteps.every(s => s.completed);
    const newLevels = state.levels.map(l =>
      l.id === currentLevel.id
        ? { ...l, goals: l.goals.map(g => g.id === goalId ? { ...g, milestoneSteps: updSteps, completed: allDone } : g) }
        : l
    );
    setState(s => ({ ...s, levels: newLevels, catScores: newScores, catRanks: newRanks }));
    notify(allDone ? "Milestone complete!" : `+${pts} XP`);
    if (navigator.vibrate) navigator.vibrate(allDone ? [10, 50, 10] : 10);
  }

  function resistQuitHabit(goalId) {
    const goal = currentLevel.goals.find(g => g.id === goalId);
    if (!goal || goal.type !== "quitHabit") return;
    const tz = resolveTimeZone(state);
    const t = tzToday(tz);
    if (state.lastCompletions[goalId] === t) { notify("Already checked in today"); return; }

    const yStr = tzYesterday(tz);

    const lastSlipped = (goal.succumbLog || []).slice(-1)[0] || null;
    const prevStreak  = goal.currentStreak || 0;
    const prevBest    = goal.bestStreak || 0;

    // Streak continues only if last resist was yesterday AND user didn't slip yesterday
    const streakContinues = goal.lastResistDate === yStr && lastSlipped !== yStr;
    const newStreak = streakContinues ? prevStreak + 1 : 1;
    const newBest   = Math.max(prevBest, newStreak);
    const newRecord = newStreak > prevBest;

    let pts = 0;
    const newScores = { ...state.catScores };
    const newRanks  = { ...state.catRanks };

    if (newRecord) {
      pts = goal.template && goal.difficulty
        ? calcBaseXP(goal.template, goal.difficulty, "Resilience", "habitual")
        : 15;
      newScores.Resilience = Math.max(0, (newScores.Resilience || 0) + pts);
      newRanks.Resilience  = getRank(newScores.Resilience);
    }

    const newLevels = state.levels.map(l =>
      l.id === currentLevel.id
        ? { ...l, goals: l.goals.map(g => g.id === goalId
            ? { ...g, currentStreak: newStreak, bestStreak: newBest, lastResistDate: t, lastCheckedDate: t, resistLog: [...(g.resistLog || []), t] }
            : g) }
        : l
    );

    setState(s => ({
      ...s,
      levels: newLevels,
      catScores: newScores,
      catRanks: newRanks,
      lastCompletions: { ...s.lastCompletions, [goalId]: t },
    }));

    notify(newRecord
      ? `New record! ${newStreak}D streak · +${pts} RES`
      : `Resisted · ${newStreak}D streak`);
    if (navigator.vibrate) navigator.vibrate(10);
  }

  function succumbQuitHabit(goalId) {
    const goal = currentLevel.goals.find(g => g.id === goalId);
    if (!goal || goal.type !== "quitHabit") return;
    const tz = resolveTimeZone(state);
    const t = tzToday(tz);
    if (state.lastCompletions[goalId] === t) { notify("Already checked in today"); return; }

    const newLevels = state.levels.map(l =>
      l.id === currentLevel.id
        ? { ...l, goals: l.goals.map(g => g.id === goalId
            ? { ...g, currentStreak: 0, lastCheckedDate: t, succumbLog: [...(g.succumbLog || []), t] }
            : g) }
        : l
    );

    setState(s => ({
      ...s,
      levels: newLevels,
      lastCompletions: { ...s.lastCompletions, [goalId]: t },
    }));

    notify("Streak reset. Tomorrow is a new day.");
    if (navigator.vibrate) navigator.vibrate([20, 50, 20]);
  }

  function completeWeeklyCheckin(updatedStatements) {
    updLv({ categoryGoals: updatedStatements });
    setState(s => ({ ...s, lastWeeklyCheckin: new Date().toISOString() }));
    notify("Check-in saved");
  }

  function skipWeeklyCheckin() {
    setState(s => ({ ...s, lastWeeklyCheckin: new Date().toISOString() }));
    notify("Skipped — see you next week");
  }

  function enableBoss() {
    const cfg = getGamificationConfig(state);
    updLv({ boss: {
      enabled: true,
      habitCompletionRate: cfg.boss.habitCompletionRate,
      trailingWeeks: cfg.boss.trailingWeeks,
      signatureQuestsRequired: cfg.boss.signatureQuestsRequired,
    } });
    notify("Trial enabled");
  }

  function disableBoss() {
    updLv({ boss: null });
    notify("Trial disabled");
  }

  function advanceLevel() {
    // Arc-active path: enforce the rank dual-gate, archive the completed
    // level to its own subcollection doc, promote rank when the qualifying
    // threshold is hit, and create the next system-named level.
    if (state.arc?.status === "active") {
      const cfg = getGamificationConfig(state);
      const gates = evaluateGates(state, currentLevel, state.rank?.current || "E", cfg);
      if (!gates.canAdvance) {
        notify("Gate not met — keep going");
        return;
      }
      const rankBefore = state.rank || { current: "E", qualifyingLevelsAtRank: 0 };
      const rankAfter  = applyQualifyingLevel(rankBefore, cfg);

      const nextSequenceInArc  = (currentLevel.sequenceInArc || 1) + 1;
      const nextSequenceInRank = rankAfter.promoted ? 1 : (currentLevel.sequenceInRank || 1) + 1;

      const baseNew = mkLevel(state.levels.length + 1);
      const newLv = {
        ...baseNew,
        arcId: state.arc.id,
        rank: rankAfter.current,
        sequenceInRank: nextSequenceInRank,
        sequenceInArc:  nextSequenceInArc,
        displayName: `Level ${nextSequenceInArc}`,
        title: `Level ${nextSequenceInArc}`,
        requiredRank: currentLevel.requiredRank || "A",
      };

      // Archive completed level to a per-level subcollection doc (Layer 2
      // pattern — keeps the root user doc small as arcs accumulate history).
      const completedDoc = {
        arcId: state.arc.id,
        levelId: currentLevel.id,
        displayName: currentLevel.displayName || `Level ${currentLevel.sequenceInArc || 1}`,
        rank: rankBefore.current,
        sequenceInRank: currentLevel.sequenceInRank || 1,
        sequenceInArc:  currentLevel.sequenceInArc  || 1,
        startedAt:   currentLevel.startedAt || null,
        completedAt: Date.now(),
        xpAtCompletion: gates.xp.current,
        // Phase 10: per-dimension catScores at completion, so the
        // identity-portrait can render a delta overlay against a past level.
        catScoresAtCompletion: { ...state.catScores },
        gatesAtCompletion: gates,
        promoted: rankAfter.promoted,
        promotedTo: rankAfter.promoted ? rankAfter.current : null,
      };
      setDoc(doc(db, `users/${user.uid}/levels/${currentLevel.id}`), completedDoc)
        .catch(e => { console.error(e); captureError(e, { where: "archiveCompletedLevel", uid: user.uid }); });

      setState(s => ({
        ...s,
        rank: { current: rankAfter.current, qualifyingLevelsAtRank: rankAfter.qualifyingLevelsAtRank },
        levels: [...s.levels, newLv],
        currentLevelId: newLv.id,
        setupDone: true, // arc mode: per-level wizard is unnecessary
        catScores: Object.fromEntries(CATEGORIES.map(c => [c, 0])),
        catRanks: Object.fromEntries(CATEGORIES.map(c => [c, "E"])),
        streaks: {},
        lastCompletions: {},
        lastHabitDate: null,
        decayAppliedOn: null,
        consecutiveMissed: 0,
      }));
      if (rankAfter.promoted) {
        // Phase 11: the editorial Ascension moment replaces the bare toast
        // for tier-ups. The toast is still useful for plain advances.
        setAscensionTier(getTier(rankAfter.current).name);
      } else {
        notify(`Advanced to ${newLv.displayName}`);
      }
      setView("dashboard");
      return;
    }

    // Legacy path — preserved exactly.
    const newLv = mkLevel(state.levels.length + 1);
    setState(s => ({
      ...s,
      levels: [...s.levels, newLv],
      currentLevelId: newLv.id,
      setupDone: false,
      catScores: Object.fromEntries(CATEGORIES.map(c => [c, 0])),
      catRanks: Object.fromEntries(CATEGORIES.map(c => [c, "E"])),
      streaks: {},
      lastCompletions: {},
      lastHabitDate: null,
      decayAppliedOn: null,
      consecutiveMissed: 0,
    }));
    setView("dashboard");
  }

  // ── Render states ──────────────────────────────────────────────────────────

  // OAuth authorize page is its own world — it doesn't need the user's
  // habit data, just their auth state. Render it directly so we skip the
  // SetupWizard / data-loading paths below.
  const isOAuthAuthorize = typeof window !== "undefined" && window.location.pathname === "/oauth/authorize";
  if (user === undefined) return <Spinner />;
  if (isOAuthAuthorize) {
    return <OAuthAuthorize user={user} onSignIn={handleSignIn} signInError={authError} />;
  }
  if (user === null)      return <LoginScreen onSignIn={handleSignIn} error={authError} />;
  if (loadError && !dataLoading) return (
    <LoadErrorScreen
      onRetry={() => setRefreshKey(k => k + 1)}
      onSignOut={handleSignOut}
    />
  );
  if (dataLoading || !state || !currentLevel) return <Spinner />;

  const overallScore  = getOverallScore(state.catScores, currentLevel.weights);
  const overallRank   = getRank(overallScore);
  const legacyLevelComplete = RANKS.indexOf(overallRank) >= RANKS.indexOf(currentLevel.requiredRank || "A");
  // Opt-in boss gate. With no boss set, bossEval.enabled is false → canAdvance
  // tracks legacyLevelComplete exactly as before. A set boss additionally requires met.
  const bossEval      = evaluateBoss(state, currentLevel, getGamificationConfig(state));
  // When an arc is active, advancement is governed by the rank dual-gate
  // (progression.js) rather than the legacy requiredRank+boss combo. Both
  // bossEval and legacyLevelComplete remain wired for UI back-compat, but the
  // advance button uses arcGates.canAdvance.
  const cfgForArc     = getGamificationConfig(state);
  const arcGates      = state.arc?.status === "active"
    ? evaluateGates(state, currentLevel, state.rank?.current || "E", cfgForArc)
    : null;
  // The arc "view" rolled up for RankHero — pre-computes everything the bar
  // and the big letter need so the component itself can stay dumb.
  const arcView = state.arc?.status === "active" ? {
    rank: state.rank?.current || "E",
    qualifyingLevelsAtRank: state.rank?.qualifyingLevelsAtRank || 0,
    qualifyingToAdvance: cfgForArc.progression.ranks[state.rank?.current || "E"].qualifyingToAdvance,
    levelsToNext: levelsToNextRank(state.rank, cfgForArc),
    nextRank: RANKS[RANKS.indexOf(state.rank?.current || "E") + 1] || null,
    gates: arcGates,
  } : null;
  const levelComplete = arcGates ? arcGates.canAdvance : legacyLevelComplete;
  const canAdvance    = arcGates
    ? arcGates.canAdvance
    : legacyLevelComplete && (!bossEval.enabled || bossEval.met);

  // ── Reactive background props (pre-computed once per render) ────────────
  // ReactiveBackground is presentational — it reads no state itself. We pass
  // already-derived primitives so the component stays decoupled from data.
  const completedQuestsCount = (state.quests || []).filter(q => q.status === "completed").length;
  const completedMilestonesCount = (state.levels || []).reduce(
    (sum, lv) => sum + (lv.goals || []).filter(g => g.type === "milestone" && g.completed === true).length,
    0,
  );
  const maxStreakForBg = Math.max(0, ...Object.values(state.streaks || {}).map(Number).filter(n => Number.isFinite(n)));
  const bgRank = state.rank?.current || overallRank;
  const bgRankWindowWeeks = state.arc?.status === "active"
    ? cfgForArc.progression.ranks[state.rank?.current || "E"]?.windowWeeks
    : undefined;

  if (!state.setupDone) return <SetupWizard level={currentLevel} onFinish={finishSetup} />;

  // Sidebar is now nav-only: settings live in /settings (Phase 7). The
  // sign-out, reset, AI Agent, and BG Motion controls are reached via the
  // profile chip in the sidebar footer → SettingsView.
  const sidebarProps = {
    view, setView,
    levelNum: currentLevel.num,
    overallRank,
    user,
    onSignOut: handleSignOut,
  };

  const pages = (
    <>
      {view === "dashboard" && (
        <Dashboard
          state={state}
          level={currentLevel}
          overallScore={overallScore}
          overallRank={overallRank}
          arcView={arcView}
          levelComplete={levelComplete}
          canAdvance={canAdvance}
          bossEval={bossEval}
          onEnableBoss={enableBoss}
          onDisableBoss={disableBoss}
          onAdvance={advanceLevel}
          onCompleteHabitual={completeHabitual}
          onCompleteMilestoneStep={completeMilestoneStep}
          onResistQuit={resistQuitHabit}
          onSuccumbQuit={succumbQuitHabit}
          onGoToGoals={() => setView("goals")}
          checkinDue={isCheckinDue(state, currentLevel)}
          weeklyVotes={getWeeklyVotes(currentLevel)}
          onCompleteCheckin={completeWeeklyCheckin}
          onSkipCheckin={skipWeeklyCheckin}
          historicalCatScores={historicalCatScores}
        />
      )}
      {view === "goals" && (
        <GoalsView
          level={currentLevel}
          state={state}
          onAddGoal={addGoal}
          onAddGoals={addGoals}
          onDeleteGoal={deleteGoal}
          onEditGoal={editGoal}
          editingGoalId={editingGoalId}
          setEditingGoalId={setEditingGoalId}
          onCompleteHabitual={completeHabitual}
          onCompleteMilestoneStep={completeMilestoneStep}
          onResistQuit={resistQuitHabit}
          onSuccumbQuit={succumbQuitHabit}
          quests={state.quests || []}
          onAddQuest={addQuest}
          onCompleteQuest={completeQuest}
          onDeleteQuest={deleteQuest}
          addOpen={addOpen}
          setAddOpen={setAddOpen}
          addType={addType}
          setAddType={setAddType}
          aiAgentEnabled={state.aiAgentEnabled === true}
        />
      )}
      {view === "reports" && <ReportsView state={state} />}
      {view === "history" && <HistoryView state={state} />}
      {view === "settings" && (
        <SettingsView
          user={user}
          aiAgentEnabled={state.aiAgentEnabled === true}
          onToggleAgent={() => setState(s => ({ ...s, aiAgentEnabled: !s.aiAgentEnabled }))}
          reduceBackgroundMotion={state.reduceBackgroundMotion}
          onToggleReduceMotion={() => setState(s => {
            const cur = s.reduceBackgroundMotion;
            const next = cur === undefined ? true : cur === true ? false : undefined;
            return { ...s, reduceBackgroundMotion: next };
          })}
          onReset={handleReset}
          onSignOut={handleSignOut}
        />
      )}
    </>
  );

  const recentGoal = recentCompletion
    ? currentLevel.goals.find(g => g.id === recentCompletion.goalId)
    : null;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "transparent", color: "var(--text-primary)", fontFamily: "'Geist', -apple-system, sans-serif" }}>
      <ReactiveBackground
        rank={bgRank}
        completedAchievements={completedQuestsCount + completedMilestonesCount}
        thresholdOpen={canAdvance}
        levelStartedAt={currentLevel?.startedAt || 0}
        rankWindowWeeks={bgRankWindowWeeks}
        longestStreak={maxStreakForBg}
        reduceMotion={state.reduceBackgroundMotion}
      />
      {toast && <div className={styles.toast}>{toast}</div>}
      {!online && (
        <div style={{
          position: "fixed", bottom: 14, left: "50%", transform: "translateX(-50%)",
          zIndex: 999, padding: "7px 14px", borderRadius: 999,
          background: "rgba(250,204,21,0.12)", border: "1px solid rgba(250,204,21,0.35)",
          color: "var(--yellow)", fontSize: 11, fontWeight: 600,
          fontFamily: "var(--font-mono)", letterSpacing: "0.04em",
          backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
          boxShadow: "var(--shadow-md)", whiteSpace: "nowrap",
        }}>
          ◍ Offline — completions are saved and will sync when you reconnect
        </div>
      )}
      {recentCompletion && recentGoal && (
        <QuickNotePopup
          key={recentCompletion.ts}
          goalName={recentGoal.name}
          comeback={recentCompletion.comeback === true}
          onSubmit={note => addCompletionNote(recentCompletion.goalId, recentCompletion.ts, note)}
          onClose={() => setRecentCompletion(null)}
        />
      )}
      {ascensionTier && (
        <AscensionMoment
          newTier={ascensionTier}
          reduceMotionPref={state.reduceBackgroundMotion}
          onDone={() => setAscensionTier(null)}
        />
      )}

      {isMobile ? (
        /* ── Mobile: floating menu button + drawer ── */
        <>
          {drawerOpen && (
            <Sidebar {...sidebarProps} isDrawer onClose={() => setDrawerOpen(false)} />
          )}

          {/* Floating hamburger — fixed so it stays visible while scrolling */}
          <button
            onClick={() => setDrawerOpen(true)}
            style={{
              position: "fixed",
              top: 14, left: 14,
              zIndex: 250,
              width: 38, height: 38,
              background: "rgba(8,14,26,0.88)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              color: "var(--text-secondary)",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "var(--shadow-md), 0 0 0 1px rgba(255,255,255,0.04)",
            }}
          >
            <svg width="16" height="12" viewBox="0 0 16 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="16" height="2" rx="1" fill="currentColor"/>
              <rect y="5" width="16" height="2" rx="1" fill="currentColor"/>
              <rect y="10" width="16" height="2" rx="1" fill="currentColor"/>
            </svg>
          </button>

          {/* Level + rank pill next to the button */}
          <div style={{
            position: "fixed",
            top: 14, left: 62,
            zIndex: 250,
            height: 38,
            padding: "0 12px",
            background: "rgba(8,14,26,0.88)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            display: "flex", alignItems: "center", gap: 6,
            boxShadow: "var(--shadow-md), 0 0 0 1px rgba(255,255,255,0.04)",
            pointerEvents: "none",
          }}>
            <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--accent)", letterSpacing: "0.1em", fontWeight: 700 }}>
              {view.toUpperCase()}
            </span>
            <span style={{ width: 1, height: 10, background: "var(--border)" }} />
            <span style={{ fontSize: 9, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}>
              LV.{currentLevel.num} · {overallRank}
            </span>
          </div>

          <main
            style={{ flex: 1, minWidth: 0, overflow: "auto", paddingTop: 66, position: "relative", zIndex: 5 }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {pages}
          </main>
        </>
      ) : (
        /* ── Desktop: sidebar + main + rank panel ── */
        <>
          <Sidebar
            {...sidebarProps}
            collapsed={sidebarCollapsed}
            onToggle={toggleSidebar}
          />
          <main style={{ flex: 1, minWidth: 0, overflow: "auto", position: "relative", zIndex: 5 }}>
            {pages}
          </main>
          <RankPanel overallScore={overallScore} overallRank={overallRank} catScores={state.catScores} catRanks={state.catRanks} />
        </>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <div style={{
        width: 28, height: 28,
        border: "2px solid var(--border)",
        borderTopColor: "var(--accent)",
        borderRadius: "50%",
        animation: "spin 0.7s linear infinite",
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function LoadErrorScreen({ onRetry, onSignOut }) {
  const btn = {
    padding: "8px 18px",
    fontSize: 12,
    borderRadius: 6,
    cursor: "pointer",
    fontFamily: "var(--font-mono)",
    letterSpacing: "0.04em",
  };
  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 18,
      padding: 24,
      color: "var(--text-primary)",
      fontFamily: "'Geist', -apple-system, sans-serif",
      textAlign: "center",
    }}>
      <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
        Couldn't load your data.
      </div>
      <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", maxWidth: 360, lineHeight: 1.5 }}>
        Your progress is safe — nothing will be written until the load succeeds.
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={onRetry}
          style={{ ...btn, background: "var(--accent-dim)", border: "1px solid var(--accent)", color: "var(--accent)" }}
        >Retry</button>
        <button
          onClick={onSignOut}
          style={{ ...btn, background: "transparent", border: "1px solid var(--border)", color: "var(--text-tertiary)" }}
        >Sign out</button>
      </div>
    </div>
  );
}
