# Leveld Agent — Component Library

Twenty-two components covering the six Agent surfaces. Each spec includes anatomy, variants, sizes, states, the exact tokens consumed, usage rules, and accessibility requirements. Components consume **semantic tokens only** (`--color-surface-raised`, never `--color-neutral-0`).

States every interactive component must implement: `default`, `hover`, `pressed`, `focus-visible`, `disabled`. Some add `loading`, `error`, `success`, `selected`, `expanded` as noted.

The components are grouped by:
- **Agent-specific** — built only for AI surfaces
- **Foundation** — reused from the broader Leveld system but re-tokenized for the Agent theme
- **Surfaces** — full-screen or sheet-level containers

---

## Agent-specific components

### 1. AgentMessage

The Agent's voice, rendered as a chat bubble.

- **Anatomy**: container, optional leading icon/avatar, content (markdown-rendered prose), optional inline action row beneath
- **Variants**: `default`, `with-action`, `streaming` (shows cursor at end while content arrives), `system` (light-weight, italicized — for state changes like "freeze applied")
- **Sizes**: width-fluid, max-width `60ch` on desktop, full-width minus padding on mobile
- **States**: `default`, `streaming`, `complete`
- **Tokens consumed**:
  - `background: var(--color-surface-agent)`
  - `color: var(--color-text-agent)`
  - `border: 1px solid var(--color-border-subtle)`
  - `border-radius: var(--radius-md)`
  - `padding: var(--space-4) var(--space-5)`
  - `font-size: var(--font-size-base)`
  - `line-height: var(--line-height-normal)`
- **Usage**: keep messages ≤4 sentences by default — system prompt enforces this. Inline mono text (`<code>`) for any numeric data inside prose (XP values, completion percentages, day counts).
- **ARIA**: `role="article"` on each message. `aria-live="polite"` on the message stream container so screen readers announce arriving content.

### 2. UserMessage

Echo of what the user typed.

- **Anatomy**: container, content (plain text)
- **Variants**: `default`
- **Tokens consumed**:
  - `background: var(--color-action-primary)` with reduced opacity, OR `var(--color-primary-50)` for a softer feel
  - `color: var(--color-primary-900)` on the soft variant
  - `border-radius: var(--radius-md)`
  - `padding: var(--space-3) var(--space-4)`
  - Aligned to the right side of the message stream
- **Usage**: never wider than 80% of the message stream width. Always right-aligned. Differentiate from AgentMessage by alignment first, color second — alignment alone should be sufficient.

### 3. AgentStreamCursor

Indicator at the end of an AgentMessage while content is still arriving.

- **Anatomy**: vertical line, 2px wide, 1em tall, blinking
- **Animation**: opacity 1 ↔ 0.2 at 800ms `ease-linear`. Stops when streaming completes.
- **Tokens consumed**:
  - `background: var(--color-text-agent)`
  - `width: 2px`
  - `height: 1em`
- **Usage**: shown only while content arrives. Removed instantly when the message is complete — no fade-out (would feel slow).
- **Accessibility**: `aria-hidden="true"`. The `aria-live` on the container handles announcement.

### 4. AgentComposer

The input surface where the user types to the Agent.

- **Anatomy**: container, textarea, send button (icon, primary), optional attachment button (left), optional suggestion-chip row above
- **Variants**: `default`, `with-suggestions` (chips rendered above the textarea)
- **States**: `default`, `focused`, `disabled` (Agent is processing), `error` (rate limit hit, network down)
- **Tokens consumed**:
  - `background: var(--color-surface-base)`
  - `border-top: 1px solid var(--color-border-subtle)` (when docked to bottom of a sheet)
  - `padding: var(--space-3) var(--space-4)`
  - Inner textarea: `var(--font-size-base)`, `min-height: 40px`, `max-height: 160px`, auto-growing
- **Usage**: send on `Cmd/Ctrl+Enter`, newline on `Enter` by default on desktop; configurable. On mobile, `Enter` sends and `Shift+Enter` for newline.
- **ARIA**: textarea has visible label or `aria-label="Message the agent"`. Send button has `aria-label="Send message"`.

### 5. SuggestionChip

Tappable, pre-written user response. Used to lower friction for predictable choices.

- **Anatomy**: container, optional leading icon, label
- **Variants**: `default`, `selected`, `dismissed`
- **Sizes**: `sm` (28h), `md` (32h)
- **States**: `default`, `hover`, `pressed`, `focus-visible`, `selected`
- **Tokens consumed**:
  - `background: var(--color-surface-sunken)` default → `var(--color-action-secondary-hover)` on hover
  - `color: var(--color-text-default)`
  - `border: 1px solid var(--color-border-subtle)`
  - `border-radius: var(--radius-full)`
  - `padding: var(--space-1) var(--space-3)`
  - `font-size: var(--font-size-sm)`, `font-weight: var(--font-weight-medium)`
- **Usage**: maximum 4 chips visible at once. Chips disappear once the user types anything in the composer or sends a message. Don't use for actions that have consequences — only as conversational shortcuts.
- **ARIA**: `<button>` with descriptive label.

### 6. InsightCard

The Daily Brief and Pattern Surface live here. A short, dense, dismissible card from the Agent.

- **Anatomy**: container, header (Agent avatar 24px + label "Agent" + timestamp), body (markdown-rendered prose, 1–3 sentences), optional inline action row, dismiss button (top-right, only on Pattern Surface)
- **Variants**: `brief` (Daily Brief — appears on dashboard daily, not dismissible), `pattern` (Pattern Surface — passive, dismissible), `nudge` (Slip Recovery preface — accent-bordered)
- **States**: `default`, `read`, `dismissed` (animates out)
- **Tokens consumed**:
  - `background: var(--color-surface-raised)`
  - `border: 1px solid var(--color-border-subtle)` for `brief` and `pattern`
  - `border-left: 3px solid var(--color-action-primary)` for `nudge` variant
  - `border-radius: var(--radius-md)`
  - `padding: var(--space-5)`
  - Header timestamp uses `font-family: var(--font-family-mono)`, `font-size: var(--font-size-xs)`, `color: var(--color-text-subtle)`
- **Usage**: maximum one InsightCard visible per surface at a time. If multiple are queued, show the highest-priority one and store the rest for later display.
- **ARIA**: `role="article"` with `aria-labelledby` pointing to the header label.

### 7. WizardStepHeader

Title and progress for a Setup Wizard step.

- **Anatomy**: step counter (mono, "01 / 05"), step title, optional description
- **Tokens consumed**:
  - Counter: `font-family: var(--font-family-mono)`, `font-size: var(--font-size-xs)`, `color: var(--color-text-subtle)`, `letter-spacing: var(--letter-spacing-wide)`, `text-transform: uppercase`
  - Title: `font-size: var(--font-size-display-md)`, `font-weight: var(--font-weight-semibold)`, `line-height: var(--line-height-tight)`, `letter-spacing: var(--letter-spacing-snug)`
  - Description: `font-size: var(--font-size-lg)`, `color: var(--color-text-muted)`, `line-height: var(--line-height-relaxed)`, `margin-top: var(--space-3)`
- **Usage**: every wizard step starts with this header. Title is one line; if it wraps to two, the description is optional.

### 8. WizardStepper

Visual progress through a Wizard.

- **Anatomy**: row of step indicators, each with circle (number or check) + thin connector to next
- **Variants**: `horizontal` (desktop, top of wizard), `dots` (mobile, just dots indicating position)
- **States per step**: `completed`, `current`, `upcoming`
- **Tokens consumed**:
  - Completed: `background: var(--color-action-primary)`, check icon in `var(--color-text-on-brand)`
  - Current: `border: 2px solid var(--color-action-primary)`, fill `var(--color-surface-base)`, number in `var(--color-action-primary)`
  - Upcoming: `border: 1px solid var(--color-border-default)`, fill `var(--color-surface-base)`, number in `var(--color-text-subtle)`
  - Connector: `background: var(--color-border-subtle)` for upcoming, `var(--color-action-primary)` for completed segment
- **Usage**: max 6 visible steps on desktop. More than 6 → use dots variant.
- **ARIA**: `role="list"` on container, `aria-current="step"` on the current item.

### 9. AnchorCoachPanel

Inline panel that critiques anchor text in real-time during habit creation.

- **Anatomy**: small container docked beside the anchor input, agent icon + 1-line critique + optional tap-to-apply suggestion
- **Variants**: `idle` (waiting for input), `coaching` (showing feedback), `approving` (anchor is well-formed — small check, fades to subtle)
- **States**: `idle`, `coaching`, `approving`, `dismissed`
- **Tokens consumed**:
  - `background: var(--color-info-subtle-bg)` for `coaching`, `var(--color-success-subtle-bg)` for `approving`
  - `border-left: 2px solid var(--color-info-fg)` for `coaching`, `var(--color-success-fg)` for `approving`
  - `padding: var(--space-3) var(--space-4)`
  - `font-size: var(--font-size-sm)`, `color: var(--color-text-default)`
  - `border-radius: var(--radius-sm)`
- **Usage**: debounced 600ms after typing stops. Never blocks form submission — it's advisory. Suggestion text is a single tap-to-apply button.
- **ARIA**: `role="status"` with `aria-live="polite"`.

### 10. AgentQuickAction

Inline button rendered within AgentMessages to trigger app actions ("Spend a freeze", "Open this habit", "Mark today done").

- **Anatomy**: container, optional leading icon, label
- **Variants**: `primary` (filled), `secondary` (outlined), `destructive` (rare — for "Cancel milestone" type actions)
- **Sizes**: `sm` (28h — inline within prose), `md` (36h — on its own row)
- **States**: `default`, `hover`, `pressed`, `focus-visible`, `disabled`, `loading`
- **Tokens consumed**: see Button below (it's a sized variant of Button)
- **Usage**: maximum 2 quick actions per message. Destructive actions never auto-execute — they open a confirmation Modal.

### 11. DataBlock

Inline data presentation inside AgentMessages — numbers, ranks, completion grids. Always monospace.

- **Anatomy**: optional label, value (mono), optional unit, optional delta indicator (↑ or ↓ with color)
- **Variants**: `inline` (within a sentence), `block` (standalone, larger), `grid` (e.g. 7-day completion strip)
- **Tokens consumed**:
  - `font-family: var(--font-family-mono)`
  - `font-variant-numeric: tabular-nums`
  - `font-size: var(--font-size-sm)` for inline, `var(--font-size-base)` for block
  - Delta color: `var(--color-success-fg)` for positive, `var(--color-danger-fg)` for negative
- **Usage**: any number that appears in Agent prose belongs in a DataBlock. Pure decorative wrappers — they don't carry interactivity.

### 12. SectionDivider

Visual break inside the Sunday Reflection or Setup Wizard, often with a mono timestamp.

- **Anatomy**: horizontal line, optional centered label (uppercase mono)
- **Variants**: `plain`, `with-label` (e.g. "Question 02 — what changed")
- **Tokens consumed**:
  - Line: `border-top: 1px solid var(--color-border-subtle)`
  - Label: `font-family: var(--font-family-mono)`, `font-size: var(--font-size-xs)`, `color: var(--color-text-subtle)`, `letter-spacing: var(--letter-spacing-wide)`, `text-transform: uppercase`, `padding: 0 var(--space-3)`, `background: var(--color-surface-base)`
- **Usage**: never more than 2 dividers per surface. They're punctuation, not structure.

---

## Foundation components (re-tokenized for Agent)

### 13. Button

- **Anatomy**: container, optional leading icon, label, optional trailing icon, loading spinner (replaces leading icon when loading)
- **Variants**: `primary`, `secondary`, `ghost`, `destructive`
- **Sizes**: `sm` (32h), `md` (40h — default), `lg` (48h)
- **States**: `default`, `hover`, `pressed`, `focus-visible`, `disabled`, `loading`
- **Tokens consumed**:
  - Primary: `background: var(--color-action-primary)` → hover `var(--color-action-primary-hover)` → pressed `var(--color-action-primary-pressed)`. Label `var(--color-text-on-brand)`.
  - Secondary: `background: var(--color-action-secondary)`. Border `1px solid var(--color-border-default)`. Label `var(--color-text-default)`.
  - Ghost: transparent → `var(--color-action-secondary)` on hover. Label `var(--color-text-default)`.
  - Destructive: `background: var(--color-danger-bg)`, label `var(--color-text-on-brand)`. Used sparingly.
  - All: `border-radius: var(--radius-sm)`, `padding: 0 var(--space-4)`, `font-size: var(--font-size-sm)`, `font-weight: var(--font-weight-medium)`
- **Usage**: one `primary` per visible area. Destructive requires confirmation. Loading state preserves width to prevent layout shift.
- **ARIA**: native `<button>`. `aria-busy="true"` when loading. `aria-disabled="true"` when disabled (use this rather than the `disabled` attribute when the button still needs to be focusable for tooltip purposes).

### 14. TextField

- **Anatomy**: label, optional helper text, input, optional leading icon, optional trailing icon, error message (replaces helper when present)
- **Variants**: `outlined` (default), `filled` (sunken bg)
- **Sizes**: `sm` (32h), `md` (40h), `lg` (48h)
- **States**: `default`, `hover`, `focus-visible`, `disabled`, `error`, `success`, `readonly`
- **Tokens consumed**:
  - Outlined: `border: 1px solid var(--color-border-default)` → focused `var(--color-border-brand)` + focus ring
  - Filled: `background: var(--color-surface-sunken)`, no border, focus ring on focus
  - Label: `font-size: var(--font-size-sm)`, `font-weight: var(--font-weight-medium)`, `color: var(--color-text-muted)`, margin-bottom `var(--space-2)`
  - Helper text: `font-size: var(--font-size-xs)`, `color: var(--color-text-subtle)`
  - Error message: `font-size: var(--font-size-xs)`, `color: var(--color-danger-fg)`
- **Usage**: always provide a visible label (placeholder is not a label). Helper text is below the input; error replaces helper. For anchor fields, pair with AnchorCoachPanel beside the input.
- **ARIA**: `<label for>` mandatory. `aria-describedby` linking to helper/error. `aria-invalid="true"` on error state.

### 15. Textarea

Same anatomy and tokens as TextField, but multi-line.

- **Sizes**: `sm` (min-height 64), `md` (min-height 96), `lg` (min-height 128)
- **Extra**: optional character counter bottom-right, font-size `var(--font-size-xs)`, color `var(--color-text-subtle)`
- **Usage**: Worry Window entries, Sunday Reflection answers, brain dump composition — all use Textarea, not TextField.

### 16. Modal

- **Anatomy**: backdrop, container, header (title + close button), body, footer (action buttons)
- **Variants**: `default`, `confirmation` (compact, two-button), `slip-recovery` (Agent-specific — see surface 19)
- **Sizes**: `sm` (400px), `md` (560px — default), `lg` (720px), `xl` (1024px)
- **States**: `entering`, `open`, `exiting`
- **Tokens consumed**:
  - Container: `background: var(--color-surface-overlay)`, `box-shadow: var(--shadow-xl)`, `border-radius: var(--radius-lg)`, `padding: var(--space-6)`
  - Backdrop: `background: rgba(14, 14, 12, 0.5)`, `z-index: var(--z-overlay)`
  - Container z-index: `var(--z-modal)`
- **Usage**: trap focus, return focus on close, `esc` to close (except destructive flows). Body scroll locks when open.
- **ARIA**: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` to title.

### 17. Card

- **Anatomy**: container, optional header, body, optional footer
- **Variants**: `outlined` (default — Agent uses this), `elevated` (shadow — rare), `interactive` (hoverable, clickable)
- **Sizes**: padding-based — `sm` (space/4), `md` (space/5 — default), `lg` (space/6)
- **States**: `default`, `hover` (interactive variant), `selected` (interactive variant)
- **Tokens consumed**:
  - `background: var(--color-surface-raised)`
  - `border: 1px solid var(--color-border-subtle)`
  - `border-radius: var(--radius-md)`
  - `padding: var(--space-5)` (md)
- **Usage**: one card style per screen. The Agent uses outlined cards exclusively to maintain visual quietness.

### 18. Spinner

- **Anatomy**: circular animation
- **Sizes**: `xs` (12px), `sm` (16px), `md` (24px — default), `lg` (32px)
- **Variants**: `default` (border spin), `dots` (three-dot pulse — used in AgentMessage while loading)
- **Tokens consumed**:
  - `color: var(--color-action-primary)` (or `currentColor` when inline)
- **Usage**: dots variant inside AgentMessage when the Agent is "thinking." Default variant for everything else.
- **ARIA**: `role="status"`, `aria-label="Loading"`.

### 19. AgentAvatar

The Agent's identity marker. Distinct from human avatars.

- **Anatomy**: container, geometric mark (a small custom glyph, not a photo)
- **Sizes**: `sm` (20px), `md` (24px — default in InsightCard header), `lg` (32px)
- **Tokens consumed**:
  - `background: var(--color-primary-900)` in light mode, `var(--color-primary-700)` in dark mode
  - Mark color: `var(--color-primary-100)`
  - `border-radius: var(--radius-sm)` (not full — distinguishes from human avatars which are circular)
  - The non-circular shape is intentional. The Agent is a tool, not a person.
- **Usage**: appears in InsightCard headers, beside AgentMessage on mobile (omitted on desktop where alignment carries identity). Never replaced with an emoji or face.
- **ARIA**: `aria-label="Leveld Agent"` if interactive, `aria-hidden="true"` if decorative.

### 20. Badge

- **Anatomy**: container, optional dot, label
- **Variants**: `solid`, `subtle`, `outline`
- **Sizes**: `sm` (text/xs), `md` (text/sm)
- **Colors**: neutral, primary, plus all four semantics
- **Tokens consumed (subtle variant)**:
  - `background: var(--color-primary-50)` (or semantic equivalent)
  - `color: var(--color-primary-700)` (or semantic fg-strong)
  - `border-radius: var(--radius-full)`
  - `padding: 0 var(--space-2)`
- **Usage**: stream state in InsightCard ("auto-generated", "weekly"), severity hint, status pill. Numeric badges cap at "99+".

---

## Surface components (containers for full Agent flows)

### 21. BottomSheet

Mobile-primary surface for the Sunday Reflection, Setup Wizard, and Slip Recovery flows. Desktop renders these as centered Modals instead.

- **Anatomy**: backdrop, drag handle (4×32 pill at top), header (title + close), body (scrollable), optional footer (sticky action row)
- **Variants**: `partial` (snap to 50%, then 90% on drag), `full` (90% height immediately)
- **States**: `entering`, `open`, `dragging`, `exiting`
- **Tokens consumed**:
  - Background: `var(--color-surface-base)`
  - Border-top-radius: `var(--radius-lg)`
  - `box-shadow: var(--shadow-lg)` (top edge only — `0 -8px 24px rgba(...)`)
  - Drag handle: `background: var(--color-border-default)`, `border-radius: var(--radius-full)`
  - Z-index: `var(--z-modal)`
- **Motion**: enter from bottom, `duration-slower` (360ms), `ease-out`. Exit `duration-base` (160ms), `ease-in`. Drag follows finger 1:1.
- **Usage**: dismiss on backdrop tap, drag-down past 30% of height, or close button. Body scroll locks page below.
- **ARIA**: `role="dialog"`, `aria-modal="true"`, focus trapped.

### 22. SideDrawer

Desktop-primary surface for the AnchorCoachPanel when it expands beyond inline display, and for the Sunday Reflection on tablet+.

- **Anatomy**: backdrop (optional — not for AnchorCoachPanel), container docked to right, header, body, optional footer
- **Variants**: `overlay` (with backdrop, modal-like), `inline` (no backdrop, pushes content)
- **Sizes**: `sm` (320px), `md` (400px — default), `lg` (560px)
- **Tokens consumed**:
  - `background: var(--color-surface-base)`
  - `border-left: 1px solid var(--color-border-subtle)`
  - `box-shadow: var(--shadow-lg)` for `overlay` variant
- **Motion**: slide in from right, `duration-slow` (240ms), `ease-out`.
- **Usage**: prefer Drawer over Modal when the user benefits from seeing the underlying context (Anchor Coach is exactly this case).

---

## Accessibility commitments

- **WCAG 2.2 AA floor.** Body text contrast ≥ 4.5:1, large text ≥ 3:1, UI components ≥ 3:1.
- **Focus ring** appears only on keyboard focus (`:focus-visible`). 2px solid `var(--color-focus-ring)` with 2px offset. Token set in CSS for system-wide consistency.
- **Touch targets** minimum 44×44 CSS px on touch devices. Buttons at `sm` size (32h) restricted to dense desktop UI behind `@media (pointer: fine)`.
- **Color-blind safety**: semantic colors always paired with icons. InsightCard's `nudge` variant uses a left-border accent in addition to color.
- **Reduced motion**: streaming cursor stops animating; AgentMessage fade-in collapses to instant; BottomSheet slide becomes opacity-only fade.
- **Reduced transparency**: backdrop blur dropped, solid backdrop substituted.

### Contrast check (light mode, key pairings)

| Foreground | Background | Ratio | Pass |
|---|---|---|---|
| `text/default` (#1A1A17) | `surface/base` (#FFFFFF) | 16.5:1 | AAA |
| `text/default` (#1A1A17) | `surface/agent` (#FAFAF8) | 16.0:1 | AAA |
| `text/muted` (#65655A) | `surface/base` (#FFFFFF) | 5.8:1 | AA |
| `text/subtle` (#8A8A7C) | `surface/base` (#FFFFFF) | 3.9:1 | AA (large only — restrict to ≥18px or ≥14px bold) |
| `text/on-brand` (#FFFFFF) | `action/primary` (#4338CA) | 8.1:1 | AAA |
| `text/link` (#4338CA) | `surface/base` (#FFFFFF) | 8.1:1 | AAA |

### Contrast check (dark mode, key pairings)

| Foreground | Background | Ratio | Pass |
|---|---|---|---|
| `text/default` (#F4F4F0) | `surface/base` (#0E0E0C) | 17.1:1 | AAA |
| `text/default` (#F4F4F0) | `surface/agent` (#2E2E29) | 11.0:1 | AAA |
| `text/muted` (#B0B0A4) | `surface/base` (#0E0E0C) | 9.0:1 | AAA |
| `text/on-brand` (#FFFFFF) | `action/primary` (#5C61E0) | 5.5:1 | AA |

---

## Keyboard interaction summary

| Surface | Key | Behavior |
|---|---|---|
| AgentComposer | `Enter` (mobile) / `Cmd-Enter` (desktop) | Send message |
| AgentComposer | `Shift-Enter` | Insert newline |
| AgentComposer | `Esc` | Blur composer |
| Wizard | `Enter` on focused primary button | Advance step |
| Wizard | `Cmd-←` / `Cmd-→` | Previous / next step (where applicable) |
| Modal / BottomSheet | `Esc` | Close (unless destructive flow with unsaved data) |
| Modal / BottomSheet | `Tab` / `Shift-Tab` | Cycle focus within trap |
| SuggestionChip row | `←` / `→` | Move focus between chips |
| SuggestionChip | `Enter` / `Space` | Activate |
| InsightCard | `X` (with focus on card) | Dismiss (pattern variant only) |

---

## Component checklist

When a new Agent component is proposed, it must meet this bar before shipping:

1. Variants listed with concrete token differences (not "darker")
2. All five core states implemented (`default`, `hover`, `pressed`, `focus-visible`, `disabled`)
3. Tokens consumed are semantic, not primitive
4. One correct usage example and one anti-example documented
5. ARIA role + required attributes specified
6. Keyboard interaction map documented
7. Contrast verified against the theme's surface tokens
8. Reduced-motion fallback specified if the component animates
9. Mobile behavior specified (collapses, stacks, sheets) if it appears on touch surfaces
