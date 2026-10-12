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

export type SystemDomain =
  | "research"
  | "claims"
  | "brand"
  | "assets"
  | "references"
  | "creative"
  | "editing"
  | "audio"
  | "timeline"
  | "motion"
  | "render"
  | "critique"
  | "quality"
  | "platform"
  | "export";

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
  {
    id: "research.capture",
    version: 1,
    domain: "research",
    title: "Captură reală (Playwright): capturi, zone din DOM, text, CSS, date personale",
    inputs: ["brief"],
    outputs: ["captures", "assets"],
    implementation: "src/capture/capture.ts#capture",
    tests: ["tests/integration/pipeline.test.ts"],
    status: "implemented",
    confidence: "high",
    cost: 5,
  },
  {
    id: "research.capture-policy",
    version: 1,
    domain: "research",
    title:
      "Politica de adrese a capturii (SSRF): o pagină publică nu atinge rețeaua locală (resurse, WebSocket, redirecționări, pași goto), niciodată metadatele norilor",
    inputs: ["brief"],
    outputs: ["captures"],
    implementation: "src/capture/url-policy.ts#guardNetwork",
    tests: ["tests/unit/security.test.ts", "tests/integration/capture-network.test.ts"],
    status: "implemented",
    confidence: "medium",
    cost: 0,
    notes: "Redirecționarea se observă după ce cererea a plecat; DNS rebinding nu e prins",
  },
  {
    id: "research.extract",
    version: 1,
    domain: "research",
    title: "Afirmații cu citat, sursă, dată și încredere din paginile capturate",
    inputs: ["captures"],
    outputs: ["research"],
    outputSchema: "Research",
    implementation: "src/research/extract.ts#extractFromPage",
    tests: ["tests/unit/creative.test.ts", "tests/integration/pipeline.test.ts"],
    status: "implemented",
    confidence: "high",
    cost: 1,
  },
  {
    id: "research.crawl",
    version: 1,
    domain: "research",
    title: "Research pe site: pagini relevante (prețuri, funcții, noutăți, documentație), fără login/aplicație; concurenții doar ca „de confirmat”",
    inputs: ["brief"],
    outputs: ["research"],
    implementation: "src/research/crawl.ts#crawlSite",
    tests: ["tests/unit/research.test.ts"],
    status: "implemented",
    confidence: "medium",
    cost: 5,
  },
  {
    id: "claims.graph",
    version: 1,
    domain: "claims",
    title: "Graful de afirmații: dovadă, sursă, încredere după coroborare, conflicte, concurenți",
    inputs: ["research"],
    outputs: ["quality"],
    implementation: "src/research/graph.ts#claimGraph",
    tests: ["tests/unit/research.test.ts"],
    status: "implemented",
    confidence: "high",
    cost: 0,
  },
  {
    id: "claims.script-gate",
    version: 1,
    domain: "claims",
    title: "Validarea scriptului: fraze obligatorii, afirmații utilizabile, cifre cu sursă, interdicții",
    inputs: ["script", "research", "brief"],
    outputs: ["quality"],
    inputSchema: "Script",
    implementation: "src/creative/script.ts#validateScript",
    tests: ["tests/unit/creative.test.ts"],
    status: "implemented",
    confidence: "high",
    cost: 1,
  },
  // ─── brand și materiale
  {
    id: "brand.infer",
    version: 1,
    domain: "brand",
    title: "Brand kit din CSS-ul paginii și din logo: culori, fonturi, rază, umbre, spațiere, gradiente",
    inputs: ["captures", "assets"],
    outputs: ["brand"],
    outputSchema: "Brand",
    implementation: "src/brand/infer.ts#inferBrand",
    tests: ["tests/integration/pipeline.test.ts"],
    status: "implemented",
    confidence: "medium",
    cost: 1,
  },
  {
    id: "assets.ingest",
    version: 1,
    domain: "assets",
    title: "Ingestie: sha256, duplicate, ffprobe, fonturi, SVG, paletă, punct focal, dHash, rol",
    inputs: ["captures"],
    outputs: ["assets"],
    outputSchema: "AssetManifest",
    implementation: "src/assets/ingest.ts#ingestFile",
    tests: ["tests/unit/store-validate.test.ts", "tests/integration/pipeline.test.ts"],
    status: "implemented",
    confidence: "high",
    cost: 2,
  },
  {
    id: "assets.phone-counterpart",
    version: 1,
    domain: "assets",
    title: "Captura de telefon a aceleiași pagini pe formatele verticale: doar pagini adaptate, doar cu zonele demonstrate în scenă",
    inputs: ["assets", "storyboard"],
    outputs: ["timeline"],
    implementation: "src/assets/counterpart.ts#chooseCounterpart",
    tests: ["tests/unit/counterpart.test.ts", "tests/integration/pipeline.test.ts", "tests/integration/capture-page.test.ts"],
    status: "implemented",
    confidence: "high",
    cost: 0,
  },
  {
    id: "assets.ocr",
    version: 1,
    domain: "assets",
    title: "OCR offline (Windows): text și zone din imagini, cu cache",
    inputs: ["assets"],
    outputs: ["assets"],
    implementation: "src/assets/ocr.ts#ocrImage",
    tests: ["tests/integration/assets-ocr.test.ts", "tests/unit/pii.test.ts"],
    status: "partial",
    confidence: "medium",
    cost: 2,
    notes: "Doar pe Windows.",
  },
  {
    id: "assets.pii",
    version: 1,
    domain: "assets",
    title: "Date personale în text (DOM și OCR), cu validatori (Luhn, IBAN, CNP)",
    inputs: ["captures", "assets"],
    outputs: ["assets"],
    implementation: "src/assets/pii.ts#findPii",
    tests: ["tests/unit/pii.test.ts"],
    status: "implemented",
    confidence: "medium",
    cost: 0,
  },
  {
    id: "references.analyze",
    version: 1,
    domain: "references",
    title: "Profilul unei referințe video (tăieturi, mișcare, culoare, tempo, energie)",
    inputs: ["assets"],
    outputs: ["references"],
    implementation: "src/references/analyze.ts#analyzeReference",
    tests: ["tests/unit/references.test.ts"],
    status: "implemented",
    confidence: "medium",
    cost: 3,
    notes: "Include estimarea mișcării camerei și ponderea tăieturilor simple.",
  },
  {
    id: "references.dna",
    version: 1,
    domain: "references",
    title: "Reference DNA → direcție: durata cadrelor, ritm, tranziții, cameră, tempo (doar sigur)",
    inputs: ["references", "brief"],
    outputs: ["timeline", "beatgrid"],
    implementation: "src/references/dna.ts#applyDna",
    tests: ["tests/unit/references.test.ts"],
    status: "implemented",
    confidence: "medium",
    cost: 0,
  },
  // ─── creativ
  {
    id: "creative.intake",
    version: 1,
    domain: "creative",
    title: "Întrebările A–H cu variante",
    inputs: [],
    outputs: ["brief"],
    implementation: "src/creative/intake.ts#intakeMarkdown",
    tests: [],
    status: "implemented",
    confidence: "high",
    cost: 0,
  },
  {
    id: "creative.smart-intake",
    version: 1,
    domain: "creative",
    title: "Intake inteligent: deduce din pagina reală ce se poate, întreabă doar ce e incert și important",
    inputs: ["captures"],
    outputs: ["brief"],
    outputSchema: "Brief",
    implementation: "src/creative/smart-intake.ts#inferIntake",
    tests: ["tests/unit/creative-director.test.ts"],
    status: "implemented",
    confidence: "medium",
    cost: 5,
  },
  {
    id: "creative.concepts",
    version: 1,
    domain: "creative",
    title: "Directorul creativ: teritorii din dovezi, concepte, scor pe 10 criterii, alegere (ideea utilizatorului prioritară)",
    inputs: ["brief", "research", "assets"],
    outputs: ["concepts"],
    outputSchema: "Concepts",
    implementation: "src/creative/concepts.ts#ensureConcepts",
    tests: ["tests/unit/creative-director.test.ts"],
    status: "implemented",
    confidence: "medium",
    cost: 1,
  },
  {
    id: "creative.templates",
    version: 1,
    domain: "creative",
    title: "Alegerea structurii (șablon) după categorie, direcție, durată, obiectiv",
    inputs: ["brief"],
    outputs: ["storyboard"],
    implementation: "src/creative/templates.ts#chooseTemplate",
    tests: ["tests/unit/creative.test.ts"],
    status: "implemented",
    confidence: "medium",
    cost: 0,
  },
  {
    id: "creative.script-draft",
    version: 1,
    domain: "creative",
    title: "Schița factuală de script (citatele din research + cuvintele utilizatorului)",
    inputs: ["brief", "research"],
    outputs: ["script"],
    outputSchema: "Script",
    implementation: "src/creative/script.ts#draftScript",
    tests: ["tests/unit/creative.test.ts"],
    status: "implemented",
    confidence: "medium",
    cost: 1,
  },
  {
    id: "creative.storyboard",
    version: 1,
    domain: "creative",
    title: "Storyboard executabil din conceptul ales (șablon, direcție), script și materiale",
    inputs: ["script", "brief", "research", "assets", "concepts"],
    outputs: ["storyboard"],
    outputSchema: "Storyboard",
    implementation: "src/creative/storyboard.ts#buildStoryboard",
    tests: ["tests/unit/creative.test.ts"],
    status: "implemented",
    confidence: "medium",
    cost: 1,
  },
  // ─── montaj și editare
  {
    id: "editing.grammar",
    version: 1,
    domain: "editing",
    title: "Gramatica de montaj: durate, tranziții, J-cut, hold pe CTA",
    inputs: ["storyboard", "voice"],
    outputs: ["timeline"],
    implementation: "src/editing/grammar.ts#sceneDuration",
    tests: ["tests/unit/creative.test.ts"],
    status: "implemented",
    confidence: "high",
    cost: 0,
  },
  {
    id: "editing.nl-commands",
    version: 1,
    domain: "editing",
    title: "Comenzi în limbaj natural → operații locale pe storyboard/script",
    inputs: ["storyboard", "script", "timeline"],
    outputs: ["storyboard", "script"],
    implementation: "src/iterate/intents.ts#parseCommand",
    tests: ["tests/unit/creative.test.ts", "tests/integration/pipeline.test.ts"],
    status: "implemented",
    confidence: "medium",
    cost: 0,
  },
  // ─── audio
  {
    id: "audio.voice",
    version: 1,
    domain: "audio",
    title: "Vocea (TTS / fișier), cu amprentă și cache",
    inputs: ["script", "brief"],
    outputs: ["voice"],
    implementation: "src/pipeline/steps.ts#stepVoice",
    tests: ["tests/integration/pipeline.test.ts"],
    status: "implemented",
    confidence: "high",
    cost: 2,
  },
  {
    id: "audio.beat",
    version: 1,
    domain: "audio",
    title: "Beat grid (tempo, fază, încredere) din muzica utilizatorului sau ales pentru muzica sintetizată",
    inputs: ["assets", "brief", "storyboard"],
    outputs: ["beatgrid"],
    outputSchema: "BeatGrid",
    implementation: "src/pipeline/steps.ts#planBeatGrid",
    tests: ["tests/unit/audio.test.ts"],
    status: "implemented",
    confidence: "medium",
    cost: 2,
  },
  {
    id: "audio.structure",
    version: 1,
    domain: "audio",
    title: "Structura muzicii utilizatorului: energie pe măsuri, secțiuni, drop-uri (dezvăluirea pe drop)",
    inputs: ["assets", "beatgrid"],
    outputs: ["beatgrid"],
    implementation: "src/audio/beat.ts#musicStructure",
    tests: ["tests/unit/audio-intel.test.ts"],
    status: "implemented",
    confidence: "medium",
    cost: 2,
  },
  {
    id: "audio.mix",
    version: 1,
    domain: "audio",
    title: "Muzică, efecte, voce, ducking, −14 LUFS, true peak ≤ −1 dBTP, tăceri",
    inputs: ["timeline", "storyboard", "brief", "beatgrid"],
    outputs: ["mix"],
    outputSchema: "MixReport",
    implementation: "src/pipeline/steps.ts#stepAudio",
    tests: ["tests/unit/audio.test.ts", "tests/integration/pipeline.test.ts"],
    status: "implemented",
    confidence: "high",
    cost: 2,
  },
  // ─── timeline
  {
    id: "timeline.compile",
    version: 1,
    domain: "timeline",
    title: "Compilatorul storyboard → timeline (determinist, text măsurat cu fonturile reale)",
    inputs: ["storyboard", "script", "brief", "brand", "assets", "research", "voice", "beatgrid", "references"],
    outputs: ["timeline"],
    inputSchema: "Storyboard",
    outputSchema: "Timeline",
    implementation: "src/timeline/compile.ts#compileTimeline",
    tests: ["tests/integration/pipeline.test.ts", "tests/unit/store-validate.test.ts"],
    status: "implemented",
    confidence: "high",
    cost: 1,
  },
  {
    id: "timeline.validate",
    version: 1,
    domain: "timeline",
    title: "Validatorul: footage real, drepturi, cifre, zone sigure, 360 px, flash, goluri, date personale",
    inputs: ["timeline", "assets", "research"],
    outputs: ["quality"],
    inputSchema: "Timeline",
    implementation: "src/timeline/validate.ts#validateTimeline",
    tests: ["tests/unit/store-validate.test.ts"],
    status: "implemented",
    confidence: "high",
    cost: 1,
  },
  // ─── randare
  {
    id: "render.stills",
    version: 1,
    domain: "render",
    title: "Cadre randate (selectate)",
    inputs: ["timeline"],
    outputs: ["stills"],
    implementation: "src/renderer/node/render.ts#renderStills",
    tests: ["tests/render/catalog.test.ts"],
    status: "implemented",
    confidence: "high",
    cost: 3,
  },
  {
    id: "render.full",
    version: 1,
    domain: "render",
    title: "Video MP4 (întreg sau un interval de cadre)",
    inputs: ["timeline", "mix"],
    outputs: ["full-render", "scene-render"],
    implementation: "src/renderer/node/render.ts#renderTimelineVideo",
    tests: ["tests/render/video.test.ts"],
    status: "implemented",
    confidence: "high",
    cost: 6,
  },
  {
    id: "render.video-check",
    version: 1,
    domain: "render",
    title: "Verificarea video-ului randat: cadre negre, flash-uri, înghețări",
    inputs: ["full-render"],
    outputs: ["critique"],
    implementation: "src/renderer/node/analyze-video.ts#analyzeVideo",
    tests: ["tests/render/video.test.ts"],
    status: "implemented",
    confidence: "high",
    cost: 3,
  },
  // ─── critică și calitate
  {
    id: "critique.auto",
    version: 1,
    domain: "critique",
    title: "Critica automată cu rubrica fixă (rubric-v1), fiecare depunctare ca problemă structurată",
    inputs: ["timeline", "brief", "mix"],
    outputs: ["critique"],
    outputSchema: "CritiqueRound",
    implementation: "src/critique/auto.ts#autoCritique",
    tests: ["tests/unit/quality.test.ts"],
    status: "implemented",
    confidence: "medium",
    cost: 1,
  },
  {
    id: "critique.pixel",
    version: 1,
    domain: "critique",
    title: "Criticul pe pixeli: contrast real, spațiu gol, compoziție, aglomerare, culorile brandului (cadre-cheie din cache)",
    inputs: ["stills", "timeline"],
    outputs: ["critique"],
    implementation: "src/critique/pixel.ts#analyzeSample",
    tests: ["tests/unit/quality.test.ts"],
    status: "implemented",
    confidence: "medium",
    cost: 3,
  },
  {
    id: "critique.visual-pack",
    version: 1,
    domain: "critique",
    title: "Pachetul de revizuire vizuală pentru criticul multimodal (Claude): cadre-cheie, foaie de contact, schema răspunsului",
    inputs: ["stills", "timeline", "quality"],
    outputs: ["critique"],
    implementation: "src/critique/pack.ts#critiquePack",
    tests: [],
    status: "partial",
    confidence: "medium",
    cost: 3,
    notes: "Verificat manual pe proiectul demo (revizuire claude-visual); fără test automat al pachetului.",
  },
  {
    id: "critique.review",
    version: 1,
    domain: "critique",
    title: "Observațiile lui Claude / ale utilizatorului (secunda X → cadru, scenă), validate strict",
    inputs: ["timeline"],
    outputs: ["critique"],
    implementation: "src/pipeline/iterate.ts#addReview",
    tests: [],
    status: "partial",
    confidence: "high",
    cost: 0,
    notes: "Verificat manual (mms review).",
  },
  {
    id: "quality.loop",
    version: 1,
    domain: "quality",
    title: "Bucla de calitate adaptivă: 10 pase, metoda cea mai ieftină permisă de adâncime, cache pe amprente",
    inputs: ["timeline", "mix", "brief", "research", "assets", "brand", "script", "storyboard"],
    outputs: ["quality", "critique", "stills", "scene-render", "full-render"],
    outputSchema: "CritiqueRound",
    implementation: "src/quality/run.ts#runQuality",
    tests: ["tests/integration/pipeline.test.ts"],
    status: "implemented",
    confidence: "high",
    cost: 3,
  },
  {
    id: "quality.autofix",
    version: 1,
    domain: "quality",
    title: "Corecturi automate sigure, cu verificare doar a ce s-a schimbat și rollback",
    inputs: ["quality", "storyboard"],
    outputs: ["storyboard"],
    implementation: "src/quality/autofix.ts#autoFixLoop",
    tests: [],
    status: "partial",
    confidence: "medium",
    cost: 4,
    notes:
      "Rulat cap-coadă pe proiectul demo (npm run e2e -- --autofix); fără test automat dedicat pentru rollback (rollback-ul de versiune e testat în integrare).",
  },
  {
    id: "quality.impact",
    version: 1,
    domain: "quality",
    title: "Motorul de impact: amprente pe artefacte și scene, diferența dintre versiuni, planul minim de lucru",
    inputs: ["storyboard", "script", "timeline", "mix"],
    outputs: ["quality"],
    implementation: "src/pipeline/impact.ts#planImpact",
    tests: ["tests/unit/quality.test.ts", "tests/integration/pipeline.test.ts"],
    status: "implemented",
    confidence: "high",
    cost: 0,
  },
  {
    id: "editing.ops",
    version: 1,
    domain: "editing",
    title: "Operațiile de editare pe storyboard (editor, corecturi automate)",
    inputs: ["storyboard"],
    outputs: ["storyboard"],
    implementation: "src/editing/ops.ts#applyEditOps",
    tests: ["tests/unit/quality.test.ts"],
    status: "implemented",
    confidence: "high",
    cost: 0,
  },
  {
    id: "editing.history",
    version: 1,
    domain: "editing",
    title: "Undo / redo pe jurnalul de operații și snapshot-uri",
    inputs: ["storyboard"],
    outputs: ["storyboard"],
    implementation: "src/editing/history.ts#applyEdit",
    tests: ["tests/integration/pipeline.test.ts"],
    status: "implemented",
    confidence: "high",
    cost: 0,
  },
  {
    id: "quality.score",
    version: 1,
    domain: "quality",
    title: "Scorul de calitate quality-v1: 11 categorii 0–100, verdict PASS/POLISH/FIX/FAIL",
    inputs: ["critique"],
    outputs: ["quality"],
    outputSchema: "QualityScore",
    implementation: "src/quality/score.ts#scoreQuality",
    tests: ["tests/unit/quality.test.ts"],
    status: "implemented",
    confidence: "high",
    cost: 0,
  },
  // ─── platformă și export
  {
    id: "platform.safe-zones",
    version: 1,
    domain: "platform",
    title: "Formate, zone sigure și zone excluse pe platformă (cu sursă și încredere)",
    inputs: ["brief"],
    outputs: ["timeline"],
    implementation: "src/core/formats.ts#resolveSafeZone",
    tests: ["tests/unit/core.test.ts"],
    status: "implemented",
    confidence: "medium",
    cost: 0,
  },
  {
    id: "export.final",
    version: 1,
    domain: "export",
    title: "Exportul final, doar cu „render final”, fără blocaje, cu mix „ok”, fără suprascriere",
    inputs: ["timeline", "mix", "quality"],
    outputs: ["export"],
    implementation: "src/pipeline/steps.ts#stepFinalRender",
    tests: ["tests/integration/studio-lint.test.ts"],
    status: "implemented",
    confidence: "high",
    cost: 6,
  },
  {
    id: "export.post-pack",
    version: 1,
    domain: "export",
    title: "Pachetul de postare (copertă + text din replicile aprobate)",
    inputs: ["timeline", "script", "brief"],
    outputs: ["export"],
    implementation: "src/pipeline/steps.ts#writePostPack",
    tests: [],
    status: "partial",
    confidence: "medium",
    cost: 3,
    notes: "Verificat manual (mms post-pack); fără test automat.",
  },
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
      if (c.inputs.some((i) => out.has(i))) for (const o of c.outputs) if (!out.has(o)) out.add(o), (grew = true);
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
