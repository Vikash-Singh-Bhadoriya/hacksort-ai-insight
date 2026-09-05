/**
 * src/lib/db/criteria.ts
 *
 * Data-access functions for the `judging_criteria` table.
 *
 * The 5 default criteria rows match DEFAULT_WEIGHTS in src/lib/scoring.ts.
 * seedDefaultCriteria() is idempotent — safe to call on every deploy.
 */

import { supabase } from "@/lib/supabase";

// ── Row type ───────────────────────────────────────────────────────────────

export type JudgingCriterionRow = {
  id: string;
  name: string;
  description: string;
  weight: number;
  created_at: string;
};

// ── Default criteria matching DEFAULT_WEIGHTS in scoring.ts ───────────────

export const DEFAULT_CRITERIA = [
  {
    name: "Innovation",
    description:
      "Novelty and originality of the approach. Fresh take on the problem or genuinely novel solution design.",
    weight: 28,
  },
  {
    name: "Impact",
    description:
      "Potential real-world value. Significance and breadth of the problem and depth of benefit from the solution.",
    weight: 26,
  },
  {
    name: "Technical",
    description:
      "Engineering depth and implementation quality based on what is described in the submission.",
    weight: 22,
  },
  {
    name: "Feasibility",
    description:
      "Can this realistically be built and deployed? Is the scope credible for a hackathon team?",
    weight: 14,
  },
  {
    name: "Presentation",
    description:
      "Clarity and completeness of the submission. How well does the team communicate the problem and solution?",
    weight: 10,
  },
] as const;

// ── CRUD operations ────────────────────────────────────────────────────────

/**
 * List all judging criteria, ordered by weight descending.
 */
export async function listCriteria(): Promise<JudgingCriterionRow[]> {
  const { data, error } = await supabase
    .from("judging_criteria")
    .select("*")
    .order("weight", { ascending: false });

  if (error) throw new Error(`[db/criteria] listCriteria: ${error.message}`);
  return data ?? [];
}

/**
 * Insert the 5 default criteria rows if the table is empty.
 * Idempotent — does nothing if rows already exist.
 * Returns the inserted rows (empty array if already seeded).
 */
export async function seedDefaultCriteria(): Promise<JudgingCriterionRow[]> {
  const existing = await listCriteria();
  if (existing.length > 0) return [];

  const { data, error } = await supabase
    .from("judging_criteria")
    .insert(DEFAULT_CRITERIA.map((c) => ({ ...c })))
    .select();

  if (error) throw new Error(`[db/criteria] seedDefaultCriteria: ${error.message}`);
  return data ?? [];
}
