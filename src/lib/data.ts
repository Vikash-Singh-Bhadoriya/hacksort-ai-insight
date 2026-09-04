export type Category =
  | "Agriculture"
  | "Healthcare"
  | "Education"
  | "Environment"
  | "FinTech"
  | "AI/ML"
  | "Cybersecurity"
  | "Social Impact"
  | "Open Innovation";

export const CATEGORIES: Category[] = [
  "Agriculture",
  "Healthcare",
  "Education",
  "Environment",
  "FinTech",
  "AI/ML",
  "Cybersecurity",
  "Social Impact",
  "Open Innovation",
];

export type Scores = {
  innovation: number;
  impact: number;
  technical: number;
  feasibility: number;
  presentation: number;
};

export type Submission = {
  id: string;
  name: string;
  team: string;
  members: string[];
  category: Category;
  problem: string;
  solution: string;
  stack: string[];
  deckUrl: string;
  scores: Scores;
  reasoning: string;
  strengths: string[];
  risks: string[];
  cluster: string;
  status: "Submitted" | "Under Review" | "Reviewed";
  submittedAt: string;
};

export type Cluster = {
  id: string;
  name: string;
  similarity: number;
  tech: string[];
  summary: string;
};

export const CLUSTERS: Cluster[] = [
  {
    id: "healthcare-ai",
    name: "Healthcare & Medical AI",
    similarity: 87,
    tech: ["Python", "PyTorch", "FastAPI", "React"],
    summary:
      "Diagnostic assistance, triage and patient-record intelligence built on medical imaging or clinical NLP models.",
  },
  {
    id: "smart-farming",
    name: "Agriculture & Smart Farming",
    similarity: 84,
    tech: ["IoT", "TensorFlow", "Edge ML", "Flutter"],
    summary:
      "Field-level sensing, advisory bots and yield protection tools aimed at small and mid-size farms.",
  },
  {
    id: "learning-systems",
    name: "Education & Learning Systems",
    similarity: 81,
    tech: ["Next.js", "LLM APIs", "Postgres", "WebRTC"],
    summary:
      "Adaptive tutoring, assessment generation and low-bandwidth classroom delivery platforms.",
  },
  {
    id: "crop-cycle",
    name: "Crop Cycle Optimization",
    similarity: 91,
    tech: ["Satellite APIs", "XGBoost", "GIS", "Python"],
    summary:
      "Sowing-window prediction and rotation planning driven by weather, soil and remote-sensing signals.",
  },
  {
    id: "doc-intel",
    name: "Document Intelligence & Verification",
    similarity: 88,
    tech: ["OCR", "Transformers", "Vector DB", "Node.js"],
    summary:
      "Fraud detection, KYC and claim-document parsing pipelines with retrieval-backed verification.",
  },
  {
    id: "open-labs",
    name: "Open Innovation Labs",
    similarity: 62,
    tech: ["Rust", "WebGL", "Kubernetes", "Solidity"],
    summary:
      "Exploratory submissions that do not map cleanly onto other tracks — highest novelty variance.",
  },
];

const s = (
  innovation: number,
  impact: number,
  technical: number,
  feasibility: number,
  presentation: number,
): Scores => ({ innovation, impact, technical, feasibility, presentation });

// Re-export scoring utilities so existing imports keep working
export { DEFAULT_WEIGHTS, calculateCompositeScore, type JudgeWeights } from "./scoring";

/**
 * Legacy alias — uses DEFAULT_WEIGHTS.
 * Prefer calculateCompositeScore(scores, weights) with explicit weights.
 */
export const overallSignal = (sc: Scores): number =>
  Math.round(
    sc.innovation * 0.28 +
      sc.impact * 0.26 +
      sc.technical * 0.22 +
      sc.feasibility * 0.14 +
      sc.presentation * 0.1,
  );

export const isHiddenGem = (sc: Scores) =>
  sc.presentation <= 60 && (sc.innovation + sc.impact + sc.technical) / 3 >= 78;

export const gemExplanation = (sub: Submission) => {
  const strong: string[] = [];
  if (sub.scores.innovation >= 80) strong.push(`innovation (${sub.scores.innovation})`);
  if (sub.scores.impact >= 80) strong.push(`real-world impact (${sub.scores.impact})`);
  if (sub.scores.technical >= 80) strong.push(`technical depth (${sub.scores.technical})`);
  const strongStr =
    strong.length > 0
      ? strong.join(" and ")
      : `underlying scores (innovation ${sub.scores.innovation}, impact ${sub.scores.impact}, technical ${sub.scores.technical})`;
  return `Strong ${strongStr} detected despite comparatively weak presentation quality (${sub.scores.presentation}). The technical approach scores ${sub.scores.technical}, which places it above the median of the ${sub.category} track. Recommended for a second-look review — final decision remains with the judge.`;
};

export const SEED_SUBMISSIONS: Submission[] = [
  {
    id: "s1",
    name: "AgriRecover",
    team: "Team Terra",
    members: ["Rhea Nair", "Imran Q.", "Dev Patel"],
    category: "Agriculture",
    problem:
      "Smallholder farmers lose 20-30% of yield after unseasonal rain because recovery guidance arrives days too late.",
    solution:
      "Edge-deployed crop-damage classifier that runs offline on a low-end phone and issues a 72-hour salvage plan in the local language.",
    stack: ["TensorFlow Lite", "Flutter", "IoT", "Python"],
    deckUrl: "https://slides.demo/agrirecover",
    scores: s(91, 90, 81, 74, 48),
    reasoning:
      "The offline-first inference approach is unusual for this track: most submissions assume connectivity. Damage-recovery (rather than damage-prediction) is an under-served problem space, and the salvage-window framing is grounded in real agronomic practice. The deck is text-heavy with no demo video, which depresses presentation signal but not technical merit.",
    strengths: [
      "Offline edge inference on sub-$80 devices",
      "Addresses post-loss recovery, a gap in the track",
      "Field data collected from 3 real districts",
    ],
    risks: [
      "Model trained on a small, regionally-narrow dataset",
      "No demo video; claims are hard to verify from the deck",
    ],
    cluster: "smart-farming",
    status: "Submitted",
    submittedAt: "2026-08-19T09:12:00Z",
  },
  {
    id: "s2",
    name: "SowWindow",
    team: "Kisan Labs",
    members: ["Ananya Rao", "Vikram S."],
    category: "Agriculture",
    problem: "Sowing dates chosen by tradition no longer match shifting monsoon onset.",
    solution:
      "Satellite + soil-moisture model that recommends a per-plot sowing window and rotation plan for the next three cycles.",
    stack: ["Satellite APIs", "XGBoost", "GIS", "Python"],
    deckUrl: "https://slides.demo/sowwindow",
    scores: s(78, 84, 79, 82, 80),
    reasoning:
      "Solid, well-validated forecasting with clear backtests against five seasons of district data. Novelty is moderate — several teams cluster around the same sowing-window idea — but execution and validation quality are above average.",
    strengths: ["Backtested against 5 seasons", "Clean per-plot UX"],
    risks: ["Crowded idea space", "Depends on paid satellite tier at scale"],
    cluster: "crop-cycle",
    status: "Reviewed",
    submittedAt: "2026-08-18T14:02:00Z",
  },
  {
    id: "s3",
    name: "RotaSoil",
    team: "GreenGrid",
    members: ["Meera J.", "Karthik V.", "Sana B."],
    category: "Agriculture",
    problem: "Repeated mono-cropping is degrading soil nitrogen in irrigated belts.",
    solution: "Rotation optimizer that trades off market price, soil recovery and water budget.",
    stack: ["Python", "OR-Tools", "Next.js", "Postgres"],
    deckUrl: "https://slides.demo/rotasoil",
    scores: s(74, 80, 77, 79, 72),
    reasoning:
      "A constrained-optimization take on rotation planning. Overlaps heavily with SowWindow on inputs but differs in objective function. Economics modelling is the strongest part.",
    strengths: ["Explicit water-budget constraint", "Transparent objective weights"],
    risks: ["Requires accurate local price feeds"],
    cluster: "crop-cycle",
    status: "Submitted",
    submittedAt: "2026-08-18T18:40:00Z",
  },
  {
    id: "s4",
    name: "TriageNet",
    team: "Vital Signal",
    members: ["Dr. Nikhil A.", "Priya M.", "Owen L."],
    category: "Healthcare",
    problem: "Rural clinics have no radiologist on site; chest X-rays queue for days.",
    solution:
      "On-prem triage model that ranks X-rays by urgency and flags the three findings that most change disposition.",
    stack: ["PyTorch", "FastAPI", "DICOM", "React"],
    deckUrl: "https://slides.demo/triagenet",
    scores: s(85, 92, 88, 76, 86),
    reasoning:
      "Strong across the board. Ranking-for-triage rather than diagnosis is a defensible clinical framing that sidesteps regulatory overreach, and the evaluation includes sensitivity at fixed specificity — rare in a hackathon submission.",
    strengths: ["Clinically framed as triage, not diagnosis", "Rigorous evaluation metrics"],
    risks: ["On-prem hardware cost", "Regulatory path still undefined"],
    cluster: "healthcare-ai",
    status: "Reviewed",
    submittedAt: "2026-08-17T11:20:00Z",
  },
  {
    id: "s5",
    name: "ScriptSense",
    team: "Medline",
    members: ["Aarav D.", "Lin Wei"],
    category: "Healthcare",
    problem: "Handwritten prescriptions cause avoidable dispensing errors.",
    solution: "OCR + drug-interaction checker that flags ambiguous handwriting before dispensing.",
    stack: ["OCR", "Transformers", "Node.js", "Vector DB"],
    deckUrl: "https://slides.demo/scriptsense",
    scores: s(82, 86, 80, 71, 52),
    reasoning:
      "Ambiguity-flagging (rather than forced transcription) is the innovative choice here: the system refuses to guess and escalates instead. Presentation is a single static slide deck with no walkthrough, which understates the depth of the interaction-checking layer.",
    strengths: [
      "Refuses low-confidence reads instead of guessing",
      "Real pharmacopoeia integration",
    ],
    risks: ["Handwriting dataset is small", "No pilot partner identified"],
    cluster: "doc-intel",
    status: "Submitted",
    submittedAt: "2026-08-19T07:55:00Z",
  },
  {
    id: "s6",
    name: "CareLoop",
    team: "Continuum",
    members: ["Tara S.", "Jonas P.", "Ria K."],
    category: "Healthcare",
    problem: "Post-discharge follow-up is manual and 40% of patients are never reached.",
    solution: "Voice-agent follow-up that escalates to a nurse when risk language is detected.",
    stack: ["LLM APIs", "Twilio", "Python", "Postgres"],
    deckUrl: "https://slides.demo/careloop",
    scores: s(71, 79, 68, 84, 83),
    reasoning:
      "Well-packaged and demoable, but the core mechanism is a thin wrapper over existing voice APIs. Feasibility is its strongest axis.",
    strengths: ["Very deployable", "Clear escalation policy"],
    risks: ["Low technical differentiation", "Voice-agent trust in clinical settings"],
    cluster: "healthcare-ai",
    status: "Under Review",
    submittedAt: "2026-08-18T09:30:00Z",
  },
  {
    id: "s7",
    name: "SlateTutor",
    team: "Chalk & Code",
    members: ["Nidhi R.", "Samuel O."],
    category: "Education",
    problem: "Adaptive tutoring collapses on 2G connections in rural schools.",
    solution: "Compressed on-device tutor that syncs mastery state in under 40KB per session.",
    stack: ["WebAssembly", "SQLite", "Next.js", "LLM APIs"],
    deckUrl: "https://slides.demo/slatetutor",
    scores: s(88, 83, 85, 72, 55),
    reasoning:
      "The 40KB sync budget is a genuine engineering constraint most teams ignored, and the mastery-state compression scheme is original. The submission is documented in a plain README with no visual walkthrough.",
    strengths: ["Works on 2G", "Original state-compression scheme"],
    risks: ["Content library is tiny", "Teacher onboarding unaddressed"],
    cluster: "learning-systems",
    status: "Submitted",
    submittedAt: "2026-08-19T12:05:00Z",
  },
  {
    id: "s8",
    name: "GradeGraph",
    team: "Rubric",
    members: ["Ishaan T.", "Bea M.", "Cody W."],
    category: "Education",
    problem: "Teachers spend 8+ hours a week on formative assessment design.",
    solution:
      "Curriculum-aligned question generator with difficulty calibration from past attempts.",
    stack: ["Next.js", "LLM APIs", "Postgres", "Redis"],
    deckUrl: "https://slides.demo/gradegraph",
    scores: s(69, 75, 72, 86, 88),
    reasoning:
      "Highly polished and immediately usable. Innovation is modest — question generation is a saturated space this year — but difficulty calibration from real attempt data lifts it above peers.",
    strengths: ["Excellent demo", "Calibration loop is real, not simulated"],
    risks: ["Category saturation", "Curriculum coverage limited to one board"],
    cluster: "learning-systems",
    status: "Reviewed",
    submittedAt: "2026-08-17T16:45:00Z",
  },
  {
    id: "s9",
    name: "SignalLab",
    team: "Openwork",
    members: ["Yusuf A.", "Hana K."],
    category: "Open Innovation",
    problem: "Community science projects have no cheap way to share calibrated sensor data.",
    solution: "Peer-to-peer sensor mesh with cryptographic calibration attestations.",
    stack: ["Rust", "libp2p", "WebGL", "Solidity"],
    deckUrl: "https://slides.demo/signallab",
    scores: s(93, 74, 87, 58, 51),
    reasoning:
      "The most technically novel submission in the pool: calibration attestation on a P2P mesh has no close neighbour in the dataset. Feasibility within a hackathon-to-pilot horizon is the main concern, and the presentation is a raw terminal recording.",
    strengths: ["Genuinely novel primitive", "Working protocol implementation"],
    risks: ["Unclear adoption path", "Feasibility score is the lowest in the top decile"],
    cluster: "open-labs",
    status: "Submitted",
    submittedAt: "2026-08-19T20:10:00Z",
  },
  {
    id: "s10",
    name: "ClaimClear",
    team: "Ledgerline",
    members: ["Farah N.", "Marcus B.", "Ivy C."],
    category: "FinTech",
    problem: "Insurance claim documents are forged at scale with generative tooling.",
    solution: "Multi-signal document verification combining layout forensics with issuer lookups.",
    stack: ["OCR", "Transformers", "Vector DB", "Go"],
    deckUrl: "https://slides.demo/claimclear",
    scores: s(84, 87, 86, 78, 84),
    reasoning:
      "A strong all-round entry. Layout forensics plus issuer verification is a sensible defence-in-depth design, and the false-positive analysis is honest about cost.",
    strengths: ["Defence-in-depth design", "Honest false-positive reporting"],
    risks: ["Issuer lookup coverage varies by region"],
    cluster: "doc-intel",
    status: "Under Review",
    submittedAt: "2026-08-18T13:15:00Z",
  },
  {
    id: "s11",
    name: "MicroFloat",
    team: "Tidewater",
    members: ["Gita P.", "Ola S."],
    category: "FinTech",
    problem: "Gig workers face 21-day payment gaps with no affordable bridge credit.",
    solution: "Cashflow-based micro-advance underwriting from platform payout history.",
    stack: ["Python", "Postgres", "React", "Plaid API"],
    deckUrl: "https://slides.demo/microfloat",
    scores: s(72, 81, 70, 83, 79),
    reasoning:
      "Sound underwriting logic with a realistic risk model, but the concept is well-represented in the market and in this cohort.",
    strengths: ["Realistic default modelling", "Clear unit economics"],
    risks: ["Regulatory licensing", "Competitive space"],
    cluster: "open-labs",
    status: "Submitted",
    submittedAt: "2026-08-18T22:00:00Z",
  },
  {
    id: "s12",
    name: "CanopyWatch",
    team: "Terraform",
    members: ["Elif D.", "Rohan G.", "Naomi F."],
    category: "Environment",
    problem: "Illegal logging is detected weeks after the fact from optical imagery.",
    solution: "Acoustic + radar fusion that flags chainsaw events within an hour.",
    stack: ["Edge ML", "LoRaWAN", "PyTorch", "GIS"],
    deckUrl: "https://slides.demo/canopywatch",
    scores: s(89, 88, 84, 69, 57),
    reasoning:
      "Sensor fusion for near-real-time detection is a meaningful step beyond the satellite-only baseline used by most environment submissions. Field deployment cost is under-analysed and the deck is unfinished.",
    strengths: ["Sub-hour detection latency", "Working field prototype"],
    risks: ["Deployment cost per hectare", "Battery life unproven"],
    cluster: "open-labs",
    status: "Submitted",
    submittedAt: "2026-08-19T05:25:00Z",
  },
  {
    id: "s13",
    name: "GridEcho",
    team: "Voltform",
    members: ["Peter L.", "Amara O."],
    category: "Environment",
    problem:
      "Rooftop solar output is invisible to distribution operators until it destabilises feeders.",
    solution: "Inverter-telemetry aggregation with feeder-level forecast for operators.",
    stack: ["Kafka", "TimescaleDB", "Python", "React"],
    deckUrl: "https://slides.demo/gridecho",
    scores: s(76, 82, 81, 77, 81),
    reasoning:
      "Competent infrastructure play with a credible operator persona. Not novel, but the data pipeline is the most robust in the track.",
    strengths: ["Production-grade pipeline", "Real operator interviews"],
    risks: ["Utility procurement cycles are slow"],
    cluster: "open-labs",
    status: "Reviewed",
    submittedAt: "2026-08-17T19:35:00Z",
  },
  {
    id: "s14",
    name: "PhishFold",
    team: "Redline",
    members: ["Sana I.", "Tom H.", "Zeke R."],
    category: "Cybersecurity",
    problem: "Spear-phishing now clears every template-based filter.",
    solution: "Relationship-graph anomaly scoring on mail metadata, no message content read.",
    stack: ["Graph DB", "Python", "Kubernetes", "Go"],
    deckUrl: "https://slides.demo/phishfold",
    scores: s(86, 85, 89, 75, 62),
    reasoning:
      "Metadata-only scoring is a privacy-preserving design choice with real deployment advantages. Detection results are reported with a proper baseline comparison. Presentation is functional but plain.",
    strengths: ["Privacy-preserving by construction", "Baseline comparison included"],
    risks: ["Cold-start on new organisations"],
    cluster: "doc-intel",
    status: "Under Review",
    submittedAt: "2026-08-18T08:10:00Z",
  },
  {
    id: "s15",
    name: "KeyKeeper",
    team: "Vaultworks",
    members: ["Dana M.", "Ravi S."],
    category: "Cybersecurity",
    problem: "Small teams leak credentials through chat and CI logs.",
    solution: "Pre-commit and chat-hook secret scanner with automatic rotation playbooks.",
    stack: ["Rust", "GitHub Actions", "Node.js"],
    deckUrl: "https://slides.demo/keykeeper",
    scores: s(64, 73, 75, 88, 80),
    reasoning:
      "Practical and shippable, but overlaps with mature open-source tooling. Rotation playbooks are the differentiator.",
    strengths: ["Ready to deploy today", "Rotation automation"],
    risks: ["Strong incumbent tooling"],
    cluster: "open-labs",
    status: "Submitted",
    submittedAt: "2026-08-19T02:45:00Z",
  },
  {
    id: "s16",
    name: "LinguaBridge",
    team: "Polyglot",
    members: ["Chen Y.", "Aisha B.", "Pablo R."],
    category: "AI/ML",
    problem: "Low-resource languages have no usable speech interfaces.",
    solution:
      "Few-shot speech adaptation pipeline needing 30 minutes of recorded audio per dialect.",
    stack: ["PyTorch", "Whisper", "Python", "ONNX"],
    deckUrl: "https://slides.demo/linguabridge",
    scores: s(90, 86, 88, 70, 74),
    reasoning:
      "A 30-minute adaptation budget is a substantial claim, supported by word-error-rate tables across four dialects. This is the strongest pure-ML contribution in the pool.",
    strengths: ["WER tables across 4 dialects", "Reproducible training scripts"],
    risks: ["Compute cost for adaptation", "Evaluation data self-collected"],
    cluster: "learning-systems",
    status: "Submitted",
    submittedAt: "2026-08-19T15:50:00Z",
  },
  {
    id: "s17",
    name: "ContextGuard",
    team: "Sable",
    members: ["Nora W.", "Ken T."],
    category: "AI/ML",
    problem: "RAG systems silently answer from stale or wrong-tenant documents.",
    solution:
      "Provenance-enforcing retrieval layer that blocks answers without an eligible source.",
    stack: ["Vector DB", "Python", "FastAPI", "Redis"],
    deckUrl: "https://slides.demo/contextguard",
    scores: s(83, 78, 85, 80, 59),
    reasoning:
      "Hard provenance enforcement, rather than post-hoc citation, is the interesting inversion here. The team spent their time on the eval harness rather than the deck.",
    strengths: ["Provenance enforced pre-answer", "Strong eval harness"],
    risks: ["Latency overhead", "Narrow initial integrations"],
    cluster: "doc-intel",
    status: "Submitted",
    submittedAt: "2026-08-19T18:30:00Z",
  },
  {
    id: "s18",
    name: "ShelterMap",
    team: "Commonground",
    members: ["Leo F.", "Mira Z.", "Ade K."],
    category: "Social Impact",
    problem: "Shelter capacity data is stale within hours during cold snaps.",
    solution: "SMS-driven capacity ledger that outreach workers can update in five seconds.",
    stack: ["Twilio", "Node.js", "Postgres", "Mapbox"],
    deckUrl: "https://slides.demo/sheltermap",
    scores: s(70, 88, 66, 89, 82),
    reasoning:
      "Modest technically, but the impact case is the clearest in the cohort and the workflow was designed with two actual outreach organisations.",
    strengths: ["Co-designed with real operators", "Five-second update workflow"],
    risks: ["Low technical depth", "Sustainability of data entry"],
    cluster: "open-labs",
    status: "Reviewed",
    submittedAt: "2026-08-17T21:05:00Z",
  },
  {
    id: "s19",
    name: "RightsReader",
    team: "Due Process",
    members: ["Hugo V.", "Selin A."],
    category: "Social Impact",
    problem: "Tenants cannot parse eviction notices before deadlines expire.",
    solution:
      "Notice parser that extracts deadlines and generates a jurisdiction-specific response.",
    stack: ["OCR", "LLM APIs", "Next.js", "Postgres"],
    deckUrl: "https://slides.demo/rightsreader",
    scores: s(80, 89, 76, 79, 54),
    reasoning:
      "Deadline extraction with jurisdiction-aware templates is a high-leverage intervention. The submission is essentially undocumented visually, which is the main reason its surface signal is low.",
    strengths: ["Deadline extraction validated on 120 real notices", "Jurisdiction templates"],
    risks: ["Legal liability of generated responses", "Coverage limited to 3 states"],
    cluster: "doc-intel",
    status: "Submitted",
    submittedAt: "2026-08-19T10:40:00Z",
  },
  {
    id: "s20",
    name: "PulseBoard",
    team: "Northlight",
    members: ["Ivan P.", "Grace L.", "Tom N."],
    category: "Open Innovation",
    problem: "Volunteer-run events lose track of who is doing what in real time.",
    solution: "Live operations board with automatic task reassignment on no-show.",
    stack: ["React", "WebSockets", "Node.js", "Redis"],
    deckUrl: "https://slides.demo/pulseboard",
    scores: s(61, 66, 69, 87, 85),
    reasoning:
      "Clean execution and an excellent demo, but the problem is well solved by existing tools and the technical surface is shallow.",
    strengths: ["Best-in-cohort demo polish", "Reliable realtime layer"],
    risks: ["Commoditised problem space"],
    cluster: "open-labs",
    status: "Reviewed",
    submittedAt: "2026-08-18T11:55:00Z",
  },
  {
    id: "s21",
    name: "FieldVoice",
    team: "Bharat Agritech",
    members: ["Sunil M.", "Kavya N."],
    category: "Agriculture",
    problem: "Advisory content is written; most target farmers prefer voice in dialect.",
    solution: "Dialect voice advisory bot over a plain phone call, no smartphone needed.",
    stack: ["Whisper", "Twilio", "Python", "Edge ML"],
    deckUrl: "https://slides.demo/fieldvoice",
    scores: s(79, 87, 74, 81, 68),
    reasoning:
      "IVR delivery removes the smartphone assumption that most agriculture submissions make. Overlaps with LinguaBridge on the speech stack but targets a different delivery channel.",
    strengths: ["No smartphone required", "Dialect coverage"],
    risks: ["Telephony cost per call"],
    cluster: "smart-farming",
    status: "Submitted",
    submittedAt: "2026-08-19T13:20:00Z",
  },
  {
    id: "s22",
    name: "LabQueue",
    team: "Meridian Health",
    members: ["Owen S.", "Divya R.", "Ben A."],
    category: "Healthcare",
    problem: "Diagnostic labs batch samples inefficiently, delaying urgent results.",
    solution: "Urgency-aware scheduling for lab benches with live turnaround forecasting.",
    stack: ["OR-Tools", "Python", "React", "Postgres"],
    deckUrl: "https://slides.demo/labqueue",
    scores: s(73, 80, 78, 85, 77),
    reasoning:
      "Operations-research framing applied cleanly to a real bottleneck. Not conceptually novel but well executed and immediately deployable.",
    strengths: ["Clear ROI model", "Deployable without ML risk"],
    risks: ["Requires LIS integration"],
    cluster: "healthcare-ai",
    status: "Under Review",
    submittedAt: "2026-08-18T15:25:00Z",
  },
  {
    id: "s23",
    name: "OpenBench",
    team: "Fair Eval",
    members: ["Zoe C.", "Arun K."],
    category: "AI/ML",
    problem: "Model benchmarks leak into training sets and stop measuring anything.",
    solution: "Rotating private benchmark with contamination detection and public scoreboards.",
    stack: ["Python", "Postgres", "Kubernetes", "Next.js"],
    deckUrl: "https://slides.demo/openbench",
    scores: s(87, 79, 83, 66, 58),
    reasoning:
      "Contamination detection is a serious, under-addressed problem and the rotation protocol is thoughtfully specified. Sustainability of a private benchmark is the open question, and the demo is a static scoreboard.",
    strengths: ["Well-specified rotation protocol", "Contamination detector works on real leaks"],
    risks: ["Who funds the private set long-term?", "Adoption depends on trust"],
    cluster: "open-labs",
    status: "Submitted",
    submittedAt: "2026-08-19T17:10:00Z",
  },
  {
    id: "s24",
    name: "CivicLens",
    team: "Townhall",
    members: ["Nadia E.", "Ruben M.", "Kai O."],
    category: "Education",
    problem: "Municipal budget documents are unreadable for the residents they affect.",
    solution: "Budget explainer that turns line items into per-household impact statements.",
    stack: ["LLM APIs", "Python", "Next.js", "D3"],
    deckUrl: "https://slides.demo/civiclens",
    scores: s(75, 81, 70, 83, 86),
    reasoning:
      "Strong communication design and a genuinely useful translation layer. Technical depth is limited to prompt orchestration.",
    strengths: ["Excellent information design", "Per-household framing"],
    risks: ["Accuracy of derived figures", "Shallow technical moat"],
    cluster: "learning-systems",
    status: "Submitted",
    submittedAt: "2026-08-18T20:15:00Z",
  },
];

export const SIMILAR_PAIRS = [
  {
    a: "s2",
    b: "s3",
    score: 91,
    why: "Shared satellite + soil inputs and near-identical rotation objectives.",
  },
  {
    a: "s16",
    b: "s21",
    score: 86,
    why: "Both build dialect speech adaptation on Whisper-derived pipelines.",
  },
  {
    a: "s5",
    b: "s19",
    score: 83,
    why: "Document parsing with confidence-gated escalation to a human.",
  },
  {
    a: "s10",
    b: "s14",
    score: 79,
    why: "Fraud detection via structural signals rather than content inspection.",
  },
  { a: "s7", b: "s8", score: 76, why: "Adaptive assessment loops targeting classroom teachers." },
];

export const JUDGES = [
  { name: "Dr. Anita Mehra", track: "Healthcare", reviewed: 14, assigned: 24, active: "2h ago" },
  { name: "Sameer Kulkarni", track: "AI/ML", reviewed: 21, assigned: 24, active: "18m ago" },
  { name: "Elena Fischer", track: "Environment", reviewed: 9, assigned: 24, active: "1d ago" },
  { name: "Marcus Bell", track: "FinTech", reviewed: 17, assigned: 24, active: "40m ago" },
  { name: "Priya Ranganathan", track: "Education", reviewed: 6, assigned: 24, active: "3h ago" },
];

export const HACKATHON = {
  name: "GlobalHack 2026",
  theme: "Applied AI for real-world systems",
  dates: "21-23 August 2026",
  venue: "Hybrid — Bengaluru + Online",
  prize: "$40,000 pool",
  rules: [
    "Teams of 1-4 participants.",
    "One submission per team, one primary category.",
    "Working prototype and presentation link required.",
    "AI assistance permitted; disclose it in your submission.",
  ],
  timeline: [
    { t: "Aug 21, 09:00", label: "Registration & kickoff" },
    { t: "Aug 21, 12:00", label: "Hacking begins" },
    { t: "Aug 22, 20:00", label: "Submission deadline" },
    { t: "Aug 23, 10:00", label: "Judging & hidden-gem review" },
    { t: "Aug 23, 17:00", label: "Results announced" },
  ],
};

export const DEMO_CREDENTIALS = {
  judge: { email: "judge@hacksort.ai", password: "judge123" },
  organizer: { email: "organizer@hacksort.ai", password: "organizer123" },
};
