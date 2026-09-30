/**
 * src/routes/api.analyze-presentation.ts
 *
 * TanStack Start server function for PPTX presentation analysis.
 *
 * Flow (matches the product requirement and the GitHub analysis pattern):
 *   1. Judge opens a submission that has an uploaded presentation
 *   2. Server validates the storage path + expected file hash
 *   3. Cache hit (presentation_analyses row for this submission + file hash)
 *      → return stored result: ZERO storage downloads, ZERO Gemini calls
 *   4. Cache miss → download the PPTX from the private Storage bucket
 *   5. Verify the SHA-256 hash matches what the participant uploaded
 *   6. Extract deterministic text/structure evidence (pptx-extractor)
 *   7. Build a compact evidence payload and make ONE Gemini call
 *   8. Upsert the result into Supabase (submissions parent row +
 *      presentation_analyses row, keyed UNIQUE(submission_id))
 *   9. Return the result for display
 *
 * Persistence is REQUIRED for the cache to work: if extraction + Gemini both
 * succeed but the Supabase upsert fails, the handler returns a clear
 * PERSISTENCE_ERROR. Never logs API keys, service-role keys, or file contents.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash } from "node:crypto";
import { callPresentationAnalysis, PresentationGeminiAnalysisSchema } from "@/lib/gemini";
import type { PresentationGeminiAnalysis } from "@/lib/gemini";
import { createServiceClient } from "@/lib/supabase";
import {
  extractPresentationEvidence,
  formatEvidenceForPrompt,
  type PresentationEvidence,
} from "@/lib/pptx-extractor";
import { PRESENTATION_BUCKET } from "./api.upload-presentation";

// ─── Request Validation ────────────────────────────────────────────────────

export const PresentationAnalyzeRequestSchema = z.object({
  /** The submission the presentation belongs to (cache + persistence key). */
  submissionId: z.string().min(1).max(200),
  /** Original file name (informational). */
  fileName: z.string().min(1).max(255),
  /** Storage object path below the bucket (from PresentationFile.storagePath). */
  storagePath: z.string().min(1).max(500),
  /** Expected SHA-256 hex hash (from PresentationFile.fileHash). */
  fileHash: z.string().min(1).max(200),
  /** When true, skip the cache and always re-run the pipeline. */
  forceRefresh: z.boolean().optional().default(false),
  // Submission fields used to upsert the FK parent row in `submissions`.
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

export type PresentationAnalyzeRequest = z.infer<typeof PresentationAnalyzeRequestSchema>;

// ─── Response Types ────────────────────────────────────────────────────────

export const EvidenceSummarySchema = z.object({
  slideCount: z.number().int().nonnegative(),
  totalChars: z.number().int().nonnegative(),
  totalImageCount: z.number().int().nonnegative(),
  totalTableCount: z.number().int().nonnegative(),
  totalHyperlinkCount: z.number().int().nonnegative(),
  technologyKeywords: z.array(z.string()),
  githubUrls: z.array(z.string()),
  demoUrls: z.array(z.string()),
  hasSpeakerNotes: z.boolean(),
  warnings: z.array(z.string()),
});

export type EvidenceSummary = z.infer<typeof EvidenceSummarySchema>;

/**
 * The subset of the analysis that is persisted (everything except the
 * transient `ok`/`cached` flags, which are re-derived on read). Stored as a
 * single `result` jsonb column on presentation_analyses.
 */
export const StoredPresentationResultSchema = z.object({
  evidence: EvidenceSummarySchema,
  analysis: PresentationGeminiAnalysisSchema,
});

export type StoredPresentationResult = z.infer<typeof StoredPresentationResultSchema>;

export type PresentationAnalysisSuccess = {
  ok: true;
  /** true when served from the presentation_analyses cache (no storage/Gemini calls) */
  cached: boolean;
  fileName: string;
  fileHash: string;
  storagePath: string;
  evidence: EvidenceSummary;
  analysis: PresentationGeminiAnalysis;
};
export type PresentationAnalysisError = { ok: false; error: string; code: string };
export type PresentationAnalysisResult = PresentationAnalysisSuccess | PresentationAnalysisError;

// ─── Storage path validation (server-side only) ────────────────────────────

/**
 * Validate a presentation storage path. Must be
 *   {safeSubmissionId}/{fileName}
 * i.e. relative to the bucket with exactly one directory level. Rejects
 * absolute paths, `..` traversal and paths with more than one segment so a
 * caller cannot reach arbitrary storage objects.
 */
function validateStoragePath(storagePath: string): boolean {
  if (!storagePath || storagePath.startsWith("/")) return false;
  const segments = storagePath.split("/");
  if (segments.length !== 2) return false;
  const [dir, file] = segments;
  if (!dir || !file) return false;
  if (dir === "." || dir === ".." || file === "." || file === "..") return false;
  if (segments.some((s) => s.includes("\\") || s.includes(".."))) return false;
  return true;
}

// ─── Cache + Persistence (server-side only) ────────────────────────────────

/**
 * Try to fetch a cached presentation analysis from Supabase.
 *
 * Returns:
 *   { hit: true, result } — valid cached analysis matching the FILE HASH
 *   { hit: false }        — no row, OR the row is stale (file_hash differs
 *                            from the uploaded presentation) → re-analyze
 *
 * The stale-row check uses the SHA-256 file hash so a participant replacing
 * their presentation never sees the old file's analysis.
 *
 * Throws on genuine database errors (caller treats as a cache miss).
 */
async function getCachedPresentationAnalysis(
  submissionId: string,
  fileHash: string,
): Promise<{ hit: true; result: StoredPresentationResult } | { hit: false }> {
  console.log("[presentation-analysis] cache lookup", {
    submissionId,
    fileHash: fileHash.slice(0, 12),
  });

  const db = createServiceClient();
  if (!db) {
    console.warn(
      "[presentation-analysis] cache lookup — Supabase not configured, treated as miss",
      {
        submissionId,
      },
    );
    return { hit: false };
  }

  const { data, error } = await db
    .from("presentation_analyses")
    .select("file_hash, result, updated_at")
    .eq("submission_id", submissionId)
    .maybeSingle();

  if (error) throw new Error(`[presentation-analysis] Supabase read error: ${error.message}`);
  if (!data) {
    console.log("[presentation-analysis] cache miss", {
      submissionId,
      fileHash: fileHash.slice(0, 12),
    });
    return { hit: false };
  }

  if (data.file_hash !== fileHash) {
    console.log("[presentation-analysis] cache miss — stale file hash", {
      submissionId,
      cachedHash: data.file_hash?.slice(0, 12),
      requestedHash: fileHash.slice(0, 12),
      updatedAt: data.updated_at,
    });
    return { hit: false };
  }

  const validated = StoredPresentationResultSchema.safeParse(data.result);
  if (!validated.success) {
    console.warn("[presentation-analysis] cache miss — stored payload failed schema validation", {
      submissionId,
      fileHash: fileHash.slice(0, 12),
      reason: validated.error.format(),
    });
    return { hit: false };
  }

  console.log("[presentation-analysis] cache hit", {
    submissionId,
    fileHash: fileHash.slice(0, 12),
    updatedAt: data.updated_at,
  });
  return { hit: true, result: validated.data };
}

/**
 * Persist a presentation analysis for a submission (upsert semantics).
 *
 * Deterministic, single-row-per-submission behavior:
 *   Step A: upsert the parent `submissions` row (FK parent + stores the
 *           presentation metadata columns).
 *   Step B: upsert `presentation_analyses` on UNIQUE(submission_id) — one row
 *           per submission; re-analysis updates that same row (never a
 *           duplicate).
 *
 * Persistence is REQUIRED. Any failure is reported via the thrown error so the
 * handler can return a clear PERSISTENCE_ERROR.
 */
async function persistPresentationAnalysis(
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
  file: { name: string; hash: string; storagePath: string },
  result: StoredPresentationResult,
): Promise<{
  submission_id: string;
  file_name: string;
  file_hash: string;
  result: StoredPresentationResult;
  created_at: string;
  updated_at: string;
}> {
  console.log("[presentation-analysis] persisting analysis", {
    submissionId: submissionData.id,
    fileName: file.name,
    fileHash: file.hash.slice(0, 12),
  });

  const db = createServiceClient();
  if (!db) {
    throw new Error(
      "[presentation-analysis] persistence failure — SUPABASE_SERVICE_ROLE_KEY / VITE_SUPABASE_URL not available in the server environment",
    );
  }

  // Step A: parent submissions row (FK target + presentation metadata).
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
    presentation_file_name: file.name,
    presentation_file_hash: file.hash,
    presentation_storage_path: file.storagePath,
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
      `[presentation-analysis] persistence failure — upserting parent submissions row failed: ${subErr.message}`,
    );
  }

  // Step B: upsert the single presentation_analyses row keyed on submission_id.
  const { data: row, error: anaErr } = await db
    .from("presentation_analyses")
    .upsert(
      {
        submission_id: submissionData.id,
        file_name: file.name,
        file_hash: file.hash,
        result,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "submission_id" },
    )
    .select("submission_id, file_name, file_hash, result, created_at, updated_at")
    .maybeSingle();

  if (anaErr) {
    throw new Error(
      `[presentation-analysis] persistence failure — upserting presentation_analyses row failed: ${anaErr.message}`,
    );
  }
  if (!row) {
    throw new Error(
      `[presentation-analysis] persistence failure — presentation_analyses upsert returned no row for submission ${submissionData.id}`,
    );
  }

  console.log("[presentation-analysis] persistence success", {
    submissionId: row.submission_id,
    fileName: row.file_name,
    fileHash: row.file_hash.slice(0, 12),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

  return row;
}

// ─── Server Function ───────────────────────────────────────────────────────

/**
 * analyzePresentation — server-side PPTX analysis endpoint with Supabase cache.
 *
 * Cache path: when a presentation_analyses row exists for the submission with
 * the SAME file hash, the stored result is returned with ZERO storage downloads
 * and ZERO Gemini calls. A changed file hash (stale cache) is a miss.
 */
export const analyzePresentation = createServerFn({ method: "POST" })
  .validator((raw: unknown): PresentationAnalyzeRequest => {
    const parsed = PresentationAnalyzeRequestSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(`Invalid request: ${parsed.error.issues.map((i) => i.message).join(", ")}`);
    }
    return parsed.data;
  })
  .handler(async ({ data }): Promise<PresentationAnalysisResult> => {
    const t0 = performance.now();
    let tCache = 0, tDownload = 0, tVerify = 0, tExtract = 0, tGemini = 0, tPersist = 0;
    const {
      submissionId,
      fileName,
      storagePath,
      fileHash: expectedHash,
      forceRefresh,
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

    // ── Step 0: Validate storage path ───────────────────────────────────
    if (!validateStoragePath(storagePath)) {
      return {
        ok: false,
        error: "Invalid presentation file path. The referenced presentation could not be resolved.",
        code: "INVALID_STORAGE_PATH",
      };
    }

    // ── Step 1: Cache hit check (skipped when forceRefresh=true) ────────
    if (!forceRefresh) {
      let cacheResult: Awaited<ReturnType<typeof getCachedPresentationAnalysis>>;
      try {
        cacheResult = await getCachedPresentationAnalysis(submissionId, expectedHash);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn("[presentation-analysis] cache lookup failed, proceeding to extract", {
          submissionId,
          reason: msg,
        });
        cacheResult = { hit: false };
      }

      if (cacheResult.hit) {
        return {
          ok: true,
          cached: true,
          fileName,
          fileHash: expectedHash,
          storagePath,
          evidence: cacheResult.result.evidence,
          analysis: cacheResult.result.analysis,
        };
      }
    } else {
      console.log("[presentation-analysis] forceRefresh=true, bypassing cache", {
        submissionId,
        fileHash: expectedHash.slice(0, 12),
      });
    }

    tCache = performance.now();
    // ── Step 2: Download the PPTX from private Storage ─────────────────
    const db = createServiceClient();
    if (!db) {
      return {
        ok: false,
        error:
          "Presentation storage is not configured on the server. The analysis could not be run.",
        code: "STORAGE_UNAVAILABLE",
      };
    }

    console.log("[presentation-analysis] downloading from storage", {
      submissionId,
      storagePath,
    });

    let fileBuffer: Buffer;
    try {
      const { data: blob, error } = await db.storage
        .from(PRESENTATION_BUCKET)
        .download(storagePath);
      if (error || !blob) {
        const msg = error?.message ?? "file not found in storage";
        const missing =
          msg.toLowerCase().includes("not found") || msg.toLowerCase().includes("does not exist");
        console.warn("[presentation-analysis] storage download failed", {
          submissionId,
          storagePath,
          reason: msg,
        });
        return {
          ok: false,
          error: missing
            ? "The uploaded presentation file could not be found in storage. It may have been removed."
            : "The presentation file could not be downloaded from storage. Please try again.",
          code: missing ? "STORAGE_FILE_MISSING" : "STORAGE_DOWNLOAD_ERROR",
        };
      }
      fileBuffer = Buffer.from(await blob.arrayBuffer());
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[presentation-analysis] storage download failed", {
        submissionId,
        storagePath,
        reason: msg,
      });
      return {
        ok: false,
        error: "The presentation file could not be downloaded from storage. Please try again.",
        code: "STORAGE_DOWNLOAD_ERROR",
      };
    }

    if (fileBuffer.length === 0) {
      return {
        ok: false,
        error: "The stored presentation file is empty. Please re-upload it.",
        code: "EMPTY_FILE",
      };
    }

    tDownload = performance.now();
    // ── Step 3: Verify SHA-256 hash matches expectation ───────────────
    const actualHash = createHash("sha256").update(fileBuffer).digest("hex");
    if (actualHash !== expectedHash) {
      console.warn("[presentation-analysis] file hash mismatch", {
        submissionId,
        storagePath,
        expectedHash: expectedHash.slice(0, 12),
        actualHash: actualHash.slice(0, 12),
      });
      return {
        ok: false,
        error:
          "The stored presentation file does not match the submission metadata. Please re-upload it.",
        code: "HASH_MISMATCH",
      };
    }

    tVerify = performance.now();
    // ── Step 4: Extract deterministic presentation evidence ────────────
    console.log("[presentation-analysis] extracting", {
      submissionId,
      fileHash: expectedHash.slice(0, 12),
      sizeBytes: fileBuffer.length,
    });

    let evidence: PresentationEvidence;
    try {
      evidence = await extractPresentationEvidence(fileBuffer);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const code = msg.startsWith("NO_SLIDES:") ? "NO_SLIDES" : "EXTRACTION_FAILED";
      console.warn("[presentation-analysis] extraction failed", {
        submissionId,
        fileHash: expectedHash.slice(0, 12),
        code,
        reason: msg.slice(0, 300),
      });
      return {
        ok: false,
        error:
          code === "NO_SLIDES"
            ? "The presentation contains no slides and cannot be analyzed."
            : "The presentation could not be parsed. It may be corrupted or not a valid .pptx file.",
        code,
      };
    }

    if (evidence.slides.length === 0) {
      return {
        ok: false,
        error: "The presentation contains no extractable slide content.",
        code: "EXTRACTION_FAILED",
      };
    }

    console.log("[presentation-analysis] extraction complete", {
      submissionId,
      fileHash: expectedHash.slice(0, 12),
      slideCount: evidence.slideCount,
      analyzedSlides: evidence.slides.length,
      totalChars: evidence.totalChars,
      techKeywords: evidence.technologyKeywords.length,
      githubUrls: evidence.githubUrls.length,
    });

    tExtract = performance.now();
    // ── Step 5: Build compact evidence + ONE Gemini call ───────────────
    const geminiResult = await callPresentationAnalysis({
      submissionContext: {
        name,
        team,
        category,
        problem,
        solution,
        stack,
      },
      formattedSlides: formatEvidenceForPrompt(evidence),
      slideCount: evidence.slideCount,
      totalChars: evidence.totalChars,
      totalImageCount: evidence.totalImageCount,
      totalTableCount: evidence.totalTableCount,
      technologyKeywords: evidence.technologyKeywords,
      githubUrls: evidence.githubUrls,
      demoUrls: evidence.demoUrls,
      allUrls: evidence.allUrls,
      hasSpeakerNotes: evidence.hasSpeakerNotes,
      warnings: evidence.warnings,
    });

    if (!geminiResult.ok) return geminiResult;
    console.log("[presentation-analysis] Gemini analysis complete", {
      submissionId,
      fileHash: expectedHash.slice(0, 12),
      slideCount: evidence.slideCount,
      summaryLength: geminiResult.analysis.summary.length,
    });

    tGemini = performance.now();
    // ── Step 6: Build stored result + persist (REQUIRED) ───────────────
    const evidenceSummary: EvidenceSummary = {
      slideCount: evidence.slideCount,
      totalChars: evidence.totalChars,
      totalImageCount: evidence.totalImageCount,
      totalTableCount: evidence.totalTableCount,
      totalHyperlinkCount: evidence.totalHyperlinkCount,
      technologyKeywords: evidence.technologyKeywords,
      githubUrls: evidence.githubUrls,
      demoUrls: evidence.demoUrls,
      hasSpeakerNotes: evidence.hasSpeakerNotes,
      warnings: evidence.warnings,
    };

    const stored: StoredPresentationResult = {
      evidence: evidenceSummary,
      analysis: geminiResult.analysis,
    };

    try {
      await persistPresentationAnalysis(
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
        { name: fileName, hash: expectedHash, storagePath },
        stored,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[presentation-analysis] persistence failure", {
        submissionId,
        fileHash: expectedHash.slice(0, 12),
        reason: msg,
      });
      return {
        ok: false,
        error:
          "The presentation analysis could not be saved for this submission. Please try again.",
        code: "PERSISTENCE_ERROR",
      };
    }

    tPersist = performance.now();
    console.log('[presentation-analysis-timing]', {
      cacheMs: Math.round(tCache - t0),
      downloadMs: Math.round(tDownload - tCache),
      verificationMs: Math.round(tVerify - tDownload),
      extractionMs: Math.round(tExtract - tVerify),
      geminiMs: Math.round(tGemini - tExtract),
      persistenceMs: Math.round(tPersist - tGemini),
      totalMs: Math.round(tPersist - t0),
    });

    return {
      ok: true,
      cached: false,
      fileName,
      fileHash: expectedHash,
      storagePath,
      evidence: evidenceSummary,
      analysis: geminiResult.analysis,
    };
  });
