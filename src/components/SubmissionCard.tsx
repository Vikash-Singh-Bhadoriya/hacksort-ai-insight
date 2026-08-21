import { Link } from "@tanstack/react-router";
import { CheckCircle2, Flag, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GemBadge } from "./ScoreBits";
import { isHiddenGem, overallSignal, type Submission } from "@/lib/data";
import { useStore } from "@/lib/store";

export function SubmissionCard({ s }: { s: Submission }) {
  const { evaluations, compare, toggleCompare } = useStore();
  const ev = evaluations[s.id];
  const gem = isHiddenGem(s.scores);
  const selected = compare.includes(s.id);

  return (
    <article className="glass glass-hover flex flex-col rounded-2xl p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold">{s.name}</h3>
          <p className="text-sm text-muted-foreground">{s.team}</p>
        </div>
        <Badge className="shrink-0 bg-primary/15 text-primary hover:bg-primary/20">{s.category}</Badge>
      </div>

      {gem ? <GemBadge className="mt-3 self-start" /> : null}

      <p className="mt-4 line-clamp-2 text-sm text-muted-foreground">{s.problem}</p>

      <div className="mt-5 grid grid-cols-3 gap-3 text-center">
        {[
          { l: "Innovation", v: s.scores.innovation },
          { l: "Impact", v: s.scores.impact },
          { l: "Signal", v: overallSignal(s.scores) },
        ].map((m) => (
          <div key={m.l} className="rounded-xl bg-secondary/40 py-2">
            <p className="font-display text-lg font-semibold tabular-nums">{m.v}</p>
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{m.l}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {s.stack.slice(0, 4).map((t) => (
          <span key={t} className="rounded-full border border-border/60 px-2 py-0.5 text-[11px] text-muted-foreground">
            {t}
          </span>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
        {ev?.reviewed ? <span className="flex items-center gap-1 text-success"><CheckCircle2 className="h-3.5 w-3.5" />Reviewed</span> : <span>{s.status}</span>}
        {ev?.shortlisted ? <span className="flex items-center gap-1 text-warning"><Star className="h-3.5 w-3.5" />Shortlisted</span> : null}
        {ev?.flagged ? <span className="flex items-center gap-1 text-destructive"><Flag className="h-3.5 w-3.5" />Flagged</span> : null}
      </div>

      <div className="mt-5 flex gap-2">
        <Button asChild size="sm" className="flex-1">
          <Link to="/judge/submissions/$id" params={{ id: s.id }}>Open project</Link>
        </Button>
        <Button size="sm" variant={selected ? "default" : "secondary"} onClick={() => toggleCompare(s.id)}>
          {selected ? "Selected" : "Compare"}
        </Button>
      </div>
    </article>
  );
}
