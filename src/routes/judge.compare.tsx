import { createFileRoute, Link } from "@tanstack/react-router";
import { GitCompare, X } from "lucide-react";
import { PageHeader } from "@/components/WorkspaceShell";
import { AiNote, HumanLoopNote } from "@/components/ScoreBits";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore } from "@/lib/store";
import { isHiddenGem, overallSignal, type Scores, type Submission } from "@/lib/data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/judge/compare")({
  component: ComparePage,
});

const ROWS: { key: keyof Scores; label: string }[] = [
  { key: "innovation", label: "Innovation" },
  { key: "impact", label: "Impact" },
  { key: "technical", label: "Technical strength" },
  { key: "feasibility", label: "Feasibility" },
  { key: "presentation", label: "Presentation" },
];

function insight(items: Submission[]) {
  if (items.length < 2) return "";
  const best = (k: keyof Scores) => items.reduce((a, b) => (b.scores[k] > a.scores[k] ? b : a));
  const topSignal = items.reduce((a, b) => (overallSignal(b.scores) > overallSignal(a.scores) ? b : a));
  const gems = items.filter((s) => isHiddenGem(s.scores));
  const sameCat = new Set(items.map((s) => s.category)).size === 1;
  return [
    `${best("innovation").name} leads on innovation (${best("innovation").scores.innovation}), while ${best("feasibility").name} is the most immediately deliverable (feasibility ${best("feasibility").scores.feasibility}).`,
    `${topSignal.name} carries the highest overall signal at ${overallSignal(topSignal.scores)}, driven mostly by ${topSignal.scores.impact >= topSignal.scores.innovation ? "impact" : "innovation"}.`,
    sameCat
      ? `All selected projects sit in ${items[0].category}, so the differentiator is execution depth rather than problem choice.`
      : `The projects span ${new Set(items.map((s) => s.category)).size} categories, so weigh comparability before ranking them directly.`,
    gems.length
      ? `${gems.map((g) => g.name).join(", ")} ${gems.length > 1 ? "are" : "is"} flagged as a potential hidden gem — presentation scores understate the underlying work.`
      : `No hidden-gem signal in this set: presentation quality is broadly aligned with substance.`,
  ].join(" ");
}

function ComparePage() {
  const { submissions, compare, toggleCompare, clearCompare } = useStore();
  const items = submissions.filter((s) => compare.includes(s.id));
  const available = submissions.filter((s) => !compare.includes(s.id));

  return (
    <div>
      <PageHeader
        title="Compare"
        lead="Put two to four projects side by side across every signal, with an AI-written read of the differences."
        actions={items.length ? <Button variant="secondary" onClick={clearCompare}>Clear all</Button> : undefined}
      />

      <div className="glass mb-6 flex flex-wrap items-center gap-3 rounded-2xl p-4">
        <Select value="" onValueChange={(v) => toggleCompare(v)}>
          <SelectTrigger className="w-full sm:w-72"><SelectValue placeholder="Add a project to compare…" /></SelectTrigger>
          <SelectContent>
            {available.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name} — {s.category}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex flex-wrap gap-2">
          {items.map((s) => (
            <span key={s.id} className="flex items-center gap-1.5 rounded-full border border-border/70 bg-secondary/40 px-3 py-1 text-xs">
              {s.name}
              <button onClick={() => toggleCompare(s.id)} aria-label={`Remove ${s.name}`}>
                <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
              </button>
            </span>
          ))}
        </div>
      </div>

      {items.length < 2 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <GitCompare className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-3 font-medium">Select at least two projects</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add projects from the dropdown above, or from any submission card.
          </p>
          <Button asChild className="mt-5"><Link to="/judge/submissions">Browse submissions</Link></Button>
        </div>
      ) : (
        <>
          <div className="glass overflow-x-auto rounded-2xl">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left">
                  <th className="p-4 font-medium text-muted-foreground">Signal</th>
                  {items.map((s) => (
                    <th key={s.id} className="p-4">
                      <Link to="/judge/submissions/$id" params={{ id: s.id }} className="font-semibold hover:text-primary">{s.name}</Link>
                      <p className="text-xs font-normal text-muted-foreground">{s.category}</p>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r) => {
                  const max = Math.max(...items.map((s) => s.scores[r.key]));
                  return (
                    <tr key={r.key} className="border-b border-border/40">
                      <td className="p-4 text-muted-foreground">{r.label}</td>
                      {items.map((s) => (
                        <td key={s.id} className={cn("p-4 tabular-nums", s.scores[r.key] === max && "font-semibold text-primary")}>
                          {s.scores[r.key]}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                <tr>
                  <td className="p-4 font-medium">Overall signal</td>
                  {items.map((s) => (
                    <td key={s.id} className="p-4 font-display text-lg font-semibold tabular-nums">{overallSignal(s.scores)}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-6"><AiNote><p>{insight(items)}</p></AiNote></div>
          <HumanLoopNote className="mt-4" />
        </>
      )}
    </div>
  );
}
