/**
 * src/routes/api.upload-presentation.ts
 *
 * TanStack Start server function for participant PPTX uploads.
 *
 * Flow:
 *   1. Participant selects a .pptx in the submission form
 *   2. The browser sends the file (base64) + submission fields to this server fn
 *   3. Server validates extension, size, and ZIP magic bytes
 *   4. SHA-256 hash is computed server-side (never trusted from the client)
 *   5. File is uploaded to the PRIVATE `presentation-files` Supabase Storage bucket
 *   6. The parent `submissions` row is upserted with presentation metadata
 *   7. Metadata is returned to the browser and stored on the Submission object
 *
 * NO Gemini call here — participant submission must stay fast. Analysis is
 * deferred until a judge opens the submission (see api.analyze-presentation.ts).
 *
 * This file runs server-side only. SUPABASE_SERVICE_ROLE_KEY is never exposed
 * to the browser.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash } from "node:crypto";
import { createServiceClient } from "@/lib/supabase";

// ─── Constants ─────────────────────────────────────────────────────────────

export const PRESENTATION_BUCKET = "presentation-files";
export const MAX_PRESENTATION_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
export const ALLOWED_EXTENSIONS = [".pptx"] as const;

// ─── Request Validation ────────────────────────────────────────────────────

export const UploadPresentationRequestSchema = z.object({
  submissionId: z.string().min(1).max(200),
  /** Original uploaded file name (e.g. "pitch.pptx"). Extension is validated. */
  fileName: z.string().min(1).max(255),
  /** File content as base64 (no data: prefix). */
  fileBase64: z.string().min(1).max(32_000_000), // generous headroom; true size enforced after decode
  // Submission fields used to upsert the FK parent row in `submissions` so the
  // presentation metadata + later analysis FK are satisfiable (same pattern as
  // api.analyze-github.ts).
  name: z.string().default(""),
  team: z.string().default(""),
  members: z.array(z.string()).default([]),
  category: z.string().default(""),
  problem: z.string().default(""),
  solution: z.string().default(""),
  stack: z.array(z.string()).default([]),
  deckUrl: z.string().default(""),
  githubUrl: z.string().default(""),
  scores: z.record(z.string(), z.number()).default({}),
  reasoning: z.string().default(""),
  strengths: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  cluster: z.string().default(""),
  status: z.string().default("Submitted"),
  submittedAt: z.string().default(""),
});

export type UploadPresentationRequest = z.infer<typeof UploadPresentationRequestSchema>;

// ─── Response Types ────────────────────────────────────────────────────────

export type UploadPresentationSuccess = {
  ok: true;
  fileName: string;
  storagePath: string;
  fileHash: string;
  uploadedAt: string;
};
export type UploadPresentationError = { ok: false; error: string; code: string };
export type UploadPresentationResult = UploadPresentationSuccess | UploadPresentationError;

// ─── Validation helpers (server-side only) ─────────────────────────────────

function hasAllowedExtension(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * PPTX files are ZIP archives; the first two bytes are "PK" (0x50 0x4B).
 * This cheap check rejects non-ZIP uploads before any parsing.
 */
function isLikelyZip(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
}

/**
 * Sanitize a file name for safe use as a storage object name below the
 * submission path. Strips path separators and control characters so a
 * malicious name cannot perform path traversal.
 */
function sanitizeStorageName(fileName: string): string {
  const strippedSlash = fileName.replace(/[\\/]/g, "");
  const base = [...strippedSlash]
    .filter((ch) => ch.charCodeAt(0) > 0x1f && ch.charCodeAt(0) !== 0x7f)
    .join("");
  return base || "presentation.pptx";
}

/**
 * Absolute storage object name for a presentation file:
 *   presentation-files/{submissionId}/{fileName}
 * The submissionId is validated/normalized so it cannot contain path segments.
 */
function buildStoragePath(submissionId: string, safeFileName: string): string {
  const safeId = submissionId.replace(/[^a-zA-Z0-9_-]/g, "");
  return `${safeId}/${safeFileName}`;
}

// ─── Server Function ───────────────────────────────────────────────────────

/**
 * uploadPresentation — server-side file upload for participant PPTX files.
 *
 * Returns metadata (fileName, storagePath, fileHash, uploadedAt) that the
 * browser attaches to the Submission object as `presentationFile`.
 */
export const uploadPresentation = createServerFn({ method: "POST" })
  .validator((raw: unknown): UploadPresentationRequest => {
    const parsed = UploadPresentationRequestSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(`Invalid request: ${parsed.error.issues.map((i) => i.message).join(", ")}`);
    }
    return parsed.data;
  })
  .handler(async ({ data }): Promise<UploadPresentationResult> => {
    const { submissionId, fileName, fileBase64 } = data;

    // ── Step 1: Validate extension ──────────────────────────────────────
    if (!hasAllowedExtension(fileName)) {
      return {
        ok: false,
        error:
          "Unsupported file type. Only .pptx files are accepted. Legacy .ppt files are not supported in this version.",
        code: "INVALID_EXTENSION",
      };
    }

    // ── Step 2: Decode base64 → Buffer ──────────────────────────────────
    let buffer: Buffer;
    try {
      buffer = Buffer.from(fileBase64, "base64");
    } catch {
      return {
        ok: false,
        error: "The uploaded file could not be read. Please try again.",
        code: "INVALID_FILE_DATA",
      };
    }

    // ── Step 3: Validate size ───────────────────────────────────────────
    if (buffer.length === 0) {
      return {
        ok: false,
        error: "The uploaded file is empty.",
        code: "EMPTY_FILE",
      };
    }
    if (buffer.length > MAX_PRESENTATION_SIZE_BYTES) {
      return {
        ok: false,
        error: `File is larger than the 20 MB limit (got ${(buffer.length / (1024 * 1024)).toFixed(1)} MB).`,
        code: "FILE_TOO_LARGE",
      };
    }

    // ── Step 4: Validate ZIP magic bytes ────────────────────────────────
    if (!isLikelyZip(buffer)) {
      return {
        ok: false,
        error:
          "The file does not look like a valid .pptx (PowerPoint) file. PPTX files are ZIP-based archives.",
        code: "INVALID_PPTX",
      };
    }

    // ── Step 5: Compute SHA-256 hash (server-side, not trusted from client) ──
    const fileHash = createHash("sha256").update(buffer).digest("hex");

    // ── Step 6: Upload to private Supabase Storage ──────────────────────
    const db = createServiceClient();
    if (!db) {
      console.warn(
        "[presentation-upload] Supabase not configured in the server environment — upload aborted",
        { submissionId },
      );
      return {
        ok: false,
        error:
          "Presentation upload is temporarily unavailable. Please try again later, or remove the file and submit without it.",
        code: "STORAGE_UNAVAILABLE",
      };
    }

    const safeName = sanitizeStorageName(fileName);
    const storagePath = buildStoragePath(submissionId, safeName);
    const uploadedAt = new Date().toISOString();

    console.log("[presentation-upload] starting storage upload", {
      submissionId,
      fileName: safeName,
      sizeBytes: buffer.length,
      fileHash: fileHash.slice(0, 12),
    });

    let uploadError: { message: string } | null = null;
    try {
      const { error } = await db.storage.from(PRESENTATION_BUCKET).upload(storagePath, buffer, {
        contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        upsert: true,
      });
      uploadError = error;
    } catch (err) {
      uploadError = { message: err instanceof Error ? err.message : String(err) };
    }

    if (uploadError) {
      const msg = uploadError.message;
      const missingBucket =
        msg.toLowerCase().includes("does not exist") ||
        msg.toLowerCase().includes("bucket") ||
        msg.toLowerCase().includes("not found");
      console.error("[presentation-upload] storage upload failed", {
        submissionId,
        fileName: safeName,
        reason: msg,
      });
      return {
        ok: false,
        error: missingBucket
          ? "Presentation storage is not configured. Ask the organizer to create the `presentation-files` storage bucket."
          : "The presentation file could not be stored. Please try again.",
        code: missingBucket ? "STORAGE_BUCKET_MISSING" : "STORAGE_UPLOAD_ERROR",
      };
    }

    // ── Step 7: Upsert parent submission row with presentation metadata ─
    const parent = {
      id: submissionId,
      name: data.name,
      team: data.team,
      members: data.members,
      category: data.category,
      problem: data.problem,
      solution: data.solution,
      stack: data.stack,
      deck_url: data.deckUrl,
      github_url: data.githubUrl || "",
      presentation_file_name: safeName,
      presentation_file_hash: fileHash,
      presentation_storage_path: storagePath,
      scores: data.scores,
      reasoning: data.reasoning,
      strengths: data.strengths,
      risks: data.risks,
      cluster: data.cluster,
      status: data.status,
      submitted_at: data.submittedAt || new Date().toISOString(),
    };

    const { error: subErr } = await db.from("submissions").upsert(parent, { onConflict: "id" });
    if (subErr) {
      console.error("[presentation-upload] persistence failure — parent submissions upsert", {
        submissionId,
        reason: subErr.message,
      });
      return {
        ok: false,
        error: "The presentation was stored but its metadata could not be saved. Please try again.",
        code: "PERSISTENCE_ERROR",
      };
    }

    console.log("[presentation-upload] upload + metadata persisted", {
      submissionId,
      fileName: safeName,
      storagePath,
      fileHash: fileHash.slice(0, 12),
    });

    return { ok: true, fileName: safeName, storagePath, fileHash, uploadedAt };
  });
