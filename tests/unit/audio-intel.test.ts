/**
 * Inteligența audio: structura muzicii (secțiuni, drop) din beat grid, fără structură pe tempo nesigur,
 * și efectele sonore atenuate sub voce.
 */
import { describe, expect, it } from "vitest";
import { musicStructure } from "../../src/audio/beat";
import { duckEnvelope, mix } from "../../src/audio/mixer";
import type { BeatGrid } from "../../src/core/schema";

const SR = 48000;
/** 8 măsuri la 120 BPM (2 s/măsură): primele 4 încet, ultimele 4 tare → drop la 8 s. */
function music(): { L: Float32Array; R: Float32Array; sr: number } {
  const n = SR * 16;
  const L = new Float32Array(n);
  for (let i = 0; i < n; i++) L[i] = Math.sin((2 * Math.PI * 220 * i) / SR) * (i < SR * 8 ? 0.05 : 0.6);
  return { L, R: L.slice(), sr: SR };
}
const grid = (confidence: number): BeatGrid => ({ bpm: 120, offsetSec: 0, beatsPerBar: 4, source: "detected", confidence, sections: [], drops: [] });

describe("structura muzicii", () => {
  it("găsește secțiunile și drop-ul de energie", () => {
    const s = musicStructure(music(), grid(0.8));
    expect(s.drops).toEqual([8]);
    expect(s.sections.length).toBeGreaterThanOrEqual(2);
    expect(s.sections[s.sections.length - 1].energy).toBeGreaterThan(s.sections[0].energy);
  });
  it("pe tempo nesigur nu inventează structură", () => {
    expect(musicStructure(music(), grid(0.1))).toEqual({ sections: [], drops: [] });
  });
});

describe("mixul: efectele sonore sub voce", () => {
  it("anvelopa de ducking scade sub voce și revine după", () => {
    const env = duckEnvelope(SR * 4, [{ startSec: 1, endSec: 2 }], -4, 250, 60);
    expect(env[Math.floor(SR * 1.5)]).toBeCloseTo(10 ** (-4 / 20), 2);
    expect(env[Math.floor(SR * 3.5)]).toBeCloseTo(1, 3);
  });
  it("același efect e mai încet peste o replică decât în afara ei", () => {
    const tone = (sec: number, amp: number) => {
      const L = new Float32Array(Math.floor(SR * sec)).map((_, i) => Math.sin((2 * Math.PI * 1000 * i) / SR) * amp);
      return { L, R: L.slice(), sr: SR };
    };
    const voice = tone(1, 0.2);
    const fx = tone(0.2, 0.5);
    const out = mix({
      durationSec: 4,
      voice: [{ audio: voice, atSec: 0.5 }],
      sfx: [
        { audio: fx, atSec: 0.8 },
        { audio: fx, atSec: 3 },
      ],
      duck: { amountDb: -10, rampMs: 500, padMs: 120 },
      intentionalSilences: [{ startSec: 0, endSec: 4 }],
      targetLufs: -14,
      truePeakCeiling: -1,
    });
    const peak = (a: number, b: number) => Math.max(...Array.from(out.stems.sfx.L.subarray(Math.floor(a * SR), Math.floor(b * SR))).map(Math.abs));
    expect(peak(0.85, 0.95)).toBeLessThan(peak(3.05, 3.15) * 0.8);
  });
});
