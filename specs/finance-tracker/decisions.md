# Architecture Decisions: Finance Tracker

Decisions made during planning. Reference these if questions come up during implementation.

## Categorie e conti come dati seedati, non tabelle editabili da UI
**Context**: l'utente ha detto esplicitamente che le categorie sono fisse e predefinite da lui, e i conti sono un elenco fisso di 5. Non è stata richiesta nessuna UI di gestione categorie/conti dinamica.
**Decision**: categorie e conti vivono in tabelle DB (per poter avere foreign key, flag di calcolo, e indici), ma vengono popolate automaticamente ("seed") al primo accesso tramite `ensureCategoriesSeeded`/`ensureAccountsSeeded`, invocate dal layout del dashboard. Nessuna pagina di creazione/eliminazione categoria o conto. I conti hanno comunque una pagina minimale per impostare il saldo di partenza (Phase 3), le categorie no.
**Alternatives considered**: un enum Postgres per le categorie — scartato perché servono i flag `isTaxPaymentCategory`/`isClientRevenueCategory` e la relazione FK pulita con `transactions`/`budget_entries`.

## Normalizzazione "ClientiCONSULENZA" → "Clienti_CONSULENZA"
**Context**: nella lista categorie fornita dall'utente compare "ClientiCONSULENZA" (senza underscore), ma la regola per il calcolo del 23% di fatturato è "categorie di entrata che iniziano con Clienti_". Senza underscore, questa categoria non verrebbe conteggiata nel fatturato, il che sembra un errore di battitura vista l'intenzione (è chiaramente un cliente come gli altri).
**Decision**: normalizzata a "Clienti_CONSULENZA" nel seed, così rientra correttamente nel calcolo del fatturato annuale.
**Alternatives considered**: lasciarla com'è e tenerla fuori dal calcolo — scartato perché quasi certamente un refuso, non un'esclusione intenzionale. **Da verificare con l'utente al primo utilizzo**: se il nome esatto o l'intento erano diversi, si corregge facilmente modificando la riga in `src/lib/finance/categories.ts` prima del primo seed (o aggiornando la singola riga in `categories` dopo).

## Saldo conto calcolato da saldo iniziale + transazioni, non sincronizzato con la banca
**Context**: non c'è integrazione bancaria (es. Plaid/open banking) — solo import manuale di CSV/XLSX esportati dall'utente.
**Decision**: ogni conto ha un `openingBalance` inserito manualmente una tantum; il saldo corrente è sempre calcolato come `openingBalance + somma algebrica delle transazioni importate/manuali`. L'utente stesso ha detto che verificherà periodicamente che coincida con il saldo reale — non serve quindi un meccanismo di riconciliazione automatica nel MVP.
**Alternatives considered**: salvare un campo `currentBalance` aggiornato ad ogni scrittura — scartato per evitare desincronizzazioni; calcolarlo on-the-fly è più semplice e sempre corretto per il volume di dati previsto (uso personale, poche centinaia di transazioni l'anno).

## Movimenti interni: esclusi dal conto economico, inclusi nel saldo
**Context**: trasferimenti tra i propri conti (es. accantonamento verso il Conto Arancio Deposito) sposterebbero denaro reale ma non sono costi/ricavi veri.
**Decision**: flag booleano `isInternalTransfer` su ogni transazione, impostabile manualmente dall'utente in fase di modifica/inserimento (nessuna rilevazione automatica nel MVP, visto il basso volume — 2/3 al mese secondo l'utente). Il flag esclude la riga dalle query di Budget/Rendiconto (Phase 7) e dal calcolo del fatturato/imposte (Phase 8), ma la transazione continua a contare nel saldo del conto (Phase 3).
**Alternatives considered**: rilevare automaticamente i trasferimenti cercando coppie di transazioni speculari tra conti — scartato come fuori scope per il volume dichiarato (2/3 al mese), l'utente marca manualmente.

## Carta di Credito BCC: nessun conto dedicato
**Context**: l'utente ha deciso di non creare un conto "Carta di Credito BCC" separato, gestendo i 2/3 addebiti mensili come transazioni manuali sotto il conto BCC.
**Decision**: nessuna tabella o logica speciale per le carte di credito — sono semplicemente transazioni manuali (`source: "manual"`) come qualunque altra, inserite dall'utente tramite il form di Phase 6.
**Alternatives considered**: nessuna — richiesta esplicita dell'utente, nessuna ambiguità.

## Tasso fiscale 23% hardcoded, non configurabile da UI
**Context**: l'utente ha dato una formula fissa (regime forfettario, 23%).
**Decision**: costante `TAX_RATE = 0.23` in `src/lib/finance/calculations.ts`. Se il regime fiscale cambiasse in futuro, si modifica il codice — non è stata richiesta una UI di impostazioni fiscali.
**Alternatives considered**: tabella `tax_settings` configurabile — scartata come over-engineering per un valore che cambia, se mai, una volta ogni qualche anno con un cambio di regime fiscale.

## App protetta da login anche se mono-utente
**Context**: l'utente ha detto che userà l'app solo lui, ma ha comunque chiesto OTP via email come metodo di accesso.
**Decision**: tutte le route restano protette con `requireApiAuth()`/`requireAuth()` e scoped per `userId`, seguendo esattamente il pattern del boilerplate — nessuna scorciatoia "modalità singolo utente senza login".
**Alternatives considered**: disabilitare l'auth per semplicità — scartato, esplicitamente richiesto l'OTP dall'utente.
