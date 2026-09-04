import type { Submission } from "./data";

// ─── Similarity Result Types ───────────────────────────────────────────────

export type SimilarityDimension = {
  /** 0–100 similarity score for this dimension */
  score: number;
  label: string;
};

export type SimilarityResult = {
  /** Overall composite similarity score 0–100 */
  score: number;
  /** Problem-space similarity */
  problemSimilarity: number;
  /** Solution-approach similarity */
  solutionSimilarity: number;
  /** Domain/category similarity */
  domainSimilarity: number;
  /** Objective/goal alignment */
  objectiveSimilarity: number;
  /** Technology stack overlap — intentionally weighted LOW */
  techOverlap: number;
  /** Human-readable explanation derived from actual submission data */
  explanation: string;
};

export type RelatedSubmission = {
  submission: Submission;
  similarity: SimilarityResult;
};

// ─── Methodology Note ─────────────────────────────────────────────────────

/**
 * SIMILARITY METHODOLOGY
 *
 * This is a deterministic rule-based similarity provider.
 * It analyses the semantic meaning of problem, solution, category and objectives.
 * Technology overlap is treated as a supporting signal, NOT a primary driver.
 *
 * Architecture: this provider is designed to be replaced by a real embedding
 * service (e.g. text-embedding-3-small, Cohere, Vertex AI) without changing
 * any downstream API. Swap out `calculateSimilarity` and the rest of the
 * application continues to work identically.
 *
 * Weight distribution:
 *   Problem similarity:  30%
 *   Solution similarity: 25%
 *   Domain similarity:   25%
 *   Objective alignment: 15%
 *   Tech overlap:         5%  ← deliberately low
 */

// ─── Keyword Extraction ────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "by",
  "from",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "that",
  "this",
  "it",
  "its",
  "we",
  "our",
  "their",
  "have",
  "has",
  "can",
  "will",
  "no",
  "not",
  "than",
  "more",
  "most",
  "into",
  "out",
  "up",
  "as",
  "so",
  "if",
  "about",
  "after",
  "before",
  "per",
  "each",
  "any",
  "all",
  "both",
  "which",
  "who",
  "what",
  "when",
  "how",
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOP_WORDS.has(t)),
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 100;
  const intersection = new Set([...a].filter((x) => b.has(x)));
  const union = new Set([...a, ...b]);
  return Math.round((intersection.size / union.size) * 100);
}

// ─── Domain Keywords ───────────────────────────────────────────────────────

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  Agriculture: [
    "farm",
    "crop",
    "soil",
    "yield",
    "harvest",
    "agri",
    "farmer",
    "sow",
    "rotation",
    "monsoon",
    "seed",
    "field",
    "irrigation",
    "smallholder",
  ],
  Healthcare: [
    "health",
    "medical",
    "patient",
    "clinic",
    "diagnosis",
    "triage",
    "hospital",
    "prescription",
    "care",
    "doctor",
    "lab",
    "clinical",
    "diagnostic",
  ],
  Education: [
    "learn",
    "teach",
    "student",
    "school",
    "tutor",
    "curriculum",
    "assessment",
    "classroom",
    "adaptive",
    "knowledge",
    "literacy",
    "teacher",
  ],
  Environment: [
    "environment",
    "forest",
    "carbon",
    "emission",
    "solar",
    "energy",
    "logging",
    "ecosystem",
    "climate",
    "green",
    "renewable",
  ],
  FinTech: [
    "finance",
    "payment",
    "loan",
    "credit",
    "insurance",
    "claim",
    "banking",
    "fintech",
    "invest",
    "money",
    "fund",
    "fraud",
    "document",
  ],
  "AI/ML": [
    "model",
    "neural",
    "embed",
    "llm",
    "inference",
    "training",
    "benchmark",
    "ml",
    "ai",
    "prediction",
    "nlp",
    "speech",
    "language",
  ],
  Cybersecurity: [
    "security",
    "phishing",
    "credential",
    "scan",
    "threat",
    "attack",
    "vulnerability",
    "cyber",
    "detect",
    "malware",
    "anomaly",
  ],
  "Social Impact": [
    "community",
    "social",
    "outreach",
    "volunteer",
    "shelter",
    "tenant",
    "rights",
    "equity",
    "impact",
    "service",
  ],
  "Open Innovation": [
    "open",
    "p2p",
    "decentralized",
    "mesh",
    "sensor",
    "protocol",
    "innovation",
    "experimental",
  ],
};

function domainOverlap(a: Submission, b: Submission): number {
  // Same category = strong base
  const sameCat = a.category === b.category ? 50 : 0;

  const aKeywords = DOMAIN_KEYWORDS[a.category] ?? [];
  const bKeywords = DOMAIN_KEYWORDS[b.category] ?? [];
  const crossDomainWords = new Set([...aKeywords, ...bKeywords]);

  const aText = tokenize(`${a.problem} ${a.solution}`);
  const bText = tokenize(`${b.problem} ${b.solution}`);

  // How many cross-domain keywords appear in both projects?
  const shared = [...crossDomainWords].filter((k) => aText.has(k) && bText.has(k));
  const crossScore =
    crossDomainWords.size > 0 ? Math.round((shared.length / crossDomainWords.size) * 50) : 0;

  return Math.min(100, sameCat + crossScore);
}

function techOverlap(a: Submission, b: Submission): number {
  const aStack = new Set(a.stack.map((t) => t.toLowerCase()));
  const bStack = new Set(b.stack.map((t) => t.toLowerCase()));
  if (aStack.size === 0 || bStack.size === 0) return 0;
  const shared = [...aStack].filter((t) => bStack.has(t));
  const union = new Set([...aStack, ...bStack]);
  return Math.round((shared.length / union.size) * 100);
}

// ─── Explanation Generator ─────────────────────────────────────────────────

function generateExplanation(
  a: Submission,
  b: Submission,
  problemSim: number,
  solutionSim: number,
  domainSim: number,
  objectiveSim: number,
  techOv: number,
): string {
  const parts: string[] = [];

  // Lead with the strongest relationship
  if (a.category === b.category) {
    parts.push(`Both ${a.name} and ${b.name} address problems in the ${a.category} domain.`);
  } else {
    parts.push(
      `${a.name} (${a.category}) and ${b.name} (${b.category}) share cross-domain characteristics.`,
    );
  }

  // Problem similarity
  if (problemSim >= 75) {
    parts.push(
      `Their problem statements are strongly related — both address ${extractCommonTheme(a.problem, b.problem)}.`,
    );
  } else if (problemSim >= 50) {
    parts.push(
      `The problems they solve share a common theme, though they target different aspects of it.`,
    );
  }

  // Solution similarity
  if (solutionSim >= 70) {
    parts.push(
      `Their solution approaches are closely aligned, both relying on ${extractSolutionTheme(a.solution, b.solution)}.`,
    );
  } else if (solutionSim >= 45) {
    parts.push(`Their solutions differ in implementation but converge on a similar mechanism.`);
  } else {
    parts.push(
      `While their problems are related, the two teams have taken substantially different solution paths.`,
    );
  }

  // Tech note — only mention if high, and framed as supporting signal
  if (techOv >= 50) {
    parts.push(
      `There is also significant technology overlap (${techOv}%), though this is treated as a supporting signal rather than the primary similarity driver.`,
    );
  } else if (techOv >= 30) {
    parts.push(
      `Some technology overlap exists (${techOv}%), but it is not the main factor in this similarity rating.`,
    );
  }

  return parts.join(" ");
}

function extractCommonTheme(problemA: string, problemB: string): string {
  const aTokens = tokenize(problemA);
  const bTokens = tokenize(problemB);
  const shared = [...aTokens].filter((t) => bTokens.has(t) && t.length > 3);
  if (shared.length >= 2) return shared.slice(0, 3).join(", ");
  return "a shared operational challenge";
}

function extractSolutionTheme(solA: string, solB: string): string {
  const aTokens = tokenize(solA);
  const bTokens = tokenize(solB);
  const shared = [...aTokens].filter((t) => bTokens.has(t) && t.length > 4);
  if (shared.length >= 2) return shared.slice(0, 2).join(" and ");
  return "similar technical approaches";
}

// ─── Core Similarity Function ──────────────────────────────────────────────

/**
 * Calculate semantic similarity between two submissions.
 *
 * IMPORTANT: This is the primary extension point.
 * To replace with real embeddings:
 *   1. Call your embedding service for each submission's problem + solution text
 *   2. Compute cosine similarity for the embedding vectors
 *   3. Map cosine sim [−1, 1] → [0, 100]
 *   4. Use those values for problemSimilarity and solutionSimilarity
 *   5. Keep domainSimilarity and techOverlap from this rule-based impl or compute them similarly
 *
 * The rest of the application (RelatedSubmissions, ClusterDetail, SimilarityPanel)
 * will continue to work with no changes.
 */
export function calculateSimilarity(a: Submission, b: Submission): SimilarityResult {
  if (a.id === b.id) {
    return {
      score: 100,
      problemSimilarity: 100,
      solutionSimilarity: 100,
      domainSimilarity: 100,
      objectiveSimilarity: 100,
      techOverlap: 100,
      explanation: "Same project.",
    };
  }

  const problemSim = jaccardSimilarity(tokenize(a.problem), tokenize(b.problem));
  const solutionSim = jaccardSimilarity(tokenize(a.solution), tokenize(b.solution));
  const domainSim = domainOverlap(a, b);

  // Objective alignment: combine problem + solution semantic field
  const aObjective = tokenize(`${a.problem} ${a.solution} ${a.category}`);
  const bObjective = tokenize(`${b.problem} ${b.solution} ${b.category}`);
  const objectiveSim = jaccardSimilarity(aObjective, bObjective);

  const techOv = techOverlap(a, b);

  // Weighted composite — tech is intentionally low weight
  const score = Math.round(
    problemSim * 0.3 + solutionSim * 0.25 + domainSim * 0.25 + objectiveSim * 0.15 + techOv * 0.05,
  );

  const explanation = generateExplanation(
    a,
    b,
    problemSim,
    solutionSim,
    domainSim,
    objectiveSim,
    techOv,
  );

  return {
    score: Math.min(100, Math.max(0, score)),
    problemSimilarity: problemSim,
    solutionSimilarity: solutionSim,
    domainSimilarity: domainSim,
    objectiveSimilarity: objectiveSim,
    techOverlap: techOv,
    explanation,
  };
}

/**
 * Get the N most similar submissions to the given submission.
 * Excludes the submission itself.
 * Returns results sorted by descending similarity score.
 */
export function getRelatedSubmissions(
  sub: Submission,
  all: Submission[],
  n: number = 4,
): RelatedSubmission[] {
  return all
    .filter((s) => s.id !== sub.id)
    .map((s) => ({ submission: s, similarity: calculateSimilarity(sub, s) }))
    .sort((a, b) => b.similarity.score - a.similarity.score)
    .slice(0, n);
}

/**
 * Get pairwise similarity for all projects in a given list.
 * Returns unique pairs (a,b) where a.id < b.id.
 */
export function getPairwiseSimilarities(
  subs: Submission[],
): Array<{ a: Submission; b: Submission; similarity: SimilarityResult }> {
  const pairs: Array<{ a: Submission; b: Submission; similarity: SimilarityResult }> = [];
  for (let i = 0; i < subs.length; i++) {
    for (let j = i + 1; j < subs.length; j++) {
      const a = subs[i]!;
      const b = subs[j]!;
      pairs.push({
        a,
        b,
        similarity: calculateSimilarity(a, b),
      });
    }
  }
  return pairs.sort((x, y) => y.similarity.score - x.similarity.score);
}
