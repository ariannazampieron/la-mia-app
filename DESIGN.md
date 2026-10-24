# Design Direction — Finance Tracker

> Source of truth for the project's aesthetic. The `frontend-design` skill reads this on every UI task.

## Aesthetic direction

**Soft-Tactile**

A personal finance ledger, not a SaaS dashboard — it should feel like opening a well-kept paper ledger on a warm desk, not logging into a bank's web portal. Cards have soft, tactile presence: a single hairline border, a very subtle shadow, warm off-white surfaces instead of stark white. Numbers are the hero — large, tabular, unmistakable — everything else (labels, chrome, nav) recedes. Reference points: Copilot Money's calm confidence with numbers, Mercury's restraint with color, but warmer and less corporate than either — closer to a well-designed personal notebook app.

## Reference apps

- Copilot Money — how it makes large monetary figures the visual anchor of every screen, with color used sparingly and meaningfully (never decoratively)
- Mercury (banking dashboard) — restrained use of a single accent color against neutral surfaces, generous breathing room around data
- Notion — soft card tactility, hairline borders instead of heavy shadows, for the transaction list and settings areas

## Typography

**Heading**: Geist Sans, 600 weight — already loaded in the project (`--font-geist-sans`), no new font needed. Headings stay understated; they organize, they don't perform.
**Body**: Geist Sans, 400 weight — same family as headings, differentiated by weight and size only, keeping the whole app feeling like one calm surface.
**Mono**: Geist Mono (`--font-geist-mono`, already loaded) — used for ALL monetary values, account balances, and table figures. Tabular numerals are non-negotiable for a finance app; mono guarantees digit alignment in columns without extra CSS.
**Pairing rationale**: one typeface family (Geist) used two ways (sans for words, mono for numbers) keeps the UI visually quiet — the only typographic "event" is a number switching to mono, which is exactly where attention should go.

**Scale**: default · heading-to-body ratio ~2.5x (home page indicator numbers go large, ~2.5rem–3rem, in mono)
**Tracking**: default, except uppercase category badges which use `tracking-wide` at a small size
**Tabular numerals**: required everywhere money appears — handled automatically by using Geist Mono for all figures

## Color story

**Mode**: light only — no dark mode toggle, no system-detection fallback. The app renders light at all times.
**Accent**: `#7C9473` (muted sage green, drawn from the user's logo) — used for the single primary action per screen ("Importa estratto conto") and for active nav state
**Off-black**: `#2B2B27` (warm near-black for text — never pure `#000000`)
**Off-white**: `#FAF9F5` (warm paper-like background — never pure `#FFFFFF`)
**Surfaces**: cards sit on pure `#FFFFFF` against the `#FAF9F5` page background, differentiated by a 1px `#E8E6DF` hairline border and a barely-there shadow (`0 1px 2px rgba(43,43,39,0.04)`) — no heavy elevation anywhere
**Semantic colors**:
- Success / under-budget / income-positive: `#4F7A4A` (deeper, more saturated green than the accent, used ONLY for budget-vs-actual states — never for decoration)
- Destructive / over-budget: `#B5493F` (muted brick red, not a loud alarm red — this app should never feel alarming)
- Warning (e.g. "unrecognized category, needs review"): `#B8873B` (muted amber)

These map to the variables in `src/app/globals.css` (`@theme` block) — update `--primary`, `--background`, `--foreground`, `--card`, `--border`, `--destructive`, plus two new tokens `--success` and `--warning` to match this story.

**Decorative card tones** (`src/lib/finance/card-tones.ts`): a separate, non-semantic palette of 6 warm tones (sage, ochre, moss, terracotta, clay, sand) used to give the Home indicators, account balance cards, and the Casa section cards a more energetic, colored-background feel — added per explicit user request after the initial calm/neutral direction felt too flat for these specific stat cards. These carry no success/warning/destructive meaning and must never be used in the Budget/Rendiconto grid, where color means over/under budget.

## Motion personality

**Character**: Deliberate restraint. Most things don't animate. The few things that do — a row confirming a save, a duplicate-transaction dialog appearing — move decisively and briefly, never bouncy.

**Named easings** (defined in `globals.css`):
- `ease-snap` — button presses, checkbox/toggle feedback, the "transaction saved" micro-confirmation
- `ease-settle` — dialogs and sheets appearing (import preview, duplicate confirmation, manual transaction form)
- `ease-drift` — not used on primary interactions; reserved for the empty-state illustration's subtle idle state only, if any

**Stagger**: transaction rows appearing after an import stagger by 30ms, capped at the first 10 rows
**Reduced motion**: respected globally via `@media (prefers-reduced-motion)`

## Layout personality

**Composition rule**: calm and centered — this is a data-entry and review tool, not an editorial surface, so content is left-aligned under a fixed sidebar rather than asymmetric
**Density**: balanced (not dense like Linear, not oversized like a marketing page) — the user explicitly asked for "not too much information" at once
**Default page max-width**: `max-w-6xl`, with the transactions table allowed to use the full available width inside that constraint
**Spacing scale**: default-to-generous — cards get `p-6`, sections are separated by `space-y-8`
**Whitespace philosophy**: generous around the three home-page indicators (they should feel like the calm, confident headline of the page); tighter and more efficient inside the transactions table where density of information matters more

## Tone of voice

Calm, precise, first-person-singular ("il tuo fondo tasse", not "your tax fund" in a generic SaaS voice). No encouragement copy, no gamification, no exclamation points. This is a private ledger, not a growth app.
- "Nessuna transazione da categorizzare" ✓
- "Ottimo lavoro! Hai risparmiato questo mese! 🎉" ✗ (wrong register entirely — no emoji, no cheerleading)

## Anti-patterns for this app

- No emoji anywhere in the UI
- No card-grid dashboard with icon tiles — the home page is three large numeric indicators, not a grid of stat cards with icons
- No blue anywhere — this is a sage-green-only accent system
- No dark mode toggle in settings — light mode is a permanent product decision, not a user preference
- No donut/pie charts for budget — use the table with green/red highlighting the user explicitly asked for, not decorative data-viz

## Component customizations required

shadcn primitives ship neutral. The following must have an aesthetic-aligned variant before they're considered done:

- **Button**: primary variant uses the sage accent (`#7C9473`) with `rounded-md` (not pill, not sharp) and no shadow; secondary/ghost variants are text-only with a subtle background on hover
- **Card**: single hairline border (`#E8E6DF`), barely-there shadow, `rounded-lg`, white fill against the warm off-white page background
- **Table**: row figures right-aligned in Geist Mono; category shown as a small `rounded-full` badge, not plain text; hover state is a very subtle background tint, no row shadow
- **Badge**: used for category tags and budget status ("Sopra budget" / "Sotto budget") — solid soft-fill background in the semantic color at low opacity, text in the full-strength semantic color
- **Dialog**: used for the duplicate-transaction confirmation and manual transaction form — `ease-settle` entrance, centered, `max-w-md`
