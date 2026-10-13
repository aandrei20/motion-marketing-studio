/**
 * Verificările buclei de calitate adaptive, grupate pe cele 10 pase (0 plan … 9 final QA).
 * Fiecare verificare își declară metoda și costul; planificatorul (run.ts) rulează doar ce permite
 * adâncimea cerută, cu metoda cea mai ieftină care e suficient de sigură, și refolosește rezultatele
 * scumpe din cache când intrările lor nu s-au schimbat.
 *
 *   metodă        cost  ce înseamnă
 *   schema        0     validare de structură (zod) – deja la citire
 *   static        1     reguli pe date (script, afirmații, brief, recompilare de control)
 *   timeline      1     analiză pe timeline-ul compilat (geometrie, timp, straturi)
 *   asset         1     metadatele materialelor (rezoluție, drepturi, date personale)
 *   audio         2     raportul mixului și beat grid-ul
 *   stills        3     cadre-cheie randate și analizate pe pixeli (doar scenele schimbate)
 *   scene-render  4     secvență de cadre dintr-o scenă (mișcare reală)
 *   full-render   6     video-ul întreg (doar la predare / final QA, sau refolosit dacă e la zi)
 */
import type { AssetManifest, Brand, Brief, FormatSpec, MixReport, Project, QualityCategory, Research, Script, Storyboard, Timeline } from "../core/schema";
import type { autoCritique } from "../critique/auto";
import type { DirectionProfile } from "../creative/directions";
import { SCREEN_CAPS } from "../motion/text-caps";
import type { PlatformProfile } from "../platform/profiles";
import type { VideoCheck } from "../renderer/node/analyze-video";
import type { ValidationResult } from "../timeline/validate";
import type { IssueDraft } from "./issues";
import type { PixelMetrics } from "../critique/pixel";
import { PLAN_CHECKS } from "./passes/plan";
import { STORY_CHECKS } from "./passes/story";
import { VISUAL_CHECKS } from "./passes/visual";
import { MOTION_CHECKS } from "./passes/motion";
import { UI_CHECKS } from "./passes/ui";
import { TYPOGRAPHY_CHECKS } from "./passes/typography";
import { AUDIO_CHECKS } from "./passes/audio";
import { BRAND_CHECKS } from "./passes/brand";
import { PLATFORM_CHECKS } from "./passes/platform";
import { FINAL_CHECKS } from "./passes/final";

export type Depth = "fast" | "standard" | "deep" | "final";
export const DEPTH_MAX_COST: Record<Depth, number> = { fast: 2, standard: 3, deep: 4, final: 6 };
export const DEPTHS: Depth[] = ["fast", "standard", "deep", "final"];

export type Method = "schema" | "static" | "timeline" | "asset" | "audio" | "stills" | "scene-render" | "full-render";
export const METHOD_COST: Record<Method, number> = { schema: 0, static: 1, timeline: 1, asset: 1, audio: 2, stills: 3, "scene-render": 4, "full-render": 6 };

export type PassId = "plan" | "story" | "visual" | "motion" | "ui" | "typography" | "audio" | "brand" | "platform" | "final";
export const PASSES: Array<{ id: PassId; n: number; title: string }> = [
  { id: "plan", n: 0, title: "Plan: brief, afirmații, drepturi, validare" },
  { id: "story", n: 1, title: "Poveste: structură, hook, arc de energie, ritm" },
  { id: "visual", n: 2, title: "Vizual: contrast real, compoziție, aglomerare" },
  { id: "motion", n: 3, title: "Mișcare: gramatică, repetiții, mișcare reală" },
  { id: "ui", n: 4, title: "Interfață: footage real, lizibilitate, rezoluție" },
  { id: "typography", n: 5, title: "Tipografie: lizibilitate, consecvență" },
  { id: "audio", n: 6, title: "Audio: mix, ritm, voce" },
  { id: "brand", n: 7, title: "Brand: consecvență, logo, culori, date la zi" },
  { id: "platform", n: 8, title: "Platformă: durată, hook, subtitrări, densitate" },
  { id: "final", n: 9, title: "Final QA: determinism, fișiere, video randat, porți de export" },
];

export interface StillResult {
  sceneId: string;
  frame: number;
  local: number;
  file: string;
  cached: boolean;
  metrics: PixelMetrics;
  issues: IssueDraft[];
}

export interface MotionResult {
  sceneId: string;
  cached: boolean;
  /** diferența medie între cadre consecutive eșantionate (0..1) */
  curve: number[];
  stepFrames: number;
}

export interface CheckServices {
  stills(formatId: string): Promise<StillResult[]>;
  sceneMotion(formatId: string): Promise<MotionResult[]>;
  fullVideo(formatId: string): Promise<VideoCheck | null>;
  recompile(formatId: string): Timeline | null;
}

export interface CheckContext {
  project: Project;
  versionId: string;
  brief: Brief;
  brand: Brand | null;
  research: Research;
  assets: AssetManifest;
  script: Script;
  storyboard: Storyboard;
  formats: FormatSpec[];
  primary: FormatSpec;
  timelines: Record<string, Timeline>;
  validation: Record<string, ValidationResult>;
  mix: MixReport | null;
  dir: DirectionProfile;
  profiles: Record<string, PlatformProfile>;
  /** amprentele intrărilor de proiect: acum și la compilarea versiunii */
  inputsNow: Record<string, string>;
  inputsAtCompile: Record<string, string>;
  /** rundă (pentru id-uri) */
  round: number;
  rubric: { minScene: number | null; overall: Record<string, number> | null; sceneScores: ReturnType<typeof autoCritique>["sceneScores"] };
  services: CheckServices;
}

export interface CheckDef {
  id: string;
  version: number;
  pass: PassId;
  title: string;
  /** categoriile de calitate pe care verificarea le evaluează efectiv */
  categories: QualityCategory[];
  method: Method;
  /** true = rulează pe fiecare format; false = o dată, pe formatul principal */
  perFormat: boolean;
  run(ctx: CheckContext, formatId: string): Promise<IssueDraft[]> | IssueDraft[];
}

/** Toate verificările, în ordinea paselor (0 plan … 9 final QA); fiecare pasă are fișierul ei în passes/. */
export const CHECKS: CheckDef[] = [
  ...PLAN_CHECKS,
  ...STORY_CHECKS,
  ...VISUAL_CHECKS,
  ...MOTION_CHECKS,
  ...UI_CHECKS,
  ...TYPOGRAPHY_CHECKS,
  ...AUDIO_CHECKS,
  ...BRAND_CHECKS,
  ...PLATFORM_CHECKS,
  ...FINAL_CHECKS,
];

export function checksForDepth(depth: Depth): { run: CheckDef[]; skipped: CheckDef[] } {
  const max = DEPTH_MAX_COST[depth];
  return { run: CHECKS.filter((c) => METHOD_COST[c.method] <= max), skipped: CHECKS.filter((c) => METHOD_COST[c.method] > max) };
}

export function isScreenCap(c: string): boolean {
  return SCREEN_CAPS.has(c);
}
