/**
 * Compilatorul: storyboard + script + materiale + brand + voce → timeline (singura sursă pentru randare).
 * Pur și determinist: aceleași intrări dau același timeline.
 */
import { chooseCounterpart, counterpartRegion } from "../assets/counterpart";
import { MmsError } from "../core/errors";
import { orientationOf, resolveSafeZone } from "../core/formats";
import { projectPublicPath } from "../core/paths";
import { hashString } from "../core/random";
import {
  Timeline,
  assetRegions,
  isClaimUsable,
  type AssetManifest,
  type AudioCue,
  type BeatGrid,
  type Brand,
  type Brief,
  type FormatSpec,
  type Palette,
  type Project,
  type Rect,
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
import { contrastRatio, mix as mixColor, readableTint } from "../motion/core/color";
import { fontSpecFor } from "../motion/typography/shared";
import { layoutText } from "../motion/core/text-layout";
import { libraryFont, toTimelineFont } from "../motion/fonts-library";
import { getCamera, getCapability, getLayer, getModifier, getTransition } from "../motion/registry";
import { spaceUnit } from "../recipes/kit";
import { planCompositions } from "../recipes/layout";
import { getRecipe } from "../recipes/recipes";
import type { RecipeContext, ResolvedAsset } from "../recipes/types";
import { nodeMeasure } from "./measure-node";
import { applyDna, type DnaAspect, type ReferenceDNA } from "../references/dna";
import { LAYOUT_TEXT_CAPS, LAYOUT_TEXT_CAPS as TEXT_CAPS } from "../motion/text-caps";
import { focusRects, holdFrame, overlapArea } from "./geometry";
import { innerCut, varyCamera } from "./inner-cuts";
import { platformProfile } from "../platform/profiles";

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
  /** referințele analizate (Reference DNA) și aspectele preluate din ele */
  references?: Array<{ dna: ReferenceDNA; aspects: Set<DnaAspect> }>;
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
      if (a.rights.thirdParty && a.rights.status !== "confirmed-by-user" && a.rights.status !== "owned")
        warnings.push(`Fontul ${a.originalName} nu are drepturi confirmate.`);
      add({ family: ref.family, src: projectPublicPath(projectId, a.file), weight: "100 900", style: "normal" });
    } else add(toTimelineFont(libraryFont(ref.ref)));
    return { family: ref.family, weight: role === "display" ? ref.displayWeight : ref.weight, tracking: ref.tracking, uppercase: ref.uppercase };
  };
  const display = resolve(brand.typography.display, "display");
  const body = resolve(brand.typography.body, "body");
  const mono = brand.typography.mono
    ? resolve(brand.typography.mono, "mono")
    : resolve({ family: "JetBrains Mono", source: "library", ref: "jetbrains-mono", weight: 500, displayWeight: 700, tracking: 0, uppercase: false }, "mono");
  return { fonts, typography: { display, body, mono }, warnings };
}

/**
 * Culoarea cuvântului rostit din subtitrări: nuanța accentului (sau a culorii principale), cât de deschisă
 * trebuie ca să se citească pe fundalul subtitrărilor (în cel mai rău caz, fundalul translucid peste alb)
 * și să se deosebească de restul frazei, care e albă.
 */
export function captionActiveColor(p: Palette): string {
  const worst = mixColor("#ffffff", "#080a14", 0.62);
  // dintre accent și culoarea principală, nuanța care rămâne mai colorată după deschidere
  const chroma = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    return Math.max(r, g, b) - Math.min(r, g, b);
  };
  const tints = [p.accent, p.primary].map((c) => readableTint(c, worst, 3)).filter((c) => contrastRatio(c, "#ffffff") >= 1.25);
  return tints.reduce<string | null>((best, c) => (!best || chroma(c) > chroma(best) ? c : best), null) ?? readableTint(p.accent, worst, 3);
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
    // textul secundar (subtitluri, adresa de pe cardul final) rămâne lizibil pe fundal: minimum 4,5:1
    textMuted: readableTint(c.textMuted ?? mixColor(c.text, c.background, 0.4), c.background, 4.5),
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
    regions: assetRegions(a),
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
  if (!r.success)
    throw new MmsError(
      "LAYER_PARAMS",
      `Parametri invalizi pentru ${l.capability} în scena ${sceneId}: ${r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
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
  // direcția, ajustată de structura referințelor (ritm, tranziții, cameră, tempo)
  const dna = applyDna(DIRECTIONS[storyboard.direction ?? brief.direction ?? "technical"], input.references ?? []);
  const dir: DirectionProfile = dna.dir;
  const pacing = dna.pacing ?? brief.pacing;
  warnings.push(...dna.notes.map((n) => `Referință: ${n}`));
  if (!storyboard.direction && !brief.direction) warnings.push("Brief-ul nu are direcție aleasă; folosesc „technical” până alegi una.");
  const palette = paletteOf(brand);
  const { fonts, typography, warnings: fw } = fontsAndTypography(brand, project.id, assets);
  warnings.push(...fw);
  const measure = nodeMeasure(fonts);
  const logo = brand.logo.primary ? resolveAsset(project.id, assets, brand.logo.primary) : null;
  const usableClaims = research.claims.filter(isClaimUsable);
  const assetByPublicPath = new Map(assets.assets.map((a) => [projectPublicPath(project.id, a.file), a] as const));
  const forbidden = brief.visual.forbiddenCapabilities;

  // 1. durate (secunde) din gramatica de montaj
  const plans = storyboard.scenes.map((sc) => {
    const lines = lineTexts(script, sc.lineIds);
    const voSec = lines.reduce((s, l) => s + (input.voice[l.id]?.durationSec ?? 0) + l.pauseAfterMs / 1000, 0);
    const onScreen = sc.text.headline ?? lines.map((l) => l.onScreen).join(" ");
    const recipe = getRecipe(sc.recipe.id);
    const recipeMin = Math.max(recipe.minSec, recipe.minSecFor?.({ headline: sc.text.headline, sub: sc.text.sub, items: sc.text.items ?? [] }) ?? 0);
    const durationFor = (vo: number) =>
      sceneDuration({
        voSec: vo,
        onScreen: [onScreen, sc.text.sub ?? ""].join(" ").trim(),
        shot: sc.shot,
        energy: sc.energy,
        role: sc.narrativeRole,
        recipeMinSec: recipeMin,
        explicitSec: sc.durationSec,
        dir,
        pacing,
      });
    const d = durationFor(voSec);
    // minimul cu L-cut: vocea poate continua `lCutSec` peste scena următoare
    const lCut = sc.audio.lCutSec ?? 0;
    const minSecLCut = lCut > 0 ? durationFor(Math.max(0, voSec - lCut)).minSec : d.minSec;
    return { sc, lines, d, recipe, minSecLCut };
  });
  // 2. potrivire cu durata cerută: timpul în plus se împarte scenelor fără voce care pot crește
  const natural = plans.reduce((s, p) => s + p.d.sec, 0);
  const target = brief.durationSec;
  if (natural < target * 0.97) {
    const extra = target - natural;
    const flexible = plans.filter((p) => p.sc.durationSec === null);
    const weights = flexible.map((p) => (p.sc.narrativeRole === "cta" ? 0.6 : 1) * (1.2 - p.sc.energy));
    const tw = weights.reduce((a, b) => a + b, 0) || 1;
    flexible.forEach((p, i) => {
      p.d.sec += (extra * weights[i]) / tw;
    });
  } else if (natural > target * 1.15) {
    warnings.push(
      `Durata naturală (${natural.toFixed(1)} s) depășește ținta (${target} s) cu peste 15%: vocea și timpul de citire nu permit mai scurt. Scurtează scriptul sau acceptă durata.`,
    );
  }

  // 3. tranziții și tăieturi pe ritm. Structura se calculează o singură dată, la REF_FPS (duratele tranzițiilor
  //    din registry și din storyboard sunt în cadre la 30 fps), apoi se convertește prin secunde la FPS-ul formatului.
  //    Așa toate formatele au aceleași tăieturi (±1 cadru), iar mixul audio comun rămâne sincron.
  const R = REF_FPS;
  const beatRef: number[] = [];
  // tăieturile se aliniază pe bătăi doar dacă tempo-ul e sigur (detectat cu încredere mică = fără aliniere, nu aliniere greșită)
  const reliable = !!input.beatGrid && (input.beatGrid.source !== "detected" || input.beatGrid.confidence >= 0.35);
  if (input.beatGrid && !reliable)
    warnings.push(
      `Tempo-ul muzicii e detectat cu încredere mică (${input.beatGrid.confidence.toFixed(2)}): tăieturile nu se aliniază pe bătăi. Fixează tempo-ul în brief (audio.music.bpm) dacă îl știi.`,
    );
  if (input.beatGrid && reliable) {
    const step = (60 / input.beatGrid.bpm) * R;
    for (let f = input.beatGrid.offsetSec * R; f < (target + 20) * R; f += step) beatRef.push(Math.round(f));
  }
  // drop-urile muzicii: tăietura spre dezvăluire / punctul culminant cade pe drop, dacă e aproape
  const dropRef = reliable ? (input.beatGrid?.drops ?? []).map((sec) => Math.round(sec * R)) : [];
  const durRef = plans.map((p) => Math.round(p.d.sec * R));
  const minRef = plans.map((p) => Math.ceil(p.d.minSec * R));
  // L-cut (aplicat după alinierea pe bătăi, mai jos): vocea scenei următoare se decalează cu cât a câștigat scena
  const voiceShiftRef = plans.map(() => 0);
  let previousTransition: string | null = null;
  const trRef: Array<{ capability: string; frames: number; params: Record<string, unknown> } | null> = plans.map((p, i) => {
    if (i === 0) return null;
    const prev = plans[i - 1].sc;
    const chosen =
      p.sc.transitionIn?.capability ??
      chooseTransition(
        { energy: prev.energy, role: prev.narrativeRole },
        { energy: p.sc.energy, role: p.sc.narrativeRole, id: p.sc.id },
        dir,
        project.seed,
        forbidden,
        previousTransition,
      );
    previousTransition = chosen;
    const tr = getTransition(chosen);
    const params = tr.params.parse(p.sc.transitionIn?.params ?? {}) as Record<string, unknown>;
    const frames = p.sc.transitionIn?.durationFrames ?? transitionFrames(tr.defaultDuration, pacing, durRef[i - 1], durRef[i]);
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
      // după un L-cut, scena a început mai devreme: alinierea se judecă față de începutul și durata ei fără L-cut
      const start0 = cursor + voiceShiftRef[i];
      const dur0 = durRef[i] - voiceShiftRef[i];
      const cut = end - d / 2;
      const nextRole = plans[i + 1].sc.narrativeRole;
      const toReveal = (nextRole === "reveal" || nextRole === "solution" || nextRole === "transformation") && dropRef.length > 0;
      const drop = toReveal ? dropRef.reduce((b, f) => (Math.abs(f - cut) < Math.abs(b - cut) ? f : b), dropRef[0]) : null;
      const dropEnd = drop !== null ? Math.round(drop + d / 2) : null;
      if (dropEnd !== null && dropEnd - start0 >= minRef[i] && Math.abs(dropEnd - end) <= Math.max(6, dur0 * 0.35)) end = dropEnd;
      else {
        const grid = snap === "bar" ? beatRef.filter((_, k) => k % (input.beatGrid?.beatsPerBar ?? 4) === 0) : beatRef;
        // cea mai apropiată bătaie care lasă scena peste minimul ei (voce, citire, hold); dacă cea mai apropiată ar
        // scurta-o prea mult, tăietura trece pe bătaia următoare, cât timp mutarea rămâne mică față de scenă
        const newEnd = [...grid]
          .sort((a, b) => Math.abs(a - cut) - Math.abs(b - cut))
          .map((f) => Math.round(f + d / 2))
          .filter((e) => Math.abs(e - end) <= Math.max(4, dur0 * 0.25))
          .find((e) => e - start0 >= minRef[i]);
        if (newEnd !== undefined) end = newEnd;
      }
    }
    durRef[i] = end - cursor;
    // L-cut: imaginea trece la scena următoare cu `lCutSec` înainte de finalul replicii. Scena următoare începe mai
    // devreme cu exact atât și își decalează vocea la fel: pista de voce și restul reclamei rămân pe loc.
    const want = Math.round((plans[i].sc.audio.lCutSec ?? 0) * R);
    if (want && i < plans.length - 1) {
      const take = Math.min(want, durRef[i] - Math.ceil(plans[i].minSecLCut * R));
      if (take <= 0) warnings.push(`L-cut-ul din ${plans[i].sc.id} nu încape: scena e deja la durata minimă (citire, rețetă sau hold).`);
      else {
        if (take < want) warnings.push(`L-cut-ul din ${plans[i].sc.id} e scurtat la ${(take / R).toFixed(2)} s: scena nu poate fi mai scurtă.`);
        durRef[i] -= take;
        durRef[i + 1] += take;
        voiceShiftRef[i + 1] = take;
        end -= take;
      }
    }
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
  // bătăile pentru punch-uri și accente: doar pe tempo sigur
  if (input.beatGrid && reliable) {
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
  // ce trebuie tăieturilor din interiorul scenelor (pasul 5c): focusul rețetei, camera explicită, bătăile
  const innerInfo = new Map<
    string,
    { focus: { x: number; y: number; zoom: number; target?: { x: number; y: number } } | undefined; explicit: boolean; beats: number[] }
  >();
  // așezarea fiecărei scene pe acest format: „auto” devine o așezare a rețetei cu textul în alt loc decât în
  // scena anterioară (planificatorul de compoziție); o așezare scrisă în storyboard rămâne
  const compositions = planCompositions(
    plans.map((p) => ({ composition: p.sc.composition, recipe: p.recipe })),
    orientation,
  );
  plans.forEach((plan, i) => {
    const sc: StoryboardScene = plan.sc;
    const duration = durFrames[i];
    const from = starts[i];
    const focusOrig = sc.focus ? resolveAsset(project.id, assets, sc.focus.assetId) : null;
    // zona cerută poate fi și una cu date personale (de ex. ca să arăți că e estompată)
    const origRegion =
      sc.focus?.region && focusOrig
        ? (focusOrig.regions.find((r) => r.id === sc.focus!.region) ?? focusOrig.asset.pii.regions.find((r) => r.id === sc.focus!.region) ?? null)
        : null;
    if (sc.focus?.region && focusOrig && !origRegion)
      warnings.push(
        `Zona „${sc.focus.region}” din scena ${sc.id} nu există în ${focusOrig.asset.id}; rețeta alege zona cea mai potrivită textului. Zonele disponibile: captures/<id>.json → regions.`,
      );
    // pe vertical, o captură desktop se înlocuiește cu captura de telefon a aceleiași pagini, dacă există și
    // dacă arată zona demonstrată în scenă; aceeași alegere pentru slot și pentru focus
    const sceneNotes = new Set<string>();
    const chosen = new Map<string, ResolvedAsset>();
    // id-urile de zone din parametrii rețetei (de ex. drag.from / drag.to) și echivalentul lor pe telefon
    const paramStrings = new Set<string>();
    const collect = (v: unknown): void => {
      if (typeof v === "string") paramStrings.add(v);
      else if (Array.isArray(v)) v.forEach(collect);
      else if (v && typeof v === "object") Object.values(v).forEach(collect);
    };
    collect(sc.recipe.params);
    const regionRemap = new Map<string, string>();
    const pick = (id: string): ResolvedAsset => {
      const r = resolveAsset(project.id, assets, id);
      if (orientation !== "portrait") return r;
      const done = chosen.get(r.asset.id);
      if (done) return done;
      const wanted = [
        ...(focusOrig?.asset.id === r.asset.id && origRegion ? [origRegion] : []),
        ...r.regions.filter((x) => paramStrings.has(x.id) && x.id !== origRegion?.id),
      ];
      const c = chooseCounterpart(assets, r.asset, wanted);
      if (c.note) sceneNotes.add(c.note);
      if (c.asset)
        for (const w of wanted) {
          const m = counterpartRegion(w, c.asset);
          if (m && m.id !== w.id) regionRemap.set(w.id, m.id);
        }
      const out = c.asset ? resolveAsset(project.id, assets, c.asset.id) : r;
      chosen.set(r.asset.id, out);
      return out;
    };
    const slotGet = (name: string): ResolvedAsset | null => {
      const v = sc.slots[name];
      const id = Array.isArray(v) ? v[0] : v;
      return id ? pick(id) : null;
    };
    const slotsGet = (name: string): ResolvedAsset[] => {
      const v = sc.slots[name];
      return (Array.isArray(v) ? v : v ? [v] : []).map(pick);
    };
    // alegerea se face înainte de parametri: zonele din parametri se remapează pe captura de telefon
    for (const v of Object.values(sc.slots)) for (const id of [v].flat()) if (id) pick(id);
    // focusul dă zonele în coordonatele capturii afișate: se schimbă doar împreună cu materialul din slot
    // (o înregistrare desktop păstrează zonele capturii desktop a aceleiași pagini)
    const focusAsset = focusOrig ? (chosen.get(focusOrig.asset.id) ?? focusOrig) : null;
    const focusRegion = focusAsset && focusOrig && focusAsset.asset.id !== focusOrig.asset.id ? counterpartRegion(origRegion, focusAsset.asset) : origRegion;
    const lines = plan.lines;
    const sceneBeats = beatFrames.filter((f) => f >= from && f < from + duration).map((f) => f - from);
    const ctx: RecipeContext = {
      W,
      H,
      fps,
      orientation,
      safe,
      duration,
      scene: { ...sc, composition: compositions[i] },
      dir,
      energy: sc.energy,
      text: {
        headline:
          sc.text.headline ??
          lines
            .map((l) => l.onScreen)
            .filter(Boolean)
            .join(" "),
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
      shape: brand.shape,
      captions: brief.captions.burnIn && Object.keys(input.voice).length > 0,
      forbidden,
      uid: (hint) => `${sc.id}-${hint}-${++uidCounter}`,
    };
    const remap = (v: unknown): unknown =>
      typeof v === "string"
        ? (regionRemap.get(v) ?? v)
        : Array.isArray(v)
          ? v.map(remap)
          : v && typeof v === "object"
            ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, remap(x)]))
            : v;
    const params = plan.recipe.params.parse(regionRemap.size ? remap(sc.recipe.params) : sc.recipe.params);
    const out = plan.recipe.build(ctx, params);
    // suprascrieri explicite din storyboard pe straturile rețetei (după capabilitate)
    // `slot` = capabilitatea sau o parte din id-ul stratului; se pot înlocui animația (aceeași cutie) și parametrii,
    // se poate ascunde stratul sau i se poate decala startul (editorul din Studio și corecturile automate)
    const hiddenIds = new Set<string>();
    for (const o of sc.overrides) {
      const target = out.layers.find((l) => l.capability === o.slot || l.id.includes(o.slot));
      if (!target) {
        warnings.push(`Suprascrierea „${o.slot}” din scena ${sc.id} nu găsește niciun strat.`);
        continue;
      }
      if (o.capability) target.capability = o.capability;
      target.params = { ...target.params, ...o.params };
      if (o.shiftSec) {
        target.from = Math.max(0, Math.min(duration - 1, target.from + Math.round(o.shiftSec * fps)));
        target.durationInFrames = Math.max(1, Math.min(target.durationInFrames, duration - target.from));
      }
      if (o.hidden) hiddenIds.add(target.id);
    }
    if (hiddenIds.size) out.layers = out.layers.filter((l) => !hiddenIds.has(l.id));
    // textul: rânduri și mărime calculate cu fonturile reale
    const layoutLayer = (l: TimelineLayer): TimelineLayer => {
      if (TEXT_CAPS.has(l.capability)) {
        const cap = getLayer(l.capability);
        const p = cap.params.parse(l.params) as Record<string, unknown> & {
          text: string;
          font: "display" | "body" | "mono";
          maxSize: number;
          minSize: number;
          lineHeight: number;
          maxLines?: number;
          weight?: number;
          uppercase?: boolean;
          tracking?: number;
        };
        const spec = fontSpecFor({ typography } as never, p);
        const lay = layoutText(p.text, spec, { w: l.box.w, h: l.box.h }, measure, {
          maxSize: p.maxSize,
          minSize: p.minSize,
          lineHeight: p.lineHeight,
          maxLines: p.maxLines,
        });
        if (lay.overflow) warnings.push(`Textul „${p.text.slice(0, 40)}” nu încape în cutie nici la ${p.minSize}px (scena ${sc.id}).`);
        return { ...l, params: { ...l.params, lines: lay.lines, fontSize: lay.fontSize } };
      }
      return { ...l, children: l.children.map(layoutLayer) };
    };
    // date personale: estomparea aprobată de utilizator se pune automat peste zonele lor (în pixelii capturii)
    const blurPii = (l: TimelineLayer): TimelineLayer => {
      const children = l.children.map(blurPii);
      if (l.capability !== "media.screen") return { ...l, children };
      const a = l.assets.map((p) => assetByPublicPath.get(p)).find((x) => x?.pii.blurApproved && x.pii.regions.length);
      if (!a) return { ...l, children };
      const blur = a.pii.regions.map((r, k) => ({
        id: `${l.id}-pii-${k + 1}`,
        capability: "ui.blur-region",
        from: 0,
        durationInFrames: l.durationInFrames,
        z: 900,
        box: { x: r.rect.x - 6, y: r.rect.y - 4, w: r.rect.w + 12, h: r.rect.h + 8 },
        params: { amount: 18 },
        depth: 1,
        role: "support" as const,
        modifiers: [],
        assets: [],
        children: [],
      }));
      return { ...l, children: [...children, ...blur] };
    };
    const layers = groupText(
      out.layers
        .map(layoutLayer)
        .map(blurPii)
        .map((l) => parseLayer(l, sc.id)),
      spaceUnit({ W, H, shape: brand.shape }),
    );
    // camera
    // o cameră aleasă explicit (editor, corectură automată) păstrează reglajele rețetei când e aceeași mișcare
    // (de ex. zoom-ul limitat ca materialul să nu intre peste titlu); parametrii dați explicit au prioritate
    const camCap = getCamera(sc.camera?.capability ?? out.camera.capability);
    const camParams = camCap.params.parse(
      sc.camera ? { ...(sc.camera.capability === out.camera.capability ? out.camera.params : {}), ...sc.camera.params } : out.camera.params,
    );
    const built = camCap.build(camParams as never, {
      duration,
      width: W,
      height: H,
      focus: out.focus ? { x: out.focus.x, y: out.focus.y } : null,
      focusZoom: out.focus?.zoom ?? 1.5,
      energy: sc.energy,
      target: out.focus?.target,
    });
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
    innerInfo.set(sc.id, { focus: out.focus, explicit: !!sc.camera, beats: sceneBeats });
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
    let vAt = from + voiceLeadFrames(fps, tr?.frames ?? 0, sc.energy - prevEnergy) + toF(voiceShiftRef[i]);
    if (i === 0) vAt = Math.max(vAt, Math.round(fps * 0.15));
    for (const l of lines) {
      const v = input.voice[l.id];
      if (!v) continue;
      // dacă replica e deja scrisă pe ecran (același text), subtitrarea ar dubla-o: o omitem
      const onScreenSame = coveredByScreen(l.voiceover, [l.onScreen, sc.text.headline ?? "", sc.text.sub ?? ""]);
      voiceCues.push({ lineId: l.id, at: Math.max(0, vAt), src: v.src, durationSec: v.durationSec, words: onScreenSame ? [] : v.words });
      cues.push({
        id: `vo-${l.id}`,
        kind: "voice",
        atFrame: Math.max(0, vAt),
        sound: v.src,
        gainDb: 0,
        pan: 0,
        sceneId: sc.id,
        reason: `vocea replicii ${l.id}`,
      });
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
          else if (s.at === "each")
            frames = (cap.events?.(l.params as never, l.durationInFrames) ?? []).map((e) => ({ at: at0 + e.at, gainDb: e.gainDb, sound: e.sound }));
          else {
            const v = l.params[s.at.slice("param:".length)];
            if (typeof v === "number") frames = [{ at: at0 + v }];
          }
          for (const f of frames)
            if (f.at < from + duration && f.at >= 0)
              cues.push({
                id: `sfx-${l.id}-${f.at}-${s.sound}`,
                kind: "sfx",
                atFrame: f.at,
                sound: f.sound ?? s.sound,
                gainDb: (s.gainDb ?? 0) + (f.gainDb ?? 0),
                pan: 0,
                sceneId: sc.id,
                layerId: l.id,
                reason: `${l.capability}${s.at === "each" ? " (fiecare element)" : ""}`,
              });
        }
        for (const c of l.children) collect(c, base + l.from);
      };
      for (const l of layers) collect(l, from);
      for (const c of out.cues ?? [])
        cues.push({
          id: `rc-${sc.id}-${c.at}-${c.sound}`,
          kind: "sfx",
          atFrame: from + c.at,
          sound: c.sound,
          gainDb: c.gainDb ?? 0,
          pan: 0,
          sceneId: sc.id,
          reason: c.reason,
        });
      if (tr)
        for (const s of getTransition(tr.capability).sfx)
          cues.push({
            id: `tr-${sc.id}-${s.sound}`,
            kind: "sfx",
            atFrame: Math.max(
              0,
              from +
                (s.at === "end" ? tr.frames : 0) +
                (s.offsetFrames ?? 0) -
                (s.sound.startsWith("whoosh") || s.sound === "swipe" ? Math.round(fps * 0.12) : 0),
            ),
            sound: s.sound,
            gainDb: s.gainDb ?? 0,
            pan: 0,
            sceneId: sc.id,
            reason: `tranziția ${tr.capability}`,
          });
    }
    reports.push({
      id: sc.id,
      recipe: sc.recipe.id,
      durationSec: duration / fps,
      minSec: plan.d.minSec,
      reasons: plan.d.reasons,
      transition: tr?.capability ?? null,
      notes: [...sceneNotes, ...(out.notes ?? [])],
    });
  });

  // 5. densitatea efectelor sonore (brief): filtrare deterministă și fără aglomerare
  const density = brief.audio.sfxDensity;
  let sfx = cues.filter((c) => c.kind === "sfx");
  if (density === "none") sfx = [];
  else {
    const keepEvery =
      density === "low" ? ["impact", "impact-small", "bass-hit", "whoosh", "whoosh-fast", "whoosh-long", "swipe", "shimmer", "click", "pop"] : null;
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

  // 5a. odihna vizuală: dacă toate scenele corpului reclamei mișcă camera, cea mai calmă scenă fără demonstrație
  // (nu hook-ul, nu dezvăluirea, nu CTA-ul, nu o funcție: acolo push-ul face interfața lizibilă) primește cameră
  // fixă, ca mișcarea celorlalte să aibă contrast; textul ei se animă în continuare. Camera aleasă explicit rămâne.
  const body = scenes.filter((s) => s.meta.narrativeRole !== "cta");
  const moves = (s: TimelineScene) => s.camera.keys.length > 1 || s.camera.handheld > 0 || s.camera.punches.length > 0;
  if (body.length >= 4 && body.every(moves)) {
    const calm = body.filter(
      (s, i) =>
        i > 0 &&
        !["hook", "reveal", "feature", "demo", "solution"].includes(s.meta.narrativeRole) &&
        !innerInfo.get(s.id)?.explicit &&
        !innerInfo.get(s.id)?.focus,
    );
    const rest = calm.reduce<TimelineScene | null>((b, s) => (!b || s.meta.energy < b.meta.energy ? s : b), null);
    if (rest) {
      const still = getCamera("camera.static");
      const keys = still.build(still.params.parse({}) as never, {
        duration: rest.durationInFrames,
        width: W,
        height: H,
        focus: null,
        focusZoom: 1,
        energy: rest.meta.energy,
      }).keys;
      rest.camera = { ...rest.camera, keys, handheld: 0, shake: [], punches: [] };
    }
  }

  // 5b. varietate: o scenă cu aceeași rețetă și aceeași mișcare de cameră ca precedenta își inversează mișcarea
  // (pull-out în loc de push): același zoom maxim, deci aceeași geometrie față de titlu; camera aleasă explicit rămâne
  scenes.forEach((sc, i) => {
    const prev = scenes[i - 1];
    if (!prev || innerInfo.get(sc.id)?.explicit || sc.meta.narrativeRole === "cta" || sc.meta.recipe !== prev.meta.recipe) return;
    sc.camera = { ...sc.camera, keys: varyCamera(sc.camera.keys, prev.camera.keys, sc.durationInFrames) };
  });

  // 5c. tăieturi directe în interiorul scenelor mai lungi decât planul tipic al platformei (punch-in, pe cuvânt)
  const maxShotSec = platformProfile(format.platform, project).avgShotSec[1];
  // banda implicită a subtitrărilor (aceeași ca la pasul 6), cu marginea folosită la ocolirea zonelor
  const capBand = (() => {
    if (!brief.captions.burnIn || !voiceCues.length) return undefined;
    const h = orientation === "portrait" ? H * 0.075 : H * 0.11;
    const pad = Math.round(h * 0.15);
    return { x: safe.rect.x, y: safe.rect.y + safe.rect.h - h - pad, w: safe.rect.w, h: h + 2 * pad };
  })();
  scenes.forEach((sc, i) => {
    const info = innerInfo.get(sc.id);
    if (!info) return;
    const wordStarts = voiceCues
      .flatMap((v) => (input.voice[v.lineId]?.words ?? []).map((w) => v.at + Math.round(w.startSec * fps) - sc.from))
      .filter((f) => f > 0 && f < sc.durationInFrames);
    const hero = sc.layers.find((l) => l.capability === "media.screen" && l.role === "hero");
    const regions = hero?.assets.map((p) => assetByPublicPath.get(p)?.capture?.regions).find((r) => r?.length) ?? [];
    scenes[i] = innerCut({
      scene: sc,
      fps,
      width: W,
      height: H,
      maxShotSec,
      wordStarts,
      beats: info.beats,
      focus: info.focus,
      regions,
      explicitCamera: info.explicit,
      pacing,
      avoid: capBand,
    });
  });

  // 6. subtitrări din cuvintele vocii
  let captions: Timeline["captions"] = null;
  if (brief.captions.burnIn && voiceCues.length) {
    const words = voiceCues.flatMap((v) =>
      v.words.map((w) => ({
        text: w.text,
        from: v.at + Math.round(w.startSec * fps),
        to: v.at + Math.max(Math.round(w.startSec * fps) + 2, Math.round(w.endSec * fps)),
      })),
    );
    const s = safe.rect;
    const h = orientation === "portrait" ? H * 0.075 : H * 0.11;
    const box = { x: s.x, y: s.y + s.h - h, w: s.w, h };
    const segments = captionSegments(scenes, box, safe.rect, { width: W, height: H, fps });
    captions = {
      words,
      box,
      segments,
      params: {
        maxWords: orientation === "portrait" ? 3 : 5,
        style: "highlight",
        color: "#ffffff",
        activeColor: captionActiveColor(palette),
        size: Math.round(orientation === "portrait" ? W * 0.055 : H * 0.05),
        uppercase: false,
        backdrop: true,
      },
    };
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
  scenes.forEach((s) => {
    s.layers.forEach(visit);
  });
  const concept = assets.assets.some(
    (a) => usedAssetIds.has(a.id) && a.rights.thirdParty && a.rights.status !== "confirmed-by-user" && a.rights.status !== "owned",
  );
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
      ...scenes
        .filter((s) => s.meta.narrativeRole === "cta")
        .map((s) => ({ frame: s.from + Math.max(0, s.durationInFrames - Math.round(2.5 * fps)), label: "hold CTA", kind: "cta-hold" })),
    ],
    concept,
  });
  return { timeline, scenes: reports, warnings };
}

/**
 * Replica rostită e deja pe ecran dacă cel puțin 70% din cuvintele ei apar în textul scenei: subtitrarea ar
 * dubla mesajul (același lucru de două ori pe ecran).
 */
export function coveredByScreen(voice: string, screen: string[]): boolean {
  const norm = (x: string) =>
    x
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\p{L}\p{N} ]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1 || /\d/.test(w));
  const v = norm(voice);
  if (!v.length) return false;
  const pool = new Set(norm(screen.join(" ")));
  return v.filter((w) => pool.has(w)).length / v.length >= 0.7;
}

/**
 * Pozițiile benzii de subtitrări pe scene. Banda nu are voie să acopere elementul demonstrat (zona țintită
 * de spotlight / callout / tastare / clic, dusă pe ecran prin decupaj, scroll și cameră). Unde poziția
 * implicită l-ar acoperi la momentul de hold, banda se mută pe cea mai apropiată poziție din zona sigură care
 * nu acoperă nici elementul, nici textul fix. Fără element demonstrat, banda peste interfață e acceptată (are
 * fundal). Scenele consecutive cu aceeași poziție se comasează; fără nicio mutare, lista e goală.
 */
export function captionSegments(
  scenes: TimelineScene[],
  base: Rect,
  safeRect: Rect,
  t: { width: number; height: number; fps: number },
): Array<{ from: number; to: number; box: Rect }> {
  const out: Array<{ from: number; to: number; box: Rect }> = [];
  let moved = false;
  const pad = (r: Rect, p: number): Rect => ({ x: r.x - p, y: r.y - p, w: r.w + 2 * p, h: r.h + 2 * p });
  scenes.forEach((s, i) => {
    const local = holdFrame({ scenes }, i);
    const focus = focusRects(t, s, local).map((r) => pad(r, Math.round(base.h * 0.15)));
    const texts = s.layers.filter((l) => l.depth === 0 && LAYOUT_TEXT_CAPS.has(l.capability)).map((l) => l.box);
    const hitsFocus = (b: Rect) => focus.some((r) => overlapArea(b, r) > 0);
    const clashes = (b: Rect) => texts.some((r) => overlapArea(b, r) > 0);
    let box = base;
    if (hitsFocus(base)) {
      // poziții candidate, de la cea mai apropiată de cea implicită: în sus și în jos, cu pas de jumătate de bandă
      const step = Math.max(8, Math.round(base.h / 2));
      const ys: number[] = [];
      for (let d = step; d <= safeRect.h; d += step) ys.push(base.y - d, base.y + d);
      const pick = ys
        .map((y) => ({ ...base, y }))
        .filter((b) => b.y >= safeRect.y && b.y + b.h <= safeRect.y + safeRect.h)
        .find((b) => !hitsFocus(b) && !clashes(b));
      if (pick) {
        box = pick;
        moved = true;
      }
    }
    const from = s.from;
    const to = i + 1 < scenes.length ? scenes[i + 1].from : s.from + s.durationInFrames;
    const prev = out[out.length - 1];
    if (prev && prev.box.y === box.y && prev.box.x === box.x) prev.to = to;
    else out.push({ from, to, box });
  });
  return moved ? out : [];
}

/**
 * Proximitatea textului: subtitlul de sub titlu stă la exact o unitate de spațiere a brandului sub ultimul rând
 * al titlului (măsurat cu fontul real), nu la marginea cutiei lui. Titlul e centrat vertical în cutie, deci fără
 * regula asta distanța vizibilă varia cu numărul de rânduri. Subtitlul rămâne în zona lui inițială (sau urcă
 * spre titlu), deci nu ajunge niciodată peste material.
 */
export function groupText(layers: TimelineLayer[], unit: number): TimelineLayer[] {
  const textOf = (l: TimelineLayer) => {
    const p = l.params as { lines?: string[]; fontSize?: number; lineHeight?: number; vAlign?: string };
    if (!p.lines?.length || !p.fontSize) return null;
    return { h: p.lines.length * p.fontSize * (p.lineHeight ?? 1.04), vAlign: p.vAlign ?? "middle" };
  };
  const hero = layers.find((l) => l.depth === 0 && l.role === "hero" && TEXT_CAPS.has(l.capability));
  const ht = hero && textOf(hero);
  if (!hero || !ht) return layers;
  const top = ht.vAlign === "top" ? hero.box.y : ht.vAlign === "bottom" ? hero.box.y + hero.box.h - ht.h : hero.box.y + (hero.box.h - ht.h) / 2;
  const bottom = top + ht.h;
  return layers.map((l) => {
    if (l === hero || l.depth !== 0 || l.capability !== "text.body" || l.role !== "support") return l;
    const overlapX = Math.min(l.box.x + l.box.w, hero.box.x + hero.box.w) - Math.max(l.box.x, hero.box.x);
    const st = textOf(l);
    if (!st || l.box.y < hero.box.y + hero.box.h - 1 || overlapX < Math.min(l.box.w, hero.box.w) * 0.5) return l;
    // primul rând al subtitlului la o unitate sub titlu; textul rămâne în zona lui (nu coboară spre material)
    const y = Math.round(bottom + unit);
    const end = l.box.y + l.box.h;
    if (y + st.h > end) return l;
    // între titlu și subtitlu nu stă nimic altceva (de ex. butonul de pe CTA, sub care stă adresa): altfel rămâne pe loc
    const top = Math.min(y, l.box.y);
    const blocked = layers.some(
      (o) =>
        o !== hero &&
        o !== l &&
        o.role !== "background" &&
        o.role !== "overlay" &&
        Math.min(o.box.x + o.box.w, l.box.x + l.box.w) > Math.max(o.box.x, l.box.x) &&
        o.box.y < Math.max(y + st.h, l.box.y) &&
        o.box.y + o.box.h > top,
    );
    if (blocked) return l;
    return { ...l, box: { ...l.box, y, h: end - y }, params: { ...l.params, vAlign: "top" } };
  });
}

export { getCapability };
