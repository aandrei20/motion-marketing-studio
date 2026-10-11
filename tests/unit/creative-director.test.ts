/**
 * Directorul creativ (concepte din dovezi, scor pe 10 criterii, prioritatea ideii utilizatorului)
 * și intake-ul inteligent (deduce ce se poate, întreabă doar ce e incert și important).
 */
import { describe, expect, it } from "vitest";
import { Brief, CONCEPT_CRITERIA, Research, type AssetManifest } from "../../src/core/schema";
import { generateConcepts, selectConcept, territories, type ConceptContext } from "../../src/creative/concepts";
import { inferIntake, projectFromIntake } from "../../src/creative/smart-intake";
import type { PageData } from "../../src/capture/capture";

const brief = (o: Partial<Brief["userVision"]> = {}, pains: string[] = ["Pierzi ore în ședințe"]) =>
  Brief.parse({
    schemaVersion: 1,
    objective: "signups",
    audience: { description: "manageri", painPoints: pains },
    userVision: { story: "", hooks: [], ...o },
    pacing: "medium",
    direction: null,
    visual: {},
    cta: { text: "Încearcă gratuit" },
    platforms: ["tiktok"],
    durationSec: 24,
    audio: { voice: { mode: "none" }, music: { mode: "synth" } },
  });
const research = Research.parse({
  schemaVersion: 1,
  sources: [{ id: "s1", kind: "official-site", title: "x", fetchedAt: "2026-10-08T00:00:00Z", contentHash: "h", reliability: "official" }],
  claims: [
    { id: "c-poz", text: "Planifică săptămâna în 5 minute", kind: "fact", category: "positioning", sourceIds: ["s1"], quote: "Planifică săptămâna în 5 minute", confidence: "high", status: "approved-by-user", checkedAt: "2026-10-08" },
    { id: "c-f1", text: "Căutare instantă: găsești orice", kind: "fact", category: "feature", sourceIds: ["s1"], confidence: "medium", status: "verified", checkedAt: "2026-10-08" },
    { id: "c-f2", text: "Kanban: muți sarcinile", kind: "fact", category: "feature", sourceIds: ["s1"], confidence: "medium", status: "verified", checkedAt: "2026-10-08" },
  ],
});
const assets = { schemaVersion: 1, assets: [{ id: "shot", role: "screenshot", showsProductUI: true }, { id: "logo", role: "logo" }, { id: "rec", role: "screen-recording" }] } as unknown as AssetManifest;
const ctx = (b = brief()): ConceptContext => ({ project: { product: { name: "Produs", category: "saas" }, formats: [], platformOverrides: {} }, brief: b, research, assets, hasBrand: true });

describe("directorul creativ", () => {
  it("propune teritorii doar cu dovezi", () => {
    const t = territories(ctx()).map((x) => x.territory);
    expect(t).toEqual(expect.arrayContaining(["problem-solution", "speed-proof", "feature-tour", "demo-first"]));
    expect(t).not.toContain("user-concept");
    const noPain = territories(ctx(brief({}, []))).map((x) => x.territory);
    expect(noPain).not.toContain("problem-solution");
  });
  it("fiecare concept are scor pe cele 10 criterii, cu explicație, și total 0–100", () => {
    for (const c of generateConcepts(ctx())) {
      for (const k of CONCEPT_CRITERIA) {
        expect(c.scores[k]?.value, `${c.id}.${k}`).toBeGreaterThanOrEqual(0);
        expect(c.scores[k]?.why.length).toBeGreaterThan(3);
      }
      expect(c.total).toBeGreaterThan(0);
      expect(c.total).toBeLessThanOrEqual(100);
      // hook-ul e fie cuvintele utilizatorului, fie un citat de pe site, niciodată inventat
      expect(["user-verbatim", "site-quote"]).toContain(c.hook.origin);
    }
  });
  it("ideea utilizatorului are prioritate (regula 14); fără ea câștigă scorul cel mai mare", () => {
    const withUser = generateConcepts(ctx(brief({ story: "Managerul își recapătă lunea." })));
    expect(selectConcept(withUser).id).toBe("c-user-concept");
    expect(withUser.find((c) => c.id === "c-user-concept")!.bigIdea).toBe("Managerul își recapătă lunea.");
    const auto = generateConcepts(ctx());
    const best = [...auto].sort((a, b) => b.total - a.total)[0];
    expect(selectConcept(auto).id).toBe(best.id);
  });
  it("hook-ul utilizatorului se folosește cuvânt cu cuvânt", () => {
    const cs = generateConcepts(ctx(brief({ hooks: ["Încă o ședință de o oră?"] })));
    expect(cs.every((c) => c.hook.text === "Încă o ședință de o oră?" && c.hook.origin === "user-verbatim")).toBe(true);
  });
});

const page = {
  url: "https://exemplu.test/",
  title: "Planner – Planifică săptămâna",
  description: "Planner adună sarcinile echipei într-un singur loc.",
  og: { "og:site_name": "Planner" },
  headings: [{ level: 1, text: "Planifică săptămâna în 5 minute" }, { level: 2, text: "Căutare instantă" }, { level: 2, text: "Focusul zilei" }],
  paragraphs: [],
  listItems: [],
  links: [],
  buttons: ["Intră în cont", "Încearcă gratuit"],
  colors: { backgrounds: [], texts: [], accents: [] },
  fonts: [],
  cssVars: {},
  times: [],
  fullText: "Ai văzut ce contează azi? Echipa ta, sarcini, abonament lunar.",
} as unknown as PageData;

describe("intake-ul inteligent", () => {
  it("deduce din site și din cerere, cu sursa și încrederea fiecărui răspuns", () => {
    const r = inferIntake({ url: page.url, vision: "Vreau ceva energic, cu fraza „Planifică săptămâna în 5 minute”", formats: ["9x16"], textLanguage: "ro", durationSec: 30 }, page);
    const a = Object.fromEntries(r.answers.map((x) => [x.id, x]));
    expect(r.project.name).toBe("Planner");
    // „ai” (verbul) nu înseamnă „AI”
    expect(r.project.category).toBe("saas");
    expect(a.a3.value).toBe("signups");
    expect(a.c3.value).toMatch(/Energic/);
    expect(a.c1.source).toBe("user");
    expect(a.e2.value).toBe("ro");
    // fraza citată devine frază obligatorie propusă (de confirmat), CTA-ul propus e încercarea, nu login-ul
    expect(r.brief.userVision!.mandatoryPhrases![0].text).toBe("Planifică săptămâna în 5 minute");
    expect(r.ask.find((x) => x.id === "a5")!.suggestion).toMatch(/Încearcă gratuit/);
  });
  it("întreabă doar ce e incert și important, plus regulile: drepturi, limbă, aprobare", () => {
    const r = inferIntake({ url: page.url, vision: "ceva calm", formats: ["9x16"], textLanguage: "ro" }, page);
    const ids = r.ask.map((x) => x.id);
    expect(ids).toEqual(expect.arrayContaining(["a4", "a5", "d5", "h1"]));
    expect(ids.length).toBeLessThanOrEqual(6);
    // fără limbă: se întreabă (regula 16, fără valoare implicită)
    const noLang = inferIntake({ url: page.url, formats: ["9x16"] }, page);
    expect(noLang.ask.map((x) => x.id)).toEqual(expect.arrayContaining(["e1", "e2"]));
    expect(noLang.project.language.text).toBeNull();
  });
  it("categoria vine din semnalele importante, nu dintr-o mențiune izolată; CTA-ul poate fi un link", () => {
    const p: PageData = { ...page, title: "Metrics – Simple web analytics", description: "Privacy-friendly analytics with a clean dashboard and simple plans.", headings: [{ level: 1, text: "Simple analytics dashboard" }, { level: 3, text: "Pricing plans" }], fullText: "Simple analytics dashboard. See traffic from AI tools. Pricing plans for every team.", buttons: [], links: [{ text: "Start free trial", href: "https://x.test/register" }, { text: "Blog", href: "https://x.test/blog" }] };
    const r = inferIntake({ url: "https://x.test/", formats: ["9x16"], textLanguage: "en" }, p);
    expect(r.project.category).toBe("saas");
    expect(r.brief.cta!.text).toBe("Start free trial");
    expect(r.answers.find((a) => a.id === "a3")!.value).toBe("signups");
  });
  it("proiectul din intake dă fiecărui format platforma lui (16:9 nu primește zonele unei platforme verticale)", () => {
    const r = inferIntake({ url: page.url, formats: ["9x16", "16x9"], textLanguage: "ro", voiceLanguage: "ro", durationSec: 20 }, page);
    const p = projectFromIntake("test", r);
    expect(p.formats.map((x) => [x.id, x.platform])).toEqual([["9x16", "tiktok"], ["16x9", "youtube"]]);
    expect(p.formats.every((x) => x.durationSec === 20 && x.fps === 30)).toBe(true);
    // platformele cerute explicit au prioritate, tot pe formatul potrivit
    const reels = projectFromIntake("test", inferIntake({ url: page.url, formats: ["16x9", "9x16"], platforms: ["reels", "youtube"], textLanguage: "ro" }, page));
    expect(reels.formats.map((x) => x.platform)).toEqual(["youtube", "reels"]);
  });
});
