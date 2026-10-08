import { z } from "zod";
import { HexColor, Rect } from "./common";
import { AudioCue, BeatGrid } from "./audio";

/**
 * Timeline-ul compilat este singura sursă pentru randare. Componentele Remotion citesc doar acest
 * obiect (plus fișierele pe care le referă prin căi publice). Toate timpurile sunt în cadre.
 */

export const TimelineFont = z.object({
  family: z.string(),
  /** cale publică (relativă la folderul public de randare), de ex. library/fonts/inter/Inter.ttf */
  src: z.string(),
  weight: z.string().default("100 900"),
  style: z.enum(["normal", "italic"]).default("normal"),
});
export type TimelineFont = z.infer<typeof TimelineFont>;

export const Modifier = z.object({
  capability: z.string(),
  params: z.record(z.string(), z.unknown()).default({}),
});
export type Modifier = z.infer<typeof Modifier>;

export const LayerRole = z.enum(["hero", "support", "background", "overlay", "hud", "caption"]);
export type LayerRole = z.infer<typeof LayerRole>;

export const TimelineLayer = z.object({
  id: z.string(),
  capability: z.string(),
  /** cadrul de start, relativ la scenă (sau absolut pentru straturile globale) */
  from: z.number().int(),
  durationInFrames: z.number().int().positive(),
  z: z.number().default(0),
  /** cutia stratului în pixeli de compoziție (sau în pixelii imaginii, pentru copiii unui ecran) */
  box: Rect,
  params: z.record(z.string(), z.unknown()).default({}),
  /** adâncimea pentru cameră și parallax: 0 = lipit de ecran (HUD), 1 = planul scenei */
  depth: z.number().min(0).max(3).default(1),
  role: LayerRole.default("support"),
  modifiers: z.array(Modifier).default([]),
  /** căile publice ale fișierelor folosite (pentru validare și pregătirea randării) */
  assets: z.array(z.string()).default([]),
  get children() {
    return z.array(TimelineLayer).default([]);
  },
});
export type TimelineLayer = z.infer<typeof TimelineLayer>;

export const CameraKey = z.object({
  at: z.number().int(),
  /** punctul din scenă (pixeli de compoziție) adus în centrul cadrului */
  x: z.number(),
  y: z.number(),
  zoom: z.number().positive(),
  rotate: z.number().default(0),
  rotateX: z.number().default(0),
  rotateY: z.number().default(0),
  ease: z.enum(["linear", "inOut", "out", "in", "snap", "spring"]).default("inOut"),
});
export type CameraKey = z.infer<typeof CameraKey>;

export const TimelineCamera = z.object({
  keys: z.array(CameraKey).min(1),
  /** amplitudinea mișcării de mână, px */
  handheld: z.number().min(0).max(40).default(0),
  shake: z.array(z.object({ at: z.number().int(), amp: z.number().min(0).max(80) })).default([]),
  /** punch-in pe ritm: zoom scurt care sare la impact și revine */
  punches: z.array(z.object({ at: z.number().int(), amount: z.number().min(0).max(0.5) })).default([]),
  perspective: z.number().min(200).max(10000).default(1600),
  motionBlur: z.boolean().default(true),
  /** profunzimea de câmp: straturile departe de planul focalizat se estompează */
  depthOfField: z
    .object({ focusDepth: z.number(), strength: z.number().min(0).max(30), keys: z.array(z.object({ at: z.number().int(), focusDepth: z.number() })).default([]) })
    .optional(),
});
export type TimelineCamera = z.infer<typeof TimelineCamera>;

export const TimelineTransition = z.object({
  capability: z.string(),
  durationInFrames: z.number().int().min(0),
  params: z.record(z.string(), z.unknown()).default({}),
});
export type TimelineTransition = z.infer<typeof TimelineTransition>;

export const TimelineScene = z.object({
  id: z.string(),
  from: z.number().int().min(0),
  durationInFrames: z.number().int().positive(),
  transitionIn: TimelineTransition.nullable(),
  camera: TimelineCamera,
  layers: z.array(TimelineLayer),
  meta: z.object({
    purpose: z.string(),
    narrativeRole: z.string(),
    recipe: z.string(),
    shot: z.string(),
    energy: z.number(),
  }),
});
export type TimelineScene = z.infer<typeof TimelineScene>;

export const CaptionWord = z.object({ text: z.string(), from: z.number().int(), to: z.number().int() });
export type CaptionWord = z.infer<typeof CaptionWord>;

export const Palette = z.object({
  primary: HexColor,
  secondary: HexColor,
  accent: HexColor,
  background: HexColor,
  surface: HexColor,
  text: HexColor,
  textMuted: HexColor,
});
export type Palette = z.infer<typeof Palette>;

export const TypographySet = z.object({
  display: z.object({ family: z.string(), weight: z.number(), tracking: z.number(), uppercase: z.boolean() }),
  body: z.object({ family: z.string(), weight: z.number(), tracking: z.number(), uppercase: z.boolean() }),
  mono: z.object({ family: z.string(), weight: z.number(), tracking: z.number(), uppercase: z.boolean() }),
});
export type TypographySet = z.infer<typeof TypographySet>;

export const Timeline = z.object({
  schemaVersion: z.literal(1),
  projectId: z.string(),
  versionId: z.string(),
  formatId: z.string(),
  seed: z.number().int(),
  fps: z.number().int().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  durationInFrames: z.number().int().positive(),
  safeZone: z.object({ top: z.number(), right: z.number(), bottom: z.number(), left: z.number() }),
  fonts: z.array(TimelineFont),
  palette: Palette,
  typography: TypographySet,
  scenes: z.array(TimelineScene).min(1),
  /** straturi globale în cadre absolute (grain, vignetă, subtitrări) */
  overlays: z.array(TimelineLayer).default([]),
  captions: z
    .object({ words: z.array(CaptionWord), box: Rect, params: z.record(z.string(), z.unknown()).default({}) })
    .nullable()
    .default(null),
  audio: z.object({
    /** mixul final (cale publică) sau null dacă nu e încă mixat */
    src: z.string().nullable(),
    cues: z.array(AudioCue).default([]),
    beatGrid: BeatGrid.nullable().default(null),
  }),
  markers: z.array(z.object({ frame: z.number().int(), label: z.string(), kind: z.string() })).default([]),
  /** true când se folosesc materiale fără drepturi confirmate: apare marcajul „concept”, exportul final e blocat */
  concept: z.boolean().default(false),
});
export type Timeline = z.infer<typeof Timeline>;
export type TimelineInput = z.input<typeof Timeline>;
