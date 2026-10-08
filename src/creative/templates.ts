import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { readJson } from "../core/json";
import { PATHS } from "../core/paths";
import { CreativeDirection, EmotionalRole, NarrativeRole, ProductCategory, ShotType } from "../core/schema";

export const TemplateScene = z.object({
  role: NarrativeRole,
  recipe: z.string(),
  energy: z.number().min(0).max(1),
  emotion: EmotionalRole,
  shot: ShotType,
  /** ce fel de replică primește scena */
  line: z.enum(["hook", "problem", "reveal", "feature", "benefit", "proof", "cta"]),
  weight: z.number().positive(),
  optional: z.boolean().default(false),
});
export type TemplateScene = z.infer<typeof TemplateScene>;

export const AdTemplate = z.object({
  schemaVersion: z.literal(1),
  id: z.string(),
  title: z.string(),
  description: z.string(),
  durationSec: z.tuple([z.number(), z.number()]),
  directions: z.array(CreativeDirection),
  products: z.array(ProductCategory),
  scenes: z.array(TemplateScene).min(2),
});
export type AdTemplate = z.infer<typeof AdTemplate>;

export function listTemplates(): AdTemplate[] {
  return fs
    .readdirSync(PATHS.templates)
    .filter((f) => f.endsWith(".json"))
    .map((f) => readJson(path.join(PATHS.templates, f), AdTemplate));
}

export function getTemplate(id: string): AdTemplate {
  const f = path.join(PATHS.templates, `${id}.json`);
  return readJson(f, AdTemplate);
}

/** Alege șablonul după produs, direcție și durată (scor simplu, explicat). */
export function chooseTemplate(input: { category: string; direction: string | null; durationSec: number; objective: string }): { template: AdTemplate; why: string } {
  const all = listTemplates();
  const scored = all.map((t) => {
    let s = 0;
    const why: string[] = [];
    if (t.products.includes(input.category as never)) (s += 3), why.push("potrivit tipului de produs");
    if (input.direction && t.directions.includes(input.direction as never)) (s += 2), why.push("potrivit direcției");
    if (input.durationSec >= t.durationSec[0] && input.durationSec <= t.durationSec[1]) (s += 3), why.push("durata se încadrează");
    if (input.objective === "launch" && t.id === "product-launch") (s += 4), why.push("obiectiv: lansare");
    if (input.durationSec <= 16 && t.id === "teaser-15") s += 2;
    return { t, s, why };
  });
  scored.sort((a, b) => b.s - a.s || a.t.id.localeCompare(b.t.id));
  return { template: scored[0].t, why: scored[0].why.join(", ") || "cel mai general șablon" };
}
