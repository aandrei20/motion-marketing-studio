/**
 * Planificatorul de compoziție și locul textului: „auto” alternează locul textului între scene (sus ↔ jos pe
 * vertical, stânga ↔ dreapta pe orizontal), o așezare explicită rămâne, centrul nu se alege niciodată automat;
 * pe vertical, textul sub material stă deasupra subtitrărilor; verificarea `visual.text-placement` prinde textul
 * ținut în același loc în trei scene la rând.
 */
import { describe, expect, it } from "vitest";
import type { ConcreteComposition, Timeline, TimelineLayer, TimelineScene } from "../../src/core/schema";
import { resolveSafeZone } from "../../src/core/formats";
import { anchorOf, planCompositions, textBottom, textOnlyPlacement } from "../../src/recipes/layout";
import { zones } from "../../src/recipes/kit";
import { getRecipe } from "../../src/recipes/recipes";
import type { RecipeContext } from "../../src/recipes/types";
import { VISUAL_CHECKS, textPlace } from "../../src/quality/passes/visual";
import { visibleBox } from "../../src/timeline/geometry";
import { textTolerance } from "../../src/recipes/kit";

const ui = getRecipe("ui-spotlight");
const reveal = getRecipe("product-reveal");
const montage = getRecipe("feature-montage");

function ctxFor(
  W: number,
  H: number,
  platform: "tiktok" | "youtube",
  composition: ConcreteComposition,
  captions = true,
  text = { headline: "Un titlu de test pe două rânduri", sub: "Subtitlul" },
): RecipeContext {
  const safe = resolveSafeZone({ width: W, height: H, platform });
  return {
    W,
    H,
    fps: 30,
    orientation: W > H ? "landscape" : W < H ? "portrait" : "square",
    safe,
    captions,
    shape: { radius: 10, spacing: 20, shadow: "soft" },
    scene: { composition } as RecipeContext["scene"],
    text: { ...text, items: [], emphasis: [], vo: "" },
  } as unknown as RecipeContext;
}

describe("planificatorul de compoziție", () => {
  it("„auto” alternează locul textului: sus/jos pe vertical, stânga/dreapta pe orizontal", () => {
    const scenes = [ui, ui, ui, ui].map((recipe) => ({ composition: "auto" as const, recipe }));
    const portrait = planCompositions(scenes, "portrait");
    expect(portrait).toEqual(["thirds-left", "thirds-right", "thirds-left", "thirds-right"]);
    expect(portrait.map((c) => anchorOf(c, "portrait"))).toEqual(["top", "bottom", "top", "bottom"]);
    expect(planCompositions(scenes, "landscape").map((c) => anchorOf(c, "landscape"))).toEqual(["left", "right", "left", "right"]);
  });

  it("o așezare explicită rămâne, iar scena următoare pleacă de la locul ei", () => {
    const plan = planCompositions(
      [
        { composition: "thirds-right", recipe: ui },
        { composition: "auto", recipe: ui },
        { composition: "auto", recipe: ui },
      ],
      "portrait",
    );
    expect(plan).toEqual(["thirds-right", "thirds-left", "thirds-right"]);
  });

  it("centrul nu se alege automat; o scenă cu așezare proprie (dezvăluirea) rupe seria", () => {
    const plan = planCompositions(
      [
        { composition: "auto", recipe: ui },
        { composition: "auto", recipe: reveal },
        { composition: "auto", recipe: ui },
      ],
      "portrait",
    );
    expect(plan).not.toContain("center");
    // după textul din mijloc al dezvăluirii, prima preferință a rețetei (sus) e din nou liberă
    expect(plan[2]).toBe("thirds-left");
  });

  it("montajul de pe orizontal are textul mereu sus: scena următoare îl ocolește", () => {
    const plan = planCompositions(
      [
        { composition: "auto", recipe: montage },
        { composition: "auto", recipe: ui },
      ],
      "landscape",
    );
    expect(plan[1]).toBe("thirds-left");
    expect(montage.anchor?.(plan[0], "landscape")).toBe("top");
  });
});

describe("locul textului pe format", () => {
  it("pe vertical, cu textul sub material: materialul deasupra, textul și subtitlul deasupra benzii subtitrărilor", () => {
    const ctx = ctxFor(1080, 1920, "tiktok", "thirds-right");
    const z = zones(ctx);
    expect(z.media.y + z.media.h).toBeLessThanOrEqual(z.text.y);
    expect(z.sub.y + z.sub.h).toBeLessThanOrEqual(textBottom(ctx) + 1);
    expect(z.text.y).toBeGreaterThan(ctx.safe.rect.y + ctx.safe.rect.h * 0.4);
    // fără subtitrări arse, grupul coboară până la marginea zonei sigure
    const free = zones(ctxFor(1080, 1920, "tiktok", "thirds-right", false));
    expect(free.sub.y + free.sub.h).toBeCloseTo(ctx.safe.rect.y + ctx.safe.rect.h, 0);
    // fără subtitlu și cu un titlu scurt, textul ia mai puțin loc, iar materialul crește
    const lean = zones(ctxFor(1080, 1920, "tiktok", "thirds-right", true, { headline: "Focusul zilei", sub: "" }));
    expect(lean.media.h).toBeGreaterThan(z.media.h + 100);
    expect(lean.text.y + lean.text.h).toBeLessThanOrEqual(textBottom(ctx) + 1);
  });

  it("textul singur: jos pe vertical (aliniat la marginea de jos), în dreapta pe orizontal (aliniat la dreapta)", () => {
    const p = textOnlyPlacement(ctxFor(1080, 1920, "tiktok", "thirds-right"), "thirds-right");
    expect(p.vAlign).toBe("bottom");
    expect(p.box.y + p.box.h).toBeLessThanOrEqual(textBottom(ctxFor(1080, 1920, "tiktok", "thirds-right")) + 1);
    const l = textOnlyPlacement(ctxFor(1920, 1080, "youtube", "thirds-right"), "thirds-right");
    expect(l.align).toBe("right");
    expect(l.box.x + l.box.w / 2).toBeGreaterThan(1920 / 2);
    expect(textOnlyPlacement(ctxFor(1920, 1080, "youtube", "center"), "center").align).toBe("center");
  });
});

describe("materialul față de text", () => {
  it("toleranța e 0 când textul e lipit sub material, 24 px altfel", () => {
    expect(textTolerance(ctxFor(1080, 1920, "tiktok", "thirds-right"))).toBe(0);
    expect(textTolerance(ctxFor(1080, 1920, "tiktok", "thirds-left"))).toBe(24);
    expect(textTolerance(ctxFor(1920, 1080, "youtube", "thirds-right"))).toBe(24);
  });

  it("partea vizibilă a unei capturi e ecranul cu rama, nu toată cutia", () => {
    const box = { x: 60, y: 180, w: 960, h: 900 };
    const params = { src: "x.png", kind: "image", imageWidth: 2880, imageHeight: 1800, frame: "browser", viewportAspect: 1.6 };
    const v = visibleBox({ capability: "media.screen", box, params });
    expect(v.h).toBeLessThan(box.h * 0.8);
    expect(v.y).toBeGreaterThan(box.y);
    expect(v.y + v.h).toBeLessThan(box.y + box.h);
    // fără ramă (cardul decupat de pe vertical): exact ecranul, fără margini inventate
    const bare = visibleBox({ capability: "media.screen", box, params: { ...params, frame: "none", crop: { x: 0, y: 0, w: 1200, h: 1000 } } });
    expect(bare.y).toBeGreaterThanOrEqual(box.y);
    expect(bare.x).toBeGreaterThanOrEqual(box.x);
    // alte straturi: cutia întreagă
    expect(visibleBox({ capability: "media.image", box, params: {} })).toEqual(box);
  });
});

describe("verificarea visual.text-placement", () => {
  const W = 1080;
  const H = 1920;
  const safe = resolveSafeZone({ width: W, height: H, platform: "tiktok" });
  const text = (id: string, box: TimelineLayer["box"], extra: Record<string, unknown> = {}): TimelineLayer => ({
    id,
    capability: "text.pop",
    from: 0,
    durationInFrames: 60,
    z: 50,
    box,
    params: { text: "Titlu", lines: ["Titlu"], fontSize: 100, ...extra },
    depth: 0,
    role: "hero",
    modifiers: [],
    assets: [],
    children: [],
  });
  const scene = (id: string, i: number, layers: TimelineLayer[], role = "feature"): TimelineScene =>
    ({
      id,
      from: i * 60,
      durationInFrames: 60,
      transitionIn: null,
      camera: { keys: [], handheld: 0, shake: [], punches: [], perspective: 1600, motionBlur: true },
      layers,
      meta: { purpose: "", narrativeRole: role, recipe: "ui-spotlight", shot: "detail", energy: 0.6 },
    }) as unknown as TimelineScene;
  const timeline = (scenes: TimelineScene[]) =>
    ({ width: W, height: H, fps: 30, safeZone: { top: safe.top, right: safe.right, bottom: safe.bottom, left: safe.left }, scenes }) as unknown as Timeline;
  const check = VISUAL_CHECKS.find((c) => c.id === "visual.text-placement")!;
  const run = (t: Timeline, compositions: Record<string, string> = {}) =>
    check.run(
      { timelines: { f: t }, storyboard: { scenes: t.scenes.map((s) => ({ id: s.id, composition: compositions[s.id] ?? "auto", locked: false })) } } as never,
      "f",
    ) as ReturnType<typeof check.run> & unknown[];
  const top = { x: 120, y: 240, w: 840, h: 204 };
  const bottom = { x: 120, y: 811, w: 652, h: 204 };

  it("locul se citește din rânduri, aliniere și partea cadrului", () => {
    const t = timeline([]);
    expect(textPlace(t, text("a", top))).toBe("sus-stânga");
    expect(textPlace(t, text("b", bottom, { vAlign: "top" }))).toBe("mijloc-stânga");
    expect(textPlace(t, text("c", { x: 120, y: 600, w: 840, h: 497 }, { vAlign: "bottom" }))).toBe("jos-stânga");
    expect(textPlace(t, text("d", top, { align: "center" }))).toBe("sus-centru");
  });

  it("trei scene la rând cu textul în același loc: problemă medie; alternanța trece", async () => {
    const same = await run(timeline([0, 1, 2].map((i) => scene(`s${i}`, i, [text(`t${i}`, top)]))));
    expect(same).toHaveLength(1);
    expect(same[0].severity).toBe("medium");
    expect(same[0].problem).toContain("sus-stânga");
    // corectura: scenele cu așezarea scrisă explicit trec pe „auto”; nu se aplică singură
    const fixed = await run(timeline([0, 1, 2].map((i) => scene(`s${i}`, i, [text(`t${i}`, top)]))), { s0: "thirds-left", s2: "thirds-left" });
    expect(fixed[0].suggestedFix).toEqual([
      { op: "set-composition", sceneId: "s0", composition: "auto" },
      { op: "set-composition", sceneId: "s2", composition: "auto" },
    ]);
    expect(fixed[0].autoFixable).toBe(false);
    const alternating = await run(timeline([0, 1, 2].map((i) => scene(`s${i}`, i, [text(`t${i}`, i % 2 ? bottom : top, i % 2 ? { vAlign: "top" } : {})]))));
    expect(alternating).toHaveLength(0);
    // CTA-ul nu intră în serie
    const withCta = await run(timeline([scene("s0", 0, [text("t0", top)]), scene("s1", 1, [text("t1", top)]), scene("s2", 2, [text("t2", top)], "cta")]));
    expect(withCta).toHaveLength(0);
  });
});
