/**
 * Măsurători audio: loudness integrat ITU-R BS.1770-4 (LUFS, cu gating), true peak cu
 * supraeșantionare 4×, vârf de eșantion, RMS și detecția tăcerilor.
 */
import { Biquad, gainToDb } from "./dsp";
import type { Stereo } from "./wav";

class FixedBiquad {
  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;
  constructor(private b: [number, number, number], private a: [number, number]) {}
  tick(x: number): number {
    const y = this.b[0] * x + this.b[1] * this.x1 + this.b[2] * this.x2 - this.a[0] * this.y1 - this.a[1] * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

/** Filtrul de ponderare K. La 48 kHz folosește coeficienții exacți din standard. */
function kWeight(x: Float32Array, sr: number): Float32Array {
  const out = new Float32Array(x.length);
  if (sr === 48000) {
    const s1 = new FixedBiquad([1.53512485958697, -2.69169618940638, 1.19839281085285], [-1.69065929318241, 0.73248077421585]);
    const s2 = new FixedBiquad([1.0, -2.0, 1.0], [-1.99004745483398, 0.99007225036621]);
    for (let i = 0; i < x.length; i++) out[i] = s2.tick(s1.tick(x[i]));
    return out;
  }
  const s1 = new Biquad("highshelf", 1681.974450955533, 0.7071752369554196, 3.999843853973347, sr);
  const s2 = new Biquad("highpass", 38.13547087602444, 0.5003270373238773, 0, sr);
  for (let i = 0; i < x.length; i++) out[i] = s2.tick(s1.tick(x[i]));
  return out;
}

/** Loudness integrat (LUFS). null dacă semnalul e sub poarta absolută (practic tăcere). */
export function integratedLoudness(s: Stereo): number | null {
  const L = kWeight(s.L, s.sr);
  const R = kWeight(s.R, s.sr);
  const block = Math.round(0.4 * s.sr);
  const step = Math.round(0.1 * s.sr);
  const zs: number[] = [];
  for (let start = 0; start + block <= L.length; start += step) {
    let sl = 0;
    let sr = 0;
    for (let i = start; i < start + block; i++) {
      sl += L[i] * L[i];
      sr += R[i] * R[i];
    }
    zs.push(sl / block + sr / block);
  }
  const lk = (z: number) => -0.691 + 10 * Math.log10(z);
  const abs = zs.filter((z) => z > 0 && lk(z) > -70);
  if (!abs.length) return null;
  const meanAbs = abs.reduce((a, b) => a + b, 0) / abs.length;
  const rel = lk(meanAbs) - 10;
  const gated = abs.filter((z) => lk(z) > rel);
  if (!gated.length) return null;
  return lk(gated.reduce((a, b) => a + b, 0) / gated.length);
}

// interpolator polifazic 4× (sinc cu fereastră Kaiser, 12 coeficienți pe fază)
const OS = 4;
const TAPS = 12;
const PHASES: Float32Array[] = (() => {
  const beta = 6;
  const i0 = (x: number) => {
    let s = 1;
    let t = 1;
    for (let k = 1; k < 30; k++) {
      t *= (x / (2 * k)) ** 2;
      s += t;
    }
    return s;
  };
  const total = TAPS * OS;
  const out: Float32Array[] = [];
  for (let p = 0; p < OS; p++) {
    const ph = new Float32Array(TAPS);
    for (let k = 0; k < TAPS; k++) {
      const n = k * OS + p - total / 2;
      const x = n / OS;
      const sinc = x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
      const w = i0(beta * Math.sqrt(Math.max(0, 1 - ((2 * (k * OS + p)) / (total - 1) - 1) ** 2))) / i0(beta);
      ph[k] = sinc * w;
    }
    out.push(ph);
  }
  return out;
})();

function channelTruePeak(x: Float32Array): number {
  let peak = 0;
  for (let i = 0; i < x.length; i++) {
    const a = Math.abs(x[i]);
    if (a > peak) peak = a;
    for (let p = 1; p < OS; p++) {
      const h = PHASES[p];
      let acc = 0;
      for (let k = 0; k < TAPS; k++) {
        const idx = i - k + TAPS / 2;
        if (idx >= 0 && idx < x.length) acc += x[idx] * h[k];
      }
      const v = Math.abs(acc);
      if (v > peak) peak = v;
    }
  }
  return peak;
}

export function truePeakDb(s: Stereo): number {
  return gainToDb(Math.max(channelTruePeak(s.L), channelTruePeak(s.R)));
}

export function samplePeakDb(s: Stereo): number {
  let p = 0;
  for (let i = 0; i < s.L.length; i++) p = Math.max(p, Math.abs(s.L[i]), Math.abs(s.R[i]));
  return gainToDb(p);
}

export function rmsDb(x: Float32Array): number {
  let acc = 0;
  for (let i = 0; i < x.length; i++) acc += x[i] * x[i];
  return gainToDb(Math.sqrt(acc / Math.max(1, x.length)));
}

export function countClipped(s: Stereo, threshold = 0.9999): number {
  let c = 0;
  for (let i = 0; i < s.L.length; i++) if (Math.abs(s.L[i]) >= threshold || Math.abs(s.R[i]) >= threshold) c++;
  return c;
}

/** Intervalele (secunde) în care nivelul RMS pe 50 ms stă sub prag mai mult de `minSec`. */
export function findSilences(s: Stereo, thresholdDb = -50, minSec = 1): Array<{ startSec: number; endSec: number }> {
  const win = Math.round(0.05 * s.sr);
  const out: Array<{ startSec: number; endSec: number }> = [];
  let runStart = -1;
  for (let start = 0; start < s.L.length; start += win) {
    let acc = 0;
    const end = Math.min(s.L.length, start + win);
    for (let i = start; i < end; i++) acc += (s.L[i] * s.L[i] + s.R[i] * s.R[i]) / 2;
    const db = gainToDb(Math.sqrt(acc / Math.max(1, end - start)));
    if (db < thresholdDb) {
      if (runStart < 0) runStart = start;
    } else if (runStart >= 0) {
      if ((start - runStart) / s.sr >= minSec) out.push({ startSec: runStart / s.sr, endSec: start / s.sr });
      runStart = -1;
    }
  }
  if (runStart >= 0 && (s.L.length - runStart) / s.sr >= minSec) out.push({ startSec: runStart / s.sr, endSec: s.L.length / s.sr });
  return out;
}
