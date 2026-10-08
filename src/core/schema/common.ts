import { z } from "zod";

/** Identificator stabil: litere mici, cifre, cratimă. Folosit pentru proiecte, scene, straturi, asset-uri. */
export const Slug = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9][a-z0-9-]*$/, "folosește doar litere mici, cifre și cratimă");
export type Slug = z.infer<typeof Slug>;

export const IsoDate = z.string().min(10);

export const Confidence = z.enum(["high", "medium", "low"]);
export type Confidence = z.infer<typeof Confidence>;

export const Rect = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number().nonnegative(),
  h: z.number().nonnegative(),
});
export type Rect = z.infer<typeof Rect>;

export const Point = z.object({ x: z.number(), y: z.number() });
export type Point = z.infer<typeof Point>;

/** Punct normalizat 0..1 în spațiul unei imagini. */
export const NormPoint = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) });
export type NormPoint = z.infer<typeof NormPoint>;

export const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/, "culoare hex #rrggbb");
export type HexColor = z.infer<typeof HexColor>;

/** Cine a produs o decizie sau o valoare: utilizatorul, o extracție automată sau o inferență. */
export const Origin = z.enum(["user", "extracted", "inferred", "ai", "default"]);
export type Origin = z.infer<typeof Origin>;

export const VersionId = z.string().regex(/^v[0-9]+$/, "versiunile sunt v1, v2, v3…");
export type VersionId = z.infer<typeof VersionId>;
