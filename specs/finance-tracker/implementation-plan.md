# Implementation Plan: Finance Tracker

## Overview
Costruiamo lo schema dati e la shell dell'app per prime (fondamenta condivise), poi i conti, poi la pipeline di import/categorizzazione (il cuore dell'app), poi la vista transazioni, poi budget/rendiconto, e infine la home con gli indicatori calcolati — che dipende da tutto il resto. Un'unica feature (`finance-tracker`): è un'app a singola capacità, non un insieme di feature separate.

## Phase 1: Database Schema & Category Seed [L] [feature: finance-tracker]

Crea le tabelle per conti, categorie, transazioni e budget, più la logica di seed delle categorie fisse (non editabili da UI).

### Tasks
- [x] [wave:1] Aggiungere a `src/lib/schema.ts` le tabelle `financeAccounts`, `categories`, `transactions`, `budgetEntries` (vedi Technical Details)
- [x] [wave:2] Eseguire `pnpm run db:generate` e `pnpm run db:migrate` (blocked by: wave:1)
- [x] [wave:2] Creare `src/lib/finance/categories.ts` con la lista fissa delle 24 categorie uscita + 7 entrata e la funzione `ensureCategoriesSeeded(userId)` (blocked by: wave:1)
- [x] [wave:2] Creare `src/lib/finance/accounts-seed.ts` con la lista fissa dei 5 conti e la funzione `ensureAccountsSeeded(userId)` (blocked by: wave:1)
- [x] [wave:3] Richiamare `ensureCategoriesSeeded` e `ensureAccountsSeeded` da `src/app/dashboard/layout.tsx` dopo `requireAuth()`, prima di renderizzare i children (blocked by: wave:2)

### Technical Details

Aggiungere in `src/lib/schema.ts` (dopo le tabelle di Better Auth esistenti):

```typescript
import { pgTable, text, timestamp, boolean, index, uuid, numeric, integer, date, unique } from "drizzle-orm/pg-core";

export const accounts = pgTable("accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // "BBVA" | "BCC" | "Paypal" | "Conto Arancio" | "Conto Arancio Deposito"
  isSavingsAccount: boolean("is_savings_account").default(false).notNull(),
  openingBalance: numeric("opening_balance", { precision: 12, scale: 2 }).default("0").notNull(),
  openingBalanceDate: date("opening_balance_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => [index("accounts_user_id_idx").on(t.userId)]);

export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type", { enum: ["expense", "income"] }).notNull(),
  isTaxPaymentCategory: boolean("is_tax_payment_category").default(false).notNull(),
  isClientRevenueCategory: boolean("is_client_revenue_category").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("categories_user_id_idx").on(t.userId)]);

export const transactions = pgTable("transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
  date: date("date").notNull(),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(), // always positive; sign comes from `type`
  type: text("type", { enum: ["income", "expense"] }).notNull(),
  isInternalTransfer: boolean("is_internal_transfer").default(false).notNull(),
  source: text("source", { enum: ["import", "manual"] }).notNull().default("manual"),
  importBatchId: uuid("import_batch_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => [
  index("transactions_user_id_idx").on(t.userId),
  index("transactions_account_id_idx").on(t.accountId),
  index("transactions_category_id_idx").on(t.categoryId),
  index("transactions_date_idx").on(t.date),
]);

export const budgetEntries = pgTable("budget_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  year: integer("year").notNull(),
  month: integer("month").notNull(), // 1-12
  categoryId: uuid("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
  plannedAmount: numeric("planned_amount", { precision: 12, scale: 2 }).default("0").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => [
  index("budget_entries_user_year_idx").on(t.userId, t.year),
  unique("budget_entries_unique_cell").on(t.userId, t.year, t.month, t.categoryId),
]);
```

Lista fissa categorie per `src/lib/finance/categories.ts` (usare esattamente questi nomi):

```typescript
export const EXPENSE_CATEGORIES = [
  "ELETTRONICA", "AUTO/TRASPORTI", "BEAUTY", "MUTUO", "ACQUISTI CASA",
  "CIBO CASA", "EXTRA", "FORMAZIONE", "IMPOSTE", "RISTORANTE/BAR",
  "PREVIDENZA", "REGALI", "SALUTE", "SPESE BANCARIE", "STIPENDI",
  "TOOL", "FONDO PENSIONE", "TELEFONO", "INTERNET", "UTENZE",
  "VESTIARIO", "COMMERCIALISTA", "VIAGGI", "ACCANTONAMENTO",
] as const;

// NOTE: "Clienti_CONSULENZA" normalizzato con underscore per coerenza con la regola
// "isClientRevenueCategory = nome che inizia con Clienti_" — vedi decisions.md.
export const INCOME_CATEGORIES = [
  "Clienti_LOOP", "Clienti_WIT", "Clienti_LEARNN", "Clienti_CONSULENZA",
  "Clienti_OVER5IZE", "INTERESSI", "ALTRO",
] as const;

export function isTaxPaymentCategory(name: string) {
  return name === "IMPOSTE";
}
export function isClientRevenueCategory(name: string) {
  return name.startsWith("Clienti_");
}
```

`ensureCategoriesSeeded(userId)`: query `categories` where `userId` — se vuoto, inserisce tutte le `EXPENSE_CATEGORIES` (type: "expense") e `INCOME_CATEGORIES` (type: "income") in un'unica `db.insert(categories).values([...])`, impostando i flag con `isTaxPaymentCategory`/`isClientRevenueCategory`. Nessuna UI per crearle/modificarle: sono dati di riferimento fissi.

`ensureAccountsSeeded(userId)`: stessa logica con i 5 nomi fissi (`BBVA`, `BCC`, `Paypal`, `Conto Arancio`, `Conto Arancio Deposito`), `isSavingsAccount: true` solo per `"Conto Arancio Deposito"`, `openingBalance: "0"`.

### Files to Read
`src/lib/schema.ts`, `drizzle.config.ts`, `src/app/dashboard/layout.tsx`, `src/lib/db.ts`

---

## Phase 2: App Shell & Design System [M] [feature: finance-tracker] (blocked by: Phase 1 wave:1 for shared layout only, can start in parallel otherwise)

Sostituisce lo shell placeholder del boilerplate con la sidebar reale e applica la direzione visiva definita in `DESIGN.md`.

### Tasks
- [x] [wave:1] Installare i componenti shadcn mancanti: `pnpm dlx shadcn@latest add table tabs card dialog select dropdown-menu badge calendar popover form`
- [x] [wave:1] Aggiungere libreria di parsing import: `pnpm add xlsx`
- [x] [wave:1] Aggiornare `src/app/globals.css`: tokens `--background`, `--foreground`, `--primary`, `--card`, `--border`, `--destructive` secondo i valori in `DESIGN.md`, più due nuovi token `--success` e `--warning`
- [x] [wave:1] Forzare light mode: in `src/components/theme-provider.tsx` o nel punto in cui viene istanziato, impostare `forcedTheme="light"` (nessun toggle dark mode in UI)
- [x] [wave:2] Creare `src/components/finance/sidebar-nav.tsx`: sidebar fissa con voci Home, Transazioni, Budget/Rendiconto, Conti (icone da `lucide-react`, stato attivo con accent sage) (blocked by: wave:1)
- [x] [wave:2] Aggiornare `src/app/dashboard/layout.tsx` per usare la sidebar invece del layout placeholder (blocked by: wave:2)
- [x] [wave:3] Sostituire interamente `src/app/page.tsx` (setup wizard boilerplate): se non autenticato, redirect a `/login` (o alla route gestita da `(auth)`); se autenticato, redirect a `/dashboard` (blocked by: wave:2)
- [x] [wave:3] Sostituire il contenuto placeholder di `src/app/dashboard/page.tsx` con uno scheletro vuoto pronto per la Phase 8 (non lasciare contenuto boilerplate visibile) (blocked by: wave:2)
- [x] [wave:3] Riscrivere `src/components/auth/auth-form.tsx` (solo `mode="login"`) per usare il flusso Email OTP invece di password/Google: step 1 input email + bottone "Invia codice" che chiama `authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" })`; step 2 input codice a 6 cifre + bottone "Accedi" che chiama `authClient.signIn.emailOtp({ email, otp })` e poi `router.push("/dashboard")`. Rimuovere dalla UI i campi password e il bottone Google (restano registrati lato server ma non esposti) (blocked by: wave:2)

### Technical Details
- Font: nessun nuovo font da caricare — Geist Sans/Mono sono già configurati via `next/font` nel boilerplate; usare `font-mono` di Tailwind per tutte le cifre monetarie.
- Il layout `src/app/dashboard/layout.tsx` oggi è un wrapper semplice: deve diventare `<div className="flex"><SidebarNav /><main className="flex-1 max-w-6xl mx-auto p-6 md:p-10">{children}</main></div>` (adattare ai componenti reali di `src/components/user-header.tsx` già esistenti, da mantenere in testa al main).
- Badge di stato "Da categorizzare" e "Sopra/Sotto budget" (usati nelle fasi successive) devono usare la variante `badge` con colori semantici `--success`/`--warning`/`--destructive`, non i default neutri di shadcn.

### Files to Read
`src/app/dashboard/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `src/components/theme-provider.tsx`, `src/components/user-header.tsx`, `DESIGN.md`

---

## Phase 3: Accounts Setup [S] [feature: finance-tracker] (blocked by: Phase 1, Phase 2)

Pagina per impostare il saldo di partenza dei 5 conti fissi.

### Tasks
- [x] [wave:1] Creare `src/app/api/accounts/route.ts` — `GET` (lista conti dell'utente, chiama `ensureAccountsSeeded` se vuoto, calcola saldo corrente sommando le transazioni)
- [x] [wave:1] Creare `src/app/api/accounts/[id]/route.ts` — `PATCH` per aggiornare `openingBalance` e `openingBalanceDate` (validato con Zod, solo questi due campi sono modificabili)
- [x] [wave:2] Creare `src/app/dashboard/accounts/page.tsx` — elenco dei 5 conti come card, ciascuna con nome, saldo di partenza editabile (form inline), saldo corrente calcolato in sola lettura (blocked by: wave:1)
- [x] [wave:2] Aggiungere voce "Conti" alla sidebar da Phase 2 (blocked by: wave:1) — già inclusa nella sidebar costruita in Phase 2

### Technical Details
Calcolo saldo corrente di un conto (riusato anche in Phase 8):
```typescript
// src/lib/finance/calculations.ts
export async function getAccountBalance(accountId: string): Promise<number> {
  const account = await db.select({ openingBalance: accounts.openingBalance })
    .from(accounts).where(eq(accounts.id, accountId)).limit(1);
  const txs = await db.select({ amount: transactions.amount, type: transactions.type })
    .from(transactions).where(eq(transactions.accountId, accountId));
  const signedSum = txs.reduce((sum, t) =>
    sum + (t.type === "income" ? Number(t.amount) : -Number(t.amount)), 0);
  return Number(account[0].openingBalance) + signedSum;
}
```
Nota: `isInternalTransfer` NON esclude la transazione dal calcolo del saldo — esclude solo dal Rendiconto (Phase 7). Un trasferimento tra conti è denaro reale che si muove.

Ogni route segue il pattern obbligatorio di `src/lib/api-utils.ts`: `applyRateLimit(RATE_LIMITS.api)` + `requireApiAuth()` + `parseBody` con Zod per il PATCH.

### Files to Read
`src/lib/api-utils.ts`, `src/lib/rate-limit.ts`, `src/lib/finance/accounts-seed.ts`, `src/lib/schema.ts`

---

## Phase 4: Transaction Import (CSV/XLSX) + Duplicate Detection [L] [feature: finance-tracker] (blocked by: Phase 1, Phase 3)

La pipeline centrale: upload file → parse → valida → rileva duplicati → anteprima → conferma → inserimento.

### Tasks
- [x] [wave:1] Creare `src/lib/finance/import-parser.ts`: funzione `parseStatementFile(buffer: Buffer, filename: string)` che usa `xlsx` (gestisce sia `.csv` che `.xlsx` con la stessa API `XLSX.read`) e ritorna righe tipizzate `{ date, description, amount, type, categoryName }[]` oppure un elenco di errori per riga (numero riga + motivo)
- [x] [wave:1] Creare schema Zod per la riga parsata in `src/lib/finance/import-parser.ts` (data valida, importo numerico positivo, type in `["entrata","uscita"]` mappato a `income`/`expense`)
- [x] [wave:2] Creare `src/app/api/transactions/import/preview/route.ts` — `POST` multipart: riceve il file + `accountId`, chiama `parseStatementFile`; se ci sono errori di validazione ritorna `apiError` con l'elenco righe/motivi (import bloccato, nulla inserito); se valido, per ogni riga verifica duplicati esistenti (stesso `accountId` + `date` + `amount` + `description` normalizzata case-insensitive trim) e ritorna `{ newRows, duplicateRows }` con categoria già suggerita (chiama la funzione di categorizzazione di Phase 5) (blocked by: wave:1)
- [x] [wave:2] Creare `src/app/api/transactions/import/confirm/route.ts` — `POST`: riceve l'elenco finale di righe approvate dall'utente (incluse eventuali `duplicateRows` che l'utente ha scelto comunque di importare) e le inserisce in `transactions` con `source: "import"` e un `importBatchId` condiviso (blocked by: wave:1)
- [x] [wave:3] Creare `src/components/finance/import-dialog.tsx` — dialog `ease-settle` con: step 1 selezione conto + file; step 2 anteprima con due sezioni "Nuove transazioni" / "Possibili duplicati" (checkbox per includere i duplicati), categoria suggerita editabile riga per riga prima di confermare (blocked by: wave:2)
- [x] [wave:3] Collegare il bottone primario "Importa estratto conto" (pagina Transazioni, Phase 6) al dialog (blocked by: wave:2) — fatto in Phase 6

### Technical Details
Formato CSV/XLSX fisso (colonne, in quest'ordine o per nome header): `data, descrizione, importo, entrata/uscita, categoria`. Mappare `entrata` → `type: "income"`, `uscita` → `type: "expense"`. Se la colonna `categoria` contiene un nome che corrisponde esattamente (case-insensitive) a una categoria esistente dell'utente con lo stesso `type`, usarla direttamente — altrimenti trattarla come vuota e passare alla pipeline di categorizzazione automatica (Phase 5).

Rilevamento duplicati — query:
```typescript
const existing = await db.select().from(transactions).where(and(
  eq(transactions.accountId, accountId),
  eq(transactions.date, row.date),
  eq(transactions.amount, row.amount.toFixed(2)),
));
const isDuplicate = existing.some(e =>
  e.description.trim().toLowerCase() === row.description.trim().toLowerCase()
);
```

Validazione bloccante: se anche una sola riga fallisce lo schema Zod, l'endpoint preview ritorna errore con l'elenco completo (non si ferma al primo) — niente viene scritto su DB finché l'utente non passa per `/confirm`.

### Files to Read
`src/lib/schema.ts`, `src/lib/api-utils.ts`, `src/lib/rate-limit.ts`, `package.json` (per confermare la dipendenza `xlsx` aggiunta in Phase 2)

---

## Phase 5: AI Auto-Categorization [M] [feature: finance-tracker] (blocked by: Phase 4 wave:1)

### Tasks
- [x] [wave:1] Creare `src/lib/finance/categorize.ts` con `suggestCategory(description: string, accountId: string, type: "income"|"expense")`:
  - Step locale: cerca nelle transazioni storiche dello stesso conto e tipo una `description` già categorizzata con similarità alta (normalizzare lowercase + trim + confronto substring/Levenshtein semplice); se trovata, ritorna quella categoria con `source: "history"`
  - Step AI (solo se step locale non trova nulla): chiama OpenRouter con `generateObject` e uno schema Zod `z.object({ categoryName: z.string().nullable() })` vincolato ai nomi di categoria esistenti per quel `type`; ritorna `source: "ai"` o `null` se il modello non è confidente
  - Implementato come due funzioni separate (`fetchHistoryCandidates` + `matchCategoryFromHistory` puro, più `suggestCategoryViaAI`) invece di una `suggestCategory` monolitica, per evitare query DB dentro il loop per-riga nella route di preview (vedi `AGENTS.md` regola "no query nei loop")
- [x] [wave:2] Integrare `suggestCategory` nella route `src/app/api/transactions/import/preview/route.ts` di Phase 4 per ogni riga priva di categoria valida dal CSV (blocked by: wave:1)
- [x] [wave:2] Se `OPENROUTER_API_KEY` non è configurata, saltare silenziosamente lo step AI (nessun errore bloccante) e lasciare la riga senza categoria (blocked by: wave:1)

### Technical Details
Pattern obbligatorio da `AGENTS.md`:
```typescript
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateObject } from "ai";
import { z } from "zod";

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY! });
const model = openrouter(process.env.OPENROUTER_MODEL || "openai/gpt-4.1-mini");

const { object } = await generateObject({
  model,
  schema: z.object({ categoryName: z.enum(availableCategoryNames).nullable() }),
  prompt: `Descrizione transazione: "${description}". Categorie disponibili: ${availableCategoryNames.join(", ")}. Scegli la categoria più probabile o null se nessuna è ragionevole.`,
});
```
Chiamare questa funzione solo per le righe non risolte (batch piccolo, un import tipico ha poche decine di righe — niente chiamate in loop su centinaia di righe senza necessità, ma per un estratto conto mensile personale il volume è comunque basso, va bene una chiamata per riga non risolta).

### Files to Read
`src/lib/env.ts`, `src/lib/finance/categories.ts`, `src/app/api/transactions/import/preview/route.ts` (creato in Phase 4)

---

## Phase 6: Transactions List & Manual Management [M] [feature: finance-tracker] (blocked by: Phase 4)

### Tasks
- [x] [wave:1] Creare `src/app/api/transactions/route.ts` — `GET` con filtri query (`accountId`, `categoryId`, `type`, `dateFrom`, `dateTo`), paginato (`.limit(50)` default, `offset`); `POST` per creazione manuale (Zod schema con tutti i campi di `transactions` tranne `id`)
- [x] [wave:1] Creare `src/app/api/transactions/[id]/route.ts` — `PATCH` (modifica qualunque campo incluso `isInternalTransfer` e `categoryId`), `DELETE`
- [x] [wave:2] Creare `src/app/dashboard/transactions/page.tsx` — tabella (shadcn `table`) con colonne data/descrizione/importo/tipo/categoria/conto, filtri sopra la tabella (select per conto/categoria/tipo + date range con input data nativi invece di popover+calendar, più semplice e ugualmente efficace), bottone primario "Importa estratto conto" che apre `ImportDialog` (Phase 4), bottone secondario "Aggiungi transazione manuale" (blocked by: wave:1)
- [x] [wave:2] Creare `src/components/finance/transaction-form.tsx` — dialog riusato sia per creazione manuale che per modifica riga esistente (stesso form, props diverse) (blocked by: wave:1)
- [x] [wave:2] Badge categoria + badge "Da categorizzare" (warning, quando `categoryId === null`) nella tabella (blocked by: wave:1)

### Technical Details
Query lista con filtri — esempio pattern da seguire (select solo colonne necessarie, mai in loop, sempre con limit):
```typescript
const rows = await db.select({
  id: transactions.id, date: transactions.date, description: transactions.description,
  amount: transactions.amount, type: transactions.type, categoryId: transactions.categoryId,
  accountId: transactions.accountId, isInternalTransfer: transactions.isInternalTransfer,
}).from(transactions)
  .where(and(eq(transactions.userId, userId), ...optionalFilters))
  .orderBy(desc(transactions.date))
  .limit(50).offset(offset);
```

### Files to Read
`src/lib/schema.ts`, `src/lib/api-utils.ts`, `src/components/ui/` (table, select, popover, calendar aggiunti in Phase 2)

---

## Phase 7: Budget & Rendiconto [L] [feature: finance-tracker] (blocked by: Phase 1, Phase 2)

### Tasks
- [x] [wave:1] Creare `src/app/api/budget/route.ts` — `GET?year=2026` (ritorna tutte le `budgetEntries` dell'utente per quell'anno, categoria×mese, con zero per le celle mancanti), `PUT` upsert di una singola cella `{ year, month, categoryId, plannedAmount }` (insert on conflict update, dato il vincolo unico definito in Phase 1)
- [x] [wave:1] Creare `src/app/api/budget/actuals/route.ts` — `GET?year=2026` (consuntivo reale: somma `transactions.amount` raggruppata per `categoryId` e mese, filtrando `isInternalTransfer = false` e `userId`)
- [x] [wave:2] Creare `src/app/dashboard/budget/page.tsx` con `Tabs` (shadcn): tab "Budget" e tab "Rendiconto", selettore anno in alto (blocked by: wave:1)
- [x] [wave:2] Creare `src/components/finance/budget-grid.tsx` — griglia categoria (righe, raggruppate per tipo uscita/entrata) × mese (colonne), celle editabili inline nel tab Budget (blocked by: wave:1)
- [x] [wave:2] Creare `src/components/finance/rendiconto-grid.tsx` — stessa griglia, celle in sola lettura con sfondo colorato secondo la regola: uscite verde se consuntivo ≤ budget / rosso se maggiore; entrate verde se consuntivo ≥ budget / rosso se minore (celle a budget 0 e consuntivo 0 restano neutre) (blocked by: wave:1)

### Technical Details
Query consuntivo (group by in SQL, non in loop applicativo):
```typescript
const actuals = await db.select({
  categoryId: transactions.categoryId,
  month: sql<number>`extract(month from ${transactions.date})`,
  total: sql<string>`sum(${transactions.amount})`,
}).from(transactions)
  .where(and(
    eq(transactions.userId, userId),
    eq(transactions.isInternalTransfer, false),
    sql`extract(year from ${transactions.date}) = ${year}`,
  ))
  .groupBy(transactions.categoryId, sql`extract(month from ${transactions.date})`);
```
Colore cella (riuso in Phase 8 per coerenza semantica):
```typescript
function budgetCellStatus(type: "expense"|"income", planned: number, actual: number): "success"|"destructive"|"neutral" {
  if (planned === 0 && actual === 0) return "neutral";
  if (type === "expense") return actual <= planned ? "success" : "destructive";
  return actual >= planned ? "success" : "destructive";
}
```

### Files to Read
`src/lib/schema.ts`, `src/lib/api-utils.ts`, `DESIGN.md` (token `--success`/`--destructive` per lo sfondo cella)

---

## Phase 8: Home Dashboard Indicators [M] [feature: finance-tracker] (blocked by: Phase 3, Phase 4)

### Tasks
- [x] [wave:1] Estendere `src/lib/finance/calculations.ts` con `getFatturatoAnnuale(userId, year)`, `getImposteAnnuali(userId, year)`, `getFondoTasse(userId, year)`, `getRisparmio(userId, year)`, `getLiquiditaDisponibile(userId)` — implementate già in Phase 3 insieme a `getAccountBalance`
- [x] [wave:1] Creare `src/app/api/dashboard/summary/route.ts` — `GET` ritorna i 3 indicatori + i breakdown minimi (saldo conto risparmio, fatturato annuale, imposte pagate) per l'anno corrente (esposta per eventuali usi client-side futuri; la Home stessa le legge direttamente server-side per evitare un loading spinner sulla pagina più importante dell'app)
- [x] [wave:2] Creare `src/components/finance/indicator-card.tsx` — card grande, cifra in `font-mono`, con breakdown secondario sotto (blocked by: wave:1)
- [x] [wave:2] Popolare `src/app/dashboard/page.tsx` (lo scheletro di Phase 2) con i 3 `IndicatorCard` (Risparmio, Fondo Tasse, Liquidità disponibile) (blocked by: wave:1)

### Technical Details
Formule esatte (TAX_RATE = 0.23 come costante in `src/lib/finance/calculations.ts`, non configurabile da UI):
```typescript
export const TAX_RATE = 0.23;

export async function getFatturatoAnnuale(userId: string, year: number): Promise<number> {
  // somma transactions.amount dove type = 'income', isClientRevenueCategory = true (join categories), anno = year
}
export async function getImposteAnnuali(userId: string, year: number): Promise<number> {
  // somma transactions.amount dove type = 'expense', isTaxPaymentCategory = true (join categories), anno = year
}
export async function getFondoTasse(userId: string, year: number): Promise<number> {
  const fatturato = await getFatturatoAnnuale(userId, year);
  const imposte = await getImposteAnnuali(userId, year);
  return fatturato * TAX_RATE - imposte;
}
export async function getRisparmio(userId: string, year: number): Promise<number> {
  const savingsAccount = await db.select().from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.isSavingsAccount, true))).limit(1);
  const balance = await getAccountBalance(savingsAccount[0].id);
  const fondoTasse = await getFondoTasse(userId, year);
  return balance - fondoTasse;
}
export async function getLiquiditaDisponibile(userId: string): Promise<number> {
  const nonSavingsAccounts = await db.select({ id: accounts.id }).from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.isSavingsAccount, false)));
  const balances = await Promise.all(nonSavingsAccounts.map(a => getAccountBalance(a.id)));
  return balances.reduce((sum, b) => sum + b, 0);
}
```
`year` di default = anno corrente (`new Date().getFullYear()`), non selezionabile dall'utente in home (lo storico multi-anno vive in Budget/Rendiconto, Phase 7).

### Files to Read
`src/lib/finance/calculations.ts` (da Phase 3), `src/lib/schema.ts`, `src/app/dashboard/page.tsx`
