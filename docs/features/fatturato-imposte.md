# Fatturato e imposte

Pagina `/dashboard/fatturato` (voce "Fatturato e imposte" nel menu laterale).

## Cosa mostra

- **Fatturato mensile** dell'anno scelto (frecce in alto): grafico a colonne, una serie, valore del mese al passaggio del mouse o con il focus da tastiera. Il fatturato è la somma delle entrate nelle categorie `Clienti_*`, come per il Fondo Tasse.
- **Fatturato per cliente**: totale dell'anno per ogni categoria `Clienti_*` (nome senza il prefisso), con l'incidenza percentuale sul totale. Ordinati dal più alto.
- **Imposte ancora da pagare** nell'anno corrente e nel successivo (sempre i due anni di calendario reali, non dipendono dall'anno scelto per il grafico). Per ogni anno:
  - **Totale da pagare nell'anno**: inserito a mano con la matita (tabella `tax_due_amounts`). Per l'anno successivo è un segnaposto finché non c'è la stima automatica.
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

## Limiti noti

- Il totale da pagare è manuale per entrambi gli anni: la stima automatica dal fatturato (forfettario 15%, contributi) è il passo successivo.
- Il Fondo Tasse si calcola sull'anno corrente: a gennaio dell'anno nuovo riparte da zero, quindi non porta con sé l'accantonamento dell'anno precedente.
