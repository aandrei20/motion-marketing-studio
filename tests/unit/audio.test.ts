import { describe, expect, it } from "vitest";
import { detectBeatGrid } from "../../src/audio/beat";
import { limit, samples } from "../../src/audio/dsp";
import { countClipped, findSilences, integratedLoudness, samplePeakDb, truePeakDb } from "../../src/audio/loudness";
import { duckEnvelope, mix } from "../../src/audio/mixer";
import { composeMusic } from "../../src/audio/music";
import { SFX } from "../../src/audio/sfx";
import { SR, makeStereo } from "../../src/audio/wav";

function sine(freq: number, sec: number, amp: number, both = true) {
  const s = makeStereo(samples(sec));
  for (let i = 0; i < s.L.length; i++) {
    const v = amp * Math.sin((2 * Math.PI * freq * i) / SR);
    s.L[i] = v;
    s.R[i] = both ? v : 0;
  }
  return s;
}

describe("loudness BS.1770", () => {
  it("un sinus de 997 Hz la 0 dBFS pe un canal are −3,01 LUFS", () => {
    expect(integratedLoudness(sine(997, 5, 1, false))!).toBeCloseTo(-3.01, 1);
  });
  it("pe două canale are cu 3 dB mai mult", () => {
    expect(integratedLoudness(sine(997, 5, 1, true))!).toBeCloseTo(0, 1);
  });
  it("tăcerea e sub poarta absolută", () => {
    expect(integratedLoudness(makeStereo(SR * 3))).toBeNull();
  });
});

describe("limitator și true peak", () => {
  it("garantează plafonul de eșantion", () => {
    const loud = sine(440, 1, 2.5);
    const out = limit(loud, -1.5);
    expect(samplePeakDb(out)).toBeLessThanOrEqual(-1.49);
    expect(countClipped(out)).toBe(0);
  });
  it("true peak ≥ vârful de eșantion", () => {
    const s = sine(11025, 0.5, 0.7);
    expect(truePeakDb(s)).toBeGreaterThanOrEqual(samplePeakDb(s) - 0.01);
  });
});

describe("tăceri și ducking", () => {
  it("găsește tăcerea de peste 1 s", () => {
    const s = sine(440, 4, 0.3);
    for (let i = samples(1); i < samples(2.6); i++) {
      s.L[i] = 0;
      s.R[i] = 0;
    }
    const sil = findSilences(s, -50, 1);
    expect(sil).toHaveLength(1);
    expect(sil[0].startSec).toBeCloseTo(1, 1);
  });
  it("muzica scade sub voce cu rampă de 500 ms", () => {
    const n = samples(6);
    const g = duckEnvelope(n, [{ startSec: 2, endSec: 4 }], -10, 500, 0);
    expect(g[samples(1)]).toBeCloseTo(1, 5);
    expect(g[samples(3)]).toBeCloseTo(10 ** (-10 / 20), 3);
    expect(g[samples(1.75)]).toBeGreaterThan(g[samples(1.95)]);
    expect(g[samples(5)]).toBeCloseTo(1, 5);
  });
});

describe("efecte sonore și muzică", () => {
  it("fiecare efect e determinist și nenul", () => {
    for (const s of SFX.slice(0, 12)) {
      const a = s.make();
      const b = s.make();
      expect(a.L.length, s.id).toBeGreaterThan(100);
      expect(Array.from(a.L.slice(0, 2000))).toEqual(Array.from(b.L.slice(0, 2000)));
      expect(samplePeakDb(a), s.id).toBeGreaterThan(-30);
    }
  });
  it("muzica sintetizată are tempo-ul cerut (detectat independent)", () => {
    for (const bpm of [96, 124, 140]) {
      const m = composeMusic({ bpm, durationSec: 12, mood: "driving", seed: 1, sections: [{ startSec: 0, endSec: 12, energy: 0.8, name: "a" }] });
      const g = detectBeatGrid(m.audio);
      expect(Math.abs(g.bpm - bpm), `${bpm}`).toBeLessThanOrEqual(1);
      expect(g.offsetSec).toBeLessThan(60 / bpm / 4);
    }
  });
});

describe("mixer", () => {
  it("atinge −14 LUFS, true peak ≤ −1 dBTP, fără clipping", () => {
    const music = composeMusic({ bpm: 120, durationSec: 10, mood: "uplifting", seed: 2, sections: [{ startSec: 0, endSec: 10, energy: 0.7, name: "a" }] });
    const voice = sine(220, 2, 0.5);
    const out = mix({ durationSec: 10, music: { audio: music.audio }, voice: [{ audio: voice, atSec: 3 }], sfx: [{ audio: SFX.find((s) => s.id === "impact")!.make(), atSec: 1 }], duck: { amountDb: -10, rampMs: 500, padMs: 100 }, intentionalSilences: [], targetLufs: -14, truePeakCeiling: -1 });
    expect(out.report.integratedLufs!).toBeGreaterThan(-14.6);
    expect(out.report.integratedLufs!).toBeLessThan(-13.4);
    expect(out.report.truePeakDbtp).toBeLessThanOrEqual(-1);
    expect(out.report.clippedSamples).toBe(0);
    expect(out.report.ok).toBe(true);
  });
});
