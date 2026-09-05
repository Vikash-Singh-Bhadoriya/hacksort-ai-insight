<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

# HackSort AI — Agent Instructions

## 1. Project Overview

HackSort AI is a client-side prototype for AI-powered hackathon judging intelligence. The tagline is "See beyond the submission." It is a demonstration-oriented application with no backend; all data lives in the browser.

### Roles

| Role | Entry point | Purpose |
|------|-------------|---------|
| **Participant** | `/participant` | Register for the hackathon, submit a project (name, team, problem, solution, tech stack, deck link), and view submission status. No login required. |
| **Judge** | `/judge-login` → `/judge/*` | The core product experience. Browse submissions, configure scoring criteria, review project detail with AI signals, compare projects side-by-side, explore similarity clusters, identify hidden gems, save evaluations (scores, notes, shortlist, flag). Protected by demo credentials. |
| **Organizer** | `/organizer-login` → `/organizer/*` | Administrative overview: submission table, judge progress, category breakdown, provisional results, CSV export, invite judges (demo-only). Protected by demo credentials. |

The **judge workflow** is the core product experience. Everything else supports or demonstrates it.

### Demo credentials

Defined in `src/lib/data.ts` as `DEMO_CREDENTIALS`:

- Judge: `judge@hacksort.ai` / `judge123`
- Organizer: `organizer@hacksort.ai` / `organizer123`

## 2. Technology Stack

All of the following are confirmed present in `package.json` and source code:

| Layer | Technology | Version / Notes |
|-------|-----------|-----------------|
| Framework | TanStack Start (`@tanstack/react-start`) | 1.168.x — file-based routing with SSR entry, but the app is effectively an SPA with all state client-side |
| React | React 19 (`react`, `react-dom`) | ^19.2.0 |
| Language | TypeScript | ^5.8.3 — strict mode enabled, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true` |
| Router | TanStack Router (`@tanstack/react-router`) | 1.170.x — file-based routing under `src/routes/` with auto-generated `routeTree.gen.ts` |
| State management | React Context + `useState` | Single `StoreProvider` in `src/lib/store.tsx` — no Redux, Zustand or external state library |
| Styling | Tailwind CSS v4 | ^4.2.1 with `tw-animate-css`, custom CSS variables in `src/styles.css`, dark-only theme using oklch colors |
| UI components | shadcn/ui (new-york style) | Radix UI primitives in `src/components/ui/`, configured via `components.json` |
| Icons | Lucide React | ^0.575.0 |
| Charts | Recharts | ^2.15.4 |
| Toast notifications | Sonner | ^2.0.7 |
| Form validation | React Hook Form + Zod | Present in dependencies; used in participant submission |
| CSS utility | `clsx` + `tailwind-merge` | Via `cn()` in `src/lib/utils.ts` |
| Build tool | Vite | 8.1.5 via `@lovable.dev/vite-tanstack-config` |
| Package manager | bun (lockfile present) | `bun.lock` in root; npm also works (`package-lock.json` present) |
| Persistence | `localStorage` | Key: `hacksort-state-v2` — no server, no database |
| Testing | None | No test runner, test files or testing dependencies are present |

Technologies **not** present: Firebase, Supabase, any backend API, any database, any embedding model, any LLM, any AI/ML runtime, Redux, Zustand, Next.js.

## 3. Repository Structure

```
hacksort-ai-insight/
├── AGENTS.md                  # This file — agent instructions
├── README.md                  # Product overview and user guide
├── package.json               # Dependencies and scripts
├── bun.lock                   # Bun lockfile
├── tsconfig.json              # TypeScript strict config with path aliases
├── vite.config.ts             # Vite config via @lovable.dev/vite-tanstack-config
├── eslint.config.js           # ESLint flat config with prettier, react-hooks, typescript-eslint
├── .prettierrc                # Prettier: 100 char width, double quotes, trailing commas
├── components.json            # shadcn/ui configuration (new-york style)
├── src/
│   ├── routes/                # File-based route definitions (TanStack Router)
│   │   ├── __root.tsx         # Root layout: meta tags, fonts, StoreProvider, Toaster
│   │   ├── index.tsx          # Landing page with role selection
│   │   ├── participant.tsx    # Participant registration and submission
│   │   ├── judge-login.tsx    # Judge credential gate
│   │   ├── judge.tsx          # Judge layout: WorkspaceShell + nav items + Outlet
│   │   ├── judge.index.tsx    # Judge dashboard: stats, progress, recommended reviews
│   │   ├── judge.submissions.index.tsx  # Filterable submission grid + CriteriaPanel
│   │   ├── judge.submissions.$id.tsx    # Project detail: AI signals, composite score,
│   │   │                                  related submissions, evaluation form
│   │   ├── judge.clusters.index.tsx     # Cluster grid + legacy similar pairs list
│   │   ├── judge.clusters.$id.tsx       # Cluster detail: pairwise similarity table
│   │   ├── judge.gems.tsx               # Hidden gems: strong/weak dimension breakdown
│   │   ├── judge.compare.tsx            # Side-by-side comparison (2–4 projects)
│   │   ├── judge.evaluations.tsx        # Saved evaluations table
│   │   ├── judge.analytics.tsx          # Recharts panels for organizer/judge analytics
│   │   ├── organizer-login.tsx          # Organizer credential gate
│   │   ├── organizer.tsx                # Organizer layout
│   │   └── organizer.*.tsx              # Organizer sub-pages (index, submissions,
│   │                                      judges, categories, participants, results, analytics)
│   ├── components/
│   │   ├── ui/                # shadcn/ui primitives (do not hand-edit these)
│   │   ├── Brand.tsx          # Logo / wordmark
│   │   ├── CriteriaPanel.tsx  # Judge weight configurator (sliders, normalize, apply)
│   │   ├── DemoReset.tsx      # Reset button with confirmation dialog
│   │   ├── LoginForm.tsx      # Shared login form used by judge-login and organizer-login
│   │   ├── RelatedSubmissions.tsx  # Related projects with "Why similar?" breakdown
│   │   ├── ScoreBits.tsx      # ScoreBar, GemBadge, StatCard, AiNote, HumanLoopNote
│   │   ├── SiteNav.tsx        # Landing page navigation
│   │   ├── SubmissionCard.tsx  # Project card for grid views (shows composite or AI signal)
│   │   ├── WaveBackground.tsx  # Decorative SVG background on landing
│   │   └── WorkspaceShell.tsx  # Auth-guarded layout with sidebar nav + PageHeader
│   ├── lib/
│   │   ├── data.ts            # Type definitions, SEED_SUBMISSIONS (24 projects),
│   │   │                        CLUSTERS (6), SIMILAR_PAIRS (5 legacy pairs),
│   │   │                        JUDGES, HACKATHON, DEMO_CREDENTIALS, scoring re-exports
│   │   ├── scoring.ts         # ⚠ SINGLE SOURCE OF TRUTH for all scoring
│   │   ├── similarity.ts      # Deterministic similarity engine
│   │   ├── store.tsx          # StoreProvider: React Context, localStorage persistence
│   │   ├── analytics.ts       # Chart data helpers (byCategory, signalSpread, etc.)
│   │   ├── utils.ts           # cn() class name utility
│   │   ├── error-capture.ts   # Error boundary helpers
│   │   ├── error-page.ts      # Error page renderer
│   │   └── lovable-error-reporting.ts  # Lovable platform error integration
│   ├── hooks/
│   │   └── use-mobile.tsx     # Responsive breakpoint hook
│   ├── router.tsx             # TanStack Router + React Query client creation
│   ├── routeTree.gen.ts       # Auto-generated route tree (do NOT hand-edit)
│   ├── start.ts               # TanStack Start entry
│   ├── server.ts              # SSR error wrapper
│   └── styles.css             # Tailwind v4 theme: oklch tokens, glass utility,
│                                gradient, animations, font families
└── public/                    # Static assets
```

## 4. Application Architecture

### Data flow

```
SEED_SUBMISSIONS (data.ts)
  ↓ default state
StoreProvider (store.tsx)  ←→  localStorage ("hacksort-state-v2")
  ↓ React Context
useStore() hook
  ↓ consumed by
Routes & Components
```

### Key architectural facts

- **No backend.** All data is client-side. Submissions, evaluations, and session state live in `StoreProvider`.
- **Single store.** `src/lib/store.tsx` exposes `useStore()` — the only data access point. There are no additional stores, atoms or signals.
- **Seed data.** 24 hardcoded submissions in `SEED_SUBMISSIONS` with pre-assigned AI scores, cluster assignments, reasoning, strengths and risks. These simulate what a real AI pipeline would produce.
- **Participant submissions.** `addSubmission()` prepends to the front of the array. Participant-added projects receive deterministic pseudo-scores computed from string lengths — not from any AI model.
- **Evaluations.** Judge evaluation data (`scores`, `notes`, `reviewed`, `shortlisted`, `flagged`) is stored as `Record<string, Evaluation>` keyed by submission ID.
- **Compare tray.** The `compare: string[]` array stores submission IDs for the comparison view. It is intentionally **not** persisted to localStorage.
- **Judge weights.** `judgeWeights: JudgeWeights` is persisted alongside other state.
- **Session.** `{ role, email }` or `null`. Auth is demo-only; `WorkspaceShell` redirects to login if `session.role` does not match the workspace.
- **Hydration.** The store sets `hydrated = true` after reading localStorage. `WorkspaceShell` shows a loading screen while `hydrated` is false to prevent flash-of-redirect.

### Sources of truth

| Data | Source of truth |
|------|----------------|
| AI scores | `Submission.scores` (immutable per submission) |
| Scoring formula | `calculateCompositeScore()` in `src/lib/scoring.ts` |
| Hidden gem detection | `isHiddenGem()` in `src/lib/data.ts` |
| Similarity | `calculateSimilarity()` in `src/lib/similarity.ts` |
| Cluster assignments | `Submission.cluster` → `CLUSTERS` array in `src/lib/data.ts` |
| Judge weights | `judgeWeights` in the store |
| Evaluations | `evaluations` in the store |

## 5. Scoring Architecture

### AI Signal (fixed baseline)

The `overallSignal()` function in `src/lib/data.ts` calculates a fixed weighted average of the five AI-generated dimension scores:

```
overallSignal = round(
  innovation × 0.28 +
  impact     × 0.26 +
  technical  × 0.22 +
  feasibility × 0.14 +
  presentation × 0.10
)
```

This value never changes regardless of judge configuration. It represents what the (simulated) AI pipeline originally produced.

### Composite Score (judge-configurable)

`calculateCompositeScore(scores, weights)` in `src/lib/scoring.ts` is the **single source of truth** for all weighted scoring. It:

1. Accepts `Scores` (the 5 AI dimensions) and `JudgeWeights` (the judge's configuration).
2. Normalizes weights internally: each weight is divided by the sum of all weights.
3. Returns `round(Σ score_i × weight_i / total_weight)`.
4. Never mutates the input scores.
5. Handles degenerate case (all weights zero) by returning a simple average.

### Default weights

Defined in `src/lib/scoring.ts` as `DEFAULT_WEIGHTS`:

| Dimension | Default weight |
|-----------|---------------|
| Innovation | 28 |
| Impact | 26 |
| Technical | 22 |
| Feasibility | 14 |
| Presentation | 10 |
| **Total** | **100** |

When default weights are active, `calculateCompositeScore` produces the same value as `overallSignal`.

### Scoring utilities

| Function | Location | Purpose |
|----------|----------|---------|
| `calculateCompositeScore(scores, weights)` | `scoring.ts` | Central scoring function |
| `weightTotal(w)` | `scoring.ts` | Sum of weight values |
| `isCustomWeights(w)` | `scoring.ts` | True if weights differ from defaults |
| `normalizeWeights(w)` | `scoring.ts` | Scale weights to sum to 100 |
| `overallSignal(sc)` | `data.ts` | Fixed-weight legacy alias |
| `overallSignalFromScores(sc)` | `scoring.ts` | Deprecated alias for `calculateCompositeScore(sc, DEFAULT_WEIGHTS)` |

> [!CAUTION]
> Never duplicate the scoring formula. Any future scoring change must update
> `calculateCompositeScore()` in `src/lib/scoring.ts`. All other call sites
> delegate to this single function.

## 6. Similarity Architecture

### Implementation

The similarity engine in `src/lib/similarity.ts` is a **deterministic, rule-based, token-matching provider**. It does not use embeddings, vector databases or LLMs. It works entirely in the browser with no network calls.

### How it works

1. **Tokenization.** Text is lowercased, non-alphanumeric characters are replaced with spaces, tokens shorter than 3 characters and stop words are removed. The result is a `Set<string>`.

2. **Jaccard similarity.** For two token sets A and B: `|A ∩ B| / |A ∪ B| × 100`. Used for problem, solution, and objective similarity.

3. **Domain overlap.** Computed from category match (same category = 50 base points) plus cross-domain keyword overlap using a hardcoded `DOMAIN_KEYWORDS` dictionary covering Agriculture, Healthcare, Education, Environment, FinTech, AI/ML, Cybersecurity, Social Impact and Open Innovation.

4. **Technology overlap.** Jaccard similarity on the lowercased `stack` arrays. Intentionally given only 5% weight so that sharing "React" and "Python" alone does not make two unrelated projects appear similar.

### Similarity dimensions and weights

| Dimension | Weight | Calculation method |
|-----------|--------|-------------------|
| Problem similarity | 30% | Jaccard on tokenized `problem` text |
| Solution similarity | 25% | Jaccard on tokenized `solution` text |
| Domain similarity | 25% | Category match + domain keyword overlap |
| Objective alignment | 15% | Jaccard on tokenized `problem + solution + category` combined |
| Technology overlap | 5% | Jaccard on lowercased `stack` arrays |

### Key functions

| Function | Purpose |
|----------|---------|
| `calculateSimilarity(a, b)` | Returns `SimilarityResult` with composite score, per-dimension scores, and explanation |
| `getRelatedSubmissions(sub, all, n)` | Top-N most similar submissions (default N=4) |
| `getPairwiseSimilarities(subs)` | All unique pairs sorted by descending similarity |

### Explanation generation

`generateExplanation()` produces human-readable text from actual submission data — category names, shared tokens, domain relationships. It does not use templates with placeholder text or fabricated claims.

### Extensibility

`calculateSimilarity()` is the single extension point. The function's JSDoc describes exactly how to replace it with a real embedding service (e.g., text-embedding-3-small, Cohere, Vertex AI). The `SimilarityResult` return type remains stable, so downstream components (`RelatedSubmissions`, cluster detail, similarity panels) require no changes.

### Static similar pairs

`SIMILAR_PAIRS` in `data.ts` is a legacy array of 5 hardcoded pairs with pre-written explanations, displayed on the clusters index page. These are separate from the dynamically computed similarity engine.

## 7. Hidden Gems

### Detection logic

Defined as `isHiddenGem()` in `src/lib/data.ts`:

```typescript
isHiddenGem(sc) = sc.presentation <= 60
               && (sc.innovation + sc.impact + sc.technical) / 3 >= 78
```

This is a **deterministic threshold rule**, not a machine learning model. It identifies projects where strong substance (innovation, impact, technical) is paired with comparatively weak presentation quality.

### Explanation generation

`gemExplanation(sub)` in `data.ts` builds a human-readable explanation from the submission's actual scores. It lists which strong dimensions (≥80) were detected, reports the actual presentation score, and ends with:

> "Recommended for a second-look review — final decision remains with the judge."

### UI component

`GemBadge` in `ScoreBits.tsx` renders the label "Potential Hidden Gem" — never "AI Selected Winner" or similar absolute language.

### Important constraints

- Hidden gem detection uses **fixed thresholds**. It does not change when judge weights are adjusted.
- Always refer to these as "Potential Hidden Gems" — they are signals for the judge's attention, not automated decisions.

## 8. State and Persistence

### localStorage

| Key | Contents | Notes |
|-----|----------|-------|
| `hacksort-state-v2` | `{ submissions, evaluations, session, judgeWeights }` | Serialized on every state change after hydration |

### What is persisted

- Submissions array (seed + participant-added)
- Evaluations record
- Session (role + email)
- Judge weight configuration

### What is NOT persisted

- `compare` array (comparison tray) — intentionally ephemeral
- `hydrated` flag — runtime-only

### Seed data

24 submissions in `SEED_SUBMISSIONS` with pre-assigned scores, cluster IDs, reasoning, strengths, and risks. These simulate an AI analysis pipeline. When the store initializes:

- If localStorage has data: it replaces seed data (participant submissions persist across refreshes).
- If localStorage is empty: seed data is used as the default.

### Hydration behavior

The `StoreProvider` reads from localStorage in a `useEffect` on mount and sets `hydrated = true`. The `WorkspaceShell` shows a loading screen while `hydrated` is false, preventing a flash of the login-redirect screen.

## 9. Demo Reset

### Purpose

The `DemoResetButton` component (`src/components/DemoReset.tsx`) provides a way to restore the application to its initial state before a live demonstration.

### Behavior

When confirmed via an `AlertDialog`:

1. Removes `hacksort-state-v2` from localStorage.
2. Also removes the legacy `hacksort-state-v1` key.
3. Resets in-memory state: submissions → seed data, evaluations → empty, session → null, compare → empty, judgeWeights → defaults.
4. Redirects to `/`.

### Location

The reset button appears in the sidebar footer of both judge and organizer workspaces, rendered by `WorkspaceShell`.

## 10. Coding Rules

1. **Prefer small, focused changes.** Touch only the files necessary for the task.
2. **Preserve existing behavior** unless the task explicitly requires changing it.
3. **Do not rewrite working components** unless there is a specific reason.
4. **Reuse existing components and utilities.** Check `src/components/ScoreBits.tsx`, `src/components/ui/`, and `src/lib/` before creating new ones.
5. **No duplicate business logic.** Scoring must go through `calculateCompositeScore`. Similarity must go through `calculateSimilarity`. Hidden gem detection must use `isHiddenGem`.
6. **Keep scoring logic centralized** in `src/lib/scoring.ts`.
7. **Keep similarity logic centralized** in `src/lib/similarity.ts`.
8. **Maintain TypeScript type safety.** The project uses strict mode with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. Do not weaken these settings.
9. **Avoid `any`** unless absolutely necessary and justified with a comment.
10. **Do not introduce new dependencies** unless there is a clear need and it is discussed first.
11. **Follow existing project conventions.** Double quotes, semicolons, trailing commas, 100-character line width (see `.prettierrc`).
12. **Do not rename files or restructure directories** without a strong reason.
13. **Do not change routing conventions** (file-based TanStack Router) casually.
14. **Do not modify unrelated files.** If you notice an issue in an unrelated file, note it separately rather than silently fixing it in an unrelated commit.
15. **Do not modify `src/routeTree.gen.ts`** — it is auto-generated by TanStack Router.
16. **Do not hand-edit files in `src/components/ui/`** — these are managed by shadcn/ui.

## 11. UI/UX Rules

### Design system

The application uses a dark-only theme built on oklch color tokens defined in `src/styles.css`:

- **Fonts:** Space Grotesk (display/headings via `font-display`), DM Sans (body via `font-sans`).
- **Glass effect:** `glass` and `glass-hover` custom Tailwind utilities provide the frosted-glass card style used throughout the app.
- **Color tokens:** `--primary` (blue-violet), `--violet`, `--cyan`, `--success` (green), `--warning` (amber), `--destructive` (red).
- **Components:** shadcn/ui (new-york style) with Radix UI primitives.
- **Animations:** `animate-rise` (entry), `animate-float` (ambient).
- **Gradient:** `text-gradient` utility for hero text.

### Future changes must

- Preserve visual consistency with the existing premium SaaS aesthetic.
- Preserve responsive behavior (the sidebar collapses to a horizontal nav on mobile).
- Maintain accessible controls (semantic HTML, ARIA attributes on interactive elements).
- Avoid unnecessary redesign of pages that already work well.
- Use existing UI primitives (`Button`, `Badge`, `Select`, `Slider`, `Tabs`, etc.) rather than creating custom equivalents.
- Maintain the clear visual distinction between **AI signals** (fixed baseline) and **judge-controlled composite scores** (custom weights).
- When custom weights are active, the UI highlights composite score values (e.g., ring border, primary color) and shows "AI Signal: X" as secondary context.

## 12. Data Integrity Rules

1. **Never fake ranking changes.** When weights change, rankings must be recalculated using `calculateCompositeScore` with actual scores. Never hardcode a result to make a demo look correct.
2. **Never hardcode a result** merely to make a demo scenario appear to work.
3. **Scores displayed in different views must come from the same source of truth.** The dashboard, submissions list, project detail, compare page, and evaluations page must all call `calculateCompositeScore` with the same inputs.
4. **Similarity explanations must correspond to actual project data.** Never fabricate a reason for similarity.
5. **Do not fabricate AI evidence.** The `reasoning`, `strengths` and `risks` fields on submissions are static seed data that simulates AI output. Never describe them as live AI analysis.
6. **Do not claim projects are similar based solely on technology overlap.** The similarity engine deliberately weights tech overlap at only 5%.
7. **Do not silently mutate baseline AI scores** when calculating judge-weighted composite scores. The `Submission.scores` object is immutable after creation.

## 13. Human-in-the-Loop Principle

HackSort AI is a **decision-support system**, not an automated judging platform.

- AI signals and recommendations **assist** judges but do **not** replace the final human judging decision.
- The `HumanLoopNote` component renders: *"AI recommendation — final decision remains with the judge."*
- Hidden gems are labeled "Potential Hidden Gem" — never "AI Selected Winner" or similar absolute language.
- The CriteriaPanel explains: *"Rankings reflect the criteria currently configured by the judge. AI signal scores are unchanged — weights only affect how those signals are combined."*

Future UI copy must **not** imply that HackSort autonomously determines the winner, selects projects, or replaces the human judge.

## 14. Testing Requirements

### No automated test suite exists

There are no test files, test runners or testing dependencies in this repository. There is no `test` script in `package.json`.

### Minimum verification after changes

Run the following before committing:

```bash
npm run build     # or: bun run build
npm run lint      # or: bun run lint
npx tsc --noEmit  # or use the local tsc: node_modules/.bin/tsc --noEmit
```

All three must pass with zero errors. Pre-existing warnings in `src/components/ui/` (shadcn/ui generated files) are acceptable and should not be "fixed."

### Manual verification required

For **scoring changes**, verify:
- Default weights produce the same result as `overallSignal`.
- Custom weights produce a different composite score.
- Normalization preserves weight ratios.
- Ranking changes are mathematically correct (e.g., increasing Technical weight to 40% promotes TriageNet above AgriRecover).
- Consistency: the same composite value appears on the dashboard, submissions list, project detail, compare page, and evaluations page.

For **similarity changes**, verify:
- Related submissions appear on the project detail page.
- Explanations reference actual project data (problem, solution, category).
- Cluster detail shows pairwise similarities.
- Technology overlap alone does not dominate the similarity score.

For **state changes**, verify:
- State persists across page refresh.
- Demo reset clears all state and restores seed data.
- Compare tray is cleared on refresh (intentional).

For **routing changes**, verify:
- Direct URL access works (e.g., `/judge/submissions/s1`).
- Refresh on nested routes does not redirect to login incorrectly.
- Browser back/forward navigation works.

## 15. Git and Lovable Rules

### Lovable integration

This project syncs with Lovable. See the `[!IMPORTANT]` block at the top of this file.

### Never

- Force push (`git push --force` or `git push --force-with-lease`).
- Rebase published history.
- Amend published commits.
- Squash already-published commits.
- Rewrite `main` branch history in any way.

### Before committing

1. Run `git diff` and review every changed file.
2. Run `git status` and ensure unrelated files are not staged.
3. Run `npm run build`, `npm run lint`, and `npx tsc --noEmit`.
4. Write a descriptive commit message.
5. Use normal commits (`git commit`), not `--amend` on published commits.

## 16. Change Management

Before implementing a significant feature:

1. **Inspect** the existing implementation. Read the relevant source files.
2. **Identify** the current source of truth for the data or logic being changed.
3. **Determine** whether the feature already partially exists.
4. **Reuse** existing architecture, components, and utilities.
5. **Make the smallest safe change** that accomplishes the goal.
6. **Run validation** (`build`, `lint`, `tsc --noEmit`).
7. **Manually test** the affected workflow in the browser.
8. **Review the diff** before committing.
9. **Only then commit.**

## 17. What NOT To Do

Future agents must **not**:

- Rebuild the application from scratch.
- Replace TanStack Router with another router.
- Replace React Context state management with Redux, Zustand, Jotai, or similar without explicit request.
- Replace Tailwind CSS with another styling system.
- Replace shadcn/ui with another component library.
- Introduce Firebase, Supabase, or any backend service unless explicitly requested.
- Introduce embeddings, vector databases, or LLMs merely because they sound better — the current similarity engine is deterministic and intentionally so.
- Claim that the prototype functionality is production functionality.
- Remove existing seed data without a reason.
- Remove the demo reset mechanism.
- Break Lovable synchronization.
- Modify unrelated files in a feature commit.
- Hand-edit `src/routeTree.gen.ts`.
- Hand-edit files in `src/components/ui/`.

## 18. Product Accuracy

Future implementation and UI copy must accurately reflect what the software actually does.

### Good

- "Similarity is calculated from problem, solution, domain, objective and technology signals using token-based matching."
- "Potential Hidden Gem — strong substance detected despite weak presentation."
- "AI recommendation — final decision remains with the judge."

### Bad

- "Our proprietary AI understands semantic meaning using deep learning embeddings." ← The current implementation uses Jaccard similarity on tokenized text, not embeddings.
- "AI-selected winner" ← HackSort does not select winners.
- "Real-time AI analysis" ← Scores are static seed data or deterministic formulas; there is no AI service running.

If the implementation is upgraded to use real embeddings in the future, update this document and the UI copy accordingly — but only after the implementation actually exists.
