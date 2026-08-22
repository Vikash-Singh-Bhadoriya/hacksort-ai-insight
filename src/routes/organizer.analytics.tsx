import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/WorkspaceShell";
import { StatCard } from "@/components/ScoreBits";
import { Progress } from "@/components/ui/progress";
import { useStore } from "@/lib/store";
import { JUDGES, isHiddenGem } from "@/lib/data";
import { byCategory, clusterSizes, innovationDistribution } from "@/lib/analytics";
import { Gem, ListChecks, Layers, Users } from "lucide-react";

export const Route = createFileRoute("/organizer/analytics")({
  component: OrgAnalytics,
});

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  color: "var(--foreground)",
  fontSize: 12,
};

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-6">
      <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">{title}</h2>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function OrgAnalytics() {
  const { submissions, evaluations } = useStore();
  const cats = byCategory(submissions);
  const dist = innovationDistribution(submissions);
  const clusters = clusterSizes(submissions);
  const reviewed = submissions.filter((s) => evaluations[s.id]?.reviewed).length;
  const participants = submissions.reduce((n, s) => n + s.members.length, 0);

  return (
    <div>
      <PageHeader title="Event analytics" lead="How the event is distributed and how judging is progressing." />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Participants" value={participants} icon={Users} />
        <StatCard label="Submissions" value={submissions.length} icon={ListChecks} />
        <StatCard label="Clusters" value={clusters.length} icon={Layers} />
        <StatCard label="Hidden gems" value={submissions.filter((s) => isHiddenGem(s.scores)).length} icon={Gem} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Submissions by category">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cats}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="category" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} interval={0} angle={-25} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--secondary)", opacity: 0.3 }} />
                <Bar dataKey="count" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Cluster composition">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={clusters} dataKey="count" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={3}>
                  {clusters.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Innovation distribution">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dist}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="range" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--secondary)", opacity: 0.3 }} />
                <Bar dataKey="count" fill="var(--chart-4)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Judging progress">
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-sm">
                <span>Overall</span>
                <span className="tabular-nums text-muted-foreground">{reviewed}/{submissions.length}</span>
              </div>
              <Progress className="mt-2 h-1.5" value={(reviewed / Math.max(submissions.length, 1)) * 100} />
            </div>
            {JUDGES.map((j) => (
              <div key={j.name}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{j.name}</span>
                  <span className="tabular-nums text-muted-foreground">{j.reviewed}/{j.assigned}</span>
                </div>
                <Progress className="mt-2 h-1.5" value={(j.reviewed / j.assigned) * 100} />
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
