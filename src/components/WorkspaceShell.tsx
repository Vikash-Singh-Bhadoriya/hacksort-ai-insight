import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { Brand } from "./Brand";
import { DemoResetButton } from "./DemoReset";
import { Button } from "@/components/ui/button";
import { useStore, type Role } from "@/lib/store";
import { cn } from "@/lib/utils";

export type NavItem = {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
};

export function WorkspaceShell({
  role,
  subtitle,
  nav,
  children,
}: {
  role: Role;
  subtitle: string;
  nav: NavItem[];
  children: React.ReactNode;
}) {
  const { session, signOut, hydrated } = useStore();
  const navigate = useNavigate();

  if (!hydrated) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="glass rounded-2xl px-8 py-6 text-sm text-muted-foreground">
          Loading workspace…
        </div>
      </div>
    );
  }

  if (!session || session.role !== role) {
    return (
      <div className="grid min-h-screen place-items-center px-4">
        <div className="glass max-w-md rounded-2xl p-8 text-center">
          <Brand />
          <h1 className="mt-6 font-display text-xl font-semibold">Sign in required</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This {role} workspace is protected. Sign in with the demo account to continue.
          </p>
          <Button
            className="mt-6"
            onClick={() => navigate({ to: role === "judge" ? "/judge-login" : "/organizer-login" })}
          >
            Go to {role} login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen lg:flex">
      <aside className="border-b border-border/60 bg-background/60 backdrop-blur-xl lg:h-screen lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r lg:sticky lg:top-0">
        <div className="flex h-16 items-center px-5">
          <Brand subtitle={subtitle} />
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible lg:pb-0">
          {nav.map((n) => (
            <Link
              key={String(n.to)}
              to={n.to}
              activeOptions={{ exact: n.label === "Dashboard" }}
              className={cn(
                "flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground",
              )}
              activeProps={{ className: "bg-primary/15 text-foreground ring-1 ring-primary/30" }}
            >
              <n.icon className="h-4 w-4" />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden px-5 py-6 lg:block">
          <p className="text-xs text-muted-foreground">Signed in</p>
          <p className="truncate text-sm">{session.email}</p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 px-0 text-muted-foreground hover:text-foreground"
            onClick={() => {
              signOut();
              navigate({ to: "/" });
            }}
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
          <div className="mt-2">
            <DemoResetButton />
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-8 sm:px-8">{children}</main>
    </div>
  );
}

export function PageHeader({
  title,
  lead,
  actions,
}: {
  title: string;
  lead?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="animate-rise mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-semibold">{title}</h1>
        {lead ? <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{lead}</p> : null}
      </div>
      {actions}
    </div>
  );
}
