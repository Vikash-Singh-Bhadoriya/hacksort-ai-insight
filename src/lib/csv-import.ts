/**
 * csv-import.ts — Pure CSV parsing and submission mapping utilities.
 *
 * No React, no side effects. All functions are pure and can be tested in isolation.
 *
 * CSV column spec:
 *   Required: name, team, category, problem, solution
 *   Optional: members, stack, deck_url, submitted_at
 */

import { CATEGORIES, type Category, type Submission } from "./data";

// --- Constants ---------------------------------------------------------------

export const REQUIRED_COLUMNS = ["name", "team", "category", "problem", "solution"] as const;
export const OPTIONAL_COLUMNS = ["members", "stack", "deck_url", "submitted_at"] as const;

/** Category -> cluster mapping, identical to the participant flow. */
const CLUSTER_FOR: Record<string, string> = {
  Healthcare: "healthcare-ai",
  Agriculture: "smart-farming",
  Education: "learning-systems",
  "AI/ML": "learning-systems",
  Cybersecurity: "doc-intel",
  FinTech: "doc-intel",
};

// --- Types -------------------------------------------------------------------

/** A single raw row keyed by header name. All values are strings. */
export type CsvRow = Record<string, string>;

export type ParsedCsvResult = {
  headers: string[];
  rows: CsvRow[];
  /** Non-fatal parse-level errors (e.g. mismatched column count on a row). */
  errors: string[];
};

// --- RFC 4180 Parser ---------------------------------------------------------

/**
 * Minimal RFC 4180-compliant CSV parser.
 * Handles:
 *   - Quoted fields containing commas, newlines, or doubled quotes
 *   - CRLF and LF line endings
 *   - Trailing newline at end of file
 *
 * @returns A 2-D array of strings (rows x cells). First row is the header.
 */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i]!;

    if (inQuotes) {
      if (ch === '"') {
        // Peek ahead -- doubled quote is an escaped quote inside a quoted field
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
        } else {
          // Closing quote
          inQuotes = false;
          i++;
        }
      } else {
        cell += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ",") {
        row.push(cell.trim());
        cell = "";
        i++;
      } else if (ch === "\r" && text[i + 1] === "\n") {
        row.push(cell.trim());
        rows.push(row);
        row = [];
        cell = "";
        i += 2;
      } else if (ch === "\n") {
        row.push(cell.trim());
        rows.push(row);
        row = [];
        cell = "";
        i++;
      } else {
        cell += ch;
        i++;
      }
    }
  }

  // Flush final cell/row -- only add if non-empty to ignore trailing newlines
  if (cell !== "" || row.length > 0) {
    row.push(cell.trim());
    rows.push(row);
  }

  return rows;
}

// --- Validation --------------------------------------------------------------

/**
 * Parse and validate a raw CSV string.
 *
 * - Rejects empty files.
 * - Rejects files missing required columns.
 * - Returns per-row errors for rows with incorrect column counts.
 * - Valid rows are returned as keyed objects.
 */
export function validateAndParseCSV(text: string): ParsedCsvResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { headers: [], rows: [], errors: ["The file is empty."] };
  }

  const raw = parseCSV(trimmed);
  if (raw.length === 0) {
    return { headers: [], rows: [], errors: ["Could not read any rows from the file."] };
  }

  const [headerRow, ...dataRows] = raw;
  const headers = (headerRow ?? []).map((h) => h.toLowerCase().trim());

  // Check required columns
  const missing = REQUIRED_COLUMNS.filter((col) => !headers.includes(col));
  if (missing.length > 0) {
    return {
      headers,
      rows: [],
      errors: [
        `Missing required column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`,
      ],
    };
  }

  const errors: string[] = [];
  const rows: CsvRow[] = [];

  for (let idx = 0; idx < dataRows.length; idx++) {
    const cells = dataRows[idx]!;
    // Skip completely blank rows
    if (cells.every((c) => c === "")) continue;

    if (cells.length !== headers.length) {
      errors.push(
        `Row ${idx + 2}: expected ${headers.length} columns but found ${cells.length}. Row skipped.`,
      );
      continue;
    }

    const rowObj: CsvRow = {};
    headers.forEach((h, colIdx) => {
      rowObj[h] = cells[colIdx] ?? "";
    });
    rows.push(rowObj);
  }

  return { headers, rows, errors };
}

// --- Row -> Submission -------------------------------------------------------

/**
 * Convert one validated CSV row to a Submission object.
 *
 * Uses the same pseudo-score formula as the participant submission flow so that
 * imported submissions have comparable signal ranges.
 *
 * @param row   A validated CsvRow (all required keys guaranteed present).
 * @param index Zero-based row index within the data rows (used for ID generation).
 * @param ts    Timestamp seed for ID generation. Pass Date.now() at import time.
 * @throws      Descriptive Error if a field value is invalid (e.g. bad category).
 */
export function rowToSubmission(row: CsvRow, index: number, ts: number): Submission {
  const name = (row["name"] ?? "").trim();
  const team = (row["team"] ?? "").trim();
  const categoryRaw = (row["category"] ?? "").trim();
  const problem = (row["problem"] ?? "").trim();
  const solution = (row["solution"] ?? "").trim();

  if (!name) throw new Error("Field 'name' is empty.");
  if (!team) throw new Error("Field 'team' is empty.");
  if (!problem) throw new Error("Field 'problem' is empty.");
  if (!solution) throw new Error("Field 'solution' is empty.");

  // Case-insensitive category lookup
  const category = CATEGORIES.find(
    (c) => c.toLowerCase() === categoryRaw.toLowerCase(),
  ) as Category | undefined;
  if (!category) {
    throw new Error(
      `Invalid category "${categoryRaw}". Valid values: ${CATEGORIES.join(", ")}.`,
    );
  }

  const members = (row["members"] ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);

  const stack = (row["stack"] ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const deckUrl = (row["deck_url"] ?? "").trim();

  // Pseudo-score formula -- identical to participant.tsx
  const scores = {
    innovation: 72 + ((solution.length + problem.length) % 18),
    impact: 70 + (problem.length % 20),
    technical: 68 + ((stack.length * 4) % 22),
    feasibility: 71 + (solution.length % 17),
    presentation: deckUrl ? 74 + (name.length % 14) : 52,
  };

  // submitted_at: use CSV value if present and parseable, else now()
  let submittedAt = new Date().toISOString();
  const rawDate = (row["submitted_at"] ?? "").trim();
  if (rawDate) {
    const parsed = new Date(rawDate);
    if (!isNaN(parsed.getTime())) {
      submittedAt = parsed.toISOString();
    }
  }

  return {
    id: `csv-${ts}-${index}`,
    name,
    team,
    members: members.length ? members : [],
    category,
    problem,
    solution,
    stack: stack.length ? stack : ["Not specified"],
    deckUrl,
    scores,
    reasoning:
      "Imported via CSV. Signals below are a first-pass estimate derived from the structured fields; " +
      "they will refine once the submission is analysed with Gemini.",
    strengths: ["Clearly scoped problem statement", `Categorised under ${category}`],
    risks: deckUrl ? ["Awaiting demo verification"] : ["No presentation link provided"],
    cluster: CLUSTER_FOR[category] ?? "open-labs",
    status: "Submitted",
    submittedAt,
  };
}
