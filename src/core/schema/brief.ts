import { z } from "zod";
import { IsoDate, Slug } from "./common";
import { Platform } from "./project";

export const CreativeDirection = z.enum(["emotional", "aggressive", "premium", "technical", "minimal", "energetic"]);
export type CreativeDirection = z.infer<typeof CreativeDirection>;

export const Pacing = z.enum(["slow", "medium", "fast", "aggressive"]);
export type Pacing = z.infer<typeof Pacing>;

/** O frază pe care utilizatorul a cerut-o exact. Nu se modifică niciodată automat. */
export const MandatoryPhrase = z.object({
  id: Slug,
  text: z.string().min(1),
  /** unde trebuie să apară: voce, text pe ecran sau oricare */
  channel: z.enum(["voiceover", "on-screen", "any"]).default("any"),
});
export type MandatoryPhrase = z.infer<typeof MandatoryPhrase>;

export const Brief = z.object({
  schemaVersion: z.literal(1),
  objective: z.enum(["awareness", "signups", "downloads", "sales", "launch", "feature-adoption", "other"]),
  objectiveNote: z.string().default(""),
  audience: z.object({
    description: z.string().min(1),
    painPoints: z.array(z.string()).default([]),
    sophistication: z.enum(["beginner", "mixed", "expert"]).default("mixed"),
  }),
  /** Viziunea utilizatorului, păstrată cuvânt cu cuvânt. */
  userVision: z.object({
    story: z.string().default(""),
    hooks: z.array(z.string()).default([]),
    mandatoryPhrases: z.array(MandatoryPhrase).default([]),
    roughScript: z.string().default(""),
    concept: z.string().default(""),
  }),
  tone: z.array(z.string()).default([]),
  desiredEmotion: z.string().default(""),
  pacing: Pacing,
  /** `null` = utilizatorul vrea să i se propună direcții (A–F). */
  direction: CreativeDirection.nullable(),
  visual: z.object({
    effectsLevel: z.enum(["subtle", "medium", "bold"]).default("medium"),
    forbiddenCapabilities: z.array(z.string()).default([]),
    allow3d: z.boolean().default(true),
    faces: z.boolean().default(false),
    notes: z.string().default(""),
  }),
  cta: z.object({
    text: z.string().min(1),
    url: z.string().optional(),
    /** dacă CTA-ul conține o ofertă/preț, trimite la afirmația verificată */
    claimIds: z.array(Slug).default([]),
  }),
  doNotSay: z.array(z.string()).default([]),
  doNotShow: z.array(z.string()).default([]),
  platforms: z.array(Platform).min(1),
  durationSec: z.number().positive().max(600),
  audio: z.object({
    voice: z.object({
      mode: z.enum(["user-file", "tts", "none"]),
      provider: z.string().optional(),
      voiceId: z.string().optional(),
      rate: z.number().min(0.5).max(2).default(1),
      assetId: Slug.optional(),
    }),
    music: z.object({
      mode: z.enum(["user-file", "synth", "none"]),
      assetId: Slug.optional(),
      mood: z.enum(["driving", "uplifting", "dark", "calm", "playful"]).default("driving"),
      bpm: z.number().min(60).max(200).optional(),
    }),
    sfxDensity: z.enum(["none", "low", "medium", "high"]).default("medium"),
    intentionalSilence: z.boolean().default(false),
  }),
  references: z
    .array(z.object({ assetId: Slug, aspects: z.array(z.string()).default([]), note: z.string().default("") }))
    .default([]),
  /** subtitrări arse în video și/sau fișier .srt */
  captions: z.object({ burnIn: z.boolean().default(true), srt: z.boolean().default(true) }).default({ burnIn: true, srt: true }),
  approvedAt: IsoDate.nullable().default(null),
});
export type Brief = z.infer<typeof Brief>;
export type BriefInput = z.input<typeof Brief>;
