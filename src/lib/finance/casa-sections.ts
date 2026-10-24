export const CASA_SECTIONS = [
  {
    key: "acquisto",
    label: "Acquisto",
    categoryNames: [] as string[],
    incomeOffsetCategoryNames: [] as string[],
  },
  {
    key: "ristrutturazione",
    label: "Ristrutturazione",
    categoryNames: ["CASA - RISTRUTTURAZIONE"],
    incomeOffsetCategoryNames: [] as string[],
  },
  {
    key: "arredamento",
    label: "Arredamento",
    categoryNames: ["CASA - ARREDAMENTO"],
    incomeOffsetCategoryNames: [] as string[],
  },
  {
    key: "accessori",
    label: "Accessori",
    categoryNames: ["CASA - COMPLEMENTI"],
    incomeOffsetCategoryNames: [] as string[],
  },
  {
    key: "utenze_manutenzione",
    label: "Utenze e manutenzione",
    categoryNames: ["UTENZE", "CASA - MANUTENZIONE"],
    // Income category "UTENZE" (es. rimborsi/chiusure contrattuali) viene sottratta
    // dal totale uscite: la sezione mostra il costo NETTO di utenze e manutenzione.
    incomeOffsetCategoryNames: ["UTENZE"],
  },
] as const;

export type CasaSectionKey = (typeof CASA_SECTIONS)[number]["key"];

export const CASA_START_YEAR = 2025;

/** First year the app actually tracks transactions for — years before this are always manually editable. */
export const AUTO_TRACKING_START_YEAR = 2026;
