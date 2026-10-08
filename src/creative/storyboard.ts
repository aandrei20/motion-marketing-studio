/**
 * Storyboard din șablon + script + materiale: fiecare scenă primește un rol narativ, o replică,
 * o rețetă, materialele potrivite (cea mai potrivită captură pentru textul scenei) și punctul de interes.
 * Rezultatul e executabil (compilatorul îl transformă în timeline), nu proză.
 */
import { isClaimUsable, type Asset, type Brief, type Claim, type Research, type Script, type ScriptLine, type Storyboard, type StoryboardScene } from "../core/schema";
import { bestRegion, norm } from "../recipes/kit";
import { getRecipe } from "../recipes/recipes";
import type { AdTemplate, TemplateScene } from "./templates";

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24) || "scena";

type LineKind = TemplateScene["line"];

function lineKind(l: ScriptLine, claims: Map<string, Claim>): LineKind {
  if (l.isHook) return "hook";
  if (l.isCta) return "cta";
  const cats = l.claimIds.map((id) => claims.get(id)?.category);
  if (cats.includes("metric") || cats.includes("testimonial")) return "proof";
  if (cats.includes("feature") || cats.includes("use-case")) return "feature";
  if (cats.includes("positioning") || cats.includes("differentiator")) return "reveal";
  if (cats.includes("benefit")) return "benefit";
  if (/problem|durere|pain/.test(l.id) || /frustr/.test(l.emotion)) return "problem";
  return "benefit";
}

export interface StoryboardInput {
  template: AdTemplate;
  script: Script;
  brief: Brief;
  research: Research;
  assets: Asset[];
  productName: string;
}

export function buildStoryboard(inp: StoryboardInput): Storyboard {
  const claims = new Map(inp.research.claims.map((c) => [c.id, c]));
  const rationale: string[] = [`Șablon: ${inp.template.title} – ${inp.template.description}`];
  const pool = inp.script.lines.map((l) => ({ l, kind: lineKind(l, claims), used: false }));
  const screenshots = inp.assets.filter((a) => a.role === "screenshot" && a.showsProductUI && !a.capture?.fullPage);
  const tall = inp.assets.filter((a) => a.role === "screenshot" && a.capture?.fullPage);
  const recordings = inp.assets.filter((a) => a.role === "screen-recording");
  const logo = inp.assets.find((a) => a.role === "logo");
  const scenes: StoryboardScene[] = [];
  let lastScreen: string | null = null;

  const takeLine = (kind: LineKind): ScriptLine | null => {
    const exact = pool.find((p) => !p.used && p.kind === kind);
    const fallback = kind === "feature" || kind === "benefit" ? pool.find((p) => !p.used && (p.kind === "feature" || p.kind === "benefit")) : null;
    const hit = exact ?? fallback ?? null;
    if (!hit) return null;
    hit.used = true;
    return hit.l;
  };

  const bestScreen = (text: string, avoid: string | null): { asset: Asset; region: string | undefined } | null => {
    if (!screenshots.length) return null;
    const scored = screenshots.map((a) => {
      const r = bestRegion(a.capture?.regions ?? [], text);
      const words = norm(text).split(/\s+/).filter((w) => w.length > 3);
      const label = norm(`${r?.label ?? ""} ${r?.text ?? ""}`);
      const score = (r ? words.filter((w) => label.includes(w.slice(0, Math.max(4, w.length - 2)))).length : 0) + (a.id === avoid ? -0.5 : 0) + (a.analysis.importance ?? 0) * 0.1;
      return { a, r, score };
    });
    scored.sort((x, y) => y.score - x.score);
    return { asset: scored[0].a, region: scored[0].r?.id };
  };

  const featureLines = pool.filter((p) => p.kind === "feature").map((p) => p.l);

  inp.template.scenes.forEach((ts, i) => {
    let recipeId = ts.recipe;
    const l = takeLine(ts.line);
    if (!l && ts.optional) {
      rationale.push(`Scena opțională „${ts.role}” (${ts.recipe}) omisă: nu există replică potrivită.`);
      return;
    }
    const text = l ? `${l.onScreen} ${l.voiceover}` : inp.productName;
    const slots: Record<string, string | string[]> = {};
    let focus: StoryboardScene["focus"];
    const recipe = getRecipe(recipeId);
    for (const s of recipe.slots) {
      if (s.kind === "logo" && logo) slots[s.name] = logo.id;
      if ((s.kind === "screenshot" || s.kind === "screen") && !s.multiple) {
        const rec = s.kind === "screen" && recipeId === "ui-walkthrough" ? recordings[0] : undefined;
        const pick = rec ? { asset: rec, region: undefined } : bestScreen(text, lastScreen);
        if (pick) {
          slots[s.name] = pick.asset.id;
          lastScreen = pick.asset.id;
          if (pick.region) focus = { assetId: pick.asset.id, region: pick.region };
        }
      }
      if (s.kind === "screenshot" && s.multiple && screenshots.length) slots[s.name] = screenshots.map((a) => a.id);
      if (s.kind === "tall-screenshot" && tall.length) slots[s.name] = tall[0].id;
    }
    const missing = recipe.slots.filter((s) => s.required && !slots[s.name]);
    if (missing.length) {
      const fallback = ts.role === "cta" ? "cta-end" : ts.role === "reveal" ? "product-reveal" : "hook-kinetic";
      rationale.push(`Scena ${i + 1}: rețeta „${recipeId}” cere ${missing.map((m) => m.kind).join(", ")}, care lipsește; folosesc „${fallback}”.`);
      recipeId = fallback;
    }
    const items = recipeId === "feature-montage" ? featureLines.map((f) => f.onScreen).filter(Boolean).slice(0, 4) : [];
    const id = `s${scenes.length + 1}-${slug(ts.role)}`;
    const sceneText: StoryboardScene["text"] = {};
    if (l?.onScreen) sceneText.headline = l.onScreen;
    if (ts.role === "reveal" && !l) sceneText.headline = inp.productName;
    if (ts.role === "cta") {
      sceneText.headline = inp.productName;
      sceneText.sub = inp.brief.cta.text;
    }
    if (items.length) sceneText.items = items;
    scenes.push({
      id,
      purpose: purposeFor(ts, l),
      narrativeRole: ts.role,
      emotionalRole: ts.emotion,
      energy: ts.energy,
      shot: ts.shot,
      durationSec: null,
      lineIds: l ? [l.id] : [],
      recipe: { id: recipeId, params: recipeId === "cta-end" && inp.brief.cta.url ? { url: inp.brief.cta.url.replace(/^https?:\/\//, "") } : {} },
      slots,
      text: sceneText,
      focus,
      overrides: [],
      transitionIn: null,
      audio: { sfx: "auto", silence: false },
      beat: { snap: ts.role === "cta" ? "bar" : "beat" },
      composition: i % 2 === 0 ? "thirds-left" : "thirds-right",
      cta: ts.role === "cta" ? "hold" : ts.role === "reveal" ? "setup" : "none",
      notes: "",
    });
  });
  // replicile rămase: problema merge imediat după hook; funcțiile și frazele obligatorii, înaintea CTA-ului
  const leftovers = pool.filter((p) => !p.used);
  for (const p of leftovers.filter((x) => x.kind === "problem")) {
    p.used = true;
    const hookIdx = scenes.findIndex((s) => s.narrativeRole === "hook");
    scenes.splice(hookIdx + 1, 0, {
      id: `s0-problem`,
      purpose: `Numește problema publicului, ca să se recunoască. Replica: „${(p.l.onScreen || p.l.voiceover).slice(0, 60)}”.`,
      narrativeRole: "problem",
      emotionalRole: "frustration",
      energy: 0.5,
      shot: "close-up",
      durationSec: null,
      lineIds: [p.l.id],
      recipe: { id: "problem-statement", params: {} },
      slots: {},
      text: { headline: p.l.onScreen || undefined },
      overrides: [],
      transitionIn: null,
      audio: { sfx: "auto", silence: false },
      beat: { snap: "beat" },
      composition: "thirds-left",
      cta: "none",
      notes: "Problema din brief, păstrată cuvânt cu cuvânt.",
    });
    rationale.push(`Problema („${p.l.id}”) a primit o scenă imediat după hook.`);
  }
  for (const p of leftovers.filter((x) => !x.used)) {
    const pick = bestScreen(`${p.l.onScreen} ${p.l.voiceover}`, lastScreen);
    const recipeId = pick ? "ui-spotlight" : "hook-kinetic";
    const scene: StoryboardScene = {
      id: `s${scenes.length + 1}-extra`,
      purpose: `Replica „${p.l.id}” din script (${p.kind}).`,
      narrativeRole: p.kind === "proof" ? "proof" : p.kind === "problem" ? "problem" : "feature",
      emotionalRole: "confidence",
      energy: 0.6,
      shot: "close-up",
      durationSec: null,
      lineIds: [p.l.id],
      recipe: { id: recipeId, params: {} },
      slots: pick ? { screen: pick.asset.id } : {},
      text: { headline: p.l.onScreen || undefined },
      focus: pick?.region ? { assetId: pick.asset.id, region: pick.region } : undefined,
      overrides: [],
      transitionIn: null,
      audio: { sfx: "auto", silence: false },
      beat: { snap: "beat" },
      composition: scenes.length % 2 === 0 ? "thirds-left" : "thirds-right",
      cta: "none",
      notes: "Adăugată automat pentru o replică fără scenă în șablon.",
    };
    const ctaIdx = scenes.findIndex((s) => s.narrativeRole === "cta");
    scenes.splice(ctaIdx >= 0 ? ctaIdx : scenes.length, 0, scene);
    rationale.push(`Replica „${p.l.id}” a primit o scenă proprie (${recipeId}).`);
  }
  scenes.forEach((s, i) => (s.id = s.id.replace(/^s\d+/, `s${i + 1}`)));
  const unusable = inp.research.claims.filter((c) => !isClaimUsable(c)).length;
  if (unusable) rationale.push(`${unusable} afirmații nu sunt confirmate și nu au fost folosite.`);
  return { schemaVersion: 1, templateId: inp.template.id, audio: { duckDb: -10, musicGainDb: 0, sfxGainDb: 0, music: inp.brief.audio.music.mode !== "none" }, rationale, scenes };
}

function purposeFor(ts: TemplateScene, l: ScriptLine | null): string {
  const base: Record<string, string> = {
    hook: "Oprește scroll-ul în prima secundă.",
    problem: "Numește problema publicului, ca să se recunoască.",
    agitation: "Amplifică problema înainte de soluție (tensiune).",
    reveal: "Arată produsul ca răspuns (eliberare).",
    solution: "Explică pe scurt cum rezolvă produsul problema.",
    feature: "Demonstrează o funcție pe interfața reală.",
    demo: "Arată fluxul real: clic, tastare, rezultat.",
    proof: "Dă o dovadă verificată (cifră sau citat real).",
    transformation: "Arată diferența înainte/după.",
    benefit: "Traduce funcția în beneficiu pentru om.",
    cta: "Cere acțiunea și ține cadrul destul cât să fie citit.",
    outro: "Închide cu brandul.",
  };
  return `${base[ts.role] ?? "Scenă."}${l ? ` Replica: „${(l.onScreen || l.voiceover).slice(0, 60)}”.` : ""}`;
}
