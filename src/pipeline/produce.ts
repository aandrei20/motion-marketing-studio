/**
 * Producția cap-coadă cu bucla de calitate adaptivă (folosită de `mms make` și de Studio):
 *
 *   script → storyboard → voce → timeline → mix
 *   → verificare ieftină (fără randare) + cadre-cheie (doar scenele schimbate)
 *   → corecturi automate sigure, cu rollback
 *   → UN SINGUR preview randat, la predare (sau refolosit dacă imaginea și sunetul nu s-au schimbat)
 *   → final QA pe video-ul randat → utilizatorul privește, ascultă și decide.
 *
 * Nu se face randare completă la fiecare pas: randarea întreagă apare doar când omul trebuie să vadă
 * rezultatul (sau la export, după „render final”).
 */
import { MmsError, throwIfCancelled } from "../core/errors";
import { ensureConcepts } from "../creative/concepts";
import type { Depth } from "../quality/checks";
import { autoFixLoop, type AutoFixReport } from "../quality/autofix";
import { runQuality, type QualityRun } from "../quality/run";
import { hasFile, loadProject } from "../projects/store";
import { stepAudio, stepCompile, stepScript, stepStoryboard, stepVoice, type Log } from "./steps";

export interface ProduceOptions {
  log?: Log;
  /** etapa curentă (pentru Studio: „research”, „timeline”, „calitate”…) */
  stage?: (name: string) => void;
  onProgress?: (p: number) => void;
  /** adâncimea verificărilor din buclă (implicit standard: cadre-cheie, fără video) */
  depth?: Depth;
  autofix?: boolean;
  /** randează preview-ul pentru utilizator la final (implicit da) */
  preview?: boolean;
  signal?: AbortSignal;
}

export interface ProduceReport {
  versionId: string;
  first: QualityRun;
  autofix: AutoFixReport | null;
  final: QualityRun | null;
}

export async function produce(projectId: string, o: ProduceOptions = {}): Promise<ProduceReport> {
  const log = o.log ?? (() => undefined);
  const stage = (name: string) => {
    throwIfCancelled(o.signal);
    (o.stage ?? (() => undefined))(name);
  };
  const p = loadProject(projectId);
  if (p.status === "intake")
    throw new MmsError("BRIEF_NOT_APPROVED", "Brief-ul nu e aprobat.", `Utilizatorul scrie „aprob”: npm run mms -- approve ${projectId} brief "aprob"`);
  stage("concept");
  const concepts = ensureConcepts(projectId);
  const chosen = concepts.concepts.find((c) => c.id === concepts.selectedId);
  if (chosen) log(`Concept: ${chosen.title} (${chosen.total}/100, ${chosen.origin === "user" ? "al tău" : "sugestie"}) – ${chosen.bigIdea}`);
  for (const r of concepts.rationale.slice(0, 2)) log(`  ${r}`);
  stage("script");
  const s = stepScript(projectId);
  s.issues
    .filter((i) => i.severity === "critical")
    .forEach((i) => {
      log(`! script: ${i.message}`);
    });
  stage("storyboard");
  stepStoryboard(projectId).rationale.forEach((x) => {
    log(`• ${x}`);
  });
  stage("voce");
  const v0 = loadProject(projectId).currentVersion!;
  if (!hasFile(projectId, `versions/${v0}/audio/voice.json`)) await stepVoice(projectId, v0, log);
  stage("timeline");
  const c = await stepCompile(projectId, loadProject(projectId).currentVersion!, log);
  c.warnings.forEach((w) => {
    log(`! ${w}`);
  });
  stage("audio");
  const mixR = await stepAudio(projectId, c.versionId, log);
  log(`Audio: ${mixR.integratedLufs} LUFS, TP ${mixR.truePeakDbtp} dBTP${mixR.ok ? "" : ` – ${mixR.problems.join("; ")}`}`);
  stage("calitate");
  const depth = o.depth ?? "standard";
  const first = (await runQuality(projectId, { versionId: c.versionId, depth, log, signal: o.signal })).run;
  let fix: AutoFixReport | null = null;
  if (o.autofix !== false && first.score.verdict !== "PASS") {
    stage("corecturi");
    fix = await autoFixLoop(projectId, { depth, log, signal: o.signal });
    log(`Corecturi: ${fix.stopReason}`);
  }
  let final: QualityRun | null = null;
  const versionId = loadProject(projectId).currentVersion!;
  if (o.preview !== false) {
    stage("preview");
    final = (await runQuality(projectId, { versionId, depth: "final", log, onProgress: o.onProgress, signal: o.signal })).run;
  }
  stage("revizuire");
  return { versionId, first, autofix: fix, final };
}
