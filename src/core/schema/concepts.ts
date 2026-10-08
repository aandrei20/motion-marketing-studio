import { z } from "zod";
import { IsoDate, Slug } from "./common";
import { CreativeDirection } from "./brief";
import { NarrativeRole } from "./storyboard";

/** Cele 10 criterii de evaluare a unui concept creativ. */
export const ConceptCriterion = z.enum(["hook", "novelty", "clarity", "relevance", "emotion", "visual", "audio", "cta", "platform", "brand"]);
export type ConceptCriterion = z.infer<typeof ConceptCriterion>;
export const CONCEPT_CRITERIA = ConceptCriterion.options;

/** Teritoriul creativ: tipul de idee pe care se sprijină reclama. */
export const CreativeTerritory = z.enum([
  "problem-solution",
  "transformation",
  "speed-proof",
  "feature-tour",
  "demo-first",
  "curiosity-gap",
  "manifesto",
  "old-vs-new",
  "user-concept",
]);
export type CreativeTerritory = z.infer<typeof CreativeTerritory>;

export const ConceptScore = z.object({
  value: z.number().min(0).max(10),
  why: z.string(),
  /** engine = calculat din date; ai = evaluat de Claude; user = dat de utilizator */
  source: z.enum(["engine", "ai", "user"]),
});
export type ConceptScore = z.infer<typeof ConceptScore>;

export const CreativeConcept = z.object({
  id: Slug,
  title: z.string().min(1),
  territory: CreativeTerritory,
  /** ideea mare, într-o propoziție */
  bigIdea: z.string().min(1),
  hook: z.object({ text: z.string().min(1), origin: z.enum(["user-verbatim", "site-quote", "ai"]) }),
  /** arcul narativ (rolurile scenelor, în ordine) */
  arc: z.array(NarrativeRole).min(2),
  templateId: z.string(),
  direction: CreativeDirection,
  visualWorld: z.string().default(""),
  motionLanguage: z.string().default(""),
  audioIdea: z.string().default(""),
  /** afirmațiile din research pe care se sprijină conceptul */
  claimIds: z.array(Slug).default([]),
  /** ce materiale cere (și dacă există) */
  needs: z.array(z.object({ what: z.string(), available: z.boolean() })).default([]),
  risks: z.array(z.string()).default([]),
  scores: z.partialRecord(ConceptCriterion, ConceptScore).default({}),
  /** 0–100, media ponderată a criteriilor */
  total: z.number().min(0).max(100).default(0),
  /** user = conceptul utilizatorului (prioritar, regula 14); engine = propus din date; ai = propus de Claude (sugestie) */
  origin: z.enum(["user", "engine", "ai"]),
});
export type CreativeConcept = z.infer<typeof CreativeConcept>;
export type CreativeConceptInput = z.input<typeof CreativeConcept>;

export const Concepts = z.object({
  schemaVersion: z.literal(1),
  generatedAt: IsoDate,
  /** amprentele intrărilor (brief, research, assets): dacă nu s-au schimbat, conceptele nu se regenerează */
  inputs: z.record(z.string(), z.string()).default({}),
  concepts: z.array(CreativeConcept).default([]),
  selectedId: Slug.nullable().default(null),
  rationale: z.array(z.string()).default([]),
});
export type Concepts = z.infer<typeof Concepts>;
