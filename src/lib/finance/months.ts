/**
 * Short Italian month labels, index 0 = January. Kept in a plain module (not a "use client"
 * component) so Server Components can read it: a value imported from a client module is
 * only a reference on the server and breaks the page when accessed.
 */
export const MONTH_LABELS = [
  "Gen",
  "Feb",
  "Mar",
  "Apr",
  "Mag",
  "Giu",
  "Lug",
  "Ago",
  "Set",
  "Ott",
  "Nov",
  "Dic",
];
