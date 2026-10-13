/**
 * Geometria pe ecran a straturilor: unde ajunge un strat din scenă după mișcarea camerei (aceeași
 * matematică cu src/motion/camera/rig.ts → layerTransform, fără rotații și fără mâna liberă, care
 * deplasează cu câțiva pixeli). Servește compilatorului (subtitrări care nu acoperă interfața) și
 * verificărilor de calitate (ocluzii, lizibilitate).
 */
import type { Rect, Timeline, TimelineLayer, TimelineScene } from "../core/schema";
import { layerZoom, sampleCamera } from "../motion/camera/rig";
import { screenMapping, screenPointToBox } from "../motion/media/media";

export function screenRect(
  t: Pick<Timeline, "width" | "height" | "fps">,
  scene: TimelineScene,
  layer: Pick<TimelineLayer, "box" | "depth">,
  local: number,
): Rect {
  const d = layer.depth;
  if (d === 0) return layer.box;
  const W = t.width;
  const H = t.height;
  const s = sampleCamera({ ...scene.camera, handheld: 0, shake: [] }, local, t.fps, "geometry");
  const fx = W / 2 + (s.fx - W / 2) * d;
  const fy = H / 2 + (s.fy - H / 2) * d;
  const z = layerZoom(s, d);
  return { x: W / 2 + z * (layer.box.x - fx), y: H / 2 + z * (layer.box.y - fy), w: layer.box.w * z, h: layer.box.h * z };
}

/**
 * Partea vizibilă a unui strat în scenă: la o captură (`media.screen`), ecranul cu rama lui (bara browserului
 * deasupra, marginea telefonului în jur), nu toată cutia stratului, care e transparentă în rest.
 */
export function visibleBox(l: Pick<TimelineLayer, "capability" | "box" | "params">): Rect {
  if (l.capability !== "media.screen") return l.box;
  const s = screenMapping(l.params as unknown as Parameters<typeof screenMapping>[0], l.box).geo.screen;
  // rama din jurul ecranului, după tipul ei (frames.tsx): bara browserului sus, marginea telefonului în jur, baza laptopului jos
  const frame = String((l.params as { frame?: string }).frame ?? "none");
  const [top, side, bottom] =
    frame === "browser" || frame === "desktop" ? [0.06, 0, 0] : frame === "phone" ? [0.04, 0.04, 0.04] : frame === "laptop" ? [0.03, 0.03, 0.08] : [0, 0, 0];
  return { x: l.box.x + s.x - s.w * side, y: l.box.y + s.y - s.w * top, w: s.w * (1 + 2 * side), h: s.h + s.w * (top + bottom) };
}

export function area(r: Rect): number {
  return Math.max(0, r.w) * Math.max(0, r.h);
}

export function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/** Cadrul local de „hold” al scenei: după tranziția de intrare, înainte de cea de ieșire. */
export function holdFrame(t: Pick<Timeline, "scenes">, i: number, at = 0.7): number {
  const s = t.scenes[i];
  const tin = s.transitionIn?.durationInFrames ?? 0;
  const next = t.scenes[i + 1];
  const tnext = next ? Math.max(0, s.from + s.durationInFrames - next.from) : 0;
  const a = Math.min(s.durationInFrames - 1, tin);
  const b = Math.max(a + 1, s.durationInFrames - tnext);
  return Math.min(s.durationInFrames - 1, Math.floor(a + (b - a) * at));
}

/** Materialele care pot fi acoperite (capturi, video, imagini, dispozitive), adică ce nu trebuie ascuns de subtitrări. */
export const isMediaLayer = (l: TimelineLayer): boolean => l.capability.startsWith("media.") || l.capability.startsWith("frame.");

/** Straturile de interfață care marchează elementul demonstrat (ce nu trebuie acoperit). */
const FOCUS_CAPS = /^ui\.(spotlight|highlight|callout|typing|click|cursor|zoom-lens|drag|tooltip|hover)$/;

/**
 * Zonele demonstrate dintr-o scenă, pe ecran: copiii de focus ai unui `media.screen` (în pixelii capturii),
 * duși în cutia stratului (decupaj, scroll) și apoi prin cameră. Fără focus: listă goală.
 */
export function focusRects(t: Pick<Timeline, "width" | "height" | "fps">, scene: TimelineScene, local: number): Rect[] {
  const out: Rect[] = [];
  for (const l of scene.layers) {
    if (l.capability !== "media.screen") continue;
    const p = l.params as unknown as Parameters<typeof screenPointToBox>[0];
    if (!p.imageWidth || !p.imageHeight) continue;
    for (const c of l.children) {
      if (!FOCUS_CAPS.test(c.capability)) continue;
      const lf = Math.max(0, local - l.from);
      // straturile care acoperă toată captura (spotlight, drag, cursor) au ținta în parametri, nu în cutie
      const cp = c.params as { region?: Rect; from?: Rect; to?: { x: number; y: number }; path?: Array<{ at: number; x: number; y: number }> };
      const full = c.box.w * c.box.h >= p.imageWidth * p.imageHeight * 0.6;
      let target: Rect | null = full ? null : c.box;
      if (full && cp.region) target = cp.region;
      else if (full && cp.from && cp.to) {
        const x0 = Math.min(cp.from.x, cp.to.x - cp.from.w / 2);
        const y0 = Math.min(cp.from.y, cp.to.y - cp.from.h / 2);
        target = {
          x: x0,
          y: y0,
          w: Math.max(cp.from.x + cp.from.w, cp.to.x + cp.from.w / 2) - x0,
          h: Math.max(cp.from.y + cp.from.h, cp.to.y + cp.from.h / 2) - y0,
        };
      } else if (full && cp.path?.length) {
        // cursorul: punctul în care se află la momentul de hold (o zonă mică în jurul lui)
        const pt = [...cp.path].reverse().find((q) => q.at <= local - l.from - c.from) ?? cp.path[0];
        target = { x: pt.x - 40, y: pt.y - 40, w: 80, h: 80 };
      }
      if (!target) continue;
      const a = screenPointToBox(p, l.box, { x: target.x, y: target.y }, lf, l.durationInFrames);
      const b = screenPointToBox(p, l.box, { x: target.x + target.w, y: target.y + target.h }, lf, l.durationInFrames);
      const inBox = { x: l.box.x + Math.min(a.x, b.x), y: l.box.y + Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
      if (inBox.w > 1 && inBox.h > 1) out.push(screenRect(t, scene, { box: inBox, depth: l.depth }, local));
    }
  }
  return out;
}
