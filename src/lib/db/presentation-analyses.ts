/**
 * src/lib/db/presentation-analyses.ts
 *
 * Data-access functions for the `presentation_analyses` table.
 *
 * The table enforces UNIQUE(submission_id) — one analysis per submission.
 * Reads use the anon client (RLS allows SELECT). Writes happen ONLY
 * server-side through the service-role client (see api.analyze-presentation.ts).
 */

import { supabase } from "@/lib/supabase";
import type { PresentationGeminiAnalysis } from "@/lib/gemini";

// ── Row type as stored in Supabase ─────────────────────────────────────────

export type PresentationAnalysisRow = {
  id: string;
  submission_id: string;
  file_name: string;
  file_hash: string;
  result: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

// ── Mapping helpers ────────────────────────────────────────────────────────

/**
 * The structured record exposed to UI consumers.
 * `analysis` is only populated when `rawResult` contains a valid analysis
 * (checked by extractAnalysisFromStored).
 */
export type PresentationAnalysisRecord = {
  fileName: string;
  fileHash: string;
  rawResult: Record<string, unknown> | null;
  analysis?: PresentationGeminiAnalysis | undefined;
  createdAt: string;
  updatedAt: string;
};

/**
 * Best-effort extraction of the analysis sub-object from a stored jsonb result.
 * Returns null when the stored payload lacks a valid `analysis` node.
 */
export function extractAnalysisFromStored(
  rawResult: Record<string, unknown> | null | undefined,
): PresentationGeminiAnalysis | null {
  if (!rawResult || typeof rawResult !== "object") return null;
  const analysis = rawResult["analysis"];
  if (!analysis || typeof analysis !== "object") return null;

  // Light structural check — full validation happens in the server function
  // via PresentationGeminiAnalysisSchema when the cache is served.
  const a = analysis as Partial<PresentationGeminiAnalysis>;
  if (
    typeof a.summary !== "string" ||
    typeof a.reasoning !== "string" ||
    !Array.isArray(a.strengths) ||
    !Array.isArray(a.risks) ||
    !a.problemClarity ||
    typeof a.problemClarity.score !== "number"
  ) {
    return null;
  }
  return a as PresentationGeminiAnalysis;
}

/** Convert a Supabase row to the app's analysis record type. */
export function rowToPresentationAnalysis(
  row: PresentationAnalysisRow,
): PresentationAnalysisRecord {
  return {
    fileName: row.file_name,
    fileHash: row.file_hash,
    rawResult: row.result ?? null,
    analysis: extractAnalysisFromStored(row.result) ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── CRUD operation (read only — browsing/clients) ──────────────────────────

/**
 * Retrieve the presentation analysis row for a submission.
 * Returns null if no analysis has been saved yet.
 * Read-only (anon client) — used by client-side code for cache preload.
 */
export async function getPresentationAnalysisBySubmission(
  submissionId: string,
): Promise<PresentationAnalysisRecord | null> {
  const { data, error } = await supabase
    .from("presentation_analyses")
    .select("id, submission_id, file_name, file_hash, result, created_at, updated_at")
    .eq("submission_id", submissionId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `[db/presentation-analyses] getPresentationAnalysisBySubmission: ${error.message}`,
    );
  }
  if (!data) return null;

  return rowToPresentationAnalysis(data as PresentationAnalysisRow);
}
