import { z } from "zod";
import { IsoDate, Slug, VersionId } from "./common";

export const ProductCategory = z.enum([
  "saas",
  "mobile-app",
  "desktop-app",
  "website",
  "ai-product",
  "developer-tool",
  "fintech",
  "productivity",
  "creative-tool",
  "ecommerce",
  "startup",
  "enterprise",
  "digital-service",
  "other",
]);
export type ProductCategory = z.infer<typeof ProductCategory>;

export const Platform = z.enum(["tiktok", "reels", "shorts", "youtube", "feed", "linkedin", "x", "generic"]);
export type Platform = z.infer<typeof Platform>;

/** Un format de livrare: dimensiune, FPS, durată și platforma pentru zonele de siguranță. */
export const FormatSpec = z.object({
  id: Slug,
  width: z.number().int().min(16).max(7680),
  height: z.number().int().min(16).max(7680),
  fps: z.number().int().min(1).max(120),
  durationSec: z.number().positive().max(600),
  platform: Platform,
});
export type FormatSpec = z.infer<typeof FormatSpec>;

export const ProjectStatus = z.enum(["intake", "brief-approved", "in-production", "preview", "approved", "final"]);
export type ProjectStatus = z.infer<typeof ProjectStatus>;

export const Project = z.object({
  schemaVersion: z.literal(1),
  id: Slug,
  name: z.string().min(1),
  createdAt: IsoDate,
  updatedAt: IsoDate,
  product: z.object({
    name: z.string().min(1),
    url: z.string().url().optional(),
    category: ProductCategory,
    oneLiner: z.string().optional(),
  }),
  /** Limbile sunt alese de utilizator; `null` înseamnă „încă nu a ales” (fără implicit). */
  language: z.object({
    text: z.string().nullable(),
    voice: z.string().nullable(),
  }),
  formats: z.array(FormatSpec).min(1),
  currentVersion: VersionId.nullable(),
  status: ProjectStatus,
  /** Sămânța de determinism: aceeași sămânță + același timeline = aceleași cadre. */
  seed: z.number().int().nonnegative(),
});
export type Project = z.infer<typeof Project>;

export const Approval = z.object({
  kind: z.enum(["brief", "claim", "render-final", "version"]),
  at: IsoDate,
  /** Fraza exactă scrisă de utilizator („aprob”, „render final”). */
  phrase: z.string(),
  versionId: VersionId.optional(),
  subject: z.string().optional(),
});
export type Approval = z.infer<typeof Approval>;

export const Approvals = z.object({ items: z.array(Approval) });
export type Approvals = z.infer<typeof Approvals>;
