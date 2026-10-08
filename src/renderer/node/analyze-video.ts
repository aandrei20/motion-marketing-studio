/**
 * Verificări pe video-ul randat: cadre negre, flash-uri (salturi bruște de luminozitate), cadre identice
 * prelungite (îngheț nedorit). Se citește video-ul real, nu timeline-ul.
 */
import { frameDiff, frameLuma, readFrames } from "../../assets/frames";
import { formatTimecode } from "../../core/time";

export interface VideoCheck {
  frames: number;
  blackFrames: number[];
  flashes: number[];
  maxFlashesPerSec: number;
  frozenRuns: Array<{ from: number; to: number }>;
  meanLuma: number;
  problems: string[];
}

export async function analyzeVideo(file: string, fps: number): Promise<VideoCheck> {
  const seq = await readFrames(file, { fps, width: 80 });
  const luma = seq.frames.map(frameLuma);
  const blackFrames = luma.map((l, i) => (l < 0.015 ? i : -1)).filter((i) => i >= 0);
  // flash: luminozitatea urcă brusc (> +0.25) și revine în maximum 6 cadre
  const flashes: number[] = [];
  for (let i = 1; i < luma.length; i++) {
    if (luma[i] - luma[i - 1] > 0.25) {
      const back = luma.slice(i + 1, i + 7).some((l) => l < luma[i] - 0.2);
      if (back) flashes.push(i);
    }
  }
  let maxPerSec = 0;
  for (const f of flashes) maxPerSec = Math.max(maxPerSec, flashes.filter((g) => g >= f && g < f + fps).length);
  const frozenRuns: Array<{ from: number; to: number }> = [];
  let runStart = -1;
  for (let i = 1; i < seq.frames.length; i++) {
    const same = frameDiff(seq.frames[i - 1], seq.frames[i]) < 0.0005;
    if (same && runStart < 0) runStart = i - 1;
    if ((!same || i === seq.frames.length - 1) && runStart >= 0) {
      const end = same ? i : i - 1;
      if (end - runStart > fps * 3) frozenRuns.push({ from: runStart, to: end });
      runStart = -1;
    }
  }
  const problems: string[] = [];
  if (blackFrames.length) problems.push(`${blackFrames.length} cadre (aproape) negre, primul la ${formatTimecode(blackFrames[0], fps)}.`);
  if (maxPerSec > 2) problems.push(`Până la ${maxPerSec} flash-uri pe secundă (maximum 2).`);
  for (const r of frozenRuns) problems.push(`Imagine înghețată ${formatTimecode(r.from, fps)}–${formatTimecode(r.to, fps)} (peste 3 s).`);
  return { frames: seq.frames.length, blackFrames, flashes, maxFlashesPerSec: maxPerSec, frozenRuns, meanLuma: luma.reduce((a, b) => a + b, 0) / Math.max(1, luma.length), problems };
}
