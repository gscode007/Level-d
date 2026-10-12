# Existing Level’d design system

Documented from src/index.css, src/styles.module.css, GoalsView and ReportsView.

## Typography
Geist for body/UI, with system sans fallbacks. Instrument Serif with Georgia/serif
fallback for page titles and editorial section headings. JetBrains Mono through
--font-mono for eyebrows, compact labels, counters and small controls. Shared
pageH1 uses 30px, weight 300, 1.1 line height and -0.02em tracking. Mobile Quests
uses a 24px title. Eyebrows use 10px mono, weight 600, uppercase, 0.12em tracking.
Body/form text is 12–13px; form labels are 9px uppercase mono with 0.12em tracking.

## Colors and surfaces
Use existing tokens: --bg, --surface, --surface-2, --border, --text-primary,
--text-secondary, --text-tertiary, --accent, --accent-dim and --red. Cards use
--surface or the established panel surface, not an invented surface-1 token.
Preserve the shared reactive background. Corners use --radius-sm/md/lg and quiet
--shadow-sm elevation. Accent color is reserved for actions and status.

## Layout and controls
Desktop page padding is 40px 44px 72px. Quests/Reports expand to available width;
mobile padding is 20px 14px 24px. Page header spacing is 32px, tightened on mobile.
Panels use roughly 20px 22px padding. Form fields match fInput: surface-2, 6px
corners, 10px 12px padding, 13px body text. Use existing page/eyebrow/pageH1/fLbl/
fInput classes directly where possible. Controls retain visible keyboard focus,
hover, disabled and loading states. Keep mobile touch targets comfortable.
