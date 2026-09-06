/**
 * src/routes/api.analyze-github.ts
 *
 * TanStack Start server function for the GitHub repository analysis POC.
 *
 * Flow (matches the requested demo):
 *   1. Judge pastes a public GitHub repository URL
 *   2. Server validates it and extracts owner/repo
 *   3. Server fetches repository metadata + README + root contents
 *      (GitHub REST API, unauthenticated, no tokens)
 *   4. Server builds a compact evidence payload and makes ONE Gemini call
 *   5. Result is returned to the browser for display
 *
 * This file runs server-side only. Neither GEMINI_API_KEY nor any secret is
 * ever sent to the browser. GitHub fetching and Gemini invocation both happen
 * here, not in browser code.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { callGitHubAnalysis, type GitHubEvidencePayload } from "@/lib/gemini";
import type { GithubGeminiAnalysis } from "@/lib/gemini";

// ─── Request Validation ────────────────────────────────────────────────────

export const GitHubAnalyzeRequestSchema = z.object({
  url: z.string().min(1).max(500),
  /** Tech stack the participant claimed in the submission (cross-check input). */
  claimedStack: z.array(z.string().min(1).max(100)).max(30).default([]),
});

export type GitHubAnalyzeRequest = z.infer<typeof GitHubAnalyzeRequestSchema>;

// ─── Response Types ────────────────────────────────────────────────────────

export type GitHubAnalysisSuccess = {
  ok: true;
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

// ─── Server Function ───────────────────────────────────────────────────────

/**
 * analyzeGithubRepository — server-side GitHub POC endpoint.
 *
 * Fetches metadata, README, and root contents for a public repository, builds
 * a compact evidence payload, and makes exactly ONE Gemini call to produce a
 * technical assessment for the judge. No Supabase persistence in this POC.
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
    const { url, claimedStack } = data;

    // ── Step 1: Validate the URL and extract owner/repo ──────────────────
    const parsed = parseGitHubUrl(url);
    if (!parsed) {
      return { ok: false, error: "Invalid GitHub repository URL.", code: "INVALID_URL" };
    }
    const { owner, repo } = parsed;

    // ── Step 2: Fetch repository metadata ────────────────────────────────
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

    const meta = metaParsed.data;
    return {
      ok: true,
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
    };
  });
