import { Link } from "@tanstack/react-router";
import { Waves } from "lucide-react";

export function Brand({ to = "/", subtitle }: { to?: string; subtitle?: string }) {
  return (
    <Link to={to} className="group flex items-center gap-3">
      <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-primary/15 ring-1 ring-primary/40 transition-transform group-hover:scale-105">
        <Waves className="h-4.5 w-4.5 text-primary" />
        <span className="absolute inset-0 rounded-xl bg-primary/25 blur-lg" />
      </span>
      <span className="leading-tight">
        <span className="block font-display text-base font-semibold tracking-tight">
          HackSort <span className="text-gradient">AI</span>
        </span>
        {subtitle ? (
          <span className="block text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            {subtitle}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
