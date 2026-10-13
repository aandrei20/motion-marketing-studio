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
    const out = mix({
      durationSec: 10,
      music: { audio: music.audio },
      voice: [{ audio: voice, atSec: 3 }],
      sfx: [{ audio: SFX.find((s) => s.id === "impact")!.make(), atSec: 1 }],
      duck: { amountDb: -10, rampMs: 500, padMs: 100 },
      intentionalSilences: [],
      targetLufs: -14,
      truePeakCeiling: -1,
    });
    expect(out.report.integratedLufs!).toBeGreaterThan(-14.6);
    expect(out.report.integratedLufs!).toBeLessThan(-13.4);
    expect(out.report.truePeakDbtp).toBeLessThanOrEqual(-1);
    expect(out.report.clippedSamples).toBe(0);
    expect(out.report.ok).toBe(true);
  });
});

describe("subtitrările ca fișier (.srt pentru livrare, .vtt pentru Studio)", () => {
  it("grupează cuvintele vocii pe propoziții și le scrie în ambele formate, cu aceiași timpi", async () => {
    const { toSrt, toVtt } = await import("../../src/pipeline/steps");
    const words = [
      { text: "Planifică", from: 0, to: 12 },
      { text: "săptămâna.", from: 13, to: 30 },
      { text: "Încearcă", from: 45, to: 57 },
      { text: "gratuit.", from: 58, to: 75 },
    ];
    expect(toSrt(words, 30)).toBe("1\n00:00:00,000 --> 00:00:01,000\nPlanifică săptămâna.\n\n2\n00:00:01,500 --> 00:00:02,500\nÎncearcă gratuit.\n");
    expect(toVtt(words, 30)).toBe("WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nPlanifică săptămâna.\n\n00:00:01.500 --> 00:00:02.500\nÎncearcă gratuit.\n");
  });
});

describe("compresorul pe voce și ambianța", () => {
  it("compresorul reduce vârfurile peste prag și păstrează nivelul mediu activ", async () => {
    const { compress } = await import("../../src/audio/dsp");
    const { SR } = await import("../../src/audio/wav");
    // o „replică”: 1 s la −20 dBFS, cu un vârf de 0,2 s la −6 dBFS
    const n = SR;
    const L = new Float32Array(n);
    for (let i = 0; i < n; i++) L[i] = Math.sin((2 * Math.PI * 220 * i) / SR) * (i > SR * 0.4 && i < SR * 0.6 ? 0.5 : 0.1);
    const s = { sr: SR, L, R: L.slice() };
    const peak = (x: Float32Array, a: number, b: number) => x.slice(a, b).reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    const rms = (x: Float32Array) => Math.sqrt(x.reduce((a, v) => a + v * v, 0) / x.length);
    const c = compress(s);
    expect(c.maxReductionDb).toBeGreaterThan(3);
    // vârful scade față de restul (diferența dintre vârf și corp se micșorează)
    const ratioBefore = peak(L, SR * 0.45, SR * 0.55) / peak(L, 0, SR * 0.3);
    const ratioAfter = peak(c.out.L, SR * 0.45, SR * 0.55) / peak(c.out.L, 0, SR * 0.3);
    expect(ratioAfter).toBeLessThan(ratioBefore * 0.8);
    // nivelul mediu (RMS) rămâne în 1 dB
    expect(Math.abs(20 * Math.log10(rms(c.out.L) / rms(L)))).toBeLessThan(1);
    // determinist
    expect(compress(s).out.L).toEqual(c.out.L);
  });

  it("ambianța umple liniștea dintre replici, tace în liniștea intenționată, iar mixul rămâne la −14 LUFS", async () => {
    const { roomTone, sineOsc, mul, perc } = await import("../../src/audio/dsp");
    const { mix } = await import("../../src/audio/mixer");
    const { SR } = await import("../../src/audio/wav");
    const line = mul(sineOsc(180, SR), perc(SR, 0.02, 0.6));
    const voice = [0.5, 4.5].map((atSec) => ({ audio: { sr: SR, L: line, R: line.slice() }, atSec }));
    const base = { durationSec: 8, voice, sfx: [], duck: { amountDb: -10, rampMs: 500, padMs: 120 }, targetLufs: -14, truePeakCeiling: -1 };
    const silences = [{ startSec: 5.5, endSec: 8 }];
    const without = mix({ ...base, intentionalSilences: silences });
    // fără ambianță: liniștea dintre replici (1,5–4,5 s) e raportată
    expect(without.report.problems.some((p) => p.startsWith("Tăcere neintenționată"))).toBe(true);
    const tone = roomTone(8 * SR, "test", "room");
    const withAmb = mix({ ...base, intentionalSilences: silences, ambience: { audio: tone } });
    expect(withAmb.report.problems.filter((p) => p.startsWith("Tăcere neintenționată"))).toEqual([]);
    expect(Math.abs((withAmb.report.integratedLufs ?? 0) + 14)).toBeLessThan(0.6);
    // în liniștea intenționată, ambianța tace
    const tail = withAmb.master.L.slice(7 * SR, 8 * SR).reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    expect(tail).toBe(0);
  });
});
