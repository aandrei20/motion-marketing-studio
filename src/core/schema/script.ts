import { z } from "zod";
import { Slug } from "./common";

export const LineOrigin = z.enum(["user-verbatim", "user-polished", "ai"]);
export type LineOrigin = z.infer<typeof LineOrigin>;

export const ScriptLine = z.object({
  id: Slug,
  /** textul rostit; gol dacă linia e doar text pe ecran */
  voiceover: z.string().default(""),
  /** textul de pe ecran (poate fi diferit de voce: mai scurt) */
  onScreen: z.string().default(""),
  /** cuvinte (din onScreen) care primesc accent vizual */
  emphasis: z.array(z.string()).default([]),
  pauseAfterMs: z.number().int().min(0).max(5000).default(0),
  emotion: z.string().default(""),
  visualIntent: z.string().default(""),
  /** afirmațiile din research pe care se sprijină linia */
  claimIds: z.array(Slug).default([]),
  origin: LineOrigin,
  /** frazele obligatorii (din brief) conținute exact în această linie */
  mandatoryPhraseIds: z.array(Slug).default([]),
  pronunciation: z.array(z.object({ text: z.string(), say: z.string() })).default([]),
  isHook: z.boolean().default(false),
  isCta: z.boolean().default(false),
});
export type ScriptLine = z.infer<typeof ScriptLine>;
export type ScriptLineInput = z.input<typeof ScriptLine>;

export const Script = z.object({
  schemaVersion: z.literal(1),
  textLanguage: z.string(),
  voiceLanguage: z.string().nullable(),
  hooks: z
    .array(z.object({ id: Slug, text: z.string(), origin: LineOrigin, selected: z.boolean().default(false) }))
    .default([]),
  lines: z.array(ScriptLine).min(1),
});
export type Script = z.infer<typeof Script>;
export type ScriptInput = z.input<typeof Script>;
