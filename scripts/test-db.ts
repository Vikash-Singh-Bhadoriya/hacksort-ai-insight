/**
 * scripts/test-db.ts
 *
 * Verified CRUD tests for the Supabase database foundation.
 *
 * Uses the SERVICE ROLE key (bypasses RLS) for writes, so tests are
 * self-contained and do not require any Supabase Auth setup.
 *
 * ZERO Gemini API calls are made. All analysis data is a local mock object.
 *
 * Run with:
 *   node --experimental-strip-types scripts/test-db.ts
 *   (or: npx tsx scripts/test-db.ts)
 *
 * Required env vars in .env.local:
 *   VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";

// ── Load env (Node 20+ supports .env.local via --env-file, or dotenv) ─────
// We read directly from process.env; populate it however works for your setup.
const SUPABASE_URL = process.env["VITE_SUPABASE_URL"];
const SERVICE_ROLE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"];

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "ERROR: Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment before running this script.",
  );
  process.exit(1);
}

// Service-role client: bypasses RLS. NEVER use this in src/ (client bundle).
const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ── Helpers ────────────────────────────────────────────────────────────────

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

/**
 * Compare two score objects key-by-key.
 *
 * PostgreSQL jsonb does NOT preserve insertion key order — it re-sorts keys
 * alphabetically. JSON.stringify therefore fails even when every value is
 * identical (different key order => different string). We compare per key.
 */
function scoresEqual(
  a: Record<string, unknown> | null | undefined,
  b: Record<string, unknown>,
): boolean {
  if (!a) return false;
  const keys = Object.keys(b);
  return keys.every((k) => a[k] === b[k]);
}

// ── Test data ──────────────────────────────────────────────────────────────

const TEST_ID = `test-${Date.now()}`;

const TEST_SUBMISSION = {
  id: TEST_ID,
  name: "TestProject Alpha",
  team: "Test Team",
  members: ["Alice", "Bob"],
  category: "AI/ML",
  problem: "A well-defined test problem statement for CRUD verification.",
  solution: "A clear and complete test solution for verification purposes.",
  stack: ["TypeScript", "Supabase", "React"],
  deck_url: "https://example.com/deck",
  scores: { innovation: 85, impact: 80, technical: 78, feasibility: 72, presentation: 65 },
  reasoning: "Test reasoning text for database round-trip verification.",
  strengths: ["Strong test coverage", "Clear scope"],
  risks: ["This is a test record"],
  cluster: "open-labs",
  status: "Submitted",
  submitted_at: new Date().toISOString(),
};

// Mock Gemini analysis — ZERO real Gemini API calls.
const MOCK_ANALYSIS = {
  submission_id: TEST_ID,
  summary: "A well-structured test submission demonstrating strong technical depth.",
  reasoning:
    "The project addresses a clearly defined problem with a practical solution. " +
    "Technical implementation shows solid understanding of the domain. " +
    "Feasibility is credible for a hackathon scope.",
  strengths: [
    "Clearly scoped problem statement",
    "Practical and deployable solution",
    "Diverse technology stack",
  ],
  risks: [
    "This is a test record — not a real submission",
    "Mock data for CRUD verification only",
  ],
  scores: { innovation: 85, impact: 80, technical: 78, feasibility: 72, presentation: 65 },
};

// ── Test A: Submission create + fetch ──────────────────────────────────────
async function testSubmissions() {
  console.log("\nTest A — Submissions");

  // INSERT
  const { data: inserted, error: insertErr } = await db
    .from("submissions")
    .insert(TEST_SUBMISSION)
    .select()
    .single();

  assert(!insertErr, "A1: insert submission succeeds", insertErr);
  assert(!!inserted?.id, "A2: returned row has id", inserted);
  assert(inserted?.id === TEST_ID, "A3: id matches inserted value", inserted?.id);
  assert(!!inserted?.created_at, "A4: created_at is set", inserted?.created_at);
  assert(inserted?.name === TEST_SUBMISSION.name, "A5: name round-trips correctly", inserted?.name);
  assert(
    inserted?.team === TEST_SUBMISSION.team,
    "A6: team round-trips correctly",
    inserted?.team,
  );

  // LIST
  const { data: list, error: listErr } = await db
    .from("submissions")
    .select("*")
    .eq("id", TEST_ID);

  assert(!listErr, "A7: list submissions succeeds", listErr);
  assert((list?.length ?? 0) >= 1, "A8: inserted record appears in list", list?.length);

  // FETCH BY ID
  const { data: fetched, error: fetchErr } = await db
    .from("submissions")
    .select("*")
    .eq("id", TEST_ID)
    .single();

  assert(!fetchErr, "A9: fetch by id succeeds", fetchErr);
  assert(fetched?.id === TEST_ID, "A10: fetch returns correct id", fetched?.id);
  assert(
    scoresEqual(fetched?.scores, TEST_SUBMISSION.scores),
    "A11: scores jsonb round-trips correctly (key-by-key, jsonb reorders keys)",
    fetched?.scores,
  );
  assert(
    Array.isArray(fetched?.members) && fetched.members.length === 2,
    "A12: members text[] round-trips correctly",
    fetched?.members,
  );
}

// ── Test B: Judging criteria ───────────────────────────────────────────────
async function testCriteria() {
  console.log("\nTest B — Judging Criteria");

  // Check if already seeded (schema.sql seeds on first apply)
  const { data: existing, error: existErr } = await db
    .from("judging_criteria")
    .select("*");

  assert(!existErr, "B1: list criteria succeeds", existErr);

  if ((existing?.length ?? 0) === 0) {
    // Seed if not already present (e.g., freshly created project without schema seeding)
    const DEFAULT_CRITERIA = [
      { name: "Innovation",   description: "Novelty and originality.", weight: 28 },
      { name: "Impact",       description: "Real-world value.",         weight: 26 },
      { name: "Technical",    description: "Engineering depth.",         weight: 22 },
      { name: "Feasibility",  description: "Realistic scope.",           weight: 14 },
      { name: "Presentation", description: "Communication clarity.",     weight: 10 },
    ];
    const { data: seeded, error: seedErr } = await db
      .from("judging_criteria")
      .insert(DEFAULT_CRITERIA)
      .select();
    assert(!seedErr, "B2: seed criteria succeeds", seedErr);
    assert((seeded?.length ?? 0) === 5, "B3: 5 criteria inserted", seeded?.length);
  } else {
    pass("B2: criteria already seeded (skip insert)");
    pass("B3: criteria count >= 1");
  }

  const { data: criteria, error: listErr2 } = await db
    .from("judging_criteria")
    .select("*")
    .order("weight", { ascending: false });

  assert(!listErr2, "B4: list criteria after seed succeeds", listErr2);
  assert((criteria?.length ?? 0) >= 5, "B5: at least 5 rows returned", criteria?.length);

  const innovation = criteria?.find((c) => c.name === "Innovation");
  assert(innovation?.weight === 28, "B6: Innovation weight is 28", innovation?.weight);
}

// ── Test C: Mock Gemini analysis save + fetch ──────────────────────────────
async function testAnalyses() {
  console.log("\nTest C — Mock Gemini Analysis (0 real Gemini API calls)");

  // UPSERT
  const { data: saved, error: saveErr } = await db
    .from("gemini_analyses")
    .upsert(MOCK_ANALYSIS, { onConflict: "submission_id" })
    .select()
    .single();

  assert(!saveErr, "C1: save analysis succeeds", saveErr);
  assert(saved?.submission_id === TEST_ID, "C2: submission_id stored correctly", saved?.submission_id);
  assert(saved?.summary === MOCK_ANALYSIS.summary, "C3: summary round-trips", saved?.summary);
  assert(saved?.reasoning === MOCK_ANALYSIS.reasoning, "C4: reasoning round-trips", saved?.reasoning);
  assert(
    Array.isArray(saved?.strengths) && saved.strengths.length === 3,
    "C5: strengths text[] round-trips",
    saved?.strengths,
  );
  assert(
    Array.isArray(saved?.risks) && saved.risks.length === 2,
    "C6: risks text[] round-trips",
    saved?.risks,
  );
  assert(
    scoresEqual(saved?.scores, MOCK_ANALYSIS.scores),
    "C7: scores jsonb round-trips correctly (key-by-key, jsonb reorders keys)",
    saved?.scores,
  );

  // FETCH BACK
  const { data: fetched, error: fetchErr } = await db
    .from("gemini_analyses")
    .select("*")
    .eq("submission_id", TEST_ID)
    .single();

  assert(!fetchErr, "C8: fetch analysis by submission_id succeeds", fetchErr);
  assert(fetched?.summary === MOCK_ANALYSIS.summary, "C9: re-fetched summary matches", fetched?.summary);
  assert(!!fetched?.created_at, "C10: created_at is set", fetched?.created_at);
}

// ── Test D: Foreign key enforcement ───────────────────────────────────────
async function testForeignKey() {
  console.log("\nTest D — Foreign Key Enforcement");

  const NONEXISTENT_ID = "nonexistent-submission-xxxxxxx";

  const { error } = await db.from("gemini_analyses").insert({
    submission_id: NONEXISTENT_ID,
    summary: "Should be rejected",
    reasoning: "FK test",
    strengths: [],
    risks: [],
    scores: {},
  });

  assert(
    !!error,
    "D1: insert analysis with nonexistent submission_id is rejected by FK",
    error ? "FK violation received (expected)" : "NO ERROR — FK may not be enforced",
  );

  if (error) {
    const isFK =
      error.code === "23503" ||
      error.message.toLowerCase().includes("foreign key") ||
      error.message.toLowerCase().includes("violates");
    assert(isFK, "D2: error is a foreign key violation", error.message);
  }
}

// ── Test E: RLS (anon read) ────────────────────────────────────────────────
async function testRLS() {
  console.log("\nTest E — RLS (anonymous read access)");

  const ANON_KEY = process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!ANON_KEY) {
    console.log("  SKIP  E1-E3: VITE_SUPABASE_PUBLISHABLE_KEY not set — cannot test anon client");
    return;
  }

  const anonDb = createClient(SUPABASE_URL!, ANON_KEY, {
    auth: { persistSession: false },
  });

  // Anon should be able to SELECT submissions
  const { data: subs, error: subsErr } = await anonDb
    .from("submissions")
    .select("id")
    .eq("id", TEST_ID)
    .maybeSingle();

  assert(!subsErr, "E1: anon client can SELECT from submissions", subsErr);
  assert(subs?.id === TEST_ID, "E2: anon client reads the test submission row", subs?.id);

  // Anon should NOT be able to INSERT (no write policy)
  const { error: anonInsertErr } = await anonDb.from("submissions").insert({
    id: `anon-should-fail-${Date.now()}`,
    name: "Should fail",
    team: "Anon",
    category: "AI/ML",
    problem: "x",
    solution: "x",
    members: [],
    stack: [],
    scores: {},
    submitted_at: new Date().toISOString(),
  });

  assert(
    !!anonInsertErr,
    "E3: anon client INSERT is rejected by RLS (no write policy)",
    anonInsertErr
      ? `RLS rejection received: ${anonInsertErr.message}`
      : "NO ERROR — anon insert was allowed (unexpected)",
  );
}

// ── Cleanup ────────────────────────────────────────────────────────────────
async function cleanup() {
  console.log("\nCleanup — removing test data");
  // gemini_analyses row is cascade-deleted with the submission
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
  console.log("HackSort AI — Supabase CRUD Verification");
  console.log(`Test submission ID: ${TEST_ID}`);
  console.log("Real Gemini API calls made: 0");
  console.log("==============================================");

  try {
    await testSubmissions();
    await testCriteria();
    await testAnalyses();
    await testForeignKey();
    await testRLS();
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
