import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Brain,
  Layers,
  Gem,
  GitCompare,
  ShieldCheck,
  Timer,
  Users,
  ScanSearch,
  Workflow,
  LineChart,
  AlertTriangle,
  Scale,
} from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { HumanLoopNote } from "@/components/ScoreBits";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HackSort AI — See beyond the submission" },
      {
        name: "description",
        content:
          "HackSort AI is judging intelligence for hackathons: semantic clustering, hidden-gem detection and structured evaluation that keeps humans in the loop.",
      },
      { property: "og:title", content: "HackSort AI — See beyond the submission" },
      {
        property: "og:description",
        content:
          "AI-powered judging intelligence for faster, smarter and more structured hackathon evaluation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const problems = [
  {
    icon: Timer,
    title: "Too many submissions, too little time",
    body: "A judge reviewing 200 projects in a weekend gives each one about four minutes. Depth is the first casualty.",
  },
  {
    icon: Layers,
    title: "Invisible duplication",
    body: "Dozens of teams converge on the same idea. Without a semantic view, judges can't tell novelty from repetition.",
  },
  {
    icon: AlertTriangle,
    title: "Presentation beats substance",
    body: "Polished decks win attention. Deep technical work with a rough pitch gets filtered out in the first pass.",
  },
  {
    icon: Scale,
    title: "Inconsistent scoring",
    body: "Different judges apply different bars, and there is no shared record of why a project scored the way it did.",
  },
];

const steps = [
  {
    icon: ScanSearch,
    title: "1 — Ingest & structure",
    body: "Every submission is parsed into a common shape: problem, solution, stack, team, category and presentation assets.",
  },
  {
    icon: Brain,
    title: "2 — Analyse & score",
    body: "Signals for innovation, impact, technical strength, feasibility and presentation quality — each with written reasoning.",
  },
  {
    icon: Layers,
    title: "3 — Cluster by meaning",
    body: "Semantic similarity groups the pool into themes and surfaces highly similar pairs so judges see saturation instantly.",
  },
  {
    icon: Gem,
    title: "4 — Surface hidden gems",
    body: "Projects with high substance but weak packaging are flagged for a deliberate second look.",
  },
  {
    icon: Users,
    title: "5 — Judges decide",
    body: "Humans score, annotate, shortlist and flag. HackSort AI never picks a winner.",
  },
];

const features = [
  { icon: Layers, title: "Similarity clusters", body: "Thematic grouping with similarity percentages, shared technologies and cluster drill-down." },
  { icon: Gem, title: "Hidden gem detection", body: "High innovation, impact and technical potential paired with low presentation quality gets flagged, not buried." },
  { icon: GitCompare, title: "Side-by-side comparison", body: "Compare two to four projects across every axis with AI-generated comparison insights." },
  { icon: Brain, title: "Explained scoring", body: "Every score comes with reasoning, strengths and risks in plain language — never a bare number." },
  { icon: Workflow, title: "Structured evaluation", body: "Manual scoring, notes, reviewed state, shortlist and flags in one consistent workflow." },
  { icon: LineChart, title: "Judging analytics", body: "Category saturation, innovation distribution, progress per judge and gem counts for organizers." },
];

const why = [
  { stat: "4×", label: "faster first-pass triage", body: "Structured signals replace re-reading raw decks." },
  { stat: "0", label: "auto-selected winners", body: "The platform recommends; the panel decides." },
  { stat: "100%", label: "traceable reasoning", body: "Every recommendation is explained and auditable." },
];

function Section({
  id,
  eyebrow,
  title,
  lead,
  children,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6">
      <p className="text-xs font-medium uppercase tracking-[0.24em] text-primary">{eyebrow}</p>
      <h2 className="mt-3 max-w-3xl font-display text-3xl font-semibold sm:text-4xl">{title}</h2>
      {lead ? <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">{lead}</p> : null}
      <div className="mt-10">{children}</div>
    </section>
  );
}

function Landing() {
  return (
    <div className="min-h-screen">
      <SiteNav />

      <section className="relative mx-auto w-full max-w-7xl px-4 pb-16 pt-20 sm:px-6 sm:pt-28">
        <div className="animate-rise max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-secondary/40 px-3 py-1 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Human-in-the-loop judging intelligence
          </span>
          <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.05] sm:text-7xl">
            HackSort <span className="text-gradient">AI</span>
          </h1>
          <p className="mt-5 font-display text-2xl text-foreground/90 sm:text-3xl">
            “See beyond the submission.”
          </p>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            AI-powered judging intelligence for faster, smarter and more structured hackathon evaluation.
          </p>
          <p className="mt-8 max-w-2xl border-l-2 border-primary/50 pl-4 text-base italic text-foreground/80">
            Don't judge the pitch alone. Discover the potential behind it.
          </p>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { k: "Submissions structured", v: "24" },
            { k: "Semantic clusters", v: "6" },
            { k: "Hidden gems surfaced", v: "8" },
            { k: "Decisions automated", v: "0" },
          ].map((s, i) => (
            <div key={s.k} className="glass glass-hover animate-rise rounded-2xl p-5" style={{ animationDelay: `${i * 80}ms` }}>
              <p className="font-display text-3xl font-semibold tabular-nums">{s.v}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">{s.k}</p>
            </div>
          ))}
        </div>
      </section>

      <Section
        eyebrow="The Problem"
        title="Hackathon judging breaks down at scale"
        lead="The bottleneck is not effort — it is attention. When a panel has hundreds of submissions and a single afternoon, the evaluation quietly stops measuring what it intended to measure."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          {problems.map((p) => (
            <div key={p.title} className="glass glass-hover rounded-2xl p-6">
              <p.icon className="h-5 w-5 text-violet" />
              <h3 className="mt-4 text-lg font-semibold">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        eyebrow="How HackSort AI Works"
        title="Five stages, from raw submissions to a defensible decision"
        lead="Each stage produces something a judge can read, question and override."
      >
        <ol className="grid gap-5 md:grid-cols-3 lg:grid-cols-5">
          {steps.map((s) => (
            <li key={s.title} className="glass glass-hover rounded-2xl p-6">
              <s.icon className="h-5 w-5 text-primary" />
              <h3 className="mt-4 text-sm font-semibold uppercase tracking-[0.1em] text-foreground/90">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section eyebrow="Core Features" title="Everything a judging panel actually uses">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="glass glass-hover rounded-2xl p-6">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/12 ring-1 ring-primary/25">
                <f.icon className="h-5 w-5 text-primary" />
              </span>
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        eyebrow="Human-in-the-loop judging"
        title="The AI narrows attention. The panel makes the call."
        lead="HackSort AI is deliberately built without an automatic winner. Its output is a ranked set of things worth a human's next ten minutes."
      >
        <div className="glass rounded-3xl p-8 sm:p-10">
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <h3 className="text-lg font-semibold">What the AI does</h3>
              <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                <li>• Structures and summarises every submission consistently</li>
                <li>• Scores five signals and explains each in writing</li>
                <li>• Groups the pool semantically and exposes duplication</li>
                <li>• Flags substance hidden behind weak presentation</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold">What only humans do</h3>
              <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                <li>• Award, shortlist and reject</li>
                <li>• Weigh context the model cannot see — the room, the team, the demo</li>
                <li>• Override any AI signal, with the override recorded</li>
                <li>• Own the final result</li>
              </ul>
            </div>
          </div>
          <div className="mt-8 rounded-xl border border-primary/25 bg-primary/8 p-4">
            <HumanLoopNote className="text-sm text-foreground/85" />
          </div>
        </div>
      </Section>

      <Section eyebrow="Why HackSort AI matters" title="Better decisions, not just faster ones">
        <div className="grid gap-5 sm:grid-cols-3">
          {why.map((w) => (
            <div key={w.label} className="glass glass-hover rounded-2xl p-6">
              <p className="font-display text-4xl font-semibold text-gradient">{w.stat}</p>
              <p className="mt-2 text-sm font-medium">{w.label}</p>
              <p className="mt-2 text-sm text-muted-foreground">{w.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 max-w-3xl text-base leading-relaxed text-muted-foreground">
          A hackathon's credibility rests on whether the best work was actually seen. HackSort AI makes the
          review path explicit: what was read, what was compared, what was flagged and why — so results can be
          explained to participants, sponsors and the panel itself.
        </p>
      </Section>

      <footer className="border-t border-border/60 py-10">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>HackSort AI — judging intelligence for hackathons.</p>
          <div className="flex gap-5">
            <Link to="/participant" className="hover:text-foreground">Participant</Link>
            <Link to="/judge-login" className="hover:text-foreground">Judge</Link>
            <Link to="/organizer-login" className="hover:text-foreground">Organizer</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
