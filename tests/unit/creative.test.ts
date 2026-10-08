import { describe, expect, it } from "vitest";
import { Brief, Research, Script, type Claim } from "../../src/core/schema";
import { DIRECTIONS, suggestDirections } from "../../src/creative/directions";
import { draftScript, validateScript } from "../../src/creative/script";
import { chooseTemplate, listTemplates } from "../../src/creative/templates";
import { chooseTransition, readingSec, sceneDuration } from "../../src/editing/grammar";
import { parseCommand } from "../../src/iterate/intents";
import { extractFromPage } from "../../src/research/extract";
import type { PageData } from "../../src/capture/capture";
import { RECIPES } from "../../src/recipes/recipes";

const brief = Brief.parse({
  schemaVersion: 1,
  objective: "signups",
  audience: { description: "echipe mici", painPoints: ["Prea multe ședințe."] },
  userVision: { hooks: ["Încă o ședință?"], mandatoryPhrases: [{ id: "p1", text: "în 5 minute" }] },
  pacing: "fast",
  direction: "energetic",
  visual: {},
  cta: { text: "Încearcă gratuit" },
  platforms: ["tiktok"],
  durationSec: 20,
  audio: { voice: { mode: "none" }, music: { mode: "synth" } },
});

const claim = (p: Partial<Claim> & Pick<Claim, "id" | "text" | "status">): Claim => ({ kind: "fact", category: "feature", sourceIds: ["s1"], confidence: "medium", checkedAt: "2026-10-08", notes: "", ...p });

describe("research", () => {
  const page: PageData = {
    url: "https://exemplu.ro/",
    title: "Produs",
    description: "Planificare simplă pentru echipe.",
    og: {},
    headings: [
      { level: 1, text: "Planifică în 5 minute" },
      { level: 3, text: "Căutare instantă" },
      { level: 3, text: "Echipă" },
    ],
    paragraphs: ["Folosit de 10.000 de echipe din toată lumea în fiecare zi."],
    listItems: [],
    links: [{ text: "Prețuri", href: "https://exemplu.ro/preturi" }],
    buttons: [],
    colors: { backgrounds: [], texts: [], accents: [] },
    fonts: [],
    cssVars: {},
    times: [],
    fullText: "Planifică în 5 minute\nCăutare instantă\nGăsești orice sarcină tastând câteva litere.\nEchipă\n8 €\nper utilizator pe lună, facturat anual\nFolosit de 10.000 de echipe din toată lumea în fiecare zi.",
  };
  const r = extractFromPage(page, { capturedAt: "2026-10-08T00:00:00Z" });
  it("citează sursa și separă cifrele în „de confirmat”", () => {
    expect(r.source.reliability).toBe("official");
    const pos = r.claims.find((c) => c.category === "positioning" && c.text.includes("5 minute"))!;
    expect(pos.status).toBe("needs-confirmation");
    const feat = r.claims.find((c) => c.text.startsWith("Căutare instantă"))!;
    expect(feat.status).toBe("verified");
    expect(feat.quote).toContain("Găsești orice sarcină");
    expect(r.claims.some((c) => c.category === "pricing" && c.status === "needs-confirmation")).toBe(true);
    expect(r.claims.some((c) => c.text.startsWith("Echipă:"))).toBe(false);
    expect(r.claims.find((c) => c.category === "metric")?.status).toBe("needs-confirmation");
    expect(r.discoveredLinks[0].kind).toBe("pricing");
  });
});

describe("script", () => {
  const research = Research.parse({ schemaVersion: 1, claims: [claim({ id: "c-ok", text: "Căutare instantă: găsești orice", status: "verified" }), claim({ id: "c-cifra", text: "10.000 de echipe", category: "metric", status: "needs-confirmation" })] });
  it("schița păstrează hook-ul și CTA-ul utilizatorului și adaugă fraza obligatorie", () => {
    const s = draftScript(brief, research, { textLanguage: "ro", voiceLanguage: null, productName: "Produs" });
    expect(s.lines[0].voiceover).toBe("Încă o ședință?");
    expect(s.lines[0].origin).toBe("user-verbatim");
    expect(s.lines.some((l) => l.isCta && l.onScreen === "Încearcă gratuit")).toBe(true);
    expect(s.lines.some((l) => l.voiceover.includes("în 5 minute") || l.onScreen.includes("în 5 minute"))).toBe(true);
    expect(validateScript(s, brief, research).filter((i) => i.severity === "blocker")).toHaveLength(0);
  });
  it("blochează fraza obligatorie lipsă, cifrele fără sursă și afirmațiile neconfirmate", () => {
    const s = Script.parse({ schemaVersion: 1, textLanguage: "ro", voiceLanguage: null, lines: [{ id: "a", origin: "ai", voiceover: "Folosit de 10.000 de echipe", claimIds: [] }, { id: "b", origin: "ai", voiceover: "x", claimIds: ["c-cifra"] }, { id: "cta", origin: "user-verbatim", onScreen: "Încearcă gratuit", isCta: true }] });
    const issues = validateScript(s, brief, research).filter((i) => i.severity === "blocker").map((i) => i.message);
    expect(issues.some((m) => m.includes("în 5 minute"))).toBe(true);
    expect(issues.some((m) => m.includes("fără afirmație-sursă"))).toBe(true);
    expect(issues.some((m) => m.includes("c-cifra"))).toBe(true);
  });
});

describe("gramatica de montaj", () => {
  it("timp de citire: 1 s la 3 cuvinte, minimum 0,8 s", () => {
    expect(readingSec("unu")).toBe(0.8);
    expect(readingSec("unu doi trei patru cinci șase")).toBe(2);
  });
  it("CTA-ul primește hold de minimum 2,5 s", () => {
    const d = sceneDuration({ voSec: 0, onScreen: "Încearcă gratuit", shot: "title", energy: 0.5, role: "cta", recipeMinSec: 1, explicitSec: null, dir: DIRECTIONS.energetic, pacing: "fast" });
    expect(d.sec).toBeGreaterThanOrEqual(0.8 + 0.45 + 2.5);
  });
  it("vocea lungă prelungește scena; durata cerută sub minim nu se acceptă", () => {
    const d = sceneDuration({ voSec: 5, onScreen: "Text", shot: "hero", energy: 0.5, role: "feature", recipeMinSec: 1, explicitSec: 2, dir: DIRECTIONS.technical, pacing: "medium" });
    expect(d.sec).toBeGreaterThanOrEqual(5.5);
  });
  it("nu repetă tranziția anterioară când există alternativă", () => {
    for (let seed = 0; seed < 20; seed++) {
      const t = chooseTransition({ energy: 0.6, role: "feature" }, { energy: 0.6, role: "feature", id: `s${seed}` }, DIRECTIONS.energetic, seed, [], "tr.push");
      expect(t).not.toBe("tr.push");
    }
  });
});

describe("direcții, șabloane, rețete", () => {
  it("propune 3 direcții când nu e aleasă una", () => {
    const s = suggestDirections({ tone: ["premium", "elegant"], pacing: "slow", category: "fintech", platforms: ["youtube"] });
    expect(s).toHaveLength(3);
    expect(s[0].direction).toBe("premium");
  });
  it("șabloanele sunt valide și folosesc rețete existente", () => {
    const ids = new Set(RECIPES.map((r) => r.id));
    const all = listTemplates();
    expect(all.length).toBeGreaterThanOrEqual(8);
    for (const t of all) for (const s of t.scenes) expect(ids.has(s.recipe), `${t.id} → ${s.recipe}`).toBe(true);
    expect(chooseTemplate({ category: "mobile-app", direction: "energetic", durationSec: 25, objective: "downloads" }).template.id).toBe("mobile-app");
    expect(chooseTemplate({ category: "saas", direction: null, durationSec: 30, objective: "launch" }).template.id).toBe("product-launch");
  });
});

describe("comenzi în limbaj natural", () => {
  it("înțelege exemplele din română și engleză", () => {
    expect(parseCommand("la 00:14 zoom pe câmpul de căutare")[0]).toMatchObject({ op: "zoom-at", sec: 14, target: "câmpul de căutare" });
    expect(parseCommand("At 00:14 zoom into the search field")[0]).toMatchObject({ op: "zoom-at", sec: 14 });
    expect(parseCommand("Make the CTA hold for 2 seconds")[0]).toMatchObject({ op: "cta-hold", sec: 2 });
    expect(parseCommand("CTA-ul să stea 3 secunde")[0]).toMatchObject({ op: "cta-hold", sec: 3 });
    expect(parseCommand("Make the transitions faster")[0]).toMatchObject({ op: "transitions-speed", factor: 0.6 });
    expect(parseCommand("tranziții mai rapide")[0]).toMatchObject({ op: "transitions-speed" });
    expect(parseCommand("Use less music under the voice")[0]).toMatchObject({ op: "music-under-voice" });
    expect(parseCommand("mai puțină muzică sub voce")[0]).toMatchObject({ op: "music-under-voice" });
    expect(parseCommand("Use the original phrase I gave you")[0]).toMatchObject({ op: "use-original-hook" });
    expect(parseCommand("Make the hook more aggressive")[0]).toMatchObject({ op: "hook-energy", style: "aggressive" });
    expect(parseCommand("Make this feel more premium")[0]).toMatchObject({ op: "direction", direction: "premium" });
    expect(parseCommand("scena 2 mai lungă cu 1 secundă")[0]).toMatchObject({ op: "scene-length", sceneIndex: 1, deltaSec: 1 });
    expect(parseCommand("Replace the screenshot at 5 with screenshot-abc123")[0]).toMatchObject({ op: "replace-asset-at", sec: 5, assetId: "screenshot-abc123" });
  });
  it("refuză clar ce nu înțelege", () => {
    expect(() => parseCommand("bla bla")).toThrow(/Nu recunosc/);
  });
});
