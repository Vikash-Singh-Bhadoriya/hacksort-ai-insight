import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, FileText, Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AiNote, HumanLoopNote, ScoreBar } from "@/components/ScoreBits";
import { analyzePresentation } from "@/routes/api.analyze-presentation";
import type { PresentationAnalysisSuccess } from "@/routes/api.analyze-presentation";
import type { Submission } from "@/lib/data";

const STATUS_TONE: Record<string, string> = {
  "SUPPORTED BY PRESENTATION": "text-success",
  "CLAIM REQUIRES VERIFICATION": "text-warning",
  "NOT FOUND IN PRESENTATION": "text-muted-foreground",
};

/**
 * Presentation Analysis.
 *
 * Driven by the participant-uploaded submission.presentationFile — the judge
 * never uploads a file. The server function (api.analyze-presentation.ts)
 * handles the cache: an existing presentation_analyses row for this submission
 * + file hash is returned with zero storage/Gemini calls; otherwise one fresh
 * extraction + single Gemini analysis runs and is persisted before display.
 */
export function PresentationAnalysis({ submission }: { submission: Submission }) {
  const file = submission.presentationFile;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PresentationAnalysisSuccess | null>(null);
  const startedRef = useRef(false);

  async function runAnalysis(forceRefresh = false) {
    if (loading || !file) return;
    setLoading(true);
    setError(null);
    try {
      const res = await analyzePresentation({
        data: {
          submissionId: submission.id,
          fileName: file.fileName,
          storagePath: file.storagePath,
          fileHash: file.fileHash,
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
        toast.success(
          res.cached
            ? "Loaded from cached presentation analysis"
            : "Presentation analysis complete",
        );
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
  }, [file?.storagePath]);

  // Auto-analyze once per submission when it has a presentation file.
  useEffect(() => {
    if (!file || startedRef.current) return;
    startedRef.current = true;
    void runAnalysis(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file?.storagePath]);

  return (
    <section className="glass rounded-2xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Presentation Analysis</h2>
        <div className="flex items-center gap-2">
          {file && (result || error || loading) ? (
            <Badge variant="outline" className="border-border/70 text-muted-foreground">
              Source: Participant-provided
            </Badge>
          ) : null}
        </div>
      </div>

      {!file ? (
        <p className="mt-2 text-sm text-muted-foreground">
          No presentation was provided by this participant.
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            Extracting evidence from the participant's uploaded presentation. Slide text and
            structure are analyzed; visual design is not evaluated.
          </p>

          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate">{file.fileName}</span>
            </div>
            {result && !loading && (
              <Button variant="secondary" size="sm" onClick={() => void runAnalysis(true)}>
                Re-analyze Presentation
              </Button>
            )}
          </div>

          {/* ── Loading state ── */}
          {loading && (
            <div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Analyzing presentation…
            </div>
          )}

          {/* ── Uploaded but not analyzed / empty state ── */}
          {!result && !loading && !error && (
            <p className="mt-4 text-sm text-muted-foreground">
              Presentation analysis has not been generated yet.
            </p>
          )}

          {/* ── Error state + retry ── */}
          {error && !loading && !result && (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-destructive/30 bg-destructive/8 p-4 text-sm"
            >
              <p className="font-medium text-destructive">Presentation analysis unavailable</p>
              <p className="mt-1 text-foreground/75">{error}</p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-3"
                onClick={() => void runAnalysis(false)}
              >
                Retry presentation analysis
              </Button>
            </div>
          )}

          {/* ── Result ── */}
          {result && !loading && <PresentationResultView result={result} />}
        </>
      )}

      <div className="mt-6 space-y-2">
        <p className="text-[11px] leading-relaxed text-muted-foreground/70">
          Analysis is based on extracted slide text and presentation structure. Visual design,
          images and diagrams are not evaluated in this version.
        </p>
        <HumanLoopNote />
      </div>
    </section>
  );
}

function PresentationResultView({ result }: { result: PresentationAnalysisSuccess }) {
  const { analysis, evidence } = result;

  return (
    <div className="mt-6 space-y-5">
      <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-primary">
        <Sparkles className="h-3.5 w-3.5" />
        {result.cached ? "Cached Presentation Analysis" : "Live Presentation Analysis"}
      </p>

      {/* ── Evidence ── */}
      <div className="rounded-xl border border-border/60 p-4">
        <p className="text-sm font-medium">Presentation evidence</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-secondary/40 px-2 py-0.5">
              <span className="font-medium text-foreground/90">{evidence.slideCount}</span> slides
              analyzed
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-secondary/40 px-2 py-0.5">
              <span className="font-medium text-foreground/90">
                {evidence.technologyKeywords.length}
              </span>{" "}
              technology references
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-secondary/40 px-2 py-0.5">
              <span className="font-medium text-foreground/90">{evidence.githubUrls.length}</span>{" "}
              GitHub links
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-secondary/40 px-2 py-0.5">
              <span className="font-medium text-foreground/90">{evidence.demoUrls.length}</span>{" "}
              demo links
            </span>
          </div>
          <ul className="list-inside space-y-1 text-xs text-muted-foreground">
            <li>• {evidence.totalChars.toLocaleString()} characters of text extracted</li>
            <li>
              • {evidence.totalImageCount} image placeholder
              {evidence.totalImageCount === 1 ? "" : "s"} detected
            </li>
            <li>
              • {evidence.totalTableCount} table{evidence.totalTableCount === 1 ? "" : "s"} detected
            </li>
            <li>
              • {evidence.totalHyperlinkCount} hyperlink
              {evidence.totalHyperlinkCount === 1 ? "" : "s"} found
            </li>
            <li>• Speaker notes: {evidence.hasSpeakerNotes ? "present" : "not detected"}</li>
          </ul>
        </div>
        {evidence.warnings.length > 0 ? (
          <ul className="mt-3 list-inside space-y-1 text-xs text-muted-foreground/70">
            {evidence.warnings.slice(0, 3).map((w) => (
              <li key={w}>• {w}</li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* ── Detected technologies ── */}
      {analysis.detectedTechnologies.length > 0 && (
        <div>
          <p className="text-sm font-medium">Detected technologies</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {analysis.detectedTechnologies.map((t) => (
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

      {/* ── URLs found in slides ── */}
      {(analysis.githubUrls.length > 0 || analysis.demoUrls.length > 0) && (
        <div className="space-y-1.5 text-sm">
          <p className="text-sm font-medium">Links found in slides</p>
          {analysis.githubUrls.map((u) => (
            <p key={u} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ExternalLink className="h-3 w-3" />
              <a
                href={u}
                target="_blank"
                rel="noreferrer"
                className="truncate hover:text-foreground"
              >
                {u}
              </a>
            </p>
          ))}
          {analysis.demoUrls.map((u) => (
            <p key={u} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ExternalLink className="h-3 w-3" />
              <a
                href={u}
                target="_blank"
                rel="noreferrer"
                className="truncate hover:text-foreground"
              >
                {u}
              </a>
            </p>
          ))}
        </div>
      )}

      {/* ── AI assessment ── */}
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">
          Technical assessment
        </p>
        <div className="mt-3 space-y-4">
          <AiNote>
            <p className="mb-2 font-medium">{analysis.summary}</p>
            <p className="text-foreground/90">{analysis.reasoning}</p>
          </AiNote>

          {/* ── Dimension scores ── */}
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Presentation dimension scores</p>
            <ScoreBar label="Problem clarity" value={analysis.problemClarity.score} />
            <ScoreBar label="Solution clarity" value={analysis.solutionClarity.score} />
            <ScoreBar label="Technical depth" value={analysis.technicalDepth.score} />
            <ScoreBar
              label="Implementation evidence"
              value={analysis.implementationEvidence.score}
            />
            <ScoreBar label="Impact" value={analysis.impact.score} />
            <ScoreBar label="Presentation structure" value={analysis.presentationStructure.score} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-success">Strengths</p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {analysis.strengths.length ? (
                  analysis.strengths.map((x) => <li key={x}>• {x}</li>)
                ) : (
                  <li>• No notable strengths detected in the slides.</li>
                )}
              </ul>
            </div>
            <div>
              <p className="text-sm font-medium text-warning">Risks &amp; things to verify</p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {analysis.risks.length ? (
                  analysis.risks.map((x) => <li key={x}>• {x}</li>)
                ) : (
                  <li>• No notable risks detected in the slides.</li>
                )}
              </ul>
            </div>
          </div>

          {/* ── Claims to verify ── */}
          {analysis.claimsToVerify.length > 0 && (
            <div className="rounded-xl border border-border/60 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Claims to verify
              </p>
              <ul className="mt-2 space-y-2 text-sm">
                {analysis.claimsToVerify.map((c) => (
                  <li key={c.claim} className="flex flex-wrap items-start gap-2">
                    <span className="text-muted-foreground">• {c.claim}</span>
                    {c.source ? (
                      <span className="rounded bg-secondary/50 px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        {c.source}
                      </span>
                    ) : null}
                    <span
                      className={`text-[11px] font-medium ${STATUS_TONE[c.status] ?? "text-muted-foreground"}`}
                    >
                      {c.status.replaceAll("_", " ")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Judge verification ── */}
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
