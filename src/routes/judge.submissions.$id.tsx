import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Flag,
  GitCompare,
  Loader2,
  Save,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { AiNote, GemBadge, HumanLoopNote, ScoreBar } from "@/components/ScoreBits";
import { GithubAnalysis } from "@/components/GithubAnalysis";
import { RelatedSubmissions } from "@/components/RelatedSubmissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/lib/store";
import { CLUSTERS, gemExplanation, isHiddenGem, type Scores } from "@/lib/data";
import { calculateCompositeScore, isCustomWeights } from "@/lib/scoring";
import { getRelatedSubmissions } from "@/lib/similarity";
import { analyzeSubmission } from "./api.analyze";
import type { GeminiAnalysis } from "@/lib/gemini";
import { getAnalysisBySubmission, rowToAnalysis } from "@/lib/db/analyses";

export const Route = createFileRoute("/judge/submissions/$id")({
  component: ProjectDetail,
  notFoundComponent: () => (
    <div className="glass rounded-2xl p-10 text-center">
      <p className="font-medium">Project not found</p>
      <Button asChild className="mt-4">
        <Link to="/judge/submissions">Back to submissions</Link>
      </Button>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div role="alert" className="glass rounded-2xl p-8">
      {error.message}
    </div>
  ),
});

const CRITERIA: { key: keyof Scores; label: string }[] = [
  { key: "innovation", label: "Innovation" },
  { key: "impact", label: "Impact" },
  { key: "feasibility", label: "Feasibility" },
  { key: "technical", label: "Technical Implementation" },
  { key: "presentation", label: "Presentation" },
];

function ProjectDetail() {
  const { id } = Route.useParams();
  const {
    submissions,
    evaluations,
    saveEvaluation,
    patchEvaluation,
    toggleCompare,
    compare,
    hydrated,
    judgeWeights,
  } = useStore();
  const sub = submissions.find((s) => s.id === id);
  const existing = evaluations[id];
  const [scores, setScores] = useState<Scores>(
    existing?.scores ?? {
      innovation: 70,
      impact: 70,
      technical: 70,
      feasibility: 70,
      presentation: 70,
    },
  );
  const [notes, setNotes] = useState(existing?.notes ?? "");

  // ── Gemini analysis state ──────────────────────────────────────────────
  // Populated either from Supabase (on mount) or from a fresh Gemini call.
  const [geminiAnalysis, setGeminiAnalysis] = useState<GeminiAnalysis | null>(null);
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [geminiError, setGeminiError] = useState<string | null>(null);
  // true when the displayed analysis came from Supabase cache (not a fresh call)
  const [analysisCached, setAnalysisCached] = useState(false);

  // ── Load persisted analysis on mount ───────────────────────────────────
  // Runs once after the store is hydrated and the submission is known.
  // Uses the anon Supabase client (SELECT is allowed by RLS).
  // Does NOT call Gemini — cache load only.
  useEffect(() => {
    if (!hydrated || !sub) return;

    let cancelled = false;

    async function loadCachedAnalysis() {
      try {
        const row = await getAnalysisBySubmission(sub!.id);
        if (cancelled) return;
        if (row) {
          setGeminiAnalysis(rowToAnalysis(row));
          setAnalysisCached(true);
        }
      } catch (err) {
        // Log the DB error but do not surface it — the page still works
        // without the cached analysis; the judge can click Analyze.
        if (!cancelled) {
          console.warn("[ProjectDetail] Could not load cached analysis:", err);
        }
      }
    }

    void loadCachedAnalysis();
    return () => {
      cancelled = true;
    };
    // sub.id is stable for the lifetime of this page; hydrated only flips once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, sub?.id]);

  // ── Analyze button handler ──────────────────────────────────────────────
  // Calls the server function, which checks the Supabase cache internally.
  // If a cached row exists the server returns it immediately (0 Gemini calls).
  // If not, Gemini runs and the result is persisted before being returned.
  // forceRefresh=true bypasses the server cache (used by the Re-analyze button).
  async function runGeminiAnalysis(forceRefresh = false) {
    if (!sub || geminiLoading) return;
    setGeminiLoading(true);
    setGeminiError(null);
    try {
      const result = await analyzeSubmission({
        data: {
          submissionId: sub.id,
          forceRefresh,
          // Gemini input fields
          name: sub.name,
          team: sub.team,
          category: sub.category,
          problem: sub.problem,
          solution: sub.solution,
          stack: sub.stack,
          // Full submission fields for FK parent row upsert in Supabase
          members: sub.members,
          deckUrl: sub.deckUrl,
          scores: sub.scores,
          reasoning: sub.reasoning,
          strengths: sub.strengths,
          risks: sub.risks,
          cluster: sub.cluster,
          status: sub.status,
          submittedAt: sub.submittedAt,
        },
      });
      if (result.ok) {
        setGeminiAnalysis(result.analysis);
        setAnalysisCached(result.cached);
        toast.success(result.cached ? "Loaded from cache" : "Gemini analysis complete");
      } else {
        setGeminiError(result.error);
        toast.error(result.error);
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "An unexpected error occurred. Please try again.";
      setGeminiError(msg);
      toast.error(msg);
    } finally {
      setGeminiLoading(false);
    }
  }

  if (!hydrated)
    return (
      <div className="glass rounded-2xl p-8 text-sm text-muted-foreground">Loading project…</div>
    );
  if (!sub) throw notFound();

  const gem = isHiddenGem(sub.scores);
  const cluster = CLUSTERS.find((c) => c.id === sub.cluster);
  const ev = evaluations[id];
  const composite = calculateCompositeScore(sub.scores, judgeWeights);
  const custom = isCustomWeights(judgeWeights);

  return (
    <div className="animate-rise">
      <Link
        to="/judge/submissions"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to submissions
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">{sub.name}</h1>
          <p className="mt-1 text-muted-foreground">
            {sub.team} · submitted {new Date(sub.submittedAt).toLocaleString()}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge className="bg-primary/15 text-primary hover:bg-primary/20">{sub.category}</Badge>
            {cluster ? (
              <Badge variant="outline" className="border-border/70 text-muted-foreground">
                {cluster.name}
              </Badge>
            ) : null}
            {gem ? <GemBadge /> : null}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => toggleCompare(sub.id)}>
            <GitCompare className="mr-2 h-4 w-4" />
            {compare.includes(sub.id) ? "In comparison" : "Add to compare"}
          </Button>
          <Button asChild variant="ghost">
            <a href={sub.deckUrl || "#"} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Deck
            </a>
          </Button>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {/* ── Left / Main column ── */}
        <div className="space-y-6 lg:col-span-2">
          <section className="glass rounded-2xl p-6">
            <h2 className="text-lg font-semibold">Overview</h2>
            <div className="mt-4 space-y-4 text-sm leading-relaxed">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Problem</p>
                <p className="mt-1">{sub.problem}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  Solution
                </p>
                <p className="mt-1">{sub.solution}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  Tech stack
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {sub.stack.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-border/60 px-2.5 py-0.5 text-xs text-muted-foreground"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Team</p>
                <p className="mt-1 flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  {sub.members.join(", ")}
                </p>
              </div>
            </div>
          </section>

          <section className="glass rounded-2xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">AI analysis</h2>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => runGeminiAnalysis(!!geminiAnalysis)}
                disabled={geminiLoading}
                className="gap-2"
              >
                {geminiLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {geminiLoading
                  ? "Analyzing…"
                  : geminiAnalysis
                    ? "Re-analyze with Gemini"
                    : "Analyze with Gemini"}
              </Button>
            </div>

            {/* ── Hidden Gem signal (score-derived, shown regardless of Gemini state) ── */}
            {gem ? (
              <div className="mt-4 rounded-xl border border-warning/30 bg-warning/8 p-4 text-sm">
                <p className="mb-2 font-medium text-warning">Potential Hidden Gem signal</p>
                <p className="text-foreground/85">{gemExplanation(sub)}</p>
              </div>
            ) : null}

            {/* ── Loading state ── */}
            {geminiLoading && (
              <div className="mt-6 flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Running Gemini analysis…
              </div>
            )}

            {/* ── Empty state (no analysis yet, not loading) ── */}
            {!geminiAnalysis && !geminiLoading && !geminiError && (
              <p className="mt-6 text-sm text-muted-foreground">
                Click <span className="font-medium text-foreground">Analyze with Gemini</span> to
                generate an AI-powered evaluation for this submission.
              </p>
            )}

            {/* ── Gemini error state ── */}
            {geminiError && !geminiLoading && (
              <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/8 p-4 text-sm">
                <p className="font-medium text-destructive">Gemini analysis unavailable</p>
                <p className="mt-1 text-foreground/75">{geminiError}</p>
              </div>
            )}

            {/* ── Gemini result (cached or live) ── */}
            {geminiAnalysis && !geminiLoading && (
              <div className="mt-6 space-y-4">
                <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  {analysisCached ? "Cached Analysis" : "Live Gemini Analysis"}
                </p>
                <AiNote>
                  <p className="mb-2 font-medium">{geminiAnalysis.summary}</p>
                  <p>{geminiAnalysis.reasoning}</p>
                </AiNote>
                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium text-success">Strengths</p>
                    <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                      {geminiAnalysis.strengths.map((x) => (
                        <li key={x}>• {x}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-warning">Risks &amp; limitations</p>
                    <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                      {geminiAnalysis.risks.map((x) => (
                        <li key={x}>• {x}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">Gemini dimension scores</p>
                  <ScoreBar label="Innovation" value={geminiAnalysis.scores.innovation} />
                  <ScoreBar label="Impact" value={geminiAnalysis.scores.impact} />
                  <ScoreBar label="Technical strength" value={geminiAnalysis.scores.technical} />
                  <ScoreBar label="Feasibility" value={geminiAnalysis.scores.feasibility} />
                  <ScoreBar
                    label="Presentation quality"
                    value={geminiAnalysis.scores.presentation}
                  />
                </div>
              </div>
            )}

            <HumanLoopNote className="mt-6" />
          </section>

          <GithubAnalysis claimedStack={sub.stack} />

          <section className="glass rounded-2xl p-6">
            <h2 className="text-lg font-semibold">Your evaluation</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Score independently — AI signals are context, not a verdict.
            </p>
            <div className="mt-6 space-y-6">
              {CRITERIA.map((c) => (
                <div key={c.key}>
                  <div className="flex items-center justify-between text-sm">
                    <span>{c.label}</span>
                    <span className="tabular-nums text-muted-foreground">{scores[c.key]}</span>
                  </div>
                  <Slider
                    className="mt-3"
                    value={[scores[c.key]]}
                    max={100}
                    step={1}
                    onValueChange={(v) => setScores({ ...scores, [c.key]: v[0] })}
                  />
                </div>
              ))}
              <div>
                <p className="mb-2 text-sm">Notes</p>
                <Textarea
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What convinced you, what didn't…"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => {
                    saveEvaluation({
                      submissionId: sub.id,
                      scores,
                      notes,
                      reviewed: ev?.reviewed ?? false,
                      shortlisted: ev?.shortlisted ?? false,
                      flagged: ev?.flagged ?? false,
                      updatedAt: new Date().toISOString(),
                    });
                    toast.success("Evaluation saved");
                  }}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save evaluation
                </Button>
                <Button
                  variant={ev?.reviewed ? "default" : "secondary"}
                  onClick={() => {
                    patchEvaluation(sub.id, { reviewed: !ev?.reviewed, scores, notes });
                    toast.success(ev?.reviewed ? "Marked unreviewed" : "Marked reviewed");
                  }}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {ev?.reviewed ? "Reviewed" : "Mark reviewed"}
                </Button>
                <Button
                  variant={ev?.shortlisted ? "default" : "secondary"}
                  onClick={() => {
                    patchEvaluation(sub.id, { shortlisted: !ev?.shortlisted });
                    toast.success(ev?.shortlisted ? "Removed from shortlist" : "Shortlisted");
                  }}
                >
                  <Star className="mr-2 h-4 w-4" />
                  {ev?.shortlisted ? "Shortlisted" : "Shortlist"}
                </Button>
                <Button
                  variant={ev?.flagged ? "destructive" : "secondary"}
                  onClick={() => {
                    patchEvaluation(sub.id, { flagged: !ev?.flagged });
                    toast.success(ev?.flagged ? "Flag removed" : "Flagged for panel discussion");
                  }}
                >
                  <Flag className="mr-2 h-4 w-4" />
                  {ev?.flagged ? "Flagged" : "Flag"}
                </Button>
              </div>
            </div>
          </section>
        </div>

        {/* ── Right / Sidebar ── */}
        <aside className="space-y-5">
          {/* Composite Score */}
          <div className={`glass rounded-2xl p-5 ${custom ? "ring-1 ring-primary/30" : ""}`}>
            <div className="flex items-baseline justify-between">
              <h2 className="text-base font-semibold">Composite score</h2>
              <span
                className={`font-display text-3xl font-semibold tabular-nums ${custom ? "text-primary" : "text-muted-foreground"}`}
              >
                {composite}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {custom ? "Based on current judging criteria" : "Based on default judging criteria"}
            </p>
            {custom && (
              <div className="mt-3 space-y-1">
                {Object.entries(judgeWeights).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs text-muted-foreground">
                    <span className="capitalize">{k}</span>
                    <span className="tabular-nums">{v}%</span>
                  </div>
                ))}
              </div>
            )}
            {!custom && (
              <p className="mt-2 text-xs text-muted-foreground/70">
                Configure weights in the Submissions view to see how this changes.
              </p>
            )}
          </div>

          {/* Cluster context */}
          {cluster ? (
            <div className="glass rounded-2xl p-5">
              <h2 className="text-base font-semibold">Cluster context</h2>
              <p className="mt-2 text-sm text-muted-foreground">{cluster.summary}</p>
              <Button asChild variant="secondary" size="sm" className="mt-4">
                <Link to="/judge/clusters/$id" params={{ id: cluster.id }}>
                  View cluster
                </Link>
              </Button>
            </div>
          ) : null}

          {/* Related submissions */}
          <RelatedSubmissionsLazy sub={sub} allSubmissions={submissions} />
        </aside>
      </div>
    </div>
  );
}

/** Lazy-compute related submissions to avoid slowing initial render */
function RelatedSubmissionsLazy({
  sub,
  allSubmissions,
}: {
  sub: Parameters<typeof getRelatedSubmissions>[0];
  allSubmissions: Parameters<typeof getRelatedSubmissions>[1];
}) {
  const related = useMemo(
    () => getRelatedSubmissions(sub, allSubmissions, 4),
    [sub, allSubmissions],
  );
  return <RelatedSubmissions related={related} />;
}
