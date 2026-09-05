/**
 * src/routes/api.analyze.ts
 *
 * TanStack Start server function for Gemini-powered project analysis
 * with Supabase persistence.
 *
 * Flow:
 *   1. Check gemini_analyses for an existing row (cache hit → return, 0 Gemini calls)
 *   2. Cache miss → call Gemini → validate → save to gemini_analyses → return
 *   3. If Supabase save fails: log warning, still return the valid Gemini result
 *   4. If Supabase read fails (DB error): log warning, allow Gemini call
 *
 * This file runs server-side only. Neither GEMINI_API_KEY nor
 * SUPABASE_SERVICE_ROLE_KEY is ever sent to the browser.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { AnalyzeRequestSchema, callGemini, GeminiAnalysisSchema } from "@/lib/gemini";
import type { GeminiAnalysis } from "@/lib/gemini";
import { createServiceClient } from "@/lib/supabase";

// ─── Response Types ────────────────────────────────────────────────────────

export type AnalyzeSuccess = {
  ok: true;
  analysis: GeminiAnalysis;
  /** true if the result was served from the Supabase cache (no Gemini call) */
  cached: boolean;
};
export type AnalyzeError = { ok: false; error: string; code: string };
export type AnalyzeResult = AnalyzeSuccess | AnalyzeError;

// ─── Extended request schema ───────────────────────────────────────────────
//
// Includes submissionId + forceRefresh (persistence controls) and the full
// submission fields needed to upsert a row into `submissions` before writing
// to `gemini_analyses` (required for FK satisfaction).
//
// The `submissions` table is the FK parent of `gemini_analyses`. Seed
// submissions (s1–s24) and participant submissions only exist in localStorage;
// they have never been written to Supabase. The upsert here creates the parent
// row on-demand the first time analysis is requested for any submission.

const PersistentAnalyzeRequestSchema = AnalyzeRequestSchema.extend({
  submissionId: z.string().min(1).max(200),
  /** When true, skip the Supabase cache and always call Gemini. */
  forceRefresh: z.boolean().optional().default(false),
  // Full submission fields for FK parent row upsert:
  members: z.array(z.string()).default([]),
  deckUrl: z.string().default(""),
  scores: z.record(z.string(), z.number()).default({}),
  reasoning: z.string().default(""),
  strengths: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  cluster: z.string().default(""),
  status: z.string().default("Submitted"),
  submittedAt: z.string().default(""),
});

type PersistentAnalyzeRequest = z.infer<typeof PersistentAnalyzeRequestSchema>;

// ─── Cache helpers (server-side only) ──────────────────────────────────────

/**
 * Try to fetch an existing analysis from Supabase.
 *
 * Returns:
 *   { hit: true, analysis }   — valid cached analysis found
 *   { hit: false }            — no row exists (Gemini is allowed)
 *
 * Throws on genuine database errors (so callers can distinguish DB failure
 * from a normal "no row" result).
 */
async function getCachedAnalysis(
  submissionId: string,
): Promise<{ hit: true; analysis: GeminiAnalysis } | { hit: false }> {
  const db = createServiceClient();
  if (!db) return { hit: false }; // Supabase not configured — treat as miss

  const { data, error } = await db
    .from("gemini_analyses")
    .select("summary, reasoning, strengths, risks, scores")
    .eq("submission_id", submissionId)
    .maybeSingle();

  if (error) {
    // Genuine DB error — log and re-throw so the caller can decide
    throw new Error(`[api.analyze] Supabase read error: ${error.message}`);
  }
  if (!data) return { hit: false };

  // Validate the stored row through the same Zod schema used for Gemini responses.
  // This guards against schema drift (e.g. if a column was ever corrupt).
  const validated = GeminiAnalysisSchema.safeParse(data);
  if (!validated.success) {
    console.warn(
      "[api.analyze] Cached row for",
      submissionId,
      "failed schema validation — treating as miss:",
      validated.error.format(),
    );
    return { hit: false };
  }

  return { hit: true, analysis: validated.data };
}

/**
 * Persist a validated Gemini analysis.
 *
 * Before inserting into `gemini_analyses`, upserts the parent row in
 * `submissions`. This satisfies the FK constraint for seed submissions
 * (s1–s24) and participant submissions that exist in localStorage but have
 * never been written to Supabase.
 *
 * Uses upsert on UNIQUE(submission_id) for analyses — safe to call repeatedly.
 * Logs a warning on failure but does NOT throw — a persistence failure must
 * not turn a successful Gemini result into an error for the user.
 */
async function persistAnalysis(
  submissionData: {
    id: string;
    name: string;
    team: string;
    members: string[];
    category: string;
    problem: string;
    solution: string;
    stack: string[];
    deckUrl: string;
    scores: Record<string, number>;
    reasoning: string;
    strengths: string[];
    risks: string[];
    cluster: string;
    status: string;
    submittedAt: string;
  },
  analysis: GeminiAnalysis,
): Promise<void> {
  const db = createServiceClient();
  if (!db) {
    console.warn(
      "[api.analyze] Supabase not configured — analysis not persisted for",
      submissionData.id,
    );
    return;
  }

  // Step A: upsert the parent submissions row.
  // ON CONFLICT (id) DO UPDATE ensures idempotency — safe to call every time.
  const { error: subErr } = await db.from("submissions").upsert(
    {
      id: submissionData.id,
      name: submissionData.name,
      team: submissionData.team,
      members: submissionData.members,
      category: submissionData.category,
      problem: submissionData.problem,
      solution: submissionData.solution,
      stack: submissionData.stack,
      deck_url: submissionData.deckUrl,
      scores: submissionData.scores,
      reasoning: submissionData.reasoning,
      strengths: submissionData.strengths,
      risks: submissionData.risks,
      cluster: submissionData.cluster,
      status: submissionData.status,
      submitted_at: submissionData.submittedAt || new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (subErr) {
    console.warn(
      "[api.analyze] Failed to upsert submission",
      submissionData.id,
      "—",
      subErr.message,
      "— analysis will not be persisted (FK would fail)",
    );
    return; // cannot safely insert gemini_analyses without a parent row
  }

  // Step B: upsert the analysis (FK parent row now guaranteed to exist).
  const { error: anaErr } = await db.from("gemini_analyses").upsert(
    {
      submission_id: submissionData.id,
      summary: analysis.summary,
      reasoning: analysis.reasoning,
      strengths: analysis.strengths,
      risks: analysis.risks,
      scores: analysis.scores,
    },
    { onConflict: "submission_id" },
  );

  if (anaErr) {
    console.warn(
      "[api.analyze] Failed to persist analysis for",
      submissionData.id,
      "—",
      anaErr.message,
    );
  } else {
    console.log("[api.analyze] Analysis persisted for", submissionData.id);
  }
}

// ─── Server Function ───────────────────────────────────────────────────────

/**
 * analyzeSubmission — server-side endpoint with Supabase-backed caching.
 *
 * Usage from client:
 *   const result = await analyzeSubmission({
 *     data: { submissionId, name, team, category, problem, solution, stack }
 *   });
 *
 * The response includes `cached: true` when served from Supabase (no Gemini
 * call), or `cached: false` when Gemini was invoked.
 */
export const analyzeSubmission = createServerFn({ method: "POST" })
  .validator((raw: unknown): PersistentAnalyzeRequest => {
    const parsed = PersistentAnalyzeRequestSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(
        `Invalid request: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
      );
    }
    return parsed.data;
  })
  .handler(async ({ data }): Promise<AnalyzeResult> => {
    const {
      submissionId,
      forceRefresh,
      // Submission fields for FK parent row upsert (stripped from geminiFields)
      members,
      deckUrl,
      scores,
      reasoning,
      strengths,
      risks,
      cluster,
      status,
      submittedAt,
      // Remaining fields go to callGemini (name, team, category, problem, solution, stack)
      ...geminiFields
    } = data;

    // ── Step 1: Check cache (skipped when forceRefresh=true) ─────────────
    if (!forceRefresh) {
      let cacheResult: Awaited<ReturnType<typeof getCachedAnalysis>>;
      try {
        cacheResult = await getCachedAnalysis(submissionId);
      } catch (err) {
        // DB error — log it but allow Gemini to proceed rather than failing
        // the whole request. We don't treat every DB hiccup as a cache miss
        // silently — we log explicitly so it's visible in server logs.
        const dbErrMsg = err instanceof Error ? err.message : String(err);
        console.warn("[api.analyze] Cache read failed, proceeding to Gemini:", dbErrMsg);
        cacheResult = { hit: false };
      }

      if (cacheResult.hit) {
        console.log("[api.analyze] Cache hit for", submissionId, "— skipping Gemini");
        return { ok: true, analysis: cacheResult.analysis, cached: true };
      }
    } else {
      console.log("[api.analyze] forceRefresh=true for", submissionId, "— bypassing cache");
    }

    // ── Step 2: Call Gemini (cache miss or forceRefresh) ─────────────────
    console.log("[api.analyze] Calling Gemini for", submissionId);
    const geminiResult = await callGemini(geminiFields);

    if (!geminiResult.ok) {
      return geminiResult; // propagate Gemini error unchanged
    }

    // ── Step 3: Persist submission + analysis ────────────────────────────
    // persistAnalysis upserts the submissions row first (FK parent), then
    // upserts gemini_analyses. Logs on failure but does not throw.
    await persistAnalysis(
      {
        id: submissionId,
        name: geminiFields.name,
        team: geminiFields.team,
        members,
        category: geminiFields.category,
        problem: geminiFields.problem,
        solution: geminiFields.solution,
        stack: geminiFields.stack,
        deckUrl,
        scores,
        reasoning,
        strengths,
        risks,
        cluster,
        status,
        submittedAt,
      },
      geminiResult.analysis,
    );

    return { ok: true, analysis: geminiResult.analysis, cached: false };
  });
