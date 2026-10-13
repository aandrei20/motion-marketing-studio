/** Rețetele de pași, dovezi (cifre cu sursă), lansare și demonstrație tehnică. */
import { z } from "zod";
import type { Rect } from "../core/schema";
import { directionBase, layer, screenParams, textParams, zones } from "./kit";
import { defineRecipe } from "./types";
import { cam, headline, pick, subline } from "./parts";

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
    const tlBox: Rect =
      ctx.orientation === "portrait" ? { x: s.x, y: s.y + s.h * 0.32, w: s.w, h: s.h * 0.3 } : { x: s.x, y: s.y + s.h * 0.42, w: s.w, h: s.h * 0.4 };
    layers.push(
      layer(
        ctx,
        "data.timeline",
        tlBox,
        { items: items.map((label, i) => ({ label, sub: `${i + 1}` })), stagger: Math.max(6, Math.floor((ctx.duration * 0.6) / items.length)) },
        { z: 30, depth: 0, role: "hero" },
      ),
    );
    const screen = ctx.slot("screen");
    if (screen && ctx.orientation === "portrait")
      layers.push(
        layer(ctx, "media.screen", { x: z0.media.x, y: s.y + s.h * 0.66, w: z0.media.w, h: s.h * 0.34 }, screenParams(screen, {}, ctx.fps), {
          z: 20,
          from: Math.round(ctx.duration * 0.4),
          modifiers: [{ capability: "mod.enter", params: { style: "rise", exit: "none" } }],
        }),
      );
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
      const box: Rect =
        ctx.orientation === "portrait" ? { x: s.x, y: s.y + s.h * 0.2, w: s.w, h: s.h * 0.34 } : { x: s.x, y: s.y + s.h * 0.18, w: s.w * 0.7, h: s.h * 0.5 };
      layers.push(
        layer(
          ctx,
          "text.counter",
          box,
          { value: p.value, prefix: p.prefix, suffix: p.suffix, decimals: p.decimals, label: ctx.text.headline, claimId: p.claimId, align: "left" },
          { z: 40, depth: 0, role: "hero" },
        ),
      );
    } else {
      if (p.mode === "metric") notes.push("Fără cifră verificată (value + claimId): dovada se afișează ca text.");
      const box: Rect =
        ctx.orientation === "portrait" ? { x: s.x, y: s.y + s.h * 0.18, w: s.w, h: s.h * 0.4 } : { x: s.x, y: s.y + s.h * 0.15, w: s.w * 0.8, h: s.h * 0.5 };
      layers.push(
        layer(
          ctx,
          pick(ctx, "text.mask-reveal", "text.word-reveal"),
          box,
          textParams(ctx, p.mode === "quote" ? `„${ctx.text.headline}”` : ctx.text.headline, {
            maxSize: 100,
            minSize: 34,
            font: p.mode === "quote" ? "display" : "display",
          }),
          { z: 40, depth: 0, role: "hero" },
        ),
      );
      const attr = p.attribution || ctx.text.sub;
      if (attr)
        layers.push(
          layer(
            ctx,
            "text.body",
            { x: box.x, y: box.y + box.h + 12, w: box.w, h: s.h * 0.08 },
            { text: attr, emphasis: [], color: "textMuted", maxSize: 44, minSize: 28 },
            { from: 10, z: 41, depth: 0 },
          ),
        );
    }
    if (!ctx.forbidden.includes("fx.glow-orbs"))
      layers.push(layer(ctx, "fx.glow-orbs", { x: 0, y: 0, w: ctx.W, h: ctx.H }, { intensity: 0.3 }, { z: 3, depth: 0.5, role: "background" }));
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
    const word: Rect = {
      x: s.x,
      y: s.y + s.h * (ctx.orientation === "portrait" ? 0.22 : 0.12),
      w: s.w,
      h: s.h * (ctx.orientation === "portrait" ? 0.3 : 0.45),
    };
    layers.push(
      layer(ctx, "text.big-word", word, { text: ctx.text.headline, align: "center", uppercase: true, exit: "snap" }, { z: 40, depth: 0, role: "hero" }),
    );
    if (!ctx.forbidden.includes("fx.burst"))
      layers.push(layer(ctx, "fx.burst", { x: 0, y: 0, w: ctx.W, h: ctx.H }, { at: 4, y: (word.y + word.h / 2) / ctx.H }, { z: 45, depth: 0.5 }));
    const logo = ctx.slot("logo") ?? ctx.logo;
    if (logo) {
      const sz = Math.min(s.w * 0.22, s.h * 0.14);
      layers.push(
        layer(
          ctx,
          "logo.reveal",
          { x: ctx.W / 2 - sz / 2, y: word.y + word.h + s.h * 0.05, w: sz, h: sz },
          { src: logo.src, mode: "pop", at: Math.round(ctx.fps * 0.5) },
          { z: 40, depth: 0, role: "support" },
        ),
      );
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
    if (p.mode === "terminal" && p.entries.length)
      layers.push(
        layer(
          ctx,
          "ui.terminal",
          z0.media,
          { entries: p.entries, title: p.title || "terminal", fontSize: ctx.orientation === "portrait" ? 34 : 30 },
          { z: 20, role: "hero", modifiers: [{ capability: "mod.enter", params: { style: "rise", exit: "none" } }] },
        ),
      );
    else if (p.mode === "code" && p.code)
      layers.push(
        layer(
          ctx,
          "ui.code",
          z0.media,
          { code: p.code, title: p.title, fontSize: ctx.orientation === "portrait" ? 30 : 28 },
          { z: 20, role: "hero", modifiers: [{ capability: "mod.enter", params: { style: "rise", exit: "none" } }] },
        ),
      );
    else notes.push("Lipsește conținutul real (comenzi sau cod); scena arată doar titlul.");
    const h = headline(ctx, z0.text, { capability: "text.typewriter" });
    if (h) layers.push(h);
    return { layers, camera: cam("camera.push", { from: 1, to: 1.05, ease: "linear" }), notes };
  },
});
