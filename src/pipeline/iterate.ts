import fs from "node:fs";
import path from "node:path";
import { autoCritique, loopDecision } from "../critique/auto";
import { readJson } from "../core/json";
import { MixReport, type Critique, type CritiqueRound, type Finding, type SceneScore } from "../core/schema";
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

/** O rundă de critică automată pe versiunea curentă (sau dată), salvată în critique.json. */
export function critiqueRound(projectId: string, versionId?: string, formatId?: string): { round: CritiqueRound; decision: ReturnType<typeof loopDecision> } {
  const project = loadProject(projectId);
  const v = versionId ?? project.currentVersion;
  if (!v) throw new MmsError("NO_VERSION", "Nu există versiune.");
  const fmt = project.formats.find((f) => f.id === (formatId ?? project.formats[0].id))!;
  const t = loadTimeline(projectId, v, fmt.id);
  const brief = loadBrief(projectId);
  const sb = loadStoryboard(projectId, v);
  const validation = validateTimeline(t, { assets: loadAssets(projectId), research: loadResearch(projectId), format: fmt });
  const mixFile = versionFile(projectId, v, "audio/mix-report.json");
  const checkFile = versionFile(projectId, v, `renders/check-${fmt.id}.json`);
  const mix = fs.existsSync(mixFile) ? readJson(mixFile, MixReport) : null;
  const video = fs.existsSync(checkFile) ? (JSON.parse(fs.readFileSync(checkFile, "utf8")) as VideoCheck) : null;
  // numărul rundei continuă peste versiuni (aceeași buclă de calitate)
  const all = collectRounds(projectId);
  const round = autoCritique({ timeline: t, brief, dir: DIRECTIONS[sb.direction ?? brief.direction ?? "technical"], validation, mix, video }, all.length + 1, v);
  const c = loadCritique(projectId, v);
  c.rounds.push(round);
  saveCritique(projectId, v, c);
  const decision = loopDecision({ ...c, rounds: [...all, round] });
  updateState(projectId, { step: "critique", stepState: decision.passed ? "done" : "pending", note: `runda ${round.n}: minim ${round.minScene}/10`, log: `Critică runda ${round.n} pe ${v}: ${decision.message}` });
  return { round, decision };
}

function collectRounds(projectId: string): CritiqueRound[] {
  const project = loadProject(projectId);
  const out: CritiqueRound[] = [];
  const n = Number((project.currentVersion ?? "v0").slice(1));
  for (let i = 1; i <= n; i++) {
    try {
      out.push(...loadCritique(projectId, `v${i}`).rounds.filter((r) => r.reviewer === "mms-auto-critic-v1"));
    } catch {
      /* versiune fără critică */
    }
  }
  return out.sort((a, b) => a.n - b.n);
}

/**
 * Adaugă observațiile revizuirii vizuale făcute de Claude pe foaia de contact (sau notele utilizatorului
 * după ascultare), ca rundă separată (reviewer diferit, aceeași rubrică).
 */
export function addReview(projectId: string, versionId: string, input: { reviewer: "claude-visual" | "user-notes"; findings: Array<Omit<Finding, "id" | "round" | "status" | "source"> & { source?: Finding["source"] }>; sceneScores?: SceneScore[] }): CritiqueRound {
  const c: Critique = loadCritique(projectId, versionId);
  const n = c.rounds.length + 1;
  const sceneScores = input.sceneScores ?? [];
  const keys = ["hook", "clarity", "rhythm", "hierarchy", "variety", "brand", "cta"] as const;
  const overall = Object.fromEntries(keys.map((k) => [k, sceneScores.length ? sceneScores.reduce((s, x) => s + (x.scores[k] ?? 0), 0) / sceneScores.length : 0])) as CritiqueRound["overall"];
  const round: CritiqueRound = {
    n,
    at: new Date().toISOString(),
    versionId,
    reviewer: input.reviewer,
    rubricVersion: "rubric-v1",
    sceneScores,
    findings: input.findings.map((f, i) => ({ ...f, id: `${input.reviewer}-${n}-${i + 1}`, round: n, status: "open", source: f.source ?? (input.reviewer === "user-notes" ? "user-note" : "ai-review") })),
    overall,
    minScene: sceneScores.length ? Math.min(...sceneScores.map((s) => Math.min(...keys.map((k) => s.scores[k] ?? 10)))) : 0,
  };
  c.rounds.push(round);
  saveCritique(projectId, versionId, c);
  updateState(projectId, { log: `Observații ${input.reviewer} pe ${versionId}: ${round.findings.length}.` });
  return round;
}

export type { Log };
