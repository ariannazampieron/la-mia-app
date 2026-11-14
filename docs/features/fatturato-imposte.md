# Fatturato e imposte

Pagina `/dashboard/fatturato` (voce "Fatturato e imposte" nel menu laterale).

## Cosa mostra

- **Fatturato mensile** dell'anno scelto (frecce in alto): grafico a colonne, una serie, valore del mese al passaggio del mouse o con il focus da tastiera. Il fatturato è la somma delle entrate nelle categorie `Clienti_*`, come per il Fondo Tasse.
- **Fatturato per cliente**: totale dell'anno per ogni categoria `Clienti_*` (nome senza il prefisso), con l'incidenza percentuale sul totale. Ordinati dal più alto.
- **Imposte ancora da pagare** nell'anno corrente e nel successivo (sempre i due anni di calendario reali, non dipendono dall'anno scelto per il grafico). Per ogni anno:
  - **Totale da pagare nell'anno**: per l'anno corrente si inserisce a mano con la matita (tabella `tax_due_amounts`). Per l'anno successivo è **stimato** dal fatturato dell'anno corrente quando in `TAX_YEAR_PARAMS` ci sono i dati di quell'anno (altrimenti torna manuale), e il riquadro mostra le voci della stima.
  - **Già pagato**: transazioni dell'anno nella categoria `IMPOSTE`.
  - **Ancora da pagare** = totale − già pagato (mai sotto zero).
  - **Copertura**: il Fondo Tasse attuale (`getFondoTasse` dell'anno corrente) copre prima l'anno corrente e il resto va al successivo (`computeTaxCoverage` in `src/lib/finance/taxes.ts`). Se non basta, il riquadro dice quanto manca.

## File

- `src/app/dashboard/fatturato/page.tsx` — pagina
- `src/app/api/fatturato/route.ts` — `GET ?year=`: fatturato per mese e cliente, fondo tasse, imposte con copertura
- `src/app/api/fatturato/tax-due/route.ts` — `PUT { year, amount }`: totale imposte dovute in un anno
- `src/components/finance/revenue-chart.tsx` — grafico a colonne (HTML/CSS, nessuna libreria)
- `src/components/finance/tax-year-card.tsx` — riquadro imposte di un anno
- `src/lib/finance/taxes.ts` — logica di copertura (pura, senza database)
- `src/lib/finance/tax-estimate.ts` — stima delle imposte dell'anno successivo (pura)

## Stima delle imposte dell'anno successivo

Regime forfettario (imposta sostitutiva 15%, coefficiente di redditività 78%, ATECO 70.22.09), INPS Gestione Commercianti con riduzione 35%, acconti col **metodo storico** (100% dell'anno prima: la scelta più prudente). Sul fatturato dell'anno Y (cassa, categorie `Clienti_*`):

- reddito lordo = fatturato × 78%
- imposta sostitutiva Y = 15% × (reddito lordo − contributi INPS versati nell'anno Y)
- eccedenza INPS Y = (reddito lordo − reddito minimale) × 24,48% × 65%

Pagato nell'anno Y+1: saldo imposta Y (imposta − acconti già versati) + acconti imposta Y+1 (= imposta Y) + contributi INPS fissi Y+1 + saldo eccedenza INPS Y + acconti eccedenza INPS Y+1 (= eccedenza Y).

I dati che non si ricavano dal fatturato (contributi versati, acconti già pagati, contributi fissi dell'anno dopo: 3.074 € l'anno con la riduzione del 35%) sono in `TAX_YEAR_PARAMS`, uno per anno, presi da dichiarazione e F24. Per stimare il 2028 sul fatturato 2027 va aggiunta la voce 2027.

Semplificazioni: aliquota INPS unica 24,48% (non lo scaglione più alto oltre il primo limite), nessun diritto camerale, nessun altro reddito IRPEF; un eventuale credito (acconti superiori all'imposta) è considerato zero.

## Fondo tasse cumulativo

Dal 2026 (`TAX_FUND_START_YEAR` in `calculations.ts`) il Fondo Tasse somma quanto avanzato negli anni precedenti (accantonato − imposte pagate), così a gennaio non riparte da zero mentre si pagano le imposte dell'anno prima. In Home compare come "Residuo anni precedenti".
