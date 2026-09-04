import { createFileRoute, Link } from "@tanstack/react-router";
import { Gem, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/WorkspaceShell";
import { AiNote, GemBadge, HumanLoopNote, ScoreBar } from "@/components/ScoreBits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { gemExplanation, isHiddenGem, overallSignal } from "@/lib/data";
import { calculateCompositeScore, isCustomWeights } from "@/lib/scoring";

export const Route = createFileRoute("/judge/gems")({
  component: GemsPage,
});

function GemsPage() {
  const { submissions, judgeWeights } = useStore();
  const gems = submissions
    .filter((s) => isHiddenGem(s.scores))
    .sort((a, b) => overallSignal(b.scores) - overallSignal(a.scores));
  const custom = isCustomWeights(judgeWeights);

  return (
    <div>
      <PageHeader
        title="Potential Hidden Gems"
        lead="Projects with strong innovation, impact and technical potential whose presentation quality would usually cause them to be filtered out early."
      />

      <div className="glass mb-8 flex flex-wrap items-start gap-4 rounded-2xl p-6">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-warning/15 ring-1 ring-warning/30 shrink-0">
          <Gem className="h-5 w-5 text-warning" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {gems.length} project{gems.length !== 1 ? "s" : ""} recommended for a second look
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Detection criteria: presentation ≤ 60 and average of innovation + impact + technical ≥
            78. These thresholds are fixed and do not change with judge weight configuration.
          </p>
          <HumanLoopNote className="mt-2" />
        </div>
      </div>

      {gems.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <Sparkles className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-3 font-medium">No hidden gems detected in the current pool</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Every high-substance submission also presents well. Nothing is being hidden by
            packaging.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {gems.map((s) => {
            const composite = calculateCompositeScore(s.scores, judgeWeights);
            const subAvg = Math.round(
              (s.scores.innovation + s.scores.impact + s.scores.technical) / 3,
            );

            return (
              <article key={s.id} className="glass glass-hover rounded-2xl p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold">{s.name}</h3>
                    <p className="text-sm text-muted-foreground">{s.team}</p>
                  </div>
                  <Badge className="bg-primary/15 text-primary hover:bg-primary/20">
                    {s.category}
                  </Badge>
                </div>
                <GemBadge className="mt-3" />

                {/* Score breakdown — strong vs weak */}
                <div className="mt-5 space-y-2.5">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground mb-3">
                    Score breakdown
                  </p>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <div className="space-y-2.5">
                      <p className="text-[10px] uppercase tracking-[0.1em] text-success mb-1.5">
                        Strong dimensions
                      </p>
                      <ScoreBar label="Innovation" value={s.scores.innovation} />
                      <ScoreBar label="Impact" value={s.scores.impact} />
                      <ScoreBar label="Technical" value={s.scores.technical} />
                    </div>
                    <div className="space-y-2.5">
                      <p className="text-[10px] uppercase tracking-[0.1em] text-warning mb-1.5">
                        Weak dimension
                      </p>
                      <ScoreBar label="Presentation" value={s.scores.presentation} />
                      <div className="mt-3 rounded-xl bg-secondary/40 p-3 text-center">
                        <p className="font-display text-xl font-semibold tabular-nums">{subAvg}</p>
                        <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground mt-0.5">
                          Substance avg
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Composite score if custom weights */}
                {custom && (
                  <div className="mt-4 rounded-xl bg-primary/8 ring-1 ring-primary/20 p-3 flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      Composite score (current weights)
                    </p>
                    <span className="font-display font-semibold text-primary tabular-nums">
                      {composite}
                    </span>
                  </div>
                )}

                <div className="mt-5">
                  <AiNote>
                    <p>{gemExplanation(s)}</p>
                  </AiNote>
                </div>

                <Button asChild size="sm" className="mt-5">
                  <Link to="/judge/submissions/$id" params={{ id: s.id }}>
                    Review project
                  </Link>
                </Button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
