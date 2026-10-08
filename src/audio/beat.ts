/**
 * Ritm: detecția BPM și a fazei (primul timp) dintr-un fișier muzical, plus utilitare de beat grid.
 * Metodă: anvelopă de onset (flux spectral pe benzi) → autocorelație pe intervalul 70–180 BPM →
 * fază aleasă ca suma maximă a onset-urilor pe grila de bătăi.
 */
import type { BeatGrid } from "../core/schema";
import { band } from "./dsp";
import type { Stereo } from "./wav";

/** FFT radix-2 complexă, în loc. */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

export function onsetEnvelope(s: Stereo, hop = 512, size = 1024): { env: Float32Array; frameSec: number } {
  const n = s.L.length;
  const frames = Math.max(0, Math.floor((n - size) / hop));
  const env = new Float32Array(frames);
  const win = new Float64Array(size).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1)));
  let prev = new Float64Array(size / 2);
  for (let f = 0; f < frames; f++) {
    const re = new Float64Array(size);
    const im = new Float64Array(size);
    const o = f * hop;
    for (let i = 0; i < size; i++) re[i] = ((s.L[o + i] + s.R[o + i]) / 2) * win[i];
    fft(re, im);
    const mag = new Float64Array(size / 2);
    let flux = 0;
    for (let k = 1; k < size / 2; k++) {
      mag[k] = Math.log1p(100 * Math.hypot(re[k], im[k]));
      const d = mag[k] - prev[k];
      // greutate mai mare pe frecvențe joase (tobă mare) și pe atacuri
      if (d > 0) flux += d * (k < 20 ? 2 : 1);
    }
    env[f] = flux;
    prev = mag;
  }
  // scădem media locală (adaptive threshold) și normalizăm
  const out = new Float32Array(frames);
  const w = 8;
  for (let i = 0; i < frames; i++) {
    let m = 0;
    let c = 0;
    for (let k = Math.max(0, i - w); k < Math.min(frames, i + w + 1); k++) {
      m += env[k];
      c++;
    }
    out[i] = Math.max(0, env[i] - m / c);
  }
  return { env: out, frameSec: hop / s.sr };
}

export function detectBeatGrid(s: Stereo, minBpm = 70, maxBpm = 180): BeatGrid {
  const { env, frameSec } = onsetEnvelope(s);
  const at = (t: number) => {
    const i = Math.floor(t);
    const f = t - i;
    return (env[i] ?? 0) * (1 - f) + (env[i + 1] ?? 0) * f;
  };
  /**
   * Pentru fiecare tempo candidat: media anvelopei pe bătăi (faza cea mai bună) minus media pe
   * pozițiile dintre bătăi. Un tempo corect are vârfuri pe bătăi și văi între ele; tempo-urile
   * „înrudite” (4/3, 3/2) pică pe contratimpi și pierd.
   */
  const scoreFor = (bpm: number) => {
    const lag = 60 / bpm / frameSec;
    let best = { score: -Infinity, phase: 0 };
    for (let ph = 0; ph < lag; ph += 0.5) {
      let on = 0;
      let off = 0;
      let c = 0;
      for (let t = ph; t + lag / 2 < env.length; t += lag) {
        on += at(t);
        off += at(t + lag / 2) * 0.5 + at(t + lag / 4) * 0.25 + at(t + (3 * lag) / 4) * 0.25;
        c++;
      }
      const sc = c ? (on - 0.5 * off) / c : 0;
      if (sc > best.score) best = { score: sc, phase: ph };
    }
    return best;
  };
  const scores: Array<{ bpm: number; score: number; phase: number }> = [];
  for (let bpm = minBpm; bpm <= maxBpm; bpm += 0.25) {
    const r = scoreFor(bpm);
    // preferință ușoară pentru 90–150 BPM (ambiguitatea de octavă)
    const prior = Math.exp(-0.5 * (Math.log2(bpm / 120) / 0.8) ** 2);
    scores.push({ bpm, score: r.score * (0.85 + 0.15 * prior), phase: r.phase });
  }
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  const best = sorted[0];
  const rival = sorted.find((x) => Math.abs(x.bpm - best.bpm) > 3 && Math.abs(x.bpm - best.bpm * 2) > 3 && Math.abs(x.bpm - best.bpm / 2) > 3);
  const confidence = rival && best.score > 0 ? Math.max(0, Math.min(1, 1 - rival.score / best.score)) : 1;
  return { bpm: Math.round(best.bpm * 4) / 4, offsetSec: lowBandPhase(s, best.bpm) ?? best.phase * frameSec, beatsPerBar: 4, source: "detected", confidence, sections: [] };
}

/**
 * Faza bătăilor din banda joasă (toba mare): anvelopa sub ~110 Hz, apoi derivata pozitivă.
 * Basul pe contratimp are atac lent, deci câștigă atacurile tobei mari, care cad pe timp.
 */
function lowBandPhase(s: Stereo, bpm: number): number | null {
  const mono = new Float32Array(s.L.length);
  for (let i = 0; i < mono.length; i++) mono[i] = (s.L[i] + s.R[i]) / 2;
  const low = band(mono, null, 110, 4, s.sr);
  const hop = 128;
  const frames = Math.floor(low.length / hop);
  const e = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let m = 0;
    for (let i = f * hop; i < (f + 1) * hop; i++) m = Math.max(m, Math.abs(low[i]));
    e[f] = m;
  }
  // maxim pe ~20 ms (cel puțin o perioadă la 50 Hz), ca anvelopa să nu oscileze cu forma de undă
  const w = Math.max(1, Math.round((0.02 * s.sr) / hop));
  const env = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let m = 0;
    for (let k = Math.max(0, f - w + 1); k <= f; k++) m = Math.max(m, e[k]);
    env[f] = m;
  }
  const on = new Float32Array(frames);
  for (let f = 1; f < frames; f++) on[f] = Math.max(0, env[f] - env[f - 1]);
  const total = on.reduce((a, b) => a + b, 0);
  if (total <= 1e-6) return null;
  const lag = (60 / bpm) * (s.sr / hop);
  let best = -1;
  let bestPh = 0;
  for (let ph = 0; ph < lag; ph += 0.5) {
    let sum = 0;
    for (let t = ph; t < frames; t += lag) {
      const i = Math.round(t);
      sum += Math.max(on[i] ?? 0, on[i + 1] ?? 0, on[i - 1] ?? 0);
    }
    if (sum > best) {
      best = sum;
      bestPh = ph;
    }
  }
  return (bestPh * hop) / s.sr;
}

/** Momentele bătăilor (secunde) dintr-un beat grid, până la `durationSec`. */
export function beatTimes(g: BeatGrid, durationSec: number, every = 1): number[] {
  const beat = 60 / g.bpm;
  const out: number[] = [];
  for (let t = g.offsetSec; t <= durationSec + 1e-6; t += beat * every) out.push(t);
  return out;
}

/** Cea mai apropiată bătaie (sau măsură) de un timp dat. */
export function snapToGrid(g: BeatGrid, sec: number, unit: "beat" | "bar" = "beat"): number {
  const step = (60 / g.bpm) * (unit === "bar" ? g.beatsPerBar : 1);
  const k = Math.round((sec - g.offsetSec) / step);
  return Math.max(0, g.offsetSec + k * step);
}
