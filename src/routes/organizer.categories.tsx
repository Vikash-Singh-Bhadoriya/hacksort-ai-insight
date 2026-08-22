import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/WorkspaceShell";
import { AiNote } from "@/components/ScoreBits";
import { Progress } from "@/components/ui/progress";
import { useStore } from "@/lib/store";
import { overallSignal } from "@/lib/data";
import { saturation } from "@/lib/analytics";

export const Route = createFileRoute("/organizer/categories")({
  component: CategoriesPage,
});

function CategoriesPage() {
  const { submissions } = useStore();
  const sat = saturation(submissions);

  return (
    <div>
      <PageHeader title="Categories" lead="Track saturation, average signal and where the competition is thickest." />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sat.map((c) => {
          const subs = submissions.filter((s) => s.category === c.category);
          const avg = Math.round(subs.reduce((n, s) => n + overallSignal(s.scores), 0) / Math.max(subs.length, 1));
          return (
            <div key={c.category} className="glass glass-hover rounded-2xl p-5">
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-lg font-semibold">{c.category}</h2>
                <span className="text-sm tabular-nums text-muted-foreground">{c.count} projects</span>
              </div>
              <p className="mt-4 text-xs uppercase tracking-[0.14em] text-muted-foreground">Saturation</p>
              <Progress className="mt-2 h-1.5" value={c.saturation} />
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Average signal</span>
                <span className="font-medium tabular-nums">{avg}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6">
        <AiNote>
          <p>
            {sat[0]?.category} is the most saturated track at {sat[0]?.saturation}% relative density, so novelty there is
            harder to demonstrate. Thinner tracks like {sat[sat.length - 1]?.category} carry fewer comparables — judge
            them on absolute merit rather than rank within the track.
          </p>
        </AiNote>
      </div>
    </div>
  );
}
