import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Link2, Info } from "lucide-react";
import { SubmissionCard } from "@/components/SubmissionCard";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { CLUSTERS } from "@/lib/data";
import { getPairwiseSimilarities } from "@/lib/similarity";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/judge/clusters/$id")({
  component: ClusterDetail,
  errorComponent: ({ error }) => (
    <div role="alert" className="glass rounded-2xl p-8">
      {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="glass rounded-2xl p-8">Cluster not found.</div>,
});

function scoreColor(score: number) {
  if (score >= 70) return "text-primary";
  if (score >= 50) return "text-cyan";
  if (score >= 35) return "text-warning";
  return "text-muted-foreground";
}

function ClusterDetail() {
  const { id } = Route.useParams();
  const { submissions } = useStore();
  const cluster = CLUSTERS.find((c) => c.id === id);
  const items = submissions.filter((s) => s.cluster === id);

  const pairs = useMemo(() => getPairwiseSimilarities(items), [items]);

  if (!cluster) {
    return (
      <div className="glass rounded-2xl p-10 text-center">
        <p className="font-medium">Cluster not found</p>
        <Button asChild className="mt-4">
          <Link to="/judge/clusters">Back to clusters</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="animate-rise">
      <Link
        to="/judge/clusters"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> All clusters
      </Link>
      <h1 className="font-display text-3xl font-semibold">{cluster.name}</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{cluster.summary}</p>
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-primary/15 px-3 py-1 text-primary tabular-nums">
          {cluster.similarity}% intra-cluster similarity
        </span>
        <span className="rounded-full bg-secondary/60 px-3 py-1 tabular-nums">
          {items.length} projects
        </span>
        {cluster.tech.map((t) => (
          <span
            key={t}
            className="rounded-full border border-border/60 px-3 py-1 text-muted-foreground"
          >
            {t}
          </span>
        ))}
      </div>

      {/* Similarity Basis Note */}
      <div className="mt-6 glass rounded-2xl p-5 flex gap-3">
        <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div className="text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Similarity basis</p>
          <p>
            HackSort groups submissions by the semantic meaning of their problem space and proposed
            solution, not by technology names alone. Projects in this cluster share a common{" "}
            <strong className="text-foreground/80">problem domain</strong> and{" "}
            <strong className="text-foreground/80">solution approach</strong>. Technology overlap is
            used as a supporting signal — two projects using Python + React will not appear similar
            unless their problems are also related.
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="glass mt-8 rounded-2xl p-12 text-center text-sm text-muted-foreground">
          No submissions currently mapped to this cluster.
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {items.map((s) => (
              <SubmissionCard key={s.id} s={s} />
            ))}
          </div>

          {/* Pairwise similarity table */}
          {pairs.length > 0 && (
            <div className="mt-10">
              <h2 className="font-display text-xl font-semibold">Pairwise relationships</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Similarity between every pair of projects in this cluster. Not all projects are
                equally similar — this table shows who is actually closest.
              </p>
              <div className="glass mt-4 divide-y divide-border/50 rounded-2xl overflow-hidden">
                {pairs.map(({ a, b, similarity }) => (
                  <div
                    key={`${a.id}-${b.id}`}
                    className="flex flex-wrap items-start gap-4 p-4 hover:bg-white/3 transition-colors"
                  >
                    <Link2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-sm font-medium">
                        <Link
                          to="/judge/submissions/$id"
                          params={{ id: a.id }}
                          className="hover:text-primary"
                        >
                          {a.name}
                        </Link>
                        <span className="text-muted-foreground mx-2">↔</span>
                        <Link
                          to="/judge/submissions/$id"
                          params={{ id: b.id }}
                          className="hover:text-primary"
                        >
                          {b.name}
                        </Link>
                      </p>
                      <p className="text-xs text-muted-foreground">{similarity.explanation}</p>
                      <div className="flex flex-wrap gap-2 mt-1.5">
                        {[
                          { l: "Problem", v: similarity.problemSimilarity },
                          { l: "Solution", v: similarity.solutionSimilarity },
                          { l: "Domain", v: similarity.domainSimilarity },
                        ].map(({ l, v }) => (
                          <span key={l} className="text-[10px] text-muted-foreground tabular-nums">
                            {l}: <strong className={cn(scoreColor(v))}>{v}%</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                    <span
                      className={cn(
                        "font-display font-semibold text-xl tabular-nums shrink-0",
                        scoreColor(similarity.score),
                      )}
                    >
                      {similarity.score}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
