import { spring } from "remotion";
import type { CameraKey, TimelineCamera } from "../../core/schema";
import { fbm1 } from "../../core/random";
import { EASE, SPRINGS, clamp, prog } from "../core/easing";
import { hitDecay, shake as shakeAt } from "../core/hits";

export interface CamState {
  fx: number;
  fy: number;
  zoom: number;
  rotate: number;
  rotateX: number;
  rotateY: number;
  /** decalaje de la mâna liberă și tremur, px */
  ox: number;
  oy: number;
  or: number;
}

function easeFor(name: CameraKey["ease"]): (t: number) => number {
  switch (name) {
    case "linear":
      return EASE.linear;
    case "out":
      return EASE.out;
    case "in":
      return EASE.in;
    case "snap":
      return EASE.ramp;
    default:
      return EASE.inOut;
  }
}

function sampleKeys(keys: CameraKey[], f: number, fps: number): Omit<CamState, "ox" | "oy" | "or"> {
  const first = keys[0];
  if (f <= first.at || keys.length === 1) return { fx: first.x, fy: first.y, zoom: first.zoom, rotate: first.rotate, rotateX: first.rotateX, rotateY: first.rotateY };
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1];
    const b = keys[i];
    if (f <= b.at) {
      const t =
        b.ease === "spring"
          ? clamp(spring({ frame: f - a.at, fps, config: SPRINGS.cam }), 0, 1.2)
          : prog(f, a.at, b.at, easeFor(b.ease));
      return {
        fx: a.x + (b.x - a.x) * t,
        fy: a.y + (b.y - a.y) * t,
        // zoom geometric: push-in-ul se simte liniar pentru ochi
        zoom: a.zoom * (b.zoom / a.zoom) ** t,
        rotate: a.rotate + (b.rotate - a.rotate) * t,
        rotateX: a.rotateX + (b.rotateX - a.rotateX) * t,
        rotateY: a.rotateY + (b.rotateY - a.rotateY) * t,
      };
    }
  }
  const last = keys[keys.length - 1];
  return { fx: last.x, fy: last.y, zoom: last.zoom, rotate: last.rotate, rotateX: last.rotateX, rotateY: last.rotateY };
}

export function sampleCamera(cam: TimelineCamera, frame: number, fps: number, seed: string): CamState {
  const base = sampleKeys(cam.keys, frame, fps);
  let ox = 0;
  let oy = 0;
  let or = 0;
  if (cam.handheld > 0) {
    const t = frame / fps;
    ox += fbm1(`${seed}:hx`, t * 0.9) * cam.handheld;
    oy += fbm1(`${seed}:hy`, t * 0.8) * cam.handheld * 0.8;
    or += fbm1(`${seed}:hr`, t * 0.6) * cam.handheld * 0.02;
  }
  if (cam.shake.length) {
    const s = shakeAt(frame, cam.shake, `${seed}:shake`);
    ox += s.x;
    oy += s.y;
    or += s.r;
  }
  let zoom = base.zoom;
  if (cam.punches.length) {
    for (const p of cam.punches) zoom *= 1 + p.amount * hitDecay(frame, [p.at], 5);
  }
  return { ...base, zoom, ox, oy, or };
}

/** Transformarea CSS (origine 0 0) pentru un strat la adâncimea `d`. d = 0 → fix pe ecran. */
export function layerTransform(s: CamState, d: number, W: number, H: number, perspective: number): string {
  if (d === 0) return "none";
  const fx = W / 2 + (s.fx - W / 2) * d;
  const fy = H / 2 + (s.fy - H / 2) * d;
  const z = d <= 1 ? 1 + (s.zoom - 1) * d : s.zoom ** d;
  const parts = [`translate(${(W / 2 + s.ox * d).toFixed(3)}px, ${(H / 2 + s.oy * d).toFixed(3)}px)`];
  if (s.rotateX || s.rotateY) parts.push(`perspective(${perspective}px)`, `rotateX(${(s.rotateX * d).toFixed(3)}deg)`, `rotateY(${(s.rotateY * d).toFixed(3)}deg)`);
  if (s.rotate || s.or) parts.push(`rotate(${((s.rotate + s.or) * d).toFixed(3)}deg)`);
  parts.push(`scale(${z.toFixed(5)})`, `translate(${(-fx).toFixed(3)}px, ${(-fy).toFixed(3)}px)`);
  return parts.join(" ");
}

/** Blur de mișcare din viteza camerei: [x, y] px pentru un filtru direcțional. */
export function cameraMotionBlur(cam: TimelineCamera, frame: number, fps: number, seed: string, d = 1): [number, number] {
  if (!cam.motionBlur) return [0, 0];
  const a = sampleCamera(cam, frame - 0.5, fps, seed);
  const b = sampleCamera(cam, frame + 0.5, fps, seed);
  const vx = Math.abs((b.fx - a.fx) * b.zoom + (b.ox - a.ox)) * d;
  const vy = Math.abs((b.fy - a.fy) * b.zoom + (b.oy - a.oy)) * d;
  const vz = Math.abs(Math.log(b.zoom / a.zoom)) * 900 * d;
  const k = 0.32;
  const bx = clamp(vx * k - 1.5 + vz * 0.25, 0, 28);
  const by = clamp(vy * k - 1.5 + vz * 0.25, 0, 28);
  return [bx < 0.3 ? 0 : bx, by < 0.3 ? 0 : by];
}

/** Profunzimea de câmp: blur pentru un strat la adâncimea d. */
export function dofBlur(cam: TimelineCamera, frame: number, d: number): number {
  const dof = cam.depthOfField;
  if (!dof) return 0;
  let focus = dof.focusDepth;
  const keys = dof.keys;
  if (keys.length) {
    focus = keys[0].focusDepth;
    for (let i = 1; i < keys.length; i++) {
      const a = keys[i - 1];
      const b = keys[i];
      if (frame >= b.at) focus = b.focusDepth;
      else if (frame > a.at) {
        focus = a.focusDepth + (b.focusDepth - a.focusDepth) * prog(frame, a.at, b.at, EASE.inOut);
        break;
      }
    }
  }
  return Math.abs(d - focus) * dof.strength;
}
