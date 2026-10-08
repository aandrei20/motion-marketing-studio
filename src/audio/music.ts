/**
 * Muzică originală sintetizată (fără sample-uri, deci fără licențe externe), compusă pe structura
 * reclamei: secțiunile vin din scene (energie), tăieturile cad pe măsuri, build-urile urcă spre
 * momentele mari. Deterministă: aceeași intrare → același fișier.
 */
import { hashString, mulberry32 } from "../core/random";
import {
  Biquad,
  adsr,
  band,
  dbToGain,
  haas,
  mtof,
  mul,
  noise,
  pan,
  perc,
  place,
  reverb,
  samples,
  saturate,
  sawOsc,
  sineOsc,
  squareOsc,
  sweep,
} from "./dsp";
import { SR, makeStereo, type Stereo } from "./wav";

export type Mood = "driving" | "uplifting" | "dark" | "calm" | "playful";

export interface MusicSection {
  startSec: number;
  endSec: number;
  /** 0 = liniștit, 1 = maxim */
  energy: number;
  name: string;
}

export interface MusicSpec {
  bpm: number;
  durationSec: number;
  sections: MusicSection[];
  mood: Mood;
  /** nota rădăcină MIDI (implicit în funcție de dispoziție) */
  root?: number;
  seed: number;
  /** momente de accent (secunde) unde cade un crash */
  accents?: number[];
  /** intervale de tăcere intenționată */
  silences?: Array<{ startSec: number; endSec: number }>;
}

// ─── instrumente ─────────────────────────────────────────────────────────────

const env = (n: number, f: (t: number) => number) => {
  const o = new Float32Array(n);
  for (let i = 0; i < n; i++) o[i] = f(i / SR);
  return o;
};

function kick(punch = 1): Float32Array {
  const n = samples(0.42);
  const body = mul(sineOsc((t) => 47 + 125 * Math.exp(-t * 32) + 380 * Math.exp(-t * 260), n), env(n, (t) => Math.exp(-t / 0.2) * Math.min(1, t / 0.0015)));
  const click = mul(band(noise(n, "kick"), 1800, 9000), env(n, (t) => Math.exp(-t * 900) * 0.35 * punch));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = body[i] * 1.1 + click[i];
  return mul(saturate(out, 1.6), 0.95);
}

function clap(seed: number): Float32Array {
  const n = samples(0.32);
  const e = env(n, (t) => {
    let s = 0;
    [0, 0.009, 0.019, 0.027].forEach((off, k) => {
      const tt = t - off;
      if (tt >= 0) s += Math.exp(-tt * (k < 3 ? 230 : 22)) * (k < 3 ? 0.8 : 1);
    });
    return s;
  });
  const x = mul(band(noise(n, `clap${seed}`), 850, 5200), e);
  return mul(x, 0.8 / Math.max(1e-6, x.reduce((m, v) => Math.max(m, Math.abs(v)), 0)));
}

function snare(pitch: number, length: number, seed: number): Float32Array {
  const n = samples(length);
  const body = env(n, (t) => Math.sin(2 * Math.PI * 190 * pitch * t + 3 * Math.exp(-t * 60)) * Math.exp(-t * 28) * 0.5);
  const sn = mul(band(noise(n, `sn${seed}`), 1200 * pitch, 8500), env(n, (t) => Math.exp(-t * 24) * 0.9));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = body[i] + sn[i];
  return mul(saturate(out, 1.3), 0.7);
}

function hat(open: boolean, seed: number): Float32Array {
  const n = samples(open ? 0.32 : 0.06);
  const metal = new Float32Array(n);
  for (const f of [3150, 4270, 5340, 6170, 7230, 8890]) {
    const s = squareOsc(f, n);
    for (let i = 0; i < n; i++) metal[i] += s[i] / 6;
  }
  const nz = noise(n, `hat${seed}`);
  const mixed = new Float32Array(n);
  for (let i = 0; i < n; i++) mixed[i] = metal[i] * 0.6 + nz[i] * 0.7;
  return mul(band(mixed, 6800, 16000), env(n, (t) => Math.exp(-t * (open ? 9 : 75)) * 0.5));
}

function crash(): Float32Array {
  const n = samples(2.2);
  const metal = new Float32Array(n);
  [2870, 3520, 4410, 5320, 6790, 7810, 9230].forEach((f, k) => {
    const s = squareOsc(f * (1 + 0.002 * k), n);
    for (let i = 0; i < n; i++) metal[i] += s[i] * 0.4;
  });
  const nz = noise(n, "crash");
  for (let i = 0; i < n; i++) metal[i] += nz[i] * 0.9;
  const x = mul(band(metal, 3800, 15500), env(n, (t) => Math.exp(-t / 0.65) * Math.min(1, t / 0.004)));
  const p = x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  return mul(x, 0.6 / Math.max(1e-6, p));
}

/** Pluck cu filtru care se închide (anvelopă de filtru), pentru bas și arpegii. */
function pluck(midi: number, length: number, bright: number, seed: number, square = 0): Float32Array {
  const n = samples(length + 0.05);
  const f = mtof(midi);
  const osc = square > 0 ? squareOsc(f, n, 0.5) : sawOsc(f, n, (hashString(`p${seed}`) % 1000) / 1000);
  if (square > 0) {
    const s = sawOsc(f, n);
    for (let i = 0; i < n; i++) osc[i] = osc[i] * square + s[i] * (1 - square);
  }
  const lp = new Biquad("lowpass", 200, 1.1);
  const out = new Float32Array(n);
  const e = adsr(n, 0.003, 0.12, 0.5, 0.03, length);
  for (let i = 0; i < n; i++) {
    if (i % 32 === 0) lp.set(Math.min(16000, f * 1.5 + 6000 * bright * Math.exp((-i / SR) * 14)), 1.1);
    out[i] = lp.tick(osc[i]) * e[i];
  }
  return out;
}

function subBass(midi: number, length: number): Float32Array {
  const n = samples(length);
  return mul(sineOsc(mtof(midi), n), adsr(n, 0.006, 0.4, 0.9, 0.04, Math.max(0.01, length - 0.04)));
}

const DETUNE = [-24, -14, -6, 0, 6, 14, 24];

function supersaw(midis: number[], length: number, cutoff: number, sustain: number, seed: number, release = 0.08): Stereo {
  const n = samples(length + release);
  const out = makeStereo(n);
  const r = mulberry32(hashString(`ss${seed}`));
  for (const m of midis) {
    DETUNE.forEach((c, k) => {
      const v = sawOsc(mtof(m) * 2 ** (c / 1200), n, r());
      const pp = (k / (DETUNE.length - 1)) * 2 - 1;
      place(out, mul(v, c ? 0.6 : 1), 0, 1, pp * 0.85);
    });
  }
  const e = adsr(n, 0.006, 0.18, sustain, release, length);
  const norm = 1 / (midis.length * DETUNE.length * 0.45);
  const fl = new Biquad("lowpass", cutoff, 0.8);
  const fr = new Biquad("lowpass", cutoff, 0.8);
  const hl = new Biquad("highpass", 140, 0.7);
  const hr = new Biquad("highpass", 140, 0.7);
  for (let i = 0; i < n; i++) {
    out.L[i] = hl.tick(fl.tick(out.L[i])) * e[i] * norm;
    out.R[i] = hr.tick(fr.tick(out.R[i])) * e[i] * norm;
  }
  return out;
}

function noiseRiser(length: number, seed: number): Stereo {
  const n = samples(length);
  const y = sweep(noise(n, `nr${seed}`), (t) => 300 * 40 ** Math.min(1, t / length), (t) => 1500 * 9 ** Math.min(1, t / length));
  for (let i = 0; i < n; i++) y[i] *= (i / n) ** 2.2 * 0.5;
  return haas(y, 9);
}

// ─── compoziție ──────────────────────────────────────────────────────────────

const PROGRESSIONS: Record<Mood, { root: number; minor: boolean; chords: number[][] }> = {
  // grade (semitonuri față de rădăcină) pentru fiecare acord
  driving: { root: 53, minor: false, chords: [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]] },
  uplifting: { root: 55, minor: false, chords: [[9, 12, 16], [5, 9, 12], [0, 4, 7], [7, 11, 14]] },
  dark: { root: 50, minor: true, chords: [[0, 3, 7], [8, 12, 15], [3, 7, 10], [10, 14, 17]] },
  calm: { root: 52, minor: false, chords: [[0, 4, 7, 11], [9, 12, 16, 19], [5, 9, 12, 16], [7, 11, 14, 17]] },
  playful: { root: 57, minor: false, chords: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [5, 9, 12]] },
};

export interface MusicResult {
  audio: Stereo;
  /** momentele loviturilor de tobă mare (pentru sincronizare și ducking) */
  kicks: number[];
  barStarts: number[];
  beatSec: number;
}

function energyAt(sections: MusicSection[], t: number): number {
  const s = sections.find((x) => t >= x.startSec && t < x.endSec);
  return s ? s.energy : (sections[sections.length - 1]?.energy ?? 0.5);
}

/** Câștigul de pompare (sidechain) la fiecare lovitură de tobă mare. */
function sidechain(n: number, hits: number[], depth: number, release = 0.14): Float32Array {
  const g = new Float32Array(n).fill(1);
  for (const h of hits) {
    const a = samples(h);
    const b = Math.min(n, a + samples(release * 5));
    for (let i = a; i < b; i++) g[i] = Math.min(g[i], 1 - depth * Math.exp(-(i - a) / SR / release));
  }
  return g;
}

export function composeMusic(spec: MusicSpec): MusicResult {
  const beat = 60 / spec.bpm;
  const bar = beat * 4;
  const step = beat / 4;
  const N = samples(spec.durationSec + 0.5);
  const prog = PROGRESSIONS[spec.mood];
  const root = spec.root ?? prog.root;
  const bus = { kick: makeStereo(N), drums: makeStereo(N), bass: makeStereo(N), chords: makeStereo(N), lead: makeStereo(N), fx: makeStereo(N) };
  const kicks: number[] = [];
  const barStarts: number[] = [];
  const nBars = Math.ceil(spec.durationSec / bar);
  const rnd = mulberry32(spec.seed);
  for (let b = 0; b < nBars; b++) {
    const t0 = b * bar;
    barStarts.push(t0);
    const e = energyAt(spec.sections, t0 + bar / 2);
    const nextE = energyAt(spec.sections, t0 + bar * 1.5);
    const chord = prog.chords[b % prog.chords.length];
    const voicing = chord.map((c) => root + c);
    const bassNote = root - 12 + chord[0];
    const build = nextE - e > 0.25 && b < nBars - 1;
    // pad mereu prezent (lipește secțiunile), mai deschis cu energia
    const padLen = bar;
    const pad = supersaw(voicing, padLen, 700 + 4500 * e, 0.9, b, 0.25);
    place(bus.chords, pad, t0, 0.32 + 0.1 * e);
    for (let s = 0; s < 16; s++) {
      const ts = t0 + s * step;
      if (ts >= spec.durationSec) break;
      // tobă mare: de la energie medie în sus, 4/4
      if (e >= 0.35 && s % 4 === 0) {
        place(bus.kick, kick(), ts, 0.95);
        kicks.push(ts);
      } else if (e >= 0.2 && e < 0.35 && s === 0) {
        place(bus.kick, kick(0.5), ts, 0.6);
        kicks.push(ts);
      }
      if (e >= 0.55 && (s === 4 || s === 12)) place(bus.drums, clap(b * 16 + s), ts, 0.75);
      if (e >= 0.25) {
        if (s % 4 === 2) place(bus.drums, hat(e > 0.65, b * 16 + s), ts, e > 0.65 ? 0.35 : 0.28);
        else if (e >= 0.45) place(bus.drums, hat(false, b * 16 + s), ts, s % 2 ? 0.22 : 0.14);
      }
      // bas: offbeat săltăreț
      if (e >= 0.35 && s % 4 === 2) place(bus.bass, pluck(bassNote, step * 1.7, 0.5, b * 16 + s, 0.35), ts, 0.75);
      // arpegiu pe energie mare
      if (e >= 0.65 && s % 2 === 0) {
        const arpNote = voicing[(s / 2) % voicing.length] + 12;
        place(bus.lead, pluck(arpNote, step * 1.6, 0.9, b * 100 + s), ts, 0.16 + 0.06 * rnd());
      }
    }
    if (e >= 0.35) place(bus.bass, subBass(bassNote, bar), t0, 0.32);
    if (e >= 0.75) {
      for (const [st, ln] of [[0, 1.5], [3, 1.5], [6, 2], [10, 1.5], [13, 2]] as const) {
        place(bus.chords, supersaw([...voicing, voicing[0] + 12], ln * step, 9000, 0.5, b * 7 + st), t0 + st * step, 0.5);
      }
    }
    if (build) {
      // build: rafală de toba mică și riser în ultima măsură înainte de creșterea energiei
      for (let k = 0; k < 16; k++) {
        const ts = t0 + k * step;
        place(bus.drums, snare(1 + (0.7 * k) / 16, 0.12, k), ts, 0.12 + 0.35 * (k / 16) ** 1.5);
      }
      place(bus.fx, noiseRiser(bar, b), t0, 0.5);
    }
  }
  for (const a of spec.accents ?? []) place(bus.drums, crash(), a, 0.45);

  // mixaj: sidechain, reverb pe lead/acorduri, master
  const sc = sidechain(N, kicks, 0.55);
  const scSoft = sidechain(N, kicks, 0.3, 0.1);
  const leadRev = reverb(bus.lead, { size: 0.55, mix: 0.22, damp: 0.4, tail: 0 });
  const chordRev = reverb(bus.chords, { size: 0.6, mix: 0.12, damp: 0.5, tail: 0 });
  const out = makeStereo(N);
  const g = (db: number) => dbToGain(db);
  for (let i = 0; i < N; i++) {
    for (const ch of ["L", "R"] as const) {
      out[ch][i] =
        bus.kick[ch][i] * g(-2) +
        bus.drums[ch][i] * g(-2) +
        bus.bass[ch][i] * sc[i] * g(-3.5) +
        (chordRev[ch][i] ?? 0) * sc[i] * g(-2) +
        (leadRev[ch][i] ?? 0) * scSoft[i] * g(-3) +
        bus.fx[ch][i] * g(-6.5);
    }
  }
  // tăcere intenționată: muzica se oprește curat (fade de 10 ms)
  for (const sil of spec.silences ?? []) {
    const a = samples(sil.startSec);
    const b = Math.min(N, samples(sil.endSec));
    const f = samples(0.01);
    for (let i = Math.max(0, a - f); i < b + f && i < N; i++) {
      const k = i < a ? (a - i) / f : i >= b ? (i - b) / f : 0;
      out.L[i] *= Math.min(1, k);
      out.R[i] *= Math.min(1, k);
    }
  }
  // traducere pe difuzor de telefon: fără sub inutil, puțină prezență
  const hpL = new Biquad("highpass", 32, 0.7);
  const hpR = new Biquad("highpass", 32, 0.7);
  const pL = new Biquad("peaking", 2800, 0.8, 2.5);
  const pR = new Biquad("peaking", 2800, 0.8, 2.5);
  for (let i = 0; i < N; i++) {
    out.L[i] = Math.tanh(pL.tick(hpL.tick(out.L[i])) * 1.1) / Math.tanh(1.1);
    out.R[i] = Math.tanh(pR.tick(hpR.tick(out.R[i])) * 1.1) / Math.tanh(1.1);
  }
  const trimmed: Stereo = { sr: SR, L: out.L.slice(0, samples(spec.durationSec)), R: out.R.slice(0, samples(spec.durationSec)) };
  // stem normalizat la vârf 0.9: nivelul final îl stabilește mixerul
  let peak = 0;
  for (let i = 0; i < trimmed.L.length; i++) peak = Math.max(peak, Math.abs(trimmed.L[i]), Math.abs(trimmed.R[i]));
  if (peak > 0) {
    const g = 0.9 / peak;
    for (let i = 0; i < trimmed.L.length; i++) {
      trimmed.L[i] *= g;
      trimmed.R[i] *= g;
    }
  }
  return { audio: trimmed, kicks, barStarts, beatSec: beat };
}

export { pan, perc };
