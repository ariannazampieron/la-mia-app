# Finance Tracker

## Summary
Un'app personale (utente singolo) per monitorare costi, ricavi e tasso di risparmio basata sull'importazione di estratti conto. L'app calcola automaticamente risparmio netto, fondo tasse accantonato e liquidità disponibile, confronta un budget annuale impostato manualmente con il consuntivo reale mese per mese, e permette di importare, categorizzare (con assistenza AI) e gestire manualmente le transazioni di 5 conti correnti.

## Users
Un solo utente (il proprietario dell'app). Nessun ruolo multiplo, nessuna condivisione di dati. L'accesso resta comunque protetto da autenticazione.

## Auth
Login con **Email OTP** (codice via email, già configurato in `src/lib/auth.ts` tramite il plugin `emailOTP` di Better Auth). Nessuna registrazione pubblica aperta: l'unico utente è quello creato manualmente/al primo accesso. Dopo il login, l'utente atterra direttamente sulla Home con i 3 indicatori.

## Core Features

1. **Home con indicatori chiave** — 3 numeri calcolati automaticamente e mostrati in evidenza: Risparmio, Fondo Tasse, Liquidità disponibile (vedi formule sotto, riferite all'anno corrente).

2. **Gestione conti** — 5 conti fissi configurati una tantum (BBVA, BCC, Paypal, Conto Arancio, Conto Arancio Deposito), ciascuno con un saldo di partenza inserito manualmente una volta; il saldo corrente è poi calcolato sommando algebricamente tutte le transazioni associate a quel conto. Il Conto Arancio Deposito è marcato come conto di risparmio (usato nel calcolo "Risparmio").

3. **Import estratti conto (CSV/XLSX)** — upload di un file con colonne data, descrizione, importo, entrata/uscita, categoria. Il formato è fisso. Validazione bloccante: se ci sono righe malformate (data illeggibile, importo non numerico, tipo entrata/uscita mancante), l'import si ferma e mostra esattamente quali righe correggere, senza inserire nulla. Rilevamento duplicati: ogni riga viene confrontata con le transazioni già esistenti sullo stesso conto (stessa data + stesso importo + stessa descrizione normalizzata); i duplicati vengono mostrati separatamente nell'anteprima di import e NON vengono inseriti a meno che l'utente non li confermi esplicitamente uno per uno.

4. **Categorizzazione automatica AI** — per ogni riga importata senza categoria (o con categoria non riconosciuta tra quelle fisse), il sistema cerca prima una corrispondenza tra le transazioni storiche già categorizzate con descrizione simile sullo stesso conto; se trova un pattern ricorrente affidabile assegna la categoria in automatico. Per i casi rimanenti, usa un modello via OpenRouter per proporre la categoria più probabile tra l'elenco fisso; se la confidenza è bassa, la transazione resta senza categoria e va assegnata manualmente.

5. **Transazioni — vista e modifica manuale** — elenco di tutte le transazioni con colonne data, descrizione, importo, entrata/uscita, categoria, conto. Filtrabile per conto, categoria, tipo e periodo. Ogni transazione (importata o manuale) è modificabile: data, descrizione, importo, tipo, categoria, conto, e flag "movimento interno" (trasferimento tra propri conti, escluso dal conto economico). Permette anche l'inserimento manuale di nuove transazioni (es. spese della vecchia carta di credito BCC, gestita senza un conto dedicato).

6. **Budget & Rendiconto** — due tab separate, con selettore anno (si parte dal 2026, ma l'architettura deve supportare storicamente qualsiasi anno):
   - **Budget**: griglia categoria × mese con l'importo previsto, inserito e modificabile manualmente dall'utente in qualsiasi momento.
   - **Rendiconto**: stessa griglia ma con il consuntivo reale (somma delle transazioni non marcate come movimento interno, per categoria e mese). Evidenziazione colore: per le categorie di uscita, verde se consuntivo ≤ budget, rosso se consuntivo > budget; per le categorie di entrata, verde se consuntivo ≥ budget, rosso se consuntivo < budget.

## Data Model

- **accounts** (per-user): id, userId, name (uno dei 5 fissi), isSavingsAccount (bool — true solo per Conto Arancio Deposito), openingBalance (decimal), openingBalanceDate (date). Il saldo corrente = openingBalance + somma di tutte le transazioni di quel conto (incluse quelle marcate come movimento interno, che spostano denaro reale tra conti pur essendo escluse dal conto economico).

- **categories** (seed fisso per utente, non editabile da UI): id, userId, name, type (expense | income), isTaxPaymentCategory (true solo per "Imposte"), isClientRevenueCategory (true per tutte le categorie entrata che iniziano con "Clienti_"). 24 categorie di uscita + 7 di entrata (vedi lista completa in Technical Details del Phase 1).

- **transactions**: id, userId, accountId (FK), categoryId (FK, nullable = da categorizzare), date, description, amount (decimal positivo), type (income | expense), isInternalTransfer (bool, default false), source (import | manual), importBatchId (nullable, per raggruppare un import), createdAt, updatedAt.

- **budget_entries**: id, userId, year, month (1-12), categoryId (FK), plannedAmount (decimal). Vincolo unico su (userId, year, month, categoryId).

Nessun dato è condiviso tra utenti (app mono-utente, ma le tabelle restano scoped per userId per coerenza con il resto del boilerplate).

## Key Screens

- **Login** — form OTP via email (riutilizza `src/components/auth/auth-form.tsx` esistente).
- **Home** (`/dashboard`, sostituisce il placeholder) — 3 indicatori in evidenza: Risparmio, Fondo Tasse, Liquidità disponibile, con breakdown minimo (es. saldo conto risparmio, fatturato annuale, totale imposte pagate) sotto ciascun numero.
- **Transazioni** — tabella filtrabile, bottone primario "Importa estratto conto", pulsante "Aggiungi transazione manuale", editing inline/modale per singola riga.
- **Budget / Rendiconto** — due tab, selettore anno, griglia categoria × mese.
- **Conti** — pagina semplice di configurazione dei 5 conti e relativo saldo iniziale (si usa una volta, poi raramente).

## Design Direction
See `DESIGN.md` for the project-wide aesthetic direction (Soft-Tactile, sage green accent, light mode only, Geist Mono for tutte le cifre). Note specifiche di questa feature:
- La tabella Rendiconto usa colore di sfondo verde/rosso tenue (vedi token `--success`/`--destructive` in DESIGN.md) sulle singole celle categoria×mese, non sull'intera riga.
- L'anteprima di import mostra due sezioni distinte ("Nuove transazioni" / "Possibili duplicati") in un dialog `ease-settle`, non in due pagine separate.
- Le transazioni senza categoria assegnata mostrano un badge "Da categorizzare" nel colore warning (`#B8873B`) definito in DESIGN.md.

## AI Integration
Usata esclusivamente per la categorizzazione automatica delle transazioni importate:
- Trigger: durante l'elaborazione di un import CSV/XLSX, per ogni riga priva di categoria valida.
- Step 1 (locale, nessuna chiamata AI): cerca tra le transazioni storiche dello stesso conto una descrizione simile già categorizzata (match normalizzato/fuzzy sulla descrizione) — se trovata con alta confidenza, assegna direttamente quella categoria.
- Step 2 (OpenRouter, solo per i casi non risolti al passo 1): invia al modello la descrizione della transazione + l'elenco delle categorie fisse disponibili (filtrate per tipo entrata/uscita) e chiede di scegliere la categoria più probabile o rispondere "nessuna" se non c'è una corrispondenza ragionevole. Usa `generateObject` con uno schema Zod che vincola l'output a uno dei nomi di categoria validi o null.
- Se nessuno dei due step produce un risultato con confidenza sufficiente, la transazione resta con `categoryId = null` ed è segnalata come "da categorizzare" nella UI per compilazione manuale.

## Error Handling
- **Import CSV/XLSX malformato**: l'intero import viene bloccato (nessuna riga inserita); l'utente vede l'elenco esatto delle righe con errore e il motivo (es. "Riga 14: importo non numerico").
- **Duplicati rilevati**: non vengono inseriti automaticamente; l'utente vede un elenco dei duplicati sospetti e conferma esplicitamente quali, se del caso, importare comunque.
- **OpenRouter non configurato o chiamata fallita**: la categorizzazione AI viene saltata silenziosamente per le righe non risolte al passo 1 locale; le transazioni restano "da categorizzare" senza bloccare l'import.
- **Categoria non valida nel CSV** (valore che non corrisponde a nessuna delle categorie fisse): trattata come categoria mancante, passa comunque per la pipeline di auto-categorizzazione AI invece di essere rifiutata.

## Acceptance Criteria
- [ ] I 3 indicatori in home riflettono le formule esatte definite (Risparmio, Fondo Tasse, Liquidità) e si aggiornano automaticamente dopo ogni import o modifica di transazione
- [ ] È possibile configurare i 5 conti con saldo iniziale e vedere il saldo corrente calcolato
- [ ] L'import CSV e XLSX funziona con lo stesso formato di colonne e blocca l'intero file in caso di errori, mostrando quali righe correggere
- [ ] I duplicati vengono rilevati e richiedono conferma esplicita prima di essere importati
- [ ] Le transazioni ricorrenti vengono categorizzate automaticamente; quelle non riconosciute restano "da categorizzare" e sono modificabili manualmente
- [ ] La tabella Transazioni è filtrabile per conto, categoria, tipo e periodo, e ogni riga è modificabile
- [ ] Budget e Rendiconto mostrano la stessa griglia categoria×mese con evidenziazione verde/rosso coerente con le regole definite (invertita tra costi e ricavi)
- [ ] Il selettore anno su Budget/Rendiconto funziona anche per anni senza alcun dato (griglia vuota pronta da compilare)
- [ ] Le transazioni marcate come movimento interno sono escluse dal Rendiconto ma continuano a influenzare il saldo dei conti coinvolti
