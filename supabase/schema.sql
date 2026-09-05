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
  scores        jsonb       NOT NULL DEFAULT '{}',
  reasoning     text        NOT NULL DEFAULT '',
  strengths     text[]      NOT NULL DEFAULT '{}',
  risks         text[]      NOT NULL DEFAULT '{}',
  cluster       text        NOT NULL DEFAULT '',
  status        text        NOT NULL DEFAULT 'Submitted',
  submitted_at  timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

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
ALTER TABLE submissions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE judging_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE gemini_analyses  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "submissions_anon_select"
  ON submissions FOR SELECT TO anon USING (true);

CREATE POLICY "criteria_anon_select"
  ON judging_criteria FOR SELECT TO anon USING (true);

CREATE POLICY "analyses_anon_select"
  ON gemini_analyses FOR SELECT TO anon USING (true);
