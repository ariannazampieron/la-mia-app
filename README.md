# Finance Tracker

App personale per monitorare costi, ricavi e tasso di risparmio, basata sull'import di estratti conto, con budget annuale e conto economico (rendiconto) mensile.

## Funzionalità

- **Home** — tre indicatori calcolati automaticamente: Risparmio, Fondo Tasse e Liquidità disponibile, aggiornati in tempo reale dalle transazioni.
- **Conti** — 5 conti fissi (BBVA, BCC, Paypal, Conto Arancio, Conto Arancio Deposito) con saldo di partenza impostabile una tantum e saldo corrente calcolato automaticamente.
- **Import estratti conto** — carica file `.csv` o `.xlsx` con colonne data/descrizione/importo/entrata-uscita/categoria; validazione bloccante sugli errori e rilevamento duplicati con conferma manuale.
- **Categorizzazione automatica** — le transazioni ricorrenti vengono categorizzate in automatico (pattern storici + AI via OpenRouter); quelle non riconosciute restano segnalate come "da categorizzare".
- **Transazioni** — tabella filtrabile per conto, categoria, tipo e periodo, con aggiunta/modifica manuale (utile ad esempio per gli addebiti della carta di credito).
- **Budget & Rendiconto** — budget annuale per categoria e mese, confrontato con il consuntivo reale, con evidenziazione verde/rosso; storico multi-anno.
- **Accesso** — login con codice OTP via email (nessuna password, nessuna registrazione pubblica).

## Setup

### Prerequisiti
- Node.js 20+, pnpm, Docker Desktop (per il database locale)

### Installazione
1. Clona il repository
2. `pnpm install`
3. `cp env.example .env` e compila i valori richiesti
4. `docker compose up -d` per avviare PostgreSQL in locale
5. `pnpm run db:migrate` per applicare le migrazioni
6. `pnpm dev` per avviare l'app in sviluppo

### Variabili d'ambiente

Vedi `env.example` per l'elenco completo. In sintesi:

- `POSTGRES_URL` — connessione al database (richiesto)
- `BETTER_AUTH_SECRET` — chiave segreta per le sessioni (richiesto)
- `RESEND_API_KEY` / `RESEND_FROM_EMAIL` — invio del codice OTP via email (richiesto per il login)
- `OPENROUTER_API_KEY` — categorizzazione automatica delle transazioni importate (opzionale: senza, le transazioni non riconosciute restano "da categorizzare" per l'assegnazione manuale)

## Tech Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Better Auth (Email OTP) · PostgreSQL + Drizzle ORM · shadcn/ui · Tailwind CSS 4 · OpenRouter (Vercel AI SDK)

## Sviluppo

- `pnpm dev` — avvia il server di sviluppo
- `pnpm check` — lint + type checking
- `pnpm run db:generate` — genera le migrazioni dopo modifiche allo schema
- `pnpm run db:migrate` — applica le migrazioni
- `pnpm run db:studio` — apre Drizzle Studio (GUI del database)

## Documentazione

- `DESIGN.md` — direzione estetica del progetto
- `docs/features/finance-tracker.md` — dettaglio tecnico della feature
- `docs/business/starter-prompt.md` — contesto di progetto per futuri agenti AI
