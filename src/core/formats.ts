import type { FormatSpec, Platform } from "./schema/project";
import type { Rect } from "./schema/common";

/** Preseturi de format. Orice altă dimensiune se poate da explicit (custom). */
export const FORMAT_PRESETS = {
  "9x16": { width: 1080, height: 1920 },
  "16x9": { width: 1920, height: 1080 },
  "1x1": { width: 1080, height: 1080 },
  "4x5": { width: 1080, height: 1350 },
  "9x16-4k": { width: 2160, height: 3840 },
  "16x9-4k": { width: 3840, height: 2160 },
} as const;
export type FormatPresetId = keyof typeof FORMAT_PRESETS;

export const SUPPORTED_FPS = [24, 25, 30, 50, 60] as const;

export function makeFormat(
  preset: FormatPresetId | { width: number; height: number; id?: string },
  opts: { fps?: number; durationSec: number; platform: Platform },
): FormatSpec {
  const dims = typeof preset === "string" ? FORMAT_PRESETS[preset] : preset;
  const id = typeof preset === "string" ? preset : (preset.id ?? `${preset.width}x${preset.height}`);
  return { id, width: dims.width, height: dims.height, fps: opts.fps ?? 30, durationSec: opts.durationSec, platform: opts.platform };
}

export type Orientation = "portrait" | "landscape" | "square";
export function orientationOf(w: number, h: number): Orientation {
  const r = w / h;
  if (r > 1.15) return "landscape";
  if (r < 0.87) return "portrait";
  return "square";
}

/**
 * Zone de siguranță ca procente din cadru, plus zone excluse (butoanele platformei).
 * Valorile vin din surse secundare care citează ghidurile oficiale; încredere „medie”.
 * Verifică-le în Ads Manager-ul platformei înainte de o campanie mare.
 */
export interface SafeZoneSpec {
  top: number;
  right: number;
  bottom: number;
  left: number;
  /** zone excluse, ca fracții din cadru */
  exclusions: Array<{ x: number; y: number; w: number; h: number; label: string }>;
  sources: string[];
  checkedAt: string;
  confidence: "high" | "medium" | "low";
  note: string;
}

const CHECKED = "2026-10-08";

export const SAFE_ZONES: Record<Platform, SafeZoneSpec> = {
  tiktok: {
    top: 240 / 1920,
    right: 120 / 1080,
    bottom: 660 / 1920,
    left: 120 / 1080,
    exclusions: [{ x: 780 / 1080, y: 840 / 1920, w: 300 / 1080, h: 420 / 1920, label: "coloana de acțiuni TikTok" }],
    sources: [
      "https://sovran.ai/blog/tiktok-video-ad-specs",
      "https://www.tryvizup.com/blog/tiktok-ad-specs-2026-video-sizes-spark-ads-and-safe-zones",
      "https://adkit.so/tools/safe-zones/tiktok",
    ],
    checkedAt: CHECKED,
    confidence: "medium",
    note: "In-Feed ads 1080×1920: sus 240, jos 660, laterale 120, plus coloana de butoane din dreapta de la y=840.",
  },
  reels: {
    top: 0.14,
    right: 0.06,
    bottom: 0.35,
    left: 0.06,
    exclusions: [],
    sources: ["https://adsuploader.com/blog/meta-ads-safe-zones", "https://adnova.ai/blogs/meta-ad-safe-zones-guide"],
    checkedAt: CHECKED,
    confidence: "medium",
    note: "Meta (reclame Reels): 14% sus, 35% jos, 6% pe laterale.",
  },
  shorts: {
    top: 0.15,
    right: 192 / 1080,
    bottom: 0.35,
    left: 48 / 1080,
    exclusions: [],
    sources: ["https://adkit.so/tools/safe-zones/youtube", "https://reap.video/blog/short-form-video-safe-zones"],
    checkedAt: CHECKED,
    confidence: "medium",
    note: "Google Ads (Shorts): 288 px sus, 672 px jos, 48 stânga, 192 dreapta la 1080×1920.",
  },
  youtube: {
    top: 0.05,
    right: 0.05,
    bottom: 0.1,
    left: 0.05,
    exclusions: [],
    sources: [],
    checkedAt: CHECKED,
    confidence: "low",
    note: "Convenție internă (title-safe ~90%), plus bara de progres jos. Fără sursă oficială verificată.",
  },
  feed: {
    top: 0.05,
    right: 0.05,
    bottom: 0.05,
    left: 0.05,
    exclusions: [],
    sources: [],
    checkedAt: CHECKED,
    confidence: "low",
    note: "Convenție internă: margine 5%. Fără suprapuneri de interfață cunoscute.",
  },
  linkedin: {
    top: 0.05,
    right: 0.05,
    bottom: 0.08,
    left: 0.05,
    exclusions: [],
    sources: [],
    checkedAt: CHECKED,
    confidence: "low",
    note: "Convenție internă. Fără sursă oficială verificată.",
  },
  x: {
    top: 0.05,
    right: 0.05,
    bottom: 0.08,
    left: 0.05,
    exclusions: [],
    sources: [],
    checkedAt: CHECKED,
    confidence: "low",
    note: "Convenție internă. Fără sursă oficială verificată.",
  },
  generic: {
    top: 0.05,
    right: 0.05,
    bottom: 0.05,
    left: 0.05,
    exclusions: [],
    sources: [],
    checkedAt: CHECKED,
    confidence: "low",
    note: "Margine generică 5%.",
  },
};

export interface ResolvedSafeZone {
  top: number;
  right: number;
  bottom: number;
  left: number;
  /** dreptunghiul sigur, în pixeli */
  rect: Rect;
  exclusions: Array<Rect & { label: string }>;
}

/** Zona de siguranță în pixeli pentru un format. Pe formate orizontale, overlay-urile verticale nu se aplică. */
export function resolveSafeZone(f: Pick<FormatSpec, "width" | "height" | "platform">): ResolvedSafeZone {
  const vertical = orientationOf(f.width, f.height) === "portrait";
  const spec = vertical ? SAFE_ZONES[f.platform] : SAFE_ZONES[f.platform === "youtube" ? "youtube" : "generic"];
  const top = Math.round(spec.top * f.height);
  const bottom = Math.round(spec.bottom * f.height);
  const left = Math.round(spec.left * f.width);
  const right = Math.round(spec.right * f.width);
  return {
    top,
    right,
    bottom,
    left,
    rect: { x: left, y: top, w: f.width - left - right, h: f.height - top - bottom },
    exclusions: spec.exclusions.map((e) => ({
      x: Math.round(e.x * f.width),
      y: Math.round(e.y * f.height),
      w: Math.round(e.w * f.width),
      h: Math.round(e.h * f.height),
      label: e.label,
    })),
  };
}

export function rectInside(inner: Rect, outer: Rect, tolerance = 0.5): boolean {
  return (
    inner.x >= outer.x - tolerance &&
    inner.y >= outer.y - tolerance &&
    inner.x + inner.w <= outer.x + outer.w + tolerance &&
    inner.y + inner.h <= outer.y + outer.h + tolerance
  );
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
