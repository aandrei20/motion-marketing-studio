/**
 * Unelte comune pentru rețete: zone de layout pe format, constructori de straturi, ecrane cu
 * zone din captură, fundalul și texturile direcției.
 */
import type { CompositionKind, Rect, Region, TimelineLayer } from "../core/schema";
import { screenMapping, screenPointToBox } from "../motion/media/media";
import type { RecipeContext, ResolvedAsset } from "./types";

export interface Zones {
  /** zona mesajului principal */
  text: Rect;
  /** zona secundară (sub mesaj) */
  sub: Rect;
  /** zona materialului vizual (ecran, imagine) */
  media: Rect;
  /** tot cadrul */
  full: Rect;
}

const r = (x: number, y: number, w: number, h: number): Rect => ({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });

/** Zonele de așezare în zona de siguranță, pe orientare și compoziție. */
export function zones(ctx: RecipeContext, comp: CompositionKind = ctx.scene.composition): Zones {
  const z = zonesRaw(ctx, comp);
  if (!ctx.captions || comp === "full-bleed") return z;
  // banda subtitrărilor (jos în zona sigură) rămâne liberă
  const band = ctx.orientation === "portrait" ? ctx.H * 0.085 : ctx.H * 0.12;
  const limit = ctx.safe.rect.y + ctx.safe.rect.h - band;
  const clip = (r: Rect): Rect => (r.y + r.h > limit ? { ...r, h: Math.max(40, limit - r.y) } : r);
  // pe vertical, materialul vizual poate continua sub subtitrări (ele au contur și umbră); textul nu
  return { ...z, media: ctx.orientation === "portrait" ? z.media : clip(z.media), text: clip(z.text), sub: clip(z.sub) };
}

function zonesRaw(ctx: RecipeContext, comp: CompositionKind): Zones {
  const s = ctx.safe.rect;
  const full = r(0, 0, ctx.W, ctx.H);
  if (ctx.orientation === "portrait") {
    if (comp === "full-bleed") return { full, media: full, text: r(s.x, s.y + s.h * 0.62, s.w, s.h * 0.24), sub: r(s.x, s.y + s.h * 0.86, s.w, s.h * 0.12) };
    if (comp === "center") return { full, media: r(s.x, s.y + s.h * 0.5, s.w, s.h * 0.5), text: r(s.x, s.y + s.h * 0.2, s.w, s.h * 0.28), sub: r(s.x, s.y + s.h * 0.5, s.w, s.h * 0.12) };
    return { full, text: r(s.x, s.y, s.w, s.h * 0.2), sub: r(s.x, s.y + s.h * 0.2, s.w, s.h * 0.08), media: r(s.x * 0.5, s.y + s.h * 0.29, ctx.W - s.x, s.h * 0.71 + ctx.safe.bottom * 0.25) };
  }
  if (ctx.orientation === "square") {
    if (comp === "full-bleed") return { full, media: full, text: r(s.x, s.y + s.h * 0.66, s.w, s.h * 0.22), sub: r(s.x, s.y + s.h * 0.88, s.w, s.h * 0.1) };
    return { full, text: r(s.x, s.y, s.w, s.h * 0.24), sub: r(s.x, s.y + s.h * 0.24, s.w, s.h * 0.08), media: r(s.x, s.y + s.h * 0.34, s.w, s.h * 0.66) };
  }
  // orizontal
  const left = comp !== "thirds-right";
  if (comp === "full-bleed") return { full, media: full, text: r(s.x, s.y + s.h * 0.6, s.w * 0.7, s.h * 0.26), sub: r(s.x, s.y + s.h * 0.86, s.w * 0.7, s.h * 0.12) };
  if (comp === "center" || comp === "stacked") return { full, text: r(s.x + s.w * 0.1, s.y + s.h * 0.08, s.w * 0.8, s.h * 0.22), sub: r(s.x + s.w * 0.15, s.y + s.h * 0.3, s.w * 0.7, s.h * 0.08), media: r(s.x + s.w * 0.12, s.y + s.h * 0.4, s.w * 0.76, s.h * 0.6) };
  const textW = s.w * 0.4;
  const mediaW = s.w * 0.56;
  return left
    ? { full, text: r(s.x, s.y + s.h * 0.2, textW, s.h * 0.38), sub: r(s.x, s.y + s.h * 0.6, textW, s.h * 0.18), media: r(s.x + s.w - mediaW, s.y + s.h * 0.06, mediaW + s.x * 0.5, s.h * 0.88) }
    : { full, text: r(s.x + s.w - textW, s.y + s.h * 0.2, textW, s.h * 0.38), sub: r(s.x + s.w - textW, s.y + s.h * 0.6, textW, s.h * 0.18), media: r(s.x - s.x * 0.5, s.y + s.h * 0.06, mediaW + s.x * 0.5, s.h * 0.88) };
}

function collectAssets(v: unknown, out: Set<string>): void {
  if (typeof v === "string" && /^(projects|library)\//.test(v)) out.add(v);
  else if (Array.isArray(v)) v.forEach((x) => collectAssets(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => collectAssets(x, out));
}

export interface LayerOpts {
  from?: number;
  duration?: number;
  z?: number;
  depth?: number;
  role?: TimelineLayer["role"];
  modifiers?: TimelineLayer["modifiers"];
  children?: TimelineLayer[];
}

/**
 * Textul fixat pe ecran (adâncime 0) nu are voie să intre sub butoanele platformei (de ex. coloana din
 * dreapta pe TikTok): cutia se îngustează până la marginea zonei excluse.
 */
export function avoidExclusions(ctx: RecipeContext, box: Rect): Rect {
  let b = { ...box };
  for (const ex of ctx.safe.exclusions) {
    const overlapY = b.y < ex.y + ex.h && b.y + b.h > ex.y;
    const overlapX = b.x < ex.x + ex.w && b.x + b.w > ex.x;
    if (!overlapY || !overlapX) continue;
    if (ex.x + ex.w >= ctx.W - 1) b = { ...b, w: Math.max(40, ex.x - b.x - 8) };
    else if (ex.x <= 1) b = { ...b, x: ex.x + ex.w + 8, w: Math.max(40, b.x + b.w - (ex.x + ex.w + 8)) };
  }
  return b;
}

export function layer(ctx: RecipeContext, capability: string, box: Rect, params: Record<string, unknown>, o: LayerOpts = {}): TimelineLayer {
  if (capability.startsWith("text.") && (o.depth ?? 1) === 0) box = avoidExclusions(ctx, box);
  const assets = new Set<string>();
  collectAssets(params, assets);
  for (const c of o.children ?? []) c.assets.forEach((a) => assets.add(a));
  const from = Math.max(0, o.from ?? 0);
  return {
    id: ctx.uid(capability.replace(/\./g, "-")),
    capability,
    from,
    durationInFrames: Math.max(1, o.duration ?? ctx.duration - from),
    z: o.z ?? 10,
    box,
    params,
    depth: o.depth ?? 1,
    role: o.role ?? "support",
    modifiers: o.modifiers ?? [],
    assets: [...assets],
    children: o.children ?? [],
  };
}

/** Fundalul și texturile direcției (fundal cu parallax ușor, texturi fixate pe ecran). */
export function directionBase(ctx: RecipeContext): TimelineLayer[] {
  const out: TimelineLayer[] = [];
  const bg = ctx.dir.background;
  if (!ctx.forbidden.includes(bg.capability)) out.push(layer(ctx, bg.capability, { x: -ctx.W * 0.1, y: -ctx.H * 0.1, w: ctx.W * 1.2, h: ctx.H * 1.2 }, { ...bg.params }, { z: 0, depth: 0.5, role: "background" }));
  const level = ctx.effectsLevel;
  for (const ov of ctx.dir.overlays) {
    if (ctx.forbidden.includes(ov.capability)) continue;
    if (level === "subtle" && !["fx.grain", "fx.vignette"].includes(ov.capability)) continue;
    out.push(layer(ctx, ov.capability, { x: 0, y: 0, w: ctx.W, h: ctx.H }, { ...ov.params }, { z: 90, depth: 0, role: "overlay" }));
  }
  return out;
}

export function textParams(ctx: RecipeContext, text: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { text, emphasis: ctx.text.emphasis, ...extra };
}

/** Rama potrivită unei capturi: telefon pentru capturi mobile, browser pentru site-uri, fără ramă altfel. */
export function frameFor(a: ResolvedAsset): "browser" | "phone" | "none" {
  const vp = a.asset.capture?.viewport;
  if (vp && vp.width < 600) return "phone";
  if (a.asset.capture) return "browser";
  return a.w / a.h < 0.7 ? "phone" : "none";
}

export function screenParams(a: ResolvedAsset, extra: Record<string, unknown> = {}, fps = 30): Record<string, unknown> {
  const vp = a.asset.capture?.viewport;
  const host = a.asset.capture?.url && /^https?:/.test(a.asset.capture.url) ? new URL(a.asset.capture.url).host : undefined;
  return {
    src: a.src,
    kind: a.kind === "video" ? "video" : "image",
    imageWidth: a.w,
    imageHeight: a.h,
    frame: frameFor(a),
    url: host,
    viewportAspect: vp ? vp.width / vp.height : undefined,
    videoFrames: a.kind === "video" && a.asset.media.durationSec ? Math.floor(a.asset.media.durationSec * fps) : undefined,
    ...extra,
  };
}

/** Centrul unei zone din captură, în pixeli de compoziție, plus zoom-ul care o încadrează. */
export function regionFocus(ctx: RecipeContext, screenBox: Rect, params: Record<string, unknown>, region: Region, fill = 0.42): { x: number; y: number; zoom: number; target: { x: number; y: number } } {
  const p = params as unknown as Parameters<typeof screenMapping>[0];
  const c = screenPointToBox(p, screenBox, { x: region.rect.x + region.rect.w / 2, y: region.rect.y + region.rect.h / 2 });
  const regionW = region.rect.w * c.k;
  const zoom = Math.min(2.6, Math.max(1.15, (ctx.W * fill) / Math.max(1, regionW)));
  return { x: screenBox.x + c.x, y: screenBox.y + c.y, zoom, target: { x: screenBox.x + screenBox.w / 2, y: screenBox.y + screenBox.h / 2 } };
}

export const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ");

/** Zona din captură care se potrivește cel mai bine cu un text (cuvinte comune, ignorând diacriticele). */
export function bestRegion(regions: Region[], text: string, kinds: Region["kind"][] = ["input", "button", "custom", "heading"]): Region | null {
  const words = new Set(norm(text).split(/\s+/).filter((w) => w.length > 3));
  let best: { r: Region; s: number } | null = null;
  for (const r of regions) {
    if (!kinds.includes(r.kind)) continue;
    const label = norm(`${r.label} ${r.text ?? ""}`);
    let s = 0;
    for (const w of words) if (label.includes(w.slice(0, Math.max(4, w.length - 2)))) s += 1;
    if (r.kind === "input") s += 0.3;
    if (r.kind === "custom") s += 0.1;
    if (!best || s > best.s) best = { r, s };
  }
  return best && best.s > 0.2 ? best.r : (regions.find((r) => kinds.includes(r.kind)) ?? null);
}

/**
 * Adaptor de layout pentru vertical: o captură de desktop (orizontală) într-o zonă înaltă devine un
 * card decupat în jurul zonei de interes, cu raportul zonei, ca interfața să fie mare și lizibilă.
 */
export function portraitCrop(ctx: RecipeContext, a: ResolvedAsset, zone: Rect, region: Region | null): Rect | undefined {
  if (ctx.orientation !== "portrait" || a.w / a.h < 1.1) return undefined;
  const aspect = zone.w / zone.h;
  let w = Math.min(a.w, Math.max(a.w * 0.36, (region?.rect.w ?? a.w * 0.3) * 1.5));
  let h = w / aspect;
  if (h > a.h) {
    h = a.h;
    w = h * aspect;
  }
  const cx = region ? region.rect.x + region.rect.w / 2 : a.focal.x * a.w;
  const cy = region ? region.rect.y + region.rect.h / 2 : a.focal.y * a.h;
  const x = Math.min(Math.max(0, cx - w / 2), a.w - w);
  const y = Math.min(Math.max(0, cy - h * 0.42), a.h - h);
  return { x, y, w, h };
}

/** O casetă puțin mai mare decât zona, în pixelii capturii. */
export function padRect(rect: Rect, pad: number): Rect {
  return { x: rect.x - pad, y: rect.y - pad, w: rect.w + pad * 2, h: rect.h + pad * 2 };
}
