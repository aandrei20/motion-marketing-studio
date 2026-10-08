import { z } from "zod";
import { NormPoint, Slug } from "./common";

export const NarrativeRole = z.enum([
  "hook",
  "problem",
  "agitation",
  "reveal",
  "solution",
  "feature",
  "demo",
  "proof",
  "transformation",
  "benefit",
  "cta",
  "outro",
]);
export type NarrativeRole = z.infer<typeof NarrativeRole>;

export const EmotionalRole = z.enum([
  "curiosity",
  "tension",
  "frustration",
  "relief",
  "delight",
  "confidence",
  "urgency",
  "aspiration",
  "trust",
]);
export type EmotionalRole = z.infer<typeof EmotionalRole>;

/** Tipul de cadru, din gramatica de montaj. */
export const ShotType = z.enum(["establishing", "hero", "close-up", "insert", "montage", "wide", "detail", "title"]);
export type ShotType = z.infer<typeof ShotType>;

export const CompositionKind = z.enum([
  "thirds-left",
  "thirds-right",
  "center",
  "split",
  "full-bleed",
  "stacked",
]);
export type CompositionKind = z.infer<typeof CompositionKind>;

export const CapabilityUse = z.object({
  capability: z.string().min(1),
  params: z.record(z.string(), z.unknown()).default({}),
});
export type CapabilityUse = z.infer<typeof CapabilityUse>;

export const TransitionUse = z.object({
  capability: z.string().min(1),
  /** null = durata implicită a tranziției, ajustată după ritm */
  durationFrames: z.number().int().min(0).max(60).nullable().default(null),
  params: z.record(z.string(), z.unknown()).default({}),
});
export type TransitionUse = z.infer<typeof TransitionUse>;

export const StoryboardScene = z.object({
  id: Slug,
  /** de ce există scena (o propoziție) */
  purpose: z.string().min(1),
  narrativeRole: NarrativeRole,
  emotionalRole: EmotionalRole,
  /** 0 = calm, 1 = maxim */
  energy: z.number().min(0).max(1),
  shot: ShotType,
  /** null = durata se calculează din voce, timp de citire și ritm */
  durationSec: z.number().positive().max(60).nullable().default(null),
  lineIds: z.array(Slug).default([]),
  recipe: z.object({ id: z.string().min(1), params: z.record(z.string(), z.unknown()).default({}) }),
  /** asset-urile legate de sloturile rețetei (de ex. screen, logo, before, after) */
  slots: z.record(z.string(), z.union([Slug, z.array(Slug)])).default({}),
  /** textul de pe ecran, dacă diferă de liniile de script */
  text: z
    .object({
      headline: z.string().optional(),
      sub: z.string().optional(),
      items: z.array(z.string()).optional(),
    })
    .default({}),
  focus: z
    .object({ assetId: Slug, region: Slug.optional(), point: NormPoint.optional() })
    .optional(),
  camera: CapabilityUse.optional(),
  overrides: z.array(CapabilityUse.extend({ slot: z.string() })).default([]),
  transitionIn: TransitionUse.nullable().default(null),
  typography: z.enum(["kinetic", "editorial", "minimal", "technical"]).optional(),
  audio: z
    .object({
      sfx: z.union([z.literal("auto"), z.literal("none"), z.array(z.string())]).default("auto"),
      silence: z.boolean().default(false),
      musicSection: z.string().optional(),
    })
    .default({ sfx: "auto", silence: false }),
  beat: z
    .object({ snap: z.enum(["none", "beat", "bar"]).default("beat") })
    .default({ snap: "beat" }),
  composition: CompositionKind.default("thirds-left"),
  cta: z.enum(["none", "setup", "payoff", "hold"]).default("none"),
  notes: z.string().default(""),
});
export type StoryboardScene = z.infer<typeof StoryboardScene>;
export type StoryboardSceneInput = z.input<typeof StoryboardScene>;

export const Storyboard = z.object({
  schemaVersion: z.literal(1),
  /** șablonul de structură din care a pornit (templates/) */
  templateId: z.string().optional(),
  rationale: z.array(z.string()).default([]),
  scenes: z.array(StoryboardScene).min(1),
});
export type Storyboard = z.infer<typeof Storyboard>;
export type StoryboardInput = z.input<typeof Storyboard>;
