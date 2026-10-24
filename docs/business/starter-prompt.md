# Finance Tracker — Project Context

> Paste this file into any new agent session (Claude Code, OpenAI Codex, Cursor Composer, or similar) to restore full project context instantly.

## ⚠ Critical Build Constraints

1. Routes `/` and `/dashboard` in the boilerplate are setup/demo scaffolding — **fully replace their contents**, never append to them
2. Never use Lorem Ipsum or placeholder text like "Coming soon" in any deliverable screen
3. Every screen that shows a list or table **must** have a real empty state implemented, not a blank box
4. The first build must be visually complete — no "I'll style this later" stubs or unstyled sections
5. Do not use the default shadcn gray card-with-title layout as a stand-in for real UI

---

## What This App Does
App personale per monitorare costi, ricavi e tasso di risparmio, basata sull'import di estratti conto, con budget annuale e conto economico mensile.

## Users & Roles
Un solo utente (il proprietario), nessun ruolo multiplo. Accesso comunque protetto da login.

## Authentication
Email OTP (codice via email, Better Auth, già configurato in `src/lib/auth.ts`). Nessuna registrazione pubblica aperta. Dopo il primo login, l'utente atterra direttamente sulla Home con i 3 indicatori.

## Key Screens

### Pre-login
- Layout: centrato, single-column, max-w-md
- Primary element: form richiesta OTP via email (riusa `src/components/auth/auth-form.tsx`)
- Empty/unauthenticated state: redirect automatico a `/` → login, nessun flash di contenuto protetto

### Home (`/dashboard`)
- Layout: sidebar fissa a sinistra + area principale, max-w-6xl
- Primary element: 3 card grandi con gli indicatori — Risparmio, Fondo Tasse, Liquidità disponibile — cifre in Geist Mono
- Secondary elements: breakdown minimo sotto ogni indicatore (es. saldo conto risparmio, fatturato annuale, imposte pagate nell'anno)
- Empty state: se non ci sono ancora transazioni, i tre indicatori mostrano 0 con un messaggio "Importa il tuo primo estratto conto per iniziare" e un CTA verso /dashboard/transactions
- Mobile behavior: sidebar collassa a icon-only o hamburger, card impilate verticalmente

### Transazioni (`/dashboard/transactions`)
- Layout: full width dentro il max-w-6xl, filtri sopra la tabella
- Primary element: tabella transazioni (data, descrizione, importo, entrata/uscita, categoria, conto), bottone primario "Importa estratto conto"
- Secondary elements: bottone "Aggiungi transazione manuale", filtri per conto/categoria/tipo/periodo
- Empty state: nessuna transazione → illustrazione minimale + CTA "Importa il tuo primo estratto conto"
- Mobile behavior: tabella diventa lista di card verticali

### Budget / Rendiconto (`/dashboard/budget`)
- Layout: due tab (Budget, Rendiconto), selettore anno in alto
- Primary element: griglia categoria × mese, editabile nel tab Budget, colorata verde/rosso nel tab Rendiconto
- Empty state: anno senza dati → griglia vuota con valori a 0, pronta da compilare
- Mobile behavior: griglia scrollabile orizzontalmente dentro un contenitore `overflow-x-auto`

### Conti (`/dashboard/accounts`)
- Layout: card per ciascuno dei 5 conti fissi
- Primary element: saldo di partenza editabile + saldo corrente calcolato (sola lettura)
- Empty state: N/A (i 5 conti sono seedati automaticamente al primo accesso)

## Core Features
1. Home con 3 indicatori calcolati automaticamente (Risparmio, Fondo Tasse, Liquidità disponibile)
2. Gestione dei 5 conti fissi con saldo di partenza manuale + saldo corrente calcolato
3. Import CSV/XLSX di estratti conto, con validazione bloccante sugli errori e rilevamento duplicati con conferma
4. Categorizzazione automatica AI delle transazioni ricorrenti (match storico locale + fallback OpenRouter)
5. Vista e modifica manuale delle transazioni, con filtri e flag "movimento interno"
6. Budget annuale (editabile) e Rendiconto mensile con evidenziazione verde/rosso, multi-anno

## Design System

**Layout**: sidebar fissa · scrollable shell · max-w-6xl
**Density**: balanced
**Accent color**: sage green `#7C9473` · **Mode**: light only (nessun toggle)
**Border radius**: standard (rounded-md/rounded-lg)
**Typography scale**: default — Geist Sans per testo, Geist Mono per ogni cifra monetaria
**Reference apps**: Copilot Money, Mercury (banking dashboard), Notion (tattilità delle card)
**Tone**: calmo, preciso, prima persona singolare, nessuna gamification

Vedi `DESIGN.md` per la direzione completa (colori, motion, componenti da personalizzare).

### Component Conventions
- **Forms**: dialog modale (import, transazione manuale/modifica)
- **Confirmation dialogs**: sempre per azioni distruttive (eliminazione transazione, conferma import duplicati)
- **Loading states**: skeleton sulla tabella transazioni e sulla griglia budget al caricamento iniziale
- **Notifications**: toast (sonner) in alto a destra, per conferme di salvataggio/import
- **Tables**: paginata (limit 50), azioni riga tramite dropdown menu (modifica/elimina)
- **Navigation**: sidebar con voci Home, Transazioni, Budget/Rendiconto, Conti; stato attivo in accent sage

## Integrations
Resend (invio OTP via email), OpenRouter (categorizzazione AI delle transazioni). Nessun'altra integrazione.

## Tech Stack
Next.js 16 · React 19 · TypeScript · Better Auth (Email OTP) · PostgreSQL via Docker (local) + managed Postgres (production) + Drizzle ORM · shadcn/ui · Tailwind 4 · OpenRouter

---

## Context for Your Agent

This project was scaffolded from Simo's Agentic Coding Boilerplate. Important rules:

- **Do NOT restore boilerplate placeholder content.** The following default pages exist in the boilerplate and must be completely replaced — not appended to:
  - `/` — interactive setup wizard (replace with login/dashboard redirect)
  - `/dashboard` — placeholder dashboard (replace with the real Home with the 3 indicators)
- Read `src/lib/schema.ts` to understand the data model before any database work.
- Read `DESIGN.md` at the project root before any UI work — it is the source of truth for the app's visual direction.
- Check `specs/finance-tracker/` for implementation decisions and task status.
- Follow all conventions in `AGENTS.md`.
- Use `src/lib/api-utils.ts` helpers for all API routes (applyRateLimit, requireApiAuth, parseBody, apiResponse, apiError).

## Spec Location
`specs/finance-tracker/`
- `requirements.md` — full requirements
- `implementation-plan.md` — phased task list with completion status
- `decisions.md` — architecture decisions
