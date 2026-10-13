/** Rețeta finalului: apelul la acțiune, cu hold-ul minim. */
import { z } from "zod";
import { readableOn } from "../motion/core/color";
import type { Rect } from "../core/schema";
import { buttonRadius, directionBase, frameFor, layer, screenParams } from "./kit";
import { defineRecipe } from "./types";
import { cam, pick } from "./parts";

export const ctaEnd = defineRecipe({
  id: "cta-end",
  title: "Card final cu apel la acțiune",
  description:
    "Logo + CTA (textul exact din brief) pe un buton grafic, adresa sub el; o singură dungă de lumină, apoi hold fără mișcare la momentul deciziei. Centrat conștient.",
  tags: ["cta", "end-card", "logo", "hold", "conversion", "outro"],
  roles: ["cta", "outro"],
  slots: [
    { name: "logo", kind: "logo", required: false },
    { name: "screen", kind: "screenshot", required: false },
  ],
  minSec: 3,
  capabilities: ["logo.reveal", "shape.panel", "text.word-reveal", "text.body", "fx.light-sweep", "media.screen", "mod.reflection", "camera.static"],
  anchor: () => "middle",
  params: z.object({ url: z.string().default("") }),
  build: (ctx, p) => {
    const s = ctx.safe.rect;
    const layers = directionBase(ctx).filter((l) => l.capability !== "fx.particles");
    const logo = ctx.slot("logo") ?? ctx.logo;
    const portrait = ctx.orientation === "portrait";
    const logoSize = Math.min(s.w * 0.3, s.h * (portrait ? 0.14 : 0.24));
    let top = s.y + s.h * (portrait ? 0.14 : 0.08);
    const cta = ctx.text.sub || ctx.text.items[0] || "";
    let bw = Math.min(s.w * (portrait ? 0.9 : 0.5), 960);
    const bh = Math.min(s.h * (portrait ? 0.13 : 0.12), 180);
    // butonul nu stă sub zonele excluse ale platformei (de ex. coloana de acțiuni TikTok): grupul urcă exact cât
    // trebuie, dacă are loc deasupra; altfel butonul se îngustează simetric, ca să rămână centrat
    const btnY = (t: number) => t + logoSize + s.h * 0.04 + s.h * (portrait ? 0.16 : 0.2) + s.h * 0.05;
    for (const ex of ctx.safe.exclusions) {
      const x0 = ctx.W / 2 - bw / 2;
      if (!cta || x0 >= ex.x + ex.w || x0 + bw <= ex.x) continue;
      const y0 = btnY(top);
      if (y0 >= ex.y + ex.h || y0 + bh <= ex.y) continue;
      const up = y0 + bh + 8 - ex.y;
      if (top - up >= s.y) top -= up;
      else bw = Math.max(s.w * 0.4, 2 * Math.min(ctx.W / 2 - (ex.x <= 1 ? ex.x + ex.w + 8 : 0), ex.x + ex.w >= ctx.W - 1 ? ex.x - 8 - ctx.W / 2 : bw / 2));
    }
    if (logo)
      layers.push(
        layer(
          ctx,
          "logo.reveal",
          { x: ctx.W / 2 - logoSize / 2, y: top, w: logoSize, h: logoSize },
          { src: logo.src, mode: "scale", at: 0 },
          { z: 40, depth: 0, role: "support" },
        ),
      );
    const head = ctx.text.headline || ctx.productName;
    const headBox: Rect = { x: s.x, y: top + logoSize + s.h * 0.04, w: s.w, h: s.h * (portrait ? 0.16 : 0.2) };
    layers.push(
      layer(
        ctx,
        pick(ctx, "text.word-reveal", "text.body"),
        headBox,
        { text: head, emphasis: ctx.text.emphasis, align: "center", maxSize: portrait ? 104 : 96, minSize: 36, exit: "none" },
        { from: 6, z: 50, depth: 0, role: "hero" },
      ),
    );
    if (cta) {
      const btn: Rect = { x: ctx.W / 2 - bw / 2, y: headBox.y + headBox.h + s.h * 0.05, w: bw, h: bh };
      layers.push(
        layer(ctx, "shape.panel", btn, { color: "primary", radius: buttonRadius(ctx, bh), from: "scale" }, { from: 12, z: 45, depth: 0, role: "hero" }),
      );
      layers.push(
        layer(
          ctx,
          "text.body",
          { x: btn.x + bh * 0.4, y: btn.y, w: btn.w - bh * 0.8, h: btn.h },
          {
            text: cta,
            emphasis: [],
            font: "display",
            color: readableOn(ctx.palette.primary),
            align: "center",
            maxSize: Math.round(bh * 0.5),
            minSize: 28,
            exit: "none",
            delay: 4,
          },
          { from: 14, z: 46, depth: 0, role: "hero" },
        ),
      );
      if (!ctx.forbidden.includes("fx.light-sweep"))
        layers.push(layer(ctx, "fx.light-sweep", btn, { start: 0, end: 0.9, intensity: 0.5 }, { from: 26, duration: 24, z: 47, depth: 0 }));
      if (p.url)
        layers.push(
          layer(
            ctx,
            "text.body",
            { x: s.x, y: btn.y + btn.h + s.h * 0.03, w: s.w, h: s.h * 0.06 },
            // culoarea principală a textului: fundalul din spate e luminat neuniform (gradient, lumină), iar culoarea
            // estompată cădea sub 4,5:1 pe zonele luminoase; ierarhia o dă mărimea mai mică
            { text: p.url, emphasis: [], color: "text", align: "center", maxSize: 44, minSize: 28, exit: "none" },
            { from: 20, z: 46, depth: 0 },
          ),
        );
    }
    const screen = ctx.slot("screen");
    if (screen) {
      // decor real în partea de jos: intră în primele ~0,6 s, apoi stă nemișcat (hold pe decizie)
      const box: Rect = portrait
        ? { x: ctx.W * 0.08, y: s.y + s.h * 0.86, w: ctx.W * 0.84, h: ctx.H - (s.y + s.h * 0.86) + ctx.H * 0.05 }
        : { x: ctx.W * 0.22, y: s.y + s.h * 0.86, w: ctx.W * 0.56, h: ctx.H * 0.62 };
      layers.push(
        layer(ctx, "media.screen", box, screenParams(screen, { frame: frameFor(screen), shadow: true }, ctx.fps), {
          z: 8,
          depth: 0.8,
          role: "background",
          modifiers: [{ capability: "mod.enter", params: { style: "rise", distance: 260, spring: "soft", exit: "none" } }],
        }),
      );
    }
    return { layers, camera: cam("camera.static", { zoom: 1 }), cues: [{ at: 12, sound: "pop", gainDb: -6, reason: "apariția butonului CTA" }] };
  },
});
