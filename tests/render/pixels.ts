/**
 * Compararea a două randări ale aceluiași cadru.
 *
 * Calculele motorului sunt deterministe (totul vine din numărul cadrului și din sămânță), iar timeline-ul
 * compilat e identic octet cu octet (tests/integration). Rasterizarea Chrome (GPU sau software) poate însă
 * produce, rar, diferențe de 1–2 niveluri din 255 între randări (la marginea plăcilor de rasterizare sau
 * în filtrele SVG): invizibile. Un bug real de determinism (aleator nefixat, timp real) dă diferențe mari.
 */
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { binaryPath } from "../../src/core/binaries";

/** Diferența maximă tolerată pe canal (din 255). */
export const RASTER_TOLERANCE = 2;

function rgb(file: string): Buffer {
  return execFileSync(binaryPath("ffmpeg"), ["-v", "error", "-i", file, "-f", "image2pipe", "-c:v", "rawvideo", "-pix_fmt", "rgb24", "-"], { maxBuffer: 1 << 30 });
}

export interface FrameComparison {
  identicalBytes: boolean;
  maxDiff: number;
  differingShare: number;
}

export function compareFrames(a: string, b: string): FrameComparison {
  const h = (f: string) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
  if (h(a) === h(b)) return { identicalBytes: true, maxDiff: 0, differingShare: 0 };
  const x = rgb(a);
  const y = rgb(b);
  if (x.length !== y.length) return { identicalBytes: false, maxDiff: 255, differingShare: 1 };
  let max = 0;
  let n = 0;
  for (let i = 0; i < x.length; i++) {
    const d = Math.abs(x[i] - y[i]);
    if (d) {
      n++;
      if (d > max) max = d;
    }
  }
  return { identicalBytes: false, maxDiff: max, differingShare: n / x.length };
}
