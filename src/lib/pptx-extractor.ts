/**
 * src/lib/pptx-extractor.ts
 *
 * SERVER-ONLY module. Extracts text and structural evidence from PPTX files.
 *
 * PPTX files are ZIP archives containing Office Open XML. This module:
 *   1. Opens the PPTX with JSZip
 *   2. Parses ppt/slides/slideN.xml for text content
 *   3. Parses ppt/notesSlides/ for speaker notes
 *   4. Extracts hyperlinks, URLs, technology keywords
 *   5. Counts images, tables, and structural elements per slide
 *
 * Does NOT perform visual/image analysis. All output is text + structure.
 * Strict caps prevent huge presentations from creating enormous payloads.
 */

// JSZip is dynamically imported inside extractPresentationEvidence (like the
// Gemini SDK in src/lib/gemini.ts) so it is never bundled into client code.
// The type-only import is erased at build time.
import type JSZip from "jszip";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _jszipModule: { default?: typeof JSZip } & Partial<typeof JSZip> = null as any;

async function getJSZip(): Promise<typeof JSZip> {
  if (_jszipModule) return _jszipModule as typeof JSZip;
  const mod = await import("jszip");
  _jszipModule = mod;
  return (mod.default ?? mod) as typeof JSZip;
}

// ─── Extraction Limits ─────────────────────────────────────────────────────

/** Maximum number of slides to analyze. Slides beyond this are skipped. */
export const MAX_SLIDES = 50;

/** Maximum characters extracted per slide body text. */
export const MAX_CHARS_PER_SLIDE = 2000;

/** Maximum total characters across all slides for the Gemini prompt. */
export const MAX_TOTAL_CHARS = 30000;

// ─── Types ─────────────────────────────────────────────────────────────────

export type SlideEvidence = {
  slideNumber: number;
  title: string;
  bodyText: string;
  bulletPoints: string[];
  notes: string;
  imageCount: number;
  tableCount: number;
  hyperlinkCount: number;
  urls: string[];
  /** Whether this slide has unusually little text (potential diagram/image slide). */
  sparseContent: boolean;
  /** Whether this slide has excessive text (potential wall-of-text). */
  excessiveContent: boolean;
  /** MVP: Visual evidence extracted from sparse slides. */
  extractedImages?: Array<{
    mimeType: string;
    base64: string;
    byteSize: number;
  }>;
};

export type PresentationEvidence = {
  slideCount: number;
  slides: SlideEvidence[];
  allUrls: string[];
  githubUrls: string[];
  demoUrls: string[];
  technologyKeywords: string[];
  totalImageCount: number;
  totalTableCount: number;
  totalHyperlinkCount: number;
  /** Total extracted text character count (after capping). */
  totalChars: number;
  /** Whether speaker notes were found in the presentation. */
  hasSpeakerNotes: boolean;
  /** Extraction warnings (non-fatal issues). */
  warnings: string[];
};

// ─── URL patterns ──────────────────────────────────────────────────────────

const URL_RE = /https?:\/\/[^\s<>"')\]]+/gi;
const GITHUB_URL_RE = /https?:\/\/(?:www\.)?github\.com\/[^\s<>"')\]]+/gi;

const DEMO_DOMAINS = [
  "vercel.app",
  "netlify.app",
  "herokuapp.com",
  "railway.app",
  "fly.dev",
  "onrender.com",
  "pages.dev",
  "surge.sh",
  "glitch.me",
  "repl.co",
  "codesandbox.io",
  "stackblitz.com",
  "codepen.io",
];

// ─── Technology keyword detection ──────────────────────────────────────────

const TECH_KEYWORDS = [
  "react",
  "vue",
  "angular",
  "svelte",
  "next.js",
  "nextjs",
  "nuxt",
  "remix",
  "astro",
  "python",
  "flask",
  "django",
  "fastapi",
  "fast api",
  "node.js",
  "nodejs",
  "express",
  "typescript",
  "javascript",
  "rust",
  "go",
  "golang",
  "java",
  "kotlin",
  "swift",
  "flutter",
  "dart",
  "react native",
  "postgresql",
  "postgres",
  "mysql",
  "mongodb",
  "redis",
  "sqlite",
  "firebase",
  "supabase",
  "aws",
  "gcp",
  "azure",
  "docker",
  "kubernetes",
  "k8s",
  "graphql",
  "rest api",
  "grpc",
  "pytorch",
  "tensorflow",
  "keras",
  "scikit-learn",
  "sklearn",
  "openai",
  "gpt",
  "llm",
  "transformer",
  "bert",
  "whisper",
  "yolo",
  "opencv",
  "pandas",
  "numpy",
  "hugging face",
  "huggingface",
  "langchain",
  "llamaindex",
  "pinecone",
  "weaviate",
  "chromadb",
  "chroma",
  "qdrant",
  "blockchain",
  "ethereum",
  "solidity",
  "web3",
  "machine learning",
  "deep learning",
  "neural network",
  "nlp",
  "computer vision",
  "edge ml",
  "edge computing",
  "iot",
  "arduino",
  "raspberry pi",
  "webassembly",
  "wasm",
  "Three.js",
  "webgl",
  "tailwind",
  "tailwindcss",
  "shadcn",
  "radix",
  "prisma",
  "drizzle",
  "typeorm",
  "sequelize",
  "kafka",
  "rabbitmq",
  "grpc",
  "websocket",
  "webrtc",
  "twilio",
  "stripe",
  "plaid",
  "mapbox",
  "leaflet",
  "d3",
  "recharts",
  "chart.js",
  "postgis",
  "timescaledb",
  "influxdb",
  "xgboost",
  "lightgbm",
  "catboost",
  "onnx",
  "tensorrt",
  "tflite",
  "tensorflow lite",
  "core ml",
  "gemini",
  "claude",
  "anthropic",
  "mistral",
  "llama",
  "gemma",
];

// ─── XML text extraction helpers ───────────────────────────────────────────

/**
 * Extract all text content from an XML string.
 * Handles Office Open XML namespace patterns: <a:t>, <a:p>, <a:r>.
 * Falls back to stripping all XML tags if namespace patterns aren't found.
 */
function extractTextFromXml(xml: string): string {
  // Try namespace-aware extraction first (Office Open XML)
  const aTextRe = /<a:t[^>]*>([\s\S]*?)<\/a:t>/gi;
  const texts: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = aTextRe.exec(xml)) !== null) {
    const t = decodeXmlEntities(match[1] ?? "");
    if (t.trim()) texts.push(t.trim());
  }

  if (texts.length > 0) return texts.join(" ");

  // Fallback: strip all XML tags
  return stripXmlTags(xml);
}

/**
 * Extract text from <a:p> paragraph elements, preserving paragraph breaks.
 */
function extractParagraphsFromXml(xml: string): string[] {
  const pRe = /<a:p[^>]*>([\s\S]*?)<\/a:p>/gi;
  const paragraphs: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = pRe.exec(xml)) !== null) {
    const pXml = match[1] ?? "";
    const text = extractTextFromXml(pXml);
    if (text.trim()) paragraphs.push(text.trim());
  }

  return paragraphs;
}

/**
 * Extract slide title from the XML.
 * Looks for <p:cxnSp> or <p:sp> with placeholder type="title" or "ctrTitle".
 * Falls back to first substantial text run.
 */
function extractSlideTitle(xml: string): string {
  // Try to find title placeholder
  const titleRe = /<p:ph[^>]*type="(?:title|ctrTitle)"[^>]*>/gi;
  if (titleRe.test(xml)) {
    // Find the containing <p:sp> and extract text
    const spRe = /<p:sp[^>]*>[\s\S]*?<\/p:sp>/gi;
    let spMatch: RegExpExecArray | null;
    while ((spMatch = spRe.exec(xml)) !== null) {
      const sp = spMatch[0] ?? "";
      if (/<p:ph[^>]*type="(?:title|ctrTitle)"/i.test(sp)) {
        const text = extractTextFromXml(sp);
        if (text.trim()) return text.trim();
      }
    }
  }

  // Fallback: first paragraph with >3 chars
  const paragraphs = extractParagraphsFromXml(xml);
  for (const p of paragraphs) {
    if (p.length > 3) return p;
  }

  return "";
}

/**
 * Count occurrences of specific XML elements (images, tables).
 */
function countXmlElements(xml: string, tagName: string): number {
  const re = new RegExp(`<${tagName}[\\s>]`, "gi");
  return (xml.match(re) ?? []).length;
}

function stripXmlTags(xml: string): string {
  return xml
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

// ─── URL extraction ────────────────────────────────────────────────────────

function extractUrls(text: string): string[] {
  const urls = text.match(URL_RE) ?? [];
  return [...new Set(urls.map((u) => u.replace(/[.,;:!?)]+$/, "")))];
}

function extractGithubUrls(texts: string[]): string[] {
  const all = texts.join(" ");
  const matches = all.match(GITHUB_URL_RE) ?? [];
  return [...new Set(matches.map((u) => u.replace(/[.,;:!?)]+$/, "")))];
}

function extractDemoUrls(urls: string[]): string[] {
  return urls.filter((url) => {
    try {
      const parsed = new URL(url);
      return DEMO_DOMAINS.some((d) => parsed.hostname.endsWith(d));
    } catch {
      return false;
    }
  });
}

function detectTechnologyKeywords(texts: string[]): string[] {
  const all = texts.join(" ").toLowerCase();
  const found = new Set<string>();

  for (const kw of TECH_KEYWORDS) {
    // Word-boundary check for short keywords, substring for longer ones
    if (kw.length <= 3) {
      const re = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (re.test(all)) found.add(kw);
    } else if (all.includes(kw.toLowerCase())) {
      found.add(kw);
    }
  }

  return [...found].sort();
}

// ─── Main extraction function ──────────────────────────────────────────────

/**
 * Extract presentation evidence from a PPTX file buffer.
 *
 * @param buffer - The raw PPTX file content (ZIP archive)
 * @returns Structured presentation evidence for Gemini analysis
 * @throws If the buffer is not a valid PPTX/ZIP file
 */
export async function extractPresentationEvidence(
  buffer: Buffer | ArrayBuffer,
): Promise<PresentationEvidence> {
  const warnings: string[] = [];

  // ── Step 1: Open as ZIP ────────────────────────────────────────────────
  let zip: JSZip;
  try {
    const JSZip = await getJSZip();
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new Error(
      "EXTRACTION_FAILED: The file could not be opened as a valid PPTX archive. " +
        "The file may be corrupted or not a real .pptx file.",
    );
  }

  // ── Step 2: Find slide files ──────────────────────────────────────────
  const slideFiles: string[] = [];
  zip.forEach((path) => {
    if (/^ppt\/slides\/slide\d+\.xml$/i.test(path)) {
      slideFiles.push(path);
    }
  });

  slideFiles.sort((a, b) => {
    const numA = parseInt(a.match(/slide(\d+)/)?.[1] ?? "0", 10);
    const numB = parseInt(b.match(/slide(\d+)/)?.[1] ?? "0", 10);
    return numA - numB;
  });

  if (slideFiles.length === 0) {
    throw new Error(
      "NO_SLIDES: The PPTX file contains no slide files. " +
        "It may be empty or use an unsupported format.",
    );
  }

  const totalSlideCount = slideFiles.length;
  const slidesToAnalyze = slideFiles.slice(0, MAX_SLIDES);

  if (totalSlideCount > MAX_SLIDES) {
    warnings.push(
      `Presentation has ${totalSlideCount} slides; only the first ${MAX_SLIDES} were analyzed.`,
    );
  }

  // ── Step 3: Find notes files ──────────────────────────────────────────
  const notesFiles: string[] = [];
  zip.forEach((path) => {
    if (/^ppt\/notesSlides\/notesSlide\d+\.xml$/i.test(path)) {
      notesFiles.push(path);
    }
  });

  // ── Step 4: Extract text from each slide ──────────────────────────────
  const slides: SlideEvidence[] = [];
  const allTexts: string[] = [];
  const allUrls: string[] = [];
  let totalChars = 0;
  let totalImageCount = 0;
  let totalTableCount = 0;
  let totalHyperlinkCount = 0;
  let hasSpeakerNotes = false;

  for (let i = 0; i < slidesToAnalyze.length; i++) {
    const slidePath = slidesToAnalyze[i] ?? "";
    const slideNumber = i + 1;

    let slideXml: string;
    try {
      const file = zip.file(slidePath);
      if (!file) {
        warnings.push(`Slide ${slideNumber}: file not found in archive.`);
        continue;
      }
      slideXml = await file.async("text");
    } catch {
      warnings.push(`Slide ${slideNumber}: could not read XML content.`);
      continue;
    }

    // Extract title
    const title = extractSlideTitle(slideXml);

    // Extract all text
    const fullText = extractTextFromXml(slideXml);
    const cappedText = fullText.slice(0, MAX_CHARS_PER_SLIDE);

    // Extract paragraphs (for bullet points)
    const paragraphs = extractParagraphsFromXml(slideXml);
    const bulletPoints = paragraphs.filter(
      (p) => p.length > 5 && p !== title && !p.startsWith(title),
    );

    // Extract speaker notes (best effort — matching by slide number)
    let notes = "";
    const notesPath = `ppt/notesSlides/notesSlide${slideNumber}.xml`;
    const notesFile = zip.file(notesPath);
    if (notesFile) {
      try {
        const notesXml = await notesFile.async("text");
        notes = extractTextFromXml(notesXml).slice(0, 500);
        if (notes.trim()) hasSpeakerNotes = true;
      } catch {
        // Notes extraction is best-effort
      }
    }

    // Count structural elements
    const imageCount = countXmlElements(slideXml, "p:pic") + countXmlElements(slideXml, "a:blip");
    const tableCount = countXmlElements(slideXml, "a:tbl");
    const hyperlinkCount =
      countXmlElements(slideXml, "a:hlinkClick") + countXmlElements(slideXml, "h:sld");

    // Extract URLs from text
    const slideUrls = extractUrls(cappedText);
    allUrls.push(...slideUrls);

    totalImageCount += imageCount;
    totalTableCount += tableCount;
    totalHyperlinkCount += hyperlinkCount;
    totalChars += cappedText.length;

    allTexts.push(cappedText);

    slides.push({
      slideNumber,
      title,
      bodyText: cappedText,
      bulletPoints: bulletPoints.slice(0, 20),
      notes,
      imageCount,
      tableCount,
      hyperlinkCount,
      urls: slideUrls,
      sparseContent: cappedText.replace(/\s+/g, "").length < 20,
      excessiveContent: cappedText.length > MAX_CHARS_PER_SLIDE * 0.9,
    });
  }

  // ── Step 4.5: Extract images for sparse slides (MVP) ──
  let totalExtractedImages = 0;
  for (const slide of slides) {
    if (slide.sparseContent && slide.imageCount > 0 && totalExtractedImages < 3) {
      const slidePath = slidesToAnalyze[slide.slideNumber - 1];
      if (!slidePath) continue;

      const relsPath = slidePath.replace("ppt/slides/", "ppt/slides/_rels/") + ".rels";
      const relsFile = zip.file(relsPath);
      if (!relsFile) continue;

      try {
        const relsXml = await relsFile.async("text");
        const relRegex = /<Relationship[^>]+Id="([^"]+)"[^>]+Target="([^"]+)"/g;
        let match;
        const mediaPaths: string[] = [];
        while ((match = relRegex.exec(relsXml)) !== null) {
          const target = match[2];
          if (target && target.includes("media/")) {
            let absPath = target;
            if (target.startsWith("../")) absPath = "ppt/" + target.substring(3);
            else if (target.startsWith("/")) absPath = target.substring(1);
            else absPath = "ppt/slides/" + target;
            mediaPaths.push(absPath);
          }
        }

        if (mediaPaths.length === 0) continue;

        let largestMedia: NonNullable<SlideEvidence["extractedImages"]>[number] | null = null;
        let maxSize = 0;

        for (const mp of mediaPaths) {
          const mFile = zip.file(mp);
          if (mFile && !mFile.dir) {
            const u8 = await mFile.async("uint8array");
            const size = u8.length;
            if (size >= 15360 && size <= 4194304 && size > maxSize) {
              const ext = mp.split(".").pop()?.toLowerCase();
              let mime = "image/jpeg";
              if (ext === "png") mime = "image/png";
              else if (ext === "webp") mime = "image/webp";

              maxSize = size;
              const b64 = Buffer.from(u8).toString("base64");
              largestMedia = {
                mimeType: mime,
                base64: b64,
                byteSize: size,
              };
            }
          }
        }

        if (largestMedia) {
          slide.extractedImages = [largestMedia];
          totalExtractedImages++;
        }
      } catch (err) {
        warnings.push(`Slide ${slide.slideNumber}: failed to extract images.`);
      }
    }
  }

  // ── Step 5: Aggregate URL analysis ────────────────────────────────────
  const uniqueUrls = [...new Set(allUrls)];
  const githubUrls = extractGithubUrls(allTexts);
  const demoUrls = extractDemoUrls(uniqueUrls);
  const technologyKeywords = detectTechnologyKeywords(allTexts);

  // Cap total chars
  if (totalChars > MAX_TOTAL_CHARS) {
    warnings.push(
      `Extracted text (${totalChars} chars) exceeded the ${MAX_TOTAL_CHARS} character limit. ` +
        `Content was truncated per slide.`,
    );
  }

  return {
    slideCount: totalSlideCount,
    slides,
    allUrls: uniqueUrls,
    githubUrls: [...new Set(githubUrls)],
    demoUrls: [...new Set(demoUrls)],
    technologyKeywords,
    totalImageCount,
    totalTableCount,
    totalHyperlinkCount,
    totalChars: Math.min(totalChars, MAX_TOTAL_CHARS),
    hasSpeakerNotes,
    warnings,
  };
}

/**
 * Format extracted evidence into a compact string for the Gemini prompt.
 */
export function formatEvidenceForPrompt(evidence: PresentationEvidence): string {
  const lines: string[] = [];

  lines.push(`Presentation: ${evidence.slideCount} slides`);
  lines.push(`Total text: ${evidence.totalChars} characters`);
  lines.push(`Images detected: ${evidence.totalImageCount}`);
  lines.push(`Tables detected: ${evidence.totalTableCount}`);
  lines.push(`Hyperlinks detected: ${evidence.totalHyperlinkCount}`);
  lines.push(`Speaker notes: ${evidence.hasSpeakerNotes ? "yes" : "no"}`);
  lines.push("");

  if (evidence.technologyKeywords.length > 0) {
    lines.push(`Technology keywords found in slides: ${evidence.technologyKeywords.join(", ")}`);
    lines.push("");
  }

  if (evidence.githubUrls.length > 0) {
    lines.push(`GitHub URLs found: ${evidence.githubUrls.join(", ")}`);
    lines.push("");
  }

  if (evidence.demoUrls.length > 0) {
    lines.push(`Demo URLs found: ${evidence.demoUrls.join(", ")}`);
    lines.push("");
  }

  lines.push("--- SLIDE CONTENT ---");
  lines.push("");

  for (const slide of evidence.slides) {
    const flags: string[] = [];
    if (slide.sparseContent) flags.push("[sparse]");
    if (slide.excessiveContent) flags.push("[wall-of-text]");
    if (slide.imageCount > 0) flags.push(`[images: ${slide.imageCount}]`);
    if (slide.tableCount > 0) flags.push(`[tables: ${slide.tableCount}]`);

    const flagStr = flags.length > 0 ? ` ${flags.join(" ")}` : "";

    lines.push(`Slide ${slide.slideNumber}:${flagStr}`);

    if (slide.title) {
      lines.push(`  Title: ${slide.title}`);
    }

    if (slide.bodyText) {
      lines.push(`  Content: ${slide.bodyText}`);
    }

    if (slide.notes) {
      lines.push(`  Speaker notes: ${slide.notes}`);
    }

    if (slide.urls.length > 0) {
      lines.push(`  URLs: ${slide.urls.join(", ")}`);
    }

    lines.push("");
  }

  if (evidence.warnings.length > 0) {
    lines.push("--- EXTRACTION WARNINGS ---");
    for (const w of evidence.warnings) {
      lines.push(`- ${w}`);
    }
  }

  return lines.join("\n");
}
