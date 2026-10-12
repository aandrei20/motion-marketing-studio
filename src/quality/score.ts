/**
 * Motorul de scor de calitate (quality-v1): 11 categorii, fiecare 0–100, calculate din problemele
 * structurate (gravitate × încredere, cu randament descrescător în aceeași categorie).
 *
 * Reguli de verdict (pragurile vin din QualityConfig, configurabile per proiect):
 *   CRITICAL > 0               → FAIL
 *   HIGH > 0                   → FIX
 *   scor general < polishAt    → FIX
 *   polishAt ≤ scor < passAt   → POLISH (opțional)
 *   scor ≥ passAt, 0 critical, 0 high, rubrica regulii 7 trecută → PASS
 *
 * O categorie fără nicio verificare rulată rămâne „neevaluată” (null), nu 100: scorul nu pretinde dovezi
 * pe care nu le are. Scorul general e media ponderată a categoriilor evaluate.
 */
import {
  QUALITY_CATEGORIES,
  QualityConfig,
  type Finding,
  type QualityCategory,
  type QualityConfigInput,
  type QualityScore,
  type QualityVerdict,
} from "../core/schema";
import { countBySeverity } from "./issues";

export const QUALITY_MODEL = "quality-v1" as const;

/** Ponderile implicite: povestea, afirmațiile și tehnicul cântăresc mai mult decât finisajul. */
export const DEFAULT_WEIGHTS: Record<QualityCategory, number> = {
  story: 1.3,
  creative: 1.1,
  visual: 1.0,
  motion: 0.9,
  typography: 1.0,
  ui: 0.9,
  audio: 0.9,
  brand: 0.9,
  claims: 1.3,
  technical: 1.2,
  platform: 0.9,
};

export function resolveQualityConfig(c?: QualityConfigInput | null): QualityConfig {
  return QualityConfig.parse(c ?? {});
}

export interface ScoreInput {
  issues: Finding[];
  /** categoriile pentru care au rulat verificări (altfel rămân neevaluate) */
  evaluated: Iterable<QualityCategory>;
  config?: QualityConfig;
  /** rubrica regulii 7: scorul minim pe scenă (1–10), dacă s-a calculat */
  rubricMinScene?: number | null;
}

export function scoreQuality(inp: ScoreInput): QualityScore {
  const cfg = inp.config ?? resolveQualityConfig();
  const evaluated = new Set(inp.evaluated);
  const open = inp.issues.filter((f) => f.status === "open" || f.status === "needs-human");
  const categories = {} as Record<QualityCategory, number | null>;
  for (const cat of QUALITY_CATEGORIES) {
    if (!evaluated.has(cat) && !open.some((f) => f.category === cat)) {
      categories[cat] = null;
      continue;
    }
    // randament descrescător: a doua problemă din aceeași categorie contează 85%, a treia 72%…
    const list = open
      .filter((f) => f.category === cat)
      .map((f) => cfg.penalties[f.severity] * f.confidence)
      .sort((a, b) => b - a);
    const penalty = list.reduce((s, p, k) => s + p * Math.pow(0.85, k), 0);
    categories[cat] = Math.max(0, Math.round((100 - penalty) * 10) / 10);
  }
  const weights = { ...DEFAULT_WEIGHTS, ...cfg.weights };
  const scored = QUALITY_CATEGORIES.filter((c) => categories[c] !== null);
  const wsum = scored.reduce((s, c) => s + weights[c], 0);
  const overall = wsum ? Math.round((scored.reduce((s, c) => s + (categories[c] as number) * weights[c], 0) / wsum) * 10) / 10 : 0;
  const counts = countBySeverity(open);
  const reasons: string[] = [];
  let verdict: QualityVerdict;
  if (cfg.criticalBlocks && counts.critical > 0) {
    verdict = "FAIL";
    reasons.push(`${counts.critical} probleme critice (blochează).`);
  } else if (cfg.highBlocks && counts.high > 0) {
    verdict = "FIX";
    reasons.push(`${counts.high} probleme mari de corectat.`);
  } else if (overall < cfg.polishAt) {
    verdict = "FIX";
    reasons.push(`Scorul general ${overall} e sub ${cfg.polishAt}.`);
  } else if (overall < cfg.passAt) {
    verdict = "POLISH";
    reasons.push(`Scorul general ${overall} e între ${cfg.polishAt} și ${cfg.passAt}: finisaj opțional.`);
  } else {
    verdict = "PASS";
  }
  if (inp.rubricMinScene !== undefined && inp.rubricMinScene !== null && inp.rubricMinScene < cfg.sceneRubricThreshold) {
    if (verdict === "PASS" || verdict === "POLISH") verdict = "FIX";
    reasons.push(`Rubrica regulii 7: scorul minim pe scenă ${inp.rubricMinScene}/10 e sub ${cfg.sceneRubricThreshold}.`);
  }
  const coverage = scored.length / QUALITY_CATEGORIES.length;
  if (coverage < 1)
    reasons.push(
      `Evaluate ${scored.length} din ${QUALITY_CATEGORIES.length} categorii (${QUALITY_CATEGORIES.filter((c) => categories[c] === null).join(", ")} neevaluate în această rundă).`,
    );
  return { model: QUALITY_MODEL, categories, overall, coverage: Math.round(coverage * 100) / 100, counts, verdict, reasons };
}

/** Diferența dintre două scoruri (pentru bucla de corectură și raportul de progres). */
export function scoreDelta(a: QualityScore, b: QualityScore): { overall: number; categories: Partial<Record<QualityCategory, number>> } {
  const categories: Partial<Record<QualityCategory, number>> = {};
  for (const c of QUALITY_CATEGORIES) {
    const x = a.categories[c];
    const y = b.categories[c];
    if (x !== null && y !== null && x !== undefined && y !== undefined && x !== y) categories[c] = Math.round((y - x) * 10) / 10;
  }
  return { overall: Math.round((b.overall - a.overall) * 10) / 10, categories };
}
