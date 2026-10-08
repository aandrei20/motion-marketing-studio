import { z } from "zod";
import { IsoDate, VersionId } from "./common";

/** Rubrica fixă din CLAUDE.md (regula 7). Aceeași în toate rundele. */
export const RubricKey = z.enum(["hook", "clarity", "rhythm", "hierarchy", "variety", "brand", "cta"]);
export type RubricKey = z.infer<typeof RubricKey>;
export const RUBRIC_KEYS = RubricKey.options;

export const TechnicalCheck = z.enum([
  "safe-zone",
  "readability",
  "flash",
  "black-frame",
  "audio",
  "claims",
  "rights",
  "real-footage",
  "determinism",
  "assets",
  "timing",
  "format",
]);
export type TechnicalCheck = z.infer<typeof TechnicalCheck>;

export const Severity = z.enum(["blocker", "major", "minor", "nit"]);
export type Severity = z.infer<typeof Severity>;

export const Finding = z.object({
  id: z.string(),
  round: z.number().int().min(0),
  frame: z.number().int().min(0).nullable(),
  timecode: z.string().nullable(),
  sceneId: z.string().nullable(),
  dimension: z.union([RubricKey, TechnicalCheck]),
  severity: Severity,
  problem: z.string(),
  recommendation: z.string(),
  source: z.enum(["auto-check", "ai-review", "user-note"]),
  status: z.enum(["open", "fixed", "wontfix"]).default("open"),
});
export type Finding = z.infer<typeof Finding>;

export const SceneScore = z.object({
  sceneId: z.string(),
  scores: z.record(RubricKey, z.number().min(1).max(10)),
  notes: z.array(z.string()).default([]),
});
export type SceneScore = z.infer<typeof SceneScore>;

export const CritiqueRound = z.object({
  n: z.number().int().min(1),
  at: IsoDate,
  versionId: VersionId,
  reviewer: z.string(),
  rubricVersion: z.literal("rubric-v1"),
  sceneScores: z.array(SceneScore),
  findings: z.array(Finding),
  /** media pe dimensiuni pentru tot filmul */
  overall: z.record(RubricKey, z.number()),
  minScene: z.number(),
});
export type CritiqueRound = z.infer<typeof CritiqueRound>;

export const Critique = z.object({
  schemaVersion: z.literal(1),
  threshold: z.number().default(8),
  rounds: z.array(CritiqueRound).default([]),
});
export type Critique = z.infer<typeof Critique>;
