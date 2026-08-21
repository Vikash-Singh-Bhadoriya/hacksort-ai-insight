import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { Brand } from "./Brand";
import { SiteNav } from "./SiteNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useStore, type Role } from "@/lib/store";
import { DEMO_CREDENTIALS } from "@/lib/data";

export function LoginForm({
  role,
  title,
  blurb,
  redirectTo,
}: {
  role: Role;
  title: string;
  blurb: string;
  redirectTo: string;
}) {
  const creds = DEMO_CREDENTIALS[role];
  const { signIn } = useStore();
  const navigate = useNavigate();
  const [email, setEmail] = useState(creds.email);
  const [password, setPassword] = useState(creds.password);
  const [remember, setRemember] = useState(true);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    window.setTimeout(() => {
      if (email.trim().toLowerCase() === creds.email && password === creds.password) {
        signIn(role, email.trim().toLowerCase());
        toast.success(`Signed in as ${role}`);
        navigate({ to: redirectTo });
      } else {
        setError("Invalid credentials. Use the demo account shown below.");
        setBusy(false);
      }
    }, 550);
  };

  return (
    <div className="min-h-screen">
      <SiteNav />
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center">
        <div className="animate-rise hidden lg:block">
          <Brand subtitle="Judging intelligence" />
          <h1 className="mt-8 font-display text-4xl font-semibold leading-tight">
            See beyond the <span className="text-gradient">submission</span>.
          </h1>
          <p className="mt-4 max-w-md text-muted-foreground">{blurb}</p>
          <ul className="mt-8 space-y-3 text-sm text-muted-foreground">
            <li>• Structured signals with written reasoning</li>
            <li>• Semantic clusters and duplication view</li>
            <li>• Hidden-gem recommendations, never auto-decisions</li>
          </ul>
        </div>

        <div className="glass animate-rise mx-auto w-full max-w-md rounded-3xl p-8">
          <div className="lg:hidden">
            <Brand />
          </div>
          <h2 className="mt-6 font-display text-2xl font-semibold lg:mt-0">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to continue to your workspace.</p>

          <form className="mt-7 space-y-5" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-muted-foreground">
                <Checkbox checked={remember} onCheckedChange={(v) => setRemember(Boolean(v))} />
                Remember me
              </label>
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() =>
                  toast.info("Demo environment", {
                    description: `Reset link simulated. Use ${creds.email} / ${creds.password}.`,
                  })
                }
              >
                Forgot password?
              </button>
            </div>

            {error ? (
              <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={busy}>
              <LogIn className="mr-2 h-4 w-4" />
              {busy ? "Signing in…" : "Sign In"}
            </Button>
          </form>

          <div className="mt-6 rounded-xl border border-border/70 bg-secondary/30 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground/85">Demo credentials</p>
            <p className="mt-1">
              {creds.email} · {creds.password}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
