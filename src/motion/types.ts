import type React from "react";
import type { z } from "zod";
import type { CameraKey, Rect, TimelineLayer } from "../core/schema";
import type { MotionEnv } from "./core/context";

export type Category =
  | "camera"
  | "transition"
  | "typography"
  | "ui"
  | "frame"
  | "media"
  | "3d"
  | "background"
  | "light"
  | "particles"
  | "texture"
  | "distortion"
  | "logo"
  | "data"
  | "shape"
  | "modifier";

export type MediaKind = "image" | "screenshot" | "video" | "svg" | "logo" | "text" | "layer" | "scene" | "none";

/** Sunetul asociat unui efect (regula: fiecare efect vizual își declară sunetul). */
export interface SfxAssociation {
  sound: string;
  /** momentul: start, end, la un cadru din parametri (`param:<nume>`) sau la fiecare element */
  at: "start" | "end" | "each" | `param:${string}`;
  offsetFrames?: number;
  gainDb?: number;
}

export interface CapabilityExample {
  params: Record<string, unknown>;
  durationInFrames: number;
  /** "full" = tot cadrul; "center" = o cutie centrală; sau o cutie explicită (pe 1920×1080) */
  box?: "full" | "center" | Rect;
  /** materiale de probă necesare (din library/catalog/samples) */
  needs?: Array<"screenshot" | "logo" | "photo" | "video" | "tall-screenshot">;
  children?: Array<Omit<TimelineLayer, "z" | "depth" | "role" | "modifiers" | "assets" | "children"> & Partial<TimelineLayer>>;
}

interface BaseMeta {
  id: string;
  category: Category;
  title: string;
  description: string;
  /** cuvinte după care se caută intenția („reveal”, „premium”, „zoom”) */
  tags: string[];
  compatibleMedia: MediaKind[];
  timing: { model: "duration" | "transition" | "instant" | "loop"; defaultFrames: number; minFrames: number };
  sfx: SfxAssociation[];
  status: "tested" | "experimental" | "deprecated";
  performance: "light" | "medium" | "heavy";
  license: { source: string; license: string; attribution?: string };
  /** dacă desenează ceva ce ar putea fi confundat cu interfața produsului (interzis fără captură reală) */
  representsProductUI: false;
  example: CapabilityExample;
}

export interface LayerProps<P> {
  layer: TimelineLayer;
  params: P;
  /** cadrul local al stratului (0 = începutul lui) */
  frame: number;
  duration: number;
  box: Rect;
  env: MotionEnv;
  /** straturile-copil deja randate (pentru componentele cu `ownsChildren`) */
  children?: React.ReactNode;
}

export interface LayerCapability<S extends z.ZodType = z.ZodType> extends BaseMeta {
  kind: "layer";
  params: S;
  Component: React.FC<LayerProps<z.infer<S>>>;
  /**
   * Momentele (cadre locale) la care se întâmplă ceva vizibil: apariția fiecărui cuvânt, fiecare clic,
   * fiecare tastă. Compilatorul le folosește pentru sunetele declarate cu `at: "each"`.
   */
  events?: (params: z.infer<S>, duration: number) => Array<{ at: number; sound?: string; gainDb?: number }>;
  /** true = componenta își așază singură copiii (de ex. straturile de interfață în spațiul capturii) */
  ownsChildren?: boolean;
}

export interface ModifierResult {
  style?: React.CSSProperties;
  /** învelește conținutul (de ex. un filtru SVG sau o reflexie) */
  wrap?: (children: React.ReactNode) => React.ReactNode;
}

export interface ModifierCapability<S extends z.ZodType = z.ZodType> extends BaseMeta {
  kind: "modifier";
  params: S;
  apply: (args: { params: z.infer<S>; frame: number; duration: number; box: Rect; env: MotionEnv; id: string }) => ModifierResult;
}

export interface CameraBuildContext {
  duration: number;
  width: number;
  height: number;
  /** punctul de interes (pixeli de compoziție), dacă scena are unul */
  focus: { x: number; y: number } | null;
  /** zoom-ul la care punctul de interes umple cadrul confortabil */
  focusZoom: number;
  /** unde pe ecran trebuie să ajungă punctul de interes (implicit centrul cadrului), de ex. centrul zonei media */
  target?: { x: number; y: number };
  energy: number;
}

export interface CameraBuild {
  keys: CameraKey[];
  handheld?: number;
  shake?: Array<{ at: number; amp: number }>;
  punches?: Array<{ at: number; amount: number }>;
  depthOfField?: { focusDepth: number; strength: number; keys: Array<{ at: number; focusDepth: number }> };
}

export interface CameraCapability<S extends z.ZodType = z.ZodType> extends BaseMeta {
  kind: "camera";
  params: S;
  build: (params: z.infer<S>, ctx: CameraBuildContext) => CameraBuild;
}

export interface TransitionStyle {
  transform?: string;
  opacity?: number;
  filter?: string;
  clipPath?: string;
  /** blur direcțional (px) aplicat prin filtru SVG: [x, y] */
  dirBlur?: [number, number];
  zIndex?: number;
}

export interface TransitionFrame {
  outgoing: TransitionStyle;
  incoming: TransitionStyle;
  /** element desenat peste ambele scene (flash, lumină, panou de culoare) */
  overlay?: React.ReactNode;
}

export interface TransitionCapability<S extends z.ZodType = z.ZodType> extends BaseMeta {
  kind: "transition";
  params: S;
  defaultDuration: number;
  /** p = 0..1 pe durata tranziției */
  present: (args: { p: number; frame: number; duration: number; params: z.infer<S>; env: MotionEnv; seed: string }) => TransitionFrame;
}

export type Capability = LayerCapability | ModifierCapability | CameraCapability | TransitionCapability;

/** Ajutor pentru definirea tipată a unui strat. */
export function defineLayer<S extends z.ZodType>(c: Omit<LayerCapability<S>, "kind" | "representsProductUI">): LayerCapability<S> {
  return { ...c, kind: "layer", representsProductUI: false };
}
export function defineModifier<S extends z.ZodType>(c: Omit<ModifierCapability<S>, "kind" | "representsProductUI">): ModifierCapability<S> {
  return { ...c, kind: "modifier", representsProductUI: false };
}
export function defineCamera<S extends z.ZodType>(c: Omit<CameraCapability<S>, "kind" | "representsProductUI">): CameraCapability<S> {
  return { ...c, kind: "camera", representsProductUI: false };
}
export function defineTransition<S extends z.ZodType>(c: Omit<TransitionCapability<S>, "kind" | "representsProductUI">): TransitionCapability<S> {
  return { ...c, kind: "transition", representsProductUI: false };
}

export const ORIGINAL = { source: "Motion Marketing Studio (cod original)", license: "proprietar, același cu repo-ul" } as const;
