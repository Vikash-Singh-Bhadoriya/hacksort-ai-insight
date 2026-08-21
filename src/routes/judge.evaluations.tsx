import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ClipboardCheck, Flag, Star } from "lucide-react";
import { PageHeader } from "@/components/WorkspaceShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import { overallSignal } from "@/lib/data";

export const Route = createFileRoute("/judge/evaluations")({
  component: EvaluationsPage,
});

function EvaluationsPage() {
  const { submissions, evaluations, patchEvaluation } = useStore();
  const rows = submissions
    .map((s) => ({ s, ev: evaluations[s.id] }))
    .filter((r) => r.ev)
    .sort((a, b) => (b.ev!.updatedAt > a.ev!.updatedAt ? 1 : -1));

  const avg = (o: Record<string, number>) =>
    Math.round(Object.values(o).reduce((x, y) => x + y, 0) / Object.values(o).length);

  return (
    <div>
      <PageHeader
        title="Evaluations"
        lead="Your saved scores, notes and decisions. Everything here is human-entered — the AI never writes to this record."
      />

      {rows.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <ClipboardCheck className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-3 font-medium">No evaluations yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Open any project and save a score to start your record.</p>
          <Button asChild className="mt-5"><Link to="/judge/submissions">Go to submissions</Link></Button>
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map(({ s, ev }) => (
            <div key={s.id} className="glass glass-hover rounded-2xl p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link to="/judge/submissions/$id" params={{ id: s.id }} className="text-lg font-semibold hover:text-primary">
                    {s.name}
                  </Link>
                  <p className="text-sm text-muted-foreground">{s.team} · {s.category}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {ev!.reviewed ? <Badge className="bg-success/15 text-success hover:bg-success/20">Reviewed</Badge> : <Badge variant="outline">In progress</Badge>}
                  {ev!.shortlisted ? <Badge className="bg-warning/15 text-warning hover:bg-warning/20">Shortlisted</Badge> : null}
                  {ev!.flagged ? <Badge variant="destructive">Flagged</Badge> : null}
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
                {Object.entries(ev!.scores).map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-secondary/40 p-3 text-center">
                    <p className="font-display text-lg font-semibold tabular-nums">{v}</p>
                    <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{k}</p>
                  </div>
                ))}
                <div className="rounded-xl bg-primary/12 p-3 text-center ring-1 ring-primary/25">
                  <p className="font-display text-lg font-semibold tabular-nums">{avg(ev!.scores)}</p>
                  <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Your avg</p>
                </div>
                <div className="rounded-xl bg-secondary/40 p-3 text-center">
                  <p className="font-display text-lg font-semibold tabular-nums">{overallSignal(s.scores)}</p>
                  <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">AI signal</p>
                </div>
              </div>

              {ev!.notes ? <p className="mt-4 rounded-xl bg-secondary/30 p-4 text-sm text-muted-foreground">{ev!.notes}</p> : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => { patchEvaluation(s.id, { reviewed: !ev!.reviewed }); toast.success("Updated"); }}>
                  <ClipboardCheck className="mr-2 h-4 w-4" />{ev!.reviewed ? "Mark unreviewed" : "Mark reviewed"}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => { patchEvaluation(s.id, { shortlisted: !ev!.shortlisted }); toast.success("Updated"); }}>
                  <Star className="mr-2 h-4 w-4" />{ev!.shortlisted ? "Unshortlist" : "Shortlist"}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => { patchEvaluation(s.id, { flagged: !ev!.flagged }); toast.success("Updated"); }}>
                  <Flag className="mr-2 h-4 w-4" />{ev!.flagged ? "Unflag" : "Flag"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
