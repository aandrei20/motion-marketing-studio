/**
 * Gramatica de montaj: de ce durează o scenă cât durează, unde cade tăietura, ce tranziție
 * leagă două scene, cât se ține CTA-ul. Regulile sunt explicite și testabile.
 */
import { rand } from "../core/random";
import type { NarrativeRole, Pacing, ShotType } from "../core/schema";
import type { DirectionProfile } from "../creative/directions";

/** Timp minim de citire: cel puțin 1 s la 3 cuvinte și niciodată sub 0,8 s (regula din PLAN, faza 5). */
export function readingSec(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  if (!words) return 0;
  return Math.max(0.8, words / 3);
}

/** Hold minim pentru cardul final (fără mișcare la momentul deciziei). */
export const CTA_HOLD_SEC = 2.5;

export const PACING_FACTOR: Record<Pacing, number> = { slow: 1.25, medium: 1, fast: 0.8, aggressive: 0.65 };

/** Durata de bază a unui cadru, după tipul de cadru și energie. */
export function baseShotSec(shot: ShotType, energy: number, dir: DirectionProfile): number {
  const [lo, hi] = dir.shotSec;
  const byShot: Record<ShotType, number> = { establishing: 1.2, hero: 1.1, "close-up": 0.85, insert: 0.6, montage: 1.4, wide: 1.1, detail: 0.8, title: 0.9 };
  return (hi - (hi - lo) * energy) * byShot[shot];
}

export interface DurationInput {
  voSec: number;
  onScreen: string;
  shot: ShotType;
  energy: number;
  role: NarrativeRole;
  recipeMinSec: number;
  explicitSec: number | null;
  dir: DirectionProfile;
  pacing: Pacing;
}

export interface DurationDecision {
  sec: number;
  minSec: number;
  reasons: string[];
}

/** Durata unei scene: max(voce + respiro, timp de citire, minimul rețetei, cadru de bază), + hold pe CTA. */
export function sceneDuration(i: DurationInput): DurationDecision {
  const reasons: string[] = [];
  const voice = i.voSec > 0 ? i.voSec + 0.55 : 0;
  const read = readingSec(i.onScreen) + 0.45;
  const base = baseShotSec(i.shot, i.energy, i.dir) * PACING_FACTOR[i.pacing];
  let minSec = Math.max(voice, read, i.recipeMinSec);
  if (i.role === "cta") minSec = Math.max(minSec, read + CTA_HOLD_SEC);
  if (voice >= minSec - 1e-6 && voice > 0) reasons.push(`vocea durează ${i.voSec.toFixed(2)} s`);
  if (read >= minSec - 1e-6) reasons.push(`timpul de citire pentru „${i.onScreen.slice(0, 40)}”`);
  if (i.role === "cta") reasons.push(`hold de ${CTA_HOLD_SEC} s pe CTA`);
  let sec = Math.max(minSec, base);
  if (sec === base && base > minSec) reasons.push(`ritmul direcției (${i.dir.label}, energie ${i.energy})`);
  if (i.explicitSec !== null) {
    if (i.explicitSec < minSec) reasons.push(`durata cerută ${i.explicitSec}s e sub minim (${minSec.toFixed(2)}s); folosesc minimul`);
    else reasons.push(`durata cerută explicit`);
    sec = Math.max(i.explicitSec, minSec);
  }
  return { sec, minSec, reasons };
}

/** Alege tranziția dintre două scene după direcție și diferența de energie. Determinist (sămânță). */
export function chooseTransition(prev: { energy: number; role: NarrativeRole } | null, next: { energy: number; role: NarrativeRole; id: string }, dir: DirectionProfile, seed: number, forbidden: string[] = [], previousTransition: string | null = null): string {
  if (!prev) return "tr.cut";
  const delta = next.energy - prev.energy;
  const pool = (delta > 0.2 ? dir.transitions.rise : delta < -0.25 ? dir.transitions.drop : dir.transitions.calm).filter((t) => !forbidden.includes(t));
  if (!pool.length) return "tr.cut";
  // pe CTA, tranziția e mereu din pool-ul calm (momentul de decizie nu trebuie să fie haotic)
  let list = next.role === "cta" ? dir.transitions.calm.filter((t) => !forbidden.includes(t)) : pool;
  // varietate: nu repetăm tranziția precedentă dacă există alternativă (tăietura simplă se poate repeta)
  if (previousTransition && previousTransition !== "tr.cut" && list.length > 1) list = list.filter((t) => t !== previousTransition);
  return list[Math.floor(rand(seed, "tr", next.id) * list.length)] ?? "tr.cut";
}

/** Durata tranziției, scalată de ritm și limitată la 40% din cea mai scurtă dintre scene. */
export function transitionFrames(defaultFrames: number, pacing: Pacing, prevFrames: number, nextFrames: number): number {
  if (defaultFrames <= 0) return 0;
  const scaled = Math.round(defaultFrames * PACING_FACTOR[pacing]);
  return Math.max(2, Math.min(scaled, Math.floor(Math.min(prevFrames, nextFrames) * 0.4)));
}

/**
 * J-cut: vocea scenei noi poate începe puțin înaintea tăieturii (când energia crește),
 * ca imaginea să „răspundă” sunetului. Întoarce decalajul în cadre (negativ = înainte de scenă).
 */
export function voiceLeadFrames(fps: number, transitionFrames: number, energyDelta: number): number {
  if (energyDelta > 0.25) return -Math.round(fps * 0.12);
  return Math.max(Math.round(transitionFrames / 2), Math.round(fps * 0.15));
}

/** Direcția mișcării continuă între tăieturi: dacă scena anterioară a mers spre stânga, push-ul următor tot spre stânga. */
export function continuityDirection(prevDirection: "left" | "right" | null): "left" | "right" {
  return prevDirection ?? "left";
}
