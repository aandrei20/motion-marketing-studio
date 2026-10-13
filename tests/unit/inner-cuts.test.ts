/**
 * Tăieturile din interiorul scenelor (punch-in): cadrul ales pe cuvânt, forma „decupaj” (aceeași casetă, captura
 * mai strânsă, straturile de peste ea continuă), forma „cameră” (plan larg, apoi prim-planul rețetei) și
 * condițiile care le opresc (platformă lentă, cameră explicită, ritm „slow”, zona care ar intra sub subtitrări).
 */
import { describe, expect, it } from "vitest";
import type { TimelineLayer, TimelineScene } from "../../src/core/schema";
import { innerCut, pickCutFrame } from "../../src/timeline/inner-cuts";
import { cameraCuts, cameraMotionBlur } from "../../src/motion/camera/rig";

const layer = (o: Partial<TimelineLayer> & Pick<TimelineLayer, "id" | "capability" | "box">): TimelineLayer => ({
  from: 0,
  durationInFrames: 150,
  z: 10,
  params: {},
  depth: 1,
  role: "support",
  modifiers: [],
  assets: [],
  children: [],
  ...o,
});

const scene = (zoom: number): TimelineScene => ({
  id: "s1",
  from: 0,
  durationInFrames: 150,
  transitionIn: null,
  camera: {
    keys: [
      { at: 0, x: 540, y: 960, zoom: 1, rotate: 0, rotateX: 0, rotateY: 0, ease: "inOut" },
      { at: 140, x: 540, y: 960, zoom, rotate: 0, rotateX: 0, rotateY: 0, ease: "inOut" },
    ],
    handheld: 0,
    shake: [],
    punches: [],
    perspective: 1600,
    motionBlur: true,
  },
  layers: [
    layer({
      id: "s1-media-screen-1",
      capability: "media.screen",
      role: "hero",
      box: { x: 60, y: 536, w: 960, h: 889 },
      params: { kind: "image", imageWidth: 2880, imageHeight: 1800, crop: { x: 500, y: 0, w: 1416, h: 1311 }, frame: "none" },
      modifiers: [{ capability: "mod.enter", params: {} }],
      children: [layer({ id: "s1-ui-highlight-2", capability: "ui.highlight", from: 30, durationInFrames: 100, box: { x: 1063, y: 368, w: 471, h: 300 } })],
    }),
  ],
  meta: { purpose: "", narrativeRole: "feature", recipe: "ui-walkthrough", shot: "", energy: 0.6 },
});

const base = {
  fps: 30,
  width: 1080,
  height: 1920,
  maxShotSec: 2.6,
  wordStarts: [40, 62, 81, 95],
  beats: [],
  regions: [],
  explicitCamera: false,
  pacing: "medium",
};

describe("tăieturile din interiorul scenelor", () => {
  it("cadrul tăieturii e începutul de cuvânt cel mai apropiat de mijloc, între limite", () => {
    expect(pickCutFrame(150, 30, [40, 62, 81, 95], [])).toBe(81);
    // fără cuvinte în fereastră: bătaia, apoi mijlocul
    expect(pickCutFrame(150, 30, [5], [70])).toBe(70);
    expect(pickCutFrame(150, 30, [], [])).toBe(75);
    // o scenă prea scurtă nu are loc de două planuri
    expect(pickCutFrame(50, 30, [25], [])).toBeNull();
  });

  it("decupaj: același strat continuă după tăietură cu captura mai strânsă, fără a doua intrare", () => {
    const out = innerCut({ ...base, scene: scene(1.06) });
    expect(out.meta.cuts).toEqual([81]);
    const [a, b] = out.layers;
    expect(a.durationInFrames).toBe(81);
    expect(b.from).toBe(81);
    expect(b.durationInFrames).toBe(150 - 81);
    expect(b.modifiers.some((m) => m.capability === "mod.enter")).toBe(false);
    const crop = b.params.crop as { x: number; y: number; w: number; h: number };
    // prim-planul e cel puțin 1,3× mai aproape și conține zona întreagă
    expect(1416 / crop.w).toBeGreaterThanOrEqual(1.3);
    expect(crop.x).toBeLessThanOrEqual(1063);
    expect(crop.x + crop.w).toBeGreaterThanOrEqual(1063 + 471);
    // conturul continuă din starea lui (start negativ), nu se redesenează
    expect(b.children[0].from).toBe(30 - 81);
  });

  it("decupaj: zona demonstrată rămâne deasupra subtitrărilor sau tăietura nu se face", () => {
    const ok = innerCut({ ...base, scene: scene(1.06), avoid: { x: 120, y: 1094, w: 840, h: 188 } });
    const b = ok.layers[1];
    const crop = b.params.crop as { y: number; h: number };
    const bottom = b.box.y + (368 + 300 - crop.y) * (b.box.h / crop.h);
    expect(960 + (bottom - 960) * 1.06).toBeLessThanOrEqual(1094);
    // o bandă de subtitrări chiar sub marginea de sus a casetei nu lasă loc: scena rămâne un singur plan
    expect(innerCut({ ...base, scene: scene(1.06), avoid: { x: 120, y: 560, w: 840, h: 188 } }).meta.cuts).toBeUndefined();
  });

  it("cameră: plan larg aproape fix, apoi prim-planul rețetei, fără estompare pe cadrul tăieturii", () => {
    const s = scene(2.2);
    s.layers[0].params = { ...s.layers[0].params, crop: undefined };
    const out = innerCut({ ...base, scene: s, focus: { x: 700, y: 900, zoom: 2.2, target: { x: 540, y: 1100 } } });
    expect(out.meta.cuts).toEqual([81]);
    const k = out.camera.keys;
    expect(k.map((x) => x.at)).toEqual([0, 80, 81, 149]);
    expect(k[1].zoom).toBeCloseTo(1.03);
    expect(k[3].zoom).toBeCloseTo(2.2);
    expect(cameraCuts(out.camera)).toEqual([81]);
    expect(cameraMotionBlur(out.camera, 81, 30, "x")).toEqual([0, 0]);
  });

  it("nu taie pe platformele lente, cu cameră aleasă explicit, cu ritm „slow” sau în afara demonstrațiilor", () => {
    expect(innerCut({ ...base, scene: scene(1.06), maxShotSec: 4.5 }).meta.cuts).toBeUndefined();
    expect(innerCut({ ...base, scene: scene(1.06), explicitCamera: true }).meta.cuts).toBeUndefined();
    expect(innerCut({ ...base, scene: scene(1.06), pacing: "slow" }).meta.cuts).toBeUndefined();
    const cta = scene(1.06);
    cta.meta.narrativeRole = "cta";
    expect(innerCut({ ...base, scene: cta }).meta.cuts).toBeUndefined();
  });
});
