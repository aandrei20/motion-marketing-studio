import { z } from "zod";
import { Confidence, IsoDate, Slug } from "./common";

export const SourceKind = z.enum([
  "official-site",
  "pricing",
  "docs",
  "help",
  "changelog",
  "blog",
  "press",
  "store-listing",
  "user-provided",
  "third-party",
  "competitor",
]);
export type SourceKind = z.infer<typeof SourceKind>;

export const Source = z.object({
  id: Slug,
  kind: SourceKind,
  url: z.string().optional(),
  assetId: Slug.optional(),
  title: z.string(),
  fetchedAt: IsoDate,
  /** sha256 al textului extras: arată dacă sursa s-a schimbat de la ultima citire */
  contentHash: z.string(),
  /** fișier text cu conținutul extras, relativ la proiect */
  textFile: z.string().optional(),
  reliability: z.enum(["official", "user", "third-party"]),
});
export type Source = z.infer<typeof Source>;

/**
 * FAPT = spus explicit de o sursă (cu citat). INFERENȚĂ = dedus din surse.
 * INTERPRETARE CREATIVĂ = formulare de marketing fără pretenție factuală.
 */
export const ClaimKind = z.enum(["fact", "inference", "creative-interpretation"]);
export type ClaimKind = z.infer<typeof ClaimKind>;

export const ClaimStatus = z.enum(["verified", "needs-confirmation", "approved-by-user", "rejected"]);
export type ClaimStatus = z.infer<typeof ClaimStatus>;

export const Claim = z.object({
  id: Slug,
  text: z.string().min(1),
  kind: ClaimKind,
  category: z.enum([
    "feature",
    "benefit",
    "pricing",
    "metric",
    "audience",
    "positioning",
    "differentiator",
    "use-case",
    "testimonial",
    "other",
  ]),
  sourceIds: z.array(Slug).default([]),
  /** citatul exact din sursă care susține afirmația */
  quote: z.string().optional(),
  confidence: Confidence,
  status: ClaimStatus,
  checkedAt: IsoDate,
  notes: z.string().default(""),
});
export type Claim = z.infer<typeof Claim>;

export const Research = z.object({
  schemaVersion: z.literal(1),
  productSummary: z.string().default(""),
  sources: z.array(Source).default([]),
  claims: z.array(Claim).default([]),
  /** ce merită verificat de om, în ordinea priorității */
  openQuestions: z.array(z.string()).default([]),
});
export type Research = z.infer<typeof Research>;

/** O afirmație poate apărea în video doar dacă e verificată cu sursă sau aprobată explicit de utilizator. */
export function isClaimUsable(c: Claim): boolean {
  if (c.status === "approved-by-user") return true;
  if (c.status !== "verified") return false;
  if (c.kind === "creative-interpretation") return true;
  return c.sourceIds.length > 0;
}
