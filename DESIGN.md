# Design Direction — Finance Tracker

> Source of truth for the project's aesthetic. The `frontend-design` skill reads this on every UI task.
>
> **Revision 2** (2026-10-25): replaced the original Soft-Tactile direction after the user reviewed the live app and asked for a redesign, providing concrete references: three screenshots of "LOOP — Gestione Economica" (a financial-management dashboard she built for a client) and her own logo. This is now the binding direction — do not revert to the warm/sage Soft-Tactile language described in earlier history.

## Aesthetic direction

**Technical-Utility**

A precise, data-dense financial cockpit — closer to Mercury's or Ramp's finance dashboards than to a cozy personal ledger. White surfaces, bold black numerals, a deep navy anchor color, and a vivid teal accent that does the work blue usually does in SaaS products (focus rings, active states, progress). Structure is explicit and labeled: uppercase tracked-out micro-labels, pill-shaped segmented filters, gradient-banded section headers on financial tables. The sage-green brush of the user's own logo survives only as one supporting hue in the data-color palette, not as the app's primary identity — navy and teal carry that now.

## Reference apps

- **LOOP — Gestione Economica** (user-provided screenshots, `~/Downloads/screenshot per app/`) — the primary and most literal reference. Match directly: the sidebar structure and active-item treatment, the stat-card with gradient top border, the pill-shaped year filter, the "Conto Economico" table with navy→teal gradient section-header bands and bold colored total rows (mint-green for revenue totals, coral for cost totals), the pale-mint table header tint, the small colored bullet dots used to color-code categories.
- Mercury (banking dashboard) — restrained, confident use of a single bright accent against white/near-white surfaces.

## Typography

**Heading**: Geist Sans, 700 weight — already loaded in the project (`--font-geist-sans`), no new font needed; it's visually in the same family as the grotesque sans used in the reference screenshots. Page titles are bold, black, tight tracking (`tracking-tight`), noticeably larger than the old direction (`text-3xl`/`text-4xl` for page H1s).
**Body**: Geist Sans, 400 weight.
**Micro-labels**: Geist Sans, 600 weight, uppercase, `tracking-wider`, small (11-12px), gray-blue — used for card eyebrow labels ("COSTI TOTALI 2026"), table column headers, section eyebrows.
**Mono**: Geist Mono (`--font-geist-mono`) — used for ALL monetary values and table figures, tabular numerals.
**Pairing rationale**: bold black Geist Sans carries structure and hierarchy (titles, totals), uppercase tracked micro-labels carry wayfinding, Geist Mono carries every number — three distinct typographic registers doing three distinct jobs, matching the reference's clarity.

**Scale**: bold and confident — page H1 `text-3xl font-bold tracking-tight`; stat-card big numbers `text-3xl` to `text-4xl` mono bold; micro-labels `text-[11px]` uppercase tracked.
**Tabular numerals**: required everywhere money appears — Geist Mono handles this automatically.

## Color story

**Mode**: light only — no dark mode toggle. (The LOOP reference has a "Modalità scura" sidebar item because it's a multi-tenant SaaS product; this app does not need one — it's a single-user permanent light surface.)
**Background**: `#FFFFFF` (pure white page background — this direction is crisp, not warm-paper like the previous one)
**Foreground**: `#0F172A` (near-black navy-tinted text, not pure `#000000`)
**Primary / anchor**: `#1E2A52` (deep navy — section header bands, bold emphasis, one gradient endpoint)
**Accent / interactive**: `#14B8A6` (vivid teal — the other gradient endpoint, focus rings, active nav pill, primary button, progress bars, "good" status)
**Surfaces**: cards are `#FFFFFF` with a `1px #E7EAF0` border and a soft shadow (`0 1px 3px rgba(15,23,42,0.06)`) — slightly more lift than the previous hairline-only direction, matching the reference's card elevation
**Semantic colors**:
- Success / under-budget / revenue total: `#059669` (emerald green — used for "TOTALE RICAVI" rows and under-budget variance)
- Destructive / over-budget / cost total: `#DC2626` (coral-red — used for "TOTALE COSTI" rows and over-budget variance)
- Warning (uncategorized, needs review): `#D97706` (amber)

These map to `src/app/globals.css` (`@theme` block): `--background`, `--foreground`, `--primary` (navy), `--accent`/`--ring` (teal), `--card`, `--border`, `--success`, `--destructive`, `--warning`.

**Decorative palette** (`src/lib/finance/card-tones.ts`): a small palette of 6 tones (`navy`, `teal`, `purple`, `gold`, `coral`, `sage`) exists in code (lifted from the reference screenshot's bullet-dot palette) but **all stat cards use `sage` uniformly** (`#7C9473` — the one surviving thread back to the logo's watercolor green) per explicit user request ("i riquadri siano tutti verdi, non di vari colori") — do not reintroduce per-card color rotation on Home/Conti/Casa cards. The other 5 tones remain available in the palette file for future category color-dots or similar uses, just not for stat-card backgrounds. These carry no success/warning/destructive meaning and must never be used for Budget/Rendiconto variance coloring, where color means over/under budget.

## Motion personality

**Character**: Deliberate, confident, slightly snappier than the old direction — this is a utility tool meant to be used often, not lingered over.

**Named easings** (defined in `globals.css`): `ease-snap`, `ease-settle`, `ease-drift` — unchanged definitions, same usage rules as before (snap = button/toggle feedback, settle = dialogs/sheets, drift = ambient only, never primary interactions).
**Reduced motion**: respected globally via `@media (prefers-reduced-motion)`.

## Layout personality

**Composition rule**: structured and labeled, not minimal — every section gets an eyebrow label, every number gets a caption. This is a dashboard, not an editorial page.
**Density**: denser than the previous direction, closer to the LOOP reference — tables in particular (Budget/Rendiconto, Transazioni) should read as professional financial statements.
**Default page max-width**: `max-w-6xl` for standard pages; the restructured Budget/Rendiconto table may use the full sidebar-adjacent width since it has many month columns.
**Spacing scale**: default — not as generous/airy as the old Soft-Tactile direction; cards `p-6`, page sections `space-y-6` to `space-y-8`.

## Tone of voice

Calm and precise, first-person-singular. No gamification. Unchanged from the previous revision.

## Anti-patterns for this app

- No emoji anywhere in the UI
- No warm/beige "paper ledger" surfaces anymore — background is crisp white, not `#FAF9F5`
- No dark mode toggle
- Reserve pure navy/teal gradients for the things the reference uses them for (section header bands, stat-card top borders) — don't scatter gradients everywhere
- Donut/pie charts still avoided for Budget — the table + colored totals/variance is the visualization, per the reference

## Component customizations required

- **Button**: primary variant uses the teal accent (`#14B8A6`) with white text, `rounded-md`; secondary/outline follow the reference's pill-filter look where used for segmented controls (year selector): `rounded-full`, selected = pale teal fill + teal border + teal text, unselected = white + gray border
- **Card**: white fill, `1px #E7EAF0` border, soft shadow, `rounded-xl`; stat cards get a 3px gradient top border (navy → teal) as an alternative/addition to the flat colored-tint treatment already in use
- **Table**: header row gets a pale mint tint (`color-mix` of teal at ~8%); section-header rows (used in the restructured Budget/Rendiconto) are solid navy→teal gradient bars with bold white uppercase text; bold colored total rows (emerald for revenue, coral for costs) with a matching-color top border accent on that row
- **Badge**: category tags and status pills — soft-fill background in the semantic/categorical color at low opacity, text in the full-strength color, `rounded-full`
- **Sidebar**: logo mark (`public/logo.png`) top-left next to the app name; active nav item gets a pale teal pill background with teal icon/text; a divider before secondary items; user info pinned at the very bottom — this is now explicitly modeled on the LOOP reference's sidebar, not a from-scratch design
