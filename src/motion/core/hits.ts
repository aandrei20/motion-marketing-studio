import { rand } from "../../core/random";
import { EASE, prog } from "./easing";

/** 0..1, vârf la cel mai recent impact (≤ cadru) și scădere exponențială. */
export function hitDecay(frame: number, hits: number[], decay = 6): number {
  let best = 0;
  for (const h of hits) if (frame >= h) best = Math.max(best, Math.exp(-(frame - h) / decay));
  return best;
}

/** Punch-in pe ritm: multiplicator de scară care sare la impact și revine. */
export const punch = (frame: number, hits: number[], amount = 0.06, decay = 5): number =>
  1 + amount * hitDecay(frame, hits, decay);

/** Tremur de impact (px), cu sămânță, care se stinge. */
export function shake(
  frame: number,
  hits: Array<{ at: number; amp: number }>,
  seed: string,
  decay = 5,
): { x: number; y: number; r: number } {
  let x = 0;
  let y = 0;
  let r = 0;
  for (const h of hits) {
    if (frame < h.at) continue;
    const k = Math.exp(-(frame - h.at) / decay);
    if (k < 0.01) continue;
    x += (rand(seed, "x", h.at, frame) - 0.5) * 2 * h.amp * k;
    y += (rand(seed, "y", h.at, frame) - 0.5) * 2 * h.amp * k;
    r += (rand(seed, "r", h.at, frame) - 0.5) * 1.2 * k * (h.amp / 16);
  }
  return { x, y, r };
}

/**
 * Flash de expunere (2–3 cadre) pentru impacturi, în locul unui ecran alb plat.
 * Întoarce un filtru CSS sau undefined.
 */
export function exposure(frame: number, hits: number[], amt = 0.6, len = 3): string | undefined {
  let k = 0;
  for (const h of hits) if (frame >= h && frame < h + len) k = Math.max(k, 1 - (frame - h) / len);
  return k > 0.01
    ? `brightness(${(1 + amt * k).toFixed(3)}) contrast(${(1 + 0.18 * k).toFixed(3)}) saturate(${(1 + 0.3 * k).toFixed(3)})`
    : undefined;
}

/** Whip zoom în jurul unei tăieturi: scară + blur pentru stratul care iese și cel care intră. */
export function whipZoom(frame: number, cut: number, len = 5, maxScale = 1.9) {
  const tOut = prog(frame, cut - len, cut, EASE.expoIn);
  const tIn = prog(frame, cut, cut + len + 2, EASE.out);
  return {
    out: { s: 1 + (maxScale - 1) * tOut, blur: tOut * 18 },
    in: { s: 1 + (maxScale * 0.55 - 0.55) * (1 - tIn), blur: (1 - tIn) * 14 },
  };
}
