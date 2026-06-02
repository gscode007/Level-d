import { useState, useRef } from "react";
import { CATEGORIES } from "../constants";
import styles from "../styles.module.css";
import { useIsMobile } from "../hooks/useIsMobile";
import SlimRankHeader from "./SlimRankHeader";
import RankHero from "./RankHero";
import IdentityPortrait from "./IdentityPortrait";
import HabitsPanel from "./HabitsPanel";
import CatCard from "./CatCard";
import CategoryModal from "./CategoryModal";
import WeeklyCheckin from "./WeeklyCheckin";
import TrialPanel from "./TrialPanel";
import FreshArcHero from "./FreshArcHero";
import ArcTrajectory from "./ArcTrajectory";

/**
 * Dashboard — restructured (Phase 4) into two zones:
 *
 *   TODAY        habits + the slim rank header — the DAILY GAME
 *   BECOMING     identity + trial + full rank detail — the LONG LOOP
 *
 * Mobile-first: Today's first habit checkbox sits above the fold at 375 px.
 * On desktop the same vertical zoning applies; the Today zone is wider /
 * looser but always comes first.
 */
export default function Dashboard({
  state, level, overallScore, overallRank, arcView,
  levelComplete, canAdvance, bossEval, onEnableBoss, onDisableBoss,
  onAdvance, onCompleteHabitual, onCompleteMilestoneStep,
  onResistQuit, onSuccumbQuit, onGoToGoals,
  checkinDue, weeklyVotes, onCompleteCheckin, onSkipCheckin,
  historicalCatScores,
}) {
  const isMobile = useIsMobile();
  const [selectedCat, setSelectedCat] = useState(null);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const becomingRef = useRef(null);

  const catCardProps = (cat) => ({
    cat,
    score:     state.catScores[cat] || 0,
    rank:      state.catRanks[cat]  || "E",
    weight:    level.weights?.[cat] || 0,
    statement: level.categoryGoals?.[cat] || "",
    onClick: () => setSelectedCat(cat),
  });

  const headlineRank = arcView ? arcView.rank : overallRank;
  function scrollToBecoming() {
    becomingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Phase 9: fresh-arc detection — new user on Level 1 with no habits and
  // no completions yet. Renders the constellation hero in place of the
  // habits panel until they define their first habit.
  const habits = (level.goals || []).filter(g => g.type === "habitual");
  const totalCompletions = (level.goals || []).reduce(
    (n, g) => n + (g.completions?.length || 0), 0,
  );
  const isFreshArc =
    state.arc?.status === "active" &&
    habits.length === 0 &&
    totalCompletions === 0;

  return (
    <div style={{
      padding: isMobile ? "20px 14px 24px" : "36px 44px 72px",
      maxWidth: isMobile ? "none" : 1200,
    }}>
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header style={{ marginBottom: isMobile ? 10 : 14 }}>
        {state.arc?.status === "active" ? (
          <>
            <p className={styles.eyebrow}>
              {level.displayName || `Level ${level.sequenceInArc || level.num}`}
              {" · Tier "}{state.rank?.current || "E"}
            </p>
            <h1 className={styles.pageH1} style={{ fontSize: isMobile ? 22 : 28 }}>
              {state.arc.goal || "Arc"}
            </h1>
          </>
        ) : (
          <>
            <p className={styles.eyebrow}>Level {level.num} · Becoming</p>
            <h1 className={styles.pageH1} style={{ fontSize: isMobile ? 22 : 28 }}>
              {level.title || "Becoming"}
            </h1>
          </>
        )}
      </header>

      {/* Weekly check-in nudge */}
      {checkinDue && (
        <button
          onClick={() => setCheckinOpen(true)}
          style={{
            width: "100%",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 12,
            padding: isMobile ? "10px 14px" : "12px 18px",
            marginBottom: 10,
            background: "rgba(250,204,21,0.06)",
            border: "1px solid rgba(250,204,21,0.25)",
            borderLeft: "2px solid var(--yellow)",
            borderRadius: 8,
            cursor: "pointer",
            textAlign: "left",
            transition: "all 0.15s",
          }}
        >
          <div>
            <div style={{
              fontSize: 10, fontWeight: 700, color: "var(--yellow)",
              fontFamily: "var(--font-mono)", letterSpacing: "0.1em",
              marginBottom: 3,
            }}>
              ◇ WEEKLY CHECK-IN READY
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.4 }}>
              See where your behavior matched (or didn't) your identity claims this week.
            </div>
          </div>
          <span style={{
            fontSize: 11, color: "var(--yellow)", fontFamily: "var(--font-mono)",
            letterSpacing: "0.06em", fontWeight: 700, flexShrink: 0,
          }}>OPEN →</span>
        </button>
      )}

      {/* ── TODAY ZONE ────────────────────────────────────────────────────── */}
      <SlimRankHeader
        rank={headlineRank}
        arcView={arcView}
        overallScore={overallScore}
        canAdvance={canAdvance}
        onAdvance={onAdvance}
        onExpand={scrollToBecoming}
      />

      {isFreshArc ? (
        <FreshArcHero
          arcGoal={state.arc?.goal}
          onAddHabit={onGoToGoals}
          reduceMotionPref={state.reduceBackgroundMotion}
        />
      ) : (
        <HabitsPanel
          level={level}
          state={state}
          onCompleteHabitual={onCompleteHabitual}
          onResistQuit={onResistQuit}
          onSuccumbQuit={onSuccumbQuit}
          onGoToGoals={onGoToGoals}
        />
      )}

      {/* ── Zone divider ──────────────────────────────────────────────────── */}
      <div
        ref={becomingRef}
        style={{
          display: "flex", alignItems: "center", gap: 14,
          margin: isMobile ? "26px 0 14px" : "34px 0 18px",
        }}
      >
        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        <span style={{
          fontSize: 11, fontFamily: "'Instrument Serif', Georgia, serif",
          fontStyle: "italic", color: "var(--text-tertiary)",
          letterSpacing: "0.06em",
        }}>
          Becoming
        </span>
        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
      </div>

      {/* ── BECOMING ZONE ─────────────────────────────────────────────────── */}
      {state.arc?.status === "active" && (
        <ArcTrajectory
          arc={state.arc}
          currentLevel={level}
          tierRank={state.rank?.current || overallRank}
        />
      )}

      <IdentityPortrait level={level} state={state} historicalCatScores={historicalCatScores} />

      {(levelComplete || bossEval?.enabled) && (
        <TrialPanel
          bossEval={bossEval}
          onEnableBoss={onEnableBoss}
          onDisableBoss={onDisableBoss}
        />
      )}

      <RankHero
        overallScore={overallScore}
        overallRank={overallRank}
        arcView={arcView}
        level={level}
        state={state}
        levelComplete={levelComplete}
        canAdvance={canAdvance}
        bossBlocked={levelComplete && !canAdvance}
        onAdvance={onAdvance}
      />

      {/* Per-dimension cards — long-loop scoreboard */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(3, 1fr)",
        gap: 8,
        marginTop: 10,
      }}>
        {CATEGORIES.map(cat => <CatCard key={cat} {...catCardProps(cat)} />)}
      </div>

      {selectedCat && (
        <CategoryModal
          cat={selectedCat}
          score={state.catScores[selectedCat] || 0}
          rank={state.catRanks[selectedCat] || "E"}
          weight={level.weights?.[selectedCat] || 0}
          level={level}
          state={state}
          onClose={() => setSelectedCat(null)}
          onCompleteHabitual={(id) => { onCompleteHabitual(id); }}
          onCompleteMilestoneStep={(id, i) => { onCompleteMilestoneStep(id, i); }}
        />
      )}

      {checkinOpen && (
        <WeeklyCheckin
          level={level}
          weeklyVotes={weeklyVotes}
          onSubmit={(updated) => { onCompleteCheckin(updated); setCheckinOpen(false); }}
          onSkip={() => { onSkipCheckin(); setCheckinOpen(false); }}
          onClose={() => setCheckinOpen(false)}
        />
      )}
    </div>
  );
}
