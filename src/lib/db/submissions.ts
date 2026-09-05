/**
 * src/lib/db/submissions.ts
 *
 * Data-access functions for the `submissions` table.
 *
 * These functions use the anonymous Supabase client and are subject to RLS.
 * For server-side writes (which bypass RLS), use the service-role client
 * from a server function — not from this module.
 */

import { supabase } from "@/lib/supabase";
import type { Submission } from "@/lib/data";

// ── Row type as stored in Supabase ─────────────────────────────────────────
//
// The database uses snake_case column names. These map to the camelCase
// TypeScript Submission type used throughout the app.
//
export type SubmissionRow = {
  id: string;
  name: string;
  team: string;
  members: string[];
  category: string;
  problem: string;
  solution: string;
  stack: string[];
  deck_url: string;
  scores: Record<string, number>;
  reasoning: string;
  strengths: string[];
  risks: string[];
  cluster: string;
  status: string;
  submitted_at: string;
  created_at: string;
};

// ── Mapping helpers ────────────────────────────────────────────────────────

/** Convert a Supabase row to the app's Submission type. */
export function rowToSubmission(row: SubmissionRow): Submission {
  return {
    id: row.id,
    name: row.name,
    team: row.team,
    members: row.members,
    category: row.category as Submission["category"],
    problem: row.problem,
    solution: row.solution,
    stack: row.stack,
    deckUrl: row.deck_url,
    scores: row.scores as Submission["scores"],
    reasoning: row.reasoning,
    strengths: row.strengths,
    risks: row.risks,
    cluster: row.cluster,
    status: row.status as Submission["status"],
    submittedAt: row.submitted_at,
  };
}

/** Convert the app's Submission type to a Supabase insert object. */
export function submissionToRow(
  sub: Submission,
): Omit<SubmissionRow, "created_at"> {
  return {
    id: sub.id,
    name: sub.name,
    team: sub.team,
    members: sub.members,
    category: sub.category,
    problem: sub.problem,
    solution: sub.solution,
    stack: sub.stack,
    deck_url: sub.deckUrl,
    scores: sub.scores,
    reasoning: sub.reasoning,
    strengths: sub.strengths,
    risks: sub.risks,
    cluster: sub.cluster,
    status: sub.status,
    submitted_at: sub.submittedAt,
  };
}

// ── CRUD operations ────────────────────────────────────────────────────────

/**
 * Insert a new submission.
 * Returns the created row, or throws on error.
 */
export async function createSubmission(sub: Submission): Promise<SubmissionRow> {
  const { data, error } = await supabase
    .from("submissions")
    .insert(submissionToRow(sub))
    .select()
    .single();

  if (error) throw new Error(`[db/submissions] createSubmission: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return data!;
}

/**
 * List all submissions, newest first.
 */
export async function listSubmissions(): Promise<SubmissionRow[]> {
  const { data, error } = await supabase
    .from("submissions")
    .select("*")
    .order("submitted_at", { ascending: false });

  if (error) throw new Error(`[db/submissions] listSubmissions: ${error.message}`);
  return data ?? [];
}

/**
 * Fetch a single submission by ID.
 * Returns null if not found.
 */
export async function getSubmissionById(id: string): Promise<SubmissionRow | null> {
  const { data, error } = await supabase
    .from("submissions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`[db/submissions] getSubmissionById: ${error.message}`);
  return data;
}
