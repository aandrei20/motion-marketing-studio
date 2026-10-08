import type { z } from "zod";
import type { Asset, CameraKey, Claim, NarrativeRole, Palette, Rect, Region, StoryboardScene, TimelineLayer } from "../core/schema";
import type { ResolvedSafeZone, Orientation } from "../core/formats";
import type { DirectionProfile } from "../creative/directions";

export interface ResolvedAsset {
  asset: Asset;
  /** cale publică (projects/<id>/assets/...) */
  src: string;
  w: number;
  h: number;
  kind: "image" | "video" | "svg";
  regions: Region[];
  focal: { x: number; y: number };
}

export interface RecipeContext {
  W: number;
  H: number;
  fps: number;
  orientation: Orientation;
  safe: ResolvedSafeZone;
  /** durata scenei în cadre */
  duration: number;
  scene: StoryboardScene;
  dir: DirectionProfile;
  energy: number;
  text: { headline: string; sub: string; items: string[]; emphasis: string[]; vo: string };
  slot: (name: string) => ResolvedAsset | null;
  slots: (name: string) => ResolvedAsset[];
  logo: ResolvedAsset | null;
  productName: string;
  claims: Claim[];
  /** cadrele locale ale bătăilor din scenă */
  beats: number[];
  focusRegion: Region | null;
  focusAsset: ResolvedAsset | null;
  effectsLevel: "subtle" | "medium" | "bold";
  palette: Palette;
  /** subtitrările arse ocupă banda de jos a zonei sigure: materialul vizual se oprește deasupra */
  captions: boolean;
  forbidden: string[];
  uid: (hint: string) => string;
}

export interface RecipeCue {
  at: number;
  sound: string;
  gainDb?: number;
  reason: string;
}

export interface RecipeOutput {
  layers: TimelineLayer[];
  camera: { capability: string; params: Record<string, unknown> };
  /** punctul de interes în pixeli de compoziție, zoom-ul care îl încadrează și unde trebuie să ajungă pe ecran */
  focus?: { x: number; y: number; zoom: number; target?: { x: number; y: number } };
  /** chei de cameră explicite (au prioritate față de preset) */
  cameraKeys?: CameraKey[];
  cues?: RecipeCue[];
  notes?: string[];
}

export interface RecipeSlot {
  name: string;
  kind: "screenshot" | "recording" | "screen" | "logo" | "image" | "tall-screenshot";
  required: boolean;
  multiple?: boolean;
}

export interface RecipeDef<S extends z.ZodType = z.ZodType> {
  id: string;
  title: string;
  description: string;
  tags: string[];
  roles: NarrativeRole[];
  slots: RecipeSlot[];
  minSec: number;
  /** minim calculat din textul scenei (de ex. un montaj are nevoie de timp de citire pe fiecare element) */
  minSecFor?: (text: { headline?: string; sub?: string; items: string[] }) => number;
  /** capabilitățile pe care le poate folosi (legătura cu registry-ul) */
  capabilities: string[];
  params: S;
  build: (ctx: RecipeContext, params: z.infer<S>) => RecipeOutput;
}

export function defineRecipe<S extends z.ZodType>(r: RecipeDef<S>): RecipeDef<S> {
  return r;
}

export type { Rect };
