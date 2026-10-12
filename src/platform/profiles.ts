/**
 * Profilurile de platformă: durate, format, momentul hook-ului și al brandului, densitatea textului,
 * comportamentul CTA, ritmul, subtitrările. Zonele sigure rămân în src/core/formats.ts (cu sursele lor).
 *
 * Valorile sunt reguli de lucru, nu specificații oficiale: au încredere declarată și se pot schimba
 * per proiect (project.json → platformOverrides.<platformă>), fără cod. Verifică ghidurile platformei
 * înainte de o campanie mare.
 */
import { z } from "zod";
import type { Platform, Project } from "../core/schema";

export const PlatformProfile = z.object({
  id: z.string(),
  label: z.string(),
  /** formatele recomandate, în ordinea preferinței */
  aspects: z.array(z.string()),
  durationSec: z.object({ min: z.number(), idealMin: z.number(), idealMax: z.number(), max: z.number() }),
  /** primul mesaj pe ecran până la (secunde) */
  hookBySec: z.number(),
  /** brandul (logo sau numele produsului) apare până la (secunde); null = fără cerință */
  brandBySec: z.number().nullable(),
  /** cuvinte pe ecran pe secundă, în medie (peste = text prea dens) */
  maxWordsPerSec: z.number(),
  ctaHoldSec: z.number(),
  /** durata medie a unei scene (secunde) */
  avgShotSec: z.tuple([z.number(), z.number()]),
  captions: z.enum(["required", "recommended", "optional"]),
  /** cât se vede fără sunet: decide cât de importante sunt subtitrările și textul */
  soundOff: z.enum(["high", "medium", "low"]),
  confidence: z.enum(["high", "medium", "low"]),
  note: z.string(),
});
export type PlatformProfile = z.infer<typeof PlatformProfile>;

const NOTE = "Regulă de lucru a studioului (nu specificație oficială); ajustabilă în project.json → platformOverrides.";

export const PLATFORM_PROFILES: Record<Platform, PlatformProfile> = {
  tiktok: {
    id: "tiktok",
    label: "TikTok",
    aspects: ["9x16"],
    durationSec: { min: 5, idealMin: 15, idealMax: 34, max: 60 },
    hookBySec: 1,
    brandBySec: null,
    maxWordsPerSec: 3,
    ctaHoldSec: 2.5,
    avgShotSec: [0.8, 2.6],
    captions: "recommended",
    soundOff: "low",
    confidence: "medium",
    note: `Feed cu sunet, ritm alert, aspect nativ. ${NOTE}`,
  },
  reels: {
    id: "reels",
    label: "Instagram Reels",
    aspects: ["9x16"],
    durationSec: { min: 5, idealMin: 15, idealMax: 30, max: 90 },
    hookBySec: 1,
    brandBySec: 4,
    maxWordsPerSec: 2.8,
    ctaHoldSec: 2.5,
    avgShotSec: [0.9, 3],
    captions: "recommended",
    soundOff: "medium",
    confidence: "medium",
    note: `Mulți privitori fără sunet; brandul devreme ajută reținerea. ${NOTE}`,
  },
  shorts: {
    id: "shorts",
    label: "YouTube Shorts",
    aspects: ["9x16"],
    durationSec: { min: 5, idealMin: 15, idealMax: 45, max: 60 },
    hookBySec: 1,
    brandBySec: null,
    maxWordsPerSec: 3,
    ctaHoldSec: 2.5,
    avgShotSec: [0.9, 3],
    captions: "recommended",
    soundOff: "low",
    confidence: "medium",
    note: `Feed vertical cu sunet. ${NOTE}`,
  },
  youtube: {
    id: "youtube",
    label: "YouTube",
    aspects: ["16x9"],
    durationSec: { min: 6, idealMin: 15, idealMax: 60, max: 180 },
    hookBySec: 1.5,
    brandBySec: 5,
    maxWordsPerSec: 2.5,
    ctaHoldSec: 3,
    avgShotSec: [1.4, 4],
    captions: "optional",
    soundOff: "low",
    confidence: "medium",
    note: `La reclamele care se pot sări după 5 s, brandul și ideea trebuie să apară înainte. ${NOTE}`,
  },
  feed: {
    id: "feed",
    label: "Feed (Facebook/Instagram)",
    aspects: ["4x5", "1x1"],
    durationSec: { min: 5, idealMin: 10, idealMax: 30, max: 120 },
    hookBySec: 1,
    brandBySec: 3,
    maxWordsPerSec: 2.5,
    ctaHoldSec: 2.5,
    avgShotSec: [1, 3],
    captions: "required",
    soundOff: "high",
    confidence: "medium",
    note: `Majoritatea fără sunet: textul și subtitrările poartă mesajul. ${NOTE}`,
  },
  linkedin: {
    id: "linkedin",
    label: "LinkedIn",
    aspects: ["1x1", "4x5", "16x9"],
    durationSec: { min: 5, idealMin: 15, idealMax: 30, max: 90 },
    hookBySec: 1.5,
    brandBySec: 4,
    maxWordsPerSec: 2.3,
    ctaHoldSec: 3,
    avgShotSec: [1.5, 4],
    captions: "required",
    soundOff: "high",
    confidence: "low",
    note: `Public profesional, vizionare fără sunet frecventă. ${NOTE}`,
  },
  x: {
    id: "x",
    label: "X",
    aspects: ["16x9", "1x1"],
    durationSec: { min: 5, idealMin: 15, idealMax: 45, max: 140 },
    hookBySec: 1,
    brandBySec: 4,
    maxWordsPerSec: 2.5,
    ctaHoldSec: 2.5,
    avgShotSec: [1, 3.5],
    captions: "required",
    soundOff: "high",
    confidence: "low",
    note: `Redare automată fără sunet. ${NOTE}`,
  },
  generic: {
    id: "generic",
    label: "Generic",
    aspects: ["16x9", "9x16", "1x1", "4x5"],
    durationSec: { min: 3, idealMin: 10, idealMax: 60, max: 600 },
    hookBySec: 1.5,
    brandBySec: null,
    maxWordsPerSec: 3,
    ctaHoldSec: 2.5,
    avgShotSec: [0.8, 4.5],
    captions: "optional",
    soundOff: "medium",
    confidence: "low",
    note: NOTE,
  },
};

/** Profilul efectiv pentru proiect: valorile implicite + ajustările din project.json, validate. */
export function platformProfile(platform: Platform, project?: Pick<Project, "platformOverrides"> | null): PlatformProfile {
  const base = PLATFORM_PROFILES[platform] ?? PLATFORM_PROFILES.generic;
  const over = project?.platformOverrides?.[platform];
  if (!over) return base;
  return PlatformProfile.parse({ ...base, ...over, durationSec: { ...base.durationSec, ...((over.durationSec as object) ?? {}) } });
}
