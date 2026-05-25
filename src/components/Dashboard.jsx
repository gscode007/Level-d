import { useState } from "react";
import { CATEGORIES } from "../constants";
import { S } from "../styles";
import { useIsMobile } from "../hooks/useIsMobile";
import RankHero from "./RankHero";
import HabitsPanel from "./HabitsPanel";
import CatCard from "./CatCard";
import CategoryModal from "./CategoryModal";

export default function Dashboard({
  state, level, overallScore, overallRank,
  levelComplete, onAdvance, onCompleteHabitual, onCompleteMilestoneStep,
  onResistQuit, onSuccumbQuit, onGoToGoals,
}) {
  const isMobile = useIsMobile();
  const [selectedCat, setSelectedCat] = useState(null);

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

      <RankHero
        overallScore={overallScore}
        overallRank={overallRank}
        level={level}
        state={state}
        levelComplete={levelComplete}
        onAdvance={onAdvance}
      />

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
    </div>
  );
}
