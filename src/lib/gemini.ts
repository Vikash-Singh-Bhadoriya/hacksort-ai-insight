/**
 * src/lib/gemini.ts
 *
 * SERVER-ONLY module. Never import this from client-side React components.
 * It reads GEMINI_API_KEY from process.env and calls the Gemini API.
 *
 * All exports are pure functions with no side-effects on import.
 */

import { z } from "zod";

// ─── Module-level client singleton ────────────────────────────────────────────
//
// GoogleGenAI is instantiated once per serverless instance lifetime rather than
// on every request. The lazy import stays inside getGenAIClient() to prevent
// the SDK from ever being included in the client bundle.
//
// On cold starts this saves the repeated dynamic-import resolution overhead
// (~200–800ms). On warm invocations it is effectively free either way, but
// skipping repeated `new GoogleGenAI()` calls is good hygiene.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _genaiClient: any = null;
let _genaiInitKey: string | null = null; // detect key rotation between restarts

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getGenAIClient(apiKey: string): Promise<any> {
  if (_genaiClient && _genaiInitKey === apiKey) return _genaiClient;
  // @ts-ignore — @google/genai is in package.json and resolved by bun/Vite at build time
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  const { GoogleGenAI } = await import("@google/genai");
  _genaiClient = new GoogleGenAI({ apiKey });
  _genaiInitKey = apiKey;
  return _genaiClient;
}

// ─── Shared Zod Schemas ────────────────────────────────────────────────────

/**
 * Validates the browser's request body before it reaches Gemini.
 * Keeps field types tight so we never send garbage upstream.
 */
export const AnalyzeRequestSchema = z.object({
  name: z.string().min(1).max(200),
  team: z.string().min(1).max(200),
  category: z.string().min(1).max(100),
  problem: z.string().min(1).max(2000),
  solution: z.string().min(1).max(2000),
  stack: z.array(z.string().min(1).max(100)).min(1).max(30),
});

export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;

/**
 * Validates Gemini's structured JSON response.
 * Scores must be integers in [0, 100].
 */
export const GeminiAnalysisSchema = z.object({
  summary: z.string().min(1).max(1000),
  reasoning: z.string().min(1).max(3000),
  strengths: z.array(z.string().min(1).max(300)).min(1).max(6),
  risks: z.array(z.string().min(1).max(300)).min(1).max(6),
  scores: z.object({
    innovation: z.number().int().min(0).max(100),
    impact: z.number().int().min(0).max(100),
    technical: z.number().int().min(0).max(100),
    feasibility: z.number().int().min(0).max(100),
    presentation: z.number().int().min(0).max(100),
  }),
});

export type GeminiAnalysis = z.infer<typeof GeminiAnalysisSchema>;

// ─── Prompt Construction ───────────────────────────────────────────────────

/**
 * Builds the structured hackathon-judge prompt.
 *
 * Design principles:
 * - Explicitly separates "FACTS FROM SUBMISSION" vs "YOUR ANALYSIS"
 * - Instructs the model not to fabricate evidence not in the submission
 * - Instructs the model to acknowledge uncertainty when info is insufficient
 * - Reminds the model these are signals for a human judge, not final verdicts
 */
export function buildPrompt(req: AnalyzeRequest): string {
  const stackList = req.stack.join(", ");

  return `You are an expert hackathon evaluator providing a structured analysis signal to assist a human judge. Your role is to surface observations and considerations — the final judging decision always rests with the human.

## FACTS FROM THE SUBMISSION (take these as given)

- **Project name**: ${req.name}
- **Team**: ${req.team}
- **Category**: ${req.category}
- **Problem statement**: ${req.problem}
- **Proposed solution**: ${req.solution}
- **Technology stack**: ${stackList}

## YOUR ANALYSIS TASK

Evaluate the submission on the five dimensions below. Score each dimension as an integer from 0 to 100.

**Important constraints:**
- Base your analysis ONLY on the information provided above.
- Do NOT fabricate claims about source code quality, GitHub activity, user metrics, benchmarks, deployments, or any information not present in the submission.
- If information is insufficient to assess a dimension confidently, acknowledge the uncertainty explicitly in your reasoning and score conservatively.
- These scores are decision-support signals, not final verdicts. Write reasoning that helps a judge understand your thinking so they can agree or disagree.

### Scoring dimensions

**Innovation (0–100)**
Novelty and originality of the approach. Is this a fresh take on the problem, or a standard application of known tools? Higher scores require genuine novelty in problem framing, solution design, or technical approach.

**Impact (0–100)**
Potential real-world value. How significant and broad is the problem? How much does the proposed solution address it? Consider reach, depth of benefit, and importance.

**Technical Strength (0–100)**
Engineering depth and implementation quality based ONLY on what is described in the submission. Consider the complexity of the technical approach, architecture soundness, and sophistication relative to what the tech stack implies. Do NOT invent assessments of code quality you cannot see.

**Feasibility (0–100)**
Can this realistically be built and deployed? Is the scope credible for a hackathon team? Does the solution make realistic assumptions about data, infrastructure, and adoption?

**Presentation (0–100)**
Clarity and completeness of the submission as communicated. How well does the team communicate the problem, solution, and value? Higher scores require clear, complete, and well-structured communication of all key aspects.

## OUTPUT FORMAT

Return a single JSON object with exactly these fields:
{
  "summary": "1–3 sentence overview of the project and its key distinguishing characteristic",
  "reasoning": "3–6 sentence narrative explaining your overall assessment across dimensions, noting what stands out positively and what limits the score. Be specific to this submission.",
  "strengths": ["2–4 specific strengths based on the submission content"],
  "risks": ["2–4 specific risks or limitations based on the submission content"],
  "scores": {
    "innovation": <integer 0-100>,
    "impact": <integer 0-100>,
    "technical": <integer 0-100>,
    "feasibility": <integer 0-100>,
    "presentation": <integer 0-100>
  }
}`;
}

// ─── Gemini API Call ───────────────────────────────────────────────────────

/**
 * Calls the Gemini API with the analysis prompt and validates the response.
 *
 * Returns either a validated GeminiAnalysis or a structured error object.
 * Never throws — all errors are caught and returned as { ok: false, error }.
 */
export async function callGemini(
  req: AnalyzeRequest,
): Promise<{ ok: true; analysis: GeminiAnalysis } | { ok: false; error: string; code: string }> {
  const t0 = Date.now();

  const apiKey = process.env["GEMINI_API_KEY"];

  if (!apiKey || apiKey.trim() === "") {
    return {
      ok: false,
      error: "Gemini is not configured. Set GEMINI_API_KEY in your .env.local file.",
      code: "NO_API_KEY",
    };
  }

  // ── Client init (singleton — fast on warm instances) ──────────────────────
  const t1 = Date.now();
  const genai = await getGenAIClient(apiKey);
  const t2 = Date.now();

  const prompt = buildPrompt(req);
  const t3 = Date.now();

  console.log(
    `[gemini] request started — client init: ${t2 - t1}ms, prompt build: ${t3 - t2}ms, prompt chars: ${prompt.length}`,
  );

  // ── Gemini API call ────────────────────────────────────────────────────────
  //
  // maxOutputTokens: set to 2500.
  //
  // Token measurement (measure_tokens.mjs, 2026-09-05) showed:
  //   • Typical realistic response  : ~484 tokens  (1691 chars)
  //   • Worst case (Zod schema max) : ~2172 tokens (7599 chars)
  //
  // The previous value of 2048 was BELOW the worst-case schema maximum and
  // therefore risked silently truncating the JSON output for verbose responses,
  // which would cause a JSON parse error or Zod validation failure.
  //
  // 2500 gives a ~15% headroom above the measured 2172-token worst case while
  // staying well below 8192 (Flash context limit).
  //
  // NOTE: maxOutputTokens is a hard STOP cap, not a generation target. Latency
  // is determined by how many tokens the model actually generates before EOS,
  // not by this cap — unless the model would naturally exceed the cap (which
  // the usageMetadata logs below will tell us).

  let rawText: string;
  let usageMeta: { inputTokens?: number; outputTokens?: number } = {};

  try {
    const t4 = Date.now();
    const response = await genai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        // Request structured JSON output matching our schema
        responseMimeType: "application/json",
        temperature: 0.3, // Low temperature for more consistent scoring
        maxOutputTokens: 2500,
      },
    });
    const t5 = Date.now();

    // Log actual token usage when the API provides it (available in most responses)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta = (response as any).usageMetadata;
    if (meta) {
      usageMeta = {
        inputTokens: meta.promptTokenCount ?? meta.inputTokenCount,
        outputTokens: meta.candidatesTokenCount ?? meta.outputTokenCount,
      };
    }

    console.log(
      `[gemini] API call: ${t5 - t4}ms | tokens in: ${usageMeta.inputTokens ?? "?"} out: ${usageMeta.outputTokens ?? "?"} | total so far: ${t5 - t0}ms`,
    );

    const text = response.text;
    if (!text) {
      return {
        ok: false,
        error: "Gemini returned an empty response. Please try again.",
        code: "EMPTY_RESPONSE",
      };
    }
    rawText = text;
  } catch (err: unknown) {
    // Surface rate limiting and quota errors with a useful message
    const message = err instanceof Error ? err.message : String(err);

    console.error(`[gemini] API call failed after ${Date.now() - t0}ms:`, message);

    if (message.includes("429") || message.toLowerCase().includes("quota")) {
      return {
        ok: false,
        error: "Gemini API rate limit reached. Please wait a moment and try again.",
        code: "RATE_LIMIT",
      };
    }
    if (message.includes("503") || message.toLowerCase().includes("unavailable")) {
      return {
        ok: false,
        error:
          "Gemini API is temporarily unavailable due to high demand. Please try again in a moment.",
        code: "UNAVAILABLE",
      };
    }
    if (message.includes("403") || message.toLowerCase().includes("permission")) {
      return {
        ok: false,
        error: "Gemini API key is invalid or lacks permission. Check your GEMINI_API_KEY.",
        code: "AUTH_ERROR",
      };
    }

    console.error("[gemini] API call failed:", message);
    return {
      ok: false,
      error: "Gemini API request failed. Please try again.",
      code: "API_ERROR",
    };
  }

  // ── Parse and validate the JSON response ──────────────────────────────────
  const t6 = Date.now();
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    console.error("[gemini] Failed to parse JSON response:", rawText.slice(0, 500));
    return {
      ok: false,
      error: "Gemini returned malformed JSON. Please try again.",
      code: "PARSE_ERROR",
    };
  }

  const validated = GeminiAnalysisSchema.safeParse(parsed);
  if (!validated.success) {
    console.error("[gemini] Schema validation failed:", validated.error.format());
    return {
      ok: false,
      error: "Gemini response did not match the expected format. Please try again.",
      code: "VALIDATION_ERROR",
    };
  }

  const t7 = Date.now();
  console.log(
    `[gemini] parse+validate: ${t7 - t6}ms | total: ${t7 - t0}ms (client: ${t2 - t1}ms, prompt: ${t3 - t2}ms, api: ${t6 - t3}ms, parse: ${t7 - t6}ms)`,
  );

  return { ok: true, analysis: validated.data };
}

// ─── GitHub Repository Technical Analysis ──────────────────────────────────
//
// POC feature: given evidence captured from a participant's public GitHub
// repository (metadata + README preview + root structure + claimed stack),
// ask Gemini for a technical cross-check a judge can use at demo time.
//
// Deliberately reuses the existing Gemini client singleton and model. Exactly
// one Gemini call is made per repository analysis — the server function
// fetches ALL GitHub evidence first, then calls callGitHubAnalysis once.

/**
 * Compact repository evidence payload sent to Gemini. Kept small to control
 * latency and token usage — never the full repository.
 */
export type GitHubEvidencePayload = {
  repository: string;
  description: string;
  primaryLanguage: string | null;
  topics: string[];
  stars: number;
  forks: number;
  defaultBranch: string;
  license: string | null;
  createdAt: string;
  updatedAt: string;
  /** Tech stack the participant claimed in the HackSort submission. */
  claimedStack: string[];
  readmeAvailable: boolean;
  /** Truncated README markdown (first N chars). Empty when unavailable. */
  readmePreview: string;
  /** Root-level entries as "name (type)" strings, in GitHub order. */
  rootEntries: string[];
  /** Manifest/config files detected at the repository root. */
  keyFiles: string[];
  /** Architectural structure inferred from root entries (dirs, manifests). */
  detectedStructure: string[];
};

/**
 * Validates Gemini's structured JSON response for a GitHub repository analysis.
 *
 * `implementationEvidence` is expected to contain ONLY observations traceable
 * to the evidence payload; `architectureInferred` is expected to be explicitly
 * qualified as inference in the wording. The UI keeps separate labels for both.
 */
export const GithubGeminiAnalysisSchema = z.object({
  summary: z.string().min(1).max(1000),
  technologiesObserved: z.array(z.string().min(1).max(100)).min(0).max(20),
  implementationEvidence: z.string().min(1).max(2500),
  architectureInferred: z.string().min(1).max(2500),
  strengths: z.array(z.string().min(1).max(300)).min(0).max(6),
  risks: z.array(z.string().min(1).max(300)).min(0).max(6),
  judgeVerification: z.array(z.string().min(1).max(300)).min(1).max(6),
});

export type GithubGeminiAnalysis = z.infer<typeof GithubGeminiAnalysisSchema>;

/**
 * Builds the prompt for a technical repository assessment.
 *
 * The prompt hard-separates OBSERVED EVIDENCE from INFERENCE and asks for a
 * cross-check against the participant's claimed tech stack. It is written for
 * a human judge: nothing here decides anything, the judge always decides.
 */
export function buildGitHubPrompt(evidence: GitHubEvidencePayload): string {
  const description = evidence.description.trim() || "(no description provided)";
  const language = evidence.primaryLanguage?.trim() || "(none)";
  const topics = evidence.topics.length ? evidence.topics.join(", ") : "(none)";
  const license = evidence.license ?? "(none)";
  const claimedStack = evidence.claimedStack.length
    ? evidence.claimedStack.join(", ")
    : "(none claimed)";
  const readmeSection = evidence.readmeAvailable
    ? `--- README (truncated preview) ---\n${evidence.readmePreview}`
    : "README is NOT available. Base the assessment on metadata, manifest files and root structure only, and say so explicitly.";
  const rootEntries = evidence.rootEntries.length
    ? evidence.rootEntries.join("\n")
    : "(none returned)";
  const keyFiles = evidence.keyFiles.length ? evidence.keyFiles.join(", ") : "(none detected)";
  const structure = evidence.detectedStructure.length
    ? evidence.detectedStructure.join(", ")
    : "(no obvious structure detected from the root listing)";

  return `You are a technical reviewer assisting a hackathon judge. You are given REPOSITORY EVIDENCE captured from a participant's public GitHub repository, plus the TECH STACK the participant claimed in their submission.

Your job: surface what the repository evidence actually shows, and strictly separate OBSERVED EVIDENCE from INFERENCE. Never present inferred information as confirmed fact.

## REPOSITORY EVIDENCE (observed facts captured from GitHub)

Repository: ${evidence.repository}
Description: ${description}
Primary language: ${language}
Topics: ${topics}
Stars: ${evidence.stars}
Forks: ${evidence.forks}
Default branch: ${evidence.defaultBranch}
License: ${license}
Created: ${evidence.createdAt}
Last updated: ${evidence.updatedAt}

Claimed tech stack (from the HackSort submission): ${claimedStack}

${readmeSection}

--- Root-level contents ---
${rootEntries}

Detected key files: ${keyFiles}
Detected structure: ${structure}

## YOUR ANALYSIS TASK

Answer the questions a hackathon judge cares about:

1. TECHNOLOGIES actually used: list only technologies you can tie to observed evidence (manifest files, file extensions, directories, README statements). Everything else is inference and must be marked as such.
2. CLAIMED STACK CROSS-CHECK: does the repository structure support the tech stack the participant claimed? Note matches, mismatches and gaps. State "no stack claim to verify" if nothing was claimed.
3. ARCHITECTURE: what architecture can be inferred from the structure (monorepo, frontend/backend split, frameworks, service layout)? Mark this clearly as inference.
4. IMPLEMENTATION EVIDENCE: is there evidence of a real implementation (source directories, manifests, config files, tests, Dockerfile)? Be precise about what you observed.
5. STRENGTHS and RISKS: technically strong aspects, and weaknesses/gaps/demo risks.
6. JUDGE VERIFICATION: 2-4 concrete things the judge should verify during the live demo.

## EVIDENCE vs INFERENCE RULES

- An observation must be traceable to the evidence above (e.g. "package.json lists react and vite").
- An inference must be explicitly qualified (e.g. "the structure suggests a monorepo — verify during the demo").
- If the README is unavailable, say so and note the assessment relies on metadata and structure only.
- Do not invent commits, tests, API endpoints, deployment status, code quality or features you cannot see.

## OUTPUT FORMAT

Return a single JSON object with exactly these fields:
{
  "summary": "1-3 sentence technical summary of the repository evidence",
  "technologiesObserved": ["technologies tied to observed evidence"],
  "implementationEvidence": "evidence-based: what the repository actually shows about the implementation",
  "architectureInferred": "inferred architecture, explicitly qualified as inference",
  "strengths": ["2-4 strengths"],
  "risks": ["2-4 weaknesses, gaps or demo risks"],
  "judgeVerification": ["2-4 concrete thing to verify during the live demo"]
}`;
}

/**
 * Calls the Gemini API with the GitHub repository evidence and validates the
 * structured response. Reuses the same client singleton, model and response
 * configuration as the submission analysis. Never throws — returns a
 * structured error object like callGemini.
 */
export async function callGitHubAnalysis(
  evidence: GitHubEvidencePayload,
): Promise<
  { ok: true; analysis: GithubGeminiAnalysis } | { ok: false; error: string; code: string }
> {
  const t0 = Date.now();

  const apiKey = process.env["GEMINI_API_KEY"];

  if (!apiKey || apiKey.trim() === "") {
    return {
      ok: false,
      error: "Gemini is not configured. Set GEMINI_API_KEY in your .env.local file.",
      code: "NO_API_KEY",
    };
  }

  const genai = await getGenAIClient(apiKey);
  const prompt = buildGitHubPrompt(evidence);

  console.log(`[gemini:github] request started — prompt chars: ${prompt.length}`);

  let rawText: string;

  try {
    const response = await genai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        // Same structured-JSON pattern as the submission analysis. maxOutputTokens
        // is a bit higher because this schema has two long prose fields
        // (implementationEvidence + architectureInferred) plus three arrays.
        responseMimeType: "application/json",
        temperature: 0.3,
        maxOutputTokens: 4000,
      },
    });

    const text = response.text;
    if (!text) {
      return {
        ok: false,
        error: "Gemini returned an empty response. Please try again.",
        code: "EMPTY_RESPONSE",
      };
    }
    rawText = text;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);

    console.error(`[gemini:github] API call failed after ${Date.now() - t0}ms:`, message);

    if (message.includes("429") || message.toLowerCase().includes("quota")) {
      return {
        ok: false,
        error: "Gemini API rate limit reached. Please wait a moment and try again.",
        code: "RATE_LIMIT",
      };
    }
    if (message.includes("503") || message.toLowerCase().includes("unavailable")) {
      return {
        ok: false,
        error:
          "Gemini API is temporarily unavailable due to high demand. Please try again in a moment.",
        code: "UNAVAILABLE",
      };
    }
    if (message.includes("403") || message.toLowerCase().includes("permission")) {
      return {
        ok: false,
        error: "Gemini API key is invalid or lacks permission. Check your GEMINI_API_KEY.",
        code: "AUTH_ERROR",
      };
    }

    console.error("[gemini:github] API call failed:", message);
    return {
      ok: false,
      error: "Gemini API request failed. Please try again.",
      code: "API_ERROR",
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    console.error("[gemini:github] Failed to parse JSON response:", rawText.slice(0, 500));
    return {
      ok: false,
      error: "Gemini returned malformed JSON. Please try again.",
      code: "PARSE_ERROR",
    };
  }

  const validated = GithubGeminiAnalysisSchema.safeParse(parsed);
  if (!validated.success) {
    console.error("[gemini:github] Schema validation failed:", validated.error.format());
    return {
      ok: false,
      error: "Gemini response did not match the expected format. Please try again.",
      code: "VALIDATION_ERROR",
    };
  }

  console.log(`[gemini:github] analysis complete in ${Date.now() - t0}ms`);
  return { ok: true, analysis: validated.data };
}
