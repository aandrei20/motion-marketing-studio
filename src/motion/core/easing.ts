/**
 * Vocabularul de mișcare. Totul este funcție pură de cadru (randări deterministe).
 * Portat și generalizat din kitul folosit la prototipul anterior.
 */
import { Easing, interpolate, spring } from "remotion";

export const clampOpts = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export type SpringCfg = { damping: number; stiffness: number; mass: number; overshootClamping?: boolean };

export const SPRINGS = {
  /** pop-up: ~12% depășire, se așază în ~9 cadre la 30 fps */
  pop: { damping: 10, stiffness: 260, mass: 0.7 },
  /** slam: depășire mică, rapid */
  slam: { damping: 13, stiffness: 420, mass: 0.8 },
  /** text de corp: amortizat critic, fără depășire */
  body: { damping: 30, stiffness: 220, mass: 1, overshootClamping: true },
  /** elemente de interfață */
  ui: { damping: 16, stiffness: 170, mass: 0.9 },
  /** cameră */
  cam: { damping: 22, stiffness: 140, mass: 1, overshootClamping: true },
  /** lent, premium */
  soft: { damping: 26, stiffness: 90, mass: 1.1, overshootClamping: true },
} as const satisfies Record<string, SpringCfg>;
export type SpringName = keyof typeof SPRINGS;

export const EASE = {
  linear: (t: number) => t,
  out: Easing.bezier(0.16, 1, 0.3, 1),
  in: Easing.bezier(0.7, 0, 0.84, 0),
  inOut: Easing.bezier(0.83, 0, 0.17, 1),
  smooth: Easing.bezier(0.45, 0, 0.2, 1),
  snap: Easing.bezier(0.55, 0, 1, 0.45),
  expoIn: Easing.bezier(0.95, 0.05, 0.795, 0.035),
  expoOut: Easing.bezier(0.19, 1, 0.22, 1),
  /** speed ramp: aproape oprit, apoi accelerare bruscă */
  ramp: Easing.bezier(0.9, 0, 0.1, 1),
} as const;
export type EaseName = keyof typeof EASE;

/** Progres de arc 0..1(+depășire) pornit la cadrul `at`. */
export function sp(frame: number, fps: number, at: number, cfg: SpringCfg = SPRINGS.pop): number {
  return frame < at ? 0 : spring({ frame: frame - at, fps, config: cfg });
}

/** Progres liniar 0..1 între a și b, cu easing. */
export function prog(frame: number, a: number, b: number, easing: (t: number) => number = EASE.linear): number {
  if (b <= a) return frame >= b ? 1 : 0;
  return interpolate(frame, [a, b], [0, 1], { ...clampOpts, easing });
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Viteza (unități/cadru) a oricărei funcții cadru→valoare, pentru motion blur. */
export const velocity = (fn: (f: number) => number, frame: number): number => fn(frame + 0.5) - fn(frame - 0.5);

/**
 * Intrare + ieșire standard pentru un element: arc la `inAt`, menținere, ieșire rapidă (snap)
 * care se termină la `outAt`. Întoarce progresul de intrare (cu depășire) și de ieșire.
 */
export function enterExit(
  frame: number,
  fps: number,
  inAt: number,
  outAt: number,
  cfg: SpringCfg = SPRINGS.pop,
  exitFrames = 5,
): { enter: number; exit: number } {
  const enter = sp(frame, fps, inAt, cfg);
  const exit = outAt > inAt ? prog(frame, outAt - exitFrames, outAt, EASE.snap) : 0;
  return { enter, exit };
}
