import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ffmpeg } from "../core/binaries";
import { PATHS } from "../core/paths";
import { readWav, type Stereo } from "./wav";

/**
 * Decodează orice fișier audio/video acceptat de FFmpeg-ul din Remotion (mp3, aac/m4a, wav, flac,
 * ogg/opus, mp4, webm) în stereo 48 kHz. Rezultatul se ține în cache după conținutul fișierului.
 */
export async function decodeAudio(file: string): Promise<Stereo> {
  const abs = path.resolve(file);
  const hash = crypto.createHash("sha256").update(fs.readFileSync(abs)).digest("hex").slice(0, 20);
  const out = path.join(PATHS.cache, "decoded", `${hash}.wav`);
  if (!fs.existsSync(out)) {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await ffmpeg(["-y", "-i", abs, "-vn", "-ac", "2", "-ar", "48000", "-c:a", "pcm_s24le", "-f", "wav", out]);
  }
  return readWav(out);
}

/** Taie liniștea de la capete (prag în dBFS); întoarce bufferul tăiat și secundele scoase la început. */
export function trimSilence(s: Stereo, thresholdDb = -45, padSec = 0.03): { audio: Stereo; headSec: number } {
  const thr = 10 ** (thresholdDb / 20);
  const win = Math.round(0.01 * s.sr);
  const n = s.L.length;
  const level = (i: number) => {
    let m = 0;
    for (let k = i; k < Math.min(n, i + win); k++) m = Math.max(m, Math.abs(s.L[k]), Math.abs(s.R[k]));
    return m;
  };
  let a = 0;
  while (a < n && level(a) < thr) a += win;
  let b = n;
  while (b > a && level(Math.max(0, b - win)) < thr) b -= win;
  if (a >= b) return { audio: s, headSec: 0 };
  const pad = Math.round(padSec * s.sr);
  const start = Math.max(0, a - pad);
  const end = Math.min(n, b + pad * 2);
  return { audio: { sr: s.sr, L: s.L.slice(start, end), R: s.R.slice(start, end) }, headSec: start / s.sr };
}
