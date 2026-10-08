import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { sceneAtFrame, type LoopDecision } from "../critique/auto";
import { collectRounds, runQuality, type QualityRun } from "../quality/run";
import type { Depth } from "../quality/checks";
import { makeIssue } from "../quality/issues";
import { parseWith } from "../core/json";
import { EditOp, QualityCategory, RUBRIC_KEYS, RubricKey, SceneScore, Severity, TechnicalCheck, type Critique, type CritiqueRound, type Finding } from "../core/schema";
import { DIRECTIONS } from "../creative/directions";
import { MmsError } from "../core/errors";
import { applyOps, parseCommand } from "../iterate/intents";
import type { VideoCheck } from "../renderer/node/analyze-video";
import { validateTimeline } from "../timeline/validate";
import {
  createVersion,
  loadAssets,
  loadBrief,
  loadCritique,
  loadProject,
  loadResearch,
  loadScript,
  loadStoryboard,
  loadTimeline,
  saveCritique,
  saveScript,
  saveStoryboard,
  updateState,
  versionFile,
} from "../projects/store";
import { stepAudio, stepCompile, stepVoice, type Log } from "./steps";

/** O comandă în limbaj natural → versiune nouă, recompilată, cu jurnalul schimbărilor. */
export async function iterate(projectId: string, command: string, log: (m: string) => void = () => undefined, opts: { from?: string } = {}): Promise<{ versionId: string; changes: string[] }> {
  const project = loadProject(projectId);
  const from = opts.from ?? project.currentVersion;
  if (!from) throw new MmsError("NO_VERSION", "Proiectul nu are încă o versiune compilată.");
  const ops = parseCommand(command);
  const ctx = { storyboard: loadStoryboard(projectId, from), script: loadScript(projectId, from), brief: loadBrief(projectId), timeline: loadTimeline(projectId, from, project.formats[0].id), assets: loadAssets(projectId) };
  const res = applyOps(ctx, ops);
  const at = new Date().toISOString();
  const v = createVersion(projectId, { from, label: command.slice(0, 60), changes: res.changes.map((c) => ({ at, op: c.op, description: c.description, params: c.params, request: command })) });
  saveStoryboard(projectId, v.id, res.storyboard);
  saveScript(projectId, v.id, res.script);
  for (const c of res.changes) log(`• ${c.description}`);
  const scriptChanged = JSON.stringify(res.script) !== JSON.stringify(ctx.script);
  if (scriptChanged || !fs.existsSync(versionFile(projectId, from, "audio/voice.json"))) await stepVoice(projectId, v.id, log);
  else {
    fs.mkdirSync(path.dirname(versionFile(projectId, v.id, "audio/voice.json")), { recursive: true });
    for (const f of ["audio/voice.json", "audio/voice-key.json"]) if (fs.existsSync(versionFile(projectId, from, f))) fs.copyFileSync(versionFile(projectId, from, f), versionFile(projectId, v.id, f));
  }
  await stepCompile(projectId, v.id, log);
  await stepAudio(projectId, v.id, log);
  updateState(projectId, { decision: `Iterație „${command}” → ${v.id}.`, next: [`Randează preview-ul pentru ${v.id} (mms preview ${projectId}).`] });
  return { versionId: v.id, changes: res.changes.map((c) => c.description) };
}

/**
 * Variante de hook (livrare, grupa G): câte o versiune nouă pentru fiecare variantă din script.hooks
 * care nu e deja folosită, toate pornind din aceeași versiune, ca utilizatorul să aleagă.
 */
export async function hookVariants(projectId: string, opts: { from?: string; count?: number } = {}, log: (m: string) => void = () => undefined): Promise<Array<{ versionId: string; hookId: string; text: string }>> {
  const project = loadProject(projectId);
  const from = opts.from ?? project.currentVersion;
  if (!from) throw new MmsError("NO_VERSION", "Proiectul nu are încă o versiune compilată.");
  const count = opts.count ?? loadBrief(projectId).delivery.hookVariants;
  if (count <= 0) throw new MmsError("NO_HOOK_VARIANTS", "Brief-ul nu cere variante de hook (delivery.hookVariants = 0).", "Dă un număr explicit: mms hook-variants <proiect> --count 2");
  const script = loadScript(projectId, from);
  const current = script.lines.find((l) => l.isHook);
  const candidates = script.hooks.filter((h) => !h.selected && h.text.trim() !== current?.onScreen?.trim()).slice(0, count);
  if (!candidates.length) throw new MmsError("NO_HOOK_VARIANTS", "Scriptul nu are alte variante de hook.", "Adaugă variante în câmpul hooks din script.json (origin „ai” pentru sugestii), apoi reîncearcă.");
  if (candidates.length < count) log(`Scriptul are doar ${candidates.length} variante disponibile (cerute: ${count}).`);
  const out: Array<{ versionId: string; hookId: string; text: string }> = [];
  for (const h of candidates) {
    log(`Varianta ${h.id}: „${h.text}”`);
    const r = await iterate(projectId, `folosește hook-ul ${h.id}`, log, { from });
    out.push({ versionId: r.versionId, hookId: h.id, text: h.text });
  }
  updateState(projectId, { decision: `Variante de hook din ${from}: ${out.map((o) => `${o.versionId} (${o.hookId})`).join(", ")}.`, next: ["Randează preview pentru fiecare variantă și lasă utilizatorul să aleagă."] });
  return out;
}

/**
 * O rundă de critică automată: bucla de calitate adaptivă (rubrica fixă + scorul quality-v1),
 * la adâncimea cerută. Implicit „fast” (fără randare), ca vechea critică; vezi src/quality/run.ts.
 */
export async function critiqueRound(projectId: string, versionId?: string, formatId?: string, depth: Depth = "fast", log: (m: string) => void = () => undefined): Promise<{ round: CritiqueRound; decision: LoopDecision; run: QualityRun }> {
  const r = await runQuality(projectId, { versionId, formats: formatId ? [formatId] : undefined, depth, log });
  return { round: r.round, decision: r.decision, run: r.run };
}

/** Observațiile lui Claude (revizuirea vizuală) sau notele utilizatorului: validate strict, cu „secunda X” → cadru și scenă. */
export const ReviewFinding = z.object({
  frame: z.number().int().min(0).nullable().default(null),
  /** alternativ la frame: secunda din video (cum o notează utilizatorul) */
  sec: z.number().min(0).optional(),
  sceneId: z.string().nullable().default(null),
  layerId: z.string().nullable().default(null),
  formatId: z.string().nullable().default(null),
  durationSec: z.number().min(0).nullable().default(null),
  dimension: z.union([RubricKey, TechnicalCheck]),
  category: QualityCategory.optional(),
  severity: Severity,
  problem: z.string().min(1),
  whyItMatters: z.string().optional(),
  recommendation: z.string().min(1),
  confidence: z.number().min(0).max(1).default(0.8),
  suggestedFix: z.array(EditOp).default([]),
});
export const ReviewInput = z.object({
  reviewer: z.enum(["claude-visual", "user-notes"]),
  findings: z.array(ReviewFinding).default([]),
  sceneScores: z.array(SceneScore).default([]),
});
export type ReviewInput = z.input<typeof ReviewInput>;

/**
 * Adaugă observațiile revizuirii vizuale făcute de Claude pe cadrele-cheie / foaia de contact (sau notele
 * utilizatorului după ascultare), ca rundă separată (reviewer diferit, aceeași rubrică).
 */
export function addReview(projectId: string, versionId: string, raw: unknown): CritiqueRound {
  const input = parseWith(ReviewInput, raw, "observațiile revizuirii");
  const project = loadProject(projectId);
  const t = loadTimeline(projectId, versionId, project.formats[0].id);
  const c: Critique = loadCritique(projectId, versionId);
  const n = Math.max(0, ...c.rounds.map((r) => r.n), ...collectRounds(projectId).map((r) => r.n)) + 1;
  const sceneScores = input.sceneScores;
  const overall = Object.fromEntries(RUBRIC_KEYS.map((k) => [k, sceneScores.length ? sceneScores.reduce((s, x) => s + (x.scores[k] ?? 0), 0) / sceneScores.length : 0])) as CritiqueRound["overall"];
  const source = input.reviewer === "user-notes" ? "user-note" : "ai-review";
  const findings: Finding[] = input.findings.map((f, i) => {
    const frame = f.frame ?? (f.sec !== undefined ? Math.round(f.sec * t.fps) : null);
    return makeIssue({ ...f, frame, sceneId: f.sceneId ?? (frame !== null ? sceneAtFrame(t, frame) : null), method: input.reviewer === "user-notes" ? "human" : "ai-vision", source }, `${input.reviewer}-${n}-${i + 1}`, n, t.fps);
  });
  const round: CritiqueRound = {
    n,
    at: new Date().toISOString(),
    versionId,
    reviewer: input.reviewer,
    rubricVersion: "rubric-v1",
    sceneScores,
    findings,
    overall,
    minScene: sceneScores.length ? Math.min(...sceneScores.map((s) => Math.min(...RUBRIC_KEYS.map((k) => s.scores[k] ?? 10)))) : 0,
  };
  c.rounds.push(round);
  saveCritique(projectId, versionId, c);
  updateState(projectId, { log: `Observații ${input.reviewer} pe ${versionId}: ${round.findings.length}.` });
  return round;
}

export type { Log };
