import * as XLSX from "xlsx";
import { z } from "zod";

export interface ParsedRow {
  rowNumber: number; // 1-based, counting the header as row 1 (matches what a user sees opening the file)
  date: string; // ISO yyyy-mm-dd
  description: string;
  amount: number; // always positive
  type: "income" | "expense";
  categoryName: string | null;
}

export interface ParseError {
  rowNumber: number;
  message: string;
}

export interface ParseResult {
  rows: ParsedRow[];
  errors: ParseError[];
}

type ImportField = "date" | "description" | "amount" | "type" | "category";

const HEADER_ALIASES: Record<ImportField, string[]> = {
  date: ["data", "date"],
  description: ["descrizione", "description"],
  amount: ["importo", "amount"],
  type: ["entrata/uscita", "entrata o uscita", "tipo", "type"],
  category: ["categoria", "category"],
};

const FIELD_LABELS_IT: Record<ImportField, string> = {
  date: "data",
  description: "descrizione",
  amount: "importo",
  type: "entrata/uscita",
  category: "categoria",
};

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase();
}

function findColumnIndex(headerRow: string[], field: ImportField): number {
  const aliases = HEADER_ALIASES[field];
  return headerRow.findIndex((h) => aliases.includes(normalizeHeader(h)));
}

/**
 * Parses a possibly currency-prefixed and/or signed number into a positive float,
 * auto-detecting whether "," or "." is the decimal separator rather than assuming
 * one locale — bank exports mix conventions (Italian "1.234,56" vs English "1,234.56",
 * sometimes even within the same file depending on the amount's magnitude).
 * The sign is discarded — direction comes from the "entrata/uscita" column, not from the amount.
 */
function parseAmount(raw: string): number | null {
  const trimmed = raw.trim().replace(/[€\s]/g, "");
  if (!trimmed) return null;

  const lastComma = trimmed.lastIndexOf(",");
  const lastDot = trimmed.lastIndexOf(".");
  let decimalIndex = Math.max(lastComma, lastDot);

  // The rightmost separator is only trusted as the decimal point if it's followed by
  // 1-2 digits (standard currency precision) — otherwise every separator present is
  // a thousands grouping and the number has no fractional part.
  if (decimalIndex !== -1 && trimmed.length - decimalIndex - 1 > 2) {
    decimalIndex = -1;
  }

  const normalized =
    decimalIndex === -1
      ? trimmed.replace(/[.,]/g, "")
      : `${trimmed.slice(0, decimalIndex).replace(/[.,]/g, "")}.${trimmed.slice(decimalIndex + 1)}`;

  const value = Number(normalized);
  return Number.isFinite(value) ? Math.abs(value) : null;
}

/** Parses a date in ISO (yyyy-mm-dd) or Italian (dd/mm/yyyy or dd/mm/yy, dd-mm-yyyy) format into ISO. */
function parseDate(raw: string): string | null {
  const trimmed = raw.trim();

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return trimmed;

  const itMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (itMatch) {
    const [, day, month, rawYear] = itMatch;
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return null;
}

function parseType(raw: string): "income" | "expense" | null {
  const value = raw.trim().toLowerCase();
  if (["entrata", "income", "e"].includes(value)) return "income";
  if (["uscita", "expense", "u"].includes(value)) return "expense";
  return null;
}

const rowSchema = z.object({
  date: z.string(),
  description: z.string().min(1),
  amount: z.number().positive(),
  type: z.enum(["income", "expense"]),
  categoryName: z.string().nullable(),
});

/**
 * Parses a bank statement file (.csv or .xlsx) with columns:
 * data, descrizione, importo, entrata/uscita, categoria (in any order, header names
 * matched case-insensitively against HEADER_ALIASES).
 *
 * Returns either validated rows (if ALL rows are valid) or a list of row-level errors.
 * Never returns a partial result — the caller should block the entire import on any error.
 */
export function parseStatementFile(buffer: Buffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw: string[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: "",
  });

  const errors: ParseError[] = [];

  if (raw.length === 0) {
    return { rows: [], errors: [{ rowNumber: 1, message: "Il file è vuoto" }] };
  }

  const headerRow = raw[0].map((h) => String(h));
  const columnIndex = {
    date: findColumnIndex(headerRow, "date"),
    description: findColumnIndex(headerRow, "description"),
    amount: findColumnIndex(headerRow, "amount"),
    type: findColumnIndex(headerRow, "type"),
    category: findColumnIndex(headerRow, "category"),
  };

  const missingColumns = (Object.keys(columnIndex) as (keyof typeof columnIndex)[])
    .filter((key) => key !== "category" && columnIndex[key] === -1)
    .map((key) => FIELD_LABELS_IT[key]);
  if (missingColumns.length > 0) {
    return {
      rows: [],
      errors: [
        {
          rowNumber: 1,
          message: `Colonne mancanti nell'intestazione: ${missingColumns.join(", ")}. Attese: data, descrizione, importo, entrata/uscita, categoria (opzionale).`,
        },
      ],
    };
  }

  const rows: ParsedRow[] = [];

  for (let i = 1; i < raw.length; i++) {
    const line = raw[i];
    if (line.every((cell) => String(cell).trim() === "")) continue; // skip blank lines

    const rowNumber = i + 1;
    const rawDate = String(line[columnIndex.date] ?? "");
    const rawDescription = String(line[columnIndex.description] ?? "");
    const rawAmount = String(line[columnIndex.amount] ?? "");
    const rawType = String(line[columnIndex.type] ?? "");
    const rawCategory =
      columnIndex.category === -1 ? "" : String(line[columnIndex.category] ?? "");

    const date = parseDate(rawDate);
    if (!date) {
      errors.push({ rowNumber, message: `Data non valida: "${rawDate}"` });
      continue;
    }

    const amount = parseAmount(rawAmount);
    if (amount === null || amount <= 0) {
      errors.push({ rowNumber, message: `Importo non valido: "${rawAmount}"` });
      continue;
    }

    const type = parseType(rawType);
    if (!type) {
      errors.push({
        rowNumber,
        message: `Tipo non valido: "${rawType}" (atteso "entrata" o "uscita")`,
      });
      continue;
    }

    if (!rawDescription.trim()) {
      errors.push({ rowNumber, message: "Descrizione mancante" });
      continue;
    }

    const parsed = rowSchema.safeParse({
      date,
      description: rawDescription.trim(),
      amount,
      type,
      categoryName: rawCategory.trim() || null,
    });

    if (!parsed.success) {
      errors.push({ rowNumber, message: parsed.error.issues[0]?.message ?? "Riga non valida" });
      continue;
    }

    rows.push({ rowNumber, ...parsed.data });
  }

  if (errors.length > 0) {
    return { rows: [], errors };
  }

  return { rows, errors: [] };
}
