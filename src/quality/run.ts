/**
 * Bucla de calitate adaptivă: rulează cele 10 pase cu metoda cea mai ieftină permisă de adâncime,
 * refolosește tot ce nu s-a schimbat (cadre, mișcare, video) și scrie un raport cu ce s-a făcut efectiv.
 *
 *   fast      fără randare: schema, reguli, timeline, raportul audio
 *   standard  + un cadru-cheie randat pe scenă (doar scenele schimbate; restul din cache)
 *   deep      + secvențe de cadre pe scene (mișcarea reală)
 *   final     + video-ul întreg (randat doar dacă nu există unul la zi pentru exact acest timeline și mix)
 *
 * Rezultatul devine o rundă de critică (același reviewer, aceeași rubrică, aceeași adâncime ⇒ comparabilă)
 * cu scorul quality-v1, plus versions/vN/quality.json (pase, metode, cache, randări, probleme).
 */
import fs from "node:fs";
import path from "node:path";
import { fingerprint, fileFingerprint } from "../core/hash";
import { readJson, writeJson } from "../core/json";
import { MmsError } from "../core/errors";
import { projectPublicPath } from "../core/paths";
import { MixReport, type CritiqueRound, type Finding, type QualityCategory, type QualityScore, type Timeline } from "../core/schema";
import { REVIEWER, loopDecision, type LoopDecision } from "../critique/auto";
import { analyzeSample, pickSamples, type PixelMetrics } from "../critique/pixel";
import { DIRECTIONS } from "../creative/directions";
import { thumbnail } from "../assets/analyze";
import { frameDiff, readFrames } from "../assets/frames";
import { platformProfile } from "../platform/profiles";
import { renderCodeHash, renderStills, renderTimelineVideo } from "../renderer/node/render";
import type { VideoCheck } from "../renderer/node/analyze-video";
import { compileTimeline, type VoiceClipRef } from "../timeline/compile";
import { validateTimeline } from "../timeline/validate";
import { currentInputs, sceneContentKey, timelineRenderKey } from "../pipeline/impact";
import { hasFile, listVersions, loadAssets, loadBrand, loadBrief, loadCritique, loadProject, loadResearch, loadScript, loadStoryboard, loadTimeline, loadVersionMeta, projectDir, saveCritique, updateState, versionFile } from "../projects/store";
import { CHECKS, DEPTH_MAX_COST, METHOD_COST, PASSES, type CheckContext, type CheckServices, type Depth, type MotionResult, type StillResult } from "./checks";
import { dedupe, makeIssue, prioritize, type IssueDraft } from "./issues";
import { resolveQualityConfig, scoreQuality } from "./score";

export type Log = (m: string) => void;

export interface CheckReport {
  id: string;
  title: string;
  pass: string;
  method: string;
  status: "ran" | "cached" | "skipped";
  reason?: string;
  issues: number;
  ms: number;
  formats: string[];
}

export interface QualityRun {
  model: "quality-v1";
  at: string;
  projectId: string;
  versionId: string;
  depth: Depth;
  formats: string[];
  round: number;
  passes: Array<{ id: string; n: number; title: string; checks: CheckReport[] }>;
  renders: { stillsRendered: number; stillsReused: number; motionFramesRendered: number; motionScenesReused: number; fullRendered: number; fullReused: number };
  issues: Finding[];
  score: QualityScore;
  rubric: { minScene: number | null; overall: Record<string, number> | null };
  /** observațiile deschise ale lui Claude (claude-visual) și ale utilizatorului pe această versiune */
  external: Finding[];
  durationMs: number;
  limits: string[];
}

export interface QualityRunOptions {
  versionId?: string;
  depth?: Depth;
  /** formatele verificate (implicit toate) */
  formats?: string[];
  log?: Log;
  /** ignoră cache-ul de cadre/mișcare (re-randare forțată) */
  force?: boolean;
  /** la adâncimea final: callback de progres pentru randarea video */
  onProgress?: (p: number) => void;
}

const LIMITS = [
  "Textul se măsoară pe pixeli doar pentru straturile fixe pe ecran (adâncime 0); textul din captură se verifică geometric (ui.legibility).",
  "Aglomerarea, spațiul gol și compoziția sunt euristici (încredere ≤ 0,55) și nu declanșează corecturi automate.",
  "Sunetul se judecă de om (regula 15): verificarea audio e tehnică (loudness, vârfuri, tăceri, sincron), nu estetică.",
  "Ideea creativă se evaluează de Claude (revizuirea claude-visual) și de utilizator; motorul verifică structura și execuția.",
];

/** Rundele critice anterioare ale proiectului (fără versiunile respinse), pentru numerotare și comparație. */
export function collectRounds(projectId: string): CritiqueRound[] {
  const out: CritiqueRound[] = [];
  for (const v of listVersions(projectId)) {
    if (v.status === "rejected") continue;
    try {
      out.push(...loadCritique(projectId, v.id).rounds.filter((r) => r.reviewer === REVIEWER));
    } catch {
      /* versiune fără critică */
    }
  }
  return out.sort((a, b) => a.n - b.n);
}

/**
 * Cadrele-cheie ale unui timeline (unul pe scenă, în fereastra de hold), randate doar pentru scenele al căror
 * conținut nu e deja în cache, plus analiza lor pe pixeli. Cheia: conținutul scenei + cadrul local + codul de randare.
 */
export async function keyStills(projectId: string, t: Timeline, o: { force?: boolean; log?: Log; scale?: number } = {}): Promise<{ stills: StillResult[]; rendered: number; reused: number }> {
  const scale = o.scale ?? 0.4;
  const code = renderCodeHash();
  const samples = pickSamples(t);
  const dir = path.join(projectDir(projectId), "cache", "quality", "stills");
  fs.mkdirSync(dir, { recursive: true });
  const keyed = samples.map((s) => ({ s, key: fingerprint({ v: 1, scene: sceneContentKey(t, t.scenes.find((x) => x.id === s.sceneId)!), local: s.local, scale, code }) }));
  const missing = keyed.filter((k) => o.force || !fs.existsSync(path.join(dir, `${k.key}.json`)) || !fs.existsSync(path.join(dir, `${k.key}.jpg`)));
  if (missing.length) {
    o.log?.(`  cadre-cheie [${t.formatId}]: randez ${missing.length} (din ${samples.length}; restul din cache)`);
    const tmp = path.join(dir, `tmp-${process.pid}`);
    const files = await renderStills(t, missing.map((m) => m.s.frame), tmp, { format: "jpeg", scale, prefix: "q" });
    for (let i = 0; i < missing.length; i++) {
      const { s, key } = missing[i];
      const jpg = path.join(dir, `${key}.jpg`);
      fs.renameSync(files[i], jpg);
      const img = await thumbnail(jpg, Math.round(t.width * scale), 0, Math.round(t.height * scale));
      if (!img) throw new MmsError("STILL_READ", `Nu pot citi cadrul randat ${jpg}.`);
      const a = analyzeSample(img, t, s);
      // problemele se păstrează relativ la scenă: scena mutată în timp își refolosește analiza
      writeJson(path.join(dir, `${key}.json`), { metrics: a.metrics, issues: a.issues.map((d) => ({ ...d, frame: null })), local: s.local });
    }
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  const stills = keyed.map(({ s, key }) => {
    const c = JSON.parse(fs.readFileSync(path.join(dir, `${key}.json`), "utf8")) as { metrics: PixelMetrics; issues: IssueDraft[] };
    return { sceneId: s.sceneId, frame: s.frame, local: s.local, file: path.join(dir, `${key}.jpg`), cached: !missing.some((m) => m.key === key), metrics: c.metrics, issues: c.issues.map((d) => ({ ...d, frame: s.frame, formatId: t.formatId })) };
  });
  return { stills, rendered: missing.length, reused: samples.length - missing.length };
}

export async function runQuality(projectId: string, o: QualityRunOptions = {}): Promise<{ run: QualityRun; round: CritiqueRound; decision: LoopDecision }> {
  const started = Date.now();
  const log = o.log ?? (() => undefined);
  const depth = o.depth ?? "standard";
  const project = loadProject(projectId);
  const requested = o.versionId ?? project.currentVersion;
  if (!requested) throw new MmsError("NO_VERSION", "Proiectul nu are încă o versiune compilată.");
  const versionId: string = requested;
  const formats = project.formats.filter((f) => !o.formats || o.formats.includes(f.id));
  if (!formats.length) throw new MmsError("FORMAT_MISSING", `Formatul cerut nu există în proiect (${o.formats?.join(", ")}).`);
  const primary = formats[0];
  const timelines: Record<string, Timeline> = {};
  for (const f of formats) {
    if (!hasFile(projectId, `versions/${versionId}/timeline-${f.id}.json`)) throw new MmsError("NOT_COMPILED", `Versiunea ${versionId} nu are timeline pentru ${f.id}.`, `Compilează întâi: npm run mms -- compile ${projectId}`);
    timelines[f.id] = loadTimeline(projectId, versionId, f.id);
  }
  const brief = loadBrief(projectId);
  const research = loadResearch(projectId);
  const assets = loadAssets(projectId);
  const storyboard = loadStoryboard(projectId, versionId);
  const script = loadScript(projectId, versionId);
  const brand = hasFile(projectId, "brand.json") ? loadBrand(projectId) : null;
  const mixFile = versionFile(projectId, versionId, "audio/mix-report.json");
  const mix = fs.existsSync(mixFile) ? readJson(mixFile, MixReport) : null;
  const config = resolveQualityConfig(project.quality);
  const prior = collectRounds(projectId);
  const round = prior.length ? Math.max(...prior.map((r) => r.n)) + 1 : 1;
  const renders = { stillsRendered: 0, stillsReused: 0, motionFramesRendered: 0, motionScenesReused: 0, fullRendered: 0, fullReused: 0 };
  const cacheDir = path.join(projectDir(projectId), "cache", "quality");
  const code = renderCodeHash();

  // ─── servicii scumpe, cu cache pe amprente (refolosite între versiuni și runde)
  const stillsMemo = new Map<string, Promise<StillResult[]>>();
  const motionMemo = new Map<string, Promise<MotionResult[]>>();
  const videoMemo = new Map<string, Promise<VideoCheck | null>>();
  const services: CheckServices = {
    stills: (fid) => {
      if (!stillsMemo.has(fid)) stillsMemo.set(fid, computeStills(fid));
      return stillsMemo.get(fid)!;
    },
    sceneMotion: (fid) => {
      if (!motionMemo.has(fid)) motionMemo.set(fid, computeMotion(fid));
      return motionMemo.get(fid)!;
    },
    fullVideo: (fid) => {
      if (!videoMemo.has(fid)) videoMemo.set(fid, computeVideo(fid));
      return videoMemo.get(fid)!;
    },
    recompile: (fid) => {
      const voicePath = versionFile(projectId, versionId, "audio/voice.json");
      if (!fs.existsSync(voicePath) || !brand) return null;
      const voice = JSON.parse(fs.readFileSync(voicePath, "utf8")) as Record<string, VoiceClipRef>;
      const t = timelines[fid];
      return compileTimeline({ project, versionId, format: formats.find((f) => f.id === fid)!, brief, brand, research, assets, script, storyboard, voice, beatGrid: t.audio.beatGrid }).timeline;
    },
  };

  async function computeStills(fid: string): Promise<StillResult[]> {
    const r = await keyStills(projectId, timelines[fid], { force: o.force, log });
    renders.stillsRendered += r.rendered;
    renders.stillsReused += r.reused;
    return r.stills;
  }

  async function computeMotion(fid: string): Promise<MotionResult[]> {
    const t = timelines[fid];
    const dir = path.join(cacheDir, "motion");
    fs.mkdirSync(dir, { recursive: true });
    const step = Math.max(2, Math.round(t.fps / 6));
    const plan = t.scenes.map((s) => ({ s, key: fingerprint({ v: 1, scene: sceneContentKey(t, s), step, code }) }));
    const out: MotionResult[] = [];
    const todo = plan.filter((p) => o.force || !fs.existsSync(path.join(dir, `${p.key}.json`)));
    if (todo.length) {
      const w = 64;
      const sampleFps = t.fps / step;
      const curveOf = (seq: Uint8Array[]) => seq.slice(1).map((f, k) => Math.round(frameDiff(seq[k], f) * 10000) / 10000);
      const preview = versionFile(projectId, versionId, `renders/preview-${fid}.mp4`);
      if (DEPTH_MAX_COST[depth] >= METHOD_COST["full-render"] && (await services.fullVideo(fid)) && fs.existsSync(preview)) {
        // la final QA video-ul întreg există deja: mișcarea se citește din el, fără nicio randare în plus
        log(`  mișcare [${fid}]: citesc ${todo.length} scene din preview-ul randat (fără randare suplimentară)`);
        const seq = await readFrames(preview, { fps: sampleFps, width: w });
        for (const p of todo) {
          const a0 = Math.floor((p.s.from / t.fps) * sampleFps);
          const a1 = Math.ceil(((p.s.from + p.s.durationInFrames) / t.fps) * sampleFps);
          writeJson(path.join(dir, `${p.key}.json`), { curve: curveOf(seq.frames.slice(a0, a1)), stepFrames: step, source: "preview" });
        }
      } else {
        // fără video întreg: doar scenele schimbate, ca video mic și mut (mult mai ieftin decât cadre separate)
        const tmp = path.join(dir, `tmp-${process.pid}`);
        fs.mkdirSync(tmp, { recursive: true });
        for (const p of todo) {
          const out = path.join(tmp, `${p.key}.mp4`);
          log(`  mișcare [${fid}]: randez scena ${p.s.id} la rezoluție mică (${(p.s.durationInFrames / t.fps).toFixed(1)} s)`);
          await renderTimelineVideo({ ...t, captions: null }, { out, frameRange: [p.s.from, p.s.from + p.s.durationInFrames - 1], muted: true, scale: 0.2, crf: 28 });
          const seq = await readFrames(out, { fps: sampleFps, width: w });
          renders.motionFramesRendered += p.s.durationInFrames;
          writeJson(path.join(dir, `${p.key}.json`), { curve: curveOf(seq.frames), stepFrames: step, source: "scene-render" });
        }
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    }
    renders.motionScenesReused += plan.length - todo.length;
    for (const p of plan) {
      const c = JSON.parse(fs.readFileSync(path.join(dir, `${p.key}.json`), "utf8")) as { curve: number[]; stepFrames: number };
      out.push({ sceneId: p.s.id, cached: !todo.includes(p), curve: c.curve, stepFrames: c.stepFrames });
    }
    return out;
  }

  async function computeVideo(fid: string): Promise<VideoCheck | null> {
    const t = timelines[fid];
    const mixHash = fileFingerprint(versionFile(projectId, versionId, "audio/mix.wav"));
    const key = timelineRenderKey(t, mixHash);
    const checkFile = versionFile(projectId, versionId, `renders/check-${fid}.json`);
    if (!o.force && fs.existsSync(checkFile)) {
      const c = JSON.parse(fs.readFileSync(checkFile, "utf8")) as VideoCheck & { renderKey?: string };
      if (c.renderKey === key) {
        renders.fullReused++;
        log(`  video [${fid}]: preview-ul existent e la zi (aceeași imagine și același sunet): nu re-randez.`);
        return c;
      }
    }
    if (DEPTH_MAX_COST[depth] < METHOD_COST["full-render"]) return null;
    const { stepPreview } = await import("../pipeline/steps");
    const r = await stepPreview(projectId, versionId, fid, log, { onProgress: o.onProgress });
    if ((r as { reused?: boolean }).reused) renders.fullReused++;
    else renders.fullRendered++;
    return r.check;
  }

  const meta = loadVersionMeta(projectId, versionId);
  const validation = Object.fromEntries(formats.map((f) => [f.id, validateTimeline(timelines[f.id], { assets, research, format: f })]));
  const ctx: CheckContext = {
    project,
    versionId,
    brief,
    brand,
    research,
    assets,
    script,
    storyboard,
    formats,
    primary,
    timelines,
    validation,
    mix,
    dir: DIRECTIONS[storyboard.direction ?? brief.direction ?? "technical"],
    profiles: Object.fromEntries(formats.map((f) => [f.id, platformProfile(f.platform, project)])),
    inputsNow: currentInputs(projectId),
    inputsAtCompile: meta.inputs,
    round,
    rubric: { minScene: null, overall: null, sceneScores: [] },
    services,
  };

  log(`Bucla de calitate pe ${versionId} (adâncime ${depth}, ${formats.map((f) => f.id).join(", ")})`);
  const max = DEPTH_MAX_COST[depth];
  const drafts: IssueDraft[] = [];
  const passReports: QualityRun["passes"] = [];
  const evaluated = new Set<QualityCategory>();
  for (const pass of PASSES) {
    const checks: CheckReport[] = [];
    for (const c of CHECKS.filter((x) => x.pass === pass.id)) {
      const fids = c.perFormat ? formats.map((f) => f.id) : [primary.id];
      if (METHOD_COST[c.method] > max) {
        checks.push({ id: c.id, title: c.title, pass: pass.id, method: c.method, status: "skipped", reason: `metoda „${c.method}” e peste adâncimea „${depth}”`, issues: 0, ms: 0, formats: fids });
        continue;
      }
      const t0 = Date.now();
      const before = renders.stillsRendered + renders.motionFramesRendered + renders.fullRendered;
      let n = 0;
      for (const fid of fids) {
        const found = await c.run(ctx, fid);
        n += found.length;
        drafts.push(...found.map((d) => ({ method: c.method, ...d })));
      }
      const rendered = renders.stillsRendered + renders.motionFramesRendered + renders.fullRendered - before;
      const expensive = METHOD_COST[c.method] >= METHOD_COST.stills;
      for (const cat of c.categories) evaluated.add(cat);
      checks.push({ id: c.id, title: c.title, pass: pass.id, method: c.method, status: expensive && rendered === 0 ? "cached" : "ran", issues: n, ms: Date.now() - t0, formats: fids });
    }
    passReports.push({ id: pass.id, n: pass.n, title: pass.title, checks });
    const total = checks.reduce((s, x) => s + x.issues, 0);
    log(`  PASS ${pass.n} ${pass.title}: ${checks.filter((x) => x.status !== "skipped").length}/${checks.length} verificări, ${total} probleme${checks.some((x) => x.status === "cached") ? " (cache)" : ""}`);
  }

  const fps = timelines[primary.id].fps;
  const issues = prioritize(dedupe(drafts.map((d, i) => makeIssue(d, `q${round}-${i + 1}`, round, d.formatId ? timelines[d.formatId]?.fps ?? fps : fps))));
  const score = scoreQuality({ issues, evaluated, config, rubricMinScene: ctx.rubric.minScene });
  // observațiile lui Claude și ale utilizatorului pe această versiune: nu intră în scorul comparabil, dar blochează PASS
  const external = loadCritique(projectId, versionId).rounds.filter((r) => r.reviewer !== REVIEWER).flatMap((r) => r.findings.filter((f) => f.status === "open"));
  const extBlocking = external.filter((f) => f.severity === "critical" || f.severity === "high");
  if (extBlocking.length && (score.verdict === "PASS" || score.verdict === "POLISH")) {
    score.verdict = "FIX";
    score.reasons.push(`${extBlocking.length} observații mari deschise de la Claude/utilizator pe această versiune.`);
  }
  const at = new Date().toISOString();
  const critiqueRound: CritiqueRound = {
    n: round,
    at,
    versionId,
    reviewer: REVIEWER,
    rubricVersion: "rubric-v1",
    sceneScores: ctx.rubric.sceneScores,
    findings: issues,
    overall: (ctx.rubric.overall ?? {}) as CritiqueRound["overall"],
    minScene: ctx.rubric.minScene ?? 0,
    quality: score,
    depth,
    formatId: primary.id,
  };
  const critique = loadCritique(projectId, versionId);
  critique.threshold = config.sceneRubricThreshold;
  critique.rounds.push(critiqueRound);
  saveCritique(projectId, versionId, critique);
  const run: QualityRun = { model: "quality-v1", at, projectId, versionId, depth, formats: formats.map((f) => f.id), round, passes: passReports, renders, issues, score, rubric: { minScene: ctx.rubric.minScene, overall: ctx.rubric.overall }, external, durationMs: Date.now() - started, limits: LIMITS };
  // raportul descrie verificarea, nu modifică versiunea: se scrie și pe o versiune înghețată
  writeJson(versionFile(projectId, versionId, "quality.json"), run);
  const decision = loopDecision({ ...critique, rounds: [...prior, critiqueRound] });
  updateState(projectId, { step: "critique", stepState: score.verdict === "PASS" ? "done" : "pending", note: `runda ${round}: ${score.overall}/100 ${score.verdict} (${depth})`, log: `Calitate ${versionId} runda ${round} (${depth}): ${score.overall}/100, ${score.verdict}; randate ${renders.stillsRendered} cadre (${renders.stillsReused} din cache), video ${renders.fullRendered} randat / ${renders.fullReused} refolosit.` });
  log(`Scor ${score.overall}/100 · ${score.verdict} · critice ${score.counts.critical}, mari ${score.counts.high}, medii ${score.counts.medium}, mici ${score.counts.low} · ${((Date.now() - started) / 1000).toFixed(1)} s`);
  return { run, round: critiqueRound, decision };
}

/** Raportul ultimei rulări pe o versiune, dacă există. */
export function loadQualityRun(projectId: string, versionId: string): QualityRun | null {
  const f = versionFile(projectId, versionId, "quality.json");
  return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, "utf8")) as QualityRun) : null;
}

/** Căile publice ale cadrelor-cheie din cache pentru o versiune (pentru revizuirea vizuală a lui Claude). */
export function stillsPublicPaths(projectId: string, files: string[]): string[] {
  return files.map((f) => projectPublicPath(projectId, path.relative(projectDir(projectId), f).replace(/\\/g, "/")));
}
