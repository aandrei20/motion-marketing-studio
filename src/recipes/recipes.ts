import { z } from "zod";
import { readableOn } from "../motion/core/color";
import { readingSec } from "../editing/grammar";
import type { Rect, TimelineLayer } from "../core/schema";
import { bestRegion, directionBase, frameFor, layer, norm, padRect, portraitCrop, regionFocus, screenParams, textParams, zones } from "./kit";
import { defineRecipe, type RecipeContext, type RecipeCue, type RecipeOutput } from "./types";

const cam = (capability: string, params: Record<string, unknown> = {}) => ({ capability, params });
const pick = (ctx: RecipeContext, id: string, fallback: string) => (ctx.forbidden.includes(id) ? fallback : id);

function headline(ctx: RecipeContext, box: Rect, opts: { capability?: string; from?: number; maxSize?: number; align?: "left" | "center" | "right"; exit?: "snap" | "none"; uppercase?: boolean; text?: string } = {}): TimelineLayer | null {
  const t = opts.text ?? ctx.text.headline;
  if (!t) return null;
  const capability = pick(ctx, opts.capability ?? ctx.dir.text.headline, "text.word-reveal");
  const short = t.split(/\s+/).length <= 3;
  return layer(ctx, capability, box, textParams(ctx, t, { maxSize: opts.maxSize ?? (ctx.orientation === "portrait" ? (short ? 170 : 130) : short ? 150 : 116), minSize: 34, align: opts.align ?? "left", exit: opts.exit ?? "snap", uppercase: opts.uppercase }), { from: opts.from ?? 0, z: 50, depth: 0, role: "hero" });
}

function subline(ctx: RecipeContext, box: Rect, from: number, text = ctx.text.sub, align: "left" | "center" | "right" = "left"): TimelineLayer | null {
  if (!text) return null;
  return layer(ctx, "text.body", box, { text, emphasis: [], maxSize: ctx.orientation === "portrait" ? 52 : 46, minSize: 30, color: "textMuted", align, delay: 0 }, { from, z: 49, depth: 0, role: "support" });
}

/** Împarte durata scenei între elemente proporțional cu timpul lor de citire (cadre de start). */
function readingSegments(ctx: RecipeContext, items: string[]): number[] {
  const w = items.map((t) => readingSec(t) + 0.25);
  const total = w.reduce((a, b) => a + b, 0) || 1;
  const starts: number[] = [];
  let acc = 0;
  for (const x of w) {
    starts.push(Math.round((acc / total) * ctx.duration));
    acc += x;
  }
  return starts;
}

function beatHits(ctx: RecipeContext): number[] {
  return ctx.beats.length ? ctx.beats : Array.from({ length: Math.floor(ctx.duration / 15) }, (_, i) => i * 15);
}

// ─── hook-uri și text ───────────────────────────────────────────────────────

export const hookKinetic = defineRecipe({
  id: "hook-kinetic",
  title: "Hook cu tipografie cinetică",
  description: "Fraza de hook pe tot ecranul, cu stilul de text al direcției (slam, pop, blur), camera pe ritm și, opțional, captura reală estompată în fundal.",
  tags: ["hook", "kinetic", "typography", "aggressive", "social", "scroll-stop"],
  roles: ["hook", "agitation", "benefit"],
  slots: [{ name: "screen", kind: "screen", required: false }],
  minSec: 1.2,
  capabilities: ["text.slam", "text.pop", "text.blur-reveal", "text.typewriter", "text.mask-reveal", "bg.image", "shape.ring-pulse", "camera.beat-punch", "camera.shake"],
  params: z.object({ backgroundScreen: z.boolean().default(true), ring: z.boolean().default(true) }),
  build: (ctx, p) => {
    const s = ctx.safe.rect;
    const layers = directionBase(ctx);
    const screen = ctx.slot("screen");
    if (screen && p.backgroundScreen && screen.kind !== "video") {
      layers.push(layer(ctx, "bg.image", { x: 0, y: 0, w: ctx.W, h: ctx.H }, { src: screen.src, blur: 22, dim: 0.5, scale: 1.18 }, { z: 2, depth: 0.7, role: "background" }));
      if (!ctx.forbidden.includes("fx.glow-orbs")) layers.push(layer(ctx, "fx.glow-orbs", { x: 0, y: 0, w: ctx.W, h: ctx.H }, { colors: ["primary", "accent"], intensity: 0.42, size: 0.8, speed: 0.8 }, { z: 3, depth: 0.5, role: "background" }));
    }
    const box: Rect = ctx.orientation === "landscape" ? { x: s.x, y: s.y + s.h * 0.14, w: s.w * 0.78, h: s.h * 0.6 } : { x: s.x, y: s.y + s.h * 0.16, w: s.w, h: s.h * 0.46 };
    const cap = pick(ctx, ctx.dir.text.hook, "text.word-reveal");
    layers.push(layer(ctx, cap, box, textParams(ctx, ctx.text.headline, { maxSize: ctx.orientation === "landscape" ? 170 : 150, minSize: 40, uppercase: ctx.dir.uppercaseHook, align: "left", exit: "snap" }), { z: 50, depth: 0, role: "hero" }));
    const sub = subline(ctx, { x: box.x, y: box.y + box.h + 10, w: box.w, h: s.h * 0.12 }, 10);
    if (sub) layers.push(sub);
    if (p.ring && cap === "text.slam" && !ctx.forbidden.includes("shape.ring-pulse")) layers.push(layer(ctx, "shape.ring-pulse", { x: box.x - 100, y: box.y - 100, w: box.w * 0.6, h: box.w * 0.6 }, { at: 3, rings: 2, color: "accent" }, { z: 40, depth: 0.4 }));
    const camera = ctx.energy >= 0.7 && ctx.dir.camera.active === "camera.shake" ? cam("camera.shake", { hits: [0.05], strength: "small" }) : cam("camera.beat-punch", { hits: beatHits(ctx), amount: 0.04 + 0.04 * ctx.energy });
    return { layers, camera };
  },
});

export const kineticSequence = defineRecipe({
  id: "kinetic-sequence",
  title: "Secvență de fraze pe ritm",
  description: "Mai multe fraze scurte, una după alta, pe bătăi. Bun pentru agitație („încă un tabel, încă o ședință…”) sau beneficii rapide.",
  tags: ["kinetic", "sequence", "rhythm", "montage", "words", "beat"],
  roles: ["agitation", "benefit", "hook", "problem"],
  slots: [],
  minSec: 1.5,
  minSecFor: (t) => (t.items.length ? t.items : [t.headline ?? ""]).reduce((s, x) => s + readingSec(x) + 0.25, 0),
  capabilities: ["text.pop", "text.slam", "text.word-reveal", "camera.beat-punch"],
  params: z.object({}),
  build: (ctx) => {
    const s = ctx.safe.rect;
    const layers = directionBase(ctx);
    const items = ctx.text.items.length ? ctx.text.items : [ctx.text.headline];
    const n = items.length;
    const starts = readingSegments(ctx, items);
    const cap = pick(ctx, ctx.dir.text.list, "text.word-reveal");
    const box: Rect = ctx.orientation === "landscape" ? { x: s.x, y: s.y + s.h * 0.2, w: s.w * 0.8, h: s.h * 0.5 } : { x: s.x, y: s.y + s.h * 0.2, w: s.w, h: s.h * 0.4 };
    const cues: RecipeCue[] = [];
    items.forEach((t, i) => {
      const from = starts[i];
      const to = starts[i + 1] ?? ctx.duration;
      layers.push(layer(ctx, cap, box, { text: t, emphasis: ctx.text.emphasis, maxSize: 160, minSize: 40, align: "left", exit: "snap", exitFrames: 3 }, { from, duration: to - from, z: 50, depth: 0, role: "hero" }));
      if (i > 0) cues.push({ at: from, sound: "swipe", gainDb: -8, reason: "schimbarea frazei" });
    });
    void n;
    return { layers, camera: cam("camera.beat-punch", { hits: starts, amount: 0.06 }), cues };
  },
});

export const problemStatement = defineRecipe({
  id: "problem-statement",
  title: "Problema, spusă clar",
  description: "Problema publicului în cuvintele lui, cu cuvântul-durere tăiat sau subliniat; atmosferă mai rece, vignetă.",
  tags: ["problem", "pain", "frustration", "strike", "before"],
  roles: ["problem", "agitation"],
  slots: [{ name: "before", kind: "image", required: false }],
  minSec: 1.8,
  capabilities: ["text.highlight", "text.body", "fx.vignette", "mod.color-grade", "media.image", "camera.push"],
  params: z.object({ mark: z.enum(["strike", "underline", "marker", "circle"]).default("strike") }),
  build: (ctx, p) => {
    const z0 = zones(ctx);
    const layers = directionBase(ctx);
    const before = ctx.slot("before");
    if (before) layers.push(layer(ctx, "media.image", z0.media, { src: before.src, fit: "cover", radius: 28 }, { z: 20, modifiers: [{ capability: "mod.color-grade", params: { preset: "mono" } }, { capability: "mod.enter", params: { style: "rise" } }] }));
    layers.push(layer(ctx, "fx.vignette", { x: 0, y: 0, w: ctx.W, h: ctx.H }, { strength: 0.6 }, { z: 80, depth: 0, role: "overlay" }));
    const box = before ? z0.text : ctx.orientation === "landscape" ? { ...z0.text, w: ctx.safe.rect.w * 0.8 } : { ...z0.text, h: z0.text.h * 1.6 };
    layers.push(layer(ctx, "text.highlight", box, textParams(ctx, ctx.text.headline, { style: p.mark, markAt: Math.round(ctx.fps * 0.7), markColor: "accent", maxSize: 120, minSize: 34 }), { z: 50, depth: 0, role: "hero" }));
    const sub = subline(ctx, before ? z0.sub : { x: box.x, y: box.y + box.h, w: box.w, h: z0.sub.h }, Math.round(ctx.fps * 0.5));
    if (sub) layers.push(sub);
    return { layers, camera: cam("camera.push", { from: 1, to: 1.06, ease: "linear" }) };
  },
});

// ─── revelarea produsului ───────────────────────────────────────────────────

export const productReveal = defineRecipe({
  id: "product-reveal",
  title: "Revelarea produsului (logo)",
  description: "Logo-ul apare din particule sau cu un pop, raze de lumină în spate, sloganul se dezvăluie sub el. Momentul „iată soluția”.",
  tags: ["reveal", "logo", "launch", "cinematic", "premium", "solution"],
  roles: ["reveal", "solution", "outro"],
  slots: [{ name: "logo", kind: "logo", required: false }],
  minSec: 2,
  capabilities: ["logo.particles", "logo.reveal", "logo.light-pass", "fx.god-rays", "fx.glow-orbs", "shape.ring-pulse", "text.mask-reveal", "text.big-word", "camera.pull"],
  params: z.object({ style: z.enum(["particles", "pop", "light-pass"]).default("pop") }),
  build: (ctx, p) => {
    const s = ctx.safe.rect;
    const layers = directionBase(ctx);
    const logo = ctx.slot("logo") ?? ctx.logo;
    const portrait = ctx.orientation === "portrait";
    const size = portrait ? Math.min(s.w * 0.38, s.h * 0.26) : Math.min(s.w * 0.5, s.h * 0.32);
    const cy = portrait ? s.y + s.h * 0.2 : s.y + s.h * 0.38;
    const logoBox: Rect = { x: ctx.W / 2 - size / 2, y: cy - size / 2, w: size, h: size };
    if (!ctx.forbidden.includes("fx.god-rays")) layers.push(layer(ctx, "fx.god-rays", { x: 0, y: 0, w: ctx.W, h: ctx.H }, { x: 0.5, y: cy / ctx.H, intensity: 0.16, color: "primary" }, { z: 5, depth: 0.6, role: "background" }));
    const arrive = Math.round(ctx.fps * 0.8);
    if (logo) {
      const cap = p.style === "particles" ? "logo.particles" : p.style === "light-pass" ? "logo.light-pass" : "logo.reveal";
      const params = cap === "logo.particles" ? { src: logo.src, arrive } : cap === "logo.light-pass" ? { src: logo.src, at: arrive } : { src: logo.src, mode: "pop", at: 4 };
      layers.push(layer(ctx, cap, logoBox, params, { z: 40, depth: 0.9, role: "hero", modifiers: [{ capability: "mod.glow", params: { color: "primary", radius: 40, intensity: 0.5 } }] }));
      if (!ctx.forbidden.includes("shape.ring-pulse")) layers.push(layer(ctx, "shape.ring-pulse", { x: ctx.W / 2 - size, y: cy - size, w: size * 2, h: size * 2 }, { at: cap === "logo.particles" ? arrive : 6, rings: 2, color: "accent" }, { z: 30, depth: 0.9 }));
    } else {
      layers.push(layer(ctx, "text.big-word", { x: s.x, y: cy - size / 2, w: s.w, h: size }, { text: ctx.productName, align: "center", uppercase: false, maxSize: 260, exit: "none" }, { z: 40, depth: 0.9, role: "hero" }));
    }
    const tagline = ctx.text.headline && ctx.text.headline !== ctx.productName ? ctx.text.headline : ctx.text.sub;
    if (tagline) {
      // sub logo, până la marginea de sus a zonelor excluse (butoanele platformei), ca textul centrat să rămână centrat
      const top = cy + size * 0.62;
      const exTop = Math.min(...ctx.safe.exclusions.map((e) => e.y), s.y + s.h);
      const captionTop = ctx.captions ? s.y + s.h - (portrait ? ctx.H * 0.085 : ctx.H * 0.12) : s.y + s.h;
      const h = Math.max(ctx.H * 0.08, Math.min(exTop, captionTop) - top - 8);
      layers.push(layer(ctx, pick(ctx, "text.mask-reveal", "text.word-reveal"), { x: s.x, y: top, w: s.w, h: Math.min(h, s.h * 0.34) }, { text: tagline, emphasis: ctx.text.emphasis, align: "center", maxSize: portrait ? 120 : 104, minSize: 34, stagger: 5 }, { from: Math.round(ctx.fps * 1.0), z: 50, depth: 0, role: "hero" }));
    }
    return { layers, camera: cam("camera.pull", { from: 1.18, to: 1, end: 0.9, ease: "out" }) };
  },
});

// ─── interfață reală ────────────────────────────────────────────────────────

export const uiSpotlight = defineRecipe({
  id: "ui-spotlight",
  title: "Funcție în prim-plan pe captura reală",
  description:
    "Captura reală în ramă intră în cadru, camera împinge spre zona funcției, restul se întunecă (spotlight), zona primește contur și un callout cu textul din script.",
  tags: ["feature", "spotlight", "ui", "screenshot", "zoom", "callout", "saas"],
  roles: ["feature", "demo", "solution", "benefit"],
  slots: [{ name: "screen", kind: "screenshot", required: true }],
  minSec: 2.2,
  capabilities: ["media.screen", "ui.spotlight", "ui.highlight", "ui.callout", "mod.enter", "mod.shadow", "camera.push"],
  params: z.object({ callout: z.boolean().default(true), zoom: z.number().min(0).max(1).default(0.75) }),
  build: (ctx, p) => {
    const z0 = zones(ctx);
    const layers = directionBase(ctx);
    const a = ctx.slot("screen")!;
    const region = ctx.focusRegion ?? bestRegion(a.regions, `${ctx.text.headline} ${ctx.text.sub}`);
    const crop = portraitCrop(ctx, a, z0.media, region);
    const sp = screenParams(a, crop ? { shadow: true, crop, frame: "none", radius: 36 } : { shadow: true });
    const children: TimelineLayer[] = [];
    const t1 = Math.round(ctx.duration * 0.28);
    if (region) {
      const full = { x: 0, y: 0, w: a.w, h: a.h };
      children.push(layer(ctx, "ui.spotlight", full, { region: padRect(region.rect, 0), dim: 0.6, padding: 14 }, { from: t1 }));
      children.push(layer(ctx, "ui.highlight", region.rect, { shape: "rect", color: "accent", padding: 14 }, { from: t1 + 4 }));
      const label = ctx.text.items[0] ?? "";
      // în cardul decupat (vertical) nu e loc lateral: callout-ul stă sub sau deasupra zonei, în interiorul cardului;
      // cu subtitrări, partea de jos a cardului e sub banda lor, deci callout-ul urcă deasupra zonei când are loc
      const above = crop ? region.rect.y - crop.y : 0;
      const side = crop ? (ctx.captions ? (above >= 150 ? "top" : "bottom") : region.rect.y + region.rect.h / 2 < crop.y + crop.h * 0.55 ? "bottom" : "top") : region.rect.x > a.w * 0.55 ? "left" : "right";
      if (p.callout && label) children.push(layer(ctx, "ui.callout", region.rect, { text: label, side, distance: crop ? 70 : 120 }, { from: t1 + 10 }));
    }
    const screenLayer = layer(ctx, "media.screen", z0.media, sp, { z: 20, role: "hero", children, modifiers: [{ capability: "mod.enter", params: { style: "rise", distance: 160, spring: "soft", exit: "none" } }] });
    layers.push(screenLayer);
    const h = headline(ctx, z0.text);
    if (h) layers.push(h);
    const sub = subline(ctx, z0.sub, 8);
    if (sub) layers.push(sub);
    const focus = region ? regionFocus(ctx, z0.media, sp, region) : undefined;
    const to = focus ? 1 + (focus.zoom - 1) * p.zoom * (crop ? 0.25 : 1) : 1.08;
    return { layers, camera: cam("camera.push", { from: 1, to, start: 0.22, end: 0.85, ease: "inOut" }), focus };
  },
});

export const uiWalkthrough = defineRecipe({
  id: "ui-walkthrough",
  title: "Demonstrație: cursor, clic, tastare, camera urmărește",
  description:
    "Pe captura reală: cursorul trece pe la 2–3 zone (găsite la captură), face clic, scrie textul din script în câmpul real, iar camera urmărește punctele. Sau o înregistrare reală a fluxului.",
  tags: ["demo", "walkthrough", "cursor", "typing", "click", "tutorial", "how-to"],
  roles: ["demo", "feature", "solution"],
  slots: [{ name: "screen", kind: "screen", required: true }],
  minSec: 3,
  capabilities: ["media.screen", "ui.cursor", "ui.typing", "ui.highlight", "ui.drag", "camera.focus-track", "camera.push"],
  params: z.object({
    typeText: z.string().default(""),
    regions: z.array(z.string()).default([]),
    /** drag & drop peste pixelii reali: zona-sursă (de ex. un card) și zona-țintă (de ex. altă coloană) */
    drag: z.object({ from: z.string(), to: z.string() }).optional(),
  }),
  build: (ctx, p) => {
    const z0 = zones(ctx);
    const layers = directionBase(ctx);
    const a = ctx.slot("screen")!;
    const sp = screenParams(a, { shadow: true }, ctx.fps);
    if (a.kind === "video") {
      // regiunile vin din captura statică a aceleiași pagini (scene.focus), la aceeași rezoluție
      const crop = portraitCrop(ctx, a, z0.media, ctx.focusRegion);
      if (crop) Object.assign(sp, { crop, frame: "none", radius: 36 });
      const screenLayer = layer(ctx, "media.screen", z0.media, sp, { z: 20, role: "hero", modifiers: [{ capability: "mod.enter", params: { style: "scale", spring: "soft", exit: "none" } }] });
      layers.push(screenLayer);
      const h = headline(ctx, z0.text);
      if (h) layers.push(h);
      const focus = ctx.focusRegion && !crop ? regionFocus(ctx, z0.media, sp, ctx.focusRegion, 0.5) : undefined;
      return { layers, camera: focus ? cam("camera.push", { from: 1, to: 1 + (focus.zoom - 1) * 0.6, start: 0.1, end: 0.6 }) : cam("camera.push", { from: 1, to: 1.08, ease: "linear" }), focus };
    }
    if (p.drag) {
      const from = a.regions.find((r) => r.id === p.drag!.from);
      const to = a.regions.find((r) => r.id === p.drag!.to);
      if (from && to) {
        const union = { id: "union", label: "", kind: "custom" as const, rect: { x: Math.min(from.rect.x, to.rect.x), y: Math.min(from.rect.y, to.rect.y), w: Math.max(from.rect.x + from.rect.w, to.rect.x + to.rect.w) - Math.min(from.rect.x, to.rect.x), h: Math.max(from.rect.y + from.rect.h, to.rect.y + to.rect.h) - Math.min(from.rect.y, to.rect.y) } };
        const crop = portraitCrop(ctx, a, z0.media, union);
        if (crop) Object.assign(sp, { crop, frame: "none", radius: 36 });
        const pick = Math.round(ctx.fps * 0.5);
        const drop = Math.round(ctx.duration * 0.62);
        const target = { x: to.rect.x + (to.rect.w - from.rect.w) / 2, y: to.rect.y + Math.min(90, to.rect.h * 0.08) };
        const grab = { x: from.rect.x + from.rect.w * 0.3, y: from.rect.y + from.rect.h * 0.4 };
        const children: TimelineLayer[] = [
          layer(ctx, "ui.drag", { x: 0, y: 0, w: a.w, h: a.h }, { src: a.src, imageWidth: a.w, imageHeight: a.h, from: from.rect, to: target, at: pick, dropAt: drop }),
          layer(ctx, "ui.highlight", { ...to.rect }, { shape: "rect", color: "accent", padding: 6, drawFrames: 10 }, { from: Math.round(pick + (drop - pick) * 0.55), duration: Math.round((drop - pick) * 0.6) }),
          layer(ctx, "ui.cursor", { x: 0, y: 0, w: a.w, h: a.h }, { path: [{ at: 0, x: grab.x - 160, y: grab.y + 220, click: false }, { at: pick, x: grab.x, y: grab.y, click: true }, { at: drop, x: target.x + (grab.x - from.rect.x), y: target.y + (grab.y - from.rect.y), click: true }], size: 30 }, { z: 99 }),
        ];
        layers.push(layer(ctx, "media.screen", z0.media, sp, { z: 20, role: "hero", children, modifiers: [{ capability: "mod.enter", params: { style: "scale", spring: "soft", exit: "none" } }] }));
        const h = headline(ctx, z0.text, { maxSize: 110 });
        if (h) layers.push(h);
        const f = crop ? undefined : regionFocus(ctx, z0.media, sp, union, 0.6);
        return { layers, camera: f ? cam("camera.push", { from: 1, to: 1 + (f.zoom - 1) * 0.6, start: 0.05, end: 0.5 }) : cam("camera.push", { from: 1, to: 1.06, ease: "linear" }), focus: f };
      }
    }
    const named = p.regions.map((id) => a.regions.find((r) => r.id === id)).filter((r): r is NonNullable<typeof r> => !!r);
    const input = a.regions.find((r) => r.kind === "input");
    const picks = named.length ? named : [ctx.focusRegion ?? input ?? bestRegion(a.regions, ctx.text.headline), bestRegion(a.regions, ctx.text.items.join(" ") || ctx.text.sub, ["button", "custom"])].filter((r, i, arr): r is NonNullable<typeof r> => !!r && arr.findIndex((x) => x?.id === r.id) === i);
    if (ctx.orientation === "portrait" && a.w / a.h > 1.1 && picks.length) {
      const xs = picks.flatMap((r) => [r.rect.x, r.rect.x + r.rect.w]);
      const ys = picks.flatMap((r) => [r.rect.y, r.rect.y + r.rect.h]);
      const union = { id: "union", label: "", kind: "custom" as const, rect: { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) } };
      const crop = portraitCrop(ctx, a, z0.media, union);
      if (crop) Object.assign(sp, { crop, frame: "none", radius: 36 });
    }
    const n = Math.max(1, picks.length);
    const seg = Math.floor((ctx.duration * 0.85) / n);
    const path = [{ at: 0, x: a.w * 0.5, y: a.h * 0.75, click: false }];
    const children: TimelineLayer[] = [];
    const points: Array<{ at: number; x: number; y: number; zoom: number }> = [{ at: 0, x: 0.5, y: 0.5, zoom: 1 }];
    picks.forEach((r, i) => {
      const arrive = Math.round(ctx.fps * 0.35) + i * seg;
      const cx = r.rect.x + Math.min(r.rect.w * 0.3, 120);
      const cy = r.rect.y + r.rect.h / 2;
      path.push({ at: arrive, x: cx, y: cy, click: true });
      children.push(layer(ctx, "ui.highlight", r.rect, { shape: "rect", color: "accent", padding: 10, drawFrames: 10 }, { from: arrive + 4, duration: Math.max(8, seg - 4) }));
      if (r.kind === "input" && p.typeText) children.push(layer(ctx, "ui.typing", { x: r.rect.x + r.rect.h * 0.9, y: r.rect.y, w: r.rect.w - r.rect.h * 1.4, h: r.rect.h }, { text: p.typeText, at: 6, color: "text", sizeRatio: 0.34, paddingRatio: 0.05, font: "body" }, { from: arrive + 4 }));
      const f = regionFocus(ctx, z0.media, sp, r, 0.5);
      const z = 1 + (f.zoom - 1) * 0.7;
      // punctul de interes ajunge în centrul zonei media, nu sub titlu
      const t = f.target ?? { x: ctx.W / 2, y: ctx.H / 2 };
      points.push({ at: Math.min(0.95, (arrive + 4) / ctx.duration), x: (f.x + (ctx.W / 2 - t.x) / z) / ctx.W, y: (f.y + (ctx.H / 2 - t.y) / z) / ctx.H, zoom: z });
    });
    children.push(layer(ctx, "ui.cursor", { x: 0, y: 0, w: a.w, h: a.h }, { path, size: 30 }, { z: 99 }));
    layers.push(layer(ctx, "media.screen", z0.media, sp, { z: 20, role: "hero", children, modifiers: [{ capability: "mod.enter", params: { style: "scale", spring: "soft", exit: "none" } }] }));
    const h = headline(ctx, z0.text, { maxSize: 90 });
    if (h) layers.push(h);
    return { layers, camera: cam("camera.focus-track", { points, normalized: true }) };
  },
});

export const featureMontage = defineRecipe({
  id: "feature-montage",
  title: "Montaj rapid de funcții",
  description: "3–5 tăieturi rapide pe ritm, fiecare pe o zonă reală din capturi (decupaj UI), cu eticheta funcției din script.",
  tags: ["montage", "features", "fast", "beat", "cuts", "parade"],
  roles: ["feature", "benefit", "demo"],
  slots: [{ name: "screens", kind: "screenshot", required: true, multiple: true }],
  minSec: 2,
  minSecFor: (t) => (t.items.length ? t.items : [t.headline ?? ""]).reduce((s, x) => s + readingSec(x) + 0.25, 0),
  capabilities: ["media.screen", "text.pop", "text.word-reveal", "camera.beat-punch", "mod.enter"],
  params: z.object({ maxCuts: z.number().int().min(2).max(6).default(4) }),
  build: (ctx, p) => {
    const z0 = zones(ctx, ctx.orientation === "landscape" ? "stacked" : ctx.scene.composition);
    const layers = directionBase(ctx);
    const screens = ctx.slots("screens");
    const items = ctx.text.items.length ? ctx.text.items : [ctx.text.headline];
    const n = Math.min(p.maxCuts, Math.max(items.length, 2));
    const starts = readingSegments(ctx, Array.from({ length: n }, (_, i) => items[i] ?? ""));
    const cues: RecipeCue[] = [];
    const used = new Set<string>();
    const pickFor = (text: string, i: number) => {
      const words = norm(text).split(/\s+/).filter((w) => w.length > 3);
      let best: { a: (typeof screens)[number]; r: (typeof screens)[number]["regions"][number] | undefined; s: number } | null = null;
      for (const a of screens) {
        for (const r of a.regions.filter((x) => ["custom", "input", "button", "heading"].includes(x.kind))) {
          const label = norm(`${r.label} ${r.text ?? ""}`);
          let s = words.filter((w) => label.includes(w.slice(0, Math.max(4, w.length - 2)))).length;
          if (used.has(`${a.asset.id}:${r.id}`)) s -= 0.5;
          if (a.w / a.h < 1 && ctx.orientation !== "portrait") s -= 0.3;
          if (!best || s > best.s) best = { a, r, s };
        }
      }
      if (!best || best.s <= 0) return { a: screens[i % screens.length], r: undefined };
      used.add(`${best.a.asset.id}:${best.r?.id}`);
      return best;
    };
    for (let i = 0; i < n; i++) {
      const { a, r } = pickFor(items[i] ?? "", i);
      const crop = r ? padRect(r.rect, Math.max(r.rect.w, r.rect.h) * 0.35) : undefined;
      const from = starts[i];
      const dur = (starts[i + 1] ?? ctx.duration) - from;
      layers.push(layer(ctx, "media.screen", z0.media, screenParams(a, { crop, frame: "none", radius: 28 }), { from, duration: dur, z: 20, role: "hero", modifiers: [{ capability: "mod.enter", params: { style: "scale", spring: "pop", exit: "none", motionBlur: true } }] }));
      if (items[i]) layers.push(layer(ctx, pick(ctx, ctx.dir.text.list, "text.word-reveal"), z0.text, { text: items[i], emphasis: ctx.text.emphasis, maxSize: 110, minSize: 34, align: "left", exitFrames: 3 }, { from, duration: dur, z: 50, depth: 0, role: "hero" }));
      if (i > 0) cues.push({ at: from, sound: "whoosh-fast", gainDb: -6, reason: "tăietură în montaj" });
    }
    return { layers, camera: cam("camera.beat-punch", { hits: starts, amount: 0.05 }), cues };
  },
});

export const scrollTour = defineRecipe({
  id: "scroll-tour",
  title: "Tur prin pagină (scroll real)",
  description: "O captură de pagină întreagă într-o ramă de browser, derulată lin de sus până la o zonă-țintă.",
  tags: ["scroll", "website", "landing", "tour", "browser", "establishing"],
  roles: ["feature", "demo", "reveal", "solution"],
  slots: [{ name: "page", kind: "tall-screenshot", required: true }],
  minSec: 2.5,
  capabilities: ["media.screen", "camera.push", "text.word-reveal"],
  params: z.object({ to: z.number().min(0).max(1).default(0.45) }),
  build: (ctx, p) => {
    const z0 = zones(ctx);
    const layers = directionBase(ctx);
    const a = ctx.slot("page")!;
    const vp = a.asset.capture?.viewport;
    const visibleH = vp ? (vp.height / vp.width) * a.w : a.w * 0.6;
    const target = ctx.focusRegion ? Math.max(0, ctx.focusRegion.rect.y - visibleH * 0.2) : (a.h - visibleH) * p.to;
    layers.push(layer(ctx, "media.screen", z0.media, screenParams(a, { frame: "browser", scroll: { from: 0, to: Math.max(0, Math.min(a.h - visibleH, target)), start: 0.15, end: 0.85, ease: "inOut" } }), { z: 20, role: "hero", modifiers: [{ capability: "mod.enter", params: { style: "rise", spring: "soft", exit: "none" } }] }));
    const h = headline(ctx, z0.text);
    if (h) layers.push(h);
    const sub = subline(ctx, z0.sub, 8);
    if (sub) layers.push(sub);
    return { layers, camera: cam("camera.push", { from: 1, to: 1.06, ease: "linear" }), cues: [{ at: Math.round(ctx.duration * 0.15), sound: "whoosh-soft", gainDb: -10, reason: "începutul scroll-ului" }] };
  },
});

export const deviceHero = defineRecipe({
  id: "device-hero",
  title: "Dispozitiv 3D cu aplicația",
  description: "Un telefon sau laptop generic se rotește lent în 3D cu captura reală pe ecran, lumini difuze în spate. Pentru aplicații mobile și momente-hero.",
  tags: ["device", "3d", "phone", "mobile-app", "hero", "premium"],
  roles: ["reveal", "feature", "solution"],
  slots: [{ name: "screen", kind: "screenshot", required: true }],
  minSec: 2.2,
  capabilities: ["media.device-3d", "fx.glow-orbs", "camera.parallax-drift", "mod.reflection"],
  params: z.object({ device: z.enum(["auto", "phone", "laptop"]).default("auto") }),
  build: (ctx, p) => {
    const z0 = zones(ctx);
    const layers = directionBase(ctx);
    const a = ctx.slot("screen")!;
    const device = p.device === "auto" ? ((a.asset.capture?.viewport.width ?? a.w) < 600 || a.w / a.h < 0.7 ? "phone" : "laptop") : p.device;
    if (!ctx.forbidden.includes("fx.glow-orbs")) layers.push(layer(ctx, "fx.glow-orbs", { x: 0, y: 0, w: ctx.W, h: ctx.H }, { colors: ["primary", "accent"], intensity: 0.4, size: 0.7 }, { z: 3, depth: 0.5, role: "background" }));
    layers.push(layer(ctx, "media.device-3d", z0.media, { src: a.src, imageWidth: a.w, imageHeight: a.h, device }, { z: 20, depth: 1, role: "hero" }));
    const h = headline(ctx, z0.text);
    if (h) layers.push(h);
    const sub = subline(ctx, z0.sub, 10);
    if (sub) layers.push(sub);
    return { layers, camera: cam("camera.parallax-drift", { distance: 0.05, zoom: 1.06 }) };
  },
});

export const stack3d = defineRecipe({
  id: "stack-3d",
  title: "Stivă de ecrane 3D",
  description: "Mai multe capturi reale așezate în adâncime; camera trece printre ele. Arată amploarea produsului.",
  tags: ["3d", "stack", "depth", "screens", "premium", "overview"],
  roles: ["feature", "reveal", "benefit"],
  slots: [{ name: "screens", kind: "screenshot", required: true, multiple: true }],
  minSec: 2.5,
  capabilities: ["media.stack-3d", "text.mask-reveal"],
  params: z.object({}),
  build: (ctx) => {
    const z0 = zones(ctx, ctx.orientation === "portrait" ? "stacked" : "full-bleed");
    const layers = directionBase(ctx);
    const srcs = ctx.slots("screens").map((s) => s.src);
    layers.push(layer(ctx, "media.stack-3d", { x: 0, y: 0, w: ctx.W, h: ctx.H }, { srcs: srcs.length >= 2 ? srcs : [...srcs, ...srcs].slice(0, 3) }, { z: 20, depth: 1, role: "hero" }));
    const h = headline(ctx, z0.text, { capability: "text.mask-reveal" });
    if (h) layers.push(h);
    return { layers, camera: cam("camera.static", { zoom: 1 }) };
  },
});

export const beforeAfter = defineRecipe({
  id: "before-after",
  title: "Înainte / după",
  description: "Două imagini reale (înainte și după) cu un separator care glisează; etichetele vin din script.",
  tags: ["before-after", "transformation", "compare", "split"],
  roles: ["transformation", "proof", "solution"],
  slots: [{ name: "before", kind: "image", required: true }, { name: "after", kind: "image", required: true }],
  minSec: 2.5,
  capabilities: ["media.compare", "text.word-reveal"],
  params: z.object({}),
  build: (ctx) => {
    const z0 = zones(ctx);
    const layers = directionBase(ctx);
    const b = ctx.slot("before")!;
    const a = ctx.slot("after")!;
    layers.push(layer(ctx, "media.compare", z0.media, { before: b.src, after: a.src, beforeLabel: ctx.text.items[0] ?? "", afterLabel: ctx.text.items[1] ?? "", startFrame: Math.round(ctx.fps * 0.6), frames: Math.round(ctx.fps * 1.2) }, { z: 20, role: "hero" }));
    const h = headline(ctx, z0.text);
    if (h) layers.push(h);
    return { layers, camera: cam("camera.static", { zoom: 1 }) };
  },
});

// ─── pași, dovezi, lansare, tehnic ──────────────────────────────────────────

export const steps = defineRecipe({
  id: "steps",
  title: "Cum funcționează în 3 pași",
  description: "O linie de timp se desenează și dezvăluie pașii (din script), opțional cu captura reală alături.",
  tags: ["steps", "how-it-works", "process", "workflow", "timeline"],
  roles: ["demo", "solution", "feature"],
  slots: [{ name: "screen", kind: "screenshot", required: false }],
  minSec: 3,
  capabilities: ["data.timeline", "text.word-reveal", "media.screen"],
  params: z.object({}),
  build: (ctx) => {
    const s = ctx.safe.rect;
    const z0 = zones(ctx);
    const layers = directionBase(ctx);
    const items = (ctx.text.items.length >= 2 ? ctx.text.items : ["Pasul 1", "Pasul 2", "Pasul 3"]).slice(0, 4);
    const tlBox: Rect = ctx.orientation === "portrait" ? { x: s.x, y: s.y + s.h * 0.32, w: s.w, h: s.h * 0.3 } : { x: s.x, y: s.y + s.h * 0.42, w: s.w, h: s.h * 0.4 };
    layers.push(layer(ctx, "data.timeline", tlBox, { items: items.map((label, i) => ({ label, sub: `${i + 1}` })), stagger: Math.max(6, Math.floor((ctx.duration * 0.6) / items.length)) }, { z: 30, depth: 0, role: "hero" }));
    const screen = ctx.slot("screen");
    if (screen && ctx.orientation === "portrait") layers.push(layer(ctx, "media.screen", { x: z0.media.x, y: s.y + s.h * 0.66, w: z0.media.w, h: s.h * 0.34 }, screenParams(screen, {}, ctx.fps), { z: 20, from: Math.round(ctx.duration * 0.4), modifiers: [{ capability: "mod.enter", params: { style: "rise", exit: "none" } }] }));
    const h = headline(ctx, { x: s.x, y: s.y + s.h * 0.04, w: s.w, h: s.h * 0.22 }, { maxSize: 100 });
    if (h) layers.push(h);
    return { layers, camera: cam("camera.static", { zoom: 1 }) };
  },
});

export const proofMetric = defineRecipe({
  id: "proof-metric",
  title: "Dovadă: cifră verificată sau citat real",
  description: "O cifră mare care numără (doar dintr-o afirmație verificată, cu claimId) sau un citat real cu atribuire.",
  tags: ["proof", "metric", "counter", "testimonial", "quote", "social-proof"],
  roles: ["proof", "benefit"],
  slots: [],
  minSec: 2.2,
  capabilities: ["text.counter", "text.mask-reveal", "text.body", "fx.glow-orbs"],
  params: z.object({
    mode: z.enum(["metric", "quote"]).default("metric"),
    value: z.number().optional(),
    prefix: z.string().default(""),
    suffix: z.string().default(""),
    decimals: z.number().int().default(0),
    claimId: z.string().optional(),
    attribution: z.string().default(""),
  }),
  build: (ctx, p) => {
    const s = ctx.safe.rect;
    const layers = directionBase(ctx);
    const notes: string[] = [];
    if (p.mode === "metric" && p.value !== undefined && p.claimId) {
      const box: Rect = ctx.orientation === "portrait" ? { x: s.x, y: s.y + s.h * 0.2, w: s.w, h: s.h * 0.34 } : { x: s.x, y: s.y + s.h * 0.18, w: s.w * 0.7, h: s.h * 0.5 };
      layers.push(layer(ctx, "text.counter", box, { value: p.value, prefix: p.prefix, suffix: p.suffix, decimals: p.decimals, label: ctx.text.headline, claimId: p.claimId, align: "left" }, { z: 40, depth: 0, role: "hero" }));
    } else {
      if (p.mode === "metric") notes.push("Fără cifră verificată (value + claimId): dovada se afișează ca text.");
      const box: Rect = ctx.orientation === "portrait" ? { x: s.x, y: s.y + s.h * 0.18, w: s.w, h: s.h * 0.4 } : { x: s.x, y: s.y + s.h * 0.15, w: s.w * 0.8, h: s.h * 0.5 };
      layers.push(layer(ctx, pick(ctx, "text.mask-reveal", "text.word-reveal"), box, textParams(ctx, p.mode === "quote" ? `„${ctx.text.headline}”` : ctx.text.headline, { maxSize: 100, minSize: 34, font: p.mode === "quote" ? "display" : "display" }), { z: 40, depth: 0, role: "hero" }));
      const attr = p.attribution || ctx.text.sub;
      if (attr) layers.push(layer(ctx, "text.body", { x: box.x, y: box.y + box.h + 12, w: box.w, h: s.h * 0.08 }, { text: attr, emphasis: [], color: "textMuted", maxSize: 44, minSize: 28 }, { from: 10, z: 41, depth: 0 }));
    }
    if (!ctx.forbidden.includes("fx.glow-orbs")) layers.push(layer(ctx, "fx.glow-orbs", { x: 0, y: 0, w: ctx.W, h: ctx.H }, { intensity: 0.3 }, { z: 3, depth: 0.5, role: "background" }));
    return { layers, camera: cam("camera.push", { from: 1, to: 1.05, ease: "linear" }), notes };
  },
});

export const launchBurst = defineRecipe({
  id: "launch-burst",
  title: "Anunț de lansare",
  description: "Un cuvânt mare („NOU”, o dată, un nume de funcție), explozie de confetti, logo, tremur pe impact.",
  tags: ["launch", "announcement", "new", "celebrate", "burst"],
  roles: ["reveal", "hook", "outro"],
  slots: [{ name: "logo", kind: "logo", required: false }],
  minSec: 1.8,
  capabilities: ["text.big-word", "fx.burst", "logo.reveal", "camera.shake"],
  params: z.object({}),
  build: (ctx) => {
    const s = ctx.safe.rect;
    const layers = directionBase(ctx);
    const word: Rect = { x: s.x, y: s.y + s.h * (ctx.orientation === "portrait" ? 0.22 : 0.12), w: s.w, h: s.h * (ctx.orientation === "portrait" ? 0.3 : 0.45) };
    layers.push(layer(ctx, "text.big-word", word, { text: ctx.text.headline, align: "center", uppercase: true, exit: "snap" }, { z: 40, depth: 0, role: "hero" }));
    if (!ctx.forbidden.includes("fx.burst")) layers.push(layer(ctx, "fx.burst", { x: 0, y: 0, w: ctx.W, h: ctx.H }, { at: 4, y: (word.y + word.h / 2) / ctx.H }, { z: 45, depth: 0.5 }));
    const logo = ctx.slot("logo") ?? ctx.logo;
    if (logo) {
      const sz = Math.min(s.w * 0.22, s.h * 0.14);
      layers.push(layer(ctx, "logo.reveal", { x: ctx.W / 2 - sz / 2, y: word.y + word.h + s.h * 0.05, w: sz, h: sz }, { src: logo.src, mode: "pop", at: Math.round(ctx.fps * 0.5) }, { z: 40, depth: 0, role: "support" }));
    }
    const sub = subline(ctx, { x: s.x, y: s.y + s.h * 0.78, w: s.w, h: s.h * 0.1 }, 12, ctx.text.sub, "center");
    if (sub) layers.push(sub);
    return { layers, camera: cam("camera.shake", { hits: [0.04], strength: "medium" }) };
  },
});

export const technicalDemo = defineRecipe({
  id: "technical-demo",
  title: "Demo tehnic (terminal sau cod)",
  description: "Comenzi într-un terminal sau un fragment de cod scris pe ecran. Conținutul trebuie să fie real (din documentație sau de la utilizator).",
  tags: ["technical", "developer", "terminal", "code", "api", "cli"],
  roles: ["demo", "feature", "solution"],
  slots: [],
  minSec: 3,
  capabilities: ["ui.terminal", "ui.code", "text.word-reveal", "camera.push"],
  params: z.object({
    mode: z.enum(["terminal", "code"]).default("terminal"),
    entries: z.array(z.object({ cmd: z.string(), output: z.array(z.string()).default([]) })).default([]),
    code: z.string().default(""),
    title: z.string().default(""),
  }),
  build: (ctx, p) => {
    const z0 = zones(ctx);
    const layers = directionBase(ctx);
    const notes: string[] = [];
    if (p.mode === "terminal" && p.entries.length) layers.push(layer(ctx, "ui.terminal", z0.media, { entries: p.entries, title: p.title || "terminal", fontSize: ctx.orientation === "portrait" ? 34 : 30 }, { z: 20, role: "hero", modifiers: [{ capability: "mod.enter", params: { style: "rise", exit: "none" } }] }));
    else if (p.mode === "code" && p.code) layers.push(layer(ctx, "ui.code", z0.media, { code: p.code, title: p.title, fontSize: ctx.orientation === "portrait" ? 30 : 28 }, { z: 20, role: "hero", modifiers: [{ capability: "mod.enter", params: { style: "rise", exit: "none" } }] }));
    else notes.push("Lipsește conținutul real (comenzi sau cod); scena arată doar titlul.");
    const h = headline(ctx, z0.text, { capability: "text.typewriter" });
    if (h) layers.push(h);
    return { layers, camera: cam("camera.push", { from: 1, to: 1.05, ease: "linear" }), notes };
  },
});

// ─── final ──────────────────────────────────────────────────────────────────

export const ctaEnd = defineRecipe({
  id: "cta-end",
  title: "Card final cu apel la acțiune",
  description:
    "Logo + CTA (textul exact din brief) pe un buton grafic, adresa sub el; o singură dungă de lumină, apoi hold fără mișcare la momentul deciziei. Centrat conștient.",
  tags: ["cta", "end-card", "logo", "hold", "conversion", "outro"],
  roles: ["cta", "outro"],
  slots: [{ name: "logo", kind: "logo", required: false }, { name: "screen", kind: "screenshot", required: false }],
  minSec: 3,
  capabilities: ["logo.reveal", "shape.panel", "text.word-reveal", "text.body", "fx.light-sweep", "media.screen", "mod.reflection", "camera.static"],
  params: z.object({ url: z.string().default("") }),
  build: (ctx, p) => {
    const s = ctx.safe.rect;
    const layers = directionBase(ctx).filter((l) => l.capability !== "fx.particles");
    const logo = ctx.slot("logo") ?? ctx.logo;
    const portrait = ctx.orientation === "portrait";
    const logoSize = Math.min(s.w * 0.3, s.h * (portrait ? 0.14 : 0.24));
    const top = s.y + s.h * (portrait ? 0.14 : 0.08);
    if (logo) layers.push(layer(ctx, "logo.reveal", { x: ctx.W / 2 - logoSize / 2, y: top, w: logoSize, h: logoSize }, { src: logo.src, mode: "scale", at: 0 }, { z: 40, depth: 0, role: "support" }));
    const head = ctx.text.headline || ctx.productName;
    const headBox: Rect = { x: s.x, y: top + logoSize + s.h * 0.04, w: s.w, h: s.h * (portrait ? 0.16 : 0.2) };
    layers.push(layer(ctx, pick(ctx, "text.word-reveal", "text.body"), headBox, { text: head, emphasis: ctx.text.emphasis, align: "center", maxSize: portrait ? 104 : 96, minSize: 36, exit: "none" }, { from: 6, z: 50, depth: 0, role: "hero" }));
    const cta = ctx.text.sub || ctx.text.items[0] || "";
    if (cta) {
      const bw = Math.min(s.w * (portrait ? 0.9 : 0.5), 960);
      const bh = Math.min(s.h * (portrait ? 0.13 : 0.12), 180);
      const btn: Rect = { x: ctx.W / 2 - bw / 2, y: headBox.y + headBox.h + s.h * 0.05, w: bw, h: bh };
      layers.push(layer(ctx, "shape.panel", btn, { color: "primary", radius: bh / 2, from: "scale" }, { from: 12, z: 45, depth: 0, role: "hero" }));
      layers.push(layer(ctx, "text.body", { x: btn.x + bh * 0.4, y: btn.y, w: btn.w - bh * 0.8, h: btn.h }, { text: cta, emphasis: [], font: "display", color: readableOn(ctx.palette.primary), align: "center", maxSize: Math.round(bh * 0.5), minSize: 28, exit: "none", delay: 4 }, { from: 14, z: 46, depth: 0, role: "hero" }));
      if (!ctx.forbidden.includes("fx.light-sweep")) layers.push(layer(ctx, "fx.light-sweep", btn, { start: 0, end: 0.9, intensity: 0.5 }, { from: 26, duration: 24, z: 47, depth: 0 }));
      if (p.url) layers.push(layer(ctx, "text.body", { x: s.x, y: btn.y + btn.h + s.h * 0.03, w: s.w, h: s.h * 0.06 }, { text: p.url, emphasis: [], color: "textMuted", align: "center", maxSize: 44, minSize: 28, exit: "none" }, { from: 20, z: 46, depth: 0 }));
    }
    const screen = ctx.slot("screen");
    if (screen) {
      // decor real în partea de jos: intră în primele ~0,6 s, apoi stă nemișcat (hold pe decizie)
      const box: Rect = portrait ? { x: ctx.W * 0.08, y: s.y + s.h * 0.86, w: ctx.W * 0.84, h: ctx.H - (s.y + s.h * 0.86) + ctx.H * 0.05 } : { x: ctx.W * 0.22, y: s.y + s.h * 0.86, w: ctx.W * 0.56, h: ctx.H * 0.62 };
      layers.push(layer(ctx, "media.screen", box, screenParams(screen, { frame: frameFor(screen), shadow: true }, ctx.fps), { z: 8, depth: 0.8, role: "background", modifiers: [{ capability: "mod.enter", params: { style: "rise", distance: 260, spring: "soft", exit: "none" } }] }));
    }
    return { layers, camera: cam("camera.static", { zoom: 1 }), cues: [{ at: 12, sound: "pop", gainDb: -6, reason: "apariția butonului CTA" }] };
  },
});

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
