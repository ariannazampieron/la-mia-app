/** Collapsible groups of expense categories in Budget/Rendiconto/Review. Client-safe. */
const NAMED_GROUPS = [
  {
    key: "sopravvivenza",
    label: "Spese di sopravvivenza",
    categoryNames: [
      "MUTUO",
      "UTENZE",
      "CIBO CASA",
      "AUTO/TRASPORTI",
      "SALUTE",
      "SPESE BANCARIE",
      "FONDO PENSIONE",
      "INTERNET",
      "TELEFONO",
    ],
  },
  {
    key: "lavoro",
    label: "Spese lavorative",
    categoryNames: [
      "STIPENDI",
      "COMMERCIALISTA",
      "FORMAZIONE",
      "IMPOSTE",
      "PREVIDENZA",
      "ELETTRONICA",
    ],
  },
];

/** Splits expense categories into the named groups, keeping their order; the rest is "extra". */
export function groupExpenseCategories<T extends { name: string }>(
  categories: T[]
): { key: string; label: string; categories: T[] }[] {
  const grouped = NAMED_GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    categories: categories.filter((c) => g.categoryNames.includes(c.name)),
  }));
  const named = new Set(NAMED_GROUPS.flatMap((g) => g.categoryNames));
  return [
    ...grouped,
    {
      key: "extra",
      label: "Spese extra",
      categories: categories.filter((c) => !named.has(c.name)),
    },
  ];
}
