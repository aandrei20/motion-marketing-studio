import path from "node:path";
import { ffmpeg } from "../core/binaries";
import { probe } from "./analyze";

export interface FrameSeq {
  w: number;
  h: number;
  fps: number;
  frames: Uint8Array[];
}

/** Cadre RGB mici dintr-un video, la FPS fix (pentru analiză: tăieturi, flash, cadre negre, mișcare). */
export async function readFrames(file: string, opts: { fps: number; width: number }): Promise<FrameSeq> {
  const abs = path.resolve(file);
  const p = await probe(abs);
  if (!p.width || !p.height) throw new Error(`Nu pot citi dimensiunile video: ${abs}`);
  const w = opts.width;
  const h = Math.max(2, Math.round((p.height / p.width) * w / 2) * 2);
  const r = await ffmpeg(["-i", abs, "-an", "-r", String(opts.fps), "-vf", `scale=${w}:${h}`, "-f", "image2pipe", "-c:v", "rawvideo", "-pix_fmt", "rgb24", "-"]);
  const size = w * h * 3;
  const frames: Uint8Array[] = [];
  for (let o = 0; o + size <= r.stdout.length; o += size) frames.push(new Uint8Array(r.stdout.subarray(o, o + size)));
  return { w, h, fps: opts.fps, frames };
}

export function frameLuma(f: Uint8Array): number {
  let s = 0;
  const n = f.length / 3;
  for (let i = 0; i < n; i++) s += 0.2126 * f[i * 3] + 0.7152 * f[i * 3 + 1] + 0.0722 * f[i * 3 + 2];
  return s / n / 255;
}

/** Diferența medie absolută de luminanță între două cadre (0..1). */
export function frameDiff(a: Uint8Array, b: Uint8Array): number {
  let s = 0;
  const n = a.length / 3;
  for (let i = 0; i < n; i++) {
    const la = 0.2126 * a[i * 3] + 0.7152 * a[i * 3 + 1] + 0.0722 * a[i * 3 + 2];
    const lb = 0.2126 * b[i * 3] + 0.7152 * b[i * 3 + 1] + 0.0722 * b[i * 3 + 2];
    s += Math.abs(la - lb);
  }
  return s / n / 255;
}

export function frameSaturation(f: Uint8Array): number {
  let s = 0;
  const n = f.length / 3;
  for (let i = 0; i < n; i++) {
    const r = f[i * 3];
    const g = f[i * 3 + 1];
    const b = f[i * 3 + 2];
    const mx = Math.max(r, g, b);
    s += mx ? (mx - Math.min(r, g, b)) / mx : 0;
  }
  return s / n;
}
