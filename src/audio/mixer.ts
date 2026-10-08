/**
 * Mixajul final, condus de cue sheet: voce, muzică cu ducking (rampă 500 ms), efecte sonore.
 * Masterul: normalizare la −14 LUFS, limitare la true peak ≤ −1 dBTP, apoi verificare
 * (loudness, true peak, clipping, tăceri neintenționate peste 1 s).
 */
import type { MixReport } from "../core/schema";
import { dbToGain, limit, place, samples } from "./dsp";
import { countClipped, findSilences, integratedLoudness, rmsDb, samplePeakDb, truePeakDb } from "./loudness";
import { SR, makeStereo, type Stereo } from "./wav";

export interface MixVoice {
  audio: Stereo;
  atSec: number;
  gainDb?: number;
}
export interface MixSfx {
  audio: Stereo;
  atSec: number;
  gainDb?: number;
  pan?: number;
}
export interface MixInput {
  durationSec: number;
  music?: { audio: Stereo; gainDb?: number; startSec?: number; fadeInSec?: number; fadeOutSec?: number; loop?: boolean };
  voice: MixVoice[];
  sfx: MixSfx[];
  duck: { amountDb: number; rampMs: number; padMs: number };
  intentionalSilences: Array<{ startSec: number; endSec: number }>;
  targetLufs: number;
  truePeakCeiling: number;
  stemGainsDb?: { voice?: number; music?: number; sfx?: number };
}

/** Anvelopa de ducking: 1 fără voce, `amount` sub voce, cu rampe liniare de `rampMs`. */
export function duckEnvelope(n: number, voice: Array<{ startSec: number; endSec: number }>, amountDb: number, rampMs: number, padMs: number): Float32Array {
  const g = new Float32Array(n).fill(1);
  const low = dbToGain(amountDb);
  const ramp = samples(rampMs / 1000);
  const pad = samples(padMs / 1000);
  // unim intervalele apropiate (sub 2 rampe) ca muzica să nu „respire” între fraze
  const iv = voice.map((v) => [samples(v.startSec) - pad, samples(v.endSec) + pad] as [number, number]).sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const x of iv) {
    const last = merged[merged.length - 1];
    if (last && x[0] - last[1] < ramp * 2) last[1] = Math.max(last[1], x[1]);
    else merged.push([...x]);
  }
  for (const [a, b] of merged) {
    for (let i = Math.max(0, a - ramp); i < Math.min(n, b + ramp); i++) {
      let k: number;
      if (i < a) k = (a - i) / ramp;
      else if (i >= b) k = (i - b) / ramp;
      else k = 0;
      const v = low + (1 - low) * Math.min(1, k);
      g[i] = Math.min(g[i], v);
    }
  }
  return g;
}

export interface MixOutput {
  master: Stereo;
  stems: { voice: Stereo; music: Stereo; sfx: Stereo };
  report: MixReport;
}

export function mix(input: MixInput): MixOutput {
  const n = samples(input.durationSec);
  const voice = makeStereo(n);
  const music = makeStereo(n);
  const sfx = makeStereo(n);
  const sg = input.stemGainsDb ?? {};
  for (const v of input.voice) place(voice, v.audio, v.atSec, dbToGain((v.gainDb ?? 0) + (sg.voice ?? 0)));
  for (const s of input.sfx) place(sfx, s.audio, s.atSec, dbToGain((s.gainDb ?? 0) + (sg.sfx ?? -8)));
  if (input.music) {
    const m = input.music;
    const start = samples(m.startSec ?? 0);
    const src = m.audio;
    const g = dbToGain((m.gainDb ?? 0) + (sg.music ?? -4));
    for (let i = start; i < n; i++) {
      let j = i - start;
      if (j >= src.L.length) {
        if (!m.loop) break;
        j %= src.L.length;
      }
      music.L[i] = src.L[j] * g;
      music.R[i] = src.R[j] * g;
    }
    const fi = samples(m.fadeInSec ?? 0);
    const fo = samples(m.fadeOutSec ?? 0.6);
    for (let i = 0; i < fi && start + i < n; i++) {
      music.L[start + i] *= i / fi;
      music.R[start + i] *= i / fi;
    }
    for (let i = 0; i < fo && i < n; i++) {
      const k = i / fo;
      music.L[n - 1 - i] *= k;
      music.R[n - 1 - i] *= k;
    }
    const voiceIv = input.voice.map((v) => ({ startSec: v.atSec, endSec: v.atSec + v.audio.L.length / v.audio.sr }));
    const duck = duckEnvelope(n, voiceIv, input.duck.amountDb, input.duck.rampMs, input.duck.padMs);
    for (let i = 0; i < n; i++) {
      music.L[i] *= duck[i];
      music.R[i] *= duck[i];
    }
  }
  const sum = makeStereo(n);
  for (let i = 0; i < n; i++) {
    sum.L[i] = voice.L[i] + music.L[i] + sfx.L[i];
    sum.R[i] = voice.R[i] + music.R[i] + sfx.R[i];
  }
  // normalizare la ținta de loudness, apoi limitare de vârf; repetăm o dată dacă limitarea a scăzut nivelul
  let master = sum;
  const problems: string[] = [];
  let lufs = integratedLoudness(master);
  for (let pass = 0; pass < 3 && lufs !== null; pass++) {
    const g = dbToGain(input.targetLufs - lufs);
    const scaled = makeStereo(n);
    for (let i = 0; i < n; i++) {
      scaled.L[i] = master.L[i] * g;
      scaled.R[i] = master.R[i] * g;
    }
    // plafonul de eșantion e sub plafonul de true peak; dacă true peak tot depășește, coborâm plafonul
    let ceiling = input.truePeakCeiling - 0.6;
    let limited = limit(scaled, ceiling);
    let tp = truePeakDb(limited);
    while (tp > input.truePeakCeiling && ceiling > input.truePeakCeiling - 4) {
      ceiling -= 0.3;
      limited = limit(scaled, ceiling);
      tp = truePeakDb(limited);
    }
    master = limited;
    lufs = integratedLoudness(master);
    if (lufs !== null && Math.abs(lufs - input.targetLufs) <= 0.5) break;
  }
  const tp = truePeakDb(master);
  const silencesRaw = findSilences(master, -50, 1);
  const silences = silencesRaw.map((s) => ({
    ...s,
    intentional: input.intentionalSilences.some((x) => x.startSec <= s.startSec + 0.25 && x.endSec >= s.endSec - 0.25),
  }));
  const clipped = countClipped(master);
  if (lufs === null) problems.push("Mixul este practic tăcut (sub poarta absolută de −70 LUFS).");
  else if (Math.abs(lufs - input.targetLufs) > 1) problems.push(`Loudness ${lufs.toFixed(1)} LUFS, departe de ținta ${input.targetLufs} LUFS.`);
  if (tp > input.truePeakCeiling + 0.05) problems.push(`True peak ${tp.toFixed(2)} dBTP peste plafonul de ${input.truePeakCeiling} dBTP.`);
  if (clipped > 0) problems.push(`${clipped} eșantioane la limită (clipping).`);
  for (const s of silences.filter((x) => !x.intentional)) problems.push(`Tăcere neintenționată ${s.startSec.toFixed(2)}–${s.endSec.toFixed(2)} s.`);
  const stemInfo = (s: Stereo) => ({ peakDbfs: samplePeakDb(s), rmsDbfs: Math.max(rmsDb(s.L), rmsDb(s.R)) });
  const report: MixReport = {
    durationSec: n / SR,
    integratedLufs: lufs === null ? null : Math.round(lufs * 100) / 100,
    truePeakDbtp: Math.round(tp * 100) / 100,
    samplePeakDbfs: Math.round(samplePeakDb(master) * 100) / 100,
    clippedSamples: clipped,
    silences,
    targetLufs: input.targetLufs,
    truePeakCeiling: input.truePeakCeiling,
    ok: problems.length === 0,
    problems,
    stems: { voice: stemInfo(voice), music: stemInfo(music), sfx: stemInfo(sfx) },
  };
  return { master, stems: { voice, music, sfx }, report };
}
