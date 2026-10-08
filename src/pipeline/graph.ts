/**
 * Registrul capabilităților de sistem (nu de mișcare): fiecare pas al producției, cu intrările și
 * ieșirile lui (artefacte), implementarea, testele, starea și costul. Din el se deduce graful de
 * dependențe: când se schimbă un artefact, ce trebuie recalculat și ce se poate păstra.
 *
 * Sursa de adevăr e acest fișier; testul tests/unit/system-registry.test.ts verifică faptul că fiecare
 * intrare „implemented” trimite la o funcție exportată care există și la teste care există.
 * Capabilitățile de mișcare (straturi, camere, tranziții) au registrul lor: src/motion/registry.ts.
 */

export type ArtifactId =
  | "brief"
  | "captures"
  | "assets"
  | "research"
  | "brand"
  | "references"
  | "concepts"
  | "script"
  | "storyboard"
  | "voice"
  | "beatgrid"
  | "timeline"
  | "mix"
  | "stills"
  | "scene-render"
  | "full-render"
  | "critique"
  | "quality"
  | "export";

export type SystemDomain = "research" | "claims" | "brand" | "assets" | "references" | "creative" | "editing" | "audio" | "timeline" | "motion" | "render" | "critique" | "quality" | "platform" | "export";

/**
 * Costul relativ (aproximativ, pe laptopul de test): 0 = instant (validare de schemă), 1 = milisecunde
 * (calcul pe date), 2 = secunde (audio, OCR), 3 = zeci de secunde (cadre randate), 4 = o scenă randată,
 * 5 = rețea / browser, 6 = video întreg randat.
 */
export type Cost = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface SystemCapability {
  id: string;
  version: number;
  domain: SystemDomain;
  title: string;
  inputs: ArtifactId[];
  outputs: ArtifactId[];
  /** numele schemelor zod (src/core/schema) pentru intrare/ieșire, dacă există */
  inputSchema?: string;
  outputSchema?: string;
  /** „cale#funcție” – funcția exportată care face pasul */
  implementation: string;
  tests: string[];
  status: "implemented" | "partial" | "experimental" | "planned";
  confidence: "high" | "medium" | "low";
  cost: Cost;
  notes?: string;
}

export const SYSTEM_CAPABILITIES: SystemCapability[] = [
  // ─── research și afirmații
  { id: "research.capture", version: 1, domain: "research", title: "Captură reală (Playwright): capturi, zone din DOM, text, CSS, date personale", inputs: ["brief"], outputs: ["captures", "assets"], implementation: "src/capture/capture.ts#capture", tests: ["tests/integration/pipeline.test.ts"], status: "implemented", confidence: "high", cost: 5 },
  { id: "research.extract", version: 1, domain: "research", title: "Afirmații cu citat, sursă, dată și încredere din paginile capturate", inputs: ["captures"], outputs: ["research"], outputSchema: "Research", implementation: "src/research/extract.ts#extractFromPage", tests: ["tests/unit/creative.test.ts", "tests/integration/pipeline.test.ts"], status: "implemented", confidence: "high", cost: 1 },
  { id: "claims.script-gate", version: 1, domain: "claims", title: "Validarea scriptului: fraze obligatorii, afirmații utilizabile, cifre cu sursă, interdicții", inputs: ["script", "research", "brief"], outputs: ["quality"], inputSchema: "Script", implementation: "src/creative/script.ts#validateScript", tests: ["tests/unit/creative.test.ts"], status: "implemented", confidence: "high", cost: 1 },
  // ─── brand și materiale
  { id: "brand.infer", version: 1, domain: "brand", title: "Brand kit din CSS-ul paginii și din logo", inputs: ["captures", "assets"], outputs: ["brand"], outputSchema: "Brand", implementation: "src/brand/infer.ts#inferBrand", tests: ["tests/integration/pipeline.test.ts"], status: "implemented", confidence: "medium", cost: 1 },
  { id: "assets.ingest", version: 1, domain: "assets", title: "Ingestie: sha256, duplicate, ffprobe, fonturi, SVG, paletă, punct focal, dHash, rol", inputs: ["captures"], outputs: ["assets"], outputSchema: "AssetManifest", implementation: "src/assets/ingest.ts#ingestFile", tests: ["tests/unit/store-validate.test.ts", "tests/integration/pipeline.test.ts"], status: "implemented", confidence: "high", cost: 2 },
  { id: "references.analyze", version: 1, domain: "references", title: "Profilul unei referințe video (tăieturi, mișcare, culoare, tempo, energie)", inputs: ["assets"], outputs: ["references"], implementation: "src/references/analyze.ts#analyzeReference", tests: [], status: "partial", confidence: "medium", cost: 3, notes: "Profilul se calculează, dar nu intră încă în deciziile de montaj (vezi references.dna)." },
  // ─── creativ
  { id: "creative.intake", version: 1, domain: "creative", title: "Întrebările A–H cu variante", inputs: [], outputs: ["brief"], implementation: "src/creative/intake.ts#intakeMarkdown", tests: [], status: "implemented", confidence: "high", cost: 0 },
  { id: "creative.templates", version: 1, domain: "creative", title: "Alegerea structurii (șablon) după categorie, direcție, durată, obiectiv", inputs: ["brief"], outputs: ["storyboard"], implementation: "src/creative/templates.ts#chooseTemplate", tests: ["tests/unit/creative.test.ts"], status: "implemented", confidence: "medium", cost: 0 },
  { id: "creative.script-draft", version: 1, domain: "creative", title: "Schița factuală de script (citatele din research + cuvintele utilizatorului)", inputs: ["brief", "research"], outputs: ["script"], outputSchema: "Script", implementation: "src/creative/script.ts#draftScript", tests: ["tests/unit/creative.test.ts"], status: "implemented", confidence: "medium", cost: 1 },
  { id: "creative.storyboard", version: 1, domain: "creative", title: "Storyboard executabil din șablon, script și materiale", inputs: ["script", "brief", "research", "assets"], outputs: ["storyboard"], outputSchema: "Storyboard", implementation: "src/creative/storyboard.ts#buildStoryboard", tests: ["tests/unit/creative.test.ts"], status: "implemented", confidence: "medium", cost: 1 },
  // ─── montaj și editare
  { id: "editing.grammar", version: 1, domain: "editing", title: "Gramatica de montaj: durate, tranziții, J-cut, hold pe CTA", inputs: ["storyboard", "voice"], outputs: ["timeline"], implementation: "src/editing/grammar.ts#sceneDuration", tests: ["tests/unit/creative.test.ts"], status: "implemented", confidence: "high", cost: 0 },
  { id: "editing.nl-commands", version: 1, domain: "editing", title: "Comenzi în limbaj natural → operații locale pe storyboard/script", inputs: ["storyboard", "script", "timeline"], outputs: ["storyboard", "script"], implementation: "src/iterate/intents.ts#parseCommand", tests: ["tests/unit/creative.test.ts", "tests/integration/pipeline.test.ts"], status: "implemented", confidence: "medium", cost: 0 },
  // ─── audio
  { id: "audio.voice", version: 1, domain: "audio", title: "Vocea (TTS / fișier), cu amprentă și cache", inputs: ["script", "brief"], outputs: ["voice"], implementation: "src/pipeline/steps.ts#stepVoice", tests: ["tests/integration/pipeline.test.ts"], status: "implemented", confidence: "high", cost: 2 },
  { id: "audio.beat", version: 1, domain: "audio", title: "Beat grid (tempo, fază, încredere) din muzica utilizatorului sau ales pentru muzica sintetizată", inputs: ["assets", "brief", "storyboard"], outputs: ["beatgrid"], outputSchema: "BeatGrid", implementation: "src/pipeline/steps.ts#planBeatGrid", tests: ["tests/unit/audio.test.ts"], status: "implemented", confidence: "medium", cost: 2 },
  { id: "audio.mix", version: 1, domain: "audio", title: "Muzică, efecte, voce, ducking, −14 LUFS, true peak ≤ −1 dBTP, tăceri", inputs: ["timeline", "storyboard", "brief", "beatgrid"], outputs: ["mix"], outputSchema: "MixReport", implementation: "src/pipeline/steps.ts#stepAudio", tests: ["tests/unit/audio.test.ts", "tests/integration/pipeline.test.ts"], status: "implemented", confidence: "high", cost: 2 },
  // ─── timeline
  { id: "timeline.compile", version: 1, domain: "timeline", title: "Compilatorul storyboard → timeline (determinist, text măsurat cu fonturile reale)", inputs: ["storyboard", "script", "brief", "brand", "assets", "research", "voice", "beatgrid", "references"], outputs: ["timeline"], inputSchema: "Storyboard", outputSchema: "Timeline", implementation: "src/timeline/compile.ts#compileTimeline", tests: ["tests/integration/pipeline.test.ts", "tests/unit/store-validate.test.ts"], status: "implemented", confidence: "high", cost: 1 },
  { id: "timeline.validate", version: 1, domain: "timeline", title: "Validatorul: footage real, drepturi, cifre, zone sigure, 360 px, flash, goluri, date personale", inputs: ["timeline", "assets", "research"], outputs: ["quality"], inputSchema: "Timeline", implementation: "src/timeline/validate.ts#validateTimeline", tests: ["tests/unit/store-validate.test.ts"], status: "implemented", confidence: "high", cost: 1 },
  // ─── randare
  { id: "render.stills", version: 1, domain: "render", title: "Cadre randate (selectate)", inputs: ["timeline"], outputs: ["stills"], implementation: "src/renderer/node/render.ts#renderStills", tests: ["tests/render/catalog.test.ts"], status: "implemented", confidence: "high", cost: 3 },
  { id: "render.full", version: 1, domain: "render", title: "Video MP4 (întreg sau un interval de cadre)", inputs: ["timeline", "mix"], outputs: ["full-render", "scene-render"], implementation: "src/renderer/node/render.ts#renderTimelineVideo", tests: ["tests/render/video.test.ts"], status: "implemented", confidence: "high", cost: 6 },
  { id: "render.video-check", version: 1, domain: "render", title: "Verificarea video-ului randat: cadre negre, flash-uri, înghețări", inputs: ["full-render"], outputs: ["critique"], implementation: "src/renderer/node/analyze-video.ts#analyzeVideo", tests: ["tests/render/video.test.ts"], status: "implemented", confidence: "high", cost: 3 },
  // ─── critică și calitate
  { id: "critique.auto", version: 1, domain: "critique", title: "Critica automată cu rubrica fixă (rubric-v1), fiecare depunctare ca problemă structurată", inputs: ["timeline", "brief", "mix"], outputs: ["critique"], outputSchema: "CritiqueRound", implementation: "src/critique/auto.ts#autoCritique", tests: ["tests/unit/quality.test.ts"], status: "implemented", confidence: "medium", cost: 1 },
  { id: "quality.score", version: 1, domain: "quality", title: "Scorul de calitate quality-v1: 11 categorii 0–100, verdict PASS/POLISH/FIX/FAIL", inputs: ["critique"], outputs: ["quality"], outputSchema: "QualityScore", implementation: "src/quality/score.ts#scoreQuality", tests: ["tests/unit/quality.test.ts"], status: "implemented", confidence: "high", cost: 0 },
  // ─── platformă și export
  { id: "platform.safe-zones", version: 1, domain: "platform", title: "Formate, zone sigure și zone excluse pe platformă (cu sursă și încredere)", inputs: ["brief"], outputs: ["timeline"], implementation: "src/core/formats.ts#resolveSafeZone", tests: ["tests/unit/core.test.ts"], status: "implemented", confidence: "medium", cost: 0 },
  { id: "export.final", version: 1, domain: "export", title: "Exportul final, doar cu „render final”, fără blocaje, cu mix „ok”, fără suprascriere", inputs: ["timeline", "mix", "quality"], outputs: ["export"], implementation: "src/pipeline/steps.ts#stepFinalRender", tests: ["tests/integration/studio-lint.test.ts"], status: "implemented", confidence: "high", cost: 6 },
  { id: "export.post-pack", version: 1, domain: "export", title: "Pachetul de postare (copertă + text din replicile aprobate)", inputs: ["timeline", "script", "brief"], outputs: ["export"], implementation: "src/pipeline/steps.ts#writePostPack", tests: [], status: "partial", confidence: "medium", cost: 3, notes: "Verificat manual (mms post-pack); fără test automat." },
];

const byId = new Map(SYSTEM_CAPABILITIES.map((c) => [c.id, c]));

export function getSystemCapability(id: string): SystemCapability | undefined {
  return byId.get(id);
}

/** Toate artefactele care devin învechite când se schimbă `changed` (inclusiv ele). */
export function downstream(changed: Iterable<ArtifactId>): Set<ArtifactId> {
  const out = new Set<ArtifactId>(changed);
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of SYSTEM_CAPABILITIES) {
      if (c.status === "planned") continue;
      if (c.inputs.some((i) => out.has(i))) for (const o of c.outputs) if (!out.has(o)) (out.add(o), (grew = true));
    }
  }
  return out;
}

/** Capabilitățile care trebuie rulate din nou după schimbarea `changed`, în ordinea grafului. */
export function capabilitiesToRerun(changed: Iterable<ArtifactId>): SystemCapability[] {
  const stale = downstream(changed);
  const initial = new Set(changed);
  return SYSTEM_CAPABILITIES.filter((c) => c.status !== "planned" && c.inputs.some((i) => stale.has(i)) && !c.outputs.every((o) => initial.has(o)));
}
