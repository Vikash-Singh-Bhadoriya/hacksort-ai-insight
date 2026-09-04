import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { SEED_SUBMISSIONS, type Submission, type Scores } from "./data";
import { DEFAULT_WEIGHTS, type JudgeWeights } from "./scoring";

export type Evaluation = {
  submissionId: string;
  scores: Scores;
  notes: string;
  reviewed: boolean;
  shortlisted: boolean;
  flagged: boolean;
  updatedAt: string;
};

export type Role = "judge" | "organizer";

type Session = { role: Role; email: string } | null;

type Store = {
  submissions: Submission[];
  addSubmission: (s: Submission) => void;
  evaluations: Record<string, Evaluation>;
  saveEvaluation: (e: Evaluation) => void;
  patchEvaluation: (id: string, patch: Partial<Evaluation>) => void;
  session: Session;
  signIn: (role: Role, email: string) => void;
  signOut: () => void;
  compare: string[];
  toggleCompare: (id: string) => void;
  clearCompare: () => void;
  judgeWeights: JudgeWeights;
  setJudgeWeights: (w: JudgeWeights) => void;
  resetDemo: () => void;
  hydrated: boolean;
};

const Ctx = createContext<Store | null>(null);

const KEY = "hacksort-state-v2";

export function StoreProvider({ children }: { children: ReactNode }) {
  const [submissions, setSubmissions] = useState<Submission[]>(SEED_SUBMISSIONS);
  const [evaluations, setEvaluations] = useState<Record<string, Evaluation>>({});
  const [session, setSession] = useState<Session>(null);
  const [compare, setCompare] = useState<string[]>([]);
  const [judgeWeights, setJudgeWeightsState] = useState<JudgeWeights>(DEFAULT_WEIGHTS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (Array.isArray(p.submissions) && p.submissions.length) setSubmissions(p.submissions);
        if (p.evaluations) setEvaluations(p.evaluations);
        if (p.session) setSession(p.session);
        if (p.judgeWeights) setJudgeWeightsState(p.judgeWeights);
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({ submissions, evaluations, session, judgeWeights }),
      );
    } catch {
      /* ignore */
    }
  }, [submissions, evaluations, session, judgeWeights, hydrated]);

  const addSubmission = useCallback((s: Submission) => {
    setSubmissions((prev) => [s, ...prev]);
  }, []);

  const saveEvaluation = useCallback((e: Evaluation) => {
    setEvaluations((prev) => ({ ...prev, [e.submissionId]: e }));
  }, []);

  const patchEvaluation = useCallback((id: string, patch: Partial<Evaluation>) => {
    setEvaluations((prev) => {
      const base: Evaluation = prev[id] ?? {
        submissionId: id,
        scores: { innovation: 0, impact: 0, technical: 0, feasibility: 0, presentation: 0 },
        notes: "",
        reviewed: false,
        shortlisted: false,
        flagged: false,
        updatedAt: new Date().toISOString(),
      };
      return { ...prev, [id]: { ...base, ...patch, updatedAt: new Date().toISOString() } };
    });
  }, []);

  const toggleCompare = useCallback((id: string) => {
    setCompare((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(-4),
    );
  }, []);

  const setJudgeWeights = useCallback((w: JudgeWeights) => {
    setJudgeWeightsState(w);
  }, []);

  const resetDemo = useCallback(() => {
    try {
      localStorage.removeItem(KEY);
      // Also clear old key
      localStorage.removeItem("hacksort-state-v1");
    } catch {
      /* ignore */
    }
    setSubmissions(SEED_SUBMISSIONS);
    setEvaluations({});
    setSession(null);
    setCompare([]);
    setJudgeWeightsState(DEFAULT_WEIGHTS);
  }, []);

  const value = useMemo<Store>(
    () => ({
      submissions,
      addSubmission,
      evaluations,
      saveEvaluation,
      patchEvaluation,
      session,
      signIn: (role, email) => setSession({ role, email }),
      signOut: () => setSession(null),
      compare,
      toggleCompare,
      clearCompare: () => setCompare([]),
      judgeWeights,
      setJudgeWeights,
      resetDemo,
      hydrated,
    }),
    [
      submissions,
      addSubmission,
      evaluations,
      saveEvaluation,
      patchEvaluation,
      session,
      compare,
      toggleCompare,
      judgeWeights,
      setJudgeWeights,
      resetDemo,
      hydrated,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
