import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Github, Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AiNote, HumanLoopNote } from "@/components/ScoreBits";
import { analyzeGithubRepository } from "@/routes/api.analyze-github";
import type { GitHubAnalysisSuccess } from "@/routes/api.analyze-github";
import type { Submission } from "@/lib/data";

const MAX_ROOT_FILES_SHOWN = 8;

/**
 * GitHub Repository Analysis.
 *
 * Driven by the participant-provided submission.githubUrl — the judge never
 * pastes a URL. The server function (api.analyze-github.ts) handles the cache:
 * an existing github_analyses row for this submission + URL is returned with
 * zero GitHub/Gemini calls; otherwise a fresh fetch + single Gemini analysis
 * runs and is persisted before being displayed.
 */
export function GithubAnalysis({ submission }: { submission: Submission }) {
  const githubUrl = submission.githubUrl?.trim() ?? "";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GitHubAnalysisSuccess | null>(null);
  const startedRef = useRef(false);

  async function runAnalysis(forceRefresh = false) {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await analyzeGithubRepository({
        data: {
          url: githubUrl,
          claimedStack: submission.stack,
          submissionId: submission.id,
          forceRefresh,
          // Full submission fields for the FK parent row upsert in Supabase
          name: submission.name,
          team: submission.team,
          members: submission.members,
          category: submission.category,
          problem: submission.problem,
          solution: submission.solution,
          stack: submission.stack,
          deckUrl: submission.deckUrl,
          scores: submission.scores,
          reasoning: submission.reasoning,
          strengths: submission.strengths,
          risks: submission.risks,
          cluster: submission.cluster,
          status: submission.status,
          submittedAt: submission.submittedAt,
        },
      });
      if (res.ok) {
        setResult(res);
        if (!forceRefresh) {
          toast.success(
            res.cached
              ? "Loaded from cached GitHub analysis"
              : "GitHub repository analysis complete",
          );
        } else {
          toast.success("GitHub repository analysis complete");
        }
      } else {
        setError(res.error);
        toast.error(res.error);
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "An unexpected error occurred. Please try again.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  // When navigating between submissions, clear the previous submission's state.
  useEffect(() => {
    setResult(null);
    setError(null);
    startedRef.current = false;
  }, [githubUrl]);

  // Auto-analyze once per submission when it has a GitHub URL.
  useEffect(() => {
    if (!githubUrl || startedRef.current) return;
    startedRef.current = true;
    void runAnalysis(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [githubUrl]);

  return (
    <section className="glass rounded-2xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">GitHub Repository Analysis</h2>
        <div className="flex items-center gap-2">
          {githubUrl && (result || error || loading) ? (
            <Badge variant="outline" className="border-border/70 text-muted-foreground">
              Source: Participant-provided
            </Badge>
          ) : null}
          <Badge variant="outline" className="border-border/70 text-muted-foreground">
            POC
          </Badge>
        </div>
      </div>

      {!githubUrl ? (
        <p className="mt-2 text-sm text-muted-foreground">
          No GitHub repository was provided by this participant.
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            Inspecting the participant's public repository to cross-check the claimed tech stack.
            Public repositories only — a single Gemini analysis is run and cached.
          </p>

          {githubUrl && (
            <div className="mt-3 flex items-center justify-between gap-3">
              <Button asChild variant="ghost" size="sm" className="gap-1.5 px-0">
                <a href={githubUrl} target="_blank" rel="noreferrer">
                  <Github className="h-4 w-4 text-primary" />
                  {githubUrl.replace(/^https?:\/\/(www\.)?/, "")}
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                </a>
              </Button>
              {result && !loading && (
                <Button variant="secondary" size="sm" onClick={() => void runAnalysis(true)}>
                  Re-analyze GitHub Repository
                </Button>
              )}
            </div>
          )}

          {/* ── Loading state ── */}
          {loading && (
            <div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Analyzing GitHub repository…
            </div>
          )}

          {/* ── Error state + retry ── */}
          {error && !loading && !result && (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-destructive/30 bg-destructive/8 p-4 text-sm"
            >
              <p className="font-medium text-destructive">GitHub analysis unavailable</p>
              <p className="mt-1 text-foreground/75">{error}</p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-3"
                onClick={() => void runAnalysis(false)}
              >
                Retry GitHub analysis
              </Button>
            </div>
          )}

          {/* ── Result ── */}
          {result && !loading && <GithubResultView result={result} />}
        </>
      )}

      <HumanLoopNote className="mt-6" />
    </section>
  );
}

function GithubResultView({ result }: { result: GitHubAnalysisSuccess }) {
  const { analysis } = result;
  const rootFilesMore =
    result.rootFiles.length - Math.min(result.rootFiles.length, MAX_ROOT_FILES_SHOWN);

  return (
    <div className="mt-6 space-y-5">
      <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-primary">
        <Sparkles className="h-3.5 w-3.5" />
        {result.cached ? "Cached analysis — no new GitHub or Gemini calls" : "Repository evidence"}
      </p>

      {/* ── Repository + metadata ── */}
      <div className="rounded-xl border border-border/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium">
              <Github className="h-4 w-4 text-primary" />
              {result.repository}
            </p>
            {result.description ? (
              <p className="mt-1 text-xs text-muted-foreground">{result.description}</p>
            ) : null}
          </div>
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
            <a href={result.repositoryUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
              Open on GitHub
            </a>
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
          {result.primaryLanguage ? (
            <StatPill label="Primary language" value={result.primaryLanguage} />
          ) : null}
          <StatPill label="Stars" value={String(result.stars)} />
          <StatPill label="Forks" value={String(result.forks)} />
          <StatPill label="Default branch" value={result.defaultBranch} />
          {result.license ? <StatPill label="License" value={result.license} /> : null}
        </div>
      </div>

      {/* ── Detected technologies ── */}
      {analysis.technologiesObserved.length > 0 && (
        <div>
          <p className="text-sm font-medium">Detected technologies</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {analysis.technologiesObserved.map((t) => (
              <span
                key={t}
                className="rounded-full border border-primary/25 bg-primary/8 px-2.5 py-0.5 text-xs text-primary"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Evidence bullets ── */}
      <div className="space-y-1.5 text-sm">
        <p className="text-sm font-medium">Repository evidence</p>
        <ul className="list-inside space-y-1 text-muted-foreground">
          {result.readmeAvailable ? (
            <li className="text-success">• README detected — included in the analysis</li>
          ) : (
            <li className="text-warning">
              • README unavailable — analysis based on repository metadata and structure.
            </li>
          )}
          {result.manifestFiles.map((m) => (
            <li key={m}>• {m} detected</li>
          ))}
          {result.detectedStructure
            .filter((s) => !result.manifestFiles.includes(s))
            .map((s) => (
              <li key={s}>• {s}/ directory detected</li>
            ))}
          <li className="text-muted-foreground/70">
            • Root contains {result.rootFiles.length} entries
            {result.rootFiles.length > 0
              ? `: ${result.rootFiles.slice(0, MAX_ROOT_FILES_SHOWN).join(", ")}`
              : ""}
            {rootFilesMore > 0 ? ` (+${rootFilesMore} more)` : ""}
          </li>
        </ul>
      </div>

      {/* ── Technical assessment ── */}
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">
          Technical assessment
        </p>
        <div className="mt-3 space-y-4">
          <AiNote>
            <p className="mb-2 font-medium">{analysis.summary}</p>
            <p className="text-foreground/90">{analysis.implementationEvidence}</p>
          </AiNote>

          <div className="rounded-xl border border-border/60 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Architecture
            </p>
            <p className="mt-2 text-sm text-foreground/85">
              <span className="mr-1 rounded bg-warning/15 px-1.5 py-0.5 text-[11px] font-medium text-warning">
                inferred
              </span>
              {analysis.architectureInferred}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-success">Strengths</p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {analysis.strengths.map((x) => (
                  <li key={x}>• {x}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-sm font-medium text-warning">Risks &amp; things to verify</p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {analysis.risks.map((x) => (
                  <li key={x}>• {x}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">
              Judge verification
            </p>
            <ul className="mt-2 space-y-1 text-sm text-foreground/85">
              {analysis.judgeVerification.map((x) => (
                <li key={x}>• {x}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-secondary/40 px-2 py-0.5">
      <span className="text-muted-foreground/70">{label}:</span>
      <span className="font-medium text-foreground/90">{value}</span>
    </span>
  );
}
