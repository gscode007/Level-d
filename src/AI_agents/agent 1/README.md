# Leveld Agent — Visual System

Production design system for the AI agent feature inside Leveld. This is a *sub-system* — a deliberate counter-surface inside a larger gamified app. Where the parent Leveld UI is bright, celebratory, and high-stimulation (XP toasts, rank-up haptics, color-coded category cards), the Agent surface is quiet, clinical, and restrained. The contrast is the point.

---

## The brief

| Field | Value |
|---|---|
| Brand | Leveld Agent (sub-brand of Leveld) |
| Personality | `MINIMAL` dominant + `TECHNICAL` modulator |
| Primary surface | Mobile PWA (with web/desktop support) |
| Anchor color | Deep slate-indigo `#4338CA` — clinical, calm, distinct from celebratory colors |
| Anchor constraint | Must contrast — not match — the parent Leveld palette |

---

## The personality lens

The Agent is the **calm clinic inside the gym**. Specific consequences of this lens:

- **Generous whitespace.** What MODERN would solve with `space/4` (16px), the Agent solves with `space/5` (20px) or `space/6` (24px). The surface should feel uncrowded even on mobile.
- **Low chroma.** Primary palette caps at ~60% saturation. Semantic colors (danger, warning) are muted — alarms in this surface should land like a doctor's "we should look at this," not a hospital code red.
- **Single accent.** Slate-indigo carries every brand moment. No secondary brand color competing for attention.
- **Type does the work.** One family (Inter) at 4 weights covers everything visual. Mono (JetBrains Mono) is reserved exclusively for data — timestamps, XP deltas, day-counter strings, completion grids. Mono is never decorative.
- **Borders, not shadows.** 1px subtle borders carry separation. Shadows reserved for overlays only (modals, popovers, bottom sheets).
- **Snappy motion.** 100–180ms transitions. No bounce, no overshoot. Motion is informational, never decorative.
- **Tight scale ratio.** 1.200 (Minor Third) — tight, controlled steps. No dramatic display sizes; this surface never shouts.

Someone reading just the type scale, the radii, and the spacing defaults should be able to guess this is a clinical interior surface inside a louder consumer product. That's the test.

---

## File index

| File | What it is | When you touch it |
|---|---|---|
| `tokens.json` | All design tokens in W3C DTCG format | When syncing to Tokens Studio / Figma plugins |
| `tokens.css` | The same tokens as CSS custom properties | What the React app actually imports |
| `components.md` | Component specs (anatomy, variants, states, tokens, ARIA, keyboard) | When building or reviewing a component |
| `preview.html` | Visual preview of four key Agent surfaces | When you want to *see* the system without scaffolding it |
| `README.md` | This file | When onboarding |

---

## How this slots into Leveld

Two integration patterns, depending on how you want the contrast to read:

**Pattern A — Agent inherits its own theme via `[data-theme="agent"]`** (recommended)
Wrap any Agent surface (Daily Brief card, Sunday Reflection sheet, Slip Recovery modal, Setup Wizard, Anchor Coach panel, Pattern Surface card) in a container with `data-theme="agent"`. The Agent tokens override the parent Leveld tokens for everything inside that container. Outside the container, Leveld's existing tokens are untouched.

```jsx
<div data-theme="agent">
  <DailyBriefCard />
</div>
```

This pattern keeps Leveld's celebratory cards and the Agent's clinical cards visually distinct on the same screen. It's the right call for the Daily Brief, which sits at the top of the dashboard *alongside* gamified content.

**Pattern B — Agent surfaces are full-screen takeovers**
The Setup Wizard and Sunday Reflection are full-screen surfaces. For these, swap the root theme to `agent` for the duration of the flow, then revert on exit.

---

## Quick start — engineers

```jsx
// Import tokens once at the app root
import "./design-system/tokens.css";

// Apply Agent theme to any subtree
<div data-theme="agent">
  <YourAgentComponent />
</div>

// Use semantic tokens, never primitives, in components
const Card = styled.div`
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  padding: var(--space-5);
  color: var(--color-text-default);
`;
```

Rule: components reference *semantic* tokens (`--color-surface-raised`), never primitive tokens (`--color-neutral-50`). The semantic layer is where light/dark/agent themes diverge.

---

## Quick start — designers

In Figma:
1. Import `tokens.json` via Tokens Studio plugin.
2. Activate the `light` theme set as default, `dark` as alternate.
3. Use the semantic tokens (`surface/*`, `text/*`, `border/*`, `action/*`) on layers. Don't paint with primitive colors.
4. Reference `components.md` for the anatomy and states of each component before building variants.

---

## What this system is not

- **Not a full Leveld design system.** Leveld's parent UI (gamified cards, rank badges, XP toasts, the dashboard chrome) is out of scope. This system covers Agent surfaces only.
- **Not a chatbot UI kit.** The Agent has six purpose-built surfaces, not a free-form chat. The components reflect that — there's a "message bubble" but there's also an "insight card," a "wizard step header," a "slip recovery modal," and an "anchor coach panel," each tuned for its specific moment.
- **Not opinionated about your stack.** Tokens are CSS variables and DTCG JSON. They work with any rendering framework.

---

## Versioning

`1.0.0` — initial system, six Agent surfaces, full token set.

Breaking changes (renaming or removing a semantic token, changing what a primitive resolves to) bump major. Adding new tokens or components bumps minor. Token value adjustments bump patch.
