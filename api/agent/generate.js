/**
 * Vercel serverless function — POST /api/agent/generate
 *
 * Calls Claude Haiku with the user's chapter title and identity statements,
 * returns suggested habits / milestones / quit habits as structured JSON.
 *
 * Required env var (set in Vercel project settings):
 *   ANTHROPIC_API_KEY
 *
 * No auth or rate-limit yet — fine for a personal app; add both before
 * exposing this to untrusted users.
 */

const USER_CATEGORIES   = ["Emotional", "Intellectual", "Physical", "Creational", "Self-Care"];
const HABIT_TEMPLATES   = ["Basic", "Standard", "Intensive", "Precision"];
const MILESTONE_TEMPLATES = ["Completion", "Consistency", "Performance", "Control", "Transformation"];
const DIFFICULTIES      = ["Easy", "Medium", "Hard"];
const FREQUENCIES       = [2, 3, 4, 5, 6, 7];

const MODEL = "claude-haiku-4-5-20251001";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "ANTHROPIC_API_KEY is not set in Vercel env vars. Run `vercel env add ANTHROPIC_API_KEY` and redeploy.",
    });
  }

  const { chapterTitle = "", categoryGoals = {}, existingGoalNames = [] } = req.body || {};

  // Compact the identity statements so the prompt is short and signal-dense
  const identities = USER_CATEGORIES
    .map((c) => `- ${c}: ${(categoryGoals[c] || "").trim() || "(not set)"}`)
    .join("\n");

  const existingList = existingGoalNames.length
    ? existingGoalNames.map((n) => `- ${n}`).join("\n")
    : "(none — this is a fresh chapter)";

  const systemPrompt = [
    "You suggest goals for Level-d, an identity-based habit-tracking app.",
    "",
    "Level-d's model:",
    "- Each user is in a 'chapter' (a season of their life) with 5 life dimensions:",
    "  Emotional, Intellectual, Physical, Creational, Self-Care.",
    "- For each dimension, the user has written an *identity statement*",
    "  (e.g. 'becoming a daily reader'). Goals should be concrete evidence for these identities.",
    "- Three goal types:",
    "  * habits: small daily/weekly actions that earn XP per completion",
    "  * milestones: larger one-time objectives broken into 2-6 steps",
    "  * quitHabits: things the user is trying to stop doing (no daily category)",
    "",
    "Your job: given the chapter title and identity statements, suggest a balanced",
    "starter set of goals. Cover multiple dimensions. Bias toward concrete, observable,",
    "single-rep actions over abstract goals. Names must be short (under 8 words).",
    "Do not propose goals that duplicate existing ones.",
    "",
    "Respond with a single JSON object only. No prose, no markdown fences, no explanation.",
    "Schema:",
    "{",
    '  "habits": [',
    '    { "name": str, "category": one of ' + JSON.stringify(USER_CATEGORIES) + ',',
    '      "template": one of ' + JSON.stringify(HABIT_TEMPLATES) + ',',
    '      "difficulty": one of ' + JSON.stringify(DIFFICULTIES) + ',',
    '      "frequency": one of ' + JSON.stringify(FREQUENCIES) + ' }',
    "  ],",
    '  "milestones": [',
    '    { "name": str, "category": one of ' + JSON.stringify(USER_CATEGORIES) + ',',
    '      "template": one of ' + JSON.stringify(MILESTONE_TEMPLATES) + ',',
    '      "difficulty": one of ' + JSON.stringify(DIFFICULTIES) + ',',
    '      "steps": [str, str, ...]  // 2-6 entries, each under 10 words',
    "    }",
    "  ],",
    '  "quitHabits": [',
    '    { "name": str, "template": one of ' + JSON.stringify(HABIT_TEMPLATES) + ',',
    '      "difficulty": one of ' + JSON.stringify(DIFFICULTIES) + ' }',
    "  ]",
    "}",
    "",
    "Quantities: 3-5 habits, 1-3 milestones, 0-2 quitHabits.",
    "If an identity statement is missing or vague, infer reasonable goals from the chapter title.",
  ].join("\n");

  const userPrompt = [
    `Chapter title: ${chapterTitle || "(untitled)"}`,
    "",
    "Identity statements:",
    identities,
    "",
    "Existing goals (do not duplicate):",
    existingList,
  ].join("\n");

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!r.ok) {
      const errBody = await r.text();
      return res.status(502).json({ error: `Claude API error ${r.status}`, detail: errBody });
    }

    const data = await r.json();
    const text = data?.content?.[0]?.text || "";

    const suggestions = parseClaudeJson(text);
    if (!suggestions) {
      return res.status(502).json({
        error: "Could not parse JSON from Claude response",
        raw: text,
      });
    }

    const cleaned = sanitize(suggestions);
    return res.status(200).json(cleaned);
  } catch (e) {
    return res.status(500).json({ error: "Agent request failed", detail: String(e) });
  }
}

// Claude sometimes wraps JSON in ```json fences despite instructions; strip them.
function parseClaudeJson(text) {
  let body = text.trim();
  const fence = body.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) body = fence[1].trim();
  try { return JSON.parse(body); } catch { return null; }
}

// Drop any items with values outside our enum constraints — defensive against
// model hallucinations slipping through the schema.
function sanitize(s) {
  const out = { habits: [], milestones: [], quitHabits: [] };
  const oneOf = (set, v) => set.includes(v);

  for (const h of Array.isArray(s.habits) ? s.habits : []) {
    if (!h?.name || typeof h.name !== "string") continue;
    if (!oneOf(USER_CATEGORIES, h.category)) continue;
    if (!oneOf(HABIT_TEMPLATES, h.template)) continue;
    if (!oneOf(DIFFICULTIES, h.difficulty)) continue;
    if (!oneOf(FREQUENCIES, Number(h.frequency))) continue;
    out.habits.push({
      name: h.name.trim().slice(0, 80),
      category: h.category,
      template: h.template,
      difficulty: h.difficulty,
      frequency: Number(h.frequency),
    });
  }

  for (const m of Array.isArray(s.milestones) ? s.milestones : []) {
    if (!m?.name || typeof m.name !== "string") continue;
    if (!oneOf(USER_CATEGORIES, m.category)) continue;
    if (!oneOf(MILESTONE_TEMPLATES, m.template)) continue;
    if (!oneOf(DIFFICULTIES, m.difficulty)) continue;
    const steps = (Array.isArray(m.steps) ? m.steps : [])
      .filter((x) => typeof x === "string" && x.trim())
      .map((x) => x.trim().slice(0, 80))
      .slice(0, 6);
    if (steps.length < 2) continue;
    out.milestones.push({
      name: m.name.trim().slice(0, 80),
      category: m.category,
      template: m.template,
      difficulty: m.difficulty,
      steps,
    });
  }

  for (const q of Array.isArray(s.quitHabits) ? s.quitHabits : []) {
    if (!q?.name || typeof q.name !== "string") continue;
    if (!oneOf(HABIT_TEMPLATES, q.template)) continue;
    if (!oneOf(DIFFICULTIES, q.difficulty)) continue;
    out.quitHabits.push({
      name: q.name.trim().slice(0, 80),
      template: q.template,
      difficulty: q.difficulty,
    });
  }

  return out;
}
