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
    if (comp === "center")
      return {
        full,
        media: r(s.x, s.y + s.h * 0.5, s.w, s.h * 0.5),
        text: r(s.x, s.y + s.h * 0.2, s.w, s.h * 0.28),
        sub: r(s.x, s.y + s.h * 0.5, s.w, s.h * 0.12),
      };
    return {
      full,
      text: r(s.x, s.y, s.w, s.h * 0.2),
      sub: r(s.x, s.y + s.h * 0.2, s.w, s.h * 0.08),
      media: r(s.x * 0.5, s.y + s.h * 0.29, ctx.W - s.x, s.h * 0.71 + ctx.safe.bottom * 0.25),
    };
  }
  if (ctx.orientation === "square") {
    if (comp === "full-bleed") return { full, media: full, text: r(s.x, s.y + s.h * 0.66, s.w, s.h * 0.22), sub: r(s.x, s.y + s.h * 0.88, s.w, s.h * 0.1) };
    return { full, text: r(s.x, s.y, s.w, s.h * 0.24), sub: r(s.x, s.y + s.h * 0.24, s.w, s.h * 0.08), media: r(s.x, s.y + s.h * 0.34, s.w, s.h * 0.66) };
  }
  // orizontal
  const left = comp !== "thirds-right";
  if (comp === "full-bleed")
    return { full, media: full, text: r(s.x, s.y + s.h * 0.6, s.w * 0.7, s.h * 0.26), sub: r(s.x, s.y + s.h * 0.86, s.w * 0.7, s.h * 0.12) };
  if (comp === "center" || comp === "stacked")
    return {
      full,
      text: r(s.x + s.w * 0.1, s.y + s.h * 0.08, s.w * 0.8, s.h * 0.22),
      sub: r(s.x + s.w * 0.15, s.y + s.h * 0.3, s.w * 0.7, s.h * 0.08),
      media: r(s.x + s.w * 0.12, s.y + s.h * 0.4, s.w * 0.76, s.h * 0.6),
    };
  const textW = s.w * 0.4;
  const mediaW = s.w * 0.56;
  return left
    ? {
        full,
        text: r(s.x, s.y + s.h * 0.2, textW, s.h * 0.38),
        sub: r(s.x, s.y + s.h * 0.6, textW, s.h * 0.18),
        media: r(s.x + s.w - mediaW, s.y + s.h * 0.06, mediaW + s.x * 0.5, s.h * 0.88),
      }
    : {
        full,
        text: r(s.x + s.w - textW, s.y + s.h * 0.2, textW, s.h * 0.38),
        sub: r(s.x + s.w - textW, s.y + s.h * 0.6, textW, s.h * 0.18),
        media: r(s.x - s.x * 0.5, s.y + s.h * 0.06, mediaW + s.x * 0.5, s.h * 0.88),
      };
}

function collectAssets(v: unknown, out: Set<string>): void {
  if (typeof v === "string" && /^(projects|library)\//.test(v)) out.add(v);
  else if (Array.isArray(v))
    v.forEach((x) => {
      collectAssets(x, out);
    });
  else if (v && typeof v === "object")
    Object.values(v).forEach((x) => {
      collectAssets(x, out);
    });
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

export type CalloutSide = "top" | "bottom" | "left" | "right";

/**
 * Mută centrul camerei (punctul din scenă pus în mijlocul cadrului) cât e nevoie ca materialul, mărit cu `zoom`,
 * să nu intre peste textul fix: textul din stânga/dreapta limitează orizontal, cel de sus/jos vertical.
 */
export function clearOfText(c: { x: number; y: number }, zoom: number, material: Rect, text: Rect[], W: number, H: number, tol = 24): { x: number; y: number } {
  let { x, y } = c;
  for (const t of text) {
    if (t.x + t.w <= material.x + tol) x = Math.min(x, material.x + (W / 2 - (t.x + t.w) + tol) / zoom);
    else if (t.x >= material.x + material.w - tol) x = Math.max(x, material.x + material.w - (t.x + tol - W / 2) / zoom);
    else if (t.y + t.h <= material.y + tol) y = Math.min(y, material.y + (H / 2 - (t.y + t.h) + tol) / zoom);
    else if (t.y >= material.y + material.h - tol) y = Math.max(y, material.y + material.h - (t.y + tol - H / 2) / zoom);
  }
  return { x, y };
}

/** Unde ajunge pe ecran un dreptunghi din scenă la finalul unui push: punctul de interes ajunge în țintă, totul mărit cu `zoom`. */
export function afterPush(rect: Rect, focus: { x: number; y: number }, target: { x: number; y: number }, zoom: number): Rect {
  return { x: target.x + (rect.x - focus.x) * zoom, y: target.y + (rect.y - focus.y) * zoom, w: rect.w * zoom, h: rect.h * zoom };
}

export function intersect(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const w = Math.min(a.x + a.w, b.x + b.w) - x;
  const h = Math.min(a.y + a.h, b.y + b.h) - y;
  return w > 0 && h > 0 ? { x, y, w, h } : null;
}

/** Ecranul vizibil al unui media.screen (fără ramă), în pixeli de compoziție, înainte de mișcarea camerei. */
export function screenRectInScene(params: Record<string, unknown>, box: Rect): Rect {
  const s = screenMapping(params as unknown as Parameters<typeof screenMapping>[0], box).geo.screen;
  return { x: box.x + s.x, y: box.y + s.y, w: s.w, h: s.h };
}

/**
 * Cel mai mare zoom (până la `max`) la care materialul mărit nu intră peste textul fix (titlu, subtitlu),
 * cu o toleranță mică. Fără soluție: zoom 1 (camera doar se apropie de țintă).
 */
export function limitZoomForText(
  material: Rect,
  focus: { x: number; y: number },
  target: { x: number; y: number },
  max: number,
  text: Rect[],
  tol = 24,
): number {
  const clash = (z: number) => {
    const m = afterPush(material, focus, target, z);
    return text.some((t) => m.x < t.x + t.w - tol && m.x + m.w > t.x + tol && m.y < t.y + t.h - tol && m.y + m.h > t.y + tol);
  };
  for (let z = max; z > 1; z -= 0.02) if (!clash(z)) return Math.round(z * 1000) / 1000;
  return 1;
}

/**
 * Unde poate sta materialul vizual fără să atingă titlul, subtitrările sau zonele excluse ale platformei:
 * zona media intersectată cu zona sigură, fără banda subtitrărilor.
 */
export function mediaBounds(ctx: RecipeContext, z: Zones): Rect {
  const s = ctx.safe.rect;
  const band = ctx.captions ? (ctx.orientation === "portrait" ? ctx.H * 0.085 : ctx.H * 0.12) : 0;
  const x0 = Math.max(s.x, z.media.x);
  const y0 = Math.max(s.y, z.media.y);
  const y1 = Math.min(s.y + s.h - band, z.media.y + z.media.h);
  let x1 = Math.min(s.x + s.w, z.media.x + z.media.w);
  for (const ex of ctx.safe.exclusions) if (ex.y < y1 && ex.y + ex.h > y0 && ex.x + ex.w >= ctx.W - 1) x1 = Math.min(x1, ex.x - 8);
  return r(x0, y0, Math.max(40, x1 - x0), Math.max(40, y1 - y0));
}

/**
 * Partea pe care încape un callout lângă o zonă, judecată pe ecran la finalul mișcării camerei:
 * `onScreen` = dreptunghiul zonei în pixeli de compoziție, `scale` = zoom-ul camerei atunci.
 * Prima parte din `prefer` care încape (pe lungime și pe lățime); altfel cea cu cel mai mult loc.
 */
export function calloutSide(
  onScreen: Rect,
  scale: number,
  label: string,
  o: { distance: number; size: number; bounds: Rect; prefer?: CalloutSide[] },
): CalloutSide {
  const prefer = o.prefer ?? ["right", "left", "top", "bottom"];
  const lw = (label.length * 0.56 + 1.2) * o.size * scale;
  const lh = 1.75 * o.size * scale;
  const d = o.distance * scale;
  const b = o.bounds;
  const cx = onScreen.x + onScreen.w / 2;
  const cy = onScreen.y + onScreen.h / 2;
  const room: Record<CalloutSide, number> = {
    left: onScreen.x - b.x,
    right: b.x + b.w - (onScreen.x + onScreen.w),
    top: onScreen.y - b.y,
    bottom: b.y + b.h - (onScreen.y + onScreen.h),
  };
  const need: Record<CalloutSide, number> = { left: d + lw, right: d + lw, top: d + lh, bottom: d + lh };
  const across: Record<CalloutSide, boolean> = {
    top: cx - lw / 2 >= b.x && cx + lw / 2 <= b.x + b.w,
    bottom: cx - lw / 2 >= b.x && cx + lw / 2 <= b.x + b.w,
    left: cy - lh / 2 >= b.y && cy + lh / 2 <= b.y + b.h,
    right: cy - lh / 2 >= b.y && cy + lh / 2 <= b.y + b.h,
  };
  const fit = prefer.find((s) => room[s] >= need[s] && across[s]);
  if (fit) return fit;
  // nimic nu încape complet: o etichetă tăiată pe lățime e mai rea decât una puțin prea aproape de margine
  const score = (s: CalloutSide) => Math.min(1.5, room[s] / need[s]) * (across[s] ? 1 : 0.3);
  return prefer.reduce((best, s) => (score(s) > score(best) ? s : best), prefer[0]);
}

export function layer(ctx: RecipeContext, capability: string, box: Rect, params: Record<string, unknown>, o: LayerOpts = {}): TimelineLayer {
  if (capability.startsWith("text.") && (o.depth ?? 1) === 0) box = avoidExclusions(ctx, box);
  const assets = new Set<string>();
  collectAssets(params, assets);
  for (const c of o.children ?? [])
    c.assets.forEach((a) => {
      assets.add(a);
    });
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
  if (!ctx.forbidden.includes(bg.capability))
    out.push(
      layer(
        ctx,
        bg.capability,
        { x: -ctx.W * 0.1, y: -ctx.H * 0.1, w: ctx.W * 1.2, h: ctx.H * 1.2 },
        { ...bg.params },
        { z: 0, depth: 0.5, role: "background" },
      ),
    );
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

/**
 * Pe o captură mai înaltă decât ecranul (pagină întreagă), fără decupaj, ecranul arată implicit partea de sus.
 * Dacă zona țintită e mai jos, întoarce o derulare fixă care o aduce în mijlocul ecranului; altfel {}.
 */
export function revealRegion(
  params: Record<string, unknown>,
  region: Region | null | undefined,
  box: Rect,
): { scroll?: { from: number; to: number; start: number; end: number; ease: "linear" } } {
  if (!region || params.crop || params.scroll) return {};
  const p = params as unknown as Parameters<typeof screenMapping>[0];
  const m = screenMapping(p, box);
  const visibleH = m.geo.screen.h / m.k;
  if (visibleH >= p.imageHeight) return {};
  const top = region.rect.y;
  const bottom = region.rect.y + region.rect.h;
  if (top >= visibleH * 0.08 && bottom <= visibleH * 0.85) return {};
  const oy = Math.max(0, Math.min(p.imageHeight - visibleH, region.rect.y + region.rect.h / 2 - visibleH / 2));
  return { scroll: { from: oy, to: oy, start: 0, end: 1, ease: "linear" } };
}

/** Centrul unei zone din captură, în pixeli de compoziție, plus zoom-ul care o încadrează. */
export function regionFocus(
  ctx: RecipeContext,
  screenBox: Rect,
  params: Record<string, unknown>,
  region: Region,
  fill = 0.42,
): { x: number; y: number; zoom: number; target: { x: number; y: number } } {
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

/**
 * Partea folosită a unui container (o coloană, o listă, un panou): de la marginea lui de sus până sub ultimul
 * element capturat din el și sub dreptunghiurile `include` (de ex. locul unde ajunge un card), plus o margine.
 * O coloană înaltă, goală în partea de jos, nu e toată „zona demonstrată”: camera, decupajul, conturul și
 * subtitrările se raportează la partea cu conținut. Fără elemente în interior, containerul rămâne întreg.
 */
export function usedPart(regions: Region[], box: Region, include: Rect[] = [], pad = 24): Region {
  const r0 = box.rect;
  const within = (q: Rect) => q.x >= r0.x - 1 && q.y >= r0.y - 1 && q.x + q.w <= r0.x + r0.w + 1 && q.y + q.h <= r0.y + r0.h + 1;
  const inner = regions.filter((r) => r.id !== box.id && within(r.rect)).map((r) => r.rect);
  if (!inner.length) return box;
  const bottom = Math.max(...[...inner, ...include].map((q) => q.y + q.h));
  return { ...box, rect: { ...r0, h: Math.min(r0.h, bottom - r0.y + pad) } };
}

/** Zona din captură care se potrivește cel mai bine cu un text (cuvinte comune, ignorând diacriticele). */
export function bestRegion(regions: Region[], text: string, kinds: Region["kind"][] = ["input", "button", "custom", "heading"]): Region | null {
  const words = new Set(
    norm(text)
      .split(/\s+/)
      .filter((w) => w.length > 3),
  );
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
 * Decupajul unei capturi de desktop în jurul zonei demonstrate, cu raportul zonei din cadru, ca interfața să fie
 * mare și lizibilă. Pe vertical, captura orizontală devine un card înalt în jurul zonei de interes. Pe orizontal
 * și pătrat, o captură întreagă lasă textul interfeței la ~4 px la testul de 360 px: decupajul se face doar când
 * scena demonstrează o zonă pe care camera nu o poate apropia destul (de regulă: titlul de lângă captură limitează
 * push-ul) și o mărește până la ~7 px, cu zona întreagă (plus margine) în cadru și cel puțin 40% din lățimea
 * paginii, ca să rămână contextul. Pixelii rămân cei reali: se alege doar ce parte se vede.
 */
export function focusCrop(ctx: RecipeContext, a: ResolvedAsset, zone: Rect, region: Region | null, camZoom = 1): Rect | undefined {
  const aspect = zone.w / zone.h;
  const desktop = (a.asset.capture?.viewport.width ?? 0) >= 900 || a.w / a.h >= 1.1;
  if (ctx.orientation === "portrait") {
    // captura lată se decupează mereu; cea de pagină întreagă (înaltă) doar în jurul unei zone demonstrate
    if (a.w / a.h < 1.1 && !(desktop && region)) return undefined;
    let w = Math.min(a.w, Math.max(a.w * 0.36, (region?.rect.w ?? a.w * 0.3) * 1.5));
    let h = w / aspect;
    if (h > a.h) {
      h = a.h;
      w = h * aspect;
    }
    return placeCrop(a, region, w, h, 0.42);
  }
  if (!region || !desktop) return undefined;
  const dpr = a.asset.capture?.deviceScaleFactor ?? 1;
  // dacă push-ul camerei (`camZoom`, cel atins fără decupaj) duce deja textul peste pragul verificării ui.legibility
  // (5 px la 360), captura rămâne întreagă: camera arată zona cu tot contextul, fără margini tăiate
  if ((15 * dpr * (zone.w / a.w) * camZoom * 360) / Math.min(ctx.W, ctx.H) >= 5) return undefined;
  // lățimea vizibilă la care textul tipic al interfeței (15 px CSS) ajunge la ~7 px la testul de 360 px
  const legibleW = (zone.w * 15 * dpr * 360) / (7 * Math.min(ctx.W, ctx.H));
  // zona demonstrată încape întreagă, cu margine, pe ambele axe
  const fitW = Math.max(region.rect.w * 1.3, region.rect.h * 1.25 * aspect);
  let w = Math.min(a.w, Math.max(legibleW, fitW, a.w * 0.4));
  // un decupaj de peste 92% din lățime nu schimbă lizibilitatea, doar taie marginile
  if (w >= a.w * 0.92) return undefined;
  let h = w / aspect;
  if (h > a.h) {
    h = a.h;
    w = h * aspect;
  }
  return clearCutEdges(placeCrop(a, region, w, h, 0.45), a, region);
}

/**
 * Marginile verticale ale unui decupaj nu trec prin textul capturat (titluri, butoane, câmpuri, carduri): fiecare
 * margine care taie o astfel de regiune se mută ca s-o includă sau s-o lase afară, cu deplasarea cea mai mică
 * la care zona demonstrată rămâne întreagă în cadru. Containerele late (peste 40% din decupaj) se pot tăia.
 * Dacă nicio poziție nu le ocolește pe toate, decupajul rămâne centrat pe zonă.
 */
function clearCutEdges(c: Rect, a: ResolvedAsset, focus: Region): Rect {
  const m = 12;
  const f = focus.rect;
  // textul propriu-zis (titluri, butoane, câmpuri, linkuri) contează la orice lățime; cardurile și panourile, doar
  // cele înguste (cele late sunt containere, iar marginea trece oricum prin ele)
  const textual = (r: Region) =>
    ["heading", "button", "input", "link", "text"].includes(r.kind) || (r.kind !== "image" && r.kind !== "pii" && r.rect.w < c.w * 0.4);
  const text = a.regions.filter((r) => r.id !== focus.id && textual(r) && r.rect.y < c.y + c.h && r.rect.y + r.rect.h > c.y);
  const ok = (x: number) => x >= 0 && x + c.w <= a.w && f.x >= x + m && f.x + f.w <= x + c.w - m;
  const cuts = (x: number) => text.filter((r) => (r.rect.x < x && r.rect.x + r.rect.w > x) || (r.rect.x < x + c.w && r.rect.x + r.rect.w > x + c.w));
  let x = c.x;
  for (let pass = 0; pass < 3 && cuts(x).length; pass++) {
    const options = cuts(x).flatMap((r) => [
      r.rect.x - m, // marginea stângă înainte de regiune
      r.rect.x + r.rect.w + m, // marginea stângă după regiune
      r.rect.x - m - c.w, // marginea dreaptă înainte de regiune
      r.rect.x + r.rect.w + m - c.w, // marginea dreaptă după regiune
    ]);
    const best = options.filter(ok).sort((p, q) => Math.abs(p - c.x) - Math.abs(q - c.x))[0];
    if (best === undefined) break;
    x = best;
  }
  return { ...c, x };
}

/** Așază fereastra de decupaj centrată pe zonă (sus/jos după `bias`), fără să iasă din captură. */
function placeCrop(a: ResolvedAsset, region: Region | null, w: number, h: number, bias: number): Rect {
  const cx = region ? region.rect.x + region.rect.w / 2 : a.focal.x * a.w;
  const cy = region ? region.rect.y + region.rect.h / 2 : a.focal.y * a.h;
  const x = Math.min(Math.max(0, cx - w / 2), a.w - w);
  const y = Math.min(Math.max(0, cy - h * bias), a.h - h);
  return { x, y, w, h };
}

/** O casetă puțin mai mare decât zona, în pixelii capturii. */
/**
 * Raza colțurilor unui card în video, după forma brandului: raza CSS a site-ului (capturată 2×) scalată la
 * format; fără brand: 36 px la 1080. k < 1 pentru elemente mai mici.
 */
export function cardRadius(ctx: RecipeContext, k = 1): number {
  const scale = Math.min(ctx.W, ctx.H) / 1080;
  const r = ctx.shape ? ctx.shape.radius * 2.2 * scale : 36 * scale;
  return Math.round(Math.max(0, Math.min(72 * scale, r * k)));
}

/** Raza butonului: pastilă dacă brandul are colțuri mari, altfel raza brandului. */
export function buttonRadius(ctx: RecipeContext, h: number): number {
  if (!ctx.shape) return h / 2;
  return Math.min(h / 2, Math.round(ctx.shape.radius * 2.2 * (Math.min(ctx.W, ctx.H) / 1080)));
}

export function padRect(rect: Rect, pad: number): Rect {
  return { x: rect.x - pad, y: rect.y - pad, w: rect.w + pad * 2, h: rect.h + pad * 2 };
}
