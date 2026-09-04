import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/WorkspaceShell";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/lib/store";
import { CATEGORIES } from "@/lib/data";

export const Route = createFileRoute("/organizer/participants")({
  component: ParticipantsPage,
});

function ParticipantsPage() {
  const { submissions } = useStore();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");

  const rows = useMemo(
    () =>
      submissions
        .flatMap((s) =>
          s.members.map((m) => ({
            member: m,
            team: s.team,
            project: s.name,
            category: s.category,
            id: s.id,
          })),
        )
        .filter((r) => (cat === "all" ? true : r.category === cat))
        .filter((r) =>
          q.trim()
            ? [r.member, r.team, r.project].join(" ").toLowerCase().includes(q.trim().toLowerCase())
            : true,
        ),
    [submissions, q, cat],
  );

  return (
    <div>
      <PageHeader
        title="Participants"
        lead={`${rows.length} people across ${submissions.length} registered teams.`}
      />

      <div className="glass mb-5 flex flex-col gap-3 rounded-2xl p-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search participants, teams or projects…"
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
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left text-muted-foreground">
              <th className="p-4 font-medium">Participant</th>
              <th className="p-4 font-medium">Team</th>
              <th className="p-4 font-medium">Project</th>
              <th className="p-4 font-medium">Category</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.id}-${i}`} className="border-b border-border/30 last:border-0">
                <td className="p-4">{r.member}</td>
                <td className="p-4 text-muted-foreground">{r.team}</td>
                <td className="p-4">{r.project}</td>
                <td className="p-4 text-muted-foreground">{r.category}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={4} className="p-10 text-center text-muted-foreground">
                  No participants match that filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
