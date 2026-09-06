import { useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Github, Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AiNote, HumanLoopNote } from "@/components/ScoreBits";
import { analyzeGithubRepository } from "@/routes/api.analyze-github";
import type { GitHubAnalysisSuccess } from "@/routes/api.analyze-github";

const MAX_ROOT_FILES_SHOWN = 8;

function isPlausibleGithubUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed.startsWith("https://") && !trimmed.startsWith("http://")) return false;
  try {
    const host = new URL(trimmed).hostname.toLowerCase();
    return host === "github.com" || host === "www.github.com";
  } catch {
    return false;
  }
}

/**
 * GitHub Repository Analysis POC — a judge can paste a public repository URL
 * and get an AI technical cross-check of the participant's claimed stack.
 *
 * The actual fetching + ONE Gemini call happen server-side in
 * api.analyze-github.ts. This component only collects the URL, calls the
 * server function, and renders the evidence + assessment.
 */
export function GithubAnalysis({ claimedStack }: { claimedStack: string[] }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GitHubAnalysisSuccess | null>(null);

  async function runAnalysis() {
    const trimmed = url.trim();
    if (!isPlausibleGithubUrl(trimmed)) {
      setError("Invalid GitHub repository URL.");
      toast.error("Invalid GitHub repository URL.");
      return;
    }
    if (loading) return;

    setLoading(true);
    setError(null);
    try {
      const res = await analyzeGithubRepository({
        data: { url: trimmed, claimedStack },
      });
      if (res.ok) {
        setResult(res);
        toast.success("GitHub repository analysis complete");
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

  return (
    <section className="glass rounded-2xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">GitHub Repository Analysis</h2>
        <Badge variant="outline" className="border-border/70 text-muted-foreground">
          POC
        </Badge>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Pasted a public GitHub repository to inspect actual repository evidence and cross-check the
        claimed tech stack. Public repositories only.
      </p>

      {/* ── URL input + analyze ── */}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <div className="flex-1">
          <Input
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") void runAnalysis();
            }}
            placeholder="https://github.com/owner/repository"
            aria-label="GitHub repository URL"
            disabled={loading}
          />
        </div>
        <Button
          onClick={() => void runAnalysis()}
          disabled={loading || url.trim() === ""}
          className="gap-2"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Github className="h-4 w-4" />}
          {loading
            ? "Fetching repository & analyzing…"
            : result
              ? "Re-analyze GitHub Repository"
              : "Analyze GitHub Repository"}
        </Button>
      </div>

      {/* ── Loading hint ── */}
      {loading && (
        <div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Fetching GitHub metadata, README and repository structure, then running a single Gemini
          analysis…
        </div>
      )}

      {/* ── Error state ── */}
      {error && !loading && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-destructive/30 bg-destructive/8 p-4 text-sm"
        >
          <p className="font-medium text-destructive">GitHub analysis unavailable</p>
          <p className="mt-1 text-foreground/75">{error}</p>
        </div>
      )}

      {/* ── Result ── */}
      {result && !loading && <GithubResultView result={result} />}

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
        Repository evidence
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
