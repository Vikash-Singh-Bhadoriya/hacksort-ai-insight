/**
 * src/routes/api.analyze-github.ts
 *
 * TanStack Start server function for the GitHub repository analysis feature.
 *
 * Flow (matches the product requirement):
 *   1. Judge opens a submission that has a participant-provided GitHub URL
 *   2. Server validates it and extracts owner/repo (canonical form)
 *   3. Cache hit (github_analyses row for this submission + URL) → return
 *      stored result: ZERO GitHub API calls, ZERO Gemini calls
 *   4. Cache miss → fetch repository metadata + README + root contents
 *      (GitHub REST API, unauthenticated, no tokens)
 *   5. Build a compact evidence payload and make ONE Gemini call
 *   6. Upsert the result into Supabase (submissions parent row + github_analyses)
 *   7. Return the result for display
 *
 * This file runs server-side only. Neither GEMINI_API_KEY nor
 * SUPABASE_SERVICE_ROLE_KEY is ever sent to the browser. GitHub fetching and
 * Gemini invocation both happen here, not in browser code.
 *
 * Persistence is REQUIRED for the cache to work: if GitHub + Gemini both
 * succeed but the Supabase upsert fails, the handler returns a clear
 * PERSISTENCE_ERROR instead of pretending the operation fully succeeded. It
 * never returns the persisted payload to a judge as if cached, and never
 * leaks service-role credentials or the Gemini key. All persistence paths
 * log with the [github-analysis] prefix for correlation in server logs.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  callGitHubAnalysis,
  GithubGeminiAnalysisSchema,
  type GitHubEvidencePayload,
} from "@/lib/gemini";
import type { GithubGeminiAnalysis } from "@/lib/gemini";
import { createServiceClient } from "@/lib/supabase";

// ─── Request Validation ────────────────────────────────────────────────────

export const GitHubAnalyzeRequestSchema = z.object({
  url: z.string().min(1).max(500),
  /** Tech stack the participant claimed in the submission (cross-check input). */
  claimedStack: z.array(z.string().min(1).max(100)).max(30).default([]),
  /** Present when the analysis belongs to a submission (cache + persistence key). */
  submissionId: z.string().min(1).max(200).optional(),
  /** When true, skip the cached result (re-analyze) and always re-run the pipeline. */
  forceRefresh: z.boolean().optional().default(false),
  // Submission fields used to upsert the FK parent row in `submissions` so the
  // github_analyses FK constraint can be satisfied (same pattern as api.analyze).
  name: z.string().default(""),
  team: z.string().default(""),
  members: z.array(z.string()).default([]),
  category: z.string().default(""),
  problem: z.string().default(""),
  solution: z.string().default(""),
  stack: z.array(z.string()).default([]),
  deckUrl: z.string().default(""),
  scores: z.record(z.string(), z.number()).default({}),
  reasoning: z.string().default(""),
  strengths: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  cluster: z.string().default(""),
  status: z.string().default("Submitted"),
  submittedAt: z.string().default(""),
});

export type GitHubAnalyzeRequest = z.infer<typeof GitHubAnalyzeRequestSchema>;

// ─── Response Types ────────────────────────────────────────────────────────

export type GitHubAnalysisSuccess = {
  ok: true;
  /** true when served from the github_analyses cache (no GitHub/Gemini calls) */
  cached: boolean;
  repository: string;
  repositoryUrl: string;
  description: string;
  primaryLanguage: string | null;
  topics: string[];
  stars: number;
  forks: number;
  defaultBranch: string;
  license: string | null;
  createdAt: string;
  updatedAt: string;
  /** Top-level directory/file names (capped). */
  rootFiles: string[];
  readmeAvailable: boolean;
  /** Manifest/config files detected at the repository root. */
  manifestFiles: string[];
  /** Structure detected from the root listing (dirs, manifests, Dockerfile…). */
  detectedStructure: string[];
  analysis: GithubGeminiAnalysis;
};
export type GitHubAnalysisError = { ok: false; error: string; code: string };
export type GitHubAnalysisResult = GitHubAnalysisSuccess | GitHubAnalysisError;

// ─── GitHub URL parsing ────────────────────────────────────────────────────

const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/;
const REPO_RE = /^[A-Za-z0-9_.-]+$/;

/**
 * Extract { owner, repo } from a GitHub repository URL. Accepts URLs such as:
 *   https://github.com/owner/repo
 *   http://github.com/owner/repo
 *   https://www.github.com/owner/repo
 *   https://github.com/owner/repo/tree/main (extra path segments ignored)
 *   https://github.com/owner/repo.git
 *
 * Returns null for anything else (other hosts, malformed URLs, invalid names).
 */
export function parseGitHubUrl(rawUrl: string): { owner: string; repo: string } | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;

  const host = parsed.hostname.toLowerCase();
  if (host !== "github.com" && host !== "www.github.com") return null;

  const segments = parsed.pathname.split("/").filter((s) => s.length > 0);
  if (segments.length < 2) return null;

  const owner = segments[0]!;
  let repo = segments[1]!;
  if (repo.endsWith(".git")) repo = repo.slice(0, -4);

  if (!OWNER_RE.test(owner) || !REPO_RE.test(repo)) return null;

  return { owner, repo };
}

/**
 * Canonical form of a GitHub repository URL: `https://github.com/owner/repo`.
 * Used both as the cache consistency key (repository_url column) so a changed
 * participant URL invalidates a stale cached analysis, and as the stored
 * github_url on the submission.
 */
export function canonicalGithubUrl(rawUrl: string): string | null {
  const parsed = parseGitHubUrl(rawUrl);
  if (!parsed) return null;
  return `https://github.com/${parsed.owner}/${parsed.repo}`;
}

// ─── GitHub REST API helpers (server-side only) ────────────────────────────

const GITHUB_API = "https://api.github.com";

async function githubFetch(
  path: string,
  accept = "application/vnd.github+json",
): Promise<Response> {
  return fetch(`${GITHUB_API}${path}`, {
    headers: {
      accept,
      "user-agent": "hacksort-ai-insight-demo",
      "x-github-api-version": "2022-11-28",
    },
  });
}

/**
 * Map a non-OK GitHub response to a friendly error. Returns null when the
 * response is OK. Covers not-found, private/forbidden, and rate limiting.
 */
function normalizeGitHubError(
  res: Response,
  inFlightPath: string,
): { ok: false; error: string; code: string } | null {
  if (res.ok) return null;

  const remaining = res.headers.get("x-ratelimit-remaining");
  const rateLimited = res.status === 403 && remaining === "0";

  if (rateLimited || res.status === 429) {
    return {
      ok: false,
      error: "GitHub API rate limit reached. Please try again later.",
      code: "RATE_LIMIT",
    };
  }

  if (res.status === 404 || res.status === 410) {
    return {
      ok: false,
      error:
        "GitHub repository not found. Make sure the repository is public and the URL is correct.",
      code: "NOT_FOUND",
    };
  }

  if (res.status === 403) {
    return {
      ok: false,
      error: "This POC supports public GitHub repositories only.",
      code: "PRIVATE_REPOSITORY",
    };
  }

  if (res.status === 401) {
    return {
      ok: false,
      error: "GitHub rejected the request. No credentials are used by this POC.",
      code: "GITHUB_AUTH",
    };
  }

  console.warn(`[github] Unexpected status ${res.status} for ${inFlightPath}`);
  return {
    ok: false,
    error: "Could not fetch the GitHub repository. Please try again.",
    code: "GITHUB_ERROR",
  };
}

const RepoResponseSchema = z.object({
  name: z.string(),
  full_name: z.string(),
  html_url: z.string(),
  description: z.string().nullable(),
  language: z.string().nullable(),
  topics: z.array(z.string()).default([]),
  stargazers_count: z.number(),
  forks_count: z.number(),
  default_branch: z.string(),
  license: z.object({ name: z.string() }).nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const ContentsEntrySchema = z.object({
  name: z.string(),
  type: z.string(),
});
const ContentsResponseSchema = z.array(ContentsEntrySchema);

// ─── Evidence extraction ───────────────────────────────────────────────────

const KEY_FILES = [
  "package.json",
  "requirements.txt",
  "pyproject.toml",
  "Pipfile",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "Cargo.toml",
  "go.mod",
  "Dockerfile",
  "docker-compose.yml",
  "docker-compose.yaml",
  "compose.yml",
  "compose.yaml",
  "README.md",
  "README.rst",
];

const STRUCTURE_DIRS = [
  "src",
  "app",
  "lib",
  "backend",
  "back-end",
  "frontend",
  "front-end",
  "server",
  "client",
  "public",
  "tests",
  "test",
  "docs",
  "components",
  "api",
];

const MAX_README_CHARS = 6000;
const MAX_ROOT_ENTRIES = 60;

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}… [truncated for analysis]`;
}

/**
 * Build the compact evidence payload for Gemini from fetched GitHub data.
 * Keeps the payload small: README preview capped, root listing capped, topics capped.
 */
function buildEvidence(
  meta: z.infer<typeof RepoResponseSchema>,
  rootEntries: z.infer<typeof ContentsResponseSchema>,
  readme: string | null,
  claimedStack: string[],
): GitHubEvidencePayload {
  const names = rootEntries.map((e) => e.name);
  const keyFiles = KEY_FILES.filter((m) => names.includes(m));
  const dirs = rootEntries
    .filter((e) => e.type === "dir")
    .map((e) => e.name)
    .filter((n) => STRUCTURE_DIRS.includes(n));
  const structure = [...keyFiles, ...dirs];

  return {
    repository: meta.full_name,
    description: meta.description ?? "",
    primaryLanguage: meta.language,
    topics: meta.topics.slice(0, 10),
    stars: meta.stargazers_count,
    forks: meta.forks_count,
    defaultBranch: meta.default_branch,
    license: meta.license?.name ?? null,
    createdAt: meta.created_at,
    updatedAt: meta.updated_at,
    claimedStack,
    readmeAvailable: readme !== null,
    readmePreview: readme ? truncate(readme, MAX_README_CHARS) : "",
    rootEntries: rootEntries.slice(0, MAX_ROOT_ENTRIES).map((e) => `${e.name} (${e.type})`),
    keyFiles,
    detectedStructure: structure,
  };
}

// ─── Cache + Persistence (server-side only) ────────────────────────────────

/**
 * The subset of GitHubAnalysisSuccess that is persisted (everything except the
 * transient `ok`/`cached` flags, which are re-derived on read). Stored as a
 * single `result` jsonb column on github_analyses.
 */
const StoredGithubResultSchema = z.object({
  repository: z.string(),
  repositoryUrl: z.string(),
  description: z.string(),
  primaryLanguage: z.string().nullable(),
  topics: z.array(z.string()),
  stars: z.number(),
  forks: z.number(),
  defaultBranch: z.string(),
  license: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  rootFiles: z.array(z.string()),
  readmeAvailable: z.boolean(),
  manifestFiles: z.array(z.string()),
  detectedStructure: z.array(z.string()),
  analysis: GithubGeminiAnalysisSchema,
});

type StoredGithubResult = z.infer<typeof StoredGithubResultSchema>;

/**
 * Try to fetch a cached GitHub analysis from Supabase.
 *
 * Returns:
 *   { hit: true, result } — valid cached analysis matching the requested URL
 *   { hit: false }        — no row, OR the row is stale (repository_url differs
 *                            from the submitted URL) → the pipeline may re-run
 *
 * A stale-row check uses the CANONICAL url; a participant changing their
 * repository must never see the old repository's analysis.
 *
 * Throws on genuine database errors (caller logs and treats as a cache miss).
 */
async function getCachedGithubAnalysis(
  submissionId: string,
  canonicalUrl: string,
): Promise<{ hit: true; result: StoredGithubResult } | { hit: false }> {
  console.log("[github-analysis] cache lookup", {
    submissionId,
    repositoryUrl: canonicalUrl,
  });

  const db = createServiceClient();
  if (!db) {
    console.warn("[github-analysis] cache lookup — Supabase not configured, treated as miss", {
      submissionId,
    });
    return { hit: false };
  }

  const { data, error } = await db
    .from("github_analyses")
    .select("repository_url, result, repository, updated_at")
    .eq("submission_id", submissionId)
    .maybeSingle();

  if (error) throw new Error(`[github-analysis] Supabase read error: ${error.message}`);
  if (!data) {
    console.log("[github-analysis] cache miss", { submissionId, repositoryUrl: canonicalUrl });
    return { hit: false };
  }

  if (data.repository_url !== canonicalUrl) {
    console.log("[github-analysis] cache miss — stale URL", {
      submissionId,
      cachedUrl: data.repository_url,
      requestedUrl: canonicalUrl,
      repository: data.repository,
    });
    return { hit: false };
  }

  const validated = StoredGithubResultSchema.safeParse(data.result);
  if (!validated.success) {
    console.warn("[github-analysis] cache miss — stored payload failed schema validation", {
      submissionId,
      repositoryUrl: canonicalUrl,
      reason: validated.error.format(),
    });
    return { hit: false };
  }

  console.log("[github-analysis] cache hit", {
    submissionId,
    repositoryUrl: canonicalUrl,
    repository: validated.data.repository,
    updatedAt: data.updated_at,
  });
  return { hit: true, result: validated.data };
}

/**
 * Persist a GitHub analysis for a submission (upsert semantics).
 *
 * Deterministic, single-row-per-submission behavior:
 *   Step A: upsert the parent `submissions` row (FK parent + stores the
 *           canonical github_url). This guarantees the github_analyses FK
 *           (`submission_id → submissions(id)`) is satisfiable even for
 *           seed/participant submissions that exist only in localStorage.
 *   Step B: upsert `github_analyses` on UNIQUE(submission_id) — one row per
 *           submission; re-analysis updates that same row (never a duplicate).
 *
 * Persistence is REQUIRED. Any failure (missing column, FK violation, RLS,
 * network, unconfigured client) is reported via the thrown error so the
 * handler can return a clear PERSISTENCE_ERROR. It does NOT silently swallow
 * failures — otherwise the judge would see a fresh result that a refresh would
 * lose.
 *
 * Uses the SERVICE-ROLE client (bypasses RLS). Service-role credentials are
 * never exposed to the browser; only server-side callers hit this path.
 *
 * Returns the upserted github_analyses row (verified non-null).
 */
async function persistGithubAnalysis(
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
  canonicalUrl: string,
  result: StoredGithubResult,
): Promise<{
  submission_id: string;
  repository_url: string;
  repository: string;
  result: StoredGithubResult;
  created_at: string;
  updated_at: string;
}> {
  console.log("[github-analysis] persisting analysis", {
    submissionId: submissionData.id,
    repositoryUrl: canonicalUrl,
    repository: result.repository,
  });

  const db = createServiceClient();
  if (!db) {
    throw new Error(
      "[github-analysis] persistence failure — SUPABASE_SERVICE_ROLE_KEY / VITE_SUPABASE_URL not available in the server environment",
    );
  }

  // Step A: parent submissions row (FK target + canonical github_url).
  const parent = {
    id: submissionData.id,
    name: submissionData.name,
    team: submissionData.team,
    members: submissionData.members,
    category: submissionData.category,
    problem: submissionData.problem,
    solution: submissionData.solution,
    stack: submissionData.stack,
    deck_url: submissionData.deckUrl,
    github_url: canonicalUrl,
    scores: submissionData.scores,
    reasoning: submissionData.reasoning,
    strengths: submissionData.strengths,
    risks: submissionData.risks,
    cluster: submissionData.cluster,
    status: submissionData.status,
    submitted_at: submissionData.submittedAt || new Date().toISOString(),
  };
  const { error: subErr } = await db.from("submissions").upsert(parent, { onConflict: "id" });

  if (subErr) {
    throw new Error(
      `[github-analysis] persistence failure — upserting parent submissions row failed: ${subErr.message}`,
    );
  }

  // Step B: upsert the single github_analyses row keyed on submission_id.
  const { data: row, error: anaErr } = await db
    .from("github_analyses")
    .upsert(
      {
        submission_id: submissionData.id,
        repository_url: canonicalUrl,
        repository: result.repository,
        result,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "submission_id" },
    )
    .select("submission_id, repository_url, repository, result, created_at, updated_at")
    .maybeSingle();

  if (anaErr) {
    throw new Error(
      `[github-analysis] persistence failure — upserting github_analyses row failed: ${anaErr.message}`,
    );
  }
  if (!row) {
    throw new Error(
      `[github-analysis] persistence failure — github_analyses upsert returned no row for submission ${submissionData.id}`,
    );
  }

  console.log("[github-analysis] persistence success", {
    submissionId: row.submission_id,
    repositoryUrl: row.repository_url,
    repository: row.repository,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

  return row;
}

// ─── Server Function ───────────────────────────────────────────────────────

/**
 * analyzeGithubRepository — server-side GitHub POC endpoint with Supabase cache.
 *
 * Fetch path: validates the URL → fetches metadata/README/root contents for a
 * public repository → builds a compact evidence payload → makes exactly ONE
 * Gemini call → upserts github_analyses (with the submissions FK parent row) →
 * returns the result.
 *
 * Cache path: when submissionId is provided and a github_analyses row exists
 * for the SAME canonical repository URL, the stored result is returned with
 * ZERO GitHub API calls and ZERO Gemini calls. A changed URL (stale cache) is
 * treated as a miss and re-analyzed.
 */
export const analyzeGithubRepository = createServerFn({ method: "POST" })
  .validator((raw: unknown): GitHubAnalyzeRequest => {
    const parsed = GitHubAnalyzeRequestSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(`Invalid request: ${parsed.error.issues.map((i) => i.message).join(", ")}`);
    }
    return parsed.data;
  })
  .handler(async ({ data }): Promise<GitHubAnalysisResult> => {
    const {
      url,
      claimedStack,
      submissionId,
      forceRefresh,
      // Submission fields for FK parent row upsert (stripped from the pipeline)
      name,
      team,
      members,
      category,
      problem,
      solution,
      stack,
      deckUrl,
      scores,
      reasoning,
      strengths,
      risks,
      cluster,
      status,
      submittedAt,
    } = data;

    // ── Step 0: Validate the URL and derive the canonical form ───────────
    const parsed = parseGitHubUrl(url);
    if (!parsed) {
      return { ok: false, error: "Invalid GitHub repository URL.", code: "INVALID_URL" };
    }
    const canonical = canonicalGithubUrl(url)!;
    const { owner, repo } = parsed;
    const repoName = `${owner}/${repo}`;

    // ── Step 1: Cache hit check (skipped when forceRefresh=true) ─────────
    if (submissionId && !forceRefresh) {
      let cacheResult: Awaited<ReturnType<typeof getCachedGithubAnalysis>>;
      try {
        cacheResult = await getCachedGithubAnalysis(submissionId, canonical);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn("[github-analysis] cache lookup failed, proceeding to fetch", {
          submissionId,
          repositoryUrl: canonical,
          reason: msg,
        });
        cacheResult = { hit: false };
      }

      if (cacheResult.hit) {
        return { ok: true, cached: true, ...cacheResult.result };
      }
    } else if (submissionId) {
      console.log("[github-analysis] forceRefresh=true, bypassing cache", {
        submissionId,
        repositoryUrl: canonical,
      });
    }

    // ── Step 2: Fetch repository metadata ────────────────────────────────
    console.log("[github-analysis] analyzing repository", { submissionId, repository: repoName });
    let repoRes: Response;
    try {
      repoRes = await githubFetch(`/repos/${owner}/${repo}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[github] Network error fetching ${owner}/${repo}:`, msg);
      return {
        ok: false,
        error: "GitHub is temporarily unreachable. Please try again later.",
        code: "NETWORK_ERROR",
      };
    }
    const metaErr = normalizeGitHubError(repoRes, `/repos/${owner}/${repo}`);
    if (metaErr) return metaErr;

    const metaParsed = RepoResponseSchema.safeParse(await repoRes.json());
    if (!metaParsed.success) {
      console.warn("[github] Unexpected repository metadata shape:", metaParsed.error.format());
      return {
        ok: false,
        error: "Could not read repository information from GitHub. Please try again.",
        code: "GITHUB_ERROR",
      };
    }

    // ── Step 3: Fetch root contents (structure evidence) ────────────────
    let contentsRes: Response;
    try {
      contentsRes = await githubFetch(`/repos/${owner}/${repo}/contents/`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[github] Network error fetching contents for ${owner}/${repo}:`, msg);
      return {
        ok: false,
        error: "GitHub is temporarily unreachable. Please try again later.",
        code: "NETWORK_ERROR",
      };
    }
    const contentsErr = normalizeGitHubError(contentsRes, `/repos/${owner}/${repo}/contents/`);
    if (contentsErr) return contentsErr;

    let rootEntries: z.infer<typeof ContentsResponseSchema> = [];
    const contentsParsed = ContentsResponseSchema.safeParse(await contentsRes.json());
    if (contentsParsed.success) {
      rootEntries = contentsParsed.data;
    } else {
      console.warn("[github] Unexpected contents shape:", contentsParsed.error.format());
    }

    // ── Step 4: Fetch README (best effort — missing README is not fatal) ─
    let readme: string | null = null;
    try {
      const readmeRes = await githubFetch(
        `/repos/${owner}/${repo}/readme`,
        "application/vnd.github.raw+json",
      );
      if (readmeRes.ok) {
        readme = await readmeRes.text();
      } else if (readmeRes.status === 404 || readmeRes.status === 410) {
        // No README — analysis continues from metadata + structure.
      } else if (readmeRes.status === 403 || readmeRes.status === 429) {
        // README hit the unauthenticated API rate limit. Degrade gracefully:
        // analysis continues from metadata + structure.
        console.warn(
          `[github] README fetch rate-limited for ${owner}/${repo} — continuing without it`,
        );
      } else {
        // Transient README failure — treat it as unavailable and continue.
      }
    } catch (err) {
      console.warn(`[github] README fetch failed for ${owner}/${repo}:`, err);
    }

    // ── Step 5: Build compact evidence + ONE Gemini call ────────────────
    const evidence = buildEvidence(metaParsed.data, rootEntries, readme, claimedStack);
    const geminiResult = await callGitHubAnalysis(evidence);
    if (!geminiResult.ok) return geminiResult;
    console.log("[github-analysis] Gemini analysis complete", {
      submissionId,
      repository: repoName,
      summaryLength: geminiResult.analysis.summary.length,
    });

    // ── Step 6: Persist (REQUIRED) and return ────────────────────────────
    const meta = metaParsed.data;
    const result = {
      repository: meta.full_name,
      repositoryUrl: meta.html_url,
      description: meta.description ?? "",
      primaryLanguage: meta.language,
      topics: meta.topics.slice(0, 10),
      stars: meta.stargazers_count,
      forks: meta.forks_count,
      defaultBranch: meta.default_branch,
      license: meta.license?.name ?? null,
      createdAt: meta.created_at,
      updatedAt: meta.updated_at,
      rootFiles: rootEntries.slice(0, MAX_ROOT_ENTRIES).map((e) => e.name),
      readmeAvailable: readme !== null,
      manifestFiles: evidence.keyFiles,
      detectedStructure: evidence.detectedStructure,
      analysis: geminiResult.analysis,
    } satisfies StoredGithubResult;

    if (submissionId) {
      try {
        await persistGithubAnalysis(
          {
            id: submissionId,
            name,
            team,
            members,
            category,
            problem,
            solution,
            stack,
            deckUrl,
            scores,
            reasoning,
            strengths,
            risks,
            cluster,
            status,
            submittedAt,
          },
          canonical,
          result,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[github-analysis] persistence failure", {
          submissionId,
          repositoryUrl: canonical,
          repository: repoName,
          reason: msg,
        });
        return {
          ok: false,
          error: "The GitHub analysis could not be saved for this submission. Please try again.",
          code: "PERSISTENCE_ERROR",
        };
      }
    }

    return { ok: true, cached: false, ...result };
  });
