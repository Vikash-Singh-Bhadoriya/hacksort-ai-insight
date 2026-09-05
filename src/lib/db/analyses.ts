/**
 * src/lib/db/analyses.ts
 *
 * Data-access functions for the `gemini_analyses` table.
 *
 * The table enforces UNIQUE(submission_id) — one analysis per submission.
 * `saveAnalysis` uses upsert so it both inserts and overwrites cleanly.
 *
 * Intended future flow (separate task, do not implement here):
 *   Submission -> Gemini API -> saveAnalysis -> getAnalysisBySubmission
 */

import { supabase } from "@/lib/supabase";
import type { GeminiAnalysis } from "@/lib/gemini";

// ── Row type as stored in Supabase ─────────────────────────────────────────

export type GeminiAnalysisRow = {
  id: string;
  submission_id: string;
  summary: string;
  reasoning: string;
  strengths: string[];
  risks: string[];
  scores: Record<string, number>;
  created_at: string;
};

// ── Mapping helpers ────────────────────────────────────────────────────────

/** Convert a Supabase row to the app's GeminiAnalysis type. */
export function rowToAnalysis(row: GeminiAnalysisRow): GeminiAnalysis {
  return {
    summary: row.summary,
    reasoning: row.reasoning,
    strengths: row.strengths,
    risks: row.risks,
    scores: row.scores as GeminiAnalysis["scores"],
  };
}

// ── CRUD operations ────────────────────────────────────────────────────────

/**
 * Save (insert or overwrite) a Gemini analysis for a submission.
 *
 * Uses upsert on the UNIQUE(submission_id) constraint so calling this
 * function a second time for the same submission updates the existing row
 * rather than failing with a duplicate-key error.
 *
 * Returns the saved row, or throws on error.
 */
export async function saveAnalysis(
  submissionId: string,
  analysis: GeminiAnalysis,
): Promise<GeminiAnalysisRow> {
  const { data, error } = await supabase
    .from("gemini_analyses")
    .upsert(
      {
        submission_id: submissionId,
        summary: analysis.summary,
        reasoning: analysis.reasoning,
        strengths: analysis.strengths,
        risks: analysis.risks,
        scores: analysis.scores,
      },
      { onConflict: "submission_id" },
    )
    .select()
    .single();

  if (error) throw new Error(`[db/analyses] saveAnalysis: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return data!;
}

/**
 * Retrieve the Gemini analysis for a given submission.
 * Returns null if no analysis has been saved yet.
 */
export async function getAnalysisBySubmission(
  submissionId: string,
): Promise<GeminiAnalysisRow | null> {
  const { data, error } = await supabase
    .from("gemini_analyses")
    .select("*")
    .eq("submission_id", submissionId)
    .maybeSingle();

  if (error)
    throw new Error(`[db/analyses] getAnalysisBySubmission: ${error.message}`);
  return data;
}
