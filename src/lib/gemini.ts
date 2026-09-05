/**
 * src/lib/gemini.ts
 *
 * SERVER-ONLY module. Never import this from client-side React components.
 * It reads GEMINI_API_KEY from process.env and calls the Gemini API.
 *
 * All exports are pure functions with no side-effects on import.
 */

import { z } from "zod";

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
  const apiKey = process.env["GEMINI_API_KEY"];

  if (!apiKey || apiKey.trim() === "") {
    return {
      ok: false,
      error: "Gemini is not configured. Set GEMINI_API_KEY in your .env.local file.",
      code: "NO_API_KEY",
    };
  }

  // Lazy-import the SDK so it is never bundled into client code
  const { GoogleGenAI } = await import("@google/genai");
  const genai = new GoogleGenAI({ apiKey });

  const prompt = buildPrompt(req);

  let rawText: string;
  try {
    const response = await genai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        // Request structured JSON output matching our schema
        responseMimeType: "application/json",
        temperature: 0.3, // Low temperature for more consistent scoring
        maxOutputTokens: 2048,
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
    // Surface rate limiting and quota errors with a useful message
    const message = err instanceof Error ? err.message : String(err);

    if (message.includes("429") || message.toLowerCase().includes("quota")) {
      return {
        ok: false,
        error: "Gemini API rate limit reached. Please wait a moment and try again.",
        code: "RATE_LIMIT",
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

  // Parse and validate the JSON response
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

  return { ok: true, analysis: validated.data };
}
