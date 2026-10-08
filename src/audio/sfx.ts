/**
 * Biblioteca de efecte sonore, sintetizate din cod (originale, fără licențe externe).
 * Fiecare sunet e determinist: același id → aceiași eșantioane. Portată din motorul prototipului.
 */
import fs from "node:fs";
import path from "node:path";
import { PATHS } from "../core/paths";
import {
  add,
  band,
  eq,
  fadeEdges,
  haas,
  mtof,
  mul,
  noise,
  normStereo,
  normalize,
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
  tArr,
} from "./dsp";
import { SR, makeStereo, readWav, writeWav, type Stereo } from "./wav";

const t_ = (dur: number) => tArr(samples(dur));
const env = (t: Float32Array, f: (t: number) => number) => {
  const out = new Float32Array(t.length);
  for (let i = 0; i < t.length; i++) out[i] = f(t[i]);
  return out;
};

function pop(pitch = 1): Stereo {
  const t = t_(0.12);
  const body = mul(sineOsc((tt) => (380 + 900 * (1 - Math.exp(-tt * 60))) * pitch, t.length), env(t, (tt) => Math.exp(-tt * 38) * Math.min(1, tt / 0.001)));
  const click = mul(band(noise(t.length, "pop"), 2000, 9000), env(t, (tt) => Math.exp(-tt * 900) * 0.25));
  return normStereo(reverb(add(body, click), { size: 0.2, mix: 0.08, tail: 0.15 }), 0.8);
}

function slam(weight = 1): Stereo {
  const t = t_(0.35);
  const thump = mul(sineOsc((tt) => 48 + 150 * Math.exp(-tt * 28), t.length), env(t, (tt) => Math.exp(-tt * 11) * weight));
  const snap = mul(band(noise(t.length, "slam"), 1200, 7000), env(t, (tt) => Math.exp(-tt * 160) * 0.7));
  return normStereo(reverb(saturate(add(thump, snap), 1.8), { size: 0.3, mix: 0.12 }), 0.85);
}

function impact(size = 1): Stereo {
  const t = t_(1.6);
  const boom = mul(sineOsc((tt) => 34 + 70 * Math.exp(-tt * 9), t.length), env(t, (tt) => Math.exp(-tt * 2.6) * 1.2));
  const burst = mul(band(noise(t.length, "imp-b"), 80, 2500), env(t, (tt) => Math.exp(-tt * 14) * 0.6));
  const crack = mul(band(noise(t.length, "imp-c"), 2500, 12000), env(t, (tt) => Math.exp(-tt * 60) * 0.3));
  return normStereo(reverb(saturate(mul(add(boom, burst, crack), size), 1.5), { size: 0.85, mix: 0.18, damp: 0.6 }), 0.9);
}

function bassHit(): Stereo {
  const t = t_(1.8);
  const f = (tt: number) => 42 + 33 * Math.exp(-tt * 5) + 140 * Math.exp(-tt * 60);
  const body = mul(sineOsc(f, t.length), env(t, (tt) => Math.exp(-tt * 1.5) * Math.min(1, tt / 0.002)));
  return pan(normalize(saturate(mul(body, 1.6), 2.2), 0.95));
}

function tick(pitch = 1, soft = false): Stereo {
  const t = t_(0.07);
  const f0 = 1900 * pitch;
  const s = env(t, (tt) => (Math.sin(2 * Math.PI * f0 * tt) + 0.4 * Math.sin(2 * Math.PI * f0 * 2.7 * tt)) * Math.exp(-tt * 90));
  const n = mul(band(noise(t.length, `tick${pitch}`), 3000, 9000), env(t, (tt) => Math.exp(-tt * 700) * 0.2));
  return pan(normalize(add(s, n), soft ? 0.35 : 0.6));
}

function click(): Stereo {
  const t = t_(0.06);
  const n = mul(band(noise(t.length, "click"), 1300, 7000), env(t, (tt) => Math.exp(-tt * 850)));
  const s = env(t, (tt) => Math.sin(2 * Math.PI * 2300 * tt) * Math.exp(-tt * 170) * 0.55);
  return pan(normalize(add(n, s), 0.6));
}

function key(): Stereo {
  const t = t_(0.045);
  const n = mul(band(noise(t.length, "key"), 1800, 6500), env(t, (tt) => Math.exp(-tt * 600)));
  const thock = env(t, (tt) => Math.sin(2 * Math.PI * 420 * tt) * Math.exp(-tt * 220) * 0.4);
  return pan(normalize(add(n, thock), 0.45));
}

function whoosh(dur = 0.45, up = true, panDir = 1): Stereo {
  const n = samples(dur);
  const fc = (tt: number) => {
    const p = Math.min(1, tt / dur);
    return up ? 400 * 9 ** p : 4000 * 0.12 ** p;
  };
  const y = sweep(noise(n, `wh${dur}${up}`), (tt) => fc(tt) * 0.55, (tt) => fc(tt) * 1.8);
  const e = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = i / n;
    e[i] = Math.sin(Math.PI * p) ** (up ? 1.4 : 2.2) * (up ? 0.4 + 0.6 * p : 1);
  }
  const yy = normalize(mul(y, e), 0.75);
  const out = makeStereo(n);
  for (let i = 0; i < n; i++) {
    const pp = (-0.8 + 1.6 * (i / n)) * panDir;
    const a = ((pp + 1) * Math.PI) / 4;
    out.L[i] = yy[i] * Math.cos(a) * 1.3;
    out.R[i] = yy[i] * Math.sin(a) * 1.3;
  }
  return out;
}

function riser(dur = 1): Stereo {
  const n = samples(dur);
  const nz = sweep(noise(n, `riser${dur}`), (tt) => 400 * 20 ** (tt / dur), (tt) => 2000 * 6 ** (tt / dur));
  const tone = add(...[-15, 0, 15].map((c) => sawOsc((tt) => 220 * 2 ** (3 * (tt / dur) ** 1.5) * 2 ** (c / 1200), n)));
  const toneF = band(mul(tone, 1 / 3), 200, 6000, 2);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = i / n;
    x[i] = nz[i] * p * p * 0.6 + toneF[i] * p ** 2.5 * 0.25;
  }
  return haas(normalize(x, 0.8), 10);
}

function downlifter(dur = 0.9): Stereo {
  const n = samples(dur);
  const nz = sweep(noise(n, "down"), (tt) => 3000 * 0.05 ** (tt / dur), (tt) => 9000 * 0.15 ** (tt / dur));
  const tone = sineOsc((tt) => 900 * 0.15 ** (tt / dur), n);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = i / n;
    x[i] = (nz[i] * 0.6 + tone[i] * 0.3) * (1 - p) ** 1.5;
  }
  return haas(normalize(x, 0.7), 8);
}

function subDrop(): Stereo {
  const t = t_(1.2);
  const x = mul(sineOsc((tt) => 30 + 90 * Math.exp(-tt * 3.5), t.length), env(t, (tt) => Math.min(1, tt / 0.01) * Math.exp(-tt * 2.2)));
  return pan(normalize(saturate(x, 1.4), 0.9));
}

function revCymbal(dur = 0.6): Stereo {
  const t = t_(dur);
  const x = mul(band(noise(t.length, "rev"), 3500, 15000), env(t, (tt) => Math.exp(-(dur - tt) * 5) * (tt / dur) ** 2));
  return haas(normalize(x, 0.7), 8);
}

function bell(notes: Array<[number, number]>, decay = 4.5, dur = 1): Stereo {
  const n = samples(dur);
  const out = new Float32Array(n);
  for (const [m, off] of notes) {
    const a = samples(off);
    const f = mtof(m);
    for (let i = a; i < n; i++) {
      const tt = (i - a) / SR;
      const mod = Math.sin(2 * Math.PI * f * 3.5 * tt) * 0.9 * Math.exp(-tt * 8);
      out[i] += Math.sin(2 * Math.PI * f * tt + mod) * Math.exp(-tt * decay);
    }
  }
  return normStereo(reverb(out, { size: 0.55, mix: 0.25, damp: 0.2 }), 0.75);
}

function shimmer(dur = 0.9): Stereo {
  const n = samples(dur + 0.8);
  const out = makeStereo(n);
  const notes = [84, 88, 91, 96, 100, 103, 108, 112];
  notes.forEach((m, i) => {
    const start = samples(((i * dur) / notes.length) * 0.8);
    const L = n - start;
    const f = mtof(m);
    const b = new Float32Array(L);
    for (let k = 0; k < L; k++) {
      const tt = k / SR;
      const mod = Math.sin(2 * Math.PI * f * 2 * tt) * 1.2 * Math.exp(-tt * 12);
      b[k] = Math.sin(2 * Math.PI * f * tt + mod) * Math.exp(-tt * (5 + i * 0.6)) * Math.min(1, tt / 0.002) * (0.5 + 0.06 * i);
    }
    place(out, pan(b, -0.7 + (1.4 * i) / (notes.length - 1)), start / SR);
  });
  return normStereo(reverb(out, { size: 0.75, mix: 0.35, damp: 0.15 }), 0.8);
}

function glitch(dur = 0.45): Stereo {
  const n = samples(dur);
  const x = new Float32Array(n);
  let k = 0;
  let s = 7;
  const r = () => {
    s = (s * 1103515245 + 12345) >>> 0;
    return s / 4294967296;
  };
  while (k < n) {
    const L = samples(0.015 + r() * 0.045);
    const f = 300 + r() * 2100;
    const seg = squareOsc(f, Math.min(L, n - k));
    const on = r() > 0.25;
    const amp = 0.3 + r() * 0.7;
    for (let i = 0; i < seg.length; i++) x[k + i] += on ? Math.round(seg[i] * amp * 4) / 4 : 0;
    k += L + samples(r() * 0.02);
  }
  const fall = squareOsc((tt) => 1600 * Math.exp(-tt * 5), n);
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) y[i] = (x[i] * 0.6 + fall[i] * Math.exp((-i / SR) * 4) * 0.4) * Math.sqrt(Math.max(0, 1 - i / n));
  return haas(normalize(band(y, 200, 7000), 0.7), 6);
}

function marker(): Stereo {
  const t = t_(0.28);
  const x = mul(band(noise(t.length, "marker"), 1500, 6000, 2), env(t, (tt) => Math.sin(Math.PI * Math.min(1, tt / 0.28)) * (0.6 + 0.4 * Math.sin(tt * 90))));
  return pan(normalize(x, 0.4));
}

function toggle(): Stereo {
  const a = tick(1.25);
  const b = tick(1.6);
  const out = makeStereo(samples(0.12));
  place(out, a, 0);
  place(out, b, 0.045, 0.8);
  return out;
}

function drop(): Stereo {
  const t = t_(0.25);
  const thud = mul(sineOsc((tt) => 70 + 90 * Math.exp(-tt * 30), t.length), env(t, (tt) => Math.exp(-tt * 14)));
  return pan(normalize(add(thud, mul(band(noise(t.length, "drop"), 800, 5000), env(t, (tt) => Math.exp(-tt * 300) * 0.3))), 0.7));
}

function counterRoll(dur = 0.9): Stereo {
  const out = makeStereo(samples(dur + 0.1));
  let t = 0;
  let i = 0;
  while (t < dur) {
    place(out, tick(1 + (0.3 * (i % 3)) / 2), t, 0.35 + 0.4 * Math.sin((Math.PI * t) / dur));
    t += 0.028 + 0.06 * (t / dur) ** 2.5;
    i++;
  }
  return out;
}

function tapeStop(dur = 0.4): Stereo {
  const n = samples(dur);
  const x = sawOsc((tt) => 320 * (1 - tt / dur) ** 1.4 + 30, n);
  const e = new Float32Array(n);
  for (let i = 0; i < n; i++) e[i] = Math.max(0, 1 - i / n) ** 0.6;
  return pan(normalize(band(mul(x, e), 60, 2500, 2), 0.5));
}

function scratch(): Stereo {
  const n = samples(0.22);
  const src = noise(n * 3, "scratch");
  const x = new Float32Array(n);
  let pos = 0;
  for (let i = 0; i < n; i++) {
    const tt = i / SR;
    pos = Math.min(src.length - 2, pos + Math.abs(Math.sin((Math.PI * tt) / 0.22) * 2.2));
    const k = Math.floor(pos);
    x[i] = (src[k] + (src[k + 1] - src[k]) * (pos - k)) * Math.sin((Math.PI * tt) / 0.22);
  }
  return pan(normalize(sweep(x, (tt) => 300 + 2000 * Math.abs(Math.sin((Math.PI * tt) / 0.22)), () => 4000), 0.6));
}

function heartbeat(): Stereo {
  const n = samples(0.6);
  const out = new Float32Array(n);
  for (const [off, g] of [
    [0, 1],
    [0.19, 0.7],
  ]) {
    const a = samples(off);
    const s = sineOsc((tt) => 55 + 25 * Math.exp(-tt * 30), n - a);
    for (let i = 0; i < s.length; i++) out[a + i] += s[i] * Math.exp((-i / SR) * 18) * g;
  }
  return pan(normalize(out, 0.6));
}

function notification(): Stereo {
  return bell([
    [83, 0],
    [90, 0.09],
  ], 6, 0.9);
}

function errorSound(): Stereo {
  const n = samples(0.4);
  const out = new Float32Array(n);
  for (const [f, off] of [
    [330, 0],
    [262, 0.14],
  ]) {
    const a = samples(off);
    const s = squareOsc(f, n - a, 0.4);
    for (let i = 0; i < s.length; i++) out[a + i] += s[i] * Math.exp((-i / SR) * 9) * 0.5;
  }
  return pan(normalize(band(out, 150, 3000, 2), 0.55));
}

export interface SfxDef {
  id: string;
  title: string;
  category: "ui" | "transition" | "impact" | "text" | "logo" | "data" | "riser" | "texture";
  make: () => Stereo;
}

/** Catalogul de sunete. Id-urile sunt cele folosite în fișele capabilităților (`sfx`). */
export const SFX: SfxDef[] = [
  { id: "pop", title: "Pop", category: "text", make: () => pop(1) },
  { id: "pop-hi", title: "Pop înalt", category: "text", make: () => pop(1.35) },
  { id: "pop-lo", title: "Pop grav", category: "text", make: () => pop(0.75) },
  { id: "slam", title: "Slam text", category: "text", make: () => slam(1) },
  { id: "impact", title: "Impact cinematic", category: "impact", make: () => impact(1) },
  { id: "impact-small", title: "Impact mic", category: "impact", make: () => normStereo(impact(0.6), 0.7) },
  { id: "bass-hit", title: "Lovitură de bas (808)", category: "impact", make: bassHit },
  { id: "sub-drop", title: "Sub-drop", category: "impact", make: subDrop },
  { id: "tick", title: "Tick", category: "data", make: () => tick(1) },
  { id: "tick-hi", title: "Tick înalt", category: "data", make: () => tick(1.3) },
  { id: "tick-soft", title: "Tick discret", category: "ui", make: () => tick(1.1, true) },
  { id: "click", title: "Clic de interfață", category: "ui", make: click },
  { id: "key", title: "Tastă", category: "ui", make: key },
  { id: "toggle", title: "Comutator", category: "ui", make: toggle },
  { id: "drop", title: "Drop (plasare)", category: "ui", make: drop },
  { id: "notification", title: "Notificare", category: "ui", make: notification },
  { id: "ding", title: "Succes / gata", category: "ui", make: () => bell([[88, 0], [92, 0.07]]) },
  { id: "error", title: "Eroare", category: "ui", make: errorSound },
  { id: "whoosh", title: "Whoosh", category: "transition", make: () => whoosh(0.45) },
  { id: "whoosh-fast", title: "Whoosh rapid", category: "transition", make: () => whoosh(0.22) },
  { id: "whoosh-long", title: "Whoosh lung", category: "transition", make: () => whoosh(0.8) },
  { id: "whoosh-soft", title: "Whoosh discret", category: "transition", make: () => normStereo(whoosh(0.5, false, -1), 0.45) },
  { id: "swipe", title: "Swipe", category: "transition", make: () => normStereo(whoosh(0.18), 0.65) },
  { id: "riser", title: "Riser", category: "riser", make: () => riser(1) },
  { id: "riser-short", title: "Riser scurt", category: "riser", make: () => riser(0.5) },
  { id: "downlifter", title: "Downlifter", category: "riser", make: () => downlifter(0.9) },
  { id: "rev-cymbal", title: "Cinel invers", category: "riser", make: () => revCymbal(0.55) },
  { id: "shimmer", title: "Shimmer / glint", category: "logo", make: () => shimmer(0.9) },
  { id: "sparkle", title: "Scânteie", category: "logo", make: () => bell([[96, 0], [100, 0.035], [103, 0.07]], 14, 0.5) },
  { id: "glitch", title: "Glitch", category: "texture", make: () => glitch(0.45) },
  { id: "marker", title: "Marker pe hârtie", category: "text", make: marker },
  { id: "counter", title: "Contor (rolă)", category: "data", make: () => counterRoll(0.9) },
  { id: "tape-stop", title: "Tape stop", category: "texture", make: () => tapeStop(0.4) },
  { id: "scratch", title: "Record scratch", category: "texture", make: scratch },
  { id: "heartbeat", title: "Bătaie de inimă", category: "texture", make: heartbeat },
];

const SFX_VERSION = "sfx-v1";

export function sfxIds(): string[] {
  return SFX.map((s) => s.id);
}

/** Sunetul ca buffer (generat o dată, apoi din cache pe disc). */
export function getSfx(id: string): Stereo {
  const def = SFX.find((s) => s.id === id);
  if (!def) throw new Error(`Sunet necunoscut: ${id}. Disponibile: ${sfxIds().join(", ")}`);
  const file = path.join(PATHS.sfxCache, `${SFX_VERSION}-${id}.wav`);
  if (fs.existsSync(file)) return readWav(file);
  const s = fadeEdges(def.make(), 0.001, 0.01);
  writeWav(file, s, 24);
  return readWav(file);
}

export { eq };
