/**
 * Primitive DSP deterministe (fără dependențe). Mono = Float32Array; stereo = { L, R }.
 * Portate și generalizate din motorul audio al prototipului (numpy) în TypeScript.
 */
import { hashString, mulberry32 } from "../core/random";
import { SR, makeStereo, type Stereo } from "./wav";

export const samples = (t: number, sr = SR): number => Math.max(0, Math.round(t * sr));
export const mtof = (m: number): number => 440 * 2 ** ((m - 69) / 12);
export const dbToGain = (db: number): number => 10 ** (db / 20);
export const gainToDb = (g: number): number => (g <= 1e-12 ? -240 : 20 * Math.log10(g));

/** Zgomot gaussian determinist (Box–Muller pe mulberry32). */
export function noise(n: number, seed: string | number): Float32Array {
  const r = mulberry32(typeof seed === "number" ? seed : hashString(seed));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 2) {
    const u = Math.max(1e-12, r());
    const v = r();
    const m = Math.sqrt(-2 * Math.log(u));
    out[i] = m * Math.cos(2 * Math.PI * v);
    if (i + 1 < n) out[i + 1] = m * Math.sin(2 * Math.PI * v);
  }
  return out;
}

export function tArr(n: number, sr = SR): Float32Array {
  const t = new Float32Array(n);
  for (let i = 0; i < n; i++) t[i] = i / sr;
  return t;
}

/** Oscilator sinus cu frecvență variabilă (funcție de timp sau constantă). */
export function sineOsc(freq: number | ((t: number) => number), n: number, phase0 = 0, sr = SR): Float32Array {
  const out = new Float32Array(n);
  let ph = phase0;
  for (let i = 0; i < n; i++) {
    const f = typeof freq === "number" ? freq : freq(i / sr);
    out[i] = Math.sin(ph);
    ph += (2 * Math.PI * f) / sr;
  }
  return out;
}

function polyblep(t: number, dt: number): number {
  if (t < dt) {
    const x = t / dt;
    return x + x - x * x - 1;
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt;
    return x * x + x + x + 1;
  }
  return 0;
}

/** Dinte de fierăstrău cu bandă limitată (PolyBLEP). */
export function sawOsc(freq: number | ((t: number) => number), n: number, phase0 = 0, sr = SR): Float32Array {
  const out = new Float32Array(n);
  let ph = phase0 % 1;
  for (let i = 0; i < n; i++) {
    const f = typeof freq === "number" ? freq : freq(i / sr);
    const dt = Math.min(0.49, f / sr);
    out[i] = 2 * ph - 1 - polyblep(ph, dt);
    ph += dt;
    if (ph >= 1) ph -= 1;
  }
  return out;
}

export function squareOsc(freq: number | ((t: number) => number), n: number, width = 0.5, phase0 = 0, sr = SR): Float32Array {
  const a = sawOsc(freq, n, phase0, sr);
  const b = sawOsc(freq, n, (phase0 + width) % 1, sr);
  for (let i = 0; i < n; i++) a[i] = 0.5 * (a[i] - b[i]);
  return a;
}

/** Anvelopă percutantă: atac liniar, apoi scădere exponențială. */
export function perc(n: number, attack: number, decay: number, sr = SR): Float32Array {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    out[i] = Math.min(1, t / Math.max(attack, 1e-6)) * Math.exp(-t / decay);
  }
  return out;
}

export function adsr(n: number, a: number, d: number, s: number, r: number, gate: number, sr = SR): Float32Array {
  const out = new Float32Array(n);
  const lvlAt = (t: number) => (t < a ? t / Math.max(a, 1e-6) : s + (1 - s) * Math.exp(-(t - a) / Math.max(d, 1e-6)));
  const g = lvlAt(gate);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    out[i] = t < gate ? lvlAt(t) : g * Math.exp(-(t - gate) / Math.max(r, 1e-6));
  }
  return out;
}

export function mul(a: Float32Array, b: Float32Array | number): Float32Array {
  const out = new Float32Array(a.length);
  if (typeof b === "number") for (let i = 0; i < a.length; i++) out[i] = a[i] * b;
  else for (let i = 0; i < a.length; i++) out[i] = a[i] * (b[i] ?? 0);
  return out;
}

export function add(...xs: Float32Array[]): Float32Array {
  const n = Math.max(...xs.map((x) => x.length));
  const out = new Float32Array(n);
  for (const x of xs) for (let i = 0; i < x.length; i++) out[i] += x[i];
  return out;
}

export function saturate(x: Float32Array, drive = 1.5): Float32Array {
  const k = Math.tanh(drive);
  const out = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) out[i] = Math.tanh(x[i] * drive) / k;
  return out;
}

export function peakOf(x: Float32Array): number {
  let p = 0;
  for (let i = 0; i < x.length; i++) p = Math.max(p, Math.abs(x[i]));
  return p;
}

export function normalize(x: Float32Array, peak = 0.8): Float32Array {
  const p = peakOf(x);
  return p > 0 ? mul(x, peak / p) : x;
}

// ─── filtre biquad (RBJ cookbook) ───────────────────────────────────────────

export type BiquadType = "lowpass" | "highpass" | "bandpass" | "peaking" | "lowshelf" | "highshelf";

export class Biquad {
  private b0 = 1;
  private b1 = 0;
  private b2 = 0;
  private a1 = 0;
  private a2 = 0;
  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;
  constructor(
    private type: BiquadType,
    f0: number,
    q = Math.SQRT1_2,
    gainDb = 0,
    private sr = SR,
  ) {
    this.set(f0, q, gainDb);
  }
  set(f0: number, q = Math.SQRT1_2, gainDb = 0): void {
    const f = Math.min(Math.max(f0, 10), this.sr * 0.49);
    const w = (2 * Math.PI * f) / this.sr;
    const cos = Math.cos(w);
    const sin = Math.sin(w);
    const alpha = sin / (2 * q);
    const A = 10 ** (gainDb / 40);
    let b0: number, b1: number, b2: number, a0: number, a1: number, a2: number;
    switch (this.type) {
      case "lowpass":
        [b0, b1, b2, a0, a1, a2] = [(1 - cos) / 2, 1 - cos, (1 - cos) / 2, 1 + alpha, -2 * cos, 1 - alpha];
        break;
      case "highpass":
        [b0, b1, b2, a0, a1, a2] = [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2, 1 + alpha, -2 * cos, 1 - alpha];
        break;
      case "bandpass":
        [b0, b1, b2, a0, a1, a2] = [alpha, 0, -alpha, 1 + alpha, -2 * cos, 1 - alpha];
        break;
      case "peaking":
        [b0, b1, b2, a0, a1, a2] = [1 + alpha * A, -2 * cos, 1 - alpha * A, 1 + alpha / A, -2 * cos, 1 - alpha / A];
        break;
      case "lowshelf": {
        const s = 2 * Math.sqrt(A) * alpha;
        [b0, b1, b2, a0, a1, a2] = [A * (A + 1 - (A - 1) * cos + s), 2 * A * (A - 1 - (A + 1) * cos), A * (A + 1 - (A - 1) * cos - s), A + 1 + (A - 1) * cos + s, -2 * (A - 1 + (A + 1) * cos), A + 1 + (A - 1) * cos - s];
        break;
      }
      case "highshelf": {
        const s = 2 * Math.sqrt(A) * alpha;
        [b0, b1, b2, a0, a1, a2] = [A * (A + 1 + (A - 1) * cos + s), -2 * A * (A - 1 + (A + 1) * cos), A * (A + 1 + (A - 1) * cos - s), A + 1 - (A - 1) * cos + s, 2 * (A - 1 - (A + 1) * cos), A + 1 - (A - 1) * cos - s];
        break;
      }
    }
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = a1 / a0;
    this.a2 = a2 / a0;
  }
  tick(x: number): number {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
  process(x: Float32Array): Float32Array {
    const out = new Float32Array(x.length);
    for (let i = 0; i < x.length; i++) out[i] = this.tick(x[i]);
    return out;
  }
}

const BUTTER4 = [0.5411961, 1.3065630];

/** Filtru trece-bandă Butterworth (ordin 2 sau 4) între lo și hi; oricare poate lipsi. */
export function band(x: Float32Array, lo: number | null, hi: number | null, order: 2 | 4 = 4, sr = SR): Float32Array {
  let y = x;
  const qs = order === 4 ? BUTTER4 : [Math.SQRT1_2];
  for (const q of qs) {
    if (hi) y = new Biquad("lowpass", hi, q, 0, sr).process(y);
    if (lo) y = new Biquad("highpass", lo, q, 0, sr).process(y);
  }
  return y;
}

export function eq(x: Float32Array, type: BiquadType, f0: number, gainDb: number, q = 0.9, sr = SR): Float32Array {
  return new Biquad(type, f0, q, gainDb, sr).process(x);
}

/** Filtru variabil în timp (frecvențele se actualizează la fiecare 32 de eșantioane). */
export function sweep(x: Float32Array, lo: ((t: number) => number) | null, hi: ((t: number) => number) | null, sr = SR): Float32Array {
  const fl = lo ? [new Biquad("highpass", lo(0), 0.7071, 0, sr)] : [];
  const fh = hi ? [new Biquad("lowpass", hi(0), 0.7071, 0, sr)] : [];
  const out = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) {
    if (i % 32 === 0) {
      const t = i / sr;
      if (lo) fl[0].set(lo(t));
      if (hi) fh[0].set(hi(t));
    }
    let v = x[i];
    if (hi) v = fh[0].tick(v);
    if (lo) v = fl[0].tick(v);
    out[i] = v;
  }
  return out;
}

// ─── reverb (Freeverb, determinist) ─────────────────────────────────────────

class Comb {
  private buf: Float32Array;
  private i = 0;
  private store = 0;
  constructor(size: number, private feedback: number, private damp: number) {
    this.buf = new Float32Array(size);
  }
  tick(x: number): number {
    const y = this.buf[this.i];
    this.store = y * (1 - this.damp) + this.store * this.damp;
    this.buf[this.i] = x + this.store * this.feedback;
    this.i = (this.i + 1) % this.buf.length;
    return y;
  }
}
class Allpass {
  private buf: Float32Array;
  private i = 0;
  constructor(size: number) {
    this.buf = new Float32Array(size);
  }
  tick(x: number): number {
    const b = this.buf[this.i];
    const y = -x + b;
    this.buf[this.i] = x + b * 0.5;
    this.i = (this.i + 1) % this.buf.length;
    return y;
  }
}
const COMBS = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
const ALLPASS = [556, 441, 341, 225];

/** Reverb stereo: `size` 0..1 (lungimea cozii), `mix` câtă reverberație, `damp` cât de întunecată. Adaugă coada la final. */
export function reverb(x: Stereo | Float32Array, opts: { size?: number; mix?: number; damp?: number; tail?: number } = {}): Stereo {
  const size = opts.size ?? 0.6;
  const mix = opts.mix ?? 0.2;
  const damp = opts.damp ?? 0.4;
  const tail = samples(opts.tail ?? 0.4 + size * 1.6);
  const L0 = x instanceof Float32Array ? x : x.L;
  const R0 = x instanceof Float32Array ? x : x.R;
  const n = L0.length + tail;
  const out = makeStereo(n);
  const k = SR / 44100;
  const fb = 0.7 + 0.28 * size;
  const mk = (spread: number) => ({ combs: COMBS.map((c) => new Comb(Math.round((c + spread) * k), fb, damp)), aps: ALLPASS.map((a) => new Allpass(Math.round((a + spread) * k))) });
  const cl = mk(0);
  const cr = mk(23);
  for (let i = 0; i < n; i++) {
    const inp = ((L0[i] ?? 0) + (R0[i] ?? 0)) * 0.5 * 0.015;
    let l = 0;
    let r = 0;
    for (const c of cl.combs) l += c.tick(inp);
    for (const c of cr.combs) r += c.tick(inp);
    for (const a of cl.aps) l = a.tick(l);
    for (const a of cr.aps) r = a.tick(r);
    out.L[i] = (L0[i] ?? 0) + l * mix * 3;
    out.R[i] = (R0[i] ?? 0) + r * mix * 3;
  }
  return out;
}

// ─── stereo ─────────────────────────────────────────────────────────────────

/** Mono → stereo cu panoramare de putere constantă (-1 stânga, 1 dreapta). */
export function pan(x: Float32Array, p = 0): Stereo {
  const a = ((p + 1) * Math.PI) / 4;
  const gl = Math.cos(a) * Math.SQRT2;
  const gr = Math.sin(a) * Math.SQRT2;
  return { sr: SR, L: mul(x, gl), R: mul(x, gr) };
}

/** Efect Haas: lărgește un semnal mono întârziind ușor canalul drept. */
export function haas(x: Float32Array, ms = 10): Stereo {
  const d = samples(ms / 1000);
  const R = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) R[i] = 0.8 * (x[i - d] ?? 0) + 0.2 * x[i];
  return { sr: SR, L: Float32Array.from(x), R };
}

/** Pune `x` (mono sau stereo) în bus la timpul t (secunde), cu câștig și panoramare. */
export function place(bus: Stereo, x: Float32Array | Stereo, t: number, gain = 1, panPos = 0): void {
  const s = x instanceof Float32Array ? pan(x, panPos) : x;
  let a = samples(t);
  let start = 0;
  if (a < 0) {
    start = -a;
    a = 0;
  }
  const n = Math.min(s.L.length - start, bus.L.length - a);
  for (let i = 0; i < n; i++) {
    bus.L[a + i] += s.L[start + i] * gain;
    bus.R[a + i] += s.R[start + i] * gain;
  }
}

export function stereoPeak(s: Stereo): number {
  return Math.max(peakOf(s.L), peakOf(s.R));
}

export function scaleStereo(s: Stereo, g: number): Stereo {
  return { sr: s.sr, L: mul(s.L, g), R: mul(s.R, g) };
}

export function normStereo(s: Stereo, peak = 0.8): Stereo {
  const p = stereoPeak(s);
  return p > 0 ? scaleStereo(s, peak / p) : s;
}

/** Rampă liniară scurtă la capete, ca tăieturile să nu pocnească. */
export function fadeEdges(s: Stereo, inSec = 0.005, outSec = 0.01): Stereo {
  const fi = samples(inSec);
  const fo = samples(outSec);
  const n = s.L.length;
  for (let i = 0; i < Math.min(fi, n); i++) {
    s.L[i] *= i / fi;
    s.R[i] *= i / fi;
  }
  for (let i = 0; i < Math.min(fo, n); i++) {
    const g = i / fo;
    s.L[n - 1 - i] *= g;
    s.R[n - 1 - i] *= g;
  }
  return s;
}

/**
 * Limitator cu look-ahead pe vârful de eșantion: câștigul coboară în rampă înaintea vârfului
 * (fereastra de anticipare) și revine exponențial. Garantează |x| ≤ plafon.
 */
export function limit(s: Stereo, ceilingDb = -1.5, lookaheadMs = 3, releaseMs = 80): Stereo {
  const ceil = dbToGain(ceilingDb);
  const n = s.L.length;
  const la = Math.max(1, samples(lookaheadMs / 1000));
  const peak = new Float32Array(n);
  for (let i = 0; i < n; i++) peak[i] = Math.max(Math.abs(s.L[i]), Math.abs(s.R[i]));
  // câștigul necesar în fiecare punct: plafon / vârf (doar unde vârful depășește plafonul)
  const g = new Float32Array(n).fill(1);
  for (let i = 0; i < n; i++) if (peak[i] > ceil) g[i] = ceil / peak[i];
  // rampă înapoi: câștigul începe să scadă cu `la` eșantioane înaintea vârfului
  const step = 1 / la;
  for (let i = n - 2; i >= 0; i--) g[i] = Math.min(g[i], g[i + 1] + step);
  // eliberare exponențială înainte: câștigul nu urcă mai repede decât permite release
  const rel = Math.exp(-1 / Math.max(1, samples(releaseMs / 1000)));
  const out = makeStereo(n, s.sr);
  let cur = 1;
  for (let i = 0; i < n; i++) {
    cur = g[i] < cur ? g[i] : g[i] + (cur - g[i]) * rel;
    const gg = Math.min(cur, g[i]);
    out.L[i] = s.L[i] * gg;
    out.R[i] = s.R[i] * gg;
  }
  return out;
}
