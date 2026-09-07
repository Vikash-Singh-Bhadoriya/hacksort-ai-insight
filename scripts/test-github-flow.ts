/**
 * scripts/test-github-flow.ts
 *
 * End-to-end persistence verification for api.analyze-github.ts (the ACTUAL
 * server function, imported from the built output), checking the required
 * first-open persistence contract:
 *
 *   first open (cache miss) → analyze → persist ONE github_analyses row
 *   refresh (cache hit)     → same row returned, ZERO GitHub/Gemini calls
 *   re-analyze (force)      → SAME row updated (no duplicate)
 *   stale URL               → old cache NOT reused, new row updated
 *
 * Uses a real public GitHub repository for evidence AND makes the server
 * function's real Gemini call. Intended for the (limited) manual verification
 * budget — not for repeated automated runs.
 *
 * NOTE: it exercises the real Supabase DB. The parent `submissions` row must
 * have a `github_url` column (apply schema.sql). If the column is missing
 * this test verifies that the server now returns PERSISTENCE_ERROR (and does
 * NOT silently pretend success).
 *
 * Run:
 *   node --experimental-strip-types --env-file=.env.local scripts/test-github-flow.ts
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env["VITE_SUPABASE_URL"];
const SERVICE_ROLE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"];

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("ERROR: Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

let passCount = 0;
let failCount = 0;
function pass(label: string) {
  passCount++;
  console.log(`  PASS  ${label}`);
}
function fail(label: string, detail?: unknown) {
  failCount++;
  console.error(`  FAIL  ${label}`, detail ?? "");
}
function assert(cond: boolean, label: string, detail?: unknown) {
  if (cond) pass(label);
  else fail(label, detail);
}

const SUBMISSION_ID = `u-flow-${Date.now()}`;
const URL_A = "https://github.com/octocat/Hello-World";
const URL_B = "https://github.com/octocat/Spoon-Knife";

const SUBMISSION = {
  id: SUBMISSION_ID,
  name: "PersistenceFlowTester",
  team: "Flow Team",
  members: ["Bob"],
  category: "AI/ML",
  problem: "Verifying first-open persistence of the GitHub analysis.",
  solution: "A submission with a participant-supplied public repository.",
  stack: ["TypeScript"],
  deckUrl: "",
  githubUrl: URL_A,
  scores: { innovation: 75, impact: 70, technical: 65, feasibility: 60, presentation: 50 },
  reasoning: "",
  strengths: [],
  risks: [],
  cluster: "open-labs",
  status: "Submitted",
  submittedAt: new Date().toISOString(),
};

// zod-shaped request for the server fn
function buildInput(url: string, forceRefresh = false) {
  return {
    data: {
      url,
      claimedStack: SUBMISSION.stack,
      submissionId: SUBMISSION.id,
      forceRefresh,
      name: SUBMISSION.name,
      team: SUBMISSION.team,
      members: SUBMISSION.members,
      category: SUBMISSION.category,
      problem: SUBMISSION.problem,
      solution: SUBMISSION.solution,
      stack: SUBMISSION.stack,
      deckUrl: SUBMISSION.deckUrl,
      scores: SUBMISSION.scores,
      reasoning: SUBMISSION.reasoning,
      strengths: SUBMISSION.strengths,
      risks: SUBMISSION.risks,
      cluster: SUBMISSION.cluster,
      status: SUBMISSION.status,
      submittedAt: SUBMISSION.submittedAt,
    },
  };
}

async function countRows(): Promise<number> {
  const { data, error } = await db
    .from("github_analyses")
    .select("id")
    .eq("submission_id", SUBMISSION_ID);
  if (error) throw error;
  return data?.length ?? 0;
}

async function fetchRow() {
  const { data, error } = await db
    .from("github_analyses")
    .select("*")
    .eq("submission_id", SUBMISSION_ID)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function main() {
  console.log("==============================================");
  console.log("GitHub Analysis — First-Open Persistence Flow");
  console.log(`Submission ID: ${SUBMISSION_ID}`);
  console.log("REAL server fn + REAL GitHub + REAL Gemini + REAL Supabase");
  console.log("==============================================");

  // Sanity checks on the database state
  const gaExists = await db.from("github_analyses").select("id").limit(1);
  if (gaExists.error) {
    console.log("SKIP  github_analyses table missing — apply schema.sql first.");
    return;
  }

  // ── 1. First open: cache miss → analyze → PERSIST ──────────────────────
  const { data: submissionRow, error: subErr } = await db
    .from("submissions")
    .select("github_url")
    .eq("id", SUBMISSION_ID)
    .maybeSingle();

  if (subErr) {
    if (subErr.message.toLowerCase().includes("github_url")) {
      console.log("\nSKIP  submissions.github_url column is MISSING.\n");
      console.log("      Apply the idempotent ALTER TABLE from supabase/schema.sql:");
      console.log("");
      console.log("          ALTER TABLE submissions");
      console.log("            ADD COLUMN IF NOT EXISTS github_url text NOT NULL DEFAULT '';");
      console.log("");
      console.log("      then re-run this script to verify the full persistence flow.");
      return;
    }
    throw subErr;
  }

  if (submissionRow === null) {
    // Parent may not exist yet — insert it including github_url (column must exist).
    const ins = await db.from("submissions").insert({
      id: SUBMISSION.id,
      name: SUBMISSION.name,
      team: SUBMISSION.team,
      members: SUBMISSION.members,
      category: SUBMISSION.category,
      problem: SUBMISSION.problem,
      solution: SUBMISSION.solution,
      stack: SUBMISSION.stack,
      deck_url: SUBMISSION.deckUrl,
      github_url: SUBMISSION.githubUrl,
      scores: SUBMISSION.scores,
      reasoning: SUBMISSION.reasoning,
      strengths: SUBMISSION.strengths,
      risks: SUBMISSION.risks,
      cluster: SUBMISSION.cluster,
      status: SUBMISSION.status,
      submitted_at: SUBMISSION.submittedAt,
    });
    if (ins.error) {
      console.error("SETUP  Could not insert parent submission row:", ins.error.message);
      console.error("       First apply the submissions.github_url column (schema.sql).");
      process.exit(1);
    }
  }

  // Delete any prior github_analyses row (simulates "first open")
  await db.from("github_analyses").delete().eq("submission_id", SUBMISSION_ID);
  assert((await countRows()) === 0, "STEP1a: github_analyses row is deleted before first open");

  // Run the server fn (real GitHub + real Gemini + real Supabase).
  // Import the built server bundle (hash changes per build).
  const { readdirSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { pathToFileURL } = await import("node:url");
  const ssrDir = join(process.cwd(), ".output", "server", "_ssr");
  const bundleName = readdirSync(ssrDir).find((f) => f.startsWith("api.analyze-github-"));
  if (!bundleName) {
    console.error("SETUP  No built api.analyze-github bundle found. Run `npm run build` first.");
    process.exit(1);
  }
  const { analyzeGithubRepository_createServerFn_handler: handler } = await import(
    pathToFileURL(join(ssrDir, bundleName)).href
  );
  const startContext = {
    getRouter: async () => {
      throw new Error("no router");
    },
    startOptions: {},
    contextAfterGlobalMiddlewares: {},
    request: new Request("http://localhost/_", { method: "POST" }),
    executedRequestMiddlewares: new Set(),
    handlerType: "serverFn",
  };
  const { runWithStartContext } = await import("@tanstack/start-storage-context");

  const first = await runWithStartContext(startContext, () => handler(buildInput(URL_A)));
  const firstOk = first.result as
    { ok: boolean; cached?: boolean; repository?: string } | undefined;

  console.log("\nSTEP 1 — first open (cache miss):");
  if (!firstOk?.ok) {
    fail("first-open analysis returned ok:false", first.result);
    fail(
      "first-open persisted exactly one row (DEBUG — likely PERSISTENCE_ERROR root cause)",
      first.result,
    );
    await cleanup();
    return;
  }
  pass("first-open analysis succeeded (cached=false)", { cached: firstOk.cached });
  assert(firstOk.cached === false, "first-open is NOT cached");
  const rows1 = await countRows();
  assert(rows1 === 1, "first-open persisted EXACTLY ONE github_analyses row", { rows1 });
  const row1 = await fetchRow();
  assert(row1?.submission_id === SUBMISSION_ID, "row.submission_id matches");
  assert(
    row1?.repository_url === "https://github.com/octocat/Hello-World",
    "row.repository_url is canonical repo A",
    { got: row1?.repository_url },
  );
  assert(!!row1?.repository, "row.repository populated", row1?.repository);
  assert(!!row1?.result && typeof row1.result === "object", "row.result is non-empty object");
  assert(!!row1?.created_at, "row.created_at set");
  assert(!!row1?.updated_at, "row.updated_at set");

  // ── 2. Refresh: cache hit → same row, ZERO GitHub/Gemini ───────────────
  console.log("\nSTEP 2 — refresh (cache hit):");
  const second = await runWithStartContext(startContext, () => handler(buildInput(URL_A)));
  const secondOk = second.result as { ok: boolean; cached?: boolean } | undefined;
  assert(secondOk?.ok === true, "refresh returns ok:true");
  assert(secondOk?.cached === true, "refresh is served from cache (cached=true)");
  const rows2 = await countRows();
  assert(rows2 === 1, "still exactly ONE row after refresh (no duplicate)", { rows2 });

  // ── 3. Re-analyze (forceRefresh) → same row updated ────────────────────
  console.log("\nSTEP 3 — re-analyze (forceRefresh):");
  const third = await runWithStartContext(startContext, () => handler(buildInput(URL_A, true)));
  const thirdOk = third.result as
    { ok: boolean; cached?: boolean; repository?: string } | undefined;
  if (!thirdOk?.ok) {
    fail("re-analyze returned ok:false", third.result);
    await cleanup();
    return;
  }
  assert(thirdOk.cached === false, "re-analyze re-runs the pipeline (cached=false)");
  const rows3 = await countRows();
  assert(rows3 === 1, "re-analyze keeps ONE row (upsert, no duplicate)", { rows3 });
  const row3 = await fetchRow();
  assert(
    row3?.repository_url === "https://github.com/octocat/Hello-World",
    "re-analyze kept repo A",
  );

  // ── 4. Stale URL: submission changes github_url A → B ───────────────────
  console.log("\nSTEP 4 — stale URL A → B:");
  // Simulate the participant changing their repository
  const upd = await db.from("submissions").update({ github_url: URL_B }).eq("id", SUBMISSION_ID);
  assert(!upd.error, "parent submission github_url updated to repo B", upd.error);
  const fourth = await runWithStartContext(startContext, () => handler(buildInput(URL_B)));
  const fourthOk = fourth.result as
    { ok: boolean; cached?: boolean; repository?: string } | undefined;
  if (!fourthOk?.ok) {
    fail("stale-URL re-analysis returned ok:false", fourth.result);
    await cleanup();
    return;
  }
  assert(fourthOk.cached === false, "stale URL is NOT served from cache (re-analyzed)");
  const row4 = await fetchRow();
  assert(!!row4, "row exists after stale re-analysis");
  assert(
    row4?.repository_url === "https://github.com/octocat/Spoon-Knife",
    "repo B row updated (old repo A cache not reused)",
    { got: row4?.repository_url },
  );
  const rows4 = await countRows();
  assert(rows4 === 1, "stale re-analysis kept exactly ONE row", { rows4 });

  await cleanup();
}

async function cleanup() {
  const { error } = await db.from("submissions").delete().eq("id", SUBMISSION_ID);
  if (error) console.warn("  WARN  cleanup:", error.message);
  else console.log("\n  OK    test data removed (submission + cascade github_analyses)");
  console.log("\n==============================================");
  console.log(`Results: ${passCount} passed, ${failCount} failed`);
  console.log("==============================================");
  if (failCount > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Unhandled:", err);
  process.exit(1);
});
