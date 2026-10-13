/** Toate rețetele, în ordinea din catalog, și căutarea după id. */
import { ctaEnd } from "./cta";
import { proofMetric, launchBurst, steps, technicalDemo } from "./proof";
import { productReveal } from "./reveal";
import { hookKinetic, kineticSequence, problemStatement } from "./text";
import type { RecipeOutput } from "./types";
import { beforeAfter, deviceHero, featureMontage, scrollTour, stack3d, uiSpotlight, uiWalkthrough } from "./ui";

export const RECIPES = [
  hookKinetic,
  kineticSequence,
  problemStatement,
  productReveal,
  uiSpotlight,
  uiWalkthrough,
  featureMontage,
  scrollTour,
  deviceHero,
  stack3d,
  beforeAfter,
  steps,
  proofMetric,
  launchBurst,
  technicalDemo,
  ctaEnd,
];

export function getRecipe(id: string) {
  const r = RECIPES.find((x) => x.id === id);
  if (!r) throw new Error(`Rețetă necunoscută: ${id}. Disponibile: ${RECIPES.map((x) => x.id).join(", ")}`);
  return r;
}

export type { RecipeOutput };
