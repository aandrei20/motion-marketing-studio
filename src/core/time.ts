/** Conversii între cadre, secunde și timecode. Browser-safe. */

export const secToFrames = (sec: number, fps: number): number => Math.round(sec * fps);
export const framesToSec = (frames: number, fps: number): number => frames / fps;

/** 14.5 s → "00:14.50" */
export function formatTimecode(frames: number, fps: number): string {
  const total = frames / fps;
  const m = Math.floor(total / 60);
  const s = total - m * 60;
  return `${String(m).padStart(2, "0")}:${s.toFixed(2).padStart(5, "0")}`;
}

/**
 * Acceptă „14”, „14.3”, „14,3”, „00:14”, „0:14.5”, „1:02”, „la secunda 14”.
 * Întoarce secunde sau null dacă textul nu conține un timp.
 */
export function parseTimeToSec(text: string): number | null {
  const t = text.trim().replace(",", ".");
  const mmss = t.match(/(\d{1,2}):(\d{1,2}(?:\.\d+)?)/);
  if (mmss) return Number(mmss[1]) * 60 + Number(mmss[2]);
  const plain = t.match(/(\d+(?:\.\d+)?)\s*(?:s|sec|secunde|secunda|seconds?)?\b/);
  if (plain) return Number(plain[1]);
  return null;
}
