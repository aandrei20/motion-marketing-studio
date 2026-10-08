import { z } from "zod";
import { HexColor, Origin, Slug } from "./common";

/** Referință la un font: din bibliotecă (licență OFL verificată) sau din materialele proiectului. */
export const FontRef = z.object({
  family: z.string().min(1),
  source: z.enum(["library", "project-asset"]),
  /** id-ul din library/fonts/fonts.json sau id-ul asset-ului din proiect */
  ref: z.string().min(1),
  weight: z.number().int().min(100).max(1000).default(400),
  /** greutatea pentru titluri mari */
  displayWeight: z.number().int().min(100).max(1000).default(800),
  /** 0 = normal; negativ = strâns (em) */
  tracking: z.number().min(-0.1).max(0.3).default(0),
  uppercase: z.boolean().default(false),
});
export type FontRef = z.infer<typeof FontRef>;

export const Brand = z.object({
  schemaVersion: z.literal(1),
  name: z.string().min(1),
  logo: z.object({
    primary: Slug.optional(),
    mark: Slug.optional(),
    onDark: Slug.optional(),
    onLight: Slug.optional(),
    rules: z.object({
      allowRecolor: z.boolean().default(false),
      allowRotate: z.boolean().default(false),
      allowEffects: z.boolean().default(true),
      /** spațiu liber minim în jurul logo-ului, ca procent din lățimea lui */
      clearSpacePct: z.number().min(0).max(1).default(0.25),
    }),
  }),
  colors: z.object({
    primary: HexColor,
    secondary: HexColor.optional(),
    accent: HexColor.optional(),
    background: HexColor,
    surface: HexColor.optional(),
    text: HexColor,
    textMuted: HexColor.optional(),
    extra: z.array(z.object({ name: z.string(), value: HexColor })).default([]),
    origin: Origin,
  }),
  typography: z.object({
    display: FontRef,
    body: FontRef,
    mono: FontRef.optional(),
    origin: Origin,
  }),
  shape: z.object({
    radius: z.number().min(0).max(80).default(16),
    spacing: z.number().min(2).max(64).default(8),
    shadow: z.enum(["none", "soft", "deep"]).default("soft"),
  }),
  gradients: z.array(z.object({ from: HexColor, to: HexColor, angle: z.number().default(135) })).default([]),
  personality: z.object({
    keywords: z.array(z.string()).default([]),
    density: z.enum(["airy", "balanced", "dense"]).default("balanced"),
    motion: z.enum(["calm", "smooth", "snappy", "aggressive"]).default("smooth"),
  }),
});
export type Brand = z.infer<typeof Brand>;
export type BrandInput = z.input<typeof Brand>;
