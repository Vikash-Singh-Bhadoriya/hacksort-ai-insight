import { Link } from "@tanstack/react-router";
import { Brand } from "./Brand";
import { cn } from "@/lib/utils";

const roles = [
  { label: "Participant", to: "/participant" },
  { label: "Judge", to: "/judge-login" },
  { label: "Organizer", to: "/organizer-login" },
] as const;

export function SiteNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Brand />
        <nav className="flex items-center gap-1 rounded-full border border-border/70 bg-secondary/40 p-1 text-sm">
          {roles.map((r) => (
            <Link
              key={r.to}
              to={r.to}
              className={cn(
                "rounded-full px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground sm:px-4",
                "data-[status=active]:bg-primary/20 data-[status=active]:text-foreground",
              )}
              activeProps={{ "data-status": "active" }}
            >
              {r.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
