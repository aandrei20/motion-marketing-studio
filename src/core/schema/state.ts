import { z } from "zod";
import { IsoDate } from "./common";

export const PIPELINE_STEPS = [
  "intake",
  "brief-approval",
  "capture",
  "assets",
  "research",
  "brand",
  "script",
  "storyboard",
  "compile",
  "audio",
  "preview",
  "critique",
  "user-listening",
  "final-render",
] as const;
export type PipelineStep = (typeof PIPELINE_STEPS)[number];

export const StepState = z.enum(["pending", "done", "skipped", "blocked"]);

export const ProjectState = z.object({
  schemaVersion: z.literal(1),
  steps: z.record(z.enum(PIPELINE_STEPS), z.object({ state: StepState, at: IsoDate.optional(), note: z.string().default("") })),
  decisions: z.array(z.object({ at: IsoDate, text: z.string() })).default([]),
  next: z.array(z.string()).default([]),
  log: z.array(z.object({ at: IsoDate, text: z.string() })).default([]),
});
export type ProjectState = z.infer<typeof ProjectState>;
