import { z } from "zod";
import { IsoDate, NormPoint, Rect, Slug } from "./common";

export const AssetType = z.enum(["image", "svg", "video", "audio", "font", "pdf", "document", "other"]);
export type AssetType = z.infer<typeof AssetType>;

/** De unde vine un fișier. Interfața produsului poate veni doar din `real_capture` sau `user_provided`. */
export const AssetOrigin = z.enum(["real_capture", "user_provided", "generated", "stock"]);
export type AssetOrigin = z.infer<typeof AssetOrigin>;

export const AssetRole = z.enum([
  "screenshot",
  "screen-recording",
  "logo",
  "product-image",
  "photo",
  "background",
  "icon",
  "music",
  "voiceover",
  "sfx",
  "font",
  "brand-guide",
  "reference-video",
  "reference-image",
  "document",
  "other",
]);
export type AssetRole = z.infer<typeof AssetRole>;

/** O zonă dintr-o imagine (pixeli, în spațiul imaginii), de ex. un buton găsit în DOM la captură. */
export const Region = z.object({
  id: Slug,
  label: z.string(),
  kind: z.enum(["button", "input", "heading", "nav", "link", "image", "text", "pii", "custom"]),
  rect: Rect,
  text: z.string().optional(),
  selector: z.string().optional(),
});
export type Region = z.infer<typeof Region>;

export const RightsStatus = z.enum(["owned", "confirmed-by-user", "not-confirmed", "denied"]);
export type RightsStatus = z.infer<typeof RightsStatus>;

export const Asset = z.object({
  id: Slug,
  /** cale relativă la folderul proiectului, de ex. assets/screenshot-3f2a9c.png */
  file: z.string(),
  originalName: z.string(),
  sha256: z.string(),
  bytes: z.number().int().nonnegative(),
  mime: z.string(),
  type: AssetType,
  origin: AssetOrigin,
  role: AssetRole,
  roleSource: z.enum(["user", "inferred"]),
  roleConfidence: z.number().min(0).max(1),
  /** arată interfața produsului (contează pentru regula de footage real) */
  showsProductUI: z.boolean(),
  rights: z.object({
    thirdParty: z.boolean(),
    status: RightsStatus,
    note: z.string().default(""),
    confirmedAt: IsoDate.optional(),
  }),
  media: z.object({
    width: z.number().int().optional(),
    height: z.number().int().optional(),
    durationSec: z.number().optional(),
    fps: z.number().optional(),
    hasAlpha: z.boolean().optional(),
    hasAudio: z.boolean().optional(),
    codec: z.string().optional(),
    sampleRate: z.number().int().optional(),
    channels: z.number().int().optional(),
    orientation: z.enum(["portrait", "landscape", "square"]).optional(),
    fontFamily: z.string().optional(),
    fontSubfamily: z.string().optional(),
    fontVariable: z.boolean().optional(),
    pageCount: z.number().int().optional(),
  }),
  analysis: z
    .object({
      focalPoint: NormPoint.optional(),
      focalSource: z.enum(["user", "auto", "capture"]).optional(),
      palette: z.array(z.string()).default([]),
      meanLuma: z.number().optional(),
      /** hash perceptual pe 64 biți (hex), pentru duplicate apropiate */
      dhash: z.string().optional(),
      duplicateOf: Slug.optional(),
      nearDuplicates: z.array(Slug).default([]),
      importance: z.number().min(0).max(1).optional(),
      bpm: z.number().optional(),
      loudnessLufs: z.number().optional(),
    })
    .default({ palette: [], nearDuplicates: [] }),
  capture: z
    .object({
      url: z.string(),
      viewport: z.object({ width: z.number().int(), height: z.number().int() }),
      deviceScaleFactor: z.number(),
      capturedAt: IsoDate,
      fullPage: z.boolean(),
      regions: z.array(Region).default([]),
    })
    .optional(),
  /** date personale vizibile (email, nume de cont); se estompează doar cu acordul utilizatorului */
  /** date personale găsite la captură; decizia utilizatorului: estompează (blurApproved) sau lasă vizibile (keepApproved) */
  pii: z.object({ regions: z.array(Region).default([]), blurApproved: z.boolean().default(false), keepApproved: z.boolean().default(false) }).default({
    regions: [],
    blurApproved: false,
    keepApproved: false,
  }),
  tags: z.array(z.string()).default([]),
  notes: z.string().default(""),
  addedAt: IsoDate,
});
export type Asset = z.infer<typeof Asset>;
export type AssetInput = z.input<typeof Asset>;

export const AssetManifest = z.object({
  schemaVersion: z.literal(1),
  assets: z.array(Asset).default([]),
});
export type AssetManifest = z.infer<typeof AssetManifest>;
