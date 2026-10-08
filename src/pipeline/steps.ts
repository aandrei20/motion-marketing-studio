/**
 * Pașii de producție, fiecare idempotent și cu STATE.md actualizat. Îi folosesc CLI-ul (mms),
 * Studio-ul (serverul local) și comenzile din Claude Code.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ingestCapture } from "../assets/ingest";
import { detectBeatGrid } from "../audio/beat";
import { decodeAudio } from "../audio/decode";
import { mix } from "../audio/mixer";
import { composeMusic } from "../audio/music";
import { getSfx } from "../audio/sfx";
import { synthesize, voiceFromFile, type VoiceProvider } from "../audio/voice";
import { readWav, writeWav } from "../audio/wav";
import { inferBrand } from "../brand/infer";
import { capture, type CaptureRequestInput, type CaptureResult, type PageData } from "../capture/capture";
import { MmsError } from "../core/errors";
import { readJson, writeJson } from "../core/json";
import { PATHS, projectPublicPath } from "../core/paths";
import { formatTimecode } from "../core/time";
import type { BeatGrid, MixReport, Timeline } from "../core/schema";
import { MixReport as MixReportSchema } from "../core/schema";
import { DIRECTIONS } from "../creative/directions";
import { draftScript, validateScript } from "../creative/script";
import { buildStoryboard } from "../creative/storyboard";
import { chooseTemplate, getTemplate } from "../creative/templates";
import { analyzeVideo } from "../renderer/node/analyze-video";
import { closeBrowser, renderContactSheet, renderStills, renderTimelineVideo } from "../renderer/node/render";
import { extractFromPage, mergeIntoResearch } from "../research/extract";
import { compileTimeline, type VoiceClipRef } from "../timeline/compile";
import { validateTimeline, type ValidationResult } from "../timeline/validate";
import {
  addApproval,
  freezeVersion,
  hasFile,
  loadApprovals,
  loadAssets,
  loadBrand,
  loadBrief,
  loadProject,
  loadResearch,
  loadScript,
  loadStoryboard,
  loadTimeline,
  loadVersionMeta,
  projectDir,
  saveBrand,
  saveProject,
  saveScript,
  saveStoryboard,
  saveTimeline,
  setVersionStatus,
  updateState,
  versionFile,
  writableVersion,
  writeVersionJson,
} from "../projects/store";

export type Log = (msg: string) => void;
const noop: Log = () => undefined;

// ─── captură + research + brand ─────────────────────────────────────────────

export async function stepCapture(projectId: string, reqs: CaptureRequestInput[], log: Log = noop, opts: { headed?: boolean } = {}): Promise<CaptureResult[]> {
  const out: CaptureResult[] = [];
  const dir = path.join(projectDir(projectId), "captures");
  for (const r of reqs) {
    log(`Captură ${r.id}: ${r.url} (${r.viewport ?? "desktop"}${r.fullPage ? ", pagină întreagă" : ""}${r.record ? ", înregistrare" : ""})`);
    const res = await capture(r, dir, opts);
    await ingestCapture(projectId, res);
    let claims = 0;
    if (res.research && !r.record) {
      const ex = extractFromPage(res.page, { capturedAt: res.capturedAt });
      mergeIntoResearch(projectId, ex, res.page.fullText);
      claims = ex.claims.length;
    }
    log(`  → ${res.regions.length} zone, ${claims} afirmații extrase, ${res.pii.length} zone cu date personale`);
    out.push(res);
  }
  updateState(projectId, { step: "capture", note: `${reqs.length} capturi`, log: `Capturi reale: ${reqs.map((r) => r.id).join(", ")}.` });
  updateState(projectId, { step: "assets" });
  return out;
}

/** Capturează produsul demo inclus (pentru teste), cu URL file://. */
export function demoUrl(page: "index.html" | "app.html"): string {
  return pathToFileURL(path.join(PATHS.examples, "demo-product", "site", page)).href;
}

export function stepBrand(projectId: string, opts: { force?: boolean; personality?: string[] } = {}): { notes: string[] } {
  if (hasFile(projectId, "brand.json") && !opts.force) return { notes: ["Brand kit existent păstrat (folosește --force ca să-l regenerezi)."] };
  const project = loadProject(projectId);
  const assets = loadAssets(projectId);
  const capDir = path.join(projectDir(projectId), "captures");
  let page: PageData | null = null;
  if (fs.existsSync(capDir)) {
    const caps = fs
      .readdirSync(capDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => readJsonLoose<CaptureResult>(path.join(capDir, f)));
    page = (caps.find((c) => !c.fullPage) ?? caps[0])?.page ?? null;
  }
  const logo = assets.assets.find((a) => a.role === "logo") ?? null;
  const { brand, notes } = inferBrand(project.product.name, page, logo, opts.personality ?? []);
  saveBrand(projectId, brand);
  updateState(projectId, { step: "brand", note: notes.join(" "), log: "Brand kit dedus din materiale reale." });
  return { notes };
}

function readJsonLoose<T>(f: string): T {
  return JSON.parse(fs.readFileSync(f, "utf8")) as T;
}

// ─── script și storyboard ───────────────────────────────────────────────────

export function stepScript(projectId: string, opts: { force?: boolean } = {}): { versionId: string; issues: ReturnType<typeof validateScript> } {
  const project = loadProject(projectId);
  const brief = loadBrief(projectId);
  const research = loadResearch(projectId);
  const v = writableVersion(projectId, [{ at: new Date().toISOString(), op: "draft-script", description: "Schiță de script din brief și research.", params: {} }]);
  if (hasFile(projectId, `versions/${v}/script.json`) && !opts.force) {
    const s = loadScript(projectId, v);
    return { versionId: v, issues: validateScript(s, brief, research) };
  }
  if (!project.language.text) throw new MmsError("LANGUAGE_MISSING", "Limba textului nu e aleasă.", "Răspunde la întrebarea E (limba textului și a vocii) din brief.");
  const script = draftScript(brief, research, { textLanguage: project.language.text, voiceLanguage: project.language.voice, productName: project.product.name });
  saveScript(projectId, v, script);
  const issues = validateScript(script, brief, research);
  updateState(projectId, { step: "script", note: `${script.lines.length} replici, ${issues.filter((i) => i.severity === "blocker").length} blocaje`, log: `Script schiță în ${v}.` });
  return { versionId: v, issues };
}

export function stepStoryboard(projectId: string, opts: { force?: boolean; templateId?: string } = {}): { versionId: string; rationale: string[] } {
  const project = loadProject(projectId);
  const brief = loadBrief(projectId);
  const v = writableVersion(projectId);
  if (hasFile(projectId, `versions/${v}/storyboard.json`) && !opts.force) return { versionId: v, rationale: loadStoryboard(projectId, v).rationale };
  const tpl = opts.templateId ? { template: getTemplate(opts.templateId), why: "ales explicit" } : chooseTemplate({ category: project.product.category, direction: brief.direction, durationSec: brief.durationSec, objective: brief.objective });
  const sb = buildStoryboard({ template: tpl.template, script: loadScript(projectId, v), brief, research: loadResearch(projectId), assets: loadAssets(projectId).assets, productName: project.product.name });
  sb.rationale.unshift(`Șablonul „${tpl.template.id}”: ${tpl.why}.`);
  saveStoryboard(projectId, v, sb);
  updateState(projectId, { step: "storyboard", note: `${sb.scenes.length} scene`, log: `Storyboard în ${v} din șablonul ${tpl.template.id}.` });
  return { versionId: v, rationale: sb.rationale };
}

// ─── voce ───────────────────────────────────────────────────────────────────

export async function stepVoice(projectId: string, versionId: string, log: Log = noop): Promise<Record<string, VoiceClipRef>> {
  const brief = loadBrief(projectId);
  const script = loadScript(projectId, versionId);
  const out: Record<string, VoiceClipRef> = {};
  const vm = brief.audio.voice;
  if (vm.mode === "none") {
    writeVersionJson(projectId, versionId, "audio/voice.json", out);
    return out;
  }
  const cacheDir = path.join(projectDir(projectId), "cache", "tts");
  if (vm.mode === "user-file") {
    if (!vm.assetId) throw new MmsError("VOICE_MISSING", "Brief-ul cere vocea utilizatorului, dar nu indică fișierul (audio.voice.assetId).");
    const a = loadAssets(projectId).assets.find((x) => x.id === vm.assetId);
    if (!a) throw new MmsError("VOICE_MISSING", `Nu există materialul ${vm.assetId}.`);
    const transcript = script.lines.map((l) => l.voiceover).join(" ");
    const r = await voiceFromFile(path.join(projectDir(projectId), a.file), transcript);
    const file = path.join(cacheDir, `user-${a.id}.wav`);
    writeWav(file, r.audio);
    const first = script.lines.find((l) => l.voiceover) ?? script.lines[0];
    out[first.id] = { lineId: first.id, src: projectPublicPath(projectId, path.relative(projectDir(projectId), file).replace(/\\/g, "/")), durationSec: r.audio.L.length / r.audio.sr, words: r.words };
  } else {
    if (!vm.provider || !vm.voiceId) throw new MmsError("VOICE_MISSING", "Lipsește furnizorul sau vocea TTS (audio.voice.provider / voiceId).", "Listează vocile cu: npm run mms -- voices");
    for (const l of script.lines) {
      if (!l.voiceover.trim()) continue;
      let text = l.voiceover;
      for (const p of l.pronunciation) text = text.split(p.text).join(p.say);
      log(`Voce „${l.id}”: ${text.slice(0, 60)}`);
      const r = await synthesize({ provider: vm.provider as VoiceProvider, voice: vm.voiceId, text, rate: vm.rate }, cacheDir);
      // marcajele de cuvinte folosesc textul afișat (nu varianta de pronunție)
      const shown = l.voiceover.split(/\s+/).filter(Boolean);
      const words = r.words.length === shown.length ? r.words.map((w, i) => ({ ...w, text: shown[i] })) : r.words;
      out[l.id] = { lineId: l.id, src: projectPublicPath(projectId, path.relative(projectDir(projectId), r.file).replace(/\\/g, "/")), durationSec: r.audio.L.length / r.audio.sr, words };
    }
  }
  writeVersionJson(projectId, versionId, "audio/voice.json", out);
  updateState(projectId, { log: `Voce: ${Object.keys(out).length} clipuri (${vm.mode}).` });
  return out;
}

// ─── compilare ──────────────────────────────────────────────────────────────

/** Beat grid-ul versiunii: din muzica utilizatorului (detectat) sau cel al muzicii sintetizate (ales). */
export async function planBeatGrid(projectId: string, versionId: string): Promise<BeatGrid | null> {
  const brief = loadBrief(projectId);
  const sb = loadStoryboard(projectId, versionId);
  if (brief.audio.music.mode === "none" || !sb.audio.music) return null;
  if (brief.audio.music.mode === "user-file") {
    const a = loadAssets(projectId).assets.find((x) => x.id === brief.audio.music.assetId);
    if (!a) throw new MmsError("MUSIC_MISSING", "Brief-ul cere muzica utilizatorului, dar fișierul nu e în materiale.");
    const g = detectBeatGrid(await decodeAudio(path.join(projectDir(projectId), a.file)));
    return brief.audio.music.bpm ? { ...g, bpm: brief.audio.music.bpm, source: "user" } : g;
  }
  const dir = DIRECTIONS[sb.direction ?? brief.direction ?? "technical"];
  const bpm = brief.audio.music.bpm ?? Math.round((dir.bpm[0] + dir.bpm[1]) / 2);
  return { bpm, offsetSec: 0, beatsPerBar: 4, source: "synth", confidence: 1, sections: [] };
}

export interface CompileStepResult {
  versionId: string;
  timelines: Record<string, Timeline>;
  validation: Record<string, ValidationResult>;
  warnings: string[];
  report: unknown;
}

export async function stepCompile(projectId: string, versionId: string, log: Log = noop): Promise<CompileStepResult> {
  const project = loadProject(projectId);
  const voicePath = versionFile(projectId, versionId, "audio/voice.json");
  const voice = fs.existsSync(voicePath) ? (JSON.parse(fs.readFileSync(voicePath, "utf8")) as Record<string, VoiceClipRef>) : await stepVoice(projectId, versionId, log);
  const beatGrid = await planBeatGrid(projectId, versionId);
  const base = { project, versionId, brief: loadBrief(projectId), brand: loadBrand(projectId), research: loadResearch(projectId), assets: loadAssets(projectId), script: loadScript(projectId, versionId), storyboard: loadStoryboard(projectId, versionId), voice, beatGrid };
  const timelines: Record<string, Timeline> = {};
  const validation: Record<string, ValidationResult> = {};
  const warnings: string[] = [];
  const reports: Record<string, unknown> = {};
  for (const format of project.formats) {
    log(`Compilez ${format.id} (${format.width}×${format.height} @ ${format.fps} fps, ${format.platform})`);
    const r = compileTimeline({ ...base, format });
    const val = validateTimeline(r.timeline, { assets: base.assets, research: base.research, format });
    saveTimeline(projectId, versionId, r.timeline);
    timelines[format.id] = r.timeline;
    validation[format.id] = val;
    warnings.push(...r.warnings.map((w) => `[${format.id}] ${w}`));
    reports[format.id] = { scenes: r.scenes, warnings: r.warnings, validation: val };
    log(`  → ${r.timeline.scenes.length} scene, ${(r.timeline.durationInFrames / format.fps).toFixed(2)} s, ${val.findings.length} observații (${val.findings.filter((f) => f.severity === "blocker").length} blocaje)`);
  }
  writeVersionJson(projectId, versionId, "compile-report.json", reports);
  // brief-ul folosit se păstrează lângă versiune (trasabilitate)
  writeVersionJson(projectId, versionId, "brief.snapshot.json", base.brief);
  updateState(projectId, { step: "compile", note: Object.entries(timelines).map(([k, t]) => `${k}: ${(t.durationInFrames / t.fps).toFixed(1)} s`).join(", "), log: `Timeline compilat în ${versionId}.` });
  return { versionId, timelines, validation, warnings, report: reports };
}

// ─── audio: muzică, efecte, voce, mix ───────────────────────────────────────

export async function stepAudio(projectId: string, versionId: string, log: Log = noop): Promise<MixReport> {
  const project = loadProject(projectId);
  const brief = loadBrief(projectId);
  const sb = loadStoryboard(projectId, versionId);
  const primary = project.formats[0];
  const t = loadTimeline(projectId, versionId, primary.id);
  const fps = t.fps;
  const durationSec = t.durationInFrames / fps;
  const silences = t.scenes
    .filter((s) => sb.scenes.find((x) => x.id === s.id)?.audio.silence)
    .map((s) => ({ startSec: s.from / fps, endSec: (s.from + s.durationInFrames) / fps }));
  let music: { audio: ReturnType<typeof composeMusic>["audio"]; gainDb: number } | undefined;
  if (brief.audio.music.mode === "synth" && sb.audio.music) {
    const bpm = t.audio.beatGrid?.bpm ?? 110;
    const dir = DIRECTIONS[sb.direction ?? brief.direction ?? "technical"];
    log(`Muzică sintetizată: ${bpm} BPM, dispoziție ${brief.audio.music.mood ?? dir.mood}`);
    const res = composeMusic({
      bpm,
      durationSec,
      mood: brief.audio.music.mood ?? dir.mood,
      seed: project.seed,
      sections: t.scenes.map((s) => ({ startSec: s.from / fps, endSec: (s.from + s.durationInFrames) / fps, energy: s.meta.energy, name: s.id })),
      accents: t.scenes.filter((s) => s.meta.narrativeRole === "reveal").map((s) => s.from / fps),
      silences,
    });
    music = { audio: res.audio, gainDb: sb.audio.musicGainDb };
  } else if (brief.audio.music.mode === "user-file" && sb.audio.music) {
    const a = loadAssets(projectId).assets.find((x) => x.id === brief.audio.music.assetId);
    if (!a) throw new MmsError("MUSIC_MISSING", "Lipsește fișierul de muzică al utilizatorului.");
    log(`Muzica utilizatorului: ${a.originalName}`);
    music = { audio: await decodeAudio(path.join(projectDir(projectId), a.file)), gainDb: sb.audio.musicGainDb };
  }
  const voice = t.audio.cues.filter((c) => c.kind === "voice").map((c) => ({ audio: readWavPublic(c.sound), atSec: c.atFrame / fps, gainDb: c.gainDb }));
  const sfx = t.audio.cues.filter((c) => c.kind === "sfx").map((c) => ({ audio: getSfx(c.sound), atSec: c.atFrame / fps, gainDb: c.gainDb + sb.audio.sfxGainDb, pan: c.pan }));
  log(`Mix: ${voice.length} replici, ${sfx.length} efecte, muzică: ${music ? "da" : "nu"}`);
  const out = mix({
    durationSec,
    music: music ? { audio: music.audio, gainDb: music.gainDb, loop: brief.audio.music.mode === "user-file", fadeOutSec: 0.8 } : undefined,
    voice,
    sfx,
    duck: { amountDb: sb.audio.duckDb, rampMs: 500, padMs: 120 },
    intentionalSilences: silences,
    targetLufs: -14,
    truePeakCeiling: -1,
  });
  const mixFile = versionFile(projectId, versionId, "audio/mix.wav");
  writeWav(mixFile, out.master, 24);
  const report = MixReportSchema.parse(out.report);
  writeVersionJson(projectId, versionId, "audio/mix-report.json", report);
  writeVersionJson(projectId, versionId, "audio/cue-sheet.json", t.audio.cues.map((c) => ({ ...c, timecode: formatTimecode(c.atFrame, fps) })));
  // subtitrări .srt (dacă sunt cerute)
  if (brief.captions.srt && t.captions) fs.writeFileSync(versionFile(projectId, versionId, "audio/captions.srt"), toSrt(t), "utf8");
  const src = projectPublicPath(projectId, `versions/${versionId}/audio/mix.wav`);
  for (const f of project.formats) {
    const tf = loadTimeline(projectId, versionId, f.id);
    if (tf.durationInFrames !== t.durationInFrames || tf.fps !== t.fps) throw new MmsError("FORMAT_TIMING", `Formatul ${f.id} are altă durată decât ${primary.id}; mixul nu se poate împărți.`);
    saveTimeline(projectId, versionId, { ...tf, audio: { ...tf.audio, src } });
  }
  updateState(projectId, { step: "audio", note: `${report.integratedLufs ?? "?"} LUFS, TP ${report.truePeakDbtp} dBTP${report.ok ? "" : " – probleme"}`, log: `Mix audio în ${versionId}: ${report.ok ? "ok" : report.problems.join("; ")}` });
  return report;
}

function readWavPublic(p: string) {
  // căile publice ale vocii sunt projects/<id>/...
  return readWav(path.join(PATHS.projects, p.replace(/^projects\//, "")));
}

export function toSrt(t: Timeline): string {
  if (!t.captions) return "";
  const groups: Array<{ from: number; to: number; text: string }> = [];
  let cur: { from: number; to: number; words: string[] } | null = null;
  for (const w of t.captions.words) {
    if (!cur || cur.words.length >= 6 || w.from - cur.to > t.fps * 0.35 || /[.!?…]$/.test(cur.words[cur.words.length - 1] ?? "")) {
      if (cur) groups.push({ from: cur.from, to: cur.to, text: cur.words.join(" ") });
      cur = { from: w.from, to: w.to, words: [] };
    }
    cur.words.push(w.text);
    cur.to = w.to;
  }
  if (cur) groups.push({ from: cur.from, to: cur.to, text: cur.words.join(" ") });
  const ts = (f: number) => {
    const ms = Math.round((f / t.fps) * 1000);
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
  };
  return groups.map((g, i) => `${i + 1}\n${ts(g.from)} --> ${ts(g.to)}\n${g.text}\n`).join("\n");
}

// ─── preview, verificare, render final ──────────────────────────────────────

export interface PreviewResult {
  file: string;
  contactSheet: string;
  check: Awaited<ReturnType<typeof analyzeVideo>>;
  renderMs: number;
}

export async function stepPreview(projectId: string, versionId: string, formatId: string | null, log: Log = noop, opts: { onProgress?: (p: number) => void; frameRange?: [number, number] } = {}): Promise<PreviewResult> {
  const project = loadProject(projectId);
  const fmt = formatId ?? project.formats[0].id;
  const t = loadTimeline(projectId, versionId, fmt);
  if (!t.audio.src) log("Atenție: timeline-ul nu are încă mix audio (rulează pasul audio); preview-ul va fi fără sunet.");
  const renders = versionFile(projectId, versionId, "renders");
  const label = opts.frameRange ? `preview-${fmt}-${opts.frameRange[0]}-${opts.frameRange[1]}` : `preview-${fmt}`;
  const file = path.join(renders, `${label}.mp4`);
  if (fs.existsSync(file)) fs.renameSync(file, path.join(renders, `${label}-inainte-${Date.now()}.mp4`));
  log(`Randez preview ${fmt}: ${(t.durationInFrames / t.fps).toFixed(1)} s…`);
  const r = await renderTimelineVideo(t, { out: file, muted: !t.audio.src, frameRange: opts.frameRange, onProgress: (p) => opts.onProgress?.(p.progress) });
  log(`  → ${path.relative(PATHS.root, file)} în ${(r.durationMs / 1000).toFixed(0)} s`);
  // foaie de contact: 2 cadre pe secundă + cadrele critice (început, tranziții, CTA, ultimul cadru)
  const frames = new Set<number>();
  const startF = opts.frameRange?.[0] ?? 0;
  const endF = opts.frameRange?.[1] ?? t.durationInFrames - 1;
  for (let f = startF; f <= endF; f += Math.round(t.fps / 2)) frames.add(f);
  for (const s of t.scenes) if (s.from >= startF && s.from <= endF) frames.add(Math.min(endF, s.from + Math.max(1, Math.floor((s.transitionIn?.durationInFrames ?? 0) / 2))));
  frames.add(endF);
  const list = [...frames].sort((a, b) => a - b);
  const stillsDir = path.join(renders, `stills-${fmt}`);
  fs.rmSync(stillsDir, { recursive: true, force: true });
  const stills = await renderStills(t, list, stillsDir, { format: "jpeg", scale: t.width > t.height ? 0.25 : 0.2 });
  const pub = stills.map((s) => projectPublicPath(projectId, path.relative(projectDir(projectId), s).replace(/\\/g, "/")));
  const cell = t.width > t.height ? { w: 320, h: 180 } : t.width === t.height ? { w: 240, h: 240 } : { w: 180, h: 320 };
  const sheet = await renderContactSheet(pub, list.map((f) => formatTimecode(f, t.fps)), path.join(renders, `contact-${fmt}.png`), { cols: t.width > t.height ? 6 : 8, cellWidth: cell.w, cellHeight: cell.h, title: `${project.name} · ${versionId} · ${fmt}` });
  const check = await analyzeVideo(file, t.fps);
  // raportul descrie randarea; nu modifică versiunea, deci se scrie și pe o versiune înghețată
  writeJson(versionFile(projectId, versionId, `renders/check-${fmt}.json`), check);
  if (!opts.frameRange) {
    freezeVersion(projectId, versionId, "preview");
    const p = loadProject(projectId);
    saveProject({ ...p, status: "preview" });
    updateState(projectId, { step: "preview", note: `${fmt}: ${check.problems.length ? check.problems.join(" ") : "fără probleme tehnice"}`, next: ["Privește și ascultă preview-ul; dă note pe timestamp (secunda X: problema).", "Rulează critica (mms critique) și corectează scenele sub 8/10."], log: `Preview ${fmt} pentru ${versionId}.` });
  }
  return { file, contactSheet: sheet, check, renderMs: r.durationMs };
}

/** Exportul final: doar după ce utilizatorul a scris exact „render final” pentru această versiune. */
export async function stepFinalRender(projectId: string, versionId: string, formatId: string | null, log: Log = noop): Promise<string> {
  const project = loadProject(projectId);
  const fmt = formatId ?? project.formats[0].id;
  const approvals = loadApprovals(projectId).items.filter((a) => a.kind === "render-final" && a.versionId === versionId);
  if (!approvals.length)
    throw new MmsError("FINAL_NOT_APPROVED", `Versiunea ${versionId} nu are aprobarea „render final”.`, `Utilizatorul trebuie să scrie exact „render final” (în Studio sau: npm run mms -- approve ${projectId} render-final --version ${versionId}).`);
  const t = loadTimeline(projectId, versionId, fmt);
  if (t.concept) throw new MmsError("FINAL_CONCEPT", "Timeline-ul folosește materiale fără drepturi confirmate (concept).", "Confirmă drepturile sau înlocuiește materialele, apoi recompilează.");
  const val = validateTimeline(t, { assets: loadAssets(projectId), research: loadResearch(projectId), format: project.formats.find((f) => f.id === fmt)! });
  const blockers = val.findings.filter((f) => f.severity === "blocker");
  if (blockers.length) throw new MmsError("FINAL_BLOCKED", `Validarea are ${blockers.length} blocaje:\n${blockers.map((b) => `  • ${b.timecode ?? ""} ${b.problem}`).join("\n")}`);
  const reportFile = versionFile(projectId, versionId, "audio/mix-report.json");
  if (!fs.existsSync(reportFile)) throw new MmsError("FINAL_NO_AUDIO", "Lipsește mixul audio verificat.", "Rulează pasul audio.");
  const rep = readJson(reportFile, MixReportSchema);
  if (!rep.ok) throw new MmsError("FINAL_AUDIO", `Mixul audio are probleme: ${rep.problems.join("; ")}`);
  const exportsDir = path.join(projectDir(projectId), "exports");
  const name = `${projectId}-${versionId}-${fmt}-final.mp4`;
  const out = path.join(exportsDir, name);
  if (fs.existsSync(out)) throw new MmsError("FINAL_EXISTS", `Exportul ${name} există deja și nu se suprascrie.`, "Creează o versiune nouă pentru un export nou.");
  log(`Render final ${fmt} → ${path.relative(PATHS.root, out)}`);
  await renderTimelineVideo(t, { out, crf: 16 });
  const check = await analyzeVideo(out, t.fps);
  writeJson(path.join(exportsDir, `${projectId}-${versionId}-${fmt}-final.check.json`), { check, mix: rep, validation: val.stats });
  if (fs.existsSync(versionFile(projectId, versionId, "audio/captions.srt"))) fs.copyFileSync(versionFile(projectId, versionId, "audio/captions.srt"), path.join(exportsDir, `${projectId}-${versionId}-${fmt}.srt`));
  setVersionStatus(projectId, versionId, "final");
  freezeVersion(projectId, versionId, "final");
  saveProject({ ...loadProject(projectId), status: "final" });
  updateState(projectId, { step: "final-render", note: name, log: `Export final ${name}.` });
  return out;
}

export function approve(projectId: string, kind: "brief" | "render-final" | "version" | "claim", phrase: string, versionId?: string, subject?: string) {
  const expected = kind === "brief" ? "aprob" : kind === "render-final" ? "render final" : null;
  if (expected && phrase.trim().toLowerCase() !== expected) throw new MmsError("APPROVAL_PHRASE", `Aprobarea „${kind}” cere exact fraza „${expected}”.`);
  const a = addApproval(projectId, { kind, phrase, versionId, subject });
  if (kind === "brief") {
    const p = loadProject(projectId);
    saveProject({ ...p, status: "brief-approved" });
    updateState(projectId, { step: "brief-approval", decision: "Brief aprobat de utilizator („aprob”).", next: ["Captură reală a produsului (mms capture).", "Research și brand din capturi."] });
  }
  if (kind === "render-final" && versionId) {
    setVersionStatus(projectId, versionId, "approved");
    updateState(projectId, { decision: `Utilizatorul a cerut „render final” pentru ${versionId}.` });
  }
  return a;
}

export async function shutdown(): Promise<void> {
  await closeBrowser();
}

export { loadVersionMeta };
