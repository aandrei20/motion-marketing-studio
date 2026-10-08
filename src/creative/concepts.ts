/**
 * Directorul creativ (partea executabilă): teritorii creative derivate din dovezi, concepte, evaluare pe
 * 10 criterii, alegerea celui mai bun și aplicarea lui (structură, direcție, hook).
 *
 *   research + brief + materiale → teritorii posibile → concepte → scor (hook, noutate, claritate, relevanță,
 *   emoție, oportunitate vizuală, oportunitate audio, CTA, platformă, brand) → conceptul ales → storyboard
 *
 * Reguli: conceptul utilizatorului (poveste/concept din brief) e prioritar și se păstrează cuvânt cu cuvânt
 * (regula 14); conceptele propuse sunt „sugestii”. Hook-urile propuse sunt fie cuvintele utilizatorului,
 * fie citate exacte de pe site (afirmații utilizabile) – nicio afirmație nouă (regula 5). Claude poate adăuga
 * concepte proprii (origin „ai”) și scoruri proprii (source „ai”) în concepts.json; motorul le validează.
 */
import fs from "node:fs";
import { MmsError } from "../core/errors";
import { fingerprint } from "../core/hash";
import { readJson, writeValidated } from "../core/json";
import { CONCEPT_CRITERIA, Concepts, isClaimUsable, type AssetManifest, type Brief, type ConceptCriterion, type ConceptScore, type CreativeConcept, type CreativeDirection, type CreativeTerritory, type Project, type Research } from "../core/schema";
import { platformProfile } from "../platform/profiles";
import { getRecipe } from "../recipes/recipes";
import { hasFile, loadAssets, loadBrief, loadProject, loadResearch, projectFile, updateState } from "../projects/store";
import { listTemplates, type AdTemplate } from "./templates";

export const CRITERION_WEIGHTS: Record<ConceptCriterion, number> = { hook: 1.4, novelty: 0.8, clarity: 1.3, relevance: 1.3, emotion: 1, visual: 1.1, audio: 0.6, cta: 1, platform: 0.9, brand: 0.8 };

const TERRITORY: Record<CreativeTerritory, { title: string; idea: string; templates: string[]; direction: CreativeDirection; motion: string; audio: string; novelty: number; emotion: number }> = {
  "problem-solution": { title: "Problema → soluția", idea: "Pornim din durerea reală a publicului și o rezolvăm pe ecran cu produsul.", templates: ["saas", "startup", "ai-product"], direction: "technical", motion: "tensiune la început (ritm sacadat), apoi mișcări fluide pe demonstrație", audio: "pulsație joasă pe problemă, deschidere melodică la dezvăluire", novelty: 5, emotion: 7 },
  transformation: { title: "Înainte / după", idea: "Arătăm aceeași zi înainte și după produs; contrastul face vânzarea.", templates: ["startup", "saas"], direction: "emotional", motion: "înainte: cadre statice, reci; după: push-in, lumină caldă", audio: "trecere de la minor la major pe dezvăluire", novelty: 6, emotion: 8 },
  "speed-proof": { title: "Viteza ca dovadă", idea: "Promisiunea măsurabilă (timp, pași) devine structura reclamei, cu dovada pe interfață.", templates: ["product-launch", "feature-showcase"], direction: "energetic", motion: "tăieturi pe bătaie, contoare, punch pe ritm", audio: "tempo alert, impacturi pe cifre", novelty: 6, emotion: 6 },
  "feature-tour": { title: "Turul funcțiilor", idea: "Trei funcții esențiale, fiecare cu un moment clar pe interfața reală.", templates: ["feature-showcase", "saas", "mobile-app"], direction: "technical", motion: "zoom pe zona fiecărei funcții, callout-uri, aceeași gramatică de cameră", audio: "bătaie constantă, sunete UI pe clicuri", novelty: 4, emotion: 5 },
  "demo-first": { title: "Demonstrația directă", idea: "Fără preambul: produsul lucrează pe ecran din prima secundă.", templates: ["ai-product", "feature-showcase"], direction: "minimal", motion: "înregistrare reală, cursor, tastare; cameră discretă", audio: "sunete UI în prim-plan, muzică discretă", novelty: 6, emotion: 5 },
  "curiosity-gap": { title: "Întrebarea care oprește scroll-ul", idea: "Hook-ul deschide o întrebare la care produsul e răspunsul.", templates: ["teaser-15", "product-launch"], direction: "aggressive", motion: "slam pe hook, dezvăluire rapidă", audio: "riser înainte de dezvăluire, impact pe răspuns", novelty: 7, emotion: 7 },
  manifesto: { title: "Manifest", idea: "O convingere a brandului, spusă calm, susținută de imaginile produsului.", templates: ["cinematic"], direction: "premium", motion: "mișcări lente de cameră, adâncime, tipografie editorială", audio: "muzică amplă, puține efecte", novelty: 7, emotion: 8 },
  "old-vs-new": { title: "Vechiul mod vs. noul mod", idea: "Cum se făcea până acum (fără nume de concurenți) și cum se face cu produsul.", templates: ["saas", "startup"], direction: "energetic", motion: "split-screen, tranziții direcționale", audio: "contrast de ritm între cele două lumi", novelty: 6, emotion: 6 },
  "user-concept": { title: "Conceptul tău", idea: "", templates: ["saas", "startup", "cinematic", "product-launch"], direction: "technical", motion: "", audio: "", novelty: 7, emotion: 7 },
};

const words = (t: string) => t.split(/\s+/).filter(Boolean).length;

export interface ConceptContext {
  project: Pick<Project, "product" | "formats" | "platformOverrides">;
  brief: Brief;
  research: Research;
  assets: AssetManifest;
  hasBrand: boolean;
}

function pickTemplate(territory: CreativeTerritory, durationSec: number, templates: AdTemplate[], category: string): AdTemplate {
  const prefs = TERRITORY[territory].templates;
  const fits = (t: AdTemplate) => durationSec >= t.durationSec[0] - 2 && durationSec <= t.durationSec[1] + 2;
  const ordered = [...prefs.map((id) => templates.find((t) => t.id === id)).filter((t): t is AdTemplate => !!t)];
  return ordered.find((t) => fits(t) && t.products.includes(category as never)) ?? ordered.find(fits) ?? templates.find(fits) ?? templates[0];
}

/** Teritoriile posibile, fiecare cu dovezile care îl susțin (fără dovezi, teritoriul nu se propune). */
export function territories(ctx: ConceptContext): Array<{ territory: CreativeTerritory; evidence: string[]; claimIds: string[] }> {
  const { brief, research, assets } = ctx;
  const usable = research.claims.filter(isClaimUsable);
  const features = usable.filter((c) => c.category === "feature" || c.category === "use-case");
  const positioning = usable.filter((c) => c.category === "positioning" || c.category === "differentiator");
  const metrics = usable.filter((c) => c.category === "metric");
  const speed = positioning.filter((c) => /minut|secund|instant|rapid|fast|quick|clic|click|pas(i|ul)?\b|steps?/i.test(c.text));
  const screens = assets.assets.filter((a) => a.role === "screenshot" && a.showsProductUI);
  const recordings = assets.assets.filter((a) => a.role === "screen-recording");
  const pains = brief.audience.painPoints.filter(Boolean);
  const out: Array<{ territory: CreativeTerritory; evidence: string[]; claimIds: string[] }> = [];
  if (brief.userVision.story.trim() || brief.userVision.concept.trim()) out.push({ territory: "user-concept", evidence: ["conceptul/povestea din brief (cuvintele utilizatorului)"], claimIds: [] });
  if (pains.length && (positioning.length || features.length)) out.push({ territory: "problem-solution", evidence: [`durerea: „${pains[0]}”`, `${positioning.length + features.length} afirmații despre soluție`], claimIds: [...positioning, ...features].slice(0, 3).map((c) => c.id) });
  if (pains.length && screens.length >= 1 && (features.length || positioning.length)) out.push({ territory: "transformation", evidence: [`durerea: „${pains[0]}”`, `${screens.length} capturi reale pentru „după”`], claimIds: [...positioning, ...features].slice(0, 2).map((c) => c.id) });
  if (speed.length || metrics.length) out.push({ territory: "speed-proof", evidence: [...speed.map((c) => `promisiune măsurabilă: „${c.text.slice(0, 60)}”`), ...metrics.map((c) => `cifră verificată: „${c.text.slice(0, 60)}”`)].slice(0, 2), claimIds: [...speed, ...metrics].slice(0, 2).map((c) => c.id) });
  if (features.length >= 2 && screens.length >= 1) out.push({ territory: "feature-tour", evidence: [`${features.length} funcții cu sursă`, `${screens.length} capturi`], claimIds: features.slice(0, 3).map((c) => c.id) });
  if (recordings.length || (screens.length && features.length)) out.push({ territory: "demo-first", evidence: [recordings.length ? `${recordings.length} înregistrări reale de ecran` : `${screens.length} capturi cu zone din DOM`], claimIds: features.slice(0, 2).map((c) => c.id) });
  if (pains.length || brief.userVision.hooks.length) out.push({ territory: "curiosity-gap", evidence: [brief.userVision.hooks.length ? `hook-ul utilizatorului: „${brief.userVision.hooks[0]}”` : `întrebare din durere: „${pains[0]}”`], claimIds: positioning.slice(0, 1).map((c) => c.id) });
  if (positioning.length && (brief.direction === "premium" || brief.direction === "emotional" || brief.direction === null)) out.push({ territory: "manifesto", evidence: [`poziționarea oficială: „${positioning[0].text.slice(0, 60)}”`], claimIds: positioning.slice(0, 1).map((c) => c.id) });
  if (pains.length >= 2 && features.length) out.push({ territory: "old-vs-new", evidence: [`${pains.length} dureri ale vechiului mod`, `${features.length} funcții ale noului mod`], claimIds: features.slice(0, 2).map((c) => c.id) });
  return out;
}

function hookFor(territory: CreativeTerritory, ctx: ConceptContext): CreativeConcept["hook"] {
  const { brief, research } = ctx;
  if (brief.userVision.hooks[0]) return { text: brief.userVision.hooks[0], origin: "user-verbatim" };
  const usable = research.claims.filter(isClaimUsable);
  const pos = usable.find((c) => c.category === "positioning");
  if ((territory === "problem-solution" || territory === "curiosity-gap" || territory === "old-vs-new" || territory === "transformation") && brief.audience.painPoints[0]) return { text: brief.audience.painPoints[0], origin: "user-verbatim" };
  if (pos) return { text: pos.quote ?? pos.text, origin: "site-quote" };
  return { text: ctx.project.product.name, origin: "user-verbatim" };
}

/** Evaluarea unui concept pe cele 10 criterii (0–10), cu explicația fiecărei note. */
export function scoreConcept(c: CreativeConcept, ctx: ConceptContext, templates: AdTemplate[] = listTemplates()): CreativeConcept {
  const { brief, research, assets } = ctx;
  const tpl = templates.find((t) => t.id === c.templateId);
  const usable = new Set(research.claims.filter(isClaimUsable).map((x) => x.id));
  const s: Partial<Record<ConceptCriterion, ConceptScore>> = {};
  const set = (k: ConceptCriterion, value: number, why: string) => {
    // scorul lui Claude sau al utilizatorului are prioritate față de estimarea motorului
    const prev = c.scores[k];
    s[k] = prev && prev.source !== "engine" ? prev : { value: Math.max(0, Math.min(10, Math.round(value * 10) / 10)), why, source: "engine" };
  };
  const hw = words(c.hook.text);
  const question = /\?$/.test(c.hook.text.trim());
  set("hook", (hw <= 7 ? 8 : hw <= 10 ? 6.5 : 4.5) + (question ? 1 : 0) + (c.hook.origin === "user-verbatim" ? 0.5 : 0), `${hw} cuvinte${question ? ", întrebare" : ""}${c.hook.origin === "user-verbatim" ? ", cuvintele utilizatorului" : c.hook.origin === "site-quote" ? ", citat de pe site" : ""}`);
  set("novelty", TERRITORY[c.territory].novelty, "estimare după teritoriu (Claude o poate corecta)");
  const scenes = tpl?.scenes.length ?? c.arc.length;
  const perScene = brief.durationSec / Math.max(1, scenes);
  set("clarity", perScene >= 2.5 ? 8.5 : perScene >= 1.8 ? 7 : 5, `${scenes} scene în ${brief.durationSec} s (${perScene.toFixed(1)} s pe scenă)`);
  const supported = c.claimIds.filter((id) => usable.has(id)).length;
  set("relevance", Math.min(10, 4 + supported * 2), `${supported} afirmații verificate susțin ideea`);
  const desired = brief.desiredEmotion.toLowerCase();
  set("emotion", TERRITORY[c.territory].emotion + (desired && TERRITORY[c.territory].idea.toLowerCase().includes(desired.slice(0, 5)) ? 1 : 0), "potențialul emoțional al teritoriului");
  const avail = c.needs.filter((n) => n.available).length;
  set("visual", c.needs.length ? 4 + (6 * avail) / c.needs.length : 5, c.needs.length ? `${avail}/${c.needs.length} materiale necesare există` : "fără cerințe de material");
  set("audio", brief.audio.music.mode === "none" ? 4 : brief.audio.voice.mode === "none" ? 6 : 7.5, `muzică: ${brief.audio.music.mode}, voce: ${brief.audio.voice.mode}`);
  set("cta", (c.arc[c.arc.length - 1] === "cta" ? 6 : 2) + (brief.cta.text ? 2 : 0) + (c.arc.some((r) => ["proof", "benefit", "demo", "feature", "reveal"].includes(r)) ? 2 : 0), "CTA la final, după o recompensă");
  const platforms = brief.platforms.map((p) => platformProfile(p, ctx.project));
  const fitsDuration = platforms.every((p) => brief.durationSec >= p.durationSec.idealMin * 0.9 && brief.durationSec <= p.durationSec.idealMax * 1.1);
  const pacingFit = platforms.every((p) => perScene >= p.avgShotSec[0] * 0.8 && perScene <= p.avgShotSec[1] * 1.4);
  set("platform", (fitsDuration ? 5 : 3) + (pacingFit ? 4 : 2), `${fitsDuration ? "durata potrivită" : "durata în afara intervalului ideal"}, ${pacingFit ? "ritm potrivit" : "ritm de verificat"} pentru ${platforms.map((p) => p.label).join(", ")}`);
  const logo = assets.assets.some((a) => a.role === "logo");
  set("brand", (ctx.hasBrand ? 4 : 2) + (logo ? 3 : 0) + (c.arc.includes("reveal") || c.arc.includes("cta") ? 3 : 1), `${ctx.hasBrand ? "brand kit" : "fără brand kit"}, ${logo ? "logo" : "fără logo"}`);
  const scores = s as Record<ConceptCriterion, ConceptScore>;
  const wsum = CONCEPT_CRITERIA.reduce((a, k) => a + CRITERION_WEIGHTS[k], 0);
  const total = Math.round((CONCEPT_CRITERIA.reduce((a, k) => a + scores[k].value * CRITERION_WEIGHTS[k], 0) / wsum) * 100) / 10;
  return { ...c, scores, total };
}

/** Conceptele propuse din dovezi (deterministe), plus conceptul utilizatorului dacă există. */
export function generateConcepts(ctx: ConceptContext, templates: AdTemplate[] = listTemplates()): CreativeConcept[] {
  const screens = ctx.assets.assets.filter((a) => a.role === "screenshot" && a.showsProductUI).length;
  const recordings = ctx.assets.assets.filter((a) => a.role === "screen-recording").length;
  const logo = ctx.assets.assets.some((a) => a.role === "logo");
  const tall = ctx.assets.assets.some((a) => a.role === "screenshot" && a.capture?.fullPage);
  const images = ctx.assets.assets.some((a) => a.role === "photo" || a.role === "product-image" || a.role === "screenshot");
  const has: Record<string, boolean> = { logo, screen: screens + recordings > 0, screenshot: screens > 0, recording: recordings > 0, "tall-screenshot": tall, image: images };
  return territories(ctx).map(({ territory, evidence, claimIds }) => {
    const T = TERRITORY[territory];
    const tpl = pickTemplate(territory, ctx.brief.durationSec, templates, ctx.project.product.category);
    const needs = [...new Set(tpl.scenes.flatMap((s) => getRecipe(s.recipe).slots.filter((x) => x.required).map((x) => x.kind)))].map((kind) => ({ what: kind, available: has[kind] ?? false }));
    const user = territory === "user-concept";
    const concept: CreativeConcept = {
      id: `c-${territory}`,
      title: user ? "Conceptul tău (din brief)" : T.title,
      territory,
      bigIdea: user ? (ctx.brief.userVision.concept || ctx.brief.userVision.story).trim() : T.idea,
      hook: hookFor(territory, ctx),
      arc: tpl.scenes.map((s) => s.role),
      templateId: tpl.id,
      direction: ctx.brief.direction ?? T.direction,
      visualWorld: user ? "" : `${T.motion}.`,
      motionLanguage: T.motion,
      audioIdea: T.audio,
      claimIds,
      needs,
      risks: [...needs.filter((n) => !n.available).map((n) => `lipsește materialul „${n.what}”`), ...(evidence.length < 2 && !user ? ["o singură dovadă susține ideea"] : [])],
      scores: {},
      total: 0,
      origin: user ? "user" : "engine",
    };
    return scoreConcept(concept, ctx, templates);
  });
}

/** Conceptul ales: al utilizatorului dacă există (regula 14), altfel cel cu scorul cel mai mare. */
export function selectConcept(concepts: CreativeConcept[]): { id: string | null; rationale: string[] } {
  if (!concepts.length) return { id: null, rationale: ["Nu există dovezi suficiente pentru un concept: completează research-ul sau brief-ul."] };
  const user = concepts.find((c) => c.origin === "user");
  const best = [...concepts].sort((a, b) => b.total - a.total || a.id.localeCompare(b.id))[0];
  if (user) return { id: user.id, rationale: [`Conceptul utilizatorului are prioritate (regula 14): ${user.total}/100.`, ...(best.id !== user.id ? [`Sugestie: „${best.title}” are ${best.total}/100 (doar ca alternativă).`] : [])] };
  const second = [...concepts].sort((a, b) => b.total - a.total)[1];
  return { id: best.id, rationale: [`„${best.title}”: ${best.total}/100${second ? ` (următorul: „${second.title}”, ${second.total}/100)` : ""}.`, ...CONCEPT_CRITERIA.map((k) => `  ${k}: ${best.scores[k]?.value} – ${best.scores[k]?.why}`)] };
}

const conceptsFile = (projectId: string) => projectFile(projectId, "concepts.json");

export function loadConcepts(projectId: string): Concepts | null {
  return fs.existsSync(conceptsFile(projectId)) ? readJson(conceptsFile(projectId), Concepts) : null;
}

/**
 * Conceptele proiectului: refolosite dacă brief-ul, research-ul și materialele nu s-au schimbat; altfel
 * regenerate. Conceptele lui Claude (origin „ai”) și scorurile lui se păstrează și se re-evaluează.
 */
export function ensureConcepts(projectId: string, o: { force?: boolean } = {}): Concepts {
  const project = loadProject(projectId);
  const brief = loadBrief(projectId);
  const research = loadResearch(projectId);
  const assets = loadAssets(projectId);
  const inputs = { brief: fingerprint(brief), research: fingerprint(research), assets: fingerprint(assets) };
  const prev = loadConcepts(projectId);
  if (prev && !o.force && prev.inputs.brief === inputs.brief && prev.inputs.research === inputs.research && prev.inputs.assets === inputs.assets) return prev;
  const ctx: ConceptContext = { project, brief, research, assets, hasBrand: hasFile(projectId, "brand.json") };
  const templates = listTemplates();
  const ai = (prev?.concepts ?? []).filter((c) => c.origin === "ai").map((c) => scoreConcept(c, ctx, templates));
  const concepts = [...generateConcepts(ctx, templates), ...ai];
  const keep = prev?.selectedId && concepts.some((c) => c.id === prev.selectedId) ? prev.selectedId : null;
  const sel = selectConcept(concepts);
  const saved = writeValidated(conceptsFile(projectId), Concepts, { schemaVersion: 1, generatedAt: new Date().toISOString(), inputs, concepts, selectedId: keep ?? sel.id, rationale: sel.rationale });
  updateState(projectId, { log: `Concepte creative: ${concepts.length} (ales: ${saved.selectedId ?? "niciunul"}).` });
  return saved;
}

/** Alegerea explicită a unui concept (utilizatorul sau Claude). */
export function chooseConcept(projectId: string, conceptId: string): Concepts {
  const c = ensureConcepts(projectId);
  if (!c.concepts.some((x) => x.id === conceptId)) throw new MmsError("CONCEPT_MISSING", `Conceptul „${conceptId}” nu există.`, `Concepte: ${c.concepts.map((x) => x.id).join(", ")}`);
  const saved = writeValidated(conceptsFile(projectId), Concepts, { ...c, selectedId: conceptId, rationale: [`Ales explicit: ${conceptId}.`, ...c.rationale] });
  updateState(projectId, { decision: `Conceptul creativ ales: ${conceptId}.` });
  return saved;
}

export function selectedConcept(projectId: string): CreativeConcept | null {
  const c = loadConcepts(projectId);
  return c?.concepts.find((x) => x.id === c.selectedId) ?? null;
}
