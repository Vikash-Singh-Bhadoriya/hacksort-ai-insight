import { createFileRoute, Link } from "@tanstack/react-router";
import { Layers, Link2 } from "lucide-react";
import { PageHeader } from "@/components/WorkspaceShell";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { CLUSTERS, SIMILAR_PAIRS } from "@/lib/data";

export const Route = createFileRoute("/judge/clusters/")({
  component: ClustersPage,
});

function ClustersPage() {
  const { submissions } = useStore();
  const nameOf = (id: string) => submissions.find((s) => s.id === id)?.name ?? "Unknown";

  return (
    <div>
      <PageHeader
        title="Similarity Clusters"
        lead="Submissions grouped by semantic similarity so you can see convergence, saturation and genuinely distinct work."
      />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {CLUSTERS.map((c) => {
          const items = submissions.filter((s) => s.cluster === c.id);
          return (
            <div key={c.id} className="glass glass-hover flex flex-col rounded-2xl p-6">
              <div className="flex items-start justify-between">
                <Layers className="h-5 w-5 text-violet" />
                <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs text-primary tabular-nums">{c.similarity}% similar</span>
              </div>
              <h3 className="mt-4 text-lg font-semibold">{c.name}</h3>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">{c.summary}</p>
              <p className="mt-4 text-sm"><span className="font-display text-2xl font-semibold tabular-nums">{items.length}</span> <span className="text-muted-foreground">projects</span></p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {c.tech.map((t) => (
                  <span key={t} className="rounded-full border border-border/60 px-2 py-0.5 text-[11px] text-muted-foreground">{t}</span>
                ))}
              </div>
              <Button asChild size="sm" className="mt-5">
                <Link to="/judge/clusters/$id" params={{ id: c.id }}>View cluster</Link>
              </Button>
            </div>
          );
        })}
      </div>

      <h2 className="mt-12 font-display text-xl font-semibold">Highly similar pairs</h2>
      <div className="glass mt-4 divide-y divide-border/60 rounded-2xl">
        {SIMILAR_PAIRS.map((p) => (
          <div key={`${p.a}-${p.b}`} className="flex flex-wrap items-center gap-3 p-5">
            <Link2 className="h-4 w-4 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                <Link to="/judge/submissions/$id" params={{ id: p.a }} className="hover:text-primary">{nameOf(p.a)}</Link>
                <span className="text-muted-foreground"> ↔ </span>
                <Link to="/judge/submissions/$id" params={{ id: p.b }} className="hover:text-primary">{nameOf(p.b)}</Link>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{p.why}</p>
            </div>
            <span className="rounded-full bg-secondary/60 px-3 py-1 text-xs tabular-nums">{p.score}% match</span>
          </div>
        ))}
      </div>
    </div>
  );
}
