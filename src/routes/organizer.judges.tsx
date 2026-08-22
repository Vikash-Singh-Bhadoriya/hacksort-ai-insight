import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { PageHeader } from "@/components/WorkspaceShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORIES, JUDGES } from "@/lib/data";

export const Route = createFileRoute("/organizer/judges")({
  component: JudgesPage,
});

function JudgesPage() {
  const [judges, setJudges] = useState(JUDGES);
  const [name, setName] = useState("");
  const [track, setTrack] = useState<string>(CATEGORIES[0]);

  const invite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setJudges((prev) => [...prev, { name: name.trim(), track, reviewed: 0, assigned: 24, active: "just now" }]);
    toast.success("Judge invited", { description: `${name.trim()} was added to the ${track} track.` });
    setName("");
  };

  return (
    <div>
      <PageHeader title="Judges" lead="Panel composition, track assignment and review progress." />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="glass overflow-x-auto rounded-2xl lg:col-span-2">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-muted-foreground">
                <th className="p-4 font-medium">Judge</th>
                <th className="p-4 font-medium">Track</th>
                <th className="p-4 font-medium">Progress</th>
                <th className="p-4 font-medium">Last active</th>
              </tr>
            </thead>
            <tbody>
              {judges.map((j) => (
                <tr key={j.name} className="border-b border-border/30 last:border-0">
                  <td className="p-4">{j.name}</td>
                  <td className="p-4 text-muted-foreground">{j.track}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <Progress className="h-1.5 w-28" value={(j.reviewed / j.assigned) * 100} />
                      <span className="tabular-nums text-xs text-muted-foreground">{j.reviewed}/{j.assigned}</span>
                    </div>
                  </td>
                  <td className="p-4 text-muted-foreground">{j.active}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form onSubmit={invite} className="glass h-fit rounded-2xl p-6">
          <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">Invite a judge</h2>
          <div className="mt-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="jname">Full name</Label>
              <Input id="jname" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dr. Leila Hassan" />
            </div>
            <div className="space-y-2">
              <Label>Track</Label>
              <Select value={track} onValueChange={setTrack}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full">
              <UserPlus className="mr-2 h-4 w-4" /> Send invite
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
