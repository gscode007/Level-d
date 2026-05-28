import { useState } from "react";
import { CATEGORIES } from "../constants";
import { S } from "../styles";
import { useIsMobile } from "../hooks/useIsMobile";
import RankHero from "./RankHero";
import IdentityPortrait from "./IdentityPortrait";
import HabitsPanel from "./HabitsPanel";
import CatCard from "./CatCard";
import CategoryModal from "./CategoryModal";
import WeeklyCheckin from "./WeeklyCheckin";
import BossChallenge from "./BossChallenge";

export default function Dashboard({
  state, level, overallScore, overallRank,
  levelComplete, canAdvance, bossEval, onEnableBoss, onDisableBoss,
  onAdvance, onCompleteHabitual, onCompleteMilestoneStep,
  onResistQuit, onSuccumbQuit, onGoToGoals,
  checkinDue, weeklyVotes, onCompleteCheckin, onSkipCheckin,
}) {
  const isMobile = useIsMobile();
  const [selectedCat, setSelectedCat] = useState(null);
  const [checkinOpen, setCheckinOpen] = useState(false);

  const catCardProps = (cat) => ({
    cat,
    score:     state.catScores[cat] || 0,
    rank:      state.catRanks[cat]  || "E",
    weight:    level.weights?.[cat] || 0,
    statement: level.categoryGoals?.[cat] || "",
    onClick: () => setSelectedCat(cat),
  });

  return (
    <div style={{
      padding: isMobile ? "20px 14px 24px" : "36px 44px 72px",
      maxWidth: isMobile ? "none" : 1200,
    }}>
      {/* Header */}
      <header style={{ marginBottom: isMobile ? 14 : 20 }}>
        <p style={S.eyebrow}>Level {level.num} · Becoming</p>
        <h1 style={{ ...S.pageH1, fontSize: isMobile ? 24 : 30 }}>
          {level.title || "Becoming"}
        </h1>
      </header>

      {checkinDue && (
        <button
          onClick={() => setCheckinOpen(true)}
          style={{
            width: "100%",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 12,
            padding: isMobile ? "12px 14px" : "14px 18px",
            marginBottom: 10,
            background: "rgba(250,204,21,0.06)",
            border: "1px solid rgba(250,204,21,0.25)",
            borderLeft: "2px solid var(--yellow)",
            borderRadius: 8,
            cursor: "pointer",
            textAlign: "left",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(250,204,21,0.1)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(250,204,21,0.06)"; }}
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

      <RankHero
        overallScore={overallScore}
        overallRank={overallRank}
        level={level}
        state={state}
        levelComplete={levelComplete}
        canAdvance={canAdvance}
        bossBlocked={levelComplete && !canAdvance}
        onAdvance={onAdvance}
      />

      {/* Boss challenge surfaces once the rank target is reached (opt-in gate). */}
      {(levelComplete || bossEval?.enabled) && (
        <BossChallenge
          bossEval={bossEval}
          onEnableBoss={onEnableBoss}
          onDisableBoss={onDisableBoss}
        />
      )}

      <IdentityPortrait level={level} state={state} />

      {isMobile ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <HabitsPanel
            level={level}
            state={state}
            onCompleteHabitual={onCompleteHabitual}
            onResistQuit={onResistQuit}
            onSuccumbQuit={onSuccumbQuit}
            onGoToGoals={onGoToGoals}
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
            {CATEGORIES.map(cat => <CatCard key={cat} {...catCardProps(cat)} />)}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ width: 290, flexShrink: 0 }}>
            <HabitsPanel
              level={level}
              state={state}
              onCompleteHabitual={onCompleteHabitual}
              onResistQuit={onResistQuit}
              onSuccumbQuit={onSuccumbQuit}
              onGoToGoals={onGoToGoals}
            />
          </div>
          <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, alignContent: "start" }}>
            {CATEGORIES.map(cat => <CatCard key={cat} {...catCardProps(cat)} />)}
          </div>
        </div>
      )}

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
