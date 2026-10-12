/**
 * Pașii de producție, fiecare idempotent și cu STATE.md actualizat. Îi folosesc CLI-ul (mms),
 * Studio-ul (serverul local) și comenzile din Claude Code.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PHONE_MAX_CSS_WIDTH, samePageKey } from "../assets/counterpart";
import { ingestCapture } from "../assets/ingest";
import { detectBeatGrid, musicStructure } from "../audio/beat";
import { decodeAudio } from "../audio/decode";
import { mix } from "../audio/mixer";
import { composeMusic } from "../audio/music";
import { getSfx } from "../audio/sfx";
import { synthesize, ttsModel, voiceFromFile, type VoiceProvider } from "../audio/voice";
import { readWav, writeWav } from "../audio/wav";
import { inferBrand } from "../brand/infer";
import { capture, type CaptureRequestInput, type CaptureResult, type PageData } from "../capture/capture";
import { MmsError } from "../core/errors";
import { recordUsage } from "../core/usage";
import { readJson, writeJson } from "../core/json";
import { PATHS, projectPublicPath, publicToAbs } from "../core/paths";
import { fileFingerprint } from "../core/hash";
import { audioKey, timelineRenderKey } from "./impact";
import { snapshotProjectInputs } from "../projects/snapshots";
import { applyDna, loadReferenceDnas } from "../references/dna";
import { formatTimecode } from "../core/time";
import { orientationOf } from "../core/formats";
import type { BeatGrid, MixReport, Timeline } from "../core/schema";
import { MixReport as MixReportSchema } from "../core/schema";
import { DIRECTIONS } from "../creative/directions";
import { draftScript, validateScript } from "../creative/script";
import { buildStoryboard } from "../creative/storyboard";
import { chooseTemplate, getTemplate } from "../creative/templates";
import { selectedConcept } from "../creative/concepts";
import { analyzeVideo, intendedHolds } from "../renderer/node/analyze-video";
import { closeBrowser, renderContactSheet, renderStills, renderTimelineStill, renderTimelineVideo } from "../renderer/node/render";
import { extractFromPage, mergeIntoResearch } from "../research/extract";
import { compileTimeline, type VoiceClipRef } from "../timeline/compile";
import { validateTimeline, type ValidationResult } from "../timeline/validate";
import {
  addApproval,
  assertWritable,
  createVersion,
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
  setVersionInputs,
  setVersionStatus,
  updateState,
  versionFile,
  writableVersion,
  writeVersionJson,
} from "../projects/store";

export type Log = (msg: string) => void;
const noop: Log = () => undefined;

// ─── captură + research + brand ─────────────────────────────────────────────

/**
 * Pentru un proiect cu format vertical (9:16, 4:5), fiecare captură statică de desktop primește și varianta de
 * telefon a aceleiași pagini (`<id>-mobile`), dacă nu există deja: compilatorul o alege pe vertical, unde
 * captura desktop ar fi ilizibilă. Înregistrările nu se dublează (pașii lor țin de layout-ul desktop).
 */
export function withPhoneTwins(projectId: string, reqs: CaptureRequestInput[]): CaptureRequestInput[] {
  const project = loadProject(projectId);
  if (!project.formats.some((f) => orientationOf(f.width, f.height) === "portrait")) return reqs;
  const isPhone = (vp: string | undefined) => vp === "mobile";
  const have = new Set([
    ...reqs.filter((r) => isPhone(r.viewport)).map((r) => `${samePageKey(r.url)}|${!!r.fullPage}`),
    ...loadAssets(projectId)
      .assets.filter((a) => a.role === "screenshot" && a.capture && a.capture.viewport.width < PHONE_MAX_CSS_WIDTH)
      .map((a) => `${samePageKey(a.capture!.url)}|${a.capture!.fullPage}`),
  ]);
  const out: CaptureRequestInput[] = [];
  for (const r of reqs) {
    out.push(r);
    const key = `${samePageKey(r.url)}|${!!r.fullPage}`;
    if (r.record || isPhone(r.viewport) || have.has(key)) continue;
    have.add(key);
    out.push({ ...r, id: `${r.id}-mobile`, viewport: "mobile", research: false, twinOf: r.id } as CaptureRequestInput & { twinOf: string });
  }
  return out;
}

export async function stepCapture(projectId: string, reqs: CaptureRequestInput[], log: Log = noop, opts: { headed?: boolean; thirdParty?: boolean; mobile?: boolean } = {}): Promise<CaptureResult[]> {
  const out: CaptureResult[] = [];
  const dir = path.join(projectDir(projectId), "captures");
  const all = opts.mobile === false ? reqs : withPhoneTwins(projectId, reqs);
  for (const r of all) {
    const twinOf = (r as { twinOf?: string }).twinOf;
    log(`Captură ${r.id}: ${r.url} (${r.viewport ?? "desktop"}${r.fullPage ? ", pagină întreagă" : ""}${r.record ? ", înregistrare" : ""}${twinOf ? `, varianta de telefon a lui ${twinOf} pentru formatele verticale` : ""})`);
    let res: CaptureResult;
    try {
      res = await capture(r, dir, opts);
    } catch (e) {
      // varianta de telefon e un plus: dacă pagina nu merge pe mobil, verticalul folosește captura desktop
      if (!twinOf || (e instanceof MmsError && ["CAPTURE_URL", "CAPTURE_REDIRECT", "CANCELLED"].includes(e.code))) throw e;
      log(`  ! varianta de telefon ${r.id} nu s-a putut face (${(e as Error).message.split("\n")[0]}); pe vertical rămâne captura desktop ${twinOf}.`);
      continue;
    }
    if (twinOf && res.overflowX) {
      // pagina nu e adaptată pentru telefon: interfața ar apărea tăiată, deci varianta nu devine material
      for (const f of [res.screenshot, res.logo?.file, path.join(dir, `${r.id}.json`)]) if (f) fs.rmSync(f, { force: true });
      log(`  → pagina nu e adaptată pentru telefon (iese din ecran pe orizontală); pe vertical rămâne captura desktop ${twinOf}.`);
      continue;
    }
    await ingestCapture(projectId, res, { thirdParty: opts.thirdParty });
    let claims = 0;
    if (res.research && !r.record) {
      const ex = extractFromPage(res.page, { capturedAt: res.capturedAt });
      mergeIntoResearch(projectId, ex, res.page.fullText);
      claims = ex.claims.length;
    }
    log(`  → ${res.regions.length} zone, ${claims} afirmații extrase, ${res.pii.length} zone cu date personale${opts.thirdParty ? " · material al unui terț: drepturi neconfirmate" : ""}`);
    out.push(res);
  }
  updateState(projectId, { step: "capture", note: `${out.length} capturi`, log: `Capturi reale: ${out.map((r) => r.id).join(", ")}.` });
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
    // pagina de prezentare (cu research), cea mai recentă și cu datele de formă; aplicația și paginile întregi după
    const rank = (c: CaptureResult) => (c.research ? 4 : 0) + (c.page?.shapes ? 5 : 0) + (c.fullPage ? 0 : 2);
    const best = [...caps].filter((c) => c.page).sort((a, b) => rank(b) - rank(a) || String(b.capturedAt).localeCompare(String(a.capturedAt)))[0];
    page = best?.page ?? null;
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
  updateState(projectId, { step: "script", note: `${script.lines.length} replici, ${issues.filter((i) => i.severity === "critical").length} blocaje`, log: `Script schiță în ${v}.` });
  return { versionId: v, issues };
}

export function stepStoryboard(projectId: string, opts: { force?: boolean; templateId?: string } = {}): { versionId: string; rationale: string[] } {
  const project = loadProject(projectId);
  const brief = loadBrief(projectId);
  const v = writableVersion(projectId);
  if (hasFile(projectId, `versions/${v}/storyboard.json`) && !opts.force) return { versionId: v, rationale: loadStoryboard(projectId, v).rationale };
  // structura vine, în ordine: din alegerea explicită, din conceptul creativ ales, din potrivirea șablonului
  const concept = selectedConcept(projectId);
  const tpl = opts.templateId
    ? { template: getTemplate(opts.templateId), why: "ales explicit" }
    : concept
      ? { template: getTemplate(concept.templateId), why: `conceptul creativ „${concept.title}” (${concept.total}/100)` }
      : chooseTemplate({ category: project.product.category, direction: brief.direction, durationSec: brief.durationSec, objective: brief.objective });
  const sb = buildStoryboard({ template: tpl.template, script: loadScript(projectId, v), brief, research: loadResearch(projectId), assets: loadAssets(projectId).assets, productName: project.product.name });
  // direcția conceptului se aplică doar dacă utilizatorul nu a ales una în brief
  if (concept && !brief.direction) sb.direction = concept.direction;
  sb.rationale.unshift(`Șablonul „${tpl.template.id}”: ${tpl.why}.`);
  if (concept) sb.rationale.unshift(`Concept: ${concept.title} – ${concept.bigIdea}`);
  saveStoryboard(projectId, v, sb);
  updateState(projectId, { step: "storyboard", note: `${sb.scenes.length} scene`, log: `Storyboard în ${v} din șablonul ${tpl.template.id}.` });
  return { versionId: v, rationale: sb.rationale };
}

// ─── voce ───────────────────────────────────────────────────────────────────

/** Amprenta vocii: setările din brief + textul rostit al fiecărei replici. Altă amprentă = vocea trebuie refăcută. */
export function voiceKey(brief: ReturnType<typeof loadBrief>, script: ReturnType<typeof loadScript>): string {
  const lines = script.lines.map((l) => [l.id, l.voiceover, l.pronunciation]);
  // modelul vocii din cloud (din .env) schimbă vocea; intră în cheie doar când există
  const model = brief.audio.voice.mode === "tts" ? ttsModel(brief.audio.voice.provider) : null;
  return crypto.createHash("sha1").update(JSON.stringify([brief.audio.voice, lines, ...(model ? [model] : [])])).digest("hex");
}

export async function stepVoice(projectId: string, versionId: string, log: Log = noop): Promise<Record<string, VoiceClipRef>> {
  const brief = loadBrief(projectId);
  const script = loadScript(projectId, versionId);
  const out: Record<string, VoiceClipRef> = {};
  const vm = brief.audio.voice;
  if (vm.mode === "none") {
    writeVersionJson(projectId, versionId, "audio/voice.json", out);
    writeVersionJson(projectId, versionId, "audio/voice-key.json", { key: voiceKey(brief, script) });
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
      const r = await synthesize({ provider: vm.provider as VoiceProvider, voice: vm.voiceId, text, rate: vm.rate }, cacheDir, { projectId, reason: `replica ${l.id} (${versionId})` });
      // marcajele de cuvinte folosesc textul afișat (nu varianta de pronunție)
      const shown = l.voiceover.split(/\s+/).filter(Boolean);
      const words = r.words.length === shown.length ? r.words.map((w, i) => ({ ...w, text: shown[i] })) : r.words;
      out[l.id] = { lineId: l.id, src: projectPublicPath(projectId, path.relative(projectDir(projectId), r.file).replace(/\\/g, "/")), durationSec: r.audio.L.length / r.audio.sr, words };
    }
  }
  writeVersionJson(projectId, versionId, "audio/voice.json", out);
  writeVersionJson(projectId, versionId, "audio/voice-key.json", { key: voiceKey(brief, script) });
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
    const audio = await decodeAudio(path.join(projectDir(projectId), a.file));
    const detected = detectBeatGrid(audio);
    // tempo-ul dat de utilizator e sigur; cel detectat își păstrează încrederea (sub 0,35 nu se aliniază nimic pe el)
    const g: BeatGrid = brief.audio.music.bpm ? { ...detected, bpm: brief.audio.music.bpm, source: "user", confidence: 1 } : detected;
    return { ...g, ...musicStructure(audio, g) };
  }
  const dir = applyDna(DIRECTIONS[sb.direction ?? brief.direction ?? "technical"], loadReferenceDnas(projectDir(projectId), brief.references).refs).dir;
  const bpm = brief.audio.music.bpm ?? Math.round((dir.bpm[0] + dir.bpm[1]) / 2);
  return { bpm, offsetSec: 0, beatsPerBar: 4, source: "synth", confidence: 1, sections: [], drops: [] };
}

export interface CompileStepResult {
  versionId: string;
  timelines: Record<string, Timeline>;
  validation: Record<string, ValidationResult>;
  warnings: string[];
  report: unknown;
}

export async function stepCompile(projectId: string, requestedVersion: string, log: Log = noop): Promise<CompileStepResult> {
  let versionId = requestedVersion;
  // o versiune înghețată nu se rescrie: recompilarea merge în versiunea următoare (regula 9)
  if (loadVersionMeta(projectId, versionId).frozen) {
    versionId = createVersion(projectId, { from: versionId, label: "recompilare", changes: [{ at: new Date().toISOString(), op: "recompile", description: `Recompilare din ${requestedVersion}, care e înghețată și rămâne neatinsă.`, params: {} }] }).id;
    log(`${requestedVersion} e înghețată: recompilez în ${versionId}.`);
  }
  const project = loadProject(projectId);
  // vocea se refolosește doar dacă a fost sintetizată din același text și cu aceleași setări
  const voicePath = versionFile(projectId, versionId, "audio/voice.json");
  const keyPath = versionFile(projectId, versionId, "audio/voice-key.json");
  const fresh = fs.existsSync(voicePath) && fs.existsSync(keyPath) && (JSON.parse(fs.readFileSync(keyPath, "utf8")) as { key: string }).key === voiceKey(loadBrief(projectId), loadScript(projectId, versionId));
  if (!fresh && fs.existsSync(voicePath)) log("Scriptul sau setările vocii s-au schimbat: refac vocea.");
  const voice = fresh ? (JSON.parse(fs.readFileSync(voicePath, "utf8")) as Record<string, VoiceClipRef>) : await stepVoice(projectId, versionId, log);
  const beatGrid = await planBeatGrid(projectId, versionId);
  const refs = loadReferenceDnas(projectDir(projectId), loadBrief(projectId).references);
  for (const m of refs.missing) log(`Referința ${m} nu e analizată încă (mms reference): nu influențează montajul.`);
  const base = { references: refs.refs, project, versionId, brief: loadBrief(projectId), brand: loadBrand(projectId), research: loadResearch(projectId), assets: loadAssets(projectId), script: loadScript(projectId, versionId), storyboard: loadStoryboard(projectId, versionId), voice, beatGrid };
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
    log(`  → ${r.timeline.scenes.length} scene, ${(r.timeline.durationInFrames / format.fps).toFixed(2)} s, ${val.findings.length} observații (${val.findings.filter((f) => f.severity === "critical").length} blocaje)`);
  }
  writeVersionJson(projectId, versionId, "compile-report.json", reports);
  // brief-ul folosit se păstrează lângă versiune (trasabilitate)
  writeVersionJson(projectId, versionId, "brief.snapshot.json", base.brief);
  // amprentele intrărilor de proiect (brief, research, brand, assets), cu snapshot-uri pentru comparație și rollback
  setVersionInputs(projectId, versionId, snapshotProjectInputs(projectId));
  updateState(projectId, { step: "compile", note: Object.entries(timelines).map(([k, t]) => `${k}: ${(t.durationInFrames / t.fps).toFixed(1)} s`).join(", "), log: `Timeline compilat în ${versionId}.` });
  return { versionId, timelines, validation, warnings, report: reports };
}

// ─── audio: muzică, efecte, voce, mix ───────────────────────────────────────

export async function stepAudio(projectId: string, versionId: string, log: Log = noop, opts: { force?: boolean } = {}): Promise<MixReport> {
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
  // mixul e adresat prin conținut: aceleași intrări (momente, voce, muzică, setări) = același mix, refolosit
  const voiceFiles = Object.fromEntries(t.audio.cues.filter((c) => c.kind === "voice").map((c) => [c.sound, fileFingerprint(publicToAbs(c.sound))]));
  const key = audioKey(t, sb, brief, voiceFiles);
  const cacheWav = path.join(projectDir(projectId), "cache", "mix", `${key}.wav`);
  const cacheRep = path.join(projectDir(projectId), "cache", "mix", `${key}.json`);
  const mixFile = versionFile(projectId, versionId, "audio/mix.wav");
  let report: MixReport;
  if (!opts.force && fs.existsSync(cacheWav) && fs.existsSync(cacheRep)) {
    log("Mix refolosit: intrările sunetului nu s-au schimbat (fără recalculare).");
    assertWritable(projectId, versionId);
    fs.mkdirSync(path.dirname(mixFile), { recursive: true });
    if (fs.existsSync(mixFile)) fs.rmSync(mixFile);
    try {
      fs.linkSync(cacheWav, mixFile);
    } catch {
      fs.copyFileSync(cacheWav, mixFile);
    }
    report = readJson(cacheRep, MixReportSchema);
  } else {
    report = await computeMix();
    fs.mkdirSync(path.dirname(cacheWav), { recursive: true });
    fs.copyFileSync(mixFile, cacheWav);
    writeJson(cacheRep, report);
  }
  return finishAudio(report);

  async function computeMix(): Promise<MixReport> {
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
    writeWav(mixFile, out.master, 24);
    return MixReportSchema.parse(out.report);
  }

  function finishAudio(report: MixReport): MixReport {
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
  check: Awaited<ReturnType<typeof analyzeVideo>> & { renderKey?: string };
  renderMs: number;
  /** true = același timeline (imagine + sunet) era deja randat: video-ul s-a refolosit, fără randare */
  reused: boolean;
}

function linkOrCopy(src: string, dst: string): void {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  if (fs.existsSync(dst)) fs.rmSync(dst);
  try {
    fs.linkSync(src, dst);
  } catch {
    fs.copyFileSync(src, dst);
  }
}

export async function stepPreview(projectId: string, versionId: string, formatId: string | null, log: Log = noop, opts: { onProgress?: (p: number) => void; frameRange?: [number, number]; force?: boolean; signal?: AbortSignal } = {}): Promise<PreviewResult> {
  const project = loadProject(projectId);
  const fmt = formatId ?? project.formats[0].id;
  const t = loadTimeline(projectId, versionId, fmt);
  if (!t.audio.src) log("Atenție: timeline-ul nu are încă mix audio (rulează pasul audio); preview-ul va fi fără sunet.");
  const renders = versionFile(projectId, versionId, "renders");
  const label = opts.frameRange ? `preview-${fmt}-${opts.frameRange[0]}-${opts.frameRange[1]}` : `preview-${fmt}`;
  const file = path.join(renders, `${label}.mp4`);
  // preview-ul e adresat prin conținut: același timeline (imagine) + același mix (sunet) = același video
  const renderKey = timelineRenderKey(t, fileFingerprint(versionFile(projectId, versionId, "audio/mix.wav")));
  const cacheBase = path.join(projectDir(projectId), "cache", "renders", `${renderKey}${opts.frameRange ? `-${opts.frameRange[0]}-${opts.frameRange[1]}` : ""}`);
  const cached = fs.existsSync(`${cacheBase}.mp4`) && fs.existsSync(`${cacheBase}.check.json`) && fs.existsSync(`${cacheBase}.contact.png`);
  if (fs.existsSync(file)) fs.renameSync(file, path.join(renders, `${label}-inainte-${Date.now()}.mp4`));
  if (cached && !opts.force) {
    log(`Preview ${fmt}: același timeline și același sunet erau deja randate; refolosesc video-ul (fără randare).`);
    recordUsage({ projectId, provider: "remotion", op: "render-preview", reason: `${versionId} ${fmt}`, units: { frames: t.durationInFrames }, durationMs: 0, cached: true, paid: false, ok: true });
    linkOrCopy(`${cacheBase}.mp4`, file);
    const sheetOut = path.join(renders, `contact-${fmt}.png`);
    linkOrCopy(`${cacheBase}.contact.png`, sheetOut);
    const check = { ...(JSON.parse(fs.readFileSync(`${cacheBase}.check.json`, "utf8")) as Awaited<ReturnType<typeof analyzeVideo>>), renderKey };
    writeJson(versionFile(projectId, versionId, `renders/check-${fmt}.json`), check);
    if (!opts.frameRange) finishPreview(check);
    return { file, contactSheet: sheetOut, check, renderMs: 0, reused: true };
  }
  log(`Randez preview ${fmt}: ${(t.durationInFrames / t.fps).toFixed(1)} s…`);
  const frameCount = opts.frameRange ? opts.frameRange[1] - opts.frameRange[0] + 1 : t.durationInFrames;
  const r = await renderTimelineVideo(t, { out: file, muted: !t.audio.src, frameRange: opts.frameRange, signal: opts.signal, onProgress: (p) => opts.onProgress?.(p.progress) });
  recordUsage({ projectId, provider: "remotion", op: "render-preview", reason: `${versionId} ${fmt}`, units: { frames: frameCount }, durationMs: r.durationMs, cached: false, paid: false, ok: true });
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
  const check = { ...(await analyzeVideo(file, t.fps, intendedHolds(t))), renderKey };
  // raportul descrie randarea; nu modifică versiunea, deci se scrie și pe o versiune înghețată
  writeJson(versionFile(projectId, versionId, `renders/check-${fmt}.json`), check);
  fs.mkdirSync(path.dirname(cacheBase), { recursive: true });
  linkOrCopy(file, `${cacheBase}.mp4`);
  linkOrCopy(sheet, `${cacheBase}.contact.png`);
  writeJson(`${cacheBase}.check.json`, check);
  if (!opts.frameRange) finishPreview(check);
  return { file, contactSheet: sheet, check, renderMs: r.durationMs, reused: false };

  function finishPreview(c: { problems: string[] }): void {
    freezeVersion(projectId, versionId, "preview");
    const p = loadProject(projectId);
    saveProject({ ...p, status: "preview" });
    updateState(projectId, { step: "preview", note: `${fmt}: ${c.problems.length ? c.problems.join(" ") : "fără probleme tehnice"}`, next: ["Privește și ascultă preview-ul; dă note pe timestamp (secunda X: problema).", "Verifică scorul de calitate (mms quality) și corectează ce e sub prag."], log: `Preview ${fmt} pentru ${versionId}.` });
  }
}

/** Exportul final: doar după ce utilizatorul a scris exact „render final” pentru această versiune. */
export async function stepFinalRender(projectId: string, versionId: string, formatId: string | null, log: Log = noop): Promise<string> {
  const project = loadProject(projectId);
  const fmt = formatId ?? project.formats[0].id;
  const approvals = loadApprovals(projectId).items.filter((a) => a.kind === "render-final" && a.versionId === versionId);
  if (!approvals.length)
    throw new MmsError("FINAL_NOT_APPROVED", `Versiunea ${versionId} nu are aprobarea „render final”.`, `Utilizatorul trebuie să scrie exact „render final” (în Studio sau: npm run mms -- approve ${projectId} render-final "render final" --version ${versionId}).`);
  const t = loadTimeline(projectId, versionId, fmt);
  if (t.concept) throw new MmsError("FINAL_CONCEPT", "Timeline-ul folosește materiale fără drepturi confirmate (concept).", "Confirmă drepturile sau înlocuiește materialele, apoi recompilează.");
  const val = validateTimeline(t, { assets: loadAssets(projectId), research: loadResearch(projectId), format: project.formats.find((f) => f.id === fmt)! });
  const blockers = val.findings.filter((f) => f.severity === "critical");
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
  // atenționări care nu blochează, dar trebuie spuse (vezi docs/LICENTE.md)
  const notes: string[] = [];
  const vm = loadBrief(projectId).audio.voice;
  if (vm.mode === "tts" && (vm.provider === "windows" || vm.provider === "say"))
    notes.push(`Vocea e generată cu TTS-ul sistemului (${vm.provider}). Drepturile de folosire comercială nu sunt clare; pentru publicare comercială folosește vocea ta sau un furnizor cu termeni comerciali (docs/LICENTE.md).`);
  for (const n of notes) log(`ATENȚIE: ${n}`);
  const fr = await renderTimelineVideo(t, { out, crf: 16 });
  recordUsage({ projectId, provider: "remotion", op: "render-final", reason: `${versionId} ${fmt}`, units: { frames: t.durationInFrames }, durationMs: fr.durationMs, cached: false, paid: false, ok: true });
  const check = await analyzeVideo(out, t.fps, intendedHolds(t));
  writeJson(path.join(exportsDir, `${projectId}-${versionId}-${fmt}-final.check.json`), { check, mix: rep, validation: val.stats, notes });
  if (fs.existsSync(versionFile(projectId, versionId, "audio/captions.srt"))) fs.copyFileSync(versionFile(projectId, versionId, "audio/captions.srt"), path.join(exportsDir, `${projectId}-${versionId}-${fmt}.srt`));
  if (loadBrief(projectId).delivery.postPack) {
    const pack = await writePostPack(projectId, versionId, fmt, path.join(exportsDir, `${projectId}-${versionId}-${fmt}`));
    log(`Pachet de postare: ${path.relative(PATHS.root, pack.cover)}, ${path.relative(PATHS.root, pack.text)}`);
  }
  setVersionStatus(projectId, versionId, "final");
  freezeVersion(projectId, versionId, "final");
  saveProject({ ...loadProject(projectId), status: "final" });
  updateState(projectId, { step: "final-render", note: name, log: `Export final ${name}.` });
  return out;
}

/** Cadrul pentru copertă: scena de prezentare (sau hook-ul), după tranziția de intrare, cu textul deja apărut. */
export function coverFrame(t: Timeline): number {
  const reveal = t.scenes.findIndex((s) => s.meta.narrativeRole === "reveal");
  const pick = reveal >= 0 ? reveal : Math.max(0, t.scenes.findIndex((s) => s.meta.narrativeRole === "hook"));
  const s = t.scenes[pick];
  const start = s.from + (s.transitionIn?.durationInFrames ?? 0);
  const end = Math.min(s.from + s.durationInFrames, t.scenes[pick + 1]?.from ?? Infinity);
  return Math.min(t.durationInFrames - 1, start + Math.round(Math.max(0, end - start) * 0.7));
}

/**
 * Pachetul de postare (livrare, grupa G): copertă randată din timeline + text de postare.
 * Titlul și descrierea sunt doar replici deja aprobate din script (fără afirmații noi);
 * hashtag-urile nu se inventează automat: rămân de propus de Claude și de aprobat de utilizator.
 */
export async function writePostPack(projectId: string, versionId: string, formatId: string, base: string): Promise<{ cover: string; text: string }> {
  const t = loadTimeline(projectId, versionId, formatId);
  const script = loadScript(projectId, versionId);
  const brief = loadBrief(projectId);
  const project = loadProject(projectId);
  const frame = coverFrame(t);
  // coperta nu are subtitrări arse (un fragment de frază nu are sens ca imagine statică)
  const cover = await renderTimelineStill({ ...t, captions: null }, frame, `${base}-cover.png`, { format: "png" });
  const hook = script.lines.find((l) => l.isHook);
  const body = script.lines.filter((l) => !l.isHook && !l.isCta).map((l) => l.voiceover ?? l.onScreen).filter((x): x is string => !!x);
  const cta = brief.cta.text + (brief.cta.url ? ` – ${brief.cta.url}` : "");
  const md = [
    `# Pachet de postare – ${project.name} (${versionId}, ${formatId})`,
    "",
    `Copertă: \`${path.basename(cover)}\` (cadrul ${frame}, ${formatTimecode(frame, t.fps)})`,
    "",
    "## Titlu (din hook)",
    "",
    hook?.onScreen ?? hook?.voiceover ?? "",
    "",
    "## Descriere (din replicile scriptului)",
    "",
    [...body, cta].join(" "),
    "",
    "## Hashtag-uri",
    "",
    "De completat: Claude propune, utilizatorul aprobă. Nu se generează automat, ca să nu apară afirmații sau mărci neverificate.",
    "",
  ].join("\n");
  const text = `${base}-post.md`;
  fs.writeFileSync(text, md);
  return { cover, text };
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
