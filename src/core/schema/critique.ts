import { z } from "zod";
import { IsoDate, VersionId } from "./common";
import { EditOp } from "./edit";

/** Rubrica fixă din CLAUDE.md (regula 7). Aceeași în toate rundele. */
export const RubricKey = z.enum(["hook", "clarity", "rhythm", "hierarchy", "variety", "brand", "cta"]);
export type RubricKey = z.infer<typeof RubricKey>;
export const RUBRIC_KEYS = RubricKey.options;

/** Verificările concrete (ce anume s-a măsurat). Categoria de calitate e separată (QualityCategory). */
export const TechnicalCheck = z.enum([
  "safe-zone",
  "readability",
  "flash",
  "black-frame",
  "audio",
  "claims",
  "rights",
  "real-footage",
  "determinism",
  "assets",
  "timing",
  "format",
  // verificări adăugate de bucla de calitate adaptivă
  "story",
  "pacing",
  "contrast",
  "clutter",
  "composition",
  "whitespace",
  "motion",
  "ui-legibility",
  "typography",
  "brand-consistency",
  "platform",
  "beat-sync",
  "stale",
  "reframing",
  "creative",
]);
export type TechnicalCheck = z.infer<typeof TechnicalCheck>;

/** Cele 11 categorii ale scorului de calitate (0–100 fiecare). */
export const QualityCategory = z.enum(["story", "creative", "visual", "motion", "typography", "ui", "audio", "brand", "claims", "technical", "platform"]);
export type QualityCategory = z.infer<typeof QualityCategory>;
export const QUALITY_CATEGORIES = QualityCategory.options;

/** Gravitatea. Valorile vechi (blocker/major/minor/nit) se citesc mai departe și se convertesc. */
const LEGACY_SEVERITY: Record<string, string> = { blocker: "critical", major: "high", minor: "medium", nit: "low" };
export const SeverityLevel = z.enum(["critical", "high", "medium", "low"]);
export type Severity = z.infer<typeof SeverityLevel>;
export const Severity = z.preprocess((v) => (typeof v === "string" && v in LEGACY_SEVERITY ? LEGACY_SEVERITY[v] : v), SeverityLevel);
export const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const Dimension = z.union([RubricKey, TechnicalCheck]);
export type Dimension = z.infer<typeof Dimension>;

/** Categoria de calitate a unei verificări (când problema nu o declară explicit). */
export const CATEGORY_OF: Record<Dimension, QualityCategory> = {
  hook: "story",
  clarity: "typography",
  rhythm: "motion",
  hierarchy: "visual",
  variety: "motion",
  brand: "brand",
  cta: "story",
  "safe-zone": "platform",
  readability: "typography",
  flash: "technical",
  "black-frame": "technical",
  audio: "audio",
  claims: "claims",
  rights: "claims",
  "real-footage": "ui",
  determinism: "technical",
  assets: "technical",
  timing: "technical",
  format: "platform",
  story: "story",
  pacing: "story",
  contrast: "visual",
  clutter: "visual",
  composition: "visual",
  whitespace: "visual",
  motion: "motion",
  "ui-legibility": "ui",
  typography: "typography",
  "brand-consistency": "brand",
  platform: "platform",
  "beat-sync": "audio",
  stale: "technical",
  reframing: "platform",
  creative: "creative",
};

export const FindingSource = z.enum(["auto-check", "pixel-check", "ai-review", "user-note"]);

const FindingBase = z.object({
  id: z.string(),
  round: z.number().int().min(0),
  frame: z.number().int().min(0).nullable(),
  timecode: z.string().nullable(),
  /** cât ține problema pe ecran (secunde), dacă e localizată în timp */
  durationSec: z.number().min(0).nullable().default(null),
  sceneId: z.string().nullable(),
  layerId: z.string().nullable().default(null),
  /** formatul în care s-a găsit problema (null = toate / independentă de format) */
  formatId: z.string().nullable().default(null),
  dimension: Dimension,
  category: QualityCategory,
  severity: Severity,
  problem: z.string(),
  /** de ce contează pentru reclamă (efectul asupra privitorului) */
  whyItMatters: z.string().default(""),
  recommendation: z.string(),
  /** cât de sigur e detectorul (0–1); scorul ponderează problema cu încrederea */
  confidence: z.number().min(0).max(1).default(1),
  /** true = există o corectură mecanică sigură (suggestedFix), aplicabilă fără decizie creativă */
  autoFixable: z.boolean().default(false),
  suggestedFix: z.array(EditOp).default([]),
  /** metoda de detecție: static, schema, timeline, asset, audio, stills, scene-render, full-render, ai-vision, human */
  method: z.string().default("timeline"),
  source: FindingSource,
  status: z.enum(["open", "fixed", "wontfix", "needs-human"]).default("open"),
});

/** Problemele vechi (fără categorie) primesc categoria verificării lor. */
export const Finding = z.preprocess((v) => {
  if (v && typeof v === "object" && !("category" in v) && "dimension" in v) {
    const d = (v as { dimension: string }).dimension as Dimension;
    return { ...v, category: CATEGORY_OF[d] ?? "technical" };
  }
  return v;
}, FindingBase);
export type Finding = z.infer<typeof FindingBase>;
export type FindingInput = z.input<typeof FindingBase>;

export const SceneScore = z.object({
  sceneId: z.string(),
  scores: z.record(RubricKey, z.number().min(1).max(10)),
  notes: z.array(z.string()).default([]),
});
export type SceneScore = z.infer<typeof SceneScore>;

/** Pragurile și ponderile scorului de calitate. Configurabile per proiect (project.json → quality). */
export const QualityConfig = z.object({
  /** ≥ passAt fără probleme critice sau mari → PASS */
  passAt: z.number().min(0).max(100).default(95),
  /** < polishAt → FIX; între polishAt și passAt → POLISH (opțional) */
  polishAt: z.number().min(0).max(100).default(92),
  /** o problemă critică blochează (FAIL) */
  criticalBlocks: z.boolean().default(true),
  /** o problemă mare cere corectură (FIX) */
  highBlocks: z.boolean().default(true),
  /** pragul regulii 7 pe rubrica fixă (fiecare scenă) */
  sceneRubricThreshold: z.number().min(1).max(10).default(8),
  weights: z.partialRecord(QualityCategory, z.number().min(0).max(5)).default({}),
  /** penalizarea de bază pe gravitate (puncte din 100), înmulțită cu încrederea */
  penalties: z.object({ critical: z.number().default(45), high: z.number().default(18), medium: z.number().default(7), low: z.number().default(2) }).default({ critical: 45, high: 18, medium: 7, low: 2 }),
  /** bucla de corectură automată */
  maxIterations: z.number().int().min(1).max(12).default(3),
  minScoreImprovement: z.number().min(0).max(20).default(0.5),
  maxAutoFixes: z.number().int().min(1).max(40).default(8),
  autoFixMinConfidence: z.number().min(0).max(1).default(0.6),
});
export type QualityConfig = z.infer<typeof QualityConfig>;
export type QualityConfigInput = z.input<typeof QualityConfig>;

export const QualityVerdict = z.enum(["PASS", "POLISH", "FIX", "FAIL"]);
export type QualityVerdict = z.infer<typeof QualityVerdict>;

export const QualityScore = z.object({
  model: z.literal("quality-v1"),
  /** null = categoria nu a fost evaluată în această rundă (nu se presupune 100) */
  categories: z.record(QualityCategory, z.number().min(0).max(100).nullable()),
  overall: z.number().min(0).max(100),
  /** câte categorii au fost evaluate din 11 */
  coverage: z.number().min(0).max(1),
  counts: z.object({ critical: z.number().int(), high: z.number().int(), medium: z.number().int(), low: z.number().int() }),
  verdict: QualityVerdict,
  reasons: z.array(z.string()).default([]),
});
export type QualityScore = z.infer<typeof QualityScore>;

export const CritiqueRound = z.object({
  n: z.number().int().min(1),
  at: IsoDate,
  versionId: VersionId,
  reviewer: z.string(),
  rubricVersion: z.literal("rubric-v1"),
  sceneScores: z.array(SceneScore),
  findings: z.array(Finding),
  /** media pe dimensiuni pentru tot filmul */
  overall: z.record(RubricKey, z.number()),
  minScene: z.number(),
  /** scorul 0–100 pe cele 11 categorii (bucla adaptivă); rundele vechi nu îl au */
  quality: QualityScore.optional(),
  /** adâncimea verificării: rundele se compară doar la aceeași adâncime (același reviewer, aceeași rubrică) */
  depth: z.enum(["fast", "standard", "deep", "final"]).optional(),
  formatId: z.string().optional(),
});
export type CritiqueRound = z.infer<typeof CritiqueRound>;

export const Critique = z.object({
  schemaVersion: z.literal(1),
  threshold: z.number().default(8),
  rounds: z.array(CritiqueRound).default([]),
});
export type Critique = z.infer<typeof Critique>;
