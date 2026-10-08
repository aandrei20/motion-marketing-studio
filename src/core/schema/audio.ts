import { z } from "zod";
import { Slug } from "./common";

export const BeatGrid = z.object({
  bpm: z.number().min(40).max(240),
  /** secunda primului timp accentuat (downbeat) */
  offsetSec: z.number().min(0),
  beatsPerBar: z.number().int().min(2).max(8).default(4),
  source: z.enum(["user", "detected", "synth"]),
  confidence: z.number().min(0).max(1).default(1),
  sections: z
    .array(z.object({ name: z.string(), startSec: z.number(), endSec: z.number(), energy: z.number().min(0).max(1) }))
    .default([]),
});
export type BeatGrid = z.infer<typeof BeatGrid>;

/** Un moment sonor din cue sheet. Fiecare efect vizual cu sunet își declară cue-ul aici. */
export const AudioCue = z.object({
  id: z.string(),
  kind: z.enum(["sfx", "voice", "music"]),
  atFrame: z.number().int().min(0),
  /** id de efect sintetizat (library/audio) sau cale publică spre fișier */
  sound: z.string(),
  gainDb: z.number().min(-60).max(12).default(0),
  pan: z.number().min(-1).max(1).default(0),
  sceneId: z.string().optional(),
  layerId: z.string().optional(),
  /** de ce există sunetul (ce eveniment vizual îl cere) */
  reason: z.string().default(""),
});
export type AudioCue = z.infer<typeof AudioCue>;

export const VoiceWord = z.object({ text: z.string(), startSec: z.number(), endSec: z.number() });
export type VoiceWord = z.infer<typeof VoiceWord>;

export const VoiceClip = z.object({
  lineId: Slug,
  /** cale relativă la proiect, WAV */
  file: z.string(),
  durationSec: z.number().positive(),
  words: z.array(VoiceWord).default([]),
  provider: z.string(),
  voice: z.string(),
  /** sincronizarea cuvintelor: exactă (de la motorul TTS) sau estimată proporțional */
  wordTiming: z.enum(["engine", "estimated", "none"]),
});
export type VoiceClip = z.infer<typeof VoiceClip>;

export const MixReport = z.object({
  durationSec: z.number(),
  integratedLufs: z.number().nullable(),
  truePeakDbtp: z.number(),
  samplePeakDbfs: z.number(),
  clippedSamples: z.number().int(),
  /** tăceri neintenționate peste prag */
  silences: z.array(z.object({ startSec: z.number(), endSec: z.number(), intentional: z.boolean() })),
  targetLufs: z.number(),
  truePeakCeiling: z.number(),
  ok: z.boolean(),
  problems: z.array(z.string()),
  stems: z.record(z.string(), z.object({ peakDbfs: z.number(), rmsDbfs: z.number() })).default({}),
});
export type MixReport = z.infer<typeof MixReport>;
