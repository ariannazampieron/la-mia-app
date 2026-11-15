# Analisi costi

Pagina `/dashboard/analisi-costi` (voce "Analisi costi" nel menu). Anno scelto con le frecce. Considera solo le uscite reali: escluse quelle segnate come movimento interno.

## Media mensile delle spese

Grafico ad anello con quattro parti, ognuna con la sua media mensile e la percentuale sul totale:

- **Sopravvivenza**, **Lavorative**: i gruppi di `src/lib/finance/expense-groups.ts`
- **Extra**: il gruppo Spese extra senza ACCANTONAMENTO e VIAGGI
- **Viaggi**: la categoria VIAGGI

La media divide il totale dell'anno per i mesi da gennaio all'ultimo mese con almeno una transazione categorizzata (come la media del Rendiconto). Colori: slot 1–4 della palette categoriale validata (`CostDonut`, `src/components/finance/cost-donut.tsx`); passando sopra una parte o una riga della legenda, il centro mostra quella parte.

## Spese ricorrenti

- **Tool personali** e **Tool lavoro** (categorie TOOL PERSONALI / TOOL LAVORO): un rigo per fornitore, ricavato dalla descrizione (`merchantKey`: toglie "Paypal *" e "- Pagamento preautorizzato utenza", prende la prima parola; alias in `MERCHANT_ALIASES`, es. anthropic → claude). **Mensile** = ultimo importo addebitato; **Totale anno** = somma. **Dismesso** se ha almeno due addebiti e nessuno negli ultimi 45 giorni prima dell'ultima transazione dell'anno (un abbonamento annuale con un solo addebito non viene mai segnato).
- **Telefono** e **Internet**: media mensile e totale anno delle rispettive categorie.

## Utenze casa

Cercate per parola intera nella descrizione di tutte le uscite: Energia elettrica (Alperia), Acqua (Hera), Gas (SGR), Legna (Legna). Media mensile e totale anno.

## File

- `src/lib/finance/cost-analysis.ts` — calcoli (`getCostAnalysis`)
- `src/app/api/analisi-costi/route.ts` — `GET ?year=`
- `src/app/dashboard/analisi-costi/page.tsx` — pagina
- `src/components/finance/cost-donut.tsx` — grafico ad anello con legenda
