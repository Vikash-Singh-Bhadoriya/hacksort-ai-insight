import type { Scores } from "./data";

// ─── Judge Weight Model ────────────────────────────────────────────────────

export type JudgeWeights = {
  innovation: number; // 0–100
  impact: number;
  technical: number;
  feasibility: number;
  presentation: number;
};

/**
 * Default weights that reproduce the original overallSignal formula.
 * innovation 28, impact 26, technical 22, feasibility 14, presentation 10
 * (sum = 100)
 */
export const DEFAULT_WEIGHTS: JudgeWeights = {
  innovation: 28,
  impact: 26,
  technical: 22,
  feasibility: 14,
  presentation: 10,
};

// ─── Core Scoring Function ─────────────────────────────────────────────────

/**
 * Calculate a composite score from AI signal scores and judge-configured weights.
 *
 * Weights are normalized internally so the caller can pass raw 0–100 values
 * that don't necessarily sum to 100 (we handle edge cases gracefully).
 *
 * The AI scores themselves are NEVER mutated. This function is a pure
 * read-only combination of signals and judge preferences.
 *
 * @param scores  The AI-generated scores for this submission.
 * @param weights The judge-configured weight distribution.
 * @returns       A composite score in [0, 100], rounded to the nearest integer.
 */
export function calculateCompositeScore(scores: Scores, weights: JudgeWeights): number {
  const total =
    weights.innovation +
    weights.impact +
    weights.technical +
    weights.feasibility +
    weights.presentation;

  if (total === 0) {
    // Degenerate case — return simple average
    return Math.round(
      (scores.innovation +
        scores.impact +
        scores.technical +
        scores.feasibility +
        scores.presentation) /
        5,
    );
  }

  const raw =
    scores.innovation * (weights.innovation / total) +
    scores.impact * (weights.impact / total) +
    scores.technical * (weights.technical / total) +
    scores.feasibility * (weights.feasibility / total) +
    scores.presentation * (weights.presentation / total);

  return Math.round(raw);
}

/**
 * Calculate the sum of all weight values.
 * Used to display total and warn when != 100.
 */
export function weightTotal(w: JudgeWeights): number {
  return w.innovation + w.impact + w.technical + w.feasibility + w.presentation;
}

/**
 * Returns true if the provided weights are meaningfully different from the defaults.
 * Used to decide whether to show the composite score separately from the AI signal.
 */
export function isCustomWeights(w: JudgeWeights): boolean {
  return (
    w.innovation !== DEFAULT_WEIGHTS.innovation ||
    w.impact !== DEFAULT_WEIGHTS.impact ||
    w.technical !== DEFAULT_WEIGHTS.technical ||
    w.feasibility !== DEFAULT_WEIGHTS.feasibility ||
    w.presentation !== DEFAULT_WEIGHTS.presentation
  );
}

/**
 * Normalize weights so they sum to exactly 100.
 * Preserves ratios; safe for display and calculation.
 */
export function normalizeWeights(w: JudgeWeights): JudgeWeights {
  const total = weightTotal(w);
  if (total === 0) return { ...DEFAULT_WEIGHTS };
  const scale = 100 / total;
  return {
    innovation: Math.round(w.innovation * scale),
    impact: Math.round(w.impact * scale),
    technical: Math.round(w.technical * scale),
    feasibility: Math.round(w.feasibility * scale),
    presentation: Math.round(w.presentation * scale),
  };
}

// ─── Backward-compat alias ─────────────────────────────────────────────────

/**
 * @deprecated Use calculateCompositeScore(scores, DEFAULT_WEIGHTS) instead.
 * Kept as a stable alias so existing callers don't break.
 */
export function overallSignalFromScores(scores: Scores): number {
  return calculateCompositeScore(scores, DEFAULT_WEIGHTS);
}
