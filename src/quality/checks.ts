/**
 * Verificările buclei de calitate adaptive, grupate pe cele 10 pase (0 plan … 9 final QA).
 * Fiecare verificare își declară metoda și costul; planificatorul (run.ts) rulează doar ce permite
 * adâncimea cerută, cu metoda cea mai ieftină care e suficient de sigură, și refolosește rezultatele
 * scumpe din cache când intrările lor nu s-au schimbat.
 *
 *   metodă        cost  ce înseamnă
 *   schema        0     validare de structură (zod) – deja la citire
 *   static        1     reguli pe date (script, afirmații, brief, recompilare de control)
 *   timeline      1     analiză pe timeline-ul compilat (geometrie, timp, straturi)
 *   asset         1     metadatele materialelor (rezoluție, drepturi, date personale)
 *   audio         2     raportul mixului și beat grid-ul
 *   stills        3     cadre-cheie randate și analizate pe pixeli (doar scenele schimbate)
 *   scene-render  4     secvență de cadre dintr-o scenă (mișcare reală)
 *   full-render   6     video-ul întreg (doar la predare / final QA, sau refolosit dacă e la zi)
 */
import { isClaimUsable, type AssetManifest, type Brand, type Brief, type FormatSpec, type MixReport, type Project, type QualityCategory, type Research, type Script, type Storyboard, type Timeline, type TimelineLayer } from "../core/schema";
import { autoCritique, videoIssues } from "../critique/auto";
import type { DirectionProfile } from "../creative/directions";
import { validateScript } from "../creative/script";
import { READABLE_TEXT_CAPS, SCREEN_CAPS } from "../motion/text-caps";
import type { PlatformProfile } from "../platform/profiles";
import type { VideoCheck } from "../renderer/node/analyze-video";
import type { ValidationResult } from "../timeline/validate";
import type { IssueDraft } from "./issues";
import { loadConcepts } from "../creative/concepts";
import { claimGraph } from "../research/graph";
import { area, focusRects, holdFrame, overlapArea, screenRect } from "../timeline/geometry";
import { boxAt, captionBoxes } from "../timeline/validate";
import type { PixelMetrics } from "../critique/pixel";

export type Depth = "fast" | "standard" | "deep" | "final";
export const DEPTH_MAX_COST: Record<Depth, number> = { fast: 2, standard: 3, deep: 4, final: 6 };
export const DEPTHS: Depth[] = ["fast", "standard", "deep", "final"];

export type Method = "schema" | "static" | "timeline" | "asset" | "audio" | "stills" | "scene-render" | "full-render";
export const METHOD_COST: Record<Method, number> = { schema: 0, static: 1, timeline: 1, asset: 1, audio: 2, stills: 3, "scene-render": 4, "full-render": 6 };

export type PassId = "plan" | "story" | "visual" | "motion" | "ui" | "typography" | "audio" | "brand" | "platform" | "final";
export const PASSES: Array<{ id: PassId; n: number; title: string }> = [
  { id: "plan", n: 0, title: "Plan: brief, afirmații, drepturi, validare" },
  { id: "story", n: 1, title: "Poveste: structură, hook, arc de energie, ritm" },
  { id: "visual", n: 2, title: "Vizual: contrast real, compoziție, aglomerare" },
  { id: "motion", n: 3, title: "Mișcare: gramatică, repetiții, mișcare reală" },
  { id: "ui", n: 4, title: "Interfață: footage real, lizibilitate, rezoluție" },
  { id: "typography", n: 5, title: "Tipografie: lizibilitate, consecvență" },
  { id: "audio", n: 6, title: "Audio: mix, ritm, voce" },
  { id: "brand", n: 7, title: "Brand: consecvență, logo, culori, date la zi" },
  { id: "platform", n: 8, title: "Platformă: durată, hook, subtitrări, densitate" },
  { id: "final", n: 9, title: "Final QA: determinism, fișiere, video randat, porți de export" },
];

export interface StillResult {
  sceneId: string;
  frame: number;
  local: number;
  file: string;
  cached: boolean;
  metrics: PixelMetrics;
  issues: IssueDraft[];
}

export interface MotionResult {
  sceneId: string;
  cached: boolean;
  /** diferența medie între cadre consecutive eșantionate (0..1) */
  curve: number[];
  stepFrames: number;
}

export interface CheckServices {
  stills(formatId: string): Promise<StillResult[]>;
  sceneMotion(formatId: string): Promise<MotionResult[]>;
  fullVideo(formatId: string): Promise<VideoCheck | null>;
  recompile(formatId: string): Timeline | null;
}

export interface CheckContext {
  project: Project;
  versionId: string;
  brief: Brief;
  brand: Brand | null;
  research: Research;
  assets: AssetManifest;
  script: Script;
  storyboard: Storyboard;
  formats: FormatSpec[];
  primary: FormatSpec;
  timelines: Record<string, Timeline>;
  validation: Record<string, ValidationResult>;
  mix: MixReport | null;
  dir: DirectionProfile;
  profiles: Record<string, PlatformProfile>;
  /** amprentele intrărilor de proiect: acum și la compilarea versiunii */
  inputsNow: Record<string, string>;
  inputsAtCompile: Record<string, string>;
  /** rundă (pentru id-uri) */
  round: number;
  rubric: { minScene: number | null; overall: Record<string, number> | null; sceneScores: ReturnType<typeof autoCritique>["sceneScores"] };
  services: CheckServices;
}

export interface CheckDef {
  id: string;
  version: number;
  pass: PassId;
  title: string;
  /** categoriile de calitate pe care verificarea le evaluează efectiv */
  categories: QualityCategory[];
  method: Method;
  /** true = rulează pe fiecare format; false = o dată, pe formatul principal */
  perFormat: boolean;
  run(ctx: CheckContext, formatId: string): Promise<IssueDraft[]> | IssueDraft[];
}

const flat = (ls: TimelineLayer[]): TimelineLayer[] => ls.flatMap((l) => [l, ...flat(l.children)]);
const sec = (t: Timeline, f: number) => f / t.fps;

/** Interpolarea liniară a zoom-ului camerei la un cadru local (aproximare suficientă pentru lizibilitate). */
function zoomAt(keys: Timeline["scenes"][number]["camera"]["keys"], local: number): number {
  if (!keys.length) return 1;
  if (local <= keys[0].at) return keys[0].zoom;
  for (let i = 1; i < keys.length; i++) {
    if (local <= keys[i].at) {
      const a = keys[i - 1];
      const b = keys[i];
      const p = (local - a.at) / Math.max(1, b.at - a.at);
      return a.zoom + (b.zoom - a.zoom) * p;
    }
  }
  return keys[keys.length - 1].zoom;
}

export const CHECKS: CheckDef[] = [
  // ─── PASS 0: plan
  {
    id: "timeline.validate",
    version: 1,
    pass: "plan",
    title: "Validatorul timeline-ului (reguli dure: footage real, drepturi, cifre, zone, 360 px, flash, goluri)",
    categories: ["claims", "technical", "platform", "typography", "ui"],
    method: "timeline",
    perFormat: true,
    run: (ctx, fid) => ctx.validation[fid].findings.map((f) => ({ ...f, formatId: fid })),
  },
  {
    id: "claims.script",
    version: 1,
    pass: "plan",
    title: "Scriptul: fraze obligatorii exacte, afirmații verificate, cifre cu sursă, interdicții",
    categories: ["claims", "story"],
    method: "static",
    perFormat: false,
    run: (ctx) =>
      validateScript(ctx.script, ctx.brief, ctx.research).map((i) => ({
        frame: null,
        sceneId: ctx.storyboard.scenes.find((s) => i.lineId && s.lineIds.includes(i.lineId))?.id ?? null,
        dimension: /afirma|cifr/i.test(i.message) ? "claims" : /CTA|hook/i.test(i.message) ? "story" : "claims",
        severity: i.severity,
        problem: i.message,
        recommendation: "Corectează scriptul (Claude în Claude Code sau Studio → Script); textul utilizatorului rămâne cuvânt cu cuvânt.",
        method: "static",
      })),
  },
  {
    id: "claims.confidence",
    version: 1,
    pass: "plan",
    title: "Afirmațiile folosite: încredere și stare",
    categories: ["claims"],
    method: "static",
    perFormat: false,
    run: (ctx) => {
      const out: IssueDraft[] = [];
      // graful de afirmații: încrederea după coroborare, conflictele între surse, afirmațiile despre concurenți
      const graph = new Map(claimGraph(ctx.research).nodes.map((n) => [n.claim.id, n]));
      for (const l of ctx.script.lines) {
        const sceneId = ctx.storyboard.scenes.find((s) => s.lineIds.includes(l.id))?.id ?? null;
        for (const id of l.claimIds) {
          const n = graph.get(id);
          if (!n) continue;
          if (n.conflictsWith.length && n.claim.status !== "approved-by-user") out.push({ frame: null, sceneId, dimension: "claims", severity: "critical", problem: `Replica „${l.id}” folosește o afirmație în conflict cu alte surse (${id} ≠ ${n.conflictsWith.join(", ")}).`, recommendation: "Utilizatorul confirmă valoarea corectă (mms claim … approved) sau scoate replica.", method: "static" });
          else if (n.aboutCompetitor && n.claim.status !== "approved-by-user") out.push({ frame: null, sceneId, dimension: "claims", severity: "critical", problem: `Replica „${l.id}” folosește o afirmație luată de pe pagina unui concurent (${id}).`, recommendation: "Afirmațiile despre concurenți nu intră în video fără aprobarea utilizatorului.", method: "static" });
          else if (isClaimUsable(n.claim) && n.confidence === "low" && n.claim.status !== "approved-by-user") out.push({ frame: null, sceneId, dimension: "claims", severity: "medium", problem: `Replica „${l.id}” se sprijină pe o afirmație cu încredere mică (${id}).`, recommendation: "Cere confirmarea utilizatorului sau o sursă mai bună.", method: "static", confidence: 0.9 });
        }
      }
      return out;
    },
  },
  // ─── PASS 1: poveste
  {
    id: "critique.rubric",
    version: 1,
    pass: "story",
    title: "Rubrica fixă rubric-v1 (hook, claritate, ritm, ierarhie, varietate, brand, CTA) pe fiecare scenă",
    categories: ["story", "typography", "motion"],
    method: "timeline",
    perFormat: false,
    run: async (ctx, fid) => {
      // validarea intră în scorul rubricii (claritate), dar problemele ei sunt raportate de timeline.validate
      const r = autoCritique({ timeline: ctx.timelines[fid], brief: ctx.brief, dir: ctx.dir, validation: ctx.validation[fid], mix: ctx.mix, video: null }, ctx.round, ctx.versionId);
      ctx.rubric.minScene = r.minScene;
      ctx.rubric.overall = r.overall;
      ctx.rubric.sceneScores = r.sceneScores;
      return r.findings.filter((f) => !f.id.includes("-v-") && f.dimension !== "audio").map((f) => ({ ...f, formatId: null }));
    },
  },
  {
    id: "story.structure",
    version: 1,
    pass: "story",
    title: "Structura narativă: hook la început, recompensă înainte de CTA, problemă înaintea soluției",
    categories: ["story", "creative"],
    method: "timeline",
    perFormat: false,
    run: (ctx, fid) => {
      const t = ctx.timelines[fid];
      const roles = t.scenes.map((s) => s.meta.narrativeRole);
      const out: IssueDraft[] = [];
      const payoff = ["reveal", "solution", "feature", "demo", "proof", "benefit", "transformation"];
      if (roles[0] !== "hook") out.push({ frame: 0, sceneId: t.scenes[0].id, dimension: "story", severity: "high", problem: `Prima scenă are rolul „${roles[0]}”, nu hook.`, recommendation: "Deschide cu hook-ul (curiozitate, contrast sau problemă), în prima secundă." });
      if (!roles.some((r) => payoff.includes(r))) out.push({ frame: null, sceneId: null, dimension: "story", severity: "high", problem: "Reclama nu are o scenă de recompensă (produsul, dovada, beneficiul).", recommendation: "Adaugă o scenă de demonstrație sau de dovadă între hook și CTA." });
      const firstProblem = roles.indexOf("problem");
      const firstSolution = roles.findIndex((r) => r === "reveal" || r === "solution");
      if (firstProblem >= 0 && firstSolution >= 0 && firstProblem > firstSolution) out.push({ frame: t.scenes[firstProblem].from, sceneId: t.scenes[firstProblem].id, dimension: "story", severity: "medium", problem: "Problema apare după soluție.", recommendation: "Ordinea clasică: problemă → tensiune → soluție.", suggestedFix: [{ op: "scene-move", sceneId: t.scenes[firstProblem].id, to: firstSolution }], confidence: 0.7 });
      const ctaIdx = roles.lastIndexOf("cta");
      if (ctaIdx > 0 && !payoff.includes(roles[ctaIdx - 1]) && roles[ctaIdx - 1] !== "outro") out.push({ frame: t.scenes[ctaIdx].from, sceneId: t.scenes[ctaIdx].id, dimension: "story", severity: "low", problem: `CTA-ul vine după „${roles[ctaIdx - 1]}”, nu după o recompensă.`, recommendation: "Pune dovada sau beneficiul chiar înaintea CTA-ului.", confidence: 0.6 });
      return out;
    },
  },
  {
    id: "story.energy-arc",
    version: 1,
    pass: "story",
    title: "Arcul de energie: escaladare, punct culminant, recompensă",
    categories: ["story", "creative"],
    method: "timeline",
    perFormat: false,
    run: (ctx, fid) => {
      const t = ctx.timelines[fid];
      const out: IssueDraft[] = [];
      const body = t.scenes.filter((s) => s.meta.narrativeRole !== "cta" && s.meta.narrativeRole !== "hook");
      if (body.length >= 3) {
        const e = body.map((s) => s.meta.energy);
        const mean = e.reduce((a, b) => a + b, 0) / e.length;
        const std = Math.sqrt(e.reduce((a, b) => a + (b - mean) ** 2, 0) / e.length);
        if (std < 0.06) out.push({ frame: body[0].from, sceneId: null, dimension: "story", severity: "medium", problem: `Energia e plată în corpul reclamei (abatere ${std.toFixed(2)}): nu există escaladare.`, recommendation: "Construiește spre un punct culminant: crește energia la dezvăluire sau la dovadă.", confidence: 0.75 });
        const peak = t.scenes.reduce((a, b) => (b.meta.energy > a.meta.energy && b.meta.narrativeRole !== "hook" ? b : a), body[0]);
        const pos = (peak.from + peak.durationInFrames / 2) / t.durationInFrames;
        if (pos < 0.3) out.push({ frame: peak.from, sceneId: peak.id, dimension: "story", severity: "low", problem: `Punctul culminant e prea devreme (${Math.round(pos * 100)}% din durată).`, recommendation: "Mută momentul cu cea mai mare energie spre 50–80% din reclamă.", confidence: 0.6 });
      }
      return out;
    },
  },
  {
    id: "story.brand-reveal",
    version: 1,
    pass: "story",
    title: "Momentul în care apare brandul (logo sau numele produsului)",
    categories: ["story", "brand"],
    method: "timeline",
    perFormat: false,
    run: (ctx, fid) => {
      const t = ctx.timelines[fid];
      const name = ctx.project.product.name.toLowerCase();
      let first: number | null = null;
      for (const s of t.scenes) {
        for (const l of flat(s.layers)) {
          const hit = l.capability.startsWith("logo.") || (READABLE_TEXT_CAPS.has(l.capability) && String(l.params.text ?? "").toLowerCase().includes(name));
          if (hit) first = first === null ? s.from + l.from : Math.min(first, s.from + l.from);
        }
      }
      const prof = ctx.profiles[fid];
      const limit = prof.brandBySec ?? (t.durationInFrames / t.fps) * 0.6;
      if (first === null) return [{ frame: null, sceneId: null, dimension: "brand", severity: "high", problem: "Brandul (logo sau numele produsului) nu apare nicăieri pe ecran.", recommendation: "Arată logo-ul sau numele la dezvăluire și pe cardul final.", confidence: 0.85 }];
      if (sec(t, first) > limit) return [{ frame: first, sceneId: null, dimension: "brand", severity: "medium", problem: `Brandul apare abia la ${sec(t, first).toFixed(1)} s (ținta pentru ${prof.label}: ${limit.toFixed(1)} s).`, recommendation: "Arată numele sau logo-ul mai devreme (de ex. pe dezvăluire), fără să strici hook-ul.", confidence: 0.6 }];
      return [];
    },
  },
  {
    id: "story.pacing",
    version: 1,
    pass: "story",
    title: "Ritmul: durata medie a scenelor față de platformă și direcție",
    categories: ["story", "motion"],
    method: "timeline",
    perFormat: true,
    run: (ctx, fid) => {
      const t = ctx.timelines[fid];
      const prof = ctx.profiles[fid];
      const avg = t.durationInFrames / t.fps / t.scenes.length;
      const [lo, hi] = prof.avgShotSec;
      if (avg > hi * 1.15) return [{ frame: null, sceneId: null, formatId: fid, dimension: "pacing", severity: "medium", problem: `Ritm lent pentru ${prof.label}: ${avg.toFixed(1)} s pe scenă în medie (recomandat ${lo}–${hi} s).`, recommendation: "Împarte scenele lungi sau taie din hold-uri (vocea dictează minimul).", confidence: 0.6 }];
      if (avg < lo * 0.85) return [{ frame: null, sceneId: null, formatId: fid, dimension: "pacing", severity: "medium", problem: `Ritm foarte rapid: ${avg.toFixed(1)} s pe scenă (recomandat ${lo}–${hi} s).`, recommendation: "Lasă mesajele să respire: comasează scenele sau prelungește-le.", confidence: 0.6 }];
      return [];
    },
  },
  {
    id: "creative.concept",
    version: 1,
    pass: "story",
    title: "Conceptul creativ: ales, susținut de dovezi, respectat de storyboard",
    categories: ["creative"],
    method: "static",
    perFormat: false,
    run: (ctx) => {
      const concepts = loadConcepts(ctx.project.id);
      const out: IssueDraft[] = [];
      const c = concepts?.concepts.find((x) => x.id === concepts.selectedId);
      if (!c) return [{ frame: null, sceneId: null, dimension: "creative", severity: "medium", problem: "Reclama nu are un concept creativ ales (concepts.json).", recommendation: "Generează și alege conceptul: npm run mms -- concepts <proiect>.", method: "static", confidence: 0.9 }];
      if (c.total < 60) out.push({ frame: null, sceneId: null, dimension: "creative", severity: "medium", problem: `Conceptul ales („${c.title}”) are doar ${c.total}/100.`, recommendation: "Claude propune un concept mai puternic (origin „ai”) sau utilizatorul își rafinează ideea.", method: "static", confidence: 0.6 });
      for (const r of c.risks) out.push({ frame: null, sceneId: null, dimension: "creative", severity: "low", problem: `Risc al conceptului „${c.title}”: ${r}.`, recommendation: "Adaugă materialul lipsă sau alege alt concept.", method: "static", confidence: 0.7 });
      if (ctx.storyboard.templateId && ctx.storyboard.templateId !== c.templateId) out.push({ frame: null, sceneId: null, dimension: "creative", severity: "low", problem: `Storyboard-ul folosește structura „${ctx.storyboard.templateId}”, conceptul ales cere „${c.templateId}”.`, recommendation: "Regenerează storyboard-ul din concept sau alege conceptul care corespunde.", method: "static", confidence: 0.6 });
      return out;
    },
  },
  // ─── PASS 2: vizual (pe pixeli)
  {
    id: "visual.pixels",
    version: 1,
    pass: "visual",
    title: "Cadre-cheie randate: contrast real al textului, compoziție, spațiu gol, aglomerare",
    categories: ["visual", "typography"],
    method: "stills",
    perFormat: true,
    run: async (ctx, fid) => (await ctx.services.stills(fid)).flatMap((r) => r.issues),
  },
  // ─── PASS 3: mișcare
  {
    id: "motion.grammar",
    version: 1,
    pass: "motion",
    title: "Gramatica mișcării: odihnă vizuală, varietate de animații, tranziții",
    categories: ["motion"],
    method: "timeline",
    perFormat: false,
    run: (ctx, fid) => {
      const t = ctx.timelines[fid];
      const out: IssueDraft[] = [];
      const body = t.scenes.filter((s) => s.meta.narrativeRole !== "cta");
      const moving = body.filter((s) => s.camera.keys.length > 1 || s.camera.handheld > 0 || s.camera.punches.length > 0);
      if (body.length >= 4 && moving.length === body.length) out.push({ frame: null, sceneId: null, dimension: "motion", severity: "low", problem: "Camera se mișcă în toate scenele: nu există niciun moment de odihnă vizuală.", recommendation: "Lasă o scenă (de obicei dovada sau un detaliu) cu cameră fixă, ca mișcarea să aibă contrast.", suggestedFix: [{ op: "set-camera", sceneId: body[Math.floor(body.length / 2)].id, capability: "camera.static", params: {} }], confidence: 0.6 });
      if (body.length >= 4 && moving.length === 0) out.push({ frame: null, sceneId: null, dimension: "motion", severity: "medium", problem: "Nicio scenă nu are mișcare de cameră: reclama pare statică.", recommendation: "Adaugă push-in pe dezvăluire și pe funcții.", confidence: 0.7 });
      const textCaps = t.scenes.map((s) => s.layers.find((l) => READABLE_TEXT_CAPS.has(l.capability) && l.role === "hero")?.capability).filter((x): x is string => !!x);
      const counts = new Map<string, number>();
      for (const c of textCaps) counts.set(c, (counts.get(c) ?? 0) + 1);
      for (const [c, n] of counts) if (n >= 4 && n / Math.max(1, textCaps.length) > 0.7) out.push({ frame: null, sceneId: null, dimension: "motion", severity: "low", problem: `Aceeași animație de text (${c}) în ${n} scene.`, recommendation: "Variază apariția textului după rolul scenei (hook cu impact, dovadă calmă).", confidence: 0.65 });
      const nonCut = t.scenes.slice(1).filter((s) => s.transitionIn && s.transitionIn.capability !== "tr.cut").length;
      if (t.scenes.length > 4 && nonCut === t.scenes.length - 1 && ctx.brief.pacing !== "slow") out.push({ frame: null, sceneId: null, dimension: "motion", severity: "low", problem: "Toate tăieturile au tranziții animate: niciun hard cut.", recommendation: "Folosește tăietura simplă între scene apropiate; păstrează tranzițiile pentru schimbările de idee.", confidence: 0.55 });
      return out;
    },
  },
  {
    id: "motion.scene",
    version: 1,
    pass: "motion",
    title: "Mișcarea reală în scene (secvențe de cadre): scene statice, mișcare excesivă",
    categories: ["motion"],
    method: "scene-render",
    perFormat: false,
    run: async (ctx, fid) => {
      const t = ctx.timelines[fid];
      const out: IssueDraft[] = [];
      for (const m of await ctx.services.sceneMotion(fid)) {
        const s = t.scenes.find((x) => x.id === m.sceneId);
        if (!s || !m.curve.length) continue;
        const stepSec = m.stepFrames / t.fps;
        let run = 0;
        let longest = 0;
        for (const d of m.curve) {
          run = d < 0.0015 ? run + stepSec : 0;
          longest = Math.max(longest, run);
        }
        const isCta = s.meta.narrativeRole === "cta";
        if (!isCta && longest > 2.5) out.push({ frame: s.from, sceneId: s.id, durationSec: longest, dimension: "motion", severity: "medium", method: "scene-render", problem: `Imaginea stă complet nemișcată ${longest.toFixed(1)} s.`, recommendation: "Adaugă o mișcare discretă (push lent, parallax) sau scurtează scena.", suggestedFix: [{ op: "set-camera", sceneId: s.id, capability: "camera.parallax-drift", params: {} }], confidence: 0.75 });
        const mean = m.curve.reduce((a, b) => a + b, 0) / m.curve.length;
        if (mean > 0.09 && s.meta.energy < 0.8) out.push({ frame: s.from, sceneId: s.id, dimension: "motion", severity: "low", method: "scene-render", problem: `Mișcare foarte intensă (${mean.toFixed(3)}) pentru energia scenei (${s.meta.energy}).`, recommendation: "Mișcarea trebuie să servească mesajul: reduce tremurul sau viteza camerei.", confidence: 0.5 });
      }
      return out;
    },
  },
  // ─── PASS 4: interfață
  {
    id: "ui.legibility",
    version: 1,
    pass: "ui",
    title: "Lizibilitatea interfeței reale pe ecran (scara capturii × zoom-ul camerei, la 360 px)",
    categories: ["ui"],
    method: "timeline",
    perFormat: true,
    run: (ctx, fid) => {
      const t = ctx.timelines[fid];
      const out: IssueDraft[] = [];
      for (const s of t.scenes) {
        for (const l of s.layers.filter((x) => x.capability === "media.screen")) {
          const p = l.params as { imageWidth?: number; crop?: { w: number } };
          const asset = ctx.assets.assets.find((a) => l.assets.includes(`projects/${ctx.project.id}/${a.file}`));
          if (!p.imageWidth || !asset) continue;
          const dpr = asset.capture?.deviceScaleFactor ?? 1;
          const visibleW = p.crop?.w ?? p.imageWidth;
          const scale = l.box.w / visibleW;
          const zoom = Math.max(...s.camera.keys.map((k) => k.zoom), 1);
          const focus = l.children.find((c) => /^ui\.(spotlight|highlight|callout|zoom-lens|typing|click|cursor)/.test(c.capability));
          // textul de interfață: din zona țintită (eticheta ~45% din înălțimea unui câmp/buton) sau corpul de text tipic (15 px CSS)
          const capPx = focus && focus.box.h > 0 && focus.box.h < 200 * dpr ? focus.box.h * 0.45 : 15 * dpr;
          const at360 = (capPx * scale * zoom * 360) / Math.min(t.width, t.height);
          const demo = ["feature", "demo", "solution"].includes(s.meta.narrativeRole);
          if (at360 < 5 && demo) out.push({ frame: s.from, sceneId: s.id, layerId: l.id, formatId: fid, dimension: "ui-legibility", severity: at360 < 3.5 ? "high" : "medium", problem: `Interfața din ${s.id} se vede la ~${at360.toFixed(1)} px la testul de 360 px: funcția nu se poate citi.`, recommendation: "Apropie camera pe zona funcției (push pe regiune) sau decupează captura în jurul ei.", suggestedFix: focus && s.camera.keys.length <= 1 ? [{ op: "set-camera", sceneId: s.id, capability: "camera.push", params: {} }] : [], confidence: 0.6 });
          const upscale = (l.box.w * zoom) / (visibleW || 1);
          if (upscale > 1.6) out.push({ frame: s.from, sceneId: s.id, layerId: l.id, formatId: fid, dimension: "assets", category: "ui", severity: "medium", problem: `Captura „${asset.originalName}” e mărită ${upscale.toFixed(1)}× peste rezoluția ei: va arăta neclar.`, recommendation: "Capturează din nou la rezoluție mai mare (deviceScaleFactor 2–3) sau reduce zoom-ul.", confidence: 0.8 });
        }
      }
      return out;
    },
  },
  {
    id: "ui.caption-occlusion",
    version: 2,
    pass: "ui",
    title: "Subtitrările nu acoperă elementul demonstrat (zona țintită, pe ecran, cu decupaj, scroll și cameră)",
    categories: ["ui", "typography"],
    method: "timeline",
    perFormat: true,
    run: (ctx, fid) => {
      const t = ctx.timelines[fid];
      if (!t.captions) return [];
      const segs = captionBoxes(t);
      const out: IssueDraft[] = [];
      t.scenes.forEach((s, i) => {
        const local = holdFrame(t, i);
        const words = t.captions!.words.filter((w) => w.from < s.from + s.durationInFrames && w.to > s.from);
        if (!words.length) return;
        const cap = boxAt(segs, words[0].from);
        const focus = focusRects(t, s, local);
        const hit = focus.map((r) => overlapArea(cap, r) / Math.max(1, area(r))).reduce((m, x) => Math.max(m, x), 0);
        if (hit > 0.1) out.push({ frame: s.from + local, sceneId: s.id, formatId: fid, dimension: "composition", category: "ui", severity: ["feature", "demo", "solution"].includes(s.meta.narrativeRole) ? "high" : "medium", problem: `Subtitrările acoperă ${Math.round(hit * 100)}% din elementul demonstrat în ${s.id}.`, recommendation: "Recompilează (banda se mută automat dacă există loc în zona sigură); altfel mută materialul sau dezactivează subtitrările arse pe această scenă.", confidence: 0.8 });
      });
      return out;
    },
  },
  {
    id: "typography.caption-redundancy",
    version: 1,
    pass: "typography",
    title: "Subtitrările nu repetă textul deja scris pe ecran",
    categories: ["typography"],
    method: "timeline",
    perFormat: false,
    run: (ctx, fid) => {
      const t = ctx.timelines[fid];
      if (!t.captions) return [];
      const out: IssueDraft[] = [];
      const norm = (x: string) => x.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter((w) => w.length > 1 || /\d/.test(w));
      for (const s of t.scenes) {
        const words = t.captions.words.filter((w) => w.from >= s.from && w.from < s.from + s.durationInFrames).map((w) => norm(w.text)).flat();
        if (words.length < 2) continue;
        const screen = new Set(norm(s.layers.filter((l) => READABLE_TEXT_CAPS.has(l.capability)).map((l) => String(l.params.text ?? "")).join(" ")));
        const dup = words.filter((w) => screen.has(w)).length / words.length;
        if (dup >= 0.7) out.push({ frame: s.from, sceneId: s.id, dimension: "clutter", category: "typography", severity: "medium", problem: `Subtitrările din ${s.id} repetă textul de pe ecran (${Math.round(dup * 100)}% din cuvinte).`, recommendation: "Nu arde subtitrarea pentru o replică deja scrisă pe ecran (recompilează: compilatorul o omite).", confidence: 0.8 });
      }
      return out;
    },
  },
  // ─── PASS 5: tipografie
  {
    id: "typography.consistency",
    version: 1,
    pass: "typography",
    title: "Consecvența tipografică: familii, mărimi, densitate",
    categories: ["typography"],
    method: "timeline",
    perFormat: true,
    run: (ctx, fid) => {
      const t = ctx.timelines[fid];
      const out: IssueDraft[] = [];
      const texts = t.scenes.flatMap((s) => flat(s.layers).filter((l) => READABLE_TEXT_CAPS.has(l.capability)));
      const families = new Set(texts.map((l) => String(l.params.font ?? "display")));
      const heroSizes = texts.filter((l) => l.role === "hero" && typeof l.params.fontSize === "number").map((l) => Number(l.params.fontSize));
      if (heroSizes.length >= 3) {
        const max = Math.max(...heroSizes);
        const min = Math.min(...heroSizes);
        if (max / min > 3.2) out.push({ frame: null, sceneId: null, formatId: fid, dimension: "typography", severity: "low", problem: `Titlurile variază de la ${Math.round(min)} la ${Math.round(max)} px (raport ${(max / min).toFixed(1)}).`, recommendation: "Păstrează 2–3 mărimi de titlu pe toată reclama, pentru ierarhie consecventă.", confidence: 0.55 });
      }
      if (families.size > 3) out.push({ frame: null, sceneId: null, formatId: fid, dimension: "typography", severity: "low", problem: `${families.size} roluri de font diferite pe ecran.`, recommendation: "Maximum două familii (titlu + text).", confidence: 0.7 });
      return out;
    },
  },
  // ─── PASS 6: audio
  {
    id: "audio.mix",
    version: 1,
    pass: "audio",
    title: "Raportul mixului: −14 LUFS, true peak, clipping, tăceri; voce acoperită; beat grid sigur",
    categories: ["audio"],
    method: "audio",
    perFormat: false,
    run: (ctx, fid) => {
      const t = ctx.timelines[fid];
      const out: IssueDraft[] = [];
      if (!ctx.mix) return [{ frame: null, sceneId: null, dimension: "audio", severity: "high", problem: "Versiunea nu are încă mix audio.", recommendation: "Rulează pasul audio (mms audio).", method: "audio" }];
      for (const p of ctx.mix.problems) out.push({ frame: null, sceneId: null, dimension: "audio", severity: "high", problem: p, recommendation: "Ajustează muzica/efectele sau marchează tăcerea ca intenționată.", method: "audio" });
      for (const s of ctx.mix.silences.filter((x) => !x.intentional)) out.push({ frame: Math.round(s.startSec * t.fps), sceneId: null, durationSec: s.endSec - s.startSec, dimension: "audio", severity: "medium", problem: `Tăcere neintenționată ${(s.endSec - s.startSec).toFixed(1)} s.`, recommendation: "Muzica sau un efect trebuie să acopere golul (sau marchează scena cu tăcere intenționată).", method: "audio" });
      const bg = t.audio.beatGrid;
      if (bg && bg.source === "detected" && bg.confidence < 0.35) out.push({ frame: null, sceneId: null, dimension: "beat-sync", severity: "low", problem: `Tempo-ul muzicii e detectat cu încredere mică (${bg.confidence.toFixed(2)}): tăieturile nu se aliniază pe bătăi.`, recommendation: "Fixează tempo-ul în brief (audio.music.bpm) dacă îl știi; altfel ascultă și notează pe timestamp.", method: "audio", confidence: 0.9 });
      const voiceFrames = t.audio.cues.filter((c) => c.kind === "voice").length;
      if (ctx.brief.audio.voice.mode !== "none" && voiceFrames === 0) out.push({ frame: null, sceneId: null, dimension: "audio", severity: "high", problem: "Brief-ul cere voce, dar timeline-ul nu are nicio replică de voce.", recommendation: "Verifică vocea (mms voice) și recompilează.", method: "audio" });
      return out;
    },
  },
  // ─── PASS 7: brand
  {
    id: "brand.stale",
    version: 1,
    pass: "brand",
    title: "Timeline-ul e compilat din datele actuale (brief, brand, materiale, research)?",
    categories: ["brand", "technical"],
    method: "static",
    perFormat: false,
    run: (ctx) => {
      const changed = (["brief", "brand", "assets", "research", "references"] as const).filter((k) => ctx.inputsAtCompile[k] && ctx.inputsNow[k] && ctx.inputsAtCompile[k] !== ctx.inputsNow[k]);
      if (!changed.length) return [];
      return [{ frame: null, sceneId: null, dimension: "stale", category: changed.includes("brand") ? "brand" : "technical", severity: "high", problem: `Timeline-ul a fost compilat înainte de schimbări în: ${changed.join(", ")}.`, recommendation: "Recompilează (se creează versiunea următoare).", suggestedFix: [{ op: "recompile" }], method: "static", confidence: 1 }];
    },
  },
  {
    id: "brand.rules",
    version: 1,
    pass: "brand",
    title: "Regulile logo-ului (fără recolorare/rotire) și culorile din brand",
    categories: ["brand"],
    method: "timeline",
    perFormat: true,
    run: (ctx, fid) => {
      const t = ctx.timelines[fid];
      const out: IssueDraft[] = [];
      const rules = ctx.brand?.logo.rules;
      for (const s of t.scenes) {
        for (const l of flat(s.layers).filter((x) => x.capability.startsWith("logo."))) {
          const recolor = l.modifiers.some((m) => m.capability === "mod.color-grade") || typeof l.params.tint === "string";
          const rotate = l.modifiers.some((m) => m.capability === "mod.tilt-3d") || (typeof l.params.rotate === "number" && l.params.rotate !== 0);
          if (recolor && !rules?.allowRecolor) out.push({ frame: s.from + l.from, sceneId: s.id, layerId: l.id, formatId: fid, dimension: "brand-consistency", severity: "high", problem: "Logo-ul e recolorat, deși regulile brandului nu permit.", recommendation: "Scoate filtrul de culoare de pe logo (doar scară uniformă)." });
          if (rotate && !rules?.allowRotate) out.push({ frame: s.from + l.from, sceneId: s.id, layerId: l.id, formatId: fid, dimension: "brand-consistency", severity: "high", problem: "Logo-ul e rotit/înclinat, deși regulile brandului nu permit.", recommendation: "Folosește logo-ul drept, doar cu scară uniformă." });
        }
      }
      if (ctx.brand && (t.palette.primary.toLowerCase() !== ctx.brand.colors.primary.toLowerCase() || t.palette.background.toLowerCase() !== ctx.brand.colors.background.toLowerCase()))
        out.push({ frame: null, sceneId: null, formatId: fid, dimension: "brand-consistency", severity: "high", problem: "Paleta timeline-ului diferă de brand kit.", recommendation: "Recompilează din brand kit-ul actual.", suggestedFix: [{ op: "recompile" }], confidence: 0.95 });
      return out;
    },
  },
  {
    id: "brand.color-presence",
    version: 1,
    pass: "brand",
    title: "Culorile brandului se văd efectiv în cadrele randate",
    categories: ["brand"],
    method: "stills",
    perFormat: false,
    run: async (ctx, fid) => {
      const rs = await ctx.services.stills(fid);
      if (!rs.length) return [];
      const share = rs.reduce((a, r) => a + r.metrics.brandShare, 0) / rs.length;
      if (share < 0.002) return [{ frame: null, sceneId: null, formatId: fid, dimension: "brand-consistency", severity: "low", method: "stills", source: "pixel-check", problem: `Culorile principale ale brandului apar în doar ${(share * 100).toFixed(2)}% din cadre.`, recommendation: "Folosește culoarea primară în accente (text evidențiat, butonul CTA, lumini).", confidence: 0.55 }];
      return [];
    },
  },
  // ─── PASS 8: platformă
  {
    id: "platform.profile",
    version: 1,
    pass: "platform",
    title: "Profilul platformei: durată, format, hook, subtitrări, densitatea textului, hold pe CTA",
    categories: ["platform"],
    method: "timeline",
    perFormat: true,
    run: (ctx, fid) => {
      const t = ctx.timelines[fid];
      const fmt = ctx.formats.find((f) => f.id === fid)!;
      const prof = ctx.profiles[fid];
      const out: IssueDraft[] = [];
      const dur = t.durationInFrames / t.fps;
      if (dur > prof.durationSec.max) out.push({ frame: null, sceneId: null, formatId: fid, dimension: "platform", severity: "high", problem: `Durata ${dur.toFixed(1)} s depășește maximul pentru ${prof.label} (${prof.durationSec.max} s).`, recommendation: "Scurtează scriptul sau livrează o variantă separată." });
      else if (dur > prof.durationSec.idealMax * 1.1 || dur < prof.durationSec.idealMin * 0.9) out.push({ frame: null, sceneId: null, formatId: fid, dimension: "platform", severity: "low", problem: `Durata ${dur.toFixed(1)} s e în afara intervalului recomandat pentru ${prof.label} (${prof.durationSec.idealMin}–${prof.durationSec.idealMax} s).`, recommendation: "Ajustează durata țintă din brief dacă nu e o alegere conștientă.", confidence: 0.5 });
      if (!prof.aspects.includes(fmt.id.replace(/-4k$/, ""))) out.push({ frame: null, sceneId: null, formatId: fid, dimension: "format", severity: "low", problem: `Formatul ${fmt.id} nu e cel recomandat pentru ${prof.label} (${prof.aspects.join(", ")}).`, recommendation: "Adaugă formatul recomandat în proiect.", confidence: 0.6 });
      const firstText = Math.min(...t.scenes.flatMap((s) => s.layers.filter((l) => READABLE_TEXT_CAPS.has(l.capability)).map((l) => s.from + l.from)), Infinity);
      if (Number.isFinite(firstText) && sec(t, firstText) > prof.hookBySec) out.push({ frame: firstText, sceneId: t.scenes[0].id, formatId: fid, dimension: "platform", category: "story", severity: "medium", problem: `Primul mesaj pe ecran apare la ${sec(t, firstText).toFixed(1)} s (ținta pentru ${prof.label}: ${prof.hookBySec} s).`, recommendation: "Mesajul hook-ului din prima secundă.", confidence: 0.85 });
      if (prof.captions === "required" && !t.captions && ctx.brief.audio.voice.mode !== "none") out.push({ frame: null, sceneId: null, formatId: fid, dimension: "platform", severity: "high", problem: `${prof.label} se vede mult fără sunet, iar vocea nu are subtitrări arse.`, recommendation: "Activează subtitrările arse (brief.captions.burnIn)." });
      const words = t.scenes.flatMap((s) => s.layers.filter((l) => READABLE_TEXT_CAPS.has(l.capability))).reduce((n, l) => n + String(l.params.text ?? "").split(/\s+/).filter(Boolean).length, 0);
      if (words / dur > prof.maxWordsPerSec) out.push({ frame: null, sceneId: null, formatId: fid, dimension: "platform", category: "typography", severity: "medium", problem: `Text dens: ${(words / dur).toFixed(1)} cuvinte pe ecran pe secundă (maximum ${prof.maxWordsPerSec} pentru ${prof.label}).`, recommendation: "Mută explicațiile în voce; pe ecran un singur mesaj scurt pe scenă.", confidence: 0.7 });
      const cta = t.scenes.find((s) => s.meta.narrativeRole === "cta");
      if (cta && cta.durationInFrames / t.fps < prof.ctaHoldSec) out.push({ frame: cta.from, sceneId: cta.id, formatId: fid, dimension: "cta", category: "platform", severity: "medium", problem: `Cardul final ține ${(cta.durationInFrames / t.fps).toFixed(1)} s (recomandat ${prof.ctaHoldSec} s pentru ${prof.label}).`, recommendation: "Prelungește cardul final.", suggestedFix: [{ op: "scene-extend", sceneId: cta.id, deltaSec: Math.ceil((prof.ctaHoldSec - cta.durationInFrames / t.fps + 0.1) * 10) / 10, currentSec: cta.durationInFrames / t.fps }], confidence: 0.85 });
      return out;
    },
  },
  // ─── PASS 9: final QA
  {
    id: "technical.recompile",
    version: 1,
    pass: "final",
    title: "Recompilare de control: același timeline octet cu octet (determinism) sau date învechite",
    categories: ["technical"],
    method: "static",
    perFormat: true,
    run: (ctx, fid) => {
      const fresh = ctx.services.recompile(fid);
      if (!fresh) return [];
      const saved = ctx.timelines[fid];
      const norm = (t: Timeline) => JSON.stringify({ ...t, audio: { ...t.audio, src: null } });
      if (norm(fresh) === norm(saved)) return [];
      const inputsChanged = (["brief", "brand", "assets", "research", "references"] as const).some((k) => ctx.inputsAtCompile[k] && ctx.inputsNow[k] !== ctx.inputsAtCompile[k]);
      if (inputsChanged) return []; // raportat deja de brand.stale
      return [{ frame: null, sceneId: null, formatId: fid, dimension: "determinism", severity: "critical", method: "static", problem: "Recompilarea din aceleași date dă alt timeline (determinism încălcat).", recommendation: "Caută aleator nefixat sau timp real în compilator/rețete; nu exporta până nu e reparat." }];
    },
  },
  {
    id: "final.video",
    version: 1,
    pass: "final",
    title: "Video-ul randat: cadre negre, flash-uri, înghețări (refolosit dacă e la zi)",
    categories: ["technical", "motion"],
    method: "full-render",
    perFormat: true,
    run: async (ctx, fid) => {
      const v = await ctx.services.fullVideo(fid);
      if (!v) return [];
      return videoIssues(ctx.timelines[fid], v).map((d) => ({ ...d, formatId: fid }));
    },
  },
];

export function checksForDepth(depth: Depth): { run: CheckDef[]; skipped: CheckDef[] } {
  const max = DEPTH_MAX_COST[depth];
  return { run: CHECKS.filter((c) => METHOD_COST[c.method] <= max), skipped: CHECKS.filter((c) => METHOD_COST[c.method] > max) };
}

export function isScreenCap(c: string): boolean {
  return SCREEN_CAPS.has(c);
}
