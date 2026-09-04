import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronUp, Info, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RelatedSubmission } from "@/lib/similarity";

function SimilarityDimensionBar({
  label,
  value,
  isPrimary,
}: {
  label: string;
  value: number;
  isPrimary: boolean;
}) {
  const color =
    value >= 70
      ? "bg-primary"
      : value >= 50
        ? "bg-cyan"
        : value >= 30
          ? "bg-warning"
          : "bg-muted-foreground/40";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span
          className={cn("text-muted-foreground", isPrimary && "font-medium text-foreground/80")}
        >
          {label}
        </span>
        <span className="tabular-nums font-medium">{value}%</span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-secondary/70">
        <div
          className={cn("h-full rounded-full transition-all duration-700", color)}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function WhySimilarPanel({ related }: { related: RelatedSubmission }) {
  const { similarity, submission } = related;
  return (
    <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Info className="h-3.5 w-3.5 text-primary shrink-0" />
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-primary">
          Why HackSort considers these projects related
        </p>
      </div>

      <div className="space-y-2.5">
        <SimilarityDimensionBar
          label="Problem similarity"
          value={similarity.problemSimilarity}
          isPrimary={true}
        />
        <SimilarityDimensionBar
          label="Solution similarity"
          value={similarity.solutionSimilarity}
          isPrimary={true}
        />
        <SimilarityDimensionBar
          label="Domain similarity"
          value={similarity.domainSimilarity}
          isPrimary={false}
        />
        <SimilarityDimensionBar
          label="Objective alignment"
          value={similarity.objectiveSimilarity}
          isPrimary={false}
        />
        <SimilarityDimensionBar
          label="Technology overlap"
          value={similarity.techOverlap}
          isPrimary={false}
        />
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/40 pt-3">
        {similarity.explanation}
      </p>

      <p className="text-[10px] text-muted-foreground/60">
        Similarity is evaluated on problem space, solution approach and domain — not technology
        names alone. Technology overlap (shown above) is treated as a supporting signal only.
      </p>
    </div>
  );
}

function RelatedCard({ related }: { related: RelatedSubmission }) {
  const [expanded, setExpanded] = useState(false);
  const { submission: s, similarity } = related;

  const scoreColor =
    similarity.score >= 75
      ? "text-primary"
      : similarity.score >= 55
        ? "text-cyan"
        : "text-muted-foreground";

  return (
    <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            to="/judge/submissions/$id"
            params={{ id: s.id }}
            className="text-sm font-semibold hover:text-primary transition-colors"
          >
            {s.name}
          </Link>
          <p className="text-xs text-muted-foreground mt-0.5">{s.team}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge className="bg-primary/10 text-primary text-[10px] hover:bg-primary/15">
            {s.category}
          </Badge>
          <span className={cn("font-display font-semibold text-lg tabular-nums", scoreColor)}>
            {similarity.score}%
          </span>
        </div>
      </div>

      <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{s.problem}</p>

      <Button
        variant="ghost"
        size="sm"
        className="mt-2 h-7 px-2 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
        onClick={() => setExpanded((v) => !v)}
      >
        <Link2 className="h-3 w-3" />
        Why similar?
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </Button>

      {expanded && <WhySimilarPanel related={related} />}
    </div>
  );
}

export function RelatedSubmissions({ related }: { related: RelatedSubmission[] }) {
  if (related.length === 0) {
    return (
      <div className="glass rounded-2xl p-5">
        <h2 className="text-base font-semibold mb-2">Related submissions</h2>
        <p className="text-sm text-muted-foreground">
          No significantly similar submissions found in the current pool.
        </p>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Related submissions</h2>
        <span className="text-xs text-muted-foreground">{related.length} found</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Submissions with the most similar problem space and solution approach. Click "Why similar?"
        to see the breakdown.
      </p>
      <div className="space-y-3">
        {related.map((r) => (
          <RelatedCard key={r.submission.id} related={r} />
        ))}
      </div>
    </div>
  );
}
