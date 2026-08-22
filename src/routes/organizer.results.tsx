import { createFileRoute } from "@tanstack/react-router";
import { Download, Trophy } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/WorkspaceShell";
import { AiNote, GemBadge, HumanLoopNote } from "@/components/ScoreBits";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { isHiddenGem, overallSignal } from "@/lib/data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/organizer/results")({
  component: ResultsPage,
});

function ResultsPage() {
  const { submissions } = useStore();
  const ranked = [...submissions].sort((a, b) => overallSignal(b.scores) - overallSignal(a.scores));
  const top = ranked.slice(0, 10);

  const exportResults = () => {
    const csv =
      "Rank,Project,Team,Category,Signal\n" +
      ranked.map((s, i) => [i + 1, s.name, s.team, s.category, overallSignal(s.scores)].join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "hacksort-results.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Results exported");
  };

  return (
    <div>
      <PageHeader
        title="Results"
        lead="Provisional leaderboard from combined AI signal — organizers confirm the final ranking."
        actions={
          <Button variant="secondary" onClick={exportResults}>
            <Download className="mr-2 h-4 w-4" /> Export results
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        {top.slice(0, 3).map((s, i) => (
          <div key={s.id} className={cn("glass rounded-2xl p-6", i === 0 && "ring-1 ring-primary/40")}>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                {["Winner", "Runner-up", "Third place"][i]}
              </span>
              <Trophy className={cn("h-4 w-4", i === 0 ? "text-warning" : "text-muted-foreground")} />
            </div>
            <h2 className="mt-3 font-display text-xl font-semibold">{s.name}</h2>
            <p className="text-sm text-muted-foreground">{s.team} · {s.category}</p>
            <p className="mt-4 font-display text-3xl font-semibold tabular-nums">{overallSignal(s.scores)}</p>
          </div>
        ))}
      </div>

      <div className="glass mt-6 overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left text-muted-foreground">
              <th className="p-4 font-medium">#</th>
              <th className="p-4 font-medium">Project</th>
              <th className="p-4 font-medium">Team</th>
              <th className="p-4 font-medium">Category</th>
              <th className="p-4 font-medium">Signal</th>
            </tr>
          </thead>
          <tbody>
            {top.map((s, i) => (
              <tr key={s.id} className="border-b border-border/30 last:border-0">
                <td className="p-4 tabular-nums text-muted-foreground">{i + 1}</td>
                <td className="p-4">
                  <span className="font-medium">{s.name}</span>
                  {isHiddenGem(s.scores) ? <GemBadge className="ml-2" /> : null}
                </td>
                <td className="p-4 text-muted-foreground">{s.team}</td>
                <td className="p-4 text-muted-foreground">{s.category}</td>
                <td className="p-4 font-medium tabular-nums">{overallSignal(s.scores)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6">
        <AiNote>
          <p>
            The top of the board is separated by narrow margins, so presentation quality should not be the tiebreaker.
            {" "}
            {ranked.filter((s) => isHiddenGem(s.scores)).length} hidden-gem projects sit inside the shortlist window and
            deserve a second human pass before the ranking is locked.
          </p>
        </AiNote>
        <HumanLoopNote className="mt-4" />
      </div>
    </div>
  );
}
