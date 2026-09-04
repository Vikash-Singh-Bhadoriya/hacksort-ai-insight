import { useState } from "react";
import { RefreshCw, SlidersHorizontal, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import {
  DEFAULT_WEIGHTS,
  weightTotal,
  isCustomWeights,
  normalizeWeights,
  type JudgeWeights,
} from "@/lib/scoring";

const CRITERIA: { key: keyof JudgeWeights; label: string; description: string }[] = [
  { key: "innovation", label: "Innovation", description: "Novelty of the approach" },
  { key: "impact", label: "Impact", description: "Real-world value and reach" },
  { key: "technical", label: "Technical Strength", description: "Engineering depth and execution" },
  {
    key: "feasibility",
    label: "Feasibility",
    description: "Deliverability within realistic constraints",
  },
  { key: "presentation", label: "Presentation", description: "Clarity and communication quality" },
];

function WeightSlider({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <div>
          <span className="font-medium">{label}</span>
          <span className="ml-2 text-xs text-muted-foreground">{description}</span>
        </div>
        <span className="tabular-nums text-primary font-semibold w-8 text-right">{value}%</span>
      </div>
      <Slider
        className="mt-2"
        value={[value]}
        min={0}
        max={100}
        step={1}
        onValueChange={(v) => onChange(v[0] ?? value)}
      />
    </div>
  );
}

export function CriteriaPanel() {
  const { judgeWeights, setJudgeWeights } = useStore();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<JudgeWeights>(judgeWeights);

  const total = weightTotal(draft);
  const isValid = total === 100;
  const isModified =
    draft.innovation !== judgeWeights.innovation ||
    draft.impact !== judgeWeights.impact ||
    draft.technical !== judgeWeights.technical ||
    draft.feasibility !== judgeWeights.feasibility ||
    draft.presentation !== judgeWeights.presentation;
  const custom = isCustomWeights(judgeWeights);

  const updateDraft = (key: keyof JudgeWeights, v: number) => {
    setDraft((prev) => ({ ...prev, [key]: v }));
  };

  const handleApply = () => {
    const normalized = normalizeWeights(draft);
    setDraft(normalized);
    setJudgeWeights(normalized);
    setOpen(false);
  };

  const handleReset = () => {
    setDraft(DEFAULT_WEIGHTS);
    setJudgeWeights(DEFAULT_WEIGHTS);
  };

  const handleNormalize = () => {
    const normalized = normalizeWeights(draft);
    setDraft(normalized);
  };

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <button
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-white/5 transition-colors"
        onClick={() => {
          if (!open) setDraft(judgeWeights);
          setOpen((v) => !v);
        }}
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <SlidersHorizontal className="h-4 w-4 text-primary shrink-0" />
          <div>
            <p className="text-sm font-medium">Judging Criteria</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {custom ? (
                <span className="text-primary">Custom weights active</span>
              ) : (
                "Default weights · click to configure"
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {custom && (
            <div className="hidden sm:flex gap-1.5 flex-wrap">
              {CRITERIA.map((c) => (
                <span
                  key={c.key}
                  className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary tabular-nums"
                >
                  {c.label.replace(" Strength", "").replace("ibility", ".")} {judgeWeights[c.key]}%
                </span>
              ))}
            </div>
          )}
          {open ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {open && (
        <div className="border-t border-border/60 px-5 pb-5 pt-4 space-y-5">
          <p className="text-xs text-muted-foreground">
            Adjust how each criterion contributes to the composite score. Rankings update
            immediately when you apply new weights.
            <br />
            <span className="text-foreground/60">
              Note: weights should total 100%. Use "Normalize" to auto-balance.
            </span>
          </p>

          {CRITERIA.map((c) => (
            <WeightSlider
              key={c.key}
              label={c.label}
              description={c.description}
              value={draft[c.key]}
              onChange={(v) => updateDraft(c.key, v)}
            />
          ))}

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Total:</span>
              <span
                className={cn(
                  "text-sm font-semibold tabular-nums",
                  isValid ? "text-success" : "text-destructive",
                )}
              >
                {total}%
              </span>
              {!isValid && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs px-2"
                  onClick={handleNormalize}
                >
                  Normalize to 100%
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={handleReset} className="text-xs gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" /> Reset
              </Button>
              <Button
                size="sm"
                onClick={handleApply}
                disabled={!isModified && !isValid}
                className="text-xs"
              >
                Apply weights
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground/70 border-t border-border/40 pt-3">
            Rankings reflect the criteria currently configured by the judge. AI signal scores are
            unchanged — weights only affect how those signals are combined.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Compact inline weight summary for use in Compare and other pages.
 */
export function WeightSummaryBadge() {
  const { judgeWeights } = useStore();
  const custom = isCustomWeights(judgeWeights);
  if (!custom) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-muted-foreground">Active weights:</span>
      {CRITERIA.map((c) => (
        <span
          key={c.key}
          className="rounded-full bg-primary/10 px-2 py-0.5 text-primary tabular-nums"
        >
          {c.label.split(" ")[0]} {judgeWeights[c.key]}%
        </span>
      ))}
    </div>
  );
}
