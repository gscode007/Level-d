export const CATEGORIES = ["Emotional", "Intellectual", "Physical", "Creational", "Self-Care", "Resilience"];

// Resilience is auto-managed — users define goals only for these five
export const USER_CATEGORIES = ["Emotional", "Intellectual", "Physical", "Creational", "Self-Care"];

export const CAT_META = {
  Emotional:    { symbol: "♡", accent: "#F87171" },
  Intellectual: { symbol: "◇", accent: "#60A5FA" },
  Physical:     { symbol: "△", accent: "#34D399" },
  Creational:   { symbol: "✦", accent: "#FBBF24" },
  "Self-Care":  { symbol: "✿", accent: "#2DD4BF" },
  Resilience:   { symbol: "○", accent: "#A78BFA" },
};

export const RANKS = ["E", "D", "C", "B", "A", "S"];

// Each tier is ~2.5–3x harder than the previous — S requires sustained long-term effort
export const RANK_THRESHOLDS = { E: 0, D: 200, C: 600, B: 1500, A: 3500, S: 8000 };

export const RANK_COLOR = {
  E: "#64748B",
  D: "#22C55E",
  C: "#3B82F6",
  B: "#60A5FA",
  A: "#F59E0B",
  S: "#EF4444",
};

// ── XP Template System ───────────────────────────────────────────────────────
export const HABIT_TEMPLATES = { Basic: 5, Standard: 10, Intensive: 18, Precision: 12 };
export const MILESTONE_TEMPLATES = { Completion: 30, Consistency: 40, Performance: 60, Control: 70, Transformation: 120 };
export const DIFFICULTY_MULTIPLIER = { Easy: 1, Medium: 1.5, Hard: 2 };
export const CATEGORY_MODIFIER = { Emotional: 1.2, Intellectual: 1.0, Physical: 1.0, Creational: 1.3, "Self-Care": 1.1, Resilience: 1.25 };

export const DAILY_XP_CAP = 60; // per category per day

// Goals added during a level's initial setup are editable for this long
export const INITIAL_EDIT_WINDOW_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

export const FREQUENCY_OPTIONS = [
  { label: "Daily",   value: 7 },
  { label: "6×/wk",  value: 6 },
  { label: "5×/wk",  value: 5 },
  { label: "4×/wk",  value: 4 },
  { label: "3×/wk",  value: 3 },
  { label: "2×/wk",  value: 2 },
];

// Smart default templates per category
export const SMART_TEMPLATE = {
  Emotional:    { habitual: "Precision",  milestone: "Control" },
  Physical:     { habitual: "Intensive",  milestone: "Performance" },
  Intellectual: { habitual: "Standard",   milestone: "Completion" },
  Creational:   { habitual: "Intensive",  milestone: "Transformation" },
  "Self-Care":  { habitual: "Standard",   milestone: "Consistency" },
  Resilience:   { habitual: "Standard",   milestone: "Consistency" },
};
