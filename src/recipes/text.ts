/** Rețetele de text: hook-ul kinetic, secvența de cuvinte și problema. */
import { z } from "zod";
import { readingSec } from "../editing/grammar";
import type { Rect } from "../core/schema";
import { cardRadius, directionBase, layer, textParams, zones } from "./kit";
import { defineRecipe, type RecipeCue } from "./types";
import { beatHits, cam, pick, readingSegments, subline } from "./parts";

export const hookKinetic = defineRecipe({
  id: "hook-kinetic",
  title: "Hook cu tipografie cinetică",
  description:
    "Fraza de hook pe tot ecranul, cu stilul de text al direcției (slam, pop, blur), camera pe ritm și, opțional, captura reală estompată în fundal.",
  tags: ["hook", "kinetic", "typography", "aggressive", "social", "scroll-stop"],
  roles: ["hook", "agitation", "benefit"],
  slots: [{ name: "screen", kind: "screen", required: false }],
  minSec: 1.2,
  capabilities: [
    "text.slam",
    "text.pop",
    "text.blur-reveal",
    "text.typewriter",
    "text.mask-reveal",
    "bg.image",
    "shape.ring-pulse",
    "camera.beat-punch",
    "camera.shake",
  ],
  params: z.object({ backgroundScreen: z.boolean().default(true), ring: z.boolean().default(true) }),
  build: (ctx, p) => {
    const s = ctx.safe.rect;
    const layers = directionBase(ctx);
    const screen = ctx.slot("screen");
    if (screen && p.backgroundScreen && screen.kind !== "video") {
      layers.push(
        layer(
          ctx,
          "bg.image",
          { x: 0, y: 0, w: ctx.W, h: ctx.H },
          { src: screen.src, blur: 22, dim: 0.5, scale: 1.18 },
          { z: 2, depth: 0.7, role: "background" },
        ),
      );
      if (!ctx.forbidden.includes("fx.glow-orbs"))
        layers.push(
          layer(
            ctx,
            "fx.glow-orbs",
            { x: 0, y: 0, w: ctx.W, h: ctx.H },
            { colors: ["primary", "accent"], intensity: 0.42, size: 0.8, speed: 0.8 },
            { z: 3, depth: 0.5, role: "background" },
          ),
        );
    }
    const box: Rect =
      ctx.orientation === "landscape" ? { x: s.x, y: s.y + s.h * 0.14, w: s.w * 0.78, h: s.h * 0.6 } : { x: s.x, y: s.y + s.h * 0.16, w: s.w, h: s.h * 0.46 };
    const cap = pick(ctx, ctx.dir.text.hook, "text.word-reveal");
    layers.push(
      layer(
        ctx,
        cap,
        box,
        textParams(ctx, ctx.text.headline, {
          maxSize: ctx.orientation === "landscape" ? 170 : 150,
          minSize: 40,
          uppercase: ctx.dir.uppercaseHook,
          align: "left",
          exit: "snap",
        }),
        { z: 50, depth: 0, role: "hero" },
      ),
    );
    const sub = subline(ctx, { x: box.x, y: box.y + box.h + 10, w: box.w, h: s.h * 0.12 }, 10);
    if (sub) layers.push(sub);
    if (p.ring && cap === "text.slam" && !ctx.forbidden.includes("shape.ring-pulse"))
      layers.push(
        layer(
          ctx,
          "shape.ring-pulse",
          { x: box.x - 100, y: box.y - 100, w: box.w * 0.6, h: box.w * 0.6 },
          { at: 3, rings: 2, color: "accent" },
          { z: 40, depth: 0.4 },
        ),
      );
    const camera =
      ctx.energy >= 0.7 && ctx.dir.camera.active === "camera.shake"
        ? cam("camera.shake", { hits: [0.05], strength: "small" })
        : cam("camera.beat-punch", { hits: beatHits(ctx), amount: 0.04 + 0.04 * ctx.energy });
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
    const box: Rect =
      ctx.orientation === "landscape" ? { x: s.x, y: s.y + s.h * 0.2, w: s.w * 0.8, h: s.h * 0.5 } : { x: s.x, y: s.y + s.h * 0.2, w: s.w, h: s.h * 0.4 };
    const cues: RecipeCue[] = [];
    items.forEach((t, i) => {
      const from = starts[i];
      const to = starts[i + 1] ?? ctx.duration;
      layers.push(
        layer(
          ctx,
          cap,
          box,
          { text: t, emphasis: ctx.text.emphasis, maxSize: 160, minSize: 40, align: "left", exit: "snap", exitFrames: 3 },
          { from, duration: to - from, z: 50, depth: 0, role: "hero" },
        ),
      );
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
    if (before)
      layers.push(
        layer(
          ctx,
          "media.image",
          z0.media,
          { src: before.src, fit: "cover", radius: cardRadius(ctx, 0.8) },
          {
            z: 20,
            modifiers: [
              { capability: "mod.color-grade", params: { preset: "mono" } },
              { capability: "mod.enter", params: { style: "rise" } },
            ],
          },
        ),
      );
    layers.push(layer(ctx, "fx.vignette", { x: 0, y: 0, w: ctx.W, h: ctx.H }, { strength: 0.6 }, { z: 80, depth: 0, role: "overlay" }));
    const box = before ? z0.text : ctx.orientation === "landscape" ? { ...z0.text, w: ctx.safe.rect.w * 0.8 } : { ...z0.text, h: z0.text.h * 1.6 };
    layers.push(
      layer(
        ctx,
        "text.highlight",
        box,
        textParams(ctx, ctx.text.headline, { style: p.mark, markAt: Math.round(ctx.fps * 0.7), markColor: "accent", maxSize: 120, minSize: 34 }),
        { z: 50, depth: 0, role: "hero" },
      ),
    );
    const sub = subline(ctx, before ? z0.sub : { x: box.x, y: box.y + box.h, w: box.w, h: z0.sub.h }, Math.round(ctx.fps * 0.5));
    if (sub) layers.push(sub);
    return { layers, camera: cam("camera.push", { from: 1, to: 1.06, ease: "linear" }) };
  },
});
