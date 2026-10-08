/**
 * Geometria pe ecran a straturilor: unde ajunge un strat din scenă după mișcarea camerei (aceeași
 * matematică cu src/motion/camera/rig.ts → layerTransform, fără rotații și fără mâna liberă, care
 * deplasează cu câțiva pixeli). Servește compilatorului (subtitrări care nu acoperă interfața) și
 * verificărilor de calitate (ocluzii, lizibilitate).
 */
import type { Rect, Timeline, TimelineLayer, TimelineScene } from "../core/schema";
import { layerZoom, sampleCamera } from "../motion/camera/rig";
import { screenPointToBox } from "../motion/media/media";

export function screenRect(t: Pick<Timeline, "width" | "height" | "fps">, scene: TimelineScene, layer: Pick<TimelineLayer, "box" | "depth">, local: number): Rect {
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
      const a = screenPointToBox(p, l.box, { x: c.box.x, y: c.box.y }, lf, l.durationInFrames);
      const b = screenPointToBox(p, l.box, { x: c.box.x + c.box.w, y: c.box.y + c.box.h }, lf, l.durationInFrames);
      const inBox = { x: l.box.x + Math.min(a.x, b.x), y: l.box.y + Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
      if (inBox.w > 1 && inBox.h > 1) out.push(screenRect(t, scene, { box: inBox, depth: l.depth }, local));
    }
  }
  return out;
}
