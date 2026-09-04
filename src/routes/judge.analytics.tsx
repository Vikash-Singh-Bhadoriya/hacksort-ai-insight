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
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/WorkspaceShell";
import { Progress } from "@/components/ui/progress";
import { useStore } from "@/lib/store";
import {
  byCategory,
  clusterSizes,
  gemCount,
  innovationDistribution,
  saturation,
  signalSpread,
} from "@/lib/analytics";

export const Route = createFileRoute("/judge/analytics")({
  component: AnalyticsPage,
});

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function Panel({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`glass rounded-2xl p-6 ${className}`}>
      <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </div>
  );
}

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  color: "var(--foreground)",
  fontSize: 12,
};

function AnalyticsPage() {
  const { submissions, evaluations } = useStore();
  const cats = byCategory(submissions);
  const dist = innovationDistribution(submissions);
  const clusters = clusterSizes(submissions);
  const sat = saturation(submissions);
  const reviewed = submissions.filter((s) => evaluations[s.id]?.reviewed).length;
  const spread = signalSpread(submissions).slice(0, 24);

  return (
    <div>
      <PageHeader
        title="Analytics"
        lead="Distribution, saturation and progress across the judging pool."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Submissions by category">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cats}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="category"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: "var(--secondary)", opacity: 0.3 }}
                />
                <Bar dataKey="count" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Innovation distribution">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dist}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="range" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: "var(--secondary)", opacity: 0.3 }}
                />
                <Bar dataKey="count" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Similarity clusters">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={clusters}
                  dataKey="count"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={85}
                  paddingAngle={3}
                >
                  {clusters.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11, color: "var(--muted-foreground)" }} />
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Signal vs presentation (gems sit bottom-right)">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  type="number"
                  dataKey="presentation"
                  name="Presentation"
                  domain={[40, 100]}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                />
                <YAxis
                  type="number"
                  dataKey="signal"
                  name="Signal"
                  domain={[50, 100]}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                />
                <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: "3 3" }} />
                <Scatter data={spread} fill="var(--chart-3)" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Category saturation">
          <div className="space-y-4">
            {sat.map((d) => (
              <div key={d.category}>
                <div className="flex justify-between text-sm">
                  <span>{d.category}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {d.count} projects · {d.saturation}%
                  </span>
                </div>
                <Progress value={d.saturation} className="mt-2" />
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Progress & gems">
          <div className="space-y-6">
            <div>
              <div className="flex justify-between text-sm">
                <span>Judging progress</span>
                <span className="tabular-nums text-muted-foreground">
                  {reviewed}/{submissions.length}
                </span>
              </div>
              <Progress
                value={Math.round((reviewed / Math.max(submissions.length, 1)) * 100)}
                className="mt-2"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-secondary/40 p-4 text-center">
                <p className="font-display text-3xl font-semibold tabular-nums">
                  {gemCount(submissions)}
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  Hidden gems
                </p>
              </div>
              <div className="rounded-xl bg-secondary/40 p-4 text-center">
                <p className="font-display text-3xl font-semibold tabular-nums">{cats.length}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  Active categories
                </p>
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
