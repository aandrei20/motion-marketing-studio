/**
 * Reference DNA: structura unei reclame de referință, transformată în parametri de producție.
 *
 *   profilul (src/references/analyze.ts) + mișcarea globală a camerei estimată din imagine
 *   → ritm (durata cadrelor, frecvența tăieturilor, accelerare), tăieturi simple vs. tranziții,
 *     mișcarea camerei (pan / zoom pe secundă, tipul dominant), intensitate, arcul de energie și punctul
 *     culminant, finalul static (CTA), tempo (doar dacă detecția e sigură), culoare
 *   → ajustări pentru direcția creativă (durata cadrelor, ritm, tranziții, camere) și pentru muzică.
 *
 * Nu se copiază nimic din referință: se preia doar structura (regula 3 nu se aplică structurii).
 * Limite scrise în DNA: fără OCR, densitatea și poziția textului nu se măsoară; dizolvările lente pot fi ratate.
 */
import fs from "node:fs";
import path from "node:path";
import type { Pacing } from "../core/schema";
import type { DirectionProfile } from "../creative/directions";
import type { ReferenceProfile } from "./analyze";

export interface CameraMotion {
  /** deplasarea globală medie a imaginii, în fracții din lățime pe secundă */
  panPerSec: number;
  /** schimbarea medie de scară pe secundă (0,05 = 5%/s) */
  zoomPerSec: number;
  dominant: "static" | "push" | "pull" | "pan" | "mixed";
}

export interface ReferenceDNA {
  assetId: string;
  durationSec: number;
  pacing: { avgShotSec: number; medianShotSec: number; cutsPerSec: number; shotCount: number; rhythm: "steady" | "accelerating" | "decelerating" | "varied"; pacing: Pacing };
  /** ponderea tăieturilor simple între schimbările de cadru (restul: tranziții animate/dizolvări) */
  hardCutShare: number | null;
  motion: { intensity: number; label: ReferenceProfile["motion"]["label"] };
  camera: CameraMotion | null;
  energy: { curve: number[]; climaxAt: number; arc: "rising" | "flat" | "peak-middle" | "front-loaded" | "falling" };
  /** cât de lung e finalul aproape static (cardul CTA), secunde */
  endHoldSec: number;
  audio: { bpm: number | null; confidence: number; usable: boolean };
  color: ReferenceProfile["color"];
  limitations: string[];
}

/** Mișcarea globală a camerei între două cadre (luminanță mică): cea mai bună potrivire pe deplasare și scară. */
export function globalMotion(a: Float32Array, b: Float32Array, w: number, h: number): { dx: number; dy: number; scale: number; err: number } {
  let best = { dx: 0, dy: 0, scale: 1, err: Infinity };
  const cx = w / 2;
  const cy = h / 2;
  const margin = Math.ceil(Math.max(w, h) * 0.12);
  for (const scale of [0.96, 0.98, 1, 1.02, 1.04]) {
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        let err = 0;
        let n = 0;
        for (let y = margin; y < h - margin; y += 2) {
          for (let x = margin; x < w - margin; x += 2) {
            const sx = Math.round(cx + (x - cx) * scale + dx);
            const sy = Math.round(cy + (y - cy) * scale + dy);
            if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
            err += Math.abs(a[y * w + x] - b[sy * w + sx]);
            n++;
          }
        }
        const e = n ? err / n : Infinity;
        if (e < best.err - 1e-6) best = { dx, dy, scale, err: e };
      }
    }
  }
  return best;
}

export function lumaOf(rgb: Uint8Array): Float32Array {
  const n = rgb.length / 3;
  const L = new Float32Array(n);
  for (let i = 0; i < n; i++) L[i] = (0.2126 * rgb[i * 3] + 0.7152 * rgb[i * 3 + 1] + 0.0722 * rgb[i * 3 + 2]) / 255;
  return L;
}

/** Mișcarea camerei pe toată referința, fără salturile de la tăieturi. */
export function cameraMotion(frames: Uint8Array[], w: number, h: number, fps: number, cutsSec: number[]): CameraMotion | null {
  if (frames.length < 3) return null;
  const L = frames.map(lumaOf);
  let pan = 0;
  let zoomIn = 0;
  let zoomOut = 0;
  let n = 0;
  for (let i = 1; i < L.length; i++) {
    const t = i / fps;
    if (cutsSec.some((c) => Math.abs(c - t) < 1.5 / fps)) continue;
    const m = globalMotion(L[i - 1], L[i], w, h);
    pan += Math.hypot(m.dx, m.dy) / w;
    if (m.scale > 1) zoomIn += m.scale - 1;
    if (m.scale < 1) zoomOut += 1 - m.scale;
    n++;
  }
  if (!n) return null;
  const secs = n / fps;
  const panPerSec = pan / secs;
  const zoomPerSec = (zoomIn + zoomOut) / secs;
  const dominant: CameraMotion["dominant"] = panPerSec < 0.01 && zoomPerSec < 0.01 ? "static" : zoomPerSec > panPerSec * 1.5 ? (zoomIn >= zoomOut ? "push" : "pull") : panPerSec > zoomPerSec * 1.5 ? "pan" : "mixed";
  return { panPerSec: Math.round(panPerSec * 1000) / 1000, zoomPerSec: Math.round(zoomPerSec * 1000) / 1000, dominant };
}

const pacingOf = (cutsPerSec: number): Pacing => (cutsPerSec >= 0.9 ? "aggressive" : cutsPerSec >= 0.55 ? "fast" : cutsPerSec >= 0.3 ? "medium" : "slow");

export function referenceDna(p: ReferenceProfile, extra: { camera?: CameraMotion | null; hardCutShare?: number | null } = {}): ReferenceDNA {
  const shots = p.pacing.cuts.length ? [p.pacing.cuts[0], ...p.pacing.cuts.slice(1).map((c, i) => c - p.pacing.cuts[i]), p.durationSec - p.pacing.cuts[p.pacing.cuts.length - 1]] : [p.durationSec];
  // ritmul corpului reclamei: cardul final (hold-ul CTA) nu intră în calcul
  const body = shots.length >= 4 ? shots.slice(0, -1) : shots;
  const half = Math.floor(body.length / 2);
  const first = body.slice(0, Math.max(1, half));
  const second = body.slice(Math.max(1, half));
  const mean = (x: number[]) => x.reduce((a, b) => a + b, 0) / Math.max(1, x.length);
  const std = Math.sqrt(mean(body.map((s) => (s - mean(body)) ** 2)));
  const rhythm: ReferenceDNA["pacing"]["rhythm"] = body.length < 3 ? "steady" : mean(second) < mean(first) * 0.75 ? "accelerating" : mean(second) > mean(first) * 1.33 ? "decelerating" : std / Math.max(0.01, mean(body)) > 0.6 ? "varied" : "steady";
  const curve = p.energyCurve;
  const maxI = curve.reduce((m, v, i) => (v > curve[m] ? i : m), 0);
  const climaxAt = curve.length > 1 ? maxI / (curve.length - 1) : 0.5;
  const thirds = [0, 1, 2].map((k) => mean(curve.slice(Math.floor((k * curve.length) / 3), Math.floor(((k + 1) * curve.length) / 3))));
  const arc: ReferenceDNA["energy"]["arc"] = Math.max(...thirds) - Math.min(...thirds) < 0.08 ? "flat" : thirds[2] >= thirds[1] && thirds[1] >= thirds[0] ? "rising" : thirds[1] > thirds[0] && thirds[1] > thirds[2] ? "peak-middle" : thirds[0] > thirds[2] ? (climaxAt < 0.3 ? "front-loaded" : "falling") : "rising";
  let endHoldSec = 0;
  for (let i = p.motion.curve.length - 1; i >= 0 && p.motion.curve[i] < 0.01; i--) endHoldSec++;
  const usable = !!p.audio.bpm && (p.audio.bpmConfidence ?? 0) >= 0.35;
  return {
    assetId: p.assetId,
    durationSec: p.durationSec,
    pacing: { avgShotSec: p.pacing.avgShotSec, medianShotSec: p.pacing.medianShotSec, cutsPerSec: p.pacing.cutsPerSec, shotCount: p.pacing.shotCount, rhythm, pacing: pacingOf(p.pacing.cutsPerSec) },
    hardCutShare: extra.hardCutShare ?? null,
    motion: { intensity: p.motion.intensity, label: p.motion.label },
    camera: extra.camera ?? null,
    energy: { curve, climaxAt: Math.round(climaxAt * 100) / 100, arc },
    endHoldSec,
    audio: { bpm: p.audio.bpm ?? null, confidence: p.audio.bpmConfidence ?? 0, usable },
    color: p.color,
    limitations: [...p.limitations, ...(usable ? [] : ["Tempo-ul referinței nu e sigur: nu se folosește pentru muzică."])],
  };
}

export type DnaAspect = "pacing" | "transitions" | "camera" | "tempo" | "energy";

/** Aspectele cerute în brief (references[].aspects), în română sau engleză; nimic cerut = toate. */
export function aspectsOf(raw: string[]): Set<DnaAspect> {
  if (!raw.length) return new Set(["pacing", "transitions", "camera", "tempo", "energy"]);
  const out = new Set<DnaAspect>();
  for (const a of raw.map((x) => x.toLowerCase())) {
    if (/ritm|pacing|tăiet|taiet|cut/.test(a)) out.add("pacing");
    if (/tranzi|transition/.test(a)) out.add("transitions");
    if (/camer|mișc|misc|motion/.test(a)) out.add("camera");
    if (/tempo|bpm|muzic|music/.test(a)) out.add("tempo");
    if (/energ|arc|climax|culmin/.test(a)) out.add("energy");
  }
  return out;
}

/**
 * Ajustările direcției după referințe: durata cadrelor spre cea a referinței, ritmul, tăieturi simple
 * dacă referința taie sec, camera calmă/activă după mișcarea dominantă, tempo-ul (doar sigur).
 */
export function applyDna(dir: DirectionProfile, refs: Array<{ dna: ReferenceDNA; aspects: Set<DnaAspect> }>): { dir: DirectionProfile; notes: string[]; pacing: Pacing | null } {
  if (!refs.length) return { dir, notes: [], pacing: null };
  const out: DirectionProfile = structuredClone(dir);
  const notes: string[] = [];
  let pacing: Pacing | null = null;
  const avg = (f: (d: ReferenceDNA) => number) => refs.reduce((s, r) => s + f(r.dna), 0) / refs.length;
  if (refs.some((r) => r.aspects.has("pacing"))) {
    const shot = avg((d) => d.pacing.avgShotSec);
    out.shotSec = [Math.max(0.5, Math.round(shot * 0.75 * 100) / 100), Math.max(0.8, Math.round(shot * 1.3 * 100) / 100)];
    pacing = pacingOf(avg((d) => d.pacing.cutsPerSec));
    notes.push(`Ritmul referinței: ~${shot.toFixed(1)} s pe cadru → cadre de ${out.shotSec[0]}–${out.shotSec[1]} s, ritm „${pacing}”.`);
  }
  if (refs.some((r) => r.aspects.has("transitions"))) {
    const hard = refs.map((r) => r.dna.hardCutShare).filter((x): x is number => x !== null);
    if (hard.length && hard.reduce((a, b) => a + b, 0) / hard.length >= 0.7) {
      out.transitions = { ...out.transitions, calm: ["tr.cut", ...out.transitions.calm.filter((t) => t !== "tr.cut")].slice(0, 3) };
      notes.push("Referința taie sec: tăietura simplă devine prima opțiune între scene apropiate.");
    }
  }
  if (refs.some((r) => r.aspects.has("camera"))) {
    const cams = refs.map((r) => r.dna.camera?.dominant).filter(Boolean);
    if (cams.includes("static")) {
      out.camera = { ...out.camera, calm: "camera.static" };
      notes.push("Referința are cameră fixă: scenele calme rămân fixe.");
    } else if (cams.includes("push")) {
      out.camera = { ...out.camera, calm: "camera.push", active: "camera.push" };
      notes.push("Referința împinge camera spre subiect: push-in pe scenele calme și active.");
    } else if (cams.includes("pan")) {
      out.camera = { ...out.camera, calm: "camera.pan" };
      notes.push("Referința folosește pan-uri: pan lent pe scenele calme.");
    }
  }
  if (refs.some((r) => r.aspects.has("tempo"))) {
    const sure = refs.filter((r) => r.dna.audio.usable && r.dna.audio.bpm);
    if (sure.length) {
      const bpm = Math.round(sure.reduce((s, r) => s + (r.dna.audio.bpm ?? 0), 0) / sure.length);
      out.bpm = [bpm - 3, bpm + 3];
      notes.push(`Tempo-ul referinței (sigur): ~${bpm} BPM pentru muzica sintetizată.`);
    } else notes.push("Tempo-ul referinței nu e sigur: muzica păstrează tempo-ul direcției.");
  }
  return { dir: out, notes, pacing };
}

export function referenceProfilePath(projectDir: string, assetId: string): string {
  return path.join(projectDir, "references", `${assetId}.json`);
}

/** DNA-urile referințelor cerute în brief (doar cele analizate; celelalte se raportează). */
export function loadReferenceDnas(projectDir: string, refs: Array<{ assetId: string; aspects: string[] }>): { refs: Array<{ dna: ReferenceDNA; aspects: Set<DnaAspect> }>; missing: string[] } {
  const out: Array<{ dna: ReferenceDNA; aspects: Set<DnaAspect> }> = [];
  const missing: string[] = [];
  for (const r of refs) {
    const f = referenceProfilePath(projectDir, r.assetId);
    if (!fs.existsSync(f)) {
      missing.push(r.assetId);
      continue;
    }
    const raw = JSON.parse(fs.readFileSync(f, "utf8")) as ReferenceProfile & { dna?: ReferenceDNA };
    out.push({ dna: raw.dna ?? referenceDna(raw), aspects: aspectsOf(r.aspects) });
  }
  return { refs: out, missing };
}
