import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/WorkspaceShell";
import { SubmissionCard } from "@/components/SubmissionCard";
import { CriteriaPanel } from "@/components/CriteriaPanel";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/lib/store";
import { CATEGORIES, overallSignal } from "@/lib/data";
import { calculateCompositeScore } from "@/lib/scoring";

export const Route = createFileRoute("/judge/submissions/")({
  component: SubmissionsPage,
});

function SubmissionsPage() {
  const { submissions, compare, clearCompare, judgeWeights } = useStore();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [sort, setSort] = useState("composite");

  const list = useMemo(() => {
    const filtered = submissions.filter((s) => {
      const matchQ =
        !q ||
        [s.name, s.team, s.problem, s.solution, ...s.stack]
          .join(" ")
          .toLowerCase()
          .includes(q.toLowerCase());
      const matchC = cat === "all" || s.category === cat;
      return matchQ && matchC;
    });
    return filtered.sort((a, b) => {
      if (sort === "innovation") return b.scores.innovation - a.scores.innovation;
      if (sort === "impact") return b.scores.impact - a.scores.impact;
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "signal") return overallSignal(b.scores) - overallSignal(a.scores);
      // Default: composite (judge-weighted)
      return (
        calculateCompositeScore(b.scores, judgeWeights) -
        calculateCompositeScore(a.scores, judgeWeights)
      );
    });
  }, [submissions, q, cat, sort, judgeWeights]);

  return (
    <div>
      <PageHeader
        title="Submissions"
        lead="Search, filter and open any project. Select projects to add them to the comparison tray."
        actions={
          compare.length ? (
            <Button variant="secondary" onClick={clearCompare}>
              Clear {compare.length} selected
            </Button>
          ) : undefined
        }
      />

      <div className="mb-6">
        <CriteriaPanel />
      </div>

      <div className="glass mb-6 flex flex-col gap-3 rounded-2xl p-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search projects, teams, tech…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="composite">Composite score</SelectItem>
            <SelectItem value="signal">AI Signal (fixed)</SelectItem>
            <SelectItem value="innovation">Innovation</SelectItem>
            <SelectItem value="impact">Impact</SelectItem>
            <SelectItem value="name">Name A-Z</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {list.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <p className="font-medium">No submissions match your filters</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try clearing the search term or choosing another category.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {list.map((s) => (
            <SubmissionCard key={s.id} s={s} />
          ))}
        </div>
      )}
    </div>
  );
}
