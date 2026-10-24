# Finance Tracker

## What It Does
Monitora costi, ricavi e tasso di risparmio personali. Calcola automaticamente tre indicatori chiave (Risparmio, Fondo Tasse, Liquidità disponibile) a partire dalle transazioni importate dagli estratti conto di 6 conti fissi, categorizzate automaticamente tramite pattern storici e AI. Confronta un budget annuale (inserito manualmente per categoria e mese) con il consuntivo reale in un rendiconto mensile colorato verde/rosso. Include anche una sezione dedicata "Casa" che aggrega per anno le spese legate alla casa (acquisto, ristrutturazione, arredamento, accessori, utenze e manutenzione).

## Data Model

### New Tables
- **`finance_accounts`** — `userId`, `name`, `isSavingsAccount`, `openingBalance`, `openingBalanceDate`. Seedata automaticamente (6 conti fissi: BBVA, BCC, Paypal, Contanti, Conto Arancio, Conto Arancio Deposito) al primo accesso.
- **`categories`** — `userId`, `name`, `type` (`expense`/`income`), `isTaxPaymentCategory`, `isClientRevenueCategory`. Seedata automaticamente (24 categorie uscita + 7 entrata), non editabile da UI.
- **`transactions`** — `userId`, `accountId`, `categoryId` (nullable = da categorizzare), `date`, `description`, `amount`, `type`, `isInternalTransfer`, `source` (`import`/`manual`), `importBatchId`.
- **`budget_entries`** — `userId`, `year`, `month`, `categoryId`, `plannedAmount`. Vincolo unico su `(userId, year, month, categoryId)`.
- **`casa_manual_totals`** — `userId`, `section` (`acquisto`/`ristrutturazione`/`arredamento`/`accessori`/`utenze_manutenzione`), `year`, `amount`. Vincolo unico su `(userId, section, year)`. Memorizza i totali inseriti a mano per anni senza transazioni tracciate (es. 2025) o per sezioni senza categoria associata (es. "Acquisto").

### Modified Tables
Nessuna modifica di colonne — sostituita solo la categoria seed `ACQUISTI CASA` con 4 categorie più specifiche (vedi Notes).

## API Routes
- `GET /api/accounts` — lista conti con saldo corrente calcolato
- `PATCH /api/accounts/[id]` — aggiorna saldo di partenza
- `GET /api/categories` — lista categorie fisse dell'utente
- `GET /api/transactions` — lista transazioni filtrata (conto/categoria/tipo/periodo) e paginata
- `POST /api/transactions` — crea transazione manuale
- `PATCH /api/transactions/[id]` — modifica transazione
- `DELETE /api/transactions/[id]` — elimina transazione
- `POST /api/transactions/import/preview` — carica e valida un file CSV/XLSX, rileva duplicati e suggerisce categorie (senza inserire nulla)
- `POST /api/transactions/import/confirm` — inserisce le transazioni approvate dall'utente
- `GET /api/budget?year=` — budget entries per anno
- `PUT /api/budget` — upsert di una singola cella categoria×mese
- `GET /api/budget/actuals?year=` — consuntivo reale per categoria×mese
- `GET /api/dashboard/summary` — i 3 indicatori + breakdown (per usi client-side futuri; la Home li legge server-side direttamente)
- `GET /api/casa` — per ciascuna delle 5 sezioni Casa, totale per anno (2025 → anno corrente), manuale o calcolato dalle categorie associate
- `PUT /api/casa` — upsert del totale manuale di una sezione per un anno

## Key Files
- `src/lib/schema.ts` — tabelle `financeAccounts`, `categories`, `transactions`, `budgetEntries`
- `src/lib/finance/calculations.ts` — formule di Risparmio/Fondo Tasse/Liquidità/saldo conto
- `src/lib/finance/categories.ts` — lista fissa categorie + seed
- `src/lib/finance/accounts-seed.ts` — lista fissa conti + seed
- `src/lib/finance/import-parser.ts` — parsing CSV/XLSX con validazione bloccante
- `src/lib/finance/categorize.ts` — categorizzazione automatica (match storico + fallback OpenRouter)
- `src/lib/finance/casa-sections.ts` — mappatura sezione→categorie per la pagina Casa, costante `AUTO_TRACKING_START_YEAR` (2026) che determina da quale anno i totali diventano automatici
- `src/lib/finance/card-tones.ts` — palette decorativa (non semantica) usata per gli sfondi colorati di Home/Conti/Casa
- `src/components/finance/` — sidebar-nav, account-card, import-dialog, transaction-form, transactions-table, budget-grid, rendiconto-grid, indicator-card, casa-section-card
- `src/app/dashboard/` — home (indicatori), `accounts/`, `transactions/`, `budget/`, `casa/`
- `src/components/auth/auth-form.tsx` — login Email OTP (sostituisce il flusso email+password del boilerplate)

## Environment Variables
- `RESEND_API_KEY` / `RESEND_FROM_EMAIL` — invio del codice OTP via email (richiesto per il login reale)
- `OPENROUTER_API_KEY` / `OPENROUTER_MODEL` — categorizzazione automatica AI delle transazioni (opzionale; senza, le transazioni non riconosciute restano "da categorizzare")

## Notes for Future Development
- Il tasso fiscale (23%, regime forfettario) è una costante `TAX_RATE` in `src/lib/finance/calculations.ts`, non configurabile da UI — vedi `specs/finance-tracker/decisions.md` per il razionale.
- La categoria `"Clienti_CONSULENZA"` è stata normalizzata con underscore rispetto all'input originale dell'utente per rientrare nella regola "categorie che iniziano con Clienti_" usata nel calcolo del fatturato — verificare con l'utente se il nome o l'intento erano diversi.
- Il flag `isInternalTransfer` sulle transazioni è impostato manualmente dall'utente (nessun rilevamento automatico dei trasferimenti tra i propri conti) — esclude la riga dal Rendiconto/conto economico ma non dal saldo del conto.
- Non esiste un conto dedicato per la Carta di Credito BCC: i relativi addebiti si inseriscono come transazioni manuali sotto il conto BCC.
- L'app non ha più registrazione pubblica, recupero password o dark mode — queste superfici del boilerplate originale sono state rimosse/reindirizzate a `/login` perché il prodotto usa solo login Email OTP e light mode permanente.
- La categoria seed `ACQUISTI CASA` è stata sostituita con 4 categorie più specifiche: `CASA - RISTRUTTURAZIONE`, `CASA - ARREDAMENTO`, `CASA - MANUTENZIONE`, `CASA - COMPLEMENTI`. La migrazione dei dati già seedati per l'utente esistente è stata eseguita una tantum (nessuna transazione la referenziava ancora).
- La pagina Casa mappa le 5 sezioni così: Acquisto → nessuna categoria (sempre manuale, anche per 2026+); Ristrutturazione → `CASA - RISTRUTTURAZIONE`; Arredamento → `CASA - ARREDAMENTO`; Accessori → `CASA - COMPLEMENTI`; Utenze e manutenzione → somma di `UTENZE` (esistente) + `CASA - MANUTENZIONE`. Per gli anni ≥ `AUTO_TRACKING_START_YEAR` (2026) il totale è automatico dalle transazioni (esclusi i movimenti interni); per gli anni precedenti è sempre manuale.
- I toni colorati decorativi (`src/lib/finance/card-tones.ts`) sono separati dai colori semantici di `globals.css` (success/warning/destructive) usati nel Rendiconto — servono solo a rendere più "energiche" le card di Home/Conti/Casa, nessun significato di stato.
- `parseAmount` in `import-parser.ts` **non assume più una locale fissa**: rileva automaticamente quale separatore (`,` o `.`) sia quello decimale guardando quello più a destra seguito da 1-2 cifre — necessario perché gli export BBVA mescolano la convenzione italiana (`1.234,56`) e quella inglese (`1,234.56`) nello stesso file a seconda dell'importo. Importi con il simbolo `€` e segno `-` sono normalizzati (il segno viene scartato, la direzione viene sempre dalla colonna entrata/uscita). Il tipo accetta anche le sigle singole `U`/`E` oltre a "uscita"/"entrata", e le date accettano anche anni a 2 cifre.
- La categoria `UTENZE` esiste sia come uscita (bollette) sia come entrata (es. rimborsi/chiusure contrattuali) — stesso nome, `type` diverso, nessun conflitto nello schema. Nella sezione Casa "Utenze e manutenzione", l'entrata `UTENZE` viene **sottratta** dal totale di uscite `UTENZE` + `CASA - MANUTENZIONE` (mostra il costo netto, mai sotto zero). Qualunque query che raggruppa per nome categoria deve restare filtrata anche per `type`, altrimenti le due categorie si sommano per errore.
