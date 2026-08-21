import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ClipboardCheck,
  FileStack,
  Gem,
  Layers,
  Percent,
  Siren,
} from "lucide-react";
import { PageHeader } from "@/components/WorkspaceShell";
import { HumanLoopNote, StatCard } from "@/components/ScoreBits";
import { SubmissionCard } from "@/components/SubmissionCard";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useStore } from "@/lib/store";
import { CLUSTERS, isHiddenGem, overallSignal } from "@/lib/data";

export const Route = createFileRoute("/judge/")({
  component: JudgeDashboard,
});

function JudgeDashboard() {
  const { submissions, evaluations } = useStore();
  const reviewed = submissions.filter((s) => evaluations[s.id]?.reviewed).length;
  const gems = submissions.filter((s) => isHiddenGem(s.scores));
  const highPriority = submissions.filter((s) => overallSignal(s.scores) >= 82);
  const progress = Math.round((reviewed / Math.max(submissions.length, 1)) * 100);
  const queue = [...submissions]
    .sort((a, b) => overallSignal(b.scores) - overallSignal(a.scores))
    .filter((s) => !evaluations[s.id]?.reviewed)
    .slice(0, 3);

  return (
    <div>
      <PageHeader
        title="Judge Dashboard"
        lead="A structured view of the pool: what is urgent, what is duplicated and what deserves a second look."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Total submissions" value={submissions.length} icon={FileStack} hint="Across 9 categories" />
        <StatCard label="Reviewed" value={reviewed} icon={ClipboardCheck} hint={`${submissions.length - reviewed} remaining`} />
        <StatCard label="High priority" value={highPriority.length} icon={Siren} hint="Overall signal ≥ 82" />
        <StatCard label="Potential hidden gems" value={gems.length} icon={Gem} hint="High substance, low polish" />
        <StatCard label="Similarity clusters" value={CLUSTERS.length} icon={Layers} hint="Semantic grouping" />
        <StatCard label="Judging progress" value={`${progress}%`} icon={Percent} hint="Your review completion" />
      </div>

      <div className="glass mt-6 rounded-2xl p-6">
        <div className="flex items-center justify-between text-sm">
          <p className="font-medium">Judging progress</p>
          <p className="tabular-nums text-muted-foreground">{reviewed}/{submissions.length}</p>
        </div>
        <Progress value={progress} className="mt-3" />
        <HumanLoopNote className="mt-4" />
      </div>

      <div className="mt-10 flex items-end justify-between">
        <h2 className="font-display text-xl font-semibold">Recommended next reviews</h2>
        <Button asChild variant="secondary" size="sm">
          <Link to="/judge/submissions">All submissions</Link>
        </Button>
      </div>
      {queue.length === 0 ? (
        <div className="glass mt-4 rounded-2xl p-10 text-center text-sm text-muted-foreground">
          Every submission in your queue has been reviewed. Nice work.
        </div>
      ) : (
        <div className="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {queue.map((s) => (
            <SubmissionCard key={s.id} s={s} />
          ))}
        </div>
      )}
    </div>
  );
}
