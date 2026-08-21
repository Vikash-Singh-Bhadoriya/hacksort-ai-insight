import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { SubmissionCard } from "@/components/SubmissionCard";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { CLUSTERS } from "@/lib/data";

export const Route = createFileRoute("/judge/clusters/$id")({
  component: ClusterDetail,
  errorComponent: ({ error }) => <div role="alert" className="glass rounded-2xl p-8">{error.message}</div>,
  notFoundComponent: () => <div className="glass rounded-2xl p-8">Cluster not found.</div>,
});

function ClusterDetail() {
  const { id } = Route.useParams();
  const { submissions } = useStore();
  const cluster = CLUSTERS.find((c) => c.id === id);
  const items = submissions.filter((s) => s.cluster === id);

  if (!cluster) {
    return (
      <div className="glass rounded-2xl p-10 text-center">
        <p className="font-medium">Cluster not found</p>
        <Button asChild className="mt-4"><Link to="/judge/clusters">Back to clusters</Link></Button>
      </div>
    );
  }

  return (
    <div className="animate-rise">
      <Link to="/judge/clusters" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All clusters
      </Link>
      <h1 className="font-display text-3xl font-semibold">{cluster.name}</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{cluster.summary}</p>
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-primary/15 px-3 py-1 text-primary tabular-nums">{cluster.similarity}% intra-cluster similarity</span>
        <span className="rounded-full bg-secondary/60 px-3 py-1 tabular-nums">{items.length} projects</span>
        {cluster.tech.map((t) => (
          <span key={t} className="rounded-full border border-border/60 px-3 py-1 text-muted-foreground">{t}</span>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="glass mt-8 rounded-2xl p-12 text-center text-sm text-muted-foreground">
          No submissions currently mapped to this cluster.
        </div>
      ) : (
        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {items.map((s) => <SubmissionCard key={s.id} s={s} />)}
        </div>
      )}
    </div>
  );
}
