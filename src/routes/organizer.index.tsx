import { createFileRoute, Link } from "@tanstack/react-router";
import { Gem, Layers, ListChecks, Users } from "lucide-react";
import { PageHeader } from "@/components/WorkspaceShell";
import { AiNote, StatCard } from "@/components/ScoreBits";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { CLUSTERS, HACKATHON, JUDGES, isHiddenGem } from "@/lib/data";

export const Route = createFileRoute("/organizer/")({
  component: OrganizerHome,
});

function OrganizerHome() {
  const { submissions, evaluations } = useStore();
  const participants = submissions.reduce((n, s) => n + s.members.length, 0);
  const gems = submissions.filter((s) => isHiddenGem(s.scores)).length;
  const reviewed = submissions.filter((s) => evaluations[s.id]?.reviewed).length;
  const pct = Math.round((reviewed / Math.max(submissions.length, 1)) * 100);

  return (
    <div>
      <PageHeader
        title={HACKATHON.name}
        lead={`${HACKATHON.theme} · ${HACKATHON.dates} · ${HACKATHON.venue}`}
        actions={
          <Button asChild variant="secondary">
            <Link to="/organizer/results">View results</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Participants"
          value={participants}
          hint={`${submissions.length} teams registered`}
          icon={Users}
        />
        <StatCard
          label="Submissions"
          value={submissions.length}
          hint={`${pct}% judged`}
          icon={ListChecks}
        />
        <StatCard
          label="Clusters"
          value={CLUSTERS.length}
          hint="Semantic groupings"
          icon={Layers}
        />
        <StatCard label="Hidden gems" value={gems} hint="Flagged for extra review" icon={Gem} />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <div className="glass rounded-2xl p-6 lg:col-span-2">
          <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Judging progress
          </h2>
          <div className="mt-5 space-y-4">
            {JUDGES.map((j) => (
              <div key={j.name}>
                <div className="flex items-center justify-between text-sm">
                  <span>
                    {j.name} <span className="text-muted-foreground">· {j.track}</span>
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {j.reviewed}/{j.assigned}
                  </span>
                </div>
                <Progress className="mt-2 h-1.5" value={(j.reviewed / j.assigned) * 100} />
              </div>
            ))}
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Timeline
          </h2>
          <ol className="mt-5 space-y-4">
            {HACKATHON.timeline.map((t) => (
              <li key={t.t} className="flex gap-3 text-sm">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>
                  <span className="block text-xs text-muted-foreground">{t.t}</span>
                  {t.label}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="mt-6">
        <AiNote>
          <p>
            {submissions.length} submissions span {new Set(submissions.map((s) => s.category)).size}{" "}
            categories, with {gems} projects showing strong substance behind weak presentation.
            Judging is {pct}% complete; the slowest track is{" "}
            {[...JUDGES].sort((a, b) => a.reviewed / a.assigned - b.reviewed / b.assigned)[0]
              ?.track ?? "undetermined"}
            . Consider reallocating reviewers before the results window.
          </p>
        </AiNote>
      </div>
    </div>
  );
}
