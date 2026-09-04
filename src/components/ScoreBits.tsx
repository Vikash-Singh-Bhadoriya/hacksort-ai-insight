import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

export function ScoreBar({ label, value }: { label: string; value: number }) {
  const tone =
    value >= 85
      ? "bg-success"
      : value >= 70
        ? "bg-primary"
        : value >= 55
          ? "bg-cyan"
          : "bg-warning";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{value}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary/70">
        <div
          className={cn("h-full rounded-full transition-all duration-700", tone)}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

export function GemBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-warning/40 bg-warning/10 px-2.5 py-0.5 text-[11px] font-medium text-warning",
        className,
      )}
    >
      <Sparkles className="h-3 w-3" /> Potential Hidden Gem
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="glass glass-hover rounded-2xl p-5">
      <div className="flex items-start justify-between">
        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <p className="mt-3 font-display text-3xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function AiNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-primary/25 bg-primary/8 p-4 text-sm leading-relaxed text-foreground/90">
      <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-primary">
        <Sparkles className="h-3.5 w-3.5" /> AI reasoning
      </p>
      {children}
    </div>
  );
}

export function HumanLoopNote({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      AI recommendation — final decision remains with the judge.
    </p>
  );
}
