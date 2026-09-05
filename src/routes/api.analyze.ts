/**
 * src/routes/api.analyze.ts
 *
 * TanStack Start server function for Gemini-powered project analysis.
 *
 * This file runs server-side only. The GEMINI_API_KEY environment variable
 * is read here and never sent to the browser.
 *
 * Endpoint: called via createServerFn (RPC-style, not a raw HTTP endpoint)
 * Input:    AnalyzeRequest (validated with Zod)
 * Output:   { ok: true, analysis: GeminiAnalysis } | { ok: false, error, code }
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { AnalyzeRequestSchema, callGemini } from "@/lib/gemini";
import type { GeminiAnalysis } from "@/lib/gemini";

// ─── Response Types ────────────────────────────────────────────────────────

export type AnalyzeSuccess = { ok: true; analysis: GeminiAnalysis };
export type AnalyzeError = { ok: false; error: string; code: string };
export type AnalyzeResult = AnalyzeSuccess | AnalyzeError;

// ─── Server Function ───────────────────────────────────────────────────────

/**
 * analyzeSubmission — server-side Gemini analysis endpoint.
 *
 * Usage from client:
 *   const result = await analyzeSubmission({ data: { name, team, category, problem, solution, stack } });
 */
export const analyzeSubmission = createServerFn({ method: "POST" })
  .validator((raw: unknown): z.infer<typeof AnalyzeRequestSchema> => {
    const parsed = AnalyzeRequestSchema.safeParse(raw);
    if (!parsed.success) {
      // Throw with a plain message — TanStack Start will wrap this as a 400
      throw new Error(`Invalid request: ${parsed.error.issues.map((i) => i.message).join(", ")}`);
    }
    return parsed.data;
  })
  .handler(async ({ data }): Promise<AnalyzeResult> => {
    return callGemini(data);
  });
