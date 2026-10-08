/**
 * Profilul unei referințe video: ritm (tăieturi, durata cadrelor), intensitatea mișcării, culoare,
 * ritmul sunetului și progresia de energie. Profilul ghidează direcția creativă; nu se copiază nimic.
 */
import fs from "node:fs";
import path from "node:path";
import { decodeAudio } from "../audio/decode";
import { detectBeatGrid, onsetEnvelope } from "../audio/beat";
import { rmsDb } from "../audio/loudness";
import { palette, probe } from "../assets/analyze";
import { frameDiff, frameLuma, frameSaturation, readFrames } from "../assets/frames";

export interface ReferenceProfile {
  assetId: string;
  analyzedAt: string;
  durationSec: number;
  pacing: { cuts: number[]; shotCount: number; avgShotSec: number; medianShotSec: number; cutsPerSec: number; shortestShotSec: number; longestShotSec: number };
  motion: { intensity: number; label: "calm" | "moderate" | "energetic" | "frantic"; curve: number[] };
  color: { meanLuma: number; meanSaturation: number; palette: string[]; lumaCurve: number[]; label: string };
  audio: { present: boolean; bpm?: number; bpmConfidence?: number; onsetRate?: number; loudnessCurve?: number[] };
  energyCurve: number[];
  /** recomandări derivate (ritm, tranziții, densitate) pentru direcția creativă */
  guidance: string[];
  limitations: string[];
}

export async function analyzeReference(assetId: string, file: string): Promise<ReferenceProfile> {
  const p = await probe(file);
  const dur = p.durationSec ?? 0;
  const fps = 10;
  const seq = await readFrames(file, { fps, width: 96 });
  const diffs = seq.frames.map((f, i) => (i ? frameDiff(seq.frames[i - 1], f) : 0));
  // tăietură: salt mare față de mișcarea locală
  const cuts: number[] = [];
  for (let i = 1; i < diffs.length; i++) {
    const local = diffs.slice(Math.max(1, i - 5), i).concat(diffs.slice(i + 1, i + 6));
    const med = local.length ? [...local].sort((a, b) => a - b)[Math.floor(local.length / 2)] : 0;
    if (!(diffs[i] > 0.12 && diffs[i] > med * 3 + 0.03)) continue;
    // o tranziție rapidă (whip, sweep) dă două salturi apropiate: e o singură tăietură
    if (cuts.length && i / fps - cuts[cuts.length - 1] < 0.35) continue;
    cuts.push(i / fps);
  }
  const bounds = [0, ...cuts, dur || seq.frames.length / fps];
  const shots = bounds.slice(1).map((b, i) => b - bounds[i]).filter((s) => s > 0.05);
  const sortedShots = [...shots].sort((a, b) => a - b);
  const motionVals = diffs.filter((_, i) => !cuts.includes(i / fps));
  const intensity = motionVals.length ? motionVals.reduce((a, b) => a + b, 0) / motionVals.length : 0;
  const perSec = (vals: number[]) => {
    const out: number[] = [];
    for (let s = 0; s < Math.ceil(vals.length / fps); s++) {
      const sl = vals.slice(s * fps, (s + 1) * fps);
      out.push(sl.length ? sl.reduce((a, b) => a + b, 0) / sl.length : 0);
    }
    return out;
  };
  const motionCurve = perSec(diffs);
  const lumaCurve = perSec(seq.frames.map(frameLuma));
  const meanSat = seq.frames.length ? seq.frames.map(frameSaturation).reduce((a, b) => a + b, 0) / seq.frames.length : 0;
  const mid = seq.frames[Math.floor(seq.frames.length / 2)];
  const pal = mid ? palette({ w: seq.w, h: seq.h, rgb: mid }, 5) : [];
  const audio: ReferenceProfile["audio"] = { present: !!p.hasAudio || p.type === "audio" };
  let loud: number[] = [];
  if (audio.present) {
    try {
      const a = await decodeAudio(file);
      const g = detectBeatGrid(a);
      audio.bpm = g.bpm;
      audio.bpmConfidence = Math.round(g.confidence * 100) / 100;
      const on = onsetEnvelope(a);
      const peaks = on.env.filter((v, i, arr) => v > 0 && v >= (arr[i - 1] ?? 0) && v >= (arr[i + 1] ?? 0)).length;
      audio.onsetRate = Math.round((peaks / Math.max(1, a.L.length / a.sr)) * 10) / 10;
      for (let s = 0; s * a.sr < a.L.length; s++) loud.push(Math.round(rmsDb(a.L.slice(s * a.sr, (s + 1) * a.sr)) * 10) / 10);
      audio.loudnessCurve = loud;
    } catch {
      audio.present = false;
    }
  }
  const maxM = Math.max(1e-6, ...motionCurve);
  const energyCurve = motionCurve.map((m, i) => {
    const cutsIn = cuts.filter((c) => c >= i && c < i + 1).length;
    const l = loud[i] !== undefined ? Math.min(1, Math.max(0, (loud[i] + 40) / 34)) : 0.5;
    return Math.round(Math.min(1, 0.5 * (m / maxM) + 0.25 * Math.min(1, cutsIn / 2) + 0.25 * l) * 100) / 100;
  });
  const cutsPerSec = cuts.length / Math.max(1, dur);
  const avgShot = shots.length ? shots.reduce((a, b) => a + b, 0) / shots.length : dur;
  const label = intensity < 0.015 ? "calm" : intensity < 0.04 ? "moderate" : intensity < 0.08 ? "energetic" : "frantic";
  const guidance: string[] = [];
  guidance.push(`Durata medie a unui cadru: ${avgShot.toFixed(2)} s (${cutsPerSec.toFixed(2)} tăieturi/s).`);
  guidance.push(avgShot < 1 ? "Ritm foarte alert: tăieturi pe bătăi, tranziții scurte (whip, cut, glitch)." : avgShot < 2.2 ? "Ritm alert: 1–2 s pe cadru, tranziții push/zoom-through." : "Ritm calm: cadre lungi, mișcări de cameră lente, tranziții lungi (parallax, light leak).");
  guidance.push(label === "calm" ? "Mișcare discretă: push-in lent, handheld fin." : label === "frantic" ? "Mișcare intensă: shake pe impacturi, punch pe ritm." : "Mișcare moderată: zoom pe detalii, pan-uri scurte.");
  // tempo-ul se dă ca indicație doar când detecția e sigură (vocea și efectele peste muzică o încurcă)
  if (audio.bpm && (audio.bpmConfidence ?? 0) >= 0.25) guidance.push(`Muzică în jur de ${audio.bpm} BPM; tăieturile pot cădea pe bătăi.`);
  else if (audio.bpm) guidance.push(`Tempo nesigur (încredere ${audio.bpmConfidence}): probabil voce sau efecte peste muzică. Nu folosi tempo-ul ca fapt; întreabă-l pe utilizator sau ascultă.`);
  guidance.push(meanSat < 0.2 ? "Culoare reținută (aproape monocromă)." : meanSat > 0.5 ? "Culori saturate, contrast puternic." : "Saturație medie.");
  return {
    assetId,
    analyzedAt: new Date().toISOString(),
    durationSec: dur,
    pacing: {
      cuts,
      shotCount: shots.length,
      avgShotSec: Math.round(avgShot * 100) / 100,
      medianShotSec: Math.round((sortedShots[Math.floor(sortedShots.length / 2)] ?? avgShot) * 100) / 100,
      cutsPerSec: Math.round(cutsPerSec * 100) / 100,
      shortestShotSec: Math.round((sortedShots[0] ?? 0) * 100) / 100,
      longestShotSec: Math.round((sortedShots[sortedShots.length - 1] ?? 0) * 100) / 100,
    },
    motion: { intensity: Math.round(intensity * 1000) / 1000, label, curve: motionCurve.map((m) => Math.round(m * 1000) / 1000) },
    color: { meanLuma: Math.round((lumaCurve.reduce((a, b) => a + b, 0) / Math.max(1, lumaCurve.length)) * 100) / 100, meanSaturation: Math.round(meanSat * 100) / 100, palette: pal, lumaCurve: lumaCurve.map((l) => Math.round(l * 100) / 100), label: meanSat < 0.2 ? "reținută" : meanSat > 0.5 ? "saturată" : "medie" },
    audio,
    energyCurve,
    guidance,
    limitations: [
      "Fără OCR: densitatea și stilul textului din referință nu se măsoară automat; se descriu de om sau de Claude din cadre.",
      "Tăieturile se detectează din salturi de imagine la 10 cadre/s; dizolvările lente pot fi ratate.",
      "Tempo-ul se detectează din tot sunetul; cu voce și efecte peste muzică poate ieși greșit (vezi bpmConfidence).",
    ],
  };
}

export function saveReferenceProfile(projectDirPath: string, profile: ReferenceProfile): string {
  const f = path.join(projectDirPath, "references", `${profile.assetId}.json`);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(profile, null, 2));
  return f;
}
