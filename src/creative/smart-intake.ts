/**
 * Intake inteligent: din cererea utilizatorului (URL, viziune, format, limbă, durată) și din pagina reală,
 * se deduce tot ce se poate deduce sigur, cu sursa și încrederea fiecărui răspuns. Rămân de întrebat doar
 * lucrurile incerte care schimbă material rezultatul (sau cele cerute de reguli: drepturile, limba,
 * aprobarea). Toate grupele A–H rămân acoperite (regula 10): răspunsurile deduse se arată utilizatorului,
 * care le poate schimba înainte de „aprob”.
 */
import type { PageData } from "../capture/capture";
import { MmsError } from "../core/errors";
import { FORMAT_PRESETS, makeFormat, type FormatPresetId } from "../core/formats";
import type { BriefInput, CreativeDirection, FormatSpec, Platform, ProductCategory } from "../core/schema";
import type { CreateProjectOptions } from "../projects/store";
import { DIRECTIONS } from "./directions";
import { CTA_PLACEHOLDER } from "./script";
import { INTAKE_QUESTIONS } from "./intake";
import { PLATFORM_PROFILES } from "../platform/profiles";

export interface IntakeRequest {
  url?: string;
  /** viziunea utilizatorului, cuvânt cu cuvânt */
  vision?: string;
  /** formatele cerute (9x16, 16x9, 1x1, 4x5) */
  formats?: string[];
  platforms?: Platform[];
  textLanguage?: string | null;
  voiceLanguage?: string | null;
  durationSec?: number;
  references?: string[];
  /** vocile disponibile pe calculator (provider + limbă), pentru alegerea vocii */
  voices?: Array<{ provider: string; name: string; language: string }>;
}

export type AnswerSource = "user" | "site" | "inferred" | "default";

export interface IntakeAnswer {
  id: string;
  question: string;
  value: string;
  source: AnswerSource;
  confidence: "high" | "medium" | "low";
  why: string;
}

export interface IntakeQuestionToAsk {
  id: string;
  question: string;
  options?: string[];
  suggestion?: string;
  why: string;
}

export interface IntakeResult {
  project: { name: string; url?: string; category: ProductCategory; formats: string[]; language: { text: string | null; voice: string | null } };
  brief: BriefInput;
  answers: IntakeAnswer[];
  ask: IntakeQuestionToAsk[];
}

const q = (id: string) => INTAKE_QUESTIONS.find((x) => x.id === id)?.text ?? id;

/**
 * Categoria produsului din semnalele de pe pagină, cu greutăți: titlul, descrierea și titlurile de secțiune
 * cântăresc de 3 ori mai mult decât textul. Câștigă categoria cu cel mai mare scor (minimum 2). Astfel un
 * site care pomenește „AI” o dată, într-o funcție secundară, nu devine „produs AI”.
 */
function guessCategory(prominent: string, body: string): { category: ProductCategory; why: string } {
  const rules: Array<[ProductCategory, RegExp[], string]> = [
    // „AI” doar cu majuscule (în română „ai” e verb) sau în expresii clare
    ["ai-product", [/\bAI\b|\bGPT\b|\bLLM\b/g, /inteligen[țt][ăa] artificial[ăa]|machine learning|ai-powered|copilot/gi], "termeni AI pe pagină"],
    ["developer-tool", [/\b(api|sdk|cli|developer|devops|github|deploy)\b/gi], "termeni pentru dezvoltatori pe pagină"],
    ["mobile-app", [/(app store|google play|descarc[ăa] aplica[țt]ia|download the app)/gi], "trimiteri spre magazinele de aplicații"],
    ["desktop-app", [/(download for (mac|windows)|descarc[ăa] pentru (mac|windows))/gi], "descărcare pentru desktop"],
    ["ecommerce", [/\b(co[șs]|cart|checkout|livrare|shipping|magazin)\b/gi], "termeni de comerț"],
    ["fintech", [/\b(factur|plat[ăa]|banc|invest|wallet|fintech)/gi], "termeni financiari"],
    [
      "saas",
      [/\b(echip[ăa]|team|workspace|dashboard|abonament|plan(uri)?|plans|pricing|sarcini|tasks|proiecte|analytics|free trial|subscription)\b/gi],
      "termeni de produs software pe abonament",
    ],
  ];
  const count = (t: string, res: RegExp[]) => res.reduce((n, re) => n + (t.match(re)?.length ?? 0), 0);
  const scored = rules.map(([category, res, why]) => ({ category, why, score: 3 * count(prominent, res) + count(body, res) }));
  const best = scored.reduce((a, b) => (b.score > a.score ? b : a));
  if (best.score < 2) return { category: "website", why: "nu am găsit semnale clare; categoria generală" };
  return {
    category: best.category,
    why: `${best.why} (scor ${best.score}${scored
      .filter((x) => x !== best && x.score > 0)
      .map((x) => `; ${x.category} ${x.score}`)
      .join("")})`,
  };
}

function guessObjective(buttons: string[], vision: string): { objective: BriefInput["objective"]; why: string } {
  const all = `${buttons.join(" ")} ${vision}`.toLowerCase();
  if (/lans|launch|nou(a|ă)? (versiune|funcți)/.test(all)) return { objective: "launch", why: "viziunea sau pagina vorbesc despre o lansare" };
  if (/descarc|download|instaleaz|install/.test(all)) return { objective: "downloads", why: "butoanele cer descărcarea" };
  if (/cump[ăa]r|buy|shop|comand/.test(all)) return { objective: "sales", why: "butoanele cer cumpărarea" };
  if (/[îi]ncearc|try|start|[îi]ncepe|sign ?up|cont nou|creeaz[ăa] cont|gratuit|free/.test(all))
    return { objective: "signups", why: "butoanele cer înscrierea / încercarea" };
  return { objective: "awareness", why: "fără un buton de conversie clar" };
}

function guessDirection(vision: string): { direction: CreativeDirection | null; why: string } {
  const v = vision.toLowerCase();
  const rules: Array<[RegExp, CreativeDirection]> = [
    [/premium|cinematic|elegant|luxos|rafinat/, "premium"],
    [/emo[țt]ional|cald|uman|poveste/, "emotional"],
    [/agresiv|puternic|[șs]ocant|provoc/, "aggressive"],
    [/tehnic|precis|developer/, "technical"],
    [/minimal|simplu|curat|aerisit/, "minimal"],
    [/energic|dinamic|alert|vesel|social|tiktok/, "energetic"],
  ];
  for (const [re, d] of rules) if (re.test(v)) return { direction: d, why: `cuvinte din viziune („${v.match(re)![0]}”)` };
  return { direction: null, why: "viziunea nu indică un stil; propun concepte (A–F) și aleg după scor" };
}

/** Frazele citate în viziune („…” sau "…") sunt, cel mai probabil, fraze obligatorii, exacte. */
function quotedPhrases(vision: string): string[] {
  return [...vision.matchAll(/[„"«]([^"”»]{3,140})["”»]/g)].map((m) => m[1].trim());
}

const PLATFORM_FOR_FORMAT: Record<string, Platform> = { "9x16": "tiktok", "16x9": "youtube", "1x1": "feed", "4x5": "feed" };

export function inferIntake(req: IntakeRequest, page: PageData | null): IntakeResult {
  const answers: IntakeAnswer[] = [];
  const ask: IntakeQuestionToAsk[] = [];
  const vision = (req.vision ?? "").trim();
  const A = (id: string, value: string, source: AnswerSource, confidence: IntakeAnswer["confidence"], why: string) =>
    answers.push({ id, question: q(id), value, source, confidence, why });
  const Q = (id: string, why: string, o: { options?: string[]; suggestion?: string } = {}) => ask.push({ id, question: q(id), why, ...o });

  // A. produs și obiectiv
  const host = req.url ? new URL(req.url).hostname.replace(/^www\./, "") : "";
  const name = page?.og["og:site_name"] || (page?.title.split(/\s[|–—-]\s/)[0] ?? "").trim() || host.split(".")[0] || "Produs";
  A(
    "a1",
    `${name}${req.url ? ` · ${req.url}` : ""}`,
    page ? "site" : "user",
    page ? "medium" : "high",
    page ? "numele din titlul / og:site_name al paginii" : "din cerere",
  );
  const prominent = page
    ? `${page.title} ${page.description} ${page.headings
        .filter((h) => h.level <= 3)
        .map((h) => h.text)
        .join(" ")}`
    : vision;
  const cat = guessCategory(prominent, page ? page.fullText.slice(0, 12000) : "");
  A("a2", cat.category, "inferred", cat.category === "website" ? "low" : "medium", cat.why);
  // butoanele paginii; dacă nu se recunoaște niciunul, linkurile scurte de acțiune (pe multe site-uri CTA-ul e un link)
  const actionLink = /[îi]ncearc|try|start|[îi]ncepe|sign ?up|[îi]nscrie|creeaz[ăa] cont|get started|free trial|descarc|download|cump[ăa]r|buy|demo/i;
  const buttons = page?.buttons.length
    ? page.buttons
    : [...new Set((page?.links ?? []).map((l) => l.text).filter((t) => t && t.split(/\s+/).length <= 5 && actionLink.test(t)))];
  const obj = guessObjective(buttons, vision);
  A("a3", obj.objective, "inferred", "medium", obj.why);
  if (page?.description)
    Q("a4", "Publicul și durerea lui schimbă hook-ul și problema; nu le pot deduce sigur din site.", {
      suggestion: `Pe site: „${page.description.slice(0, 140)}”`,
    });
  else Q("a4", "Publicul și durerea lui schimbă hook-ul și problema.");
  // preferința: încercare / înscriere (expresii clare), apoi „gratuit”, apoi descărcare / cumpărare / demo;
  // butonul de login vine ultimul. Un CTA are cel mult 5 cuvinte.
  const prefs = [
    /[îi]ncearc|\btry\b|\bstart|get started|[îi]ncepe|sign ?up|[îi]nscrie|creeaz[ăa] cont|free trial|perioad[ăa] de prob/i,
    /gratuit|\bfree\b/i,
    /descarc|download|cump[ăa]r|\bbuy\b|demo|rezerv/i,
    /\bcont\b|log ?in|autentific/i,
  ];
  const ctaCandidates = buttons.filter((b) => b.split(/\s+/).length <= 5);
  const cta = prefs.map((re) => ctaCandidates.find((b) => re.test(b))).find(Boolean) ?? ctaCandidates[0];
  Q("a5", "Textul CTA apare cuvânt cu cuvânt pe cardul final; îl confirm cu tine.", cta ? { suggestion: `Butonul de pe site: „${cta}”` } : {});
  A("a6", "nimic în plus față de regulile studioului", "default", "high", "fără interdicții declarate");
  // B. platformă și format
  const formats = req.formats?.length ? req.formats : ["9x16"];
  const platforms = req.platforms?.length ? req.platforms : [...new Set(formats.map((f) => PLATFORM_FOR_FORMAT[f.replace(/-4k$/, "")] ?? "generic"))];
  A(
    "b1",
    platforms.join(", "),
    req.platforms?.length ? "user" : "inferred",
    req.platforms?.length ? "high" : "medium",
    req.platforms?.length ? "din cerere" : "din format (9:16 → zonele TikTok, cele mai stricte; acoperă și Reels/Shorts)",
  );
  A(
    "b2",
    formats.join(", "),
    req.formats?.length ? "user" : "default",
    req.formats?.length ? "high" : "low",
    req.formats?.length ? "din cerere" : "implicit vertical",
  );
  const duration = req.durationSec ?? 30;
  A("b3", `${duration} s @ 30 fps`, req.durationSec ? "user" : "default", req.durationSec ? "high" : "low", req.durationSec ? "din cerere" : "30 s implicit");
  // C. poveste și creativ
  if (vision) A("c1", vision, "user", "high", "viziunea ta, păstrată cuvânt cu cuvânt (regula 14)");
  else Q("c1", "Fără o idee a ta, propun 3 concepte din dovezi; spune dacă ai o poveste sau un hook.", { options: ["am o idee (o scriu)", "propune-mi 3"] });
  const phrases = quotedPhrases(vision);
  if (phrases.length) Q("c2", "Frazele dintre ghilimele par fraze obligatorii, exacte; le confirm.", { suggestion: phrases.map((p) => `„${p}”`).join(", ") });
  else A("c2", "niciuna", "default", "medium", "nu există fraze citate în viziune");
  const dir = guessDirection(vision);
  A(
    "c3",
    dir.direction ? `${DIRECTIONS[dir.direction].letter} – ${DIRECTIONS[dir.direction].label}` : "propune-mi 3 (concepte cu scor)",
    dir.direction ? "inferred" : "default",
    dir.direction ? "medium" : "high",
    dir.why,
  );
  const pacing = dir.direction ? DIRECTIONS[dir.direction].pacing : "medium";
  A("c4", pacing, "inferred", "medium", dir.direction ? "ritmul direcției" : "ritm mediu până la alegerea conceptului");
  A("c5", "efecte medii · 3D permis · fără chipuri", "default", "medium", "implicit; chipurile doar cu materialele tale (regula 2)");
  A(
    "c6",
    req.references?.length ? `${req.references.length} referințe` : "fără referințe",
    req.references?.length ? "user" : "default",
    "high",
    req.references?.length ? "le analizez structural (Reference DNA)" : "—",
  );
  // D. materiale
  A("d1", "capturi reale automate din site + logo din pagină", "inferred", "medium", "nu ai dat materiale; le capturez (regula 1: interfața doar reală)");
  A(
    "d2",
    "da, fără autentificare",
    page ? "inferred" : "default",
    page ? "high" : "low",
    page ? "pagina s-a încărcat fără cont" : "presupus până la prima captură",
  );
  const featureHeads = page
    ? page.headings
        .filter((h) => h.level >= 2 && h.text.length < 60)
        .slice(0, 4)
        .map((h) => h.text)
    : [];
  if (featureHeads.length) A("d3", featureHeads.join(" → "), "site", "low", "titlurile secțiunilor de pe site, în ordine (le poți reordona)");
  else Q("d3", "Ce funcții să arăt, în ordinea importanței? (nu le-am găsit pe pagină)");
  A("d4", "se decide după captură, doar dacă apar date personale", "default", "high", "detecția rulează la captură");
  Q("d5", "Capturile, logo-ul și textele site-ului sunt materialele cuiva: ai dreptul să le folosești? (regula 3)", {
    options: ["da, e produsul meu / am drept", "nu", "nu știu"],
  });
  // E. text și limbă (fără valoare implicită, regula 16)
  if (req.textLanguage) A("e1", req.textLanguage, "user", "high", "din cerere");
  else Q("e1", "Limba textului nu are valoare implicită (regula 16).");
  if (req.voiceLanguage ?? req.textLanguage)
    A(
      "e2",
      (req.voiceLanguage ?? req.textLanguage)!,
      req.voiceLanguage ? "user" : "inferred",
      req.voiceLanguage ? "high" : "medium",
      req.voiceLanguage ? "din cerere" : "aceeași cu limba textului",
    );
  else Q("e2", "Limba vocii nu are valoare implicită (regula 16).");
  const soundOff = platforms.some((p) => PLATFORM_PROFILES[p]?.soundOff !== "low");
  A("e3", "arse + .srt", "inferred", "medium", soundOff ? "platforma se vede des fără sunet" : "accesibilitate și vizionare fără sunet");
  A("e4", "din site (culori CSS, fonturi apropiate din biblioteca liberă)", "inferred", "medium", "brand kit dedus la captură");
  A("e5", "cifrele și prețurile intră în „de confirmat”", "default", "high", "regula 5");
  // F. audio
  const lang = (req.voiceLanguage ?? req.textLanguage ?? "").toLowerCase();
  const voice = req.voices?.find((v) => lang && v.language.toLowerCase().startsWith(lang));
  if (voice)
    A(
      "f1",
      `TTS ${voice.provider}: ${voice.name}`,
      "inferred",
      "medium",
      "vocea locală pentru limba aleasă (drepturile comerciale ale vocilor de sistem nu sunt clare: docs/LICENTE.md)",
    );
  else
    Q("f1", "Nu am o voce locală pentru limba aleasă: fișierul tău, o cheie API sau fără voce?", {
      options: ["vocea mea (fișier)", "TTS cu cheie API", "fără voce"],
    });
  A("f2", "muzică originală sintetizată pe structura reclamei", "default", "high", "fără licențe externe");
  A("f4", dir.direction ? DIRECTIONS[dir.direction].sfxDensity : "medium", "inferred", "medium", "densitatea direcției");
  A("f5", "nu", "default", "medium", "fără tăceri intenționate cerute");
  A("f6", "fără", "default", "medium", "la cerere; se judecă la ascultare");
  A("f7", "da (recomandat)", "default", "high", "vocea uniformă, aceeași balanță cu muzica; se judecă la ascultare");
  // G. livrare
  A("g1", "nu", "default", "medium", "la cerere");
  A("g2", "0", "default", "medium", "la cerere");
  A("g3", "până trece pragul (95/100, 8/10 pe scenă)", "default", "high", "bucla de calitate adaptivă");
  // H
  Q("h1", "Lucrul începe doar după „aprob” (regula 10).");

  const language = { text: req.textLanguage ?? null, voice: req.voiceLanguage ?? req.textLanguage ?? null };
  const brief: BriefInput = {
    schemaVersion: 1,
    objective: obj.objective,
    audience: { description: page?.description || "de confirmat", painPoints: [] },
    userVision: {
      story: vision,
      hooks: [],
      mandatoryPhrases: phrases.map((p, i) => ({ id: `fraza-${i + 1}`, text: p, channel: "any" as const })),
      roughScript: "",
      concept: "",
    },
    tone: [],
    desiredEmotion: "",
    pacing,
    direction: dir.direction,
    visual: { effectsLevel: "medium", forbiddenCapabilities: [], allow3d: true, faces: false, notes: "" },
    cta: { text: cta ?? CTA_PLACEHOLDER, url: req.url },
    platforms,
    durationSec: duration,
    audio: {
      voice: voice ? { mode: "tts", provider: voice.provider, voiceId: voice.name, rate: 1 } : { mode: "none", rate: 1 },
      music: { mode: "synth", mood: dir.direction ? DIRECTIONS[dir.direction].mood : "driving" },
      sfxDensity: dir.direction ? DIRECTIONS[dir.direction].sfxDensity : "medium",
      intentionalSilence: false,
      voiceCompression: true,
      ambience: "none",
    },
    captions: { burnIn: true, srt: true },
  };
  return { project: { name, url: req.url, category: cat.category, formats, language }, brief, answers, ask };
}

/**
 * Datele proiectului din rezultatul intake-ului. Fiecare format primește platforma potrivită lui: prima
 * platformă din brief care îl recomandă (9:16 → TikTok/Reels/Shorts, 16:9 → YouTube…), altfel cea implicită
 * a formatului. Astfel un 16:9 nu primește zonele sigure ale unei platforme verticale.
 */
export function projectFromIntake(id: string, r: IntakeResult, o: { fps?: number } = {}): CreateProjectOptions {
  const formats: FormatSpec[] = r.project.formats.map((f) => {
    const base = f.replace(/-4k$/, "");
    if (!(f in FORMAT_PRESETS))
      throw new MmsError("FORMAT_INVALID", `Format necunoscut în intake: ${f}`, `Formatele disponibile: ${Object.keys(FORMAT_PRESETS).join(", ")}`);
    const platform = r.brief.platforms?.find((p) => PLATFORM_PROFILES[p]?.aspects.includes(base)) ?? PLATFORM_FOR_FORMAT[base] ?? "generic";
    return makeFormat(f as FormatPresetId, { platform, durationSec: r.brief.durationSec ?? 30, fps: o.fps ?? 30 });
  });
  return {
    id,
    name: r.project.name,
    product: { name: r.project.name, url: r.project.url, category: r.project.category },
    formats,
    language: r.project.language,
  };
}

/** Rezumatul pentru utilizator: ce am dedus (cu sursa) și ce întreb, grupat A–H. */
export function intakeSummaryMarkdown(r: IntakeResult): string {
  const label: Record<AnswerSource, string> = { user: "de la tine", site: "de pe site", inferred: "dedus", default: "implicit" };
  const out = ["## Ce am înțeles (poți schimba orice înainte de „aprob”)", ""];
  for (const a of r.answers) out.push(`- **${a.id.toUpperCase()}** ${a.question} → **${a.value}** _(${label[a.source]}, încredere ${a.confidence}: ${a.why})_`);
  out.push("", `## Ce te întreb (${r.ask.length})`, "");
  for (const x of r.ask)
    out.push(
      `- **${x.id.toUpperCase()}** ${x.question}${x.options ? ` Variante: ${x.options.join(" · ")}.` : ""}${x.suggestion ? ` Propunere: ${x.suggestion}.` : ""} _(${x.why})_`,
    );
  return out.join("\n");
}
