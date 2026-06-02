/**
 * SINGLE SOURCE OF TRUTH for the celestial visual layer.
 *
 * Two responsibilities:
 *  1. Map the underlying rank ladder (E…S) to its CELESTIAL TIER identity
 *     (Ember…Supernova). Locked rank colors are unchanged — tiers ride
 *     on top of them, never replace them.
 *  2. Hold every label string + visual tunable for the reactive background,
 *     the rank-mark showpiece, the trial panel, the ascension moment, etc.
 *     Components import strings/tokens from here; nothing in the UI is
 *     hardcoded so renames + retunes never require code edits.
 *
 * Pure module — no React / DOM / Firebase imports — so both the client and
 * the serverless MCP can load it.
 *
 * ── Layer model (the reactive background) ─────────────────────────────────
 *   0  TimeOfDayTint        (CSS)
 *   1  Depth                (CSS)        // formerly "DungeonDepth"
 *   2  TierAura             (CSS)        // formerly "RankAura" — rank-keyed glow
 *   3  Constellation        (canvas)
 *   4  Embers               (canvas)     // formerly "StreakEmbers"
 *   5  ThresholdVignette    (CSS)        // formerly "BossVignette" — gate-state
 *   6  FilmGrain            (CSS, off by default)
 * At Supernova the standard stack is replaced by SupernovaTheme.
 */

// ── Celestial tier identity ────────────────────────────────────────────────
// Names map onto the LOCKED rank colors (constants.js) — DO NOT change colors.
// Each tier exposes both its celestial name (the primary identity in the UI)
// and the underlying rank letter (kept as a small secondary mark on the
// glowing rank-mark showpiece).
export const TIER_BY_RANK = {
  E: { rank: "E", name: "Ember",     color: "#64748B" }, // deep slate
  D: { rank: "D", name: "Spark",     color: "#22C55E" }, // jewel emerald
  C: { rank: "C", name: "Flare",     color: "#3B82F6" }, // royal blue
  B: { rank: "B", name: "Star",      color: "#60A5FA" }, // sapphire
  A: { rank: "A", name: "Nova",      color: "#F59E0B" }, // molten amber
  S: { rank: "S", name: "Supernova", color: "#EF4444" }, // crimson — see monarch→supernova theme
};

// Resolve a rank string to its tier. Falls back to Ember (E) so a corrupted
// rank value can never leave the UI without a tier identity.
export function getTier(rank) {
  return TIER_BY_RANK[rank] || TIER_BY_RANK.E;
}

// ── User-facing labels (de-identified vocabulary) ─────────────────────────
// Every string the user reads that refers to a tier, the trial, the threshold,
// or the rank-up moment should come from here — NEVER hardcoded inside a JSX
// component. That way a copy revision is one config edit.
export const LABELS = {
  // The "boss challenge" → "trial" rename. Threshold = the gate (level
  // advancement). Trial = the opt-in composite goal that gates it.
  trial: {
    name:         "Trial",
    off:          "TRIAL · OFF",
    cleared:      "TRIAL · CLEARED",
    inProgress:   "TRIAL · IN PROGRESS",
    passedNote:   "Trial passed — the threshold opens.",
    pendingNote:  "Meet both criteria to open the threshold.",
    enableTitle:  "Enable Trial",
    disableTitle: "Disable",
    locked:       "Trial locked",
    lockedNote:   "Pass the trial to advance",
    sigDescription: "Defines what advancement looks like — counts toward this level's trial.",
    description:  "Optionally place a Trial at this level's threshold: sustained habit consistency plus a signature quest.",
  },
  threshold: {
    name:         "Threshold",
    open:         "Threshold open",
  },
  // Identity-becoming voice for empty states / hero moments. The new-user
  // fresh-arc dashboard uses these.
  emptyState: {
    constellationHero: "Your first step lights the sky.",
    radarBaseline:     "Your baseline — return to see how far you've grown.",
    portraitWaiting:   "Complete habits to see your portrait take shape.",
  },
};

export const THEME_CONFIG = {
  // ── Layer 2: TierAura ─────────────────────────────────────────────────────
  // Per-tier radial-glow at top-center. Colors are deep shades of each tier's
  // identity hue — NOT the small-letter color above. Opacity climbs E→A so
  // higher tiers feel more present without being louder in hue. Supernova
  // gets a full theme (see supernova block below) — do NOT add an S entry.
  rankAura: {
    E: { color: "#334155", opacity: 0.10, radiusPct: 55, breatheAmplitude: 0.02  },
    D: { color: "#15803D", opacity: 0.14, radiusPct: 60, breatheAmplitude: 0.025 },
    C: { color: "#1D4ED8", opacity: 0.18, radiusPct: 65, breatheAmplitude: 0.03  },
    B: { color: "#2563EB", opacity: 0.22, radiusPct: 70, breatheAmplitude: 0.035 },
    A: { color: "#B45309", opacity: 0.25, radiusPct: 75, breatheAmplitude: 0.04  },
    crossfadeMs: 2000,
    breatheMs:   6000,
  },

  // ── Layer 3: Constellation ────────────────────────────────────────────────
  // Deterministic — same seed gives the same star field every session.
  // Lit count = completed quests + milestones, capped at totalStars.
  constellation: {
    seed:             0xC0FFEE,
    totalStars:       120,
    dormantOpacity:   0.05,
    flareDurationMs:  1200,
    skyYMaxPct:       0.70,
    starRadiusPx:     { min: 0.6, max: 1.7 },
    litColor:         "#E2E8F0",
    dormantColor:     "#94A3B8",
  },

  // ── Layer 4: Embers (streak-fed motes) ────────────────────────────────────
  // Particle cap rises with the longest active streak. Hard ceiling caps the
  // pool size regardless of bucket values.
  embers: {
    streakBuckets: [
      { min: 30, count: 18 },
      { min: 14, count: 8  },
      { min: 7,  count: 4  },
      { min: 1,  count: 2  },
      { min: 0,  count: 0  },
    ],
    maxParticles:    24,
    riseDistancePx:  100,
    horizontalWobblePx: 18,
    // Doubled from 2800/4200 — particles now drift up at ≈half speed, with
    // proportionally slower wobble (Embers.jsx ties wobble phase to age/1000),
    // so the bottom of the screen reads as a quiet warm glow, not a flicker.
    lifetimeMs:      { min: 5600, max: 8400 },
    colors: ["#FBBF24", "#F59E0B", "#EA580C"],
  },

  // ── Layer 5: ThresholdVignette (level-gate state) ─────────────────────────
  // - threshold open (gates met) → gold, slow pulse
  // - overdue (past target)      → red, opacity scales with overdueness
  // - on-pace                    → ~zero opacity
  vignette: {
    overdueRedMax: "rgba(200,75,75,0.12)",
    readyGold:     "rgba(212,165,83,0.15)",
    pulseMs:       4000,
    // Fallback target when no arc-rank window is supplied.
    fallbackTargetDays: 30,
  },

  // ── Layer 0: TimeOfDayTint ────────────────────────────────────────────────
  timeOfDay: [
    { hour: 0,  tint: "#0C1024" },
    { hour: 5,  tint: "#0D1530" },
    { hour: 7,  tint: "#10182C" },
    { hour: 12, tint: "#0E1422" },
    { hour: 17, tint: "#1A1410" },
    { hour: 20, tint: "#100C20" },
    { hour: 23, tint: "#0C1024" },
  ],
  timeOfDay_recomputeMs: 15 * 60 * 1000,

  // ── Layer 6 (optional): FilmGrain ─────────────────────────────────────────
  filmGrain: { enabled: false, opacity: 0.025 },

  // ── Supernova theme (the S-rank full-takeover, formerly Monarch) ──────────
  // Crimson/gold visual is intentional and unchanged from the original
  // "throne" treatment — only the name moved to "Supernova". The void is the
  // point; the corona is the burn.
  supernova: {
    base:            "#040405",
    coronaCrimson:   "rgba(220, 38, 38, 0.30)",
    coronaGold:      "rgba(232, 197, 106, 0.06)",
    coronaRadiusPct: 70,
    shaftColor:      "rgba(232, 197, 106, 0.08)",
    shaftWidthPct:   22,
    vignetteGold:    "rgba(212, 165, 83, 0.08)",
    moteColor:       "#E8C56A",
    moteCount:       6,
    moteLifetimeMs:  { min: 4500, max: 6500 },
    moteRisePx:      130,
    breatheMs:       7000,
    shaftMs:         8000,
    serifFontStack:  '"Cormorant Garamond", "EB Garamond", Georgia, serif',
  },

  // ── Phase 2: softened the "system-window" read ────────────────────────────
  // Multiplier on every glow/shadow aura color's alpha. Phase 2 set this to
  // ~0.55 so cards stop reading as a sci-fi system overlay. The actual
  // shadow values now live in styles.module.css as already-multiplied
  // rgba() — the multiplier here is a tuning *record*, not a runtime
  // attenuator (CSS Modules can't read JS values without CSS-variable
  // plumbing). To re-tune: update this number AND the matching CSS values.
  glow: {
    panelAuraAlphaMultiplier: 0.55,
  },

  // ── Phase 3: panel border token (applied, revised) ────────────────────────
  // Soft-white hairline used across all panels. Reads consistently against
  // the time-of-day tint AND the Supernova void. First pass at 0.06 was
  // too faint (panels visually disappeared into the bg); 0.12 restores
  // card contrast while keeping the soft-white character. Runtime value
  // lives in index.css as `--border` so every `border: 1px solid var(--border)`
  // callsite picks it up.
  panel: {
    border: "rgba(255, 255, 255, 0.12)",
  },

  // ── Phase 8: nav icon set sizing ──────────────────────────────────────────
  navIcons: {
    sidebarPx:   16,
    sidebarCollapsedPx: 18,
    bottomNavPx: 20,
  },

  // ── Phase 10: identity portrait over time ─────────────────────────────────
  // How far back the radar delta overlay compares against. 3 = the level
  // completed 3 levels before the current one.
  radarHistory: {
    levelsBack: 3,
  },

  // ── Phase 11: ascension moment ────────────────────────────────────────────
  // Fires once per tier-up; skippable; reduced-motion swaps the bloom for a
  // static resolve. Per-tier copy below — never write tier copy in JSX.
  // Supernova has its own dedicated treatment (crimson/gold serif resolve)
  // and skips the standard tier bloom.
  ascension: {
    durationMs: 3000,
    perTierCopy: {
      Spark:     "You've become someone who shows up.",
      Flare:     "Steadiness is now a familiar shape.",
      Star:      "You move with your own gravity.",
      Nova:      "What you do reaches farther than you.",
      Supernova: "There is light in here. Let it spill.",
    },
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

// RGB interpolation between two hex colors. HSL hue lerp routes through the
// wheel — for near-black low-saturation tints that produces ugly midpoints
// (e.g. blue → amber through magenta). Channel-wise RGB lerp avoids it.
function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}
function rgbToCss(r, g, b) {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

export function resolveTimeOfDayTint(hourFloat, table = THEME_CONFIG.timeOfDay) {
  if (!table.length) return "#080E1A";
  const h = ((hourFloat % 24) + 24) % 24;
  for (let i = 0; i < table.length; i++) {
    const k0 = table[i];
    const k1 = table[(i + 1) % table.length];
    const a = k0.hour;
    let b = k1.hour;
    if (b <= a) b += 24;
    const x = h < a ? h + 24 : h;
    if (x >= a && x <= b) {
      const t = (b === a) ? 0 : (x - a) / (b - a);
      const [r0, g0, b0] = hexToRgb(k0.tint);
      const [r1, g1, b1] = hexToRgb(k1.tint);
      return rgbToCss(
        r0 + (r1 - r0) * t,
        g0 + (g1 - g0) * t,
        b0 + (b1 - b0) * t,
      );
    }
  }
  return table[0].tint;
}

// Streak → ember-particle count, descending-min match.
export function embersForStreak(streak, cfg = THEME_CONFIG.embers) {
  for (const b of cfg.streakBuckets) if (streak >= b.min) return Math.min(b.count, cfg.maxParticles);
  return 0;
}

// Convenience: clamp lit-star count to the configured field size.
export function litStarIndices(litCount, totalStars) {
  return Math.max(0, Math.min(litCount, totalStars));
}
