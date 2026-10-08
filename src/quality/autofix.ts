/**
 * Bucla de corectură automată:
 *   CRITICĂ → CLASIFICARE → PRIORITIZARE → CORECTURĂ (versiune nouă) → VALIDARE → VERIFICARE DOAR A CE S-A SCHIMBAT → …
 *
 * Doar problemele cu o corectură mecanică sigură (autoFixable, încredere ≥ prag, scena neblocată) se repară
 * automat. Textul utilizatorului, afirmațiile și ideea creativă nu se ating: acelea rămân „de decis de om”
 * (Claude în Claude Code sau utilizatorul).
 *
 * Gărzi: maxIterations, minScoreImprovement, maxAutoFixes, blocare pe critice. Dacă o corectură înrăutățește
 * scorul sau introduce o problemă mare nouă → ROLLBACK: versiunea rămâne pe disc marcată „rejected”, iar
 * versiunea curentă revine la cea bună (nimic nu se șterge, regula 9). Corecturile respinse nu se mai încearcă.
 */
import fs from "node:fs";
import path from "node:path";
import { MmsError, throwIfCancelled } from "../core/errors";
import type { EditOp, Finding, QualityScore } from "../core/schema";
import { applyEditOps, mergeOps } from "../editing/ops";
import { impactBetween, type ImpactPlan } from "../pipeline/impact";
import { stepAudio, stepCompile } from "../pipeline/steps";
import { createVersion, loadAssets, loadProject, loadStoryboard, loadTimeline, rejectVersion, saveStoryboard, updateState, versionFile } from "../projects/store";
import { saveSnapshot } from "../projects/snapshots";
import type { Depth } from "./checks";
import { issueKey, prioritize } from "./issues";
import { loadQualityRun, runQuality, type QualityRun } from "./run";
import { resolveQualityConfig, scoreDelta } from "./score";

export interface AutoFixIteration {
  n: number;
  from: string;
  to: string;
  fixes: Array<{ issueId: string; severity: string; problem: string; ops: EditOp[] }>;
  before: QualityScore;
  after: QualityScore | null;
  delta: number | null;
  decision: "kept" | "rolled-back";
  reason: string;
  impact: ImpactPlan | null;
  renders: QualityRun["renders"] | null;
}

export interface AutoFixReport {
  startVersion: string;
  finalVersion: string;
  depth: Depth;
  iterations: AutoFixIteration[];
  stopReason: string;
  /** probleme care cer decizie creativă (Claude / utilizator) */
  needsHuman: Finding[];
  finalScore: QualityScore;
  /** regula 7: la fiecare 3 runde utilizatorul vede progresul și decide dacă se continuă */
  checkpoint: boolean;
}

export interface AutoFixOptions {
  depth?: Depth;
  maxIterations?: number;
  log?: (m: string) => void;
  signal?: AbortSignal;
}

function candidates(run: QualityRun, cfg: ReturnType<typeof resolveQualityConfig>, banned: Set<string>, locked: Set<string>): Finding[] {
  return prioritize(run.issues)
    .filter((f) => f.status === "open" && f.autoFixable && f.suggestedFix.length && f.confidence >= cfg.autoFixMinConfidence)
    .filter((f) => !banned.has(issueKey(f)))
    .filter((f) => !f.sceneId || !locked.has(f.sceneId))
    .slice(0, cfg.maxAutoFixes);
}

export async function autoFixLoop(projectId: string, o: AutoFixOptions = {}): Promise<AutoFixReport> {
  const log = o.log ?? (() => undefined);
  const project = loadProject(projectId);
  const cfg = resolveQualityConfig(project.quality);
  const depth = o.depth ?? "standard";
  const maxIt = o.maxIterations ?? cfg.maxIterations;
  const start = project.currentVersion;
  if (!start) throw new MmsError("NO_VERSION", "Proiectul nu are încă o versiune compilată.");
  let cur = start;
  const existing = loadQualityRun(projectId, cur);
  let q = existing && existing.depth === depth && existing.versionId === cur ? existing : (await runQuality(projectId, { versionId: cur, depth, log })).run;
  const iterations: AutoFixIteration[] = [];
  const banned = new Set<string>();
  let stopReason = `Limita de ${maxIt} iterații atinsă.`;
  for (let i = 1; i <= maxIt; i++) {
    throwIfCancelled(o.signal);
    if (q.score.verdict === "PASS") {
      stopReason = `PASS: ${q.score.overall}/100, fără probleme critice sau mari.`;
      break;
    }
    const sb = loadStoryboard(projectId, cur);
    const locked = new Set(sb.scenes.filter((s) => s.locked).map((s) => s.id));
    const pick = candidates(q, cfg, banned, locked);
    if (!pick.length) {
      stopReason = "Nu mai există probleme cu corectură automată sigură; restul cer decizie creativă.";
      break;
    }
    const ops = mergeOps(pick.flatMap((f) => f.suggestedFix));
    log(`Iterația ${i}: ${pick.length} corecturi (${ops.length} operații) pe ${cur}`);
    for (const f of pick) log(`  • [${f.severity}] ${f.problem}`);
    const at = new Date().toISOString();
    const timeline = loadTimeline(projectId, cur, project.formats[0].id);
    const res = applyEditOps(sb, ops, { timeline, assets: loadAssets(projectId), respectLocks: true });
    const v2 = createVersion(projectId, { from: cur, label: `auto-fix ${i}`, changes: res.applied.filter((x) => !x.skipped).map((x) => ({ at, op: `auto-fix:${x.op.op}`, description: x.description, params: x.op as unknown as Record<string, unknown> })) }).id;
    saveStoryboard(projectId, v2, res.storyboard);
    // jurnalul de editare al versiunii noi (undo/redo pe corecturile automate)
    const before = saveSnapshot(projectId, "storyboard", sb);
    const after = saveSnapshot(projectId, "storyboard", res.storyboard);
    fs.writeFileSync(versionFile(projectId, v2, "edits.json"), JSON.stringify({ schemaVersion: 1, entries: [{ n: 1, at, ops, description: `Corecturi automate (iterația ${i})`, before, after, source: "auto-fix", undone: false }] }, null, 2));
    // vocea nu depinde de corecturile de montaj: se refolosește (amprenta o confirmă la compilare)
    for (const f of ["audio/voice.json", "audio/voice-key.json"]) {
      const src = versionFile(projectId, cur, f);
      if (fs.existsSync(src)) {
        fs.mkdirSync(path.dirname(versionFile(projectId, v2, f)), { recursive: true });
        fs.copyFileSync(src, versionFile(projectId, v2, f));
      }
    }
    const compiled = await stepCompile(projectId, v2, log);
    await stepAudio(projectId, compiled.versionId, log);
    const { plan } = impactBetween(projectId, cur, compiled.versionId);
    for (const r of plan.reasons) log(`  impact: ${r}`);
    const q2 = (await runQuality(projectId, { versionId: compiled.versionId, depth, log, signal: o.signal })).run;
    const oldKeys = new Set(q.issues.map(issueKey));
    const introduced = q2.issues.filter((f) => (f.severity === "critical" || f.severity === "high") && !oldKeys.has(issueKey(f)));
    const d = scoreDelta(q.score, q2.score);
    const worse = q2.score.overall < q.score.overall - 0.05 || q2.score.counts.critical > q.score.counts.critical;
    if (worse || introduced.length) {
      const reason = introduced.length ? `a introdus ${introduced.length} probleme mari noi (${introduced[0].problem})` : `scorul a scăzut (${q.score.overall} → ${q2.score.overall})`;
      rejectVersion(projectId, compiled.versionId, reason, cur);
      for (const f of pick) banned.add(issueKey(f));
      log(`  ↩ rollback: ${compiled.versionId} ${reason}; rămân pe ${cur}`);
      iterations.push({ n: i, from: cur, to: compiled.versionId, fixes: pick.map((f) => ({ issueId: f.id, severity: f.severity, problem: f.problem, ops: f.suggestedFix })), before: q.score, after: q2.score, delta: d.overall, decision: "rolled-back", reason, impact: plan, renders: q2.renders });
      continue;
    }
    iterations.push({ n: i, from: cur, to: compiled.versionId, fixes: pick.map((f) => ({ issueId: f.id, severity: f.severity, problem: f.problem, ops: f.suggestedFix })), before: q.score, after: q2.score, delta: d.overall, decision: "kept", reason: `scor ${q.score.overall} → ${q2.score.overall}`, impact: plan, renders: q2.renders });
    log(`  ✓ ${compiled.versionId}: ${q.score.overall} → ${q2.score.overall} (${q2.score.verdict})`);
    const progressed = d.overall >= cfg.minScoreImprovement || q2.score.counts.high < q.score.counts.high || q2.score.counts.critical < q.score.counts.critical;
    cur = compiled.versionId;
    q = q2;
    if (!progressed) {
      stopReason = `Îmbunătățirea (${d.overall}) e sub pragul minim (${cfg.minScoreImprovement}): mă opresc.`;
      break;
    }
  }
  const needsHuman = prioritize(q.issues.filter((f) => f.status === "open" && (!f.autoFixable || f.confidence < cfg.autoFixMinConfidence || banned.has(issueKey(f))) && f.severity !== "low")).map((f) => ({ ...f, status: "needs-human" as const }));
  const report: AutoFixReport = { startVersion: start, finalVersion: cur, depth, iterations, stopReason, needsHuman, finalScore: q.score, checkpoint: iterations.length >= 3 };
  fs.writeFileSync(versionFile(projectId, cur, "autofix.json"), JSON.stringify(report, null, 2));
  updateState(projectId, {
    decision: `Corectură automată ${start} → ${cur}: ${iterations.filter((x) => x.decision === "kept").length} iterații păstrate, ${iterations.filter((x) => x.decision === "rolled-back").length} respinse; ${q.score.overall}/100 ${q.score.verdict}.`,
    next: needsHuman.length ? [`${needsHuman.length} probleme cer decizie creativă (vezi versions/${cur}/autofix.json).`, "Randează preview-ul pentru utilizator (mms quality --depth final)."] : ["Randează preview-ul pentru utilizator (mms quality --depth final)."],
  });
  return report;
}
