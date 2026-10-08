/**
 * Reference DNA: estimarea mișcării camerei din imagine, structura (ritm, arc, final static) și
 * ajustarea direcției creative după aspectele cerute în brief.
 */
import { describe, expect, it } from "vitest";
import { DIRECTIONS } from "../../src/creative/directions";
import { applyDna, aspectsOf, globalMotion, referenceDna } from "../../src/references/dna";
import type { ReferenceProfile } from "../../src/references/analyze";

/** O textură determinist-variată, deplasată cu (dx, dy) pixeli. */
function frame(w: number, h: number, dx: number, dy: number, scale = 1): Float32Array {
  const L = new Float32Array(w * h);
  const cx = w / 2;
  const cy = h / 2;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const sx = (x - cx) / scale + cx - dx;
      const sy = (y - cy) / scale + cy - dy;
      L[y * w + x] = 0.5 + 0.25 * Math.sin(sx * 0.7) * Math.cos(sy * 0.45) + 0.2 * Math.sin((sx + sy) * 0.23);
    }
  return L;
}

const profile = (o: Partial<ReferenceProfile> = {}): ReferenceProfile => ({
  assetId: "ref",
  analyzedAt: "2026-10-08",
  durationSec: 12,
  pacing: { cuts: [2, 4, 5.5, 6.7, 7.6, 8.4, 9], shotCount: 8, avgShotSec: 1.5, medianShotSec: 1.2, cutsPerSec: 0.58, shortestShotSec: 0.6, longestShotSec: 3 },
  motion: { intensity: 0.03, label: "moderate", curve: [0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.07, 0.06, 0.05, 0.004, 0.003, 0.002] },
  color: { meanLuma: 0.4, meanSaturation: 0.4, palette: [], lumaCurve: [], label: "medie" },
  audio: { present: true, bpm: 120, bpmConfidence: 0.6 },
  energyCurve: [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.7, 0.4, 0.3, 0.3],
  guidance: [],
  limitations: [],
  ...o,
});

describe("Reference DNA", () => {
  it("estimează deplasarea și zoom-ul global dintre două cadre", () => {
    const w = 48;
    const h = 27;
    const pan = globalMotion(frame(w, h, 0, 0), frame(w, h, 2, -1), w, h);
    expect([pan.dx, pan.dy]).toEqual([2, -1]);
    const zoom = globalMotion(frame(w, h, 0, 0), frame(w, h, 0, 0, 1.04), w, h);
    expect(zoom.scale).toBeGreaterThan(1);
  });
  it("structura: ritm care accelerează, punct culminant, final static, tempo sigur", () => {
    const d = referenceDna(profile());
    expect(d.pacing.rhythm).toBe("accelerating");
    expect(d.pacing.pacing).toBe("fast");
    expect(d.energy.climaxAt).toBeGreaterThan(0.5);
    expect(d.endHoldSec).toBe(3);
    expect(d.audio.usable).toBe(true);
    expect(referenceDna(profile({ audio: { present: true, bpm: 128, bpmConfidence: 0.1 } })).audio.usable).toBe(false);
  });
  it("aspectele din brief (română sau engleză); nimic cerut = toate", () => {
    expect([...aspectsOf(["ritmul", "tempo"])].sort()).toEqual(["pacing", "tempo"]);
    expect(aspectsOf([]).size).toBe(5);
  });
  it("ajustează direcția doar pe aspectele cerute, iar tempo-ul nesigur nu se folosește", () => {
    const base = DIRECTIONS.premium;
    const d = referenceDna(profile(), { camera: { panPerSec: 0, zoomPerSec: 0.05, dominant: "push" }, hardCutShare: 0.9 });
    const all = applyDna(base, [{ dna: d, aspects: aspectsOf([]) }]);
    expect(all.dir.shotSec[0]).toBeLessThan(base.shotSec[0]);
    expect(all.pacing).toBe("fast");
    expect(all.dir.transitions.calm[0]).toBe("tr.cut");
    expect(all.dir.camera.calm).toBe("camera.push");
    expect(all.dir.bpm).toEqual([117, 123]);
    const onlyTempo = applyDna(base, [{ dna: d, aspects: aspectsOf(["tempo"]) }]);
    expect(onlyTempo.dir.shotSec).toEqual(base.shotSec);
    expect(onlyTempo.pacing).toBeNull();
    const unsure = referenceDna(profile({ audio: { present: true, bpm: 128, bpmConfidence: 0.1 } }));
    expect(applyDna(base, [{ dna: unsure, aspects: aspectsOf(["tempo"]) }]).dir.bpm).toEqual(base.bpm);
    // direcția de bază nu se modifică (copie)
    expect(DIRECTIONS.premium.camera.calm).toBe(base.camera.calm);
  });
});
