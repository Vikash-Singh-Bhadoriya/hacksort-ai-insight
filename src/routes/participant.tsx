import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  FileUp,
  MapPin,
  Trophy,
  UserPlus,
  X,
} from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStore } from "@/lib/store";
import { CATEGORIES, HACKATHON, overallSignal, type Category, type Submission } from "@/lib/data";

export const Route = createFileRoute("/participant")({
  head: () => ({
    meta: [
      { title: "Participant — HackSort AI" },
      {
        name: "description",
        content: "Join GlobalHack 2026, submit your project and track its status.",
      },
      { property: "og:title", content: "Participant — HackSort AI" },
      {
        property: "og:description",
        content: "Register, submit a project and track review status.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Participant,
});

const emptyForm = {
  name: "",
  team: "",
  category: "" as Category | "",
  problem: "",
  solution: "",
  stack: "",
  deckUrl: "",
};

function Participant() {
  const { submissions, addSubmission } = useStore();
  const [registered, setRegistered] = useState(false);
  const [profile, setProfile] = useState({ name: "", email: "", team: "" });
  const [members, setMembers] = useState<string[]>([]);
  const [memberInput, setMemberInput] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [mine, setMine] = useState<string[]>([]);
  const [tab, setTab] = useState("info");

  const mySubs = useMemo(() => submissions.filter((s) => mine.includes(s.id)), [submissions, mine]);

  const register = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile.name || !profile.email || !profile.team) return;
    setRegistered(true);
    setForm((f) => ({ ...f, team: profile.team }));
    toast.success(`Welcome, ${profile.name}!`, {
      description: `Team ${profile.team} is registered.`,
    });
    setTab("submit");
  };

  const addMember = () => {
    const v = memberInput.trim();
    if (!v) return;
    setMembers((m) => [...m, v]);
    setMemberInput("");
  };

  const submitProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.category) {
      toast.error("Select a category before submitting.");
      return;
    }
    const stack = form.stack
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const clusterFor: Record<string, string> = {
      Healthcare: "healthcare-ai",
      Agriculture: "smart-farming",
      Education: "learning-systems",
      "AI/ML": "learning-systems",
      Cybersecurity: "doc-intel",
      FinTech: "doc-intel",
    };
    const scores = {
      innovation: 72 + ((form.solution.length + form.problem.length) % 18),
      impact: 70 + (form.problem.length % 20),
      technical: 68 + ((stack.length * 4) % 22),
      feasibility: 71 + (form.solution.length % 17),
      presentation: form.deckUrl ? 74 + (form.name.length % 14) : 52,
    };
    const sub: Submission = {
      id: `u${Date.now()}`,
      name: form.name,
      team: form.team || profile.team,
      members: members.length ? members : [profile.name].filter(Boolean),
      category: form.category,
      problem: form.problem,
      solution: form.solution,
      stack: stack.length ? stack : ["Not specified"],
      deckUrl: form.deckUrl,
      scores,
      reasoning:
        "Freshly ingested submission. Signals below are a first-pass estimate from the structured fields provided; they will refine once the demo assets are parsed.",
      strengths: ["Clearly scoped problem statement", `Categorised under ${form.category}`],
      risks: form.deckUrl ? ["Awaiting demo verification"] : ["No presentation link provided"],
      cluster: clusterFor[form.category] ?? "open-labs",
      status: "Submitted",
      submittedAt: new Date().toISOString(),
    };
    addSubmission(sub);
    setMine((m) => [...m, sub.id]);
    setForm({ ...emptyForm, team: sub.team });
    toast.success("Submission received", {
      description: `${sub.name} filed under ${sub.category}.`,
    });
    setTab("status");
  };

  return (
    <div className="min-h-screen">
      <SiteNav />
      <main className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <div className="animate-rise">
          <Badge className="bg-primary/15 text-primary hover:bg-primary/20">
            Participant experience
          </Badge>
          <h1 className="mt-4 font-display text-4xl font-semibold">{HACKATHON.name}</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">{HACKATHON.theme}</p>
          <div className="mt-5 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              {HACKATHON.dates}
            </span>
            <span className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              {HACKATHON.venue}
            </span>
            <span className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              {HACKATHON.prize}
            </span>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="mt-10">
          <TabsList className="bg-secondary/40">
            <TabsTrigger value="info">Hackathon info</TabsTrigger>
            <TabsTrigger value="register">Register</TabsTrigger>
            <TabsTrigger value="submit">Submit project</TabsTrigger>
            <TabsTrigger value="status">My submissions</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="mt-6 grid gap-5 lg:grid-cols-2">
            <div className="glass rounded-2xl p-6">
              <h2 className="text-lg font-semibold">Timeline</h2>
              <ol className="mt-4 space-y-4">
                {HACKATHON.timeline.map((t) => (
                  <li key={t.t} className="flex gap-3">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div>
                      <p className="text-sm font-medium">{t.label}</p>
                      <p className="text-xs text-muted-foreground">{t.t}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="glass rounded-2xl p-6">
              <h2 className="text-lg font-semibold">Rules & categories</h2>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                {HACKATHON.rules.map((r) => (
                  <li key={r}>• {r}</li>
                ))}
              </ul>
              <div className="mt-5 flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <Badge
                    key={c}
                    variant="outline"
                    className="border-border/70 text-muted-foreground"
                  >
                    {c}
                  </Badge>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="register" className="mt-6">
            <div className="glass max-w-xl rounded-2xl p-6">
              {registered ? (
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" />
                  <div>
                    <p className="font-medium">You're registered</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {profile.name} · {profile.email} · Team {profile.team}
                    </p>
                    <Button className="mt-4" onClick={() => setTab("submit")}>
                      Go to submission form
                    </Button>
                  </div>
                </div>
              ) : (
                <form className="space-y-4" onSubmit={register}>
                  <h2 className="text-lg font-semibold">Join the hackathon</h2>
                  <div className="space-y-2">
                    <Label htmlFor="pname">Full name</Label>
                    <Input
                      id="pname"
                      value={profile.name}
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pemail">Email</Label>
                    <Input
                      id="pemail"
                      type="email"
                      value={profile.email}
                      onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pteam">Team name</Label>
                    <Input
                      id="pteam"
                      value={profile.team}
                      onChange={(e) => setProfile({ ...profile, team: e.target.value })}
                      required
                    />
                  </div>
                  <Button type="submit">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Register
                  </Button>
                </form>
              )}
            </div>
          </TabsContent>

          <TabsContent value="submit" className="mt-6">
            <form
              className="glass grid gap-5 rounded-2xl p-6 lg:grid-cols-2"
              onSubmit={submitProject}
            >
              <div className="space-y-2">
                <Label htmlFor="proj">Project name</Label>
                <Input
                  id="proj"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="team">Team</Label>
                <Input
                  id="team"
                  value={form.team}
                  onChange={(e) => setForm({ ...form, team: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v as Category })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Your submission is routed to this track exactly as chosen.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="deck">Presentation / PPT link</Label>
                <Input
                  id="deck"
                  placeholder="https://…"
                  value={form.deckUrl}
                  onChange={(e) => setForm({ ...form, deckUrl: e.target.value })}
                />
              </div>

              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="prob">Problem statement</Label>
                <Textarea
                  id="prob"
                  rows={3}
                  value={form.problem}
                  onChange={(e) => setForm({ ...form, problem: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="sol">Proposed solution</Label>
                <Textarea
                  id="sol"
                  rows={3}
                  value={form.solution}
                  onChange={(e) => setForm({ ...form, solution: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="stack">Technology stack (comma separated)</Label>
                <Input
                  id="stack"
                  placeholder="React, Python, PyTorch"
                  value={form.stack}
                  onChange={(e) => setForm({ ...form, stack: e.target.value })}
                />
              </div>

              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="member">Team members</Label>
                <div className="flex gap-2">
                  <Input
                    id="member"
                    value={memberInput}
                    placeholder="Add a member and press Add"
                    onChange={(e) => setMemberInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addMember();
                      }
                    }}
                  />
                  <Button type="button" variant="secondary" onClick={addMember}>
                    Add
                  </Button>
                </div>
                {members.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {members.map((m, i) => (
                      <span
                        key={`${m}-${i}`}
                        className="flex items-center gap-1 rounded-full border border-border/70 bg-secondary/40 px-3 py-1 text-xs"
                      >
                        {m}
                        <button
                          type="button"
                          onClick={() => setMembers(members.filter((_, j) => j !== i))}
                          aria-label={`Remove ${m}`}
                        >
                          <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="lg:col-span-2">
                <Button type="submit">
                  <FileUp className="mr-2 h-4 w-4" />
                  Submit project
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="status" className="mt-6">
            {mySubs.length === 0 ? (
              <div className="glass rounded-2xl p-10 text-center">
                <p className="font-medium">No submissions yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Once you submit a project it appears here with its live review status.
                </p>
                <Button className="mt-5" onClick={() => setTab("submit")}>
                  Submit a project
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {mySubs.map((s) => (
                  <div key={s.id} className="glass glass-hover rounded-2xl p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold">{s.name}</h3>
                        <p className="text-sm text-muted-foreground">{s.team}</p>
                      </div>
                      <Badge className="bg-primary/15 text-primary hover:bg-primary/20">
                        {s.category}
                      </Badge>
                    </div>
                    <p className="mt-4 text-sm text-muted-foreground line-clamp-3">{s.solution}</p>
                    <div className="mt-4 flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4" /> {s.status}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        Signal {overallSignal(s.scores)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
