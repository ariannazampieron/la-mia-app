# Finance Tracker

## What It Does
Monitora costi, ricavi e tasso di risparmio personali. In Home mostra gli obiettivi di risparmio e copertura delle tasse e gli indicatori chiave (Risparmio, Fondo Tasse, Liquidità c/c, Patrimonio, Disponibilità) a partire dalle transazioni importate dagli estratti conto di 6 conti fissi, categorizzate automaticamente tramite pattern storici e AI. Budget & Rendiconto è una tabella in stile conto economico (ricavi/costi per categoria, totali in grassetto, cash flow e liquidità proiettata mese per mese) in due varianti: Budget (pianificato, editabile) e Rendiconto (reale, con variance verde/rosso per categoria). Include anche una sezione dedicata "Casa" che aggrega per anno le spese legate alla casa (acquisto, ristrutturazione, arredamento, accessori, utenze e manutenzione).

## Data Model

### New Tables
- **`finance_accounts`** — `userId`, `name`, `isSavingsAccount`, `openingBalance`, `openingBalanceDate`. Seedata automaticamente (6 conti fissi: BBVA, BCC, Paypal, Contanti, Conto Arancio, Conto Arancio Deposito) al primo accesso.
- **`categories`** — `userId`, `name`, `type` (`expense`/`income`), `isTaxPaymentCategory`, `isClientRevenueCategory`. Seedata automaticamente (24 categorie uscita + 7 entrata), non editabile da UI.
- **`transactions`** — `userId`, `accountId`, `categoryId` (nullable = da categorizzare), `date`, `description`, `amount`, `type`, `isInternalTransfer`, `source` (`import`/`manual`), `importBatchId`, `cashSourceId` (solo sull'entrata "Contanti" generata da un prelievo: punta al prelievo sul conto bancario, `onDelete: cascade`).
- **`budget_entries`** — `userId`, `year`, `month`, `categoryId`, `plannedAmount`. Vincolo unico su `(userId, year, month, categoryId)`.
- **`casa_manual_totals`** — `userId`, `section` (`acquisto`/`ristrutturazione`/`arredamento`/`accessori`/`utenze_manutenzione`), `year`, `amount`. Vincolo unico su `(userId, section, year)`. Memorizza i totali inseriti a mano per anni senza transazioni tracciate (es. 2025) o per sezioni senza categoria associata (es. "Acquisto").
- **`budget_opening_balance`** — `userId`, `year`, `month`, `amount`. Vincolo unico su `(userId, year, month)`. Override manuale del saldo di apertura usato solo dal tab **Budget** (pianificato) per proiettare la liquidità futura mese per mese — il tab **Rendiconto** non ne ha bisogno: il saldo reale si calcola sempre da `finance_accounts.openingBalance` + transazioni reali precedenti al mese.
- **`user_settings`** — `userId` (PK), `lastStatementImportDate`, `houseValue`, `investmentsValue`, `pensionFundBase`, `pensionFundSince`. Una riga per utente con le preferenze dell'app; i valori del patrimonio a null usano i default di `src/lib/finance/patrimonio.ts`.

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
- `GET/PUT /api/settings` — impostazioni utente; oggi solo `lastStatementImportDate`, la data dell'ultimo import degli estratti conto scritta a mano nella casella "Ultimo import" accanto al pulsante di import in Transazioni (promemoria, non aggiornata in automatico)
- `POST /api/transactions/import/preview` — carica e valida un file CSV/XLSX, rileva duplicati e suggerisce categorie (senza inserire nulla)
- `POST /api/transactions/import/confirm` — inserisce le transazioni approvate dall'utente
- `GET /api/budget?year=` — budget entries + saldo di apertura/chiusura, ricavi/costi/cash flow pianificati per ciascuno dei 12 mesi (saldo proiettato a cascata da `budget_opening_balance` + `budget_entries` di tutti gli anni fino a quello richiesto)
- `PUT /api/budget` — upsert di una singola cella categoria×mese
- `POST /api/budget/import` — upsert massivo delle celle di un anno (import da Excel: colonna A = voce, colonne B–M = gen–dic, prima riga opzionale con i mesi da cui si ricava l'anno). Le celle vuote del file non vengono toccate.
- `PUT /api/budget/opening-balance` — upsert del saldo di apertura manuale (solo tab Budget) per un mese
- `GET /api/budget/actuals?year=` — consuntivo reale per categoria×mese + saldi reali di **tutti i conti** (come la pagina Conti) concatenati mese su mese, ricavi/costi/cash flow e `otherMovements` (giroconti e righe non categorizzate) per ciascuno dei 12 mesi
- `GET /api/budget/review?year=` — `closedThroughMonth`: ultimo mese chiuso, dalla data dell'ultimo import scritta in Transazioni (un mese è chiuso quando quella data arriva al suo ultimo giorno)
- `GET /api/dashboard/summary` — i 3 indicatori + breakdown (per usi client-side futuri; la Home li legge server-side direttamente)
- `GET /api/casa` — per ciascuna delle 5 sezioni Casa, totale per anno (2025 → anno corrente), manuale o calcolato dalle categorie associate
- `PUT /api/casa` — upsert del totale manuale di una sezione per un anno

## Key Files
- `src/lib/schema.ts` — tabelle `financeAccounts`, `categories`, `transactions`, `budgetEntries`
- `src/lib/finance/calculations.ts` — saldi dei conti, fatturato, imposte pagate, saldo mensile del conto di risparmio
- `src/lib/finance/tax-overview.ts` — tasse da pagare e divisione del Conto Deposito in Fondo Tasse e Risparmio
- `src/lib/finance/categories.ts` — lista fissa categorie + seed
- `src/lib/finance/accounts-seed.ts` — lista fissa conti + seed
- `src/lib/finance/import-parser.ts` — parsing CSV/XLSX con validazione bloccante
- `src/lib/finance/categorize.ts` — categorizzazione automatica (match storico + fallback OpenRouter)
- `src/lib/finance/casa-sections.ts` — mappatura sezione→categorie per la pagina Casa, costante `AUTO_TRACKING_START_YEAR` (2026) che determina da quale anno i totali diventano automatici
- `src/lib/finance/card-tones.ts` — palette decorativa (navy/teal/purple/gold/coral/sage, presa dai bullet-dot dell'app di riferimento) usata per gli sfondi/bordi colorati di Home/Conti/Casa
- `src/components/finance/conto-economico-table.tsx` — tabella unificata Budget/Rendiconto in stile conto economico (sostituisce i vecchi `budget-grid.tsx`/`rendiconto-grid.tsx`): righe saldo inizio mese, sezione Entrate + totale, sezione Costi + totale, cash flow, altri movimenti (solo Rendiconto/Review, se presenti), saldo fine mese. Tre modalità: `budget`, `rendiconto`, `review`. Ogni riga termina con Totale e Media mensile (Budget: totale/12; Rendiconto: totale/mesi da gennaio all'ultimo mese con almeno una transazione categorizzata, così i mesi senza spesa in una categoria contano come zero); nel Rendiconto anche Budget anno e % budget raggiunta (rossa se una spesa supera il budget, verde se un ricavo lo raggiunge)
- `src/components/finance/budget-import-dialog.tsx` — dialog "Importa da Excel" del tab Budget: legge il file nel browser, abbina le voci alle categorie per nome (poi per la parte prima di "/", es. PREVIDENZA/POLIZZE → PREVIDENZA), mostra l'anteprima con abbinamento modificabile
- **Casa — voci**: ogni riquadro della pagina Casa ha "Vedi le voci" (`CasaDetailsDialog` → `GET /api/casa/details?section=`): per ogni anno le transazioni considerate (rimborsi in negativo) oppure, se il totale è inserito a mano, l'avviso che il dettaglio non è nell'app.
- `src/components/finance/` — sidebar-nav, account-card, import-dialog, transaction-form, transactions-table, conto-economico-table, indicator-card, casa-section-card (anche `CasaValueCard`: riquadro verde "Valore casa" = totale Acquisto + Ristrutturazione + Arredamento, tutti gli anni)
- `src/app/dashboard/` — home (indicatori), `accounts/`, `transactions/`, `budget/`, `casa/`
- `src/components/auth/auth-form.tsx` — login Email OTP (sostituisce il flusso email+password del boilerplate)
- `src/lib/db.ts` — client Postgres cache-ato su `globalThis` in sviluppo per sopravvivere all'HMR di Next.js senza esaurire `max_connections` (vedi Notes)
- `public/logo.png` — logo dell'utente, usato nella sidebar

## Environment Variables
- `RESEND_API_KEY` / `RESEND_FROM_EMAIL` — invio del codice OTP via email (richiesto per il login reale)
- `OPENROUTER_API_KEY` / `OPENROUTER_MODEL` — categorizzazione automatica AI delle transazioni (opzionale; senza, le transazioni non riconosciute restano "da categorizzare")

## Notes for Future Development
- La categoria `"Clienti_CONSULENZA"` è stata normalizzata con underscore rispetto all'input originale dell'utente per rientrare nella regola "categorie che iniziano con Clienti_" usata nel calcolo del fatturato — verificare con l'utente se il nome o l'intento erano diversi.
- Il flag `isInternalTransfer` esclude la riga dal Rendiconto/conto economico ma non dal saldo del conto. All'import viene attivato in automatico (`isInternalMovement` in `categorize.ts`) quando la descrizione contiene "giroconto", "ritiro contanti", "prelievo", "prelevamento" o "Trasferimento avviato dall'utente" (prelievo PayPal verso la banca): quelle righe restano senza categoria e non passano né dallo storico né dall'AI. Nell'anteprima la spunta "Interno" si può togliere o mettere riga per riga; dopo l'import resta modificabile dalla transazione. I **prelievi** (uscite con "ritiro contanti", "rit. contanti", "prelievo", "prelevamento") hanno anche la spunta "Prelievo" (che implica "Interno"): alla conferma, nella stessa transazione DB, viene creata un'entrata uguale sul conto "Contanti" (`CASH_ACCOUNT_NAME`), interna e senza categoria, con descrizione "Prelievo da <conto>: …". Così il saldo Contanti sale con i prelievi e scende con le spese in contanti registrate a mano: un saldo che resta alto indica spese non tracciate. L'entrata su Contanti è collegata al prelievo tramite `cashSourceId` (logica in `src/lib/finance/cash-withdrawal.ts`): eliminando il prelievo sparisce anche lei, e modificandone data/importo/descrizione si aggiorna. Anche il form di aggiunta/modifica transazione ha la spunta "Prelievo in contanti" (solo uscite su conti diversi da Contanti), che crea o rimuove l'entrata; l'elenco transazioni restituisce `isCashWithdrawal` per sapere se una riga ce l'ha.
- Non esiste un conto dedicato per la Carta di Credito BCC: i relativi addebiti si inseriscono come transazioni manuali sotto il conto BCC.
- L'app non ha più registrazione pubblica, recupero password o dark mode — queste superfici del boilerplate originale sono state rimosse/reindirizzate a `/login` perché il prodotto usa solo login Email OTP e light mode permanente.
- La categoria seed `ACQUISTI CASA` è stata sostituita con 4 categorie più specifiche: `CASA - RISTRUTTURAZIONE`, `CASA - ARREDAMENTO`, `CASA - MANUTENZIONE`, `CASA - COMPLEMENTI`. La migrazione dei dati già seedati per l'utente esistente è stata eseguita una tantum (nessuna transazione la referenziava ancora).
- La pagina Casa mappa le 5 sezioni così: Acquisto → nessuna categoria (sempre manuale, anche per 2026+); Ristrutturazione → `CASA - RISTRUTTURAZIONE`; Arredamento → `CASA - ARREDAMENTO`; Accessori → `CASA - COMPLEMENTI`; Utenze e manutenzione → somma di `UTENZE` (esistente) + `CASA - MANUTENZIONE`. Per gli anni ≥ `AUTO_TRACKING_START_YEAR` (2026) il totale è automatico dalle transazioni (esclusi i movimenti interni); per gli anni precedenti è sempre manuale.
- I toni colorati decorativi (`src/lib/finance/card-tones.ts`) sono separati dai colori semantici di `globals.css` (success/warning/destructive) usati nel Rendiconto — servono solo a rendere più "energiche" le card di Home/Conti/Casa, nessun significato di stato.
- `parseAmount` in `import-parser.ts` **non assume più una locale fissa**: rileva automaticamente quale separatore (`,` o `.`) sia quello decimale guardando quello più a destra seguito da 1-2 cifre — necessario perché gli export BBVA mescolano la convenzione italiana (`1.234,56`) e quella inglese (`1,234.56`) nello stesso file a seconda dell'importo. Importi con il simbolo `€` e segno `-` sono normalizzati (il segno viene scartato, la direzione viene sempre dalla colonna entrata/uscita). Il tipo accetta anche le sigle singole `U`/`E` oltre a "uscita"/"entrata", e le date accettano anche anni a 2 cifre.
- La categoria `UTENZE` esiste sia come uscita (bollette) sia come entrata (es. rimborsi/chiusure contrattuali) — stesso nome, `type` diverso, nessun conflitto nello schema. Nella sezione Casa "Utenze e manutenzione", l'entrata `UTENZE` viene **sottratta** dal totale di uscite `UTENZE` + `CASA - MANUTENZIONE` (mostra il costo netto, mai sotto zero). Qualunque query che raggruppa per nome categoria deve restare filtrata anche per `type`, altrimenti le due categorie si sommano per errore.
- **Redesign (2026-10-25)**: direzione visiva passata da "Soft-Tactile" (sage/warm) a "Technical-Utility" (navy `#1E2A52` + teal `#14B8A6`, sfondo bianco) su richiesta esplicita dell'utente, con riferimento diretto a screenshot di un'altra app sua ("LOOP — Gestione Economica") e al proprio logo. Vedi `DESIGN.md` revisione 2 per il dettaglio completo — non tornare alla direzione precedente.
- **`src/lib/db.ts` — fix connessioni esaurite**: il client Postgres veniva ricreato ad ogni hot-reload di Next.js in sviluppo senza chiudere il precedente, esaurendo `max_connections` dopo ore di sessione `pnpm dev` attiva (errore Postgres `53300 too_many_connections`). Ora è cache-ato su `globalThis.__pgClient` in sviluppo (pattern standard Next.js+HMR) con `max: 10` connessioni nel pool. Se l'errore si ripresenta: `docker restart la-mia-app-postgres-1` libera le connessioni senza perdere dati (volume persistente).
- **Budget vs Rendiconto — saldo proiettato vs reale**: il tab Budget proietta la liquidità futura a cascata (mese N+1 = chiusura mese N, salvo override manuale in `budget_opening_balance`) usando i valori PIANIFICATI; il tab Rendiconto usa la somma REALE di tutti i conti (saldi iniziali + tutte le transazioni), con l'apertura di ogni mese uguale alla chiusura del precedente e la chiusura dell'ultimo mese importato uguale al totale della pagina Conti. Saldo inizio + cash flow + altri movimenti = saldo fine.
- **Review**: tab accanto al Rendiconto (`buildReview` in `src/lib/finance/review.ts`). Mesi chiusi = dati reali (sola lettura, in grigio); mesi aperti = il budget stesso: modificarli nella Review modifica il budget (`PUT /api/budget`). I saldi seguono quelli reali fino all'ultimo mese chiuso, poi proseguono con i flussi del budget. Colonne finali confrontate con il budget annuale. Il Rendiconto si confronta solo con il budget.
- **Gruppi di spesa**: nella sezione Costi le categorie sono raccolte in gruppi richiudibili (chiusi all'apertura) con il subtotale per mese e le colonne finali: Spese di sopravvivenza, Spese lavorative (con Elettronica e Tool lavoro), Spese extra (tutto il resto, compreso Tool personali). L'elenco è in `src/lib/finance/expense-groups.ts`.

## Home

Pagina riassuntiva, con una grafica diversa dalle altre (`src/app/dashboard/page.tsx`). In alto il titolo e la data dell'ultimo import (`LastImportNote`, anche nella pagina Conti).

**Logica di Risparmio e Fondo Tasse** (`getTaxOverview` in `src/lib/finance/tax-overview.ts`): si parte dal saldo del conto di risparmio (Conto Arancio Deposito). Il **Fondo Tasse** è la parte del saldo che copre le tasse maturate a oggi (residuo dell'anno corrente + stima dell'anno successivo, come in "Fatturato e imposte"), mai più del saldo; il **Risparmio** è il resto. Non esiste più l'accantonamento al 23% del fatturato.

1. **Obiettivi** — fascia navy a tutta larghezza (`GoalProgress`): Obiettivo 1, il Risparmio copre `SAFETY_MONTHS_GOAL` (8) mesi di spese di sopravvivenza (media da Analisi costi); Obiettivo 2, il Fondo Tasse copre il 100% delle tasse maturate. Anello di avanzamento, importi, frase incoraggiante per fascia di avanzamento e stima di quando si raggiunge al ritmo di risparmio dell'anno (il fondo tasse si riempie per primo). Calcoli in `computeHomeGoals` (`src/lib/finance/scenarios.ts`).
2. **Scenario: perdo il lavoro** — mesi coperti: pagate le tasse = Risparmio ÷ sopravvivenza; ignorando le tasse = tutto il Conto Deposito ÷ sopravvivenza.
3. **Il dettaglio** — Risparmio, Fondo tasse (con le tasse da pagare per anno e quanto manca a coprirle), Liquidità c/c, Patrimonio (casa, investimenti e valore iniziale del fondo pensione modificabili; al fondo si sommano le uscite "FONDO PENSIONE" dal 1/11/2026), Disponibilità = Liquida (Conto Deposito + c/c − tasse da pagare) + Bloccata (patrimonio). Variante `tinted` di `IndicatorCard`, Disponibilità `solid`.
4. **Quanto hai risparmiato davvero** — per ogni mese entrate − uscite del Rendiconto (categorizzate, non interne), con grafico a colonne (mesi negativi sotto lo zero) e tabella Entrate / Uscite / Risparmiato con il totale (`SavingsChart`, dati da `getMonthlySaved` in `src/lib/finance/monthly-savings.ts`). Correzioni: le uscite in ACCANTONAMENTO non sono spese ma risparmio (`SAVINGS_EXPENSE_CATEGORIES`); il trasferimento in entrata di aprile 2026 (ALTRO, 10.317,82 €, il vecchio fondo dell'accantonamento) non è un'entrata (`ONE_OFF_TRANSFERS_IN`). La media mensile è anche il ritmo usato per stimare quando si raggiungono gli obiettivi.
