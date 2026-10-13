/** Rețeta de dezvăluire a produsului: logo-ul, lumina din spate și sloganul. */
import { z } from "zod";
import type { Rect } from "../core/schema";
import { directionBase, layer } from "./kit";
import { defineRecipe } from "./types";
import { cam, pick } from "./parts";

export const productReveal = defineRecipe({
  id: "product-reveal",
  title: "Revelarea produsului (logo)",
  description: "Logo-ul apare din particule sau cu un pop, raze de lumină în spate, sloganul se dezvăluie sub el. Momentul „iată soluția”.",
  tags: ["reveal", "logo", "launch", "cinematic", "premium", "solution"],
  roles: ["reveal", "solution", "outro"],
  slots: [{ name: "logo", kind: "logo", required: false }],
  minSec: 2,
  capabilities: [
    "logo.particles",
    "logo.reveal",
    "logo.light-pass",
    "fx.god-rays",
    "fx.glow-orbs",
    "shape.ring-pulse",
    "text.mask-reveal",
    "text.big-word",
    "camera.pull",
  ],
  params: z.object({ style: z.enum(["particles", "pop", "light-pass"]).default("pop") }),
  build: (ctx, p) => {
    const s = ctx.safe.rect;
    const layers = directionBase(ctx);
    const logo = ctx.slot("logo") ?? ctx.logo;
    const portrait = ctx.orientation === "portrait";
    const size = portrait ? Math.min(s.w * 0.38, s.h * 0.26) : Math.min(s.w * 0.5, s.h * 0.32);
    const cy = portrait ? s.y + s.h * 0.2 : s.y + s.h * 0.38;
    const logoBox: Rect = { x: ctx.W / 2 - size / 2, y: cy - size / 2, w: size, h: size };
    if (!ctx.forbidden.includes("fx.god-rays"))
      layers.push(
        layer(
          ctx,
          "fx.god-rays",
          { x: 0, y: 0, w: ctx.W, h: ctx.H },
          { x: 0.5, y: cy / ctx.H, intensity: 0.16, color: "primary" },
          { z: 5, depth: 0.6, role: "background" },
        ),
      );
    const arrive = Math.round(ctx.fps * 0.8);
    if (logo) {
      const cap = p.style === "particles" ? "logo.particles" : p.style === "light-pass" ? "logo.light-pass" : "logo.reveal";
      const params =
        cap === "logo.particles"
          ? { src: logo.src, arrive }
          : cap === "logo.light-pass"
            ? { src: logo.src, at: arrive }
            : { src: logo.src, mode: "pop", at: 4 };
      layers.push(
        layer(ctx, cap, logoBox, params, {
          z: 40,
          depth: 0.9,
          role: "hero",
          modifiers: [{ capability: "mod.glow", params: { color: "primary", radius: 40, intensity: 0.5 } }],
        }),
      );
      if (!ctx.forbidden.includes("shape.ring-pulse"))
        layers.push(
          layer(
            ctx,
            "shape.ring-pulse",
            { x: ctx.W / 2 - size, y: cy - size, w: size * 2, h: size * 2 },
            { at: cap === "logo.particles" ? arrive : 6, rings: 2, color: "accent" },
            { z: 30, depth: 0.9 },
          ),
        );
    } else {
      layers.push(
        layer(
          ctx,
          "text.big-word",
          { x: s.x, y: cy - size / 2, w: s.w, h: size },
          { text: ctx.productName, align: "center", uppercase: false, maxSize: 260, exit: "none" },
          { z: 40, depth: 0.9, role: "hero" },
        ),
      );
    }
    const tagline = ctx.text.headline && ctx.text.headline !== ctx.productName ? ctx.text.headline : ctx.text.sub;
    if (tagline) {
      // sub logo, până la marginea de sus a zonelor excluse (butoanele platformei), ca textul centrat să rămână centrat
      const top = cy + size * 0.62;
      const exTop = Math.min(...ctx.safe.exclusions.map((e) => e.y), s.y + s.h);
      const captionTop = ctx.captions ? s.y + s.h - (portrait ? ctx.H * 0.085 : ctx.H * 0.12) : s.y + s.h;
      const h = Math.max(ctx.H * 0.08, Math.min(exTop, captionTop) - top - 8);
      layers.push(
        layer(
          ctx,
          pick(ctx, "text.mask-reveal", "text.word-reveal"),
          { x: s.x, y: top, w: s.w, h: Math.min(h, s.h * 0.34) },
          { text: tagline, emphasis: ctx.text.emphasis, align: "center", maxSize: portrait ? 120 : 104, minSize: 34, stagger: 5 },
          { from: Math.round(ctx.fps * 1.0), z: 50, depth: 0, role: "hero" },
        ),
      );
    }
    return { layers, camera: cam("camera.pull", { from: 1.18, to: 1, end: 0.9, ease: "out" }) };
  },
});
