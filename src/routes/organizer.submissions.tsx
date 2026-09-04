import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/WorkspaceShell";
import { GemBadge } from "@/components/ScoreBits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/lib/store";
import { CATEGORIES, isHiddenGem, overallSignal } from "@/lib/data";

export const Route = createFileRoute("/organizer/submissions")({
  component: OrgSubmissions,
});

function OrgSubmissions() {
  const { submissions, evaluations } = useStore();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");

  const rows = useMemo(
    () =>
      submissions
        .filter((s) => (cat === "all" ? true : s.category === cat))
        .filter((s) =>
          q.trim() ? `${s.name} ${s.team}`.toLowerCase().includes(q.trim().toLowerCase()) : true,
        )
        .sort((a, b) => overallSignal(b.scores) - overallSignal(a.scores)),
    [submissions, q, cat],
  );

  const exportCsv = () => {
    const header = "Project,Team,Category,Signal,Status\n";
    const body = rows
      .map((s) =>
        [
          s.name,
          s.team,
          s.category,
          overallSignal(s.scores),
          evaluations[s.id]?.reviewed ? "Reviewed" : s.status,
        ].join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(new Blob([header + body], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "hacksort-submissions.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export ready", { description: `${rows.length} submissions exported as CSV.` });
  };

  return (
    <div>
      <PageHeader
        title="Submissions"
        lead="Every project received, ranked by overall signal."
        actions={
          <Button variant="secondary" onClick={exportCsv}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        }
      />

      <div className="glass mb-5 flex flex-col gap-3 rounded-2xl p-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search projects or teams…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="sm:w-56">
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
      </div>

      <div className="glass overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left text-muted-foreground">
              <th className="p-4 font-medium">Project</th>
              <th className="p-4 font-medium">Team</th>
              <th className="p-4 font-medium">Category</th>
              <th className="p-4 font-medium">Signal</th>
              <th className="p-4 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-b border-border/30 last:border-0">
                <td className="p-4">
                  <span className="font-medium">{s.name}</span>
                  {isHiddenGem(s.scores) ? <GemBadge className="ml-2" /> : null}
                </td>
                <td className="p-4 text-muted-foreground">{s.team}</td>
                <td className="p-4 text-muted-foreground">{s.category}</td>
                <td className="p-4 font-medium tabular-nums">{overallSignal(s.scores)}</td>
                <td className="p-4 text-muted-foreground">
                  {evaluations[s.id]?.reviewed ? "Reviewed" : s.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
