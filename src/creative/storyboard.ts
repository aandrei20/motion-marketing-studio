/**
 * Storyboard din șablon + script + materiale: fiecare scenă primește un rol narativ, o replică,
 * o rețetă, materialele potrivite (cea mai potrivită captură pentru textul scenei) și punctul de interes.
 * Rezultatul e executabil (compilatorul îl transformă în timeline), nu proză.
 */
import {
  assetRegions,
  isClaimUsable,
  type Asset,
  type Brief,
  type Claim,
  type Research,
  type Script,
  type ScriptLine,
  type Storyboard,
  type StoryboardScene,
} from "../core/schema";
import { PHONE_MAX_CSS_WIDTH, samePageKey } from "../assets/counterpart";
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
  // varianta de telefon a unei pagini capturate și pe desktop nu intră în storyboard: storyboard-ul e comun
  // tuturor formatelor, iar compilatorul o alege singur pe vertical (assets/counterpart.ts)
  const isPhone = (a: Asset) => !!a.capture && a.capture.viewport.width < PHONE_MAX_CSS_WIDTH;
  const desktopPages = new Set(
    inp.assets.filter((a) => a.role === "screenshot" && a.capture && !isPhone(a)).map((a) => `${samePageKey(a.capture!.url)}|${a.capture!.fullPage}`),
  );
  const twin = (a: Asset) => isPhone(a) && desktopPages.has(`${samePageKey(a.capture!.url)}|${a.capture!.fullPage}`);
  const screenshots = inp.assets.filter((a) => a.role === "screenshot" && a.showsProductUI && !a.capture?.fullPage && !twin(a));
  const tall = inp.assets.filter((a) => a.role === "screenshot" && a.capture?.fullPage && !twin(a));
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

  // pagina din care vine o afirmație: o funcție citată de pe pagina ei se arată pe captura acelei pagini
  const pageKey = (u: string | undefined) => (u ? u.replace(/[?#].*$/, "").replace(/\/$/, "") : "");
  const sourceUrl = new Map(inp.research.sources.map((s) => [s.id, pageKey(s.url)]));
  const uses = new Map<string, number>();
  const rankScreens = (text: string, avoid: string | null, line: ScriptLine | null) => {
    const pages = new Set(
      (line?.claimIds ?? [])
        .flatMap((id) => claims.get(id)?.sourceIds ?? [])
        .map((s) => sourceUrl.get(s))
        .filter(Boolean),
    );
    const words = norm(text)
      .split(/\s+/)
      .filter((w) => w.length > 3);
    // capturile de pagină întreagă intră doar cu o zonă care chiar se potrivește textului (camera derulează până la ea)
    return [...screenshots, ...tall]
      .map((a) => {
        const r = bestRegion(assetRegions(a), text, ["input", "button", "custom", "heading", "text"]);
        const label = norm(`${r?.label ?? ""} ${r?.text ?? ""}`);
        const match = r ? words.filter((w) => label.includes(w.slice(0, Math.max(4, w.length - 2)))).length : 0;
        const fromPage = pages.has(pageKey(a.capture?.url)) ? 2 : 0;
        const score = match + fromPage + (a.id === avoid ? -0.5 : 0) - 0.75 * (uses.get(a.id) ?? 0) + (a.analysis.importance ?? 0) * 0.1;
        return { a, r, score, ok: !a.capture?.fullPage || match >= 2 };
      })
      .filter((x) => x.ok)
      .sort((x, y) => y.score - x.score);
  };
  const bestScreen = (text: string, avoid: string | null, line: ScriptLine | null): { asset: Asset; region: string | undefined } | null => {
    const scored = rankScreens(text, avoid, line);
    if (!scored.length) return null;
    uses.set(scored[0].a.id, (uses.get(scored[0].a.id) ?? 0) + 1);
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
        const pick = rec ? { asset: rec, region: undefined } : bestScreen(text, lastScreen, l);
        if (pick) {
          slots[s.name] = pick.asset.id;
          lastScreen = pick.asset.id;
          if (pick.region) focus = { assetId: pick.asset.id, region: pick.region };
        }
      }
      // mai multe ecrane: cele mai potrivite 3 capturi (nu toate), fără paginile întregi
      if (s.kind === "screenshot" && s.multiple && screenshots.length)
        slots[s.name] = rankScreens(text, null, l)
          .filter((x) => !x.a.capture?.fullPage)
          .slice(0, 3)
          .map((x) => x.a.id);
      if (s.kind === "tall-screenshot" && tall.length) slots[s.name] = tall[0].id;
    }
    const missing = recipe.slots.filter((s) => s.required && !slots[s.name]);
    if (missing.length) {
      const fallback = ts.role === "cta" ? "cta-end" : ts.role === "reveal" ? "product-reveal" : "hook-kinetic";
      rationale.push(`Scena ${i + 1}: rețeta „${recipeId}” cere ${missing.map((m) => m.kind).join(", ")}, care lipsește; folosesc „${fallback}”.`);
      recipeId = fallback;
    }
    const items =
      recipeId === "feature-montage"
        ? featureLines
            .map((f) => f.onScreen)
            .filter(Boolean)
            .slice(0, 4)
        : [];
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
      recipe: {
        id: recipeId,
        params: recipeId === "cta-end" && inp.brief.cta.url ? { url: inp.brief.cta.url.replace(/^https?:\/\//, "").replace(/\/$/, "") } : {},
      },
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
      locked: false,
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
      locked: false,
    });
    rationale.push(`Problema („${p.l.id}”) a primit o scenă imediat după hook.`);
  }
  for (const p of leftovers.filter((x) => !x.used)) {
    const pick = bestScreen(`${p.l.onScreen} ${p.l.voiceover}`, lastScreen, p.l);
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
      locked: false,
    };
    const ctaIdx = scenes.findIndex((s) => s.narrativeRole === "cta");
    scenes.splice(ctaIdx >= 0 ? ctaIdx : scenes.length, 0, scene);
    rationale.push(`Replica „${p.l.id}” a primit o scenă proprie (${recipeId}).`);
  }
  scenes.forEach((s, i) => {
    s.id = s.id.replace(/^s\d+/, `s${i + 1}`);
  });
  // arcul de energie: un șablon care urcă în pași mici lasă corpul reclamei plat (abatere < 0,06, cât cere
  // verificarea story.energy-arc); atunci energia crește de la 0,5 la 0,85 spre ultima scenă dinaintea CTA-ului
  const body = scenes.filter((s) => s.narrativeRole !== "hook" && s.narrativeRole !== "cta");
  if (body.length >= 3) {
    const mean = body.reduce((a, s) => a + s.energy, 0) / body.length;
    const std = Math.sqrt(body.reduce((a, s) => a + (s.energy - mean) ** 2, 0) / body.length);
    if (std < 0.06) {
      body.forEach((s, k) => {
        s.energy = Math.round((0.5 + (0.35 * k) / (body.length - 1)) * 100) / 100;
      });
      rationale.push(`Energia crește pe corpul reclamei (${body.map((s) => s.energy.toFixed(2)).join(" → ")}): șablonul o lăsa aproape plată.`);
    }
  }
  const unusable = inp.research.claims.filter((c) => !isClaimUsable(c)).length;
  if (unusable) rationale.push(`${unusable} afirmații nu sunt confirmate și nu au fost folosite.`);
  return {
    schemaVersion: 1,
    templateId: inp.template.id,
    audio: { duckDb: -10, musicGainDb: 0, sfxGainDb: 0, music: inp.brief.audio.music.mode !== "none" },
    rationale,
    scenes,
  };
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
