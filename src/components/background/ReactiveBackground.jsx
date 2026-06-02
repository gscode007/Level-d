import { useEffect } from "react";
import "./background.css";
import { useReducedMotion } from "./hooks/useReducedMotion.js";
import TimeOfDayTint from "./TimeOfDayTint.jsx";
import Depth from "./Depth.jsx";
import TierAura from "./TierAura.jsx";
import Constellation from "./Constellation.jsx";
import Embers from "./Embers.jsx";
import ThresholdVignette from "./ThresholdVignette.jsx";
import FilmGrain from "./FilmGrain.jsx";
import SupernovaTheme from "./supernova/SupernovaTheme.jsx";

/**
 * Root of the celestial reactive background. Mounted ONCE next to the App
 * root div. Reads no global state; everything comes through props the
 * caller already derives.
 *
 *   rank                  — current tier letter (E/D/C/B/A/S)
 *   completedAchievements — completed quests + milestones (history-aware)
 *   thresholdOpen         — gates passed; show gold ready vignette
 *   levelStartedAt        — epoch ms when current level began
 *   rankWindowWeeks       — arc rank's trailing-window weeks (gates overdueness)
 *   longestStreak         — max active streak across habits
 *   reduceMotion          — user override; undefined = follow OS pref
 *
 * At Supernova the layered stack swaps to a dedicated theme. Within either
 * branch, reduced-motion suppresses only motion — color and presence
 * (aura, vignette, corona) persist.
 */
export default function ReactiveBackground({
  rank = "E",
  completedAchievements = 0,
  thresholdOpen = false,
  levelStartedAt = 0,
  rankWindowWeeks,
  longestStreak = 0,
  reduceMotion: reduceMotionPref,
}) {
  const reduceMotion = useReducedMotion(reduceMotionPref);

  useEffect(() => {
    document.body.classList.add("has-reactive-bg");
    if (rank === "S") document.body.classList.add("theme-supernova");
    return () => {
      document.body.classList.remove("has-reactive-bg");
      document.body.classList.remove("theme-supernova");
    };
  }, [rank]);

  const targetMs = rankWindowWeeks ? rankWindowWeeks * 7 * 24 * 60 * 60 * 1000 : 0;

  if (rank === "S") {
    return <SupernovaTheme reduceMotion={reduceMotion} />;
  }

  return (
    <>
      <TimeOfDayTint />
      <Depth />
      <TierAura rank={rank} reduceMotion={reduceMotion} />
      <Constellation completedAchievements={completedAchievements} reduceMotion={reduceMotion} />
      <Embers longestStreak={longestStreak} reduceMotion={reduceMotion} />
      <ThresholdVignette
        thresholdOpen={thresholdOpen}
        levelStartedAt={levelStartedAt}
        targetMs={targetMs}
        reduceMotion={reduceMotion}
      />
      <FilmGrain reduceMotion={reduceMotion} />
    </>
  );
}
