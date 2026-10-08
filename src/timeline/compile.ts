/**
 * Compilatorul: storyboard + script + materiale + brand + voce → timeline (singura sursă pentru randare).
 * Pur și determinist: aceleași intrări dau același timeline.
 */
import { MmsError } from "../core/errors";
import { orientationOf, resolveSafeZone } from "../core/formats";
import { projectPublicPath } from "../core/paths";
import { hashString } from "../core/random";
import {
  Timeline,
  isClaimUsable,
  type AssetManifest,
  type AudioCue,
  type BeatGrid,
  type Brand,
  type Brief,
  type FormatSpec,
  type Palette,
  type Project,
  type Research,
  type Script,
  type Storyboard,
  type StoryboardScene,
  type TimelineFont,
  type TimelineLayer,
  type TimelineScene,
  type TypographySet,
  type VoiceWord,
} from "../core/schema";
import { DIRECTIONS, type DirectionProfile } from "../creative/directions";
import { chooseTransition, sceneDuration, transitionFrames, voiceLeadFrames } from "../editing/grammar";
import { mix as mixColor } from "../motion/core/color";
import { fontSpecFor } from "../motion/typography/shared";
import { layoutText } from "../motion/core/text-layout";
import { libraryFont, toTimelineFont } from "../motion/fonts-library";
import { getCamera, getCapability, getLayer, getModifier, getTransition } from "../motion/registry";
import { getRecipe } from "../recipes/recipes";
import type { RecipeContext, ResolvedAsset } from "../recipes/types";
import { nodeMeasure } from "./measure-node";

export interface VoiceClipRef {
  lineId: string;
  /** cale publică a clipului WAV */
  src: string;
  durationSec: number;
  words: VoiceWord[];
}

export interface CompileInput {
  project: Project;
  versionId: string;
  format: FormatSpec;
  brief: Brief;
  brand: Brand;
  research: Research;
  assets: AssetManifest;
  script: Script;
  storyboard: Storyboard;
  voice: Record<string, VoiceClipRef>;
  beatGrid: BeatGrid | null;
}

export interface SceneReport {
  id: string;
  recipe: string;
  durationSec: number;
  minSec: number;
  reasons: string[];
  transition: string | null;
  notes: string[];
}

export interface CompileResult {
  timeline: Timeline;
  scenes: SceneReport[];
  warnings: string[];
}

const TEXT_CAPS = new Set(["text.word-reveal", "text.char-reveal", "text.mask-reveal", "text.slam", "text.pop", "text.blur-reveal", "text.tracking", "text.typewriter", "text.split", "text.highlight", "text.outline-fill", "text.glitch", "text.big-word", "text.body"]);

function fontsAndTypography(brand: Brand, projectId: string, assets: AssetManifest): { fonts: TimelineFont[]; typography: TypographySet; warnings: string[] } {
  const warnings: string[] = [];
  const fonts: TimelineFont[] = [];
  const add = (f: TimelineFont) => {
    if (!fonts.some((x) => x.family === f.family && x.style === f.style)) fonts.push(f);
  };
  const resolve = (ref: Brand["typography"]["display"], role: "display" | "body" | "mono") => {
    if (ref.source === "project-asset") {
      const a = assets.assets.find((x) => x.id === ref.ref);
      if (!a) throw new MmsError("FONT_MISSING", `Fontul ${ref.ref} nu există în materialele proiectului.`);
      if (a.rights.thirdParty && a.rights.status !== "confirmed-by-user" && a.rights.status !== "owned") warnings.push(`Fontul ${a.originalName} nu are drepturi confirmate.`);
      add({ family: ref.family, src: projectPublicPath(projectId, a.file), weight: "100 900", style: "normal" });
    } else add(toTimelineFont(libraryFont(ref.ref)));
    return { family: ref.family, weight: role === "display" ? ref.displayWeight : ref.weight, tracking: ref.tracking, uppercase: ref.uppercase };
  };
  const display = resolve(brand.typography.display, "display");
  const body = resolve(brand.typography.body, "body");
  const mono = brand.typography.mono ? resolve(brand.typography.mono, "mono") : resolve({ family: "JetBrains Mono", source: "library", ref: "jetbrains-mono", weight: 500, displayWeight: 700, tracking: 0, uppercase: false }, "mono");
  return { fonts, typography: { display, body, mono }, warnings };
}

function paletteOf(brand: Brand): Palette {
  const c = brand.colors;
  return {
    primary: c.primary,
    secondary: c.secondary ?? c.accent ?? c.primary,
    accent: c.accent ?? c.primary,
    background: c.background,
    surface: c.surface ?? mixColor(c.background, c.text, 0.08),
    text: c.text,
    textMuted: c.textMuted ?? mixColor(c.text, c.background, 0.4),
  };
}

function resolveAsset(projectId: string, manifest: AssetManifest, id: string): ResolvedAsset {
  // „tag:app” = materialul cu eticheta „app” (de ex. id-ul capturii), stabil între rulări
  const tags = id.startsWith("tag:") ? id.slice(4).split("+") : null;
  const a = tags ? manifest.assets.find((x) => tags.every((t) => x.tags.includes(t))) : manifest.assets.find((x) => x.id === id);
  if (!a) throw new MmsError("ASSET_MISSING", `Materialul „${id}” nu există în proiect.`);
  const w = a.media.width ?? 1000;
  const h = a.media.height ?? 1000;
  return {
    asset: a,
    src: projectPublicPath(projectId, a.file),
    w,
    h,
    kind: a.type === "video" ? "video" : a.type === "svg" ? "svg" : "image",
    regions: a.capture?.regions ?? [],
    focal: a.analysis.focalPoint ?? { x: 0.5, y: 0.5 },
  };
}

function lineTexts(script: Script, ids: string[]) {
  return ids.map((id) => script.lines.find((l) => l.id === id)).filter((l): l is Script["lines"][number] => !!l);
}

/** Parsează parametrii unui strat cu schema capabilității (aplică valorile implicite, validează). */
function parseLayer(l: TimelineLayer, sceneId: string): TimelineLayer {
  const cap = getLayer(l.capability);
  const r = cap.params.safeParse(l.params);
  if (!r.success) throw new MmsError("LAYER_PARAMS", `Parametri invalizi pentru ${l.capability} în scena ${sceneId}: ${r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  const modifiers = l.modifiers.map((m) => {
    const mr = getModifier(m.capability).params.safeParse(m.params);
    if (!mr.success) throw new MmsError("MODIFIER_PARAMS", `Parametri invalizi pentru ${m.capability} (${l.capability}, ${sceneId}).`);
    return { capability: m.capability, params: mr.data as Record<string, unknown> };
  });
  return { ...l, params: r.data as Record<string, unknown>, modifiers, children: l.children.map((c) => parseLayer(c, sceneId)) };
}

/** FPS-ul de referință pentru structura tăieturilor (duratele tranzițiilor din registry sunt la 30 fps). */
export const REF_FPS = 30;

export function compileTimeline(input: CompileInput): CompileResult {
  const { project, format, brief, brand, research, assets, script, storyboard } = input;
  const warnings: string[] = [];
  const W = format.width;
  const H = format.height;
  const fps = format.fps;
  const orientation = orientationOf(W, H);
  const safe = resolveSafeZone(format);
  const dir: DirectionProfile = DIRECTIONS[storyboard.direction ?? brief.direction ?? "technical"];
  if (!storyboard.direction && !brief.direction) warnings.push("Brief-ul nu are direcție aleasă; folosesc „technical” până alegi una.");
  const palette = paletteOf(brand);
  const { fonts, typography, warnings: fw } = fontsAndTypography(brand, project.id, assets);
  warnings.push(...fw);
  const measure = nodeMeasure(fonts);
  const logo = brand.logo.primary ? resolveAsset(project.id, assets, brand.logo.primary) : null;
  const usableClaims = research.claims.filter(isClaimUsable);
  const forbidden = brief.visual.forbiddenCapabilities;

  // 1. durate (secunde) din gramatica de montaj
  const plans = storyboard.scenes.map((sc) => {
    const lines = lineTexts(script, sc.lineIds);
    const voSec = lines.reduce((s, l) => s + (input.voice[l.id]?.durationSec ?? 0) + l.pauseAfterMs / 1000, 0);
    const onScreen = sc.text.headline ?? lines.map((l) => l.onScreen).join(" ");
    const recipe = getRecipe(sc.recipe.id);
    const recipeMin = Math.max(recipe.minSec, recipe.minSecFor?.({ headline: sc.text.headline, sub: sc.text.sub, items: sc.text.items ?? [] }) ?? 0);
    const d = sceneDuration({ voSec, onScreen: [onScreen, sc.text.sub ?? ""].join(" ").trim(), shot: sc.shot, energy: sc.energy, role: sc.narrativeRole, recipeMinSec: recipeMin, explicitSec: sc.durationSec, dir, pacing: brief.pacing });
    return { sc, lines, d, recipe };
  });
  // 2. potrivire cu durata cerută: timpul în plus se împarte scenelor fără voce care pot crește
  const natural = plans.reduce((s, p) => s + p.d.sec, 0);
  const target = brief.durationSec;
  if (natural < target * 0.97) {
    const extra = target - natural;
    const flexible = plans.filter((p) => p.sc.durationSec === null);
    const weights = flexible.map((p) => (p.sc.narrativeRole === "cta" ? 0.6 : 1) * (1.2 - p.sc.energy));
    const tw = weights.reduce((a, b) => a + b, 0) || 1;
    flexible.forEach((p, i) => (p.d.sec += (extra * weights[i]) / tw));
  } else if (natural > target * 1.15) {
    warnings.push(`Durata naturală (${natural.toFixed(1)} s) depășește ținta (${target} s) cu peste 15%: vocea și timpul de citire nu permit mai scurt. Scurtează scriptul sau acceptă durata.`);
  }

  // 3. tranziții și tăieturi pe ritm. Structura se calculează o singură dată, la REF_FPS (duratele tranzițiilor
  //    din registry și din storyboard sunt în cadre la 30 fps), apoi se convertește prin secunde la FPS-ul formatului.
  //    Așa toate formatele au aceleași tăieturi (±1 cadru), iar mixul audio comun rămâne sincron.
  const R = REF_FPS;
  const beatRef: number[] = [];
  if (input.beatGrid) {
    const step = (60 / input.beatGrid.bpm) * R;
    for (let f = input.beatGrid.offsetSec * R; f < (target + 20) * R; f += step) beatRef.push(Math.round(f));
  }
  const durRef = plans.map((p) => Math.round(p.d.sec * R));
  const minRef = plans.map((p) => Math.ceil(p.d.minSec * R));
  let previousTransition: string | null = null;
  const trRef: Array<{ capability: string; frames: number; params: Record<string, unknown> } | null> = plans.map((p, i) => {
    if (i === 0) return null;
    const prev = plans[i - 1].sc;
    const chosen = p.sc.transitionIn?.capability ?? chooseTransition({ energy: prev.energy, role: prev.narrativeRole }, { energy: p.sc.energy, role: p.sc.narrativeRole, id: p.sc.id }, dir, project.seed, forbidden, previousTransition);
    previousTransition = chosen;
    const tr = getTransition(chosen);
    const params = tr.params.parse(p.sc.transitionIn?.params ?? {}) as Record<string, unknown>;
    const frames = p.sc.transitionIn?.durationFrames ?? transitionFrames(tr.defaultDuration, brief.pacing, durRef[i - 1], durRef[i]);
    return { capability: chosen, frames: Math.min(frames, Math.floor(Math.min(durRef[i - 1], durRef[i]) * 0.45)), params };
  });
  const startsRef: number[] = [];
  let cursor = 0;
  for (let i = 0; i < plans.length; i++) {
    startsRef.push(cursor);
    let end = cursor + durRef[i];
    const d = trRef[i + 1]?.frames ?? 0;
    const snap = plans[i].sc.beat.snap;
    if (beatRef.length && snap !== "none" && i < plans.length - 1) {
      const cut = end - d / 2;
      const grid = snap === "bar" ? beatRef.filter((_, k) => k % (input.beatGrid?.beatsPerBar ?? 4) === 0) : beatRef;
      const nearest = grid.reduce((b, f) => (Math.abs(f - cut) < Math.abs(b - cut) ? f : b), grid[0]);
      const newEnd = Math.round(nearest + d / 2);
      if (newEnd - cursor >= minRef[i] && Math.abs(newEnd - end) <= Math.max(4, durRef[i] * 0.25)) end = newEnd;
    }
    durRef[i] = end - cursor;
    cursor = end - d;
  }
  // conversia la FPS-ul formatului: începuturile și sfârșiturile se rotunjesc din secunde,
  // iar tranziția devine exact suprapunerea dintre scene (fără goluri, deci fără cadre negre)
  const toF = (refFrames: number) => Math.round((refFrames / R) * fps);
  const starts = startsRef.map(toF);
  const ends = startsRef.map((st, i) => toF(st + durRef[i]));
  const durFrames = starts.map((st, i) => ends[i] - st);
  const transitions = trRef.map((t, i) => (t && i > 0 ? { ...t, frames: Math.max(0, ends[i - 1] - starts[i]) } : t));
  const beatFrames: number[] = [];
  if (input.beatGrid) {
    const step = (60 / input.beatGrid.bpm) * fps;
    for (let f = input.beatGrid.offsetSec * fps; f < (target + 20) * fps; f += step) beatFrames.push(Math.round(f));
  }
  const total = starts[starts.length - 1] + durFrames[durFrames.length - 1];

  // 4. scenele: rețete → straturi, cameră, sunete
  const scenes: TimelineScene[] = [];
  const reports: SceneReport[] = [];
  const cues: AudioCue[] = [];
  const voiceCues: Array<{ lineId: string; at: number; src: string; durationSec: number; words: VoiceWord[] }> = [];
  let uidCounter = 0;
  plans.forEach((plan, i) => {
    const sc: StoryboardScene = plan.sc;
    const duration = durFrames[i];
    const from = starts[i];
    const slotGet = (name: string): ResolvedAsset | null => {
      const v = sc.slots[name];
      const id = Array.isArray(v) ? v[0] : v;
      return id ? resolveAsset(project.id, assets, id) : null;
    };
    const slotsGet = (name: string): ResolvedAsset[] => {
      const v = sc.slots[name];
      return (Array.isArray(v) ? v : v ? [v] : []).map((id) => resolveAsset(project.id, assets, id));
    };
    const focusAsset = sc.focus ? resolveAsset(project.id, assets, sc.focus.assetId) : null;
    const focusRegion = sc.focus?.region && focusAsset ? (focusAsset.regions.find((r) => r.id === sc.focus!.region) ?? null) : null;
    const lines = plan.lines;
    const sceneBeats = beatFrames.filter((f) => f >= from && f < from + duration).map((f) => f - from);
    const ctx: RecipeContext = {
      W,
      H,
      fps,
      orientation,
      safe,
      duration,
      scene: sc,
      dir,
      energy: sc.energy,
      text: {
        headline: sc.text.headline ?? lines.map((l) => l.onScreen).filter(Boolean).join(" "),
        sub: sc.text.sub ?? "",
        items: sc.text.items ?? [],
        emphasis: lines.flatMap((l) => l.emphasis),
        vo: lines.map((l) => l.voiceover).join(" "),
      },
      slot: slotGet,
      slots: slotsGet,
      logo,
      productName: project.product.name,
      claims: usableClaims.filter((c) => lines.some((l) => l.claimIds.includes(c.id))),
      beats: sceneBeats,
      focusRegion,
      focusAsset,
      effectsLevel: brief.visual.effectsLevel,
      palette,
      captions: brief.captions.burnIn && Object.keys(input.voice).length > 0,
      forbidden,
      uid: (hint) => `${sc.id}-${hint}-${++uidCounter}`,
    };
    const params = plan.recipe.params.parse(sc.recipe.params);
    const out = plan.recipe.build(ctx, params);
    // suprascrieri explicite din storyboard pe straturile rețetei (după capabilitate)
    // `slot` = capabilitatea sau o parte din id-ul stratului; capabilitatea se poate înlocui (aceeași cutie)
    for (const o of sc.overrides) {
      const target = out.layers.find((l) => l.capability === o.slot || l.id.includes(o.slot));
      if (!target) {
        warnings.push(`Suprascrierea „${o.slot}” din scena ${sc.id} nu găsește niciun strat.`);
        continue;
      }
      target.capability = o.capability;
      target.params = { ...target.params, ...o.params };
    }
    // textul: rânduri și mărime calculate cu fonturile reale
    const layoutLayer = (l: TimelineLayer): TimelineLayer => {
      if (TEXT_CAPS.has(l.capability)) {
        const cap = getLayer(l.capability);
        const p = cap.params.parse(l.params) as Record<string, unknown> & { text: string; font: "display" | "body" | "mono"; maxSize: number; minSize: number; lineHeight: number; maxLines?: number; weight?: number; uppercase?: boolean; tracking?: number };
        const spec = fontSpecFor({ typography } as never, p);
        const lay = layoutText(p.text, spec, { w: l.box.w, h: l.box.h }, measure, { maxSize: p.maxSize, minSize: p.minSize, lineHeight: p.lineHeight, maxLines: p.maxLines });
        if (lay.overflow) warnings.push(`Textul „${p.text.slice(0, 40)}” nu încape în cutie nici la ${p.minSize}px (scena ${sc.id}).`);
        return { ...l, params: { ...l.params, lines: lay.lines, fontSize: lay.fontSize } };
      }
      return { ...l, children: l.children.map(layoutLayer) };
    };
    const layers = out.layers.map(layoutLayer).map((l) => parseLayer(l, sc.id));
    // camera
    const camCap = getCamera(sc.camera?.capability ?? out.camera.capability);
    const camParams = camCap.params.parse(sc.camera?.params ?? out.camera.params);
    const built = camCap.build(camParams as never, { duration, width: W, height: H, focus: out.focus ? { x: out.focus.x, y: out.focus.y } : null, focusZoom: out.focus?.zoom ?? 1.5, energy: sc.energy, target: out.focus?.target });
    const camera = {
      keys: out.cameraKeys ?? built.keys,
      handheld: built.handheld ?? 0,
      shake: built.shake ?? [],
      punches: built.punches ?? [],
      perspective: 1600,
      motionBlur: true,
      ...(built.depthOfField ? { depthOfField: built.depthOfField } : {}),
    };
    const tr = transitions[i];
    scenes.push({
      id: sc.id,
      from,
      durationInFrames: duration,
      transitionIn: tr ? { capability: tr.capability, durationInFrames: tr.frames, params: tr.params } : null,
      camera,
      layers,
      meta: { purpose: sc.purpose, narrativeRole: sc.narrativeRole, recipe: sc.recipe.id, shot: sc.shot, energy: sc.energy },
    });
    // vocea: J-cut când energia crește, altfel după jumătatea tranziției
    const prevEnergy = i ? plans[i - 1].sc.energy : sc.energy;
    let vAt = from + voiceLeadFrames(fps, tr?.frames ?? 0, sc.energy - prevEnergy);
    if (i === 0) vAt = Math.max(vAt, Math.round(fps * 0.15));
    for (const l of lines) {
      const v = input.voice[l.id];
      if (!v) continue;
      // dacă replica e deja scrisă pe ecran (același text), subtitrarea ar dubla-o: o omitem
      const shown = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, "").replace(/\s+/g, " ").trim();
      const onScreenSame = !!l.onScreen && shown(l.onScreen) === shown(l.voiceover);
      voiceCues.push({ lineId: l.id, at: Math.max(0, vAt), src: v.src, durationSec: v.durationSec, words: onScreenSame ? [] : v.words });
      cues.push({ id: `vo-${l.id}`, kind: "voice", atFrame: Math.max(0, vAt), sound: v.src, gainDb: 0, pan: 0, sceneId: sc.id, reason: `vocea replicii ${l.id}` });
      vAt += Math.round((v.durationSec + l.pauseAfterMs / 1000) * fps);
    }
    // sunetele declarate de capabilități (efecte vizuale) și de rețetă
    if (sc.audio.sfx !== "none") {
      const collect = (l: TimelineLayer, base: number) => {
        const cap = getLayer(l.capability);
        for (const s of cap.sfx) {
          const at0 = base + l.from;
          let frames: Array<{ at: number; gainDb?: number; sound?: string }> = [];
          if (s.at === "start") frames = [{ at: at0 + (s.offsetFrames ?? 0) }];
          else if (s.at === "end") frames = [{ at: at0 + l.durationInFrames - 1 }];
          else if (s.at === "each") frames = (cap.events?.(l.params as never, l.durationInFrames) ?? []).map((e) => ({ at: at0 + e.at, gainDb: e.gainDb, sound: e.sound }));
          else {
            const v = l.params[s.at.slice("param:".length)];
            if (typeof v === "number") frames = [{ at: at0 + v }];
          }
          for (const f of frames) if (f.at < from + duration && f.at >= 0) cues.push({ id: `sfx-${l.id}-${f.at}-${s.sound}`, kind: "sfx", atFrame: f.at, sound: f.sound ?? s.sound, gainDb: (s.gainDb ?? 0) + (f.gainDb ?? 0), pan: 0, sceneId: sc.id, layerId: l.id, reason: `${l.capability}${s.at === "each" ? " (fiecare element)" : ""}` });
        }
        for (const c of l.children) collect(c, base + l.from);
      };
      for (const l of layers) collect(l, from);
      for (const c of out.cues ?? []) cues.push({ id: `rc-${sc.id}-${c.at}-${c.sound}`, kind: "sfx", atFrame: from + c.at, sound: c.sound, gainDb: c.gainDb ?? 0, pan: 0, sceneId: sc.id, reason: c.reason });
      if (tr) for (const s of getTransition(tr.capability).sfx) cues.push({ id: `tr-${sc.id}-${s.sound}`, kind: "sfx", atFrame: Math.max(0, from + (s.at === "end" ? tr.frames : 0) + (s.offsetFrames ?? 0) - (s.sound.startsWith("whoosh") || s.sound === "swipe" ? Math.round(fps * 0.12) : 0)), sound: s.sound, gainDb: s.gainDb ?? 0, pan: 0, sceneId: sc.id, reason: `tranziția ${tr.capability}` });
    }
    reports.push({ id: sc.id, recipe: sc.recipe.id, durationSec: duration / fps, minSec: plan.d.minSec, reasons: plan.d.reasons, transition: tr?.capability ?? null, notes: out.notes ?? [] });
  });

  // 5. densitatea efectelor sonore (brief): filtrare deterministă și fără aglomerare
  const density = brief.audio.sfxDensity;
  let sfx = cues.filter((c) => c.kind === "sfx");
  if (density === "none") sfx = [];
  else {
    const keepEvery = density === "low" ? ["impact", "impact-small", "bass-hit", "whoosh", "whoosh-fast", "whoosh-long", "swipe", "shimmer", "click", "pop"] : null;
    if (keepEvery) sfx = sfx.filter((c) => keepEvery.includes(c.sound));
    sfx.sort((a, b) => a.atFrame - b.atFrame || a.id.localeCompare(b.id));
    const kept: AudioCue[] = [];
    for (const c of sfx) {
      const near = kept.filter((k) => Math.abs(k.atFrame - c.atFrame) <= 2);
      const sameSoon = kept.some((k) => k.sound === c.sound && c.atFrame - k.atFrame < (c.sound === "key" ? 2 : 4));
      if (near.length < 2 && !sameSoon) kept.push(c);
    }
    sfx = density === "medium" ? kept.map((c) => ({ ...c, gainDb: c.gainDb - 2 })) : kept;
  }
  const finalCues = [...cues.filter((c) => c.kind !== "sfx"), ...sfx].sort((a, b) => a.atFrame - b.atFrame || a.id.localeCompare(b.id));

  // 6. subtitrări din cuvintele vocii
  let captions: Timeline["captions"] = null;
  if (brief.captions.burnIn && voiceCues.length) {
    const words = voiceCues.flatMap((v) => v.words.map((w) => ({ text: w.text, from: v.at + Math.round(w.startSec * fps), to: v.at + Math.max(Math.round(w.startSec * fps) + 2, Math.round(w.endSec * fps)) })));
    const s = safe.rect;
    const h = orientation === "portrait" ? H * 0.075 : H * 0.11;
    const box = { x: s.x, y: s.y + s.h - h, w: s.w, h };
    captions = { words, box, params: { maxWords: orientation === "portrait" ? 3 : 5, style: "highlight", color: "#ffffff", activeColor: "accent", size: Math.round(orientation === "portrait" ? W * 0.055 : H * 0.05), uppercase: false, backdrop: orientation === "portrait" } };
  }

  // 7. materiale fără drepturi confirmate → marcaj „concept”
  const usedAssetIds = new Set<string>();
  const visit = (l: TimelineLayer) => {
    for (const a of l.assets) {
      const m = a.match(/^projects\/[^/]+\/assets\/([^.]+)\./);
      if (m) usedAssetIds.add(m[1]);
    }
    l.children.forEach(visit);
  };
  scenes.forEach((s) => s.layers.forEach(visit));
  const concept = assets.assets.some((a) => usedAssetIds.has(a.id) && a.rights.thirdParty && a.rights.status !== "confirmed-by-user" && a.rights.status !== "owned");
  if (concept) warnings.push("Se folosesc materiale ale unor terți fără drepturi confirmate: preview-ul e marcat „concept”, iar exportul final e blocat.");

  const timeline: Timeline = Timeline.parse({
    schemaVersion: 1,
    projectId: project.id,
    versionId: input.versionId,
    formatId: format.id,
    seed: (project.seed ^ hashString(format.id)) >>> 0,
    fps,
    width: W,
    height: H,
    durationInFrames: total,
    safeZone: { top: safe.top, right: safe.right, bottom: safe.bottom, left: safe.left },
    fonts,
    palette,
    typography,
    scenes,
    overlays: [],
    captions,
    audio: { src: null, cues: finalCues, beatGrid: input.beatGrid },
    markers: [
      ...scenes.map((s) => ({ frame: s.from, label: `${s.id} (${s.meta.recipe})`, kind: "scene" })),
      ...scenes.filter((s) => s.meta.narrativeRole === "cta").map((s) => ({ frame: s.from + Math.max(0, s.durationInFrames - Math.round(2.5 * fps)), label: "hold CTA", kind: "cta-hold" })),
    ],
    concept,
  });
  return { timeline, scenes: reports, warnings };
}

export { getCapability };
