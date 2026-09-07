/**
 * scripts/test-github.ts
 *
 * Verified tests for the `github_analyses` persistence table + the
 * `submissions.github_url` column that backs the participant GitHub analysis
 * cache (api.analyze-github.ts).
 *
 * ZERO GitHub API calls and ZERO Gemini API calls — the stored `result`
 * payload is a local mock shaped like the server fn response.
 *
 * Run with:
 *   node --experimental-strip-types --env-file=.env.local scripts/test-github.ts
 *
 * Required env vars in .env.local:
 *   VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Diagnostics (clean skips, exit 0):
 *   - github_analyses table does not exist yet → apply that section of schema.sql.
 *   - submissions.github_url column does not exist → apply the idempotent
 *     "ALTER TABLE submissions ADD COLUMN IF NOT EXISTS github_url ..." block
 *     of schema.sql (re-running CREATE TABLE IF NOT EXISTS alone is a NO-OP on
 *     an existing table and will NOT add the column).
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env["VITE_SUPABASE_URL"];
const SERVICE_ROLE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"];

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "ERROR: Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment before running this script.",
  );
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

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

function assert(condition: boolean, label: string, detail?: unknown) {
  if (condition) pass(label);
  else fail(label, detail);
}

// ── Test data ──────────────────────────────────────────────────────────────

const TEST_ID = `test-gh-${Date.now()}`;

const TEST_SUBMISSION = {
  id: TEST_ID,
  name: "GithubRepoTester",
  team: "Test Team",
  members: ["Alice"],
  category: "AI/ML",
  problem: "GitHub analysis persistence verification.",
  solution: "A submission whose public repository is analyzed for technical evidence.",
  stack: ["TypeScript"],
  deck_url: "",
  github_url: "https://github.com/octocat/Hello-World",
  scores: { innovation: 80, impact: 75, technical: 70, feasibility: 70, presentation: 60 },
  reasoning: "",
  strengths: [],
  risks: [],
  cluster: "open-labs",
  status: "Submitted",
  submitted_at: new Date().toISOString(),
};

const MOCK_RESULT = {
  repository: "octocat/Hello-World",
  repositoryUrl: "https://github.com/octocat/Hello-World",
  description: "My first repository on GitHub!",
  primaryLanguage: "HTML",
  topics: [],
  stars: 1,
  forks: 0,
  defaultBranch: "main",
  license: null,
  createdAt: "2013-08-30T16:40:15Z",
  updatedAt: "2025-05-31T08:40:00Z",
  rootFiles: ["README"],
  readmeAvailable: true,
  manifestFiles: [],
  detectedStructure: [],
  analysis: {
    summary: "Mock GitHub analysis for CRUD verification.",
    technologiesObserved: ["HTML"],
    implementationEvidence: "Mock implementation evidence — test payload only.",
    architectureInferred: "Mock inferred architecture — test payload only.",
    strengths: ["Mock strength"],
    risks: ["Mock risk"],
    judgeVerification: ["Verify mock evidence at live demo"],
  },
};

// ── Tests ──────────────────────────────────────────────────────────────────

async function tableExists(): Promise<boolean> {
  const { error } = await db.from("github_analyses").select("id").limit(1);
  return !error;
}

/**
 * The parent `submissions` table must have a `github_url` column for
 * api.analyze-github.ts persistence (Step A upserts it on the parent row).
 * A missing column surfaces as a PGRST204 insert error at runtime.
 */
async function githubUrlColumnExists(): Promise<boolean> {
  const { data, error } = await db.from("submissions").select("github_url").limit(1).maybeSingle();
  if (error) {
    return false;
  }
  return true;
}

async function testGithubAnalyses() {
  const exists = await tableExists();
  if (!exists) {
    console.log(
      "\nSKIP  github_analyses table does not exist yet.",
      "\n      Apply the github_analyses section of supabase/schema.sql,",
      "\n      then re-run this script.",
    );
    return;
  }

  console.log("\nTest F — GitHub Analyses (0 real Gemini / 0 real GitHub calls)");

  // Parent submission row (FK target)
  const { error: parentErr } = await db.from("submissions").insert(TEST_SUBMISSION);
  assert(!parentErr, "F1: parent submission insert succeeds", parentErr);

  // UPSERT #1
  const { data: saved, error: saveErr } = await db
    .from("github_analyses")
    .upsert(
      {
        submission_id: TEST_ID,
        repository_url: TEST_SUBMISSION.github_url,
        repository: MOCK_RESULT.repository,
        result: MOCK_RESULT,
      },
      { onConflict: "submission_id" },
    )
    .select()
    .single();

  assert(!saveErr, "F2: upsert GitHub analysis succeeds", saveErr);
  assert(
    saved?.submission_id === TEST_ID,
    "F3: submission_id stored correctly",
    saved?.submission_id,
  );
  assert(
    saved?.repository_url === TEST_SUBMISSION.github_url,
    "F4: repository_url round-trips",
    saved?.repository_url,
  );
  assert(
    saved?.result?.repository === MOCK_RESULT.repository,
    "F5: result jsonb round-trips (repository)",
    saved?.result?.repository,
  );
  assert(
    saved?.result?.analysis?.summary === MOCK_RESULT.analysis.summary,
    "F6: result.analysis jsonb round-trips (summary)",
    saved?.result?.analysis?.summary,
  );

  // Re-analysis: upsert again with a new URL → no duplicate row, URL updated
  const NEW_URL = "https://github.com/vitejs/vite";
  const second = { ...MOCK_RESULT, repository: "vitejs/vite", repositoryUrl: NEW_URL };
  const { error: upsert2Err } = await db.from("github_analyses").upsert(
    {
      submission_id: TEST_ID,
      repository_url: NEW_URL,
      repository: second.repository,
      result: second,
    },
    { onConflict: "submission_id" },
  );
  assert(!upsert2Err, "F7: re-upsert (re-analyze) succeeds", upsert2Err);

  const { data: rows, error: listErr } = await db
    .from("github_analyses")
    .select("*")
    .eq("submission_id", TEST_ID);
  assert(!listErr, "F8: list after re-upsert succeeds", listErr);
  assert((rows?.length ?? 0) === 1, "F9: re-analysis does NOT create duplicate rows", rows?.length);
  assert(
    rows?.[0]?.repository_url === NEW_URL,
    "F10: repository_url updated to new repo",
    rows?.[0]?.repository_url,
  );

  // Cache read path: fetch back by submission_id
  const { data: fetched, error: fetchErr } = await db
    .from("github_analyses")
    .select("repository_url, result")
    .eq("submission_id", TEST_ID)
    .maybeSingle();
  assert(!fetchErr, "F11: fetch by submission_id succeeds", fetchErr);
  assert(
    fetched?.repository_url === NEW_URL,
    "F12: cached repository_url matches expected",
    fetched?.repository_url,
  );
  assert(!!fetched?.result?.analysis, "F13: cached full result is stored", fetched?.result);
}

async function testForeignKeyGithub() {
  const exists = await tableExists();
  if (!exists) return;

  console.log("\nTest G — GitHub Analyses Foreign Key + RLS");

  const NONEXISTENT_ID = "nonexistent-submission-xxxxxxx";
  const { error } = await db.from("github_analyses").insert({
    submission_id: NONEXISTENT_ID,
    repository_url: "https://github.com/owner/repo",
    repository: "owner/repo",
    result: {},
  });

  assert(
    !!error,
    "G1: insert with nonexistent submission_id is rejected by FK",
    error ? "FK violation received (expected)" : "NO ERROR — FK may not be enforced",
  );
  if (error) {
    const isFK =
      error.code === "23503" ||
      error.message.toLowerCase().includes("foreign key") ||
      error.message.toLowerCase().includes("violates");
    assert(isFK, "G2: error is a foreign key violation", error.message);
  }

  // RLS: anon client reads allowed, writes rejected.
  const ANON_KEY = process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (ANON_KEY) {
    const anonDb = createClient(SUPABASE_URL!, ANON_KEY, { auth: { persistSession: false } });

    const { data: sel, error: selErr } = await anonDb
      .from("github_analyses")
      .select("repository_url")
      .eq("submission_id", TEST_ID)
      .maybeSingle();
    assert(!selErr, "G3: anon client can SELECT github_analyses", selErr);
    assert(!!sel?.repository_url, "G4: anon client reads the cache row", sel?.repository_url);

    const { error: anonInsertErr } = await anonDb.from("github_analyses").insert({
      submission_id: TEST_ID,
      repository_url: "https://github.com/anon-test/repo",
      repository: "anon-test/repo",
      result: {},
    });
    assert(
      !!anonInsertErr,
      "G5: anon client INSERT is rejected by RLS (no write policy)",
      anonInsertErr
        ? `RLS rejection received: ${anonInsertErr.message}`
        : "NO ERROR — anon insert was allowed",
    );
  } else {
    console.log("  SKIP  G3-G5: VITE_SUPABASE_PUBLISHABLE_KEY not set — cannot test anon client");
  }
}

// ── Cleanup ────────────────────────────────────────────────────────────────
async function cleanup() {
  // github_analyses row is cascade-deleted with the submission
  const { error } = await db.from("submissions").delete().eq("id", TEST_ID);
  if (error) {
    console.warn("  WARN  cleanup failed:", error.message);
  } else {
    console.log("  OK    test data removed");
  }
}

// ── Run all tests ──────────────────────────────────────────────────────────
async function main() {
  console.log("==============================================");
  console.log("HackSort AI — GitHub Analyses CRUD Verification");
  console.log(`Test submission ID: ${TEST_ID}`);
  console.log("Real Gemini / GitHub API calls made: 0");
  console.log("==============================================");

  const exists = await tableExists();
  if (!exists) {
    console.log(
      "\nSKIP  github_analyses table does not exist yet.",
      "\n      Apply the github_analyses section of supabase/schema.sql,",
      "\n      then re-run this script.",
    );
    return;
  }

  const columnOk = await githubUrlColumnExists();
  if (!columnOk) {
    console.log("\nSKIP  submissions.github_url column is MISSING.\n");
    console.log("      api.analyze-github.ts persistence upserts github_url on the parent");
    console.log("      submissions row, so this column must exist before analysis can persist.");
    console.log("      Apply the idempotent ALTER TABLE from supabase/schema.sql:");
    console.log("");
    console.log("          ALTER TABLE submissions");
    console.log("            ADD COLUMN IF NOT EXISTS github_url text NOT NULL DEFAULT '';");
    console.log("");
    console.log("      (Re-running CREATE TABLE IF NOT EXISTS submissions alone is a NO-OP");
    console.log("       on the already-existing table and will not add the column.)");
    console.log("");
    console.log("      Then re-run this script.");
    return;
  }

  try {
    await testGithubAnalyses();
    await testForeignKeyGithub();
  } finally {
    await cleanup();
  }

  console.log("\n==============================================");
  console.log(`Results: ${passCount} passed, ${failCount} failed`);
  console.log("==============================================");

  if (failCount > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
