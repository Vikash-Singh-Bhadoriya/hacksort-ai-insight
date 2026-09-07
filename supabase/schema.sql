-- ============================================================
-- HackSort AI - Supabase Schema
-- Branch: feat/supabase-foundation
--
-- Apply via Supabase Dashboard > SQL Editor.
-- This file is reference/documentation only; it is NOT run
-- automatically by the application.
-- ============================================================

-- 1. submissions
--
-- Mirrors the TypeScript Submission type in src/lib/data.ts.
-- id is TEXT (not UUID) to match client-generated IDs like
-- "s1", "s2", "u<timestamp>".
--
CREATE TABLE IF NOT EXISTS submissions (
  id            text        PRIMARY KEY,
  name          text        NOT NULL,
  team          text        NOT NULL,
  members       text[]      NOT NULL DEFAULT '{}',
  category      text        NOT NULL,
  problem       text        NOT NULL,
  solution      text        NOT NULL,
  stack         text[]      NOT NULL DEFAULT '{}',
  deck_url      text        NOT NULL DEFAULT '',
  github_url    text        NOT NULL DEFAULT '',
  scores        jsonb       NOT NULL DEFAULT '{}',
  reasoning     text        NOT NULL DEFAULT '',
  strengths     text[]      NOT NULL DEFAULT '{}',
  risks         text[]      NOT NULL DEFAULT '{}',
  cluster       text        NOT NULL DEFAULT '',
  status        text        NOT NULL DEFAULT 'Submitted',
  submitted_at  timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Ia. Back-fill for databases created before github_url existed.
--
-- The `submissions` table is often ALREADY present (from an earlier schema),
-- so `CREATE TABLE IF NOT EXISTS submissions` above is a no-op and will NOT
-- add a new column. These ALTERs are idempotent and MUST be (re)applied
-- whenever this file is run against an existing database, otherwise
-- `api.analyze-github.ts` / `api.upload-presentation.ts` persistence fails.
ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS github_url text NOT NULL DEFAULT '';

-- Ib. Presentation upload columns (PPTX analysis feature).
-- Idempotent back-fills for the same reason as github_url above:
-- `CREATE TABLE IF NOT EXISTS` does NOT add columns to an existing table.
ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS presentation_file_name text NOT NULL DEFAULT '';
ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS presentation_file_hash text NOT NULL DEFAULT '';
ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS presentation_storage_path text NOT NULL DEFAULT '';

-- 2. judging_criteria
--
-- Stores the 5 evaluation dimensions used by HackSort AI.
-- The current app hardcodes these in TypeScript (src/lib/scoring.ts).
-- This table is reference/seed data.
-- Judge weights are a separate concern (currently localStorage).
--
CREATE TABLE IF NOT EXISTS judging_criteria (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  description text        NOT NULL DEFAULT '',
  weight      integer     NOT NULL DEFAULT 0
                CHECK (weight >= 0 AND weight <= 100),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 3. gemini_analyses
--
-- Mirrors GeminiAnalysis / GeminiAnalysisSchema in src/lib/gemini.ts.
--
-- strengths / risks : text[]  (always simple string lists)
-- scores            : jsonb   (structured object: innovation, impact,
--                              technical, feasibility, presentation)
--
-- UNIQUE(submission_id) enforces one analysis per submission (MVP).
-- Drop this constraint later if analysis history is needed.
--
CREATE TABLE IF NOT EXISTS gemini_analyses (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id text        NOT NULL
                REFERENCES submissions(id) ON DELETE CASCADE,
  summary       text        NOT NULL,
  reasoning     text        NOT NULL,
  strengths     text[]      NOT NULL DEFAULT '{}',
  risks         text[]      NOT NULL DEFAULT '{}',
  scores        jsonb       NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),

  UNIQUE (submission_id)   -- one analysis per submission (MVP)
);

-- Index for the most common query pattern
CREATE INDEX IF NOT EXISTS gemini_analyses_submission_id_idx
  ON gemini_analyses (submission_id);

-- 4. github_analyses
--
-- Persists the GitHub repository analysis POC result per submission.
-- Mirrors the GitHubAnalysisSuccess response from api.analyze-github.ts.
--
-- UNIQUE(submission_id) => one analysis per submission. Re-analysis upserts
-- (see api.analyze-github.ts), never inserting a second row.
-- repository_url stores the CANONICAL GitHub URL (https://github.com/owner/repo)
-- so URL changes on the submission invalidate a stale cached analysis.
--
CREATE TABLE IF NOT EXISTS github_analyses (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id   text        NOT NULL
                  REFERENCES submissions(id) ON DELETE CASCADE,
  repository_url  text        NOT NULL,
  repository      text        NOT NULL,
  result          jsonb       NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (submission_id)   -- one analysis per submission (MVP)
);

-- Index for the most common query pattern
CREATE INDEX IF NOT EXISTS github_analyses_submission_id_idx
  ON github_analyses (submission_id);

-- 5. presentation_analyses
--
-- Persists the PPTX presentation analysis POC result per submission.
-- Mirrors the PresentationAnalysisSuccess response from api.analyze-presentation.ts
-- (stored as a single `result` jsonb column: { evidence, analysis }).
--
-- UNIQUE(submission_id) => one analysis per submission. Re-analysis upserts
-- (see api.analyze-presentation.ts), never inserting a second row.
-- file_hash stores the SHA-256 of the analyzed PPTX so a participant
-- replacing their presentation invalidates a stale cached analysis.
--
CREATE TABLE IF NOT EXISTS presentation_analyses (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id text        NOT NULL
                REFERENCES submissions(id) ON DELETE CASCADE,
  file_name     text        NOT NULL,
  file_hash     text        NOT NULL,
  result        jsonb       NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  UNIQUE (submission_id)   -- one analysis per submission (MVP)
);

-- Index for the most common query pattern
CREATE INDEX IF NOT EXISTS presentation_analyses_submission_id_idx
  ON presentation_analyses (submission_id);

-- ── Row Level Security ──────────────────────────────────────────────────────
--
-- RLS is auto-enabled by the Supabase project settings.
-- The app uses demo auth (hardcoded credentials, no Supabase Auth),
-- so policies cannot reference auth.uid().
--
-- MVP approach:
--   anon role  -> SELECT only  (read for browser / unauthenticated)
--   service_role -> bypasses RLS (used server-side for all writes)
--
-- Production: replace with user-scoped policies once Supabase Auth lands.
--
-- Policies use DROP POLICY IF EXISTS first so the script can be re-run safely.
--
ALTER TABLE submissions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE judging_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE gemini_analyses  ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_analyses  ENABLE ROW LEVEL SECURITY;
ALTER TABLE presentation_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "submissions_anon_select" ON submissions;
DROP POLICY IF EXISTS "criteria_anon_select" ON judging_criteria;
DROP POLICY IF EXISTS "analyses_anon_select" ON gemini_analyses;
DROP POLICY IF EXISTS "github_analyses_anon_select" ON github_analyses;
DROP POLICY IF EXISTS "presentation_analyses_anon_select" ON presentation_analyses;

CREATE POLICY "submissions_anon_select"
  ON submissions FOR SELECT TO anon USING (true);

CREATE POLICY "criteria_anon_select"
  ON judging_criteria FOR SELECT TO anon USING (true);

CREATE POLICY "analyses_anon_select"
  ON gemini_analyses FOR SELECT TO anon USING (true);

CREATE POLICY "github_analyses_anon_select"
  ON github_analyses FOR SELECT TO anon USING (true);

CREATE POLICY "presentation_analyses_anon_select"
  ON presentation_analyses FOR SELECT TO anon USING (true);
