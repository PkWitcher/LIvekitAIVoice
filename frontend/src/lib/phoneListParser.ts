// Parses contact spreadsheets (CSV/XLSX/XLS) for the Bulk Campaign phone-number upload.
import * as XLSX from "xlsx";

export interface ParsedWorkbook {
  headers: string[];
  rows: string[][];
}

const PHONE_HEADER_PATTERN = /phone|mobile|contact|number|whatsapp/i;
const NAME_HEADER_PATTERN = /\bname\b/i;

function workbookToGrid(workbook: XLSX.WorkBook): ParsedWorkbook {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "" });
  if (grid.length === 0) return { headers: [], rows: [] };

  const [headerRow, ...dataRows] = grid;
  const headers = headerRow.map((h) => String(h ?? "").trim());
  const rows = dataRows
    .map((row) => row.map((cell) => String(cell ?? "").trim()))
    .filter((row) => row.some((cell) => cell.length > 0));
  return { headers, rows };
}

/** Read a spreadsheet/CSV file into a header row + data rows (first sheet only). */
export function parseContactWorkbook(data: ArrayBuffer): ParsedWorkbook {
  return workbookToGrid(XLSX.read(data, { type: "array" }));
}

/** Parse raw CSV text (e.g. fetched from a published Google Sheet) into a header row + data rows. */
export function parseCsvText(csvText: string): ParsedWorkbook {
  return workbookToGrid(XLSX.read(csvText, { type: "string" }));
}

/** Find a column whose header looks like a phone number column, if any. */
export function detectPhoneColumnIndex(headers: string[]): number | null {
  const idx = headers.findIndex((h) => PHONE_HEADER_PATTERN.test(h));
  return idx >= 0 ? idx : null;
}

/** Find a column whose header looks like a contact-name column, if any. */
export function detectNameColumnIndex(headers: string[]): number | null {
  const idx = headers.findIndex((h) => NAME_HEADER_PATTERN.test(h) && !PHONE_HEADER_PATTERN.test(h));
  return idx >= 0 ? idx : null;
}

/** Normalize a raw cell value into a dialable phone number, or null if invalid. */
export function normalizePhoneNumber(raw: string): string | null {
  let phone = raw.trim().replace(/[\s\-().]/g, "");
  if (!phone) return null;
  if (!/^\+?\d{7,15}$/.test(phone)) return null;
  if (/^\d{10}$/.test(phone)) {
    phone = `+91${phone}`;
  } else if (!phone.startsWith("+")) {
    phone = `+${phone}`;
  }
  return phone;
}

export interface ExtractResult {
  valid: string[];
  invalid: string[];
  duplicateCount: number;
  /** phone -> contact name, only populated when nameColumnIndex is provided and found */
  names: Record<string, string>;
}

/** Extract, validate, and dedupe phone numbers from a chosen column. `existing` numbers (e.g. already in the manual textarea) are treated as duplicates too. Optionally also pulls a per-row contact name for personalizing {{name}} per call. */
export function extractPhoneNumbers(
  rows: string[][],
  columnIndex: number,
  existing: Iterable<string> = [],
  nameColumnIndex: number | null = null
): ExtractResult {
  const seen = new Set(existing);
  const valid: string[] = [];
  const invalid: string[] = [];
  const names: Record<string, string> = {};
  let duplicateCount = 0;

  for (const row of rows) {
    const raw = row[columnIndex] ?? "";
    if (!raw.trim()) continue;
    const normalized = normalizePhoneNumber(raw);
    if (!normalized) {
      invalid.push(raw);
      continue;
    }
    if (seen.has(normalized)) {
      duplicateCount += 1;
      continue;
    }
    seen.add(normalized);
    valid.push(normalized);
    if (nameColumnIndex !== null) {
      const name = (row[nameColumnIndex] ?? "").trim();
      if (name) names[normalized] = name;
    }
  }

  return { valid, invalid, duplicateCount, names };
}
