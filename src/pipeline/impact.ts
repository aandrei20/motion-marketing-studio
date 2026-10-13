/**
 * Motorul de impact al schimbărilor: amprente pe fiecare artefact al unei versiuni (și pe fiecare scenă),
 * diferența dintre două versiuni și planul minim de lucru („ce se reface, ce se păstrează”).
 *
 * Principiul: compilarea e ieftină (milisecunde) și se refolosește mereu; scump e ce vine după
 * (voce, mix, cadre randate, video). Acestea se refac doar pentru ce s-a schimbat efectiv.
 */
import fs from "node:fs";
import path from "node:path";
import { fileFingerprint, fingerprint } from "../core/hash";
import { readJsonLoose } from "../core/json";
import type { Brief, Script, Storyboard, Timeline, TimelineScene } from "../core/schema";
import { hasFile, loadBrief, loadProject, loadScript, loadStoryboard, loadTimeline, loadVersionMeta, projectFile, versionFile } from "../projects/store";
import { downstream, type ArtifactId } from "./graph";

/** Amprenta vocii: setările din brief + textul rostit (aceeași cu voiceKey din steps). */
export function voiceFingerprint(brief: Brief, script: Script): string {
  return fingerprint([brief.audio.voice, script.lines.map((l) => [l.id, l.voiceover, l.pronunciation])]);
}

/**
 * Amprenta conținutului unei scene din timeline, independentă de poziția ei în timp: aceeași scenă
 * mutată mai devreme sau mai târziu arată la fel în cadrele ei, deci analizele ei se refolosesc.
 * Include ce se vede peste scenă: paleta, fonturile, tipografia, subtitrările din intervalul ei.
 */
export function sceneContentKey(t: Timeline, s: TimelineScene): string {
  const { from: _from, ...rest } = s;
  const end = s.from + s.durationInFrames;
  const words = (t.captions?.words ?? []).filter((w) => w.from < end && w.to > s.from).map((w) => ({ text: w.text, from: w.from - s.from, to: w.to - s.from }));
  return fingerprint({
    scene: rest,
    w: t.width,
    h: t.height,
    fps: t.fps,
    palette: t.palette,
    fonts: t.fonts,
    typography: t.typography,
    overlays: t.overlays,
    captions: t.captions ? { box: t.captions.box, params: t.captions.params, words } : null,
    concept: t.concept,
    safe: t.safeZone,
  });
}

/** Amprenta întregului timeline ca imagine + sunet (fără id-ul versiunii; sunetul prin conținutul mixului). */
export function timelineRenderKey(t: Timeline, mixHash: string | null): string {
  const { versionId: _v, audio, ...rest } = t;
  return fingerprint({ ...rest, audio: { cues: audio.cues, beatGrid: audio.beatGrid, mix: mixHash } });
}

/** Amprenta intrărilor mixului: dacă e aceeași, mixul vechi e valid și nu se refolosește calculul. */
export function audioKey(t: Timeline, sb: Storyboard, brief: Brief, voiceFiles: Record<string, string | null>): string {
  const silences = t.scenes.filter((s) => sb.scenes.find((x) => x.id === s.id)?.audio.silence).map((s) => [s.from, s.durationInFrames]);
  return fingerprint({
    // 3: compresorul pe voce și ambianța (mixul se refăcea altfel din cache cu regulile vechi)
    v: 3,
    duration: t.durationInFrames,
    fps: t.fps,
    cues: t.audio.cues.map((c) => [c.kind, c.atFrame, c.sound, c.gainDb, c.pan, c.kind === "voice" ? (voiceFiles[c.sound] ?? null) : null]),
    beat: t.audio.beatGrid,
    sections: t.scenes.map((s) => [s.from, s.durationInFrames, s.meta.energy, s.meta.narrativeRole]),
    silences,
    sb: sb.audio,
    music: brief.audio.music,
    sfx: brief.audio.sfxDensity,
    voiceCompression: brief.audio.voiceCompression,
    ambience: brief.audio.ambience,
    direction: sb.direction ?? brief.direction,
  });
}

export interface FormatFingerprint {
  global: string;
  timing: string;
  scenes: Record<string, string>;
  order: string[];
  cues: string;
}

export interface VersionFingerprint {
  versionId: string;
  inputs: Record<string, string>;
  script: { voice: string; text: string } | null;
  storyboard: { global: string; audio: string; scenes: Record<string, string>; order: string[] } | null;
  timelines: Record<string, FormatFingerprint>;
  mix: string | null;
}

/** Amprentele unei versiuni, citite de pe disc. Intrările de proiect vin din version.json (dacă s-a compilat). */
export function versionFingerprint(projectId: string, versionId: string): VersionFingerprint {
  const project = loadProject(projectId);
  const meta = loadVersionMeta(projectId, versionId);
  const inputs = Object.keys(meta.inputs).length ? meta.inputs : currentInputs(projectId);
  const brief = hasFile(projectId, "brief.json") ? loadBrief(projectId) : null;
  const script = hasFile(projectId, `versions/${versionId}/script.json`) ? loadScript(projectId, versionId) : null;
  const sb = hasFile(projectId, `versions/${versionId}/storyboard.json`) ? loadStoryboard(projectId, versionId) : null;
  const timelines: Record<string, FormatFingerprint> = {};
  for (const f of project.formats) {
    if (!hasFile(projectId, `versions/${versionId}/timeline-${f.id}.json`)) continue;
    const t = loadTimeline(projectId, versionId, f.id);
    timelines[f.id] = {
      global: fingerprint({ w: t.width, h: t.height, fps: t.fps, palette: t.palette, fonts: t.fonts, typography: t.typography, safe: t.safeZone }),
      timing: fingerprint(t.scenes.map((s) => [s.id, s.from, s.durationInFrames, s.transitionIn?.durationInFrames ?? 0])),
      scenes: Object.fromEntries(t.scenes.map((s) => [s.id, sceneContentKey(t, s)])),
      order: t.scenes.map((s) => s.id),
      cues: fingerprint(t.audio.cues),
    };
  }
  const { scenes: sbScenes, audio: sbAudio, rationale: _r, ...sbRest } = sb ?? ({} as Storyboard);
  return {
    versionId,
    inputs,
    script:
      script && brief
        ? { voice: voiceFingerprint(brief, script), text: fingerprint(script.lines.map((l) => [l.id, l.onScreen, l.emphasis, l.claimIds, l.isHook, l.isCta])) }
        : null,
    storyboard: sb
      ? {
          global: fingerprint(sbRest),
          audio: fingerprint(sbAudio),
          scenes: Object.fromEntries(sbScenes.map((s) => [s.id, fingerprint(s)])),
          order: sbScenes.map((s) => s.id),
        }
      : null,
    timelines,
    mix: fileFingerprint(versionFile(projectId, versionId, "audio/mix.wav")),
  };
}

/** Amprentele actuale ale intrărilor de proiect (brief, research, brand, assets), ca în snapshot-uri. */
export function currentInputs(projectId: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of ["brief", "research", "brand", "assets"] as const) {
    const f = projectFile(projectId, `${k}.json`);
    if (fs.existsSync(f)) out[k] = fingerprint(readJsonLoose(f));
  }
  const refDir = projectFile(projectId, "references");
  if (fs.existsSync(refDir)) {
    const profiles = fs
      .readdirSync(refDir)
      .filter((x) => x.endsWith(".json"))
      .sort()
      .map((x) => readJsonLoose(path.join(refDir, x)));
    if (profiles.length) out.references = fingerprint(profiles);
  }
  return out;
}

export interface ChangeSet {
  from: string;
  to: string;
  artifacts: ArtifactId[];
  /** scene modificate în storyboard (conținut), adăugate, șterse, ordine schimbată */
  storyboardScenes: { changed: string[]; added: string[]; removed: string[]; reordered: boolean };
  /** pe format: scenele al căror conținut vizual s-a schimbat și dacă s-a schimbat structura de timp */
  formats: Record<string, { changedScenes: string[]; timing: boolean; global: boolean; cues: boolean }>;
}

function keysDiff(a: Record<string, string>, b: Record<string, string>) {
  const changed = Object.keys(b).filter((k) => k in a && a[k] !== b[k]);
  const added = Object.keys(b).filter((k) => !(k in a));
  const removed = Object.keys(a).filter((k) => !(k in b));
  return { changed, added, removed };
}

export function diffFingerprints(a: VersionFingerprint, b: VersionFingerprint): ChangeSet {
  const artifacts = new Set<ArtifactId>();
  for (const k of ["brief", "research", "brand", "assets", "references"] as const) if (a.inputs[k] !== b.inputs[k]) artifacts.add(k);
  if (a.script?.voice !== b.script?.voice) {
    artifacts.add("script");
    artifacts.add("voice");
  } else if (a.script?.text !== b.script?.text) artifacts.add("script");
  const sbA = a.storyboard;
  const sbB = b.storyboard;
  const sbd = sbA && sbB ? keysDiff(sbA.scenes, sbB.scenes) : { changed: [], added: [], removed: [] };
  const reordered = !!sbA && !!sbB && sbA.order.filter((x) => sbB.order.includes(x)).join() !== sbB.order.filter((x) => sbA.order.includes(x)).join();
  if (sbA?.global !== sbB?.global || sbd.changed.length || sbd.added.length || sbd.removed.length || reordered) artifacts.add("storyboard");
  const audioSettings = sbA?.audio !== sbB?.audio;
  const formats: ChangeSet["formats"] = {};
  for (const [fid, tb] of Object.entries(b.timelines)) {
    const ta = a.timelines[fid];
    if (!ta) {
      formats[fid] = { changedScenes: Object.keys(tb.scenes), timing: true, global: true, cues: true };
      continue;
    }
    const d = keysDiff(ta.scenes, tb.scenes);
    const global = ta.global !== tb.global;
    formats[fid] = {
      changedScenes: global ? Object.keys(tb.scenes) : [...d.changed, ...d.added],
      timing: ta.timing !== tb.timing,
      global,
      cues: ta.cues !== tb.cues,
    };
    if (global || d.changed.length || d.added.length || d.removed.length || ta.timing !== tb.timing) artifacts.add("timeline");
  }
  if (a.mix !== b.mix || audioSettings) artifacts.add("mix");
  return {
    from: a.versionId,
    to: b.versionId,
    artifacts: [...artifacts],
    storyboardScenes: { changed: sbd.changed, added: sbd.added, removed: sbd.removed, reordered },
    formats,
  };
}

export interface ImpactPlan {
  changed: ArtifactId[];
  stale: ArtifactId[];
  rerun: {
    voice: boolean;
    audio: boolean;
    /** scenele pentru care trebuie randate cadre noi (restul se refolosesc din cache) */
    stills: Record<string, string[]>;
    /** video întreg: doar dacă structura de timp, sunetul sau imaginea s-au schimbat */
    fullRender: boolean;
  };
  reasons: string[];
}

/** Planul minim de lucru pentru o schimbare (citit de bucla de calitate și raportat utilizatorului). */
export function planImpact(cs: ChangeSet): ImpactPlan {
  const stale = downstream(cs.artifacts);
  const reasons: string[] = [];
  const voice = cs.artifacts.includes("voice");
  if (voice) reasons.push("Textul rostit sau setările vocii s-au schimbat: vocea se reface (din cache unde se poate).");
  else reasons.push("Vocea rămâne aceeași: se refolosește.");
  const anyTiming = Object.values(cs.formats).some((f) => f.timing || f.cues);
  const audio = cs.artifacts.includes("mix") || anyTiming || voice;
  reasons.push(audio ? "Momentele sonore, structura de timp sau mixul s-au schimbat: mixul se recalculează." : "Mixul rămâne valid: se refolosește.");
  const stills: Record<string, string[]> = {};
  for (const [fid, f] of Object.entries(cs.formats)) {
    stills[fid] = f.changedScenes;
    if (f.changedScenes.length)
      reasons.push(`[${fid}] ${f.changedScenes.length} scene cu imagine schimbată: ${f.changedScenes.join(", ")}; celelalte se refolosesc din cache.`);
    else reasons.push(`[${fid}] Nicio scenă cu imagine schimbată: cadrele se refolosesc.`);
  }
  const fullRender = audio || Object.values(cs.formats).some((f) => f.changedScenes.length > 0 || f.timing);
  if (!fullRender) reasons.push("Video-ul randat anterior rămâne valid (aceeași imagine și același sunet).");
  return { changed: cs.artifacts, stale: [...stale], rerun: { voice, audio, stills, fullRender }, reasons };
}

/** Impactul dintre o versiune și părintele ei (sau între două versiuni oarecare). */
export function impactBetween(projectId: string, from: string, to: string): { changes: ChangeSet; plan: ImpactPlan } {
  const changes = diffFingerprints(versionFingerprint(projectId, from), versionFingerprint(projectId, to));
  return { changes, plan: planImpact(changes) };
}

export function versionHasMix(projectId: string, versionId: string): boolean {
  return fs.existsSync(versionFile(projectId, versionId, "audio/mix.wav")) && fs.existsSync(versionFile(projectId, versionId, "audio/mix-report.json"));
}
