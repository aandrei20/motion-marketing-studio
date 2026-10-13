/** Rețetele cu interfața reală: spotlight, turul pașilor, montajul de funcții, derularea, dispozitivul, stiva 3D, înainte/după. */
import { z } from "zod";
import { readingSec } from "../editing/grammar";
import { screenPointToBox } from "../motion/media/media";
import type { Rect, TimelineLayer } from "../core/schema";
import {
  afterPush,
  bestRegion,
  calloutSide,
  cardRadius,
  clearOfText,
  directionBase,
  intersect,
  layer,
  limitZoomForText,
  mediaBounds,
  norm,
  padRect,
  focusCrop,
  regionFocus,
  revealRegion,
  screenParams,
  screenRectInScene,
  textHugsMedia,
  textTolerance,
  usedPart,
  zones,
} from "./kit";
import { anchorOf } from "./layout";
import { defineRecipe, type RecipeContext, type RecipeCue } from "./types";
import { cam, headline, pick, readingSegments, subline } from "./parts";

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
  layouts: ["thirds-left", "thirds-right"],
  params: z.object({ callout: z.boolean().default(true), zoom: z.number().min(0).max(1).default(0.75) }),
  build: (ctx, p) => {
    const z0 = zones(ctx);
    const layers = directionBase(ctx);
    const a = ctx.slot("screen")!;
    const region = ctx.focusRegion ?? bestRegion(a.regions, `${ctx.text.headline} ${ctx.text.sub}`);
    const textRects = [z0.text, z0.sub];
    // zoom-ul dorit, limitat ca materialul mărit să nu intre peste titlu; dacă limita lasă un zoom neglijabil,
    // camera nu mai traversează captura spre zonă (ar goli cadrul), ci face doar un push lent pe centru
    const push = (sp: Record<string, unknown>, cropped: boolean) => {
      const focus = region ? regionFocus(ctx, z0.media, sp, region) : undefined;
      const wanted = focus ? 1 + (focus.zoom - 1) * p.zoom * (cropped ? 0.25 : 1) : 1.08;
      const limited = focus ? limitZoomForText(screenRectInScene(sp, z0.media), focus, focus.target, wanted, textRects, textTolerance(ctx)) : wanted;
      const aimAtRegion = !!focus && (limited >= 1.15 || wanted < 1.15);
      return { focus, aimAtRegion, to: aimAtRegion ? limited : 1.06 };
    };
    const whole = screenParams(a, { shadow: true });
    Object.assign(whole, revealRegion(whole, region, z0.media));
    // decupajul se face pe vertical sau când push-ul pe captura întreagă nu face interfața lizibilă
    const crop = focusCrop(ctx, a, z0.media, region, push(whole, false).to);
    const sp = crop ? screenParams(a, { shadow: true, crop, frame: "none", radius: cardRadius(ctx) }) : whole;
    const children: TimelineLayer[] = [];
    const t1 = Math.round(ctx.duration * 0.28);
    const { focus, aimAtRegion, to } = push(sp, !!crop);
    const screenRect = screenRectInScene(sp, z0.media);
    const center = { x: ctx.W / 2, y: ctx.H / 2 };
    if (region && focus) {
      const full = { x: 0, y: 0, w: a.w, h: a.h };
      children.push(layer(ctx, "ui.spotlight", full, { region: padRect(region.rect, 0), dim: 0.6, padding: 14 }, { from: t1 }));
      children.push(layer(ctx, "ui.highlight", region.rect, { shape: "rect", color: "accent", padding: 14 }, { from: t1 + 4 }));
      const label = ctx.text.items[0] ?? "";
      if (p.callout && label) {
        // partea callout-ului se alege după locul zonei pe ecran la finalul push-ului: zona ajunge în ținta camerei,
        // mărită de zoom; callout-ul nu iese din cadru și nu atinge titlul sau subtitrările
        const k = screenPointToBox(sp as never, z0.media, { x: region.rect.x, y: region.rect.y }).k;
        const inScene = { x: focus.x - (region.rect.w * k) / 2, y: focus.y - (region.rect.h * k) / 2, w: region.rect.w * k, h: region.rect.h * k };
        const [from, aimAt] = aimAtRegion ? [focus, focus.target] : [center, center];
        const onScreen = afterPush(inScene, from, aimAt, to);
        const distance = crop ? 70 : 120;
        // elementele de peste captură se decupează la marginea ei: callout-ul trebuie să încapă și în captura vizibilă;
        // eticheta are aceeași mărime pe ecran la orice zoom (scara 1)
        const bounds = intersect(mediaBounds(ctx, z0), afterPush(screenRect, from, aimAt, to)) ?? mediaBounds(ctx, z0);
        const side = calloutSide(onScreen, 1, label, {
          distance,
          size: 38,
          bounds,
          prefer: crop && ctx.orientation === "portrait" ? ["top", "bottom", "right", "left"] : ["right", "left", "top", "bottom"],
        });
        children.push(layer(ctx, "ui.callout", region.rect, { text: label, side, distance }, { from: t1 + 10 }));
      }
    }
    const screenLayer = layer(ctx, "media.screen", z0.media, sp, {
      z: 20,
      role: "hero",
      children,
      modifiers: [{ capability: "mod.enter", params: { style: "rise", distance: 160, spring: "soft", exit: "none" } }],
    });
    layers.push(screenLayer);
    const h = headline(ctx, z0.text);
    if (h) layers.push(h);
    const sub = subline(ctx, z0.sub, 8);
    if (sub) layers.push(sub);
    // zoom-ul din focus e cel limitat: o cameră aleasă altfel (editor, corectură automată) nu trece de el
    return {
      layers,
      camera: cam("camera.push", { from: 1, to, start: 0.22, end: 0.85, ease: "inOut" }),
      focus: aimAtRegion && focus ? { ...focus, zoom: to } : undefined,
    };
  },
});

/** Contextul rețetei fără consumul id-urilor: măsoară un strat fără să schimbe id-urile (și sămânța) celorlalte. */
const probe = (ctx: RecipeContext): RecipeContext => ({ ...ctx, uid: () => "probă" });
const measure = (l: TimelineLayer | null): Rect[] => (l ? [l.box] : []);

/**
 * Push spre o zonă, cu zoom limitat ca materialul să nu intre peste text. Dacă limita lasă un zoom neglijabil,
 * camera nu mai țintește zona (ar traversa captura și ar goli cadrul): push lent pe centru.
 */
function pushClearOfText(
  sp: Record<string, unknown>,
  box: Rect,
  f: ReturnType<typeof regionFocus>,
  wanted: number,
  text: Rect[],
  tol = 24,
): { to: number; focus?: ReturnType<typeof regionFocus> } {
  const to = limitZoomForText(screenRectInScene(sp, box), f, f.target, wanted, text, tol);
  return to >= 1.15 || wanted < 1.15 ? { to, focus: { ...f, zoom: to } } : { to: 1.06 };
}

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
  layouts: ["thirds-left", "thirds-right"],
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
      const hBox = measure(headline(probe(ctx), z0.text));
      const whole = { ...sp, ...revealRegion(sp, ctx.focusRegion, z0.media) };
      const f0 = ctx.focusRegion ? regionFocus(ctx, z0.media, whole, ctx.focusRegion, 0.5) : undefined;
      const push0 = f0 ? pushClearOfText(whole, z0.media, f0, 1 + (f0.zoom - 1) * 0.6, hBox, textTolerance(ctx)) : null;
      const crop = focusCrop(ctx, a, z0.media, ctx.focusRegion, push0?.to ?? 1);
      Object.assign(sp, crop ? { crop, frame: "none", radius: cardRadius(ctx) } : whole);
      const screenLayer = layer(ctx, "media.screen", z0.media, sp, {
        z: 20,
        role: "hero",
        modifiers: [{ capability: "mod.enter", params: { style: "scale", spring: "soft", exit: "none" } }],
      });
      layers.push(screenLayer);
      const h = headline(ctx, z0.text);
      if (h) layers.push(h);
      const push = crop ? null : push0;
      return {
        layers,
        camera: push?.focus ? cam("camera.push", { from: 1, to: push.to, start: 0.1, end: 0.6 }) : cam("camera.push", { from: 1, to: 1.08, ease: "linear" }),
        focus: push?.focus,
      };
    }
    if (p.drag) {
      const from = a.regions.find((r) => r.id === p.drag!.from);
      const target0 = a.regions.find((r) => r.id === p.drag!.to);
      if (from && target0) {
        // cardul ajunge sus în coloana-țintă; zona demonstrată e partea ei cu conținut, plus locul cardului
        const landing = { x: target0.rect.x + (target0.rect.w - from.rect.w) / 2, y: target0.rect.y + Math.min(90, target0.rect.h * 0.08) };
        const to = usedPart(a.regions, target0, [{ ...landing, w: from.rect.w, h: from.rect.h }]);
        const union = {
          id: "union",
          label: "",
          kind: "custom" as const,
          rect: {
            x: Math.min(from.rect.x, to.rect.x),
            y: Math.min(from.rect.y, to.rect.y),
            w: Math.max(from.rect.x + from.rect.w, to.rect.x + to.rect.w) - Math.min(from.rect.x, to.rect.x),
            h: Math.max(from.rect.y + from.rect.h, to.rect.y + to.rect.h) - Math.min(from.rect.y, to.rect.y),
          },
        };
        const hBox = measure(headline(probe(ctx), z0.text, { maxSize: 110 }));
        const whole = { ...sp, ...revealRegion(sp, union, z0.media) };
        const f0 = regionFocus(ctx, z0.media, whole, union, 0.6);
        const push0 = pushClearOfText(whole, z0.media, f0, 1 + (f0.zoom - 1) * 0.6, hBox, textTolerance(ctx));
        const crop = focusCrop(ctx, a, z0.media, union, push0.to);
        Object.assign(sp, crop ? { crop, frame: "none", radius: cardRadius(ctx) } : whole);
        const pick = Math.round(ctx.fps * 0.5);
        const drop = Math.round(ctx.duration * 0.62);
        const target = landing;
        const grab = { x: from.rect.x + from.rect.w * 0.3, y: from.rect.y + from.rect.h * 0.4 };
        const children: TimelineLayer[] = [
          layer(
            ctx,
            "ui.drag",
            { x: 0, y: 0, w: a.w, h: a.h },
            { src: a.src, imageWidth: a.w, imageHeight: a.h, from: from.rect, to: target, at: pick, dropAt: drop },
          ),
          layer(
            ctx,
            "ui.highlight",
            { ...to.rect },
            { shape: "rect", color: "accent", padding: 6, drawFrames: 10 },
            { from: Math.round(pick + (drop - pick) * 0.55), duration: Math.round((drop - pick) * 0.6) },
          ),
          layer(
            ctx,
            "ui.cursor",
            { x: 0, y: 0, w: a.w, h: a.h },
            {
              path: [
                { at: 0, x: grab.x - 160, y: grab.y + 220, click: false },
                { at: pick, x: grab.x, y: grab.y, click: true },
                { at: drop, x: target.x + (grab.x - from.rect.x), y: target.y + (grab.y - from.rect.y), click: true },
              ],
              size: 30,
            },
            { z: 99 },
          ),
        ];
        layers.push(
          layer(ctx, "media.screen", z0.media, sp, {
            z: 20,
            role: "hero",
            children,
            modifiers: [{ capability: "mod.enter", params: { style: "scale", spring: "soft", exit: "none" } }],
          }),
        );
        const h = headline(ctx, z0.text, { maxSize: 110 });
        if (h) layers.push(h);
        const push = crop ? null : push0;
        return {
          layers,
          camera: push?.focus ? cam("camera.push", { from: 1, to: push.to, start: 0.05, end: 0.5 }) : cam("camera.push", { from: 1, to: 1.06, ease: "linear" }),
          focus: push?.focus,
        };
      }
    }
    const named = p.regions.map((id) => a.regions.find((r) => r.id === id)).filter((r): r is NonNullable<typeof r> => !!r);
    const input = a.regions.find((r) => r.kind === "input");
    let picks = named.length
      ? named
      : [
          ctx.focusRegion ?? input ?? bestRegion(a.regions, ctx.text.headline),
          bestRegion(a.regions, ctx.text.items.join(" ") || ctx.text.sub, ["button", "custom"]),
        ].filter((r, i, arr): r is NonNullable<typeof r> => !!r && arr.findIndex((x) => x?.id === r.id) === i);
    if (picks.length) {
      const xs = picks.flatMap((r) => [r.rect.x, r.rect.x + r.rect.w]);
      const ys = picks.flatMap((r) => [r.rect.y, r.rect.y + r.rect.h]);
      const union = {
        id: "union",
        label: "",
        kind: "custom" as const,
        rect: { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) },
      };
      // fără decupaj, pagina se derulează la rândurile zonelor, iar camera urmărește fiecare zonă cu zoom-ul ei
      const rows = { id: "union", label: "", kind: "custom" as const, rect: { x: 0, y: union.rect.y, w: a.w, h: union.rect.h } };
      const whole = { ...sp, ...revealRegion(sp, rows, z0.media) };
      const camZoom = Math.max(...picks.map((r) => 1 + (regionFocus(ctx, z0.media, whole, r, 0.5).zoom - 1) * 0.7));
      let crop = focusCrop(ctx, a, z0.media, union, camZoom);
      const shows = (c: Rect, r: (typeof picks)[number]) =>
        r.rect.x >= c.x && r.rect.y >= c.y && r.rect.x + r.rect.w <= c.x + c.w && r.rect.y + r.rect.h <= c.y + c.h;
      if (crop && !picks.every((r) => shows(crop!, r))) {
        // zonele nu încap împreună în decupaj (de ex. un câmp în stânga și un buton în dreapta, pe vertical):
        // decupajul urmează prima zonă, iar cursorul le vizitează doar pe cele care se văd întregi
        crop = focusCrop(ctx, a, z0.media, picks[0], camZoom);
        if (crop) picks = [picks[0], ...picks.slice(1).filter((r) => shows(crop!, r))];
      }
      Object.assign(sp, crop ? { crop, frame: "none", radius: cardRadius(ctx) } : whole);
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
      children.push(
        layer(
          ctx,
          "ui.highlight",
          r.rect,
          { shape: "rect", color: "accent", padding: 10, drawFrames: 10 },
          { from: arrive + 4, duration: Math.max(8, seg - 4) },
        ),
      );
      if (r.kind === "input" && p.typeText)
        children.push(
          layer(
            ctx,
            "ui.typing",
            { x: r.rect.x + r.rect.h * 0.9, y: r.rect.y, w: r.rect.w - r.rect.h * 1.4, h: r.rect.h },
            { text: p.typeText, at: 6, color: "text", sizeRatio: 0.34, paddingRatio: 0.05, font: "body" },
            { from: arrive + 4 },
          ),
        );
      const f = regionFocus(ctx, z0.media, sp, r, 0.5);
      const z = 1 + (f.zoom - 1) * 0.7;
      // punctul de interes ajunge în centrul zonei media, nu sub titlu
      const t = f.target ?? { x: ctx.W / 2, y: ctx.H / 2 };
      points.push({
        at: Math.min(0.95, (arrive + 4) / ctx.duration),
        x: (f.x + (ctx.W / 2 - t.x) / z) / ctx.W,
        y: (f.y + (ctx.H / 2 - t.y) / z) / ctx.H,
        zoom: z,
      });
    });
    children.push(layer(ctx, "ui.cursor", { x: 0, y: 0, w: a.w, h: a.h }, { path, size: 30 }, { z: 99 }));
    layers.push(
      layer(ctx, "media.screen", z0.media, sp, {
        z: 20,
        role: "hero",
        children,
        modifiers: [{ capability: "mod.enter", params: { style: "scale", spring: "soft", exit: "none" } }],
      }),
    );
    const h = headline(ctx, z0.text, { maxSize: 90 });
    if (h) layers.push(h);
    // camera urmărește zonele, dar captura nu trece pe sub titlu
    const material = screenRectInScene(sp, z0.media);
    const text = h ? [h.box] : [];
    const safePoints = points.map((pt) => {
      const c = clearOfText({ x: pt.x * ctx.W, y: pt.y * ctx.H }, pt.zoom, material, text, ctx.W, ctx.H, textTolerance(ctx));
      return { ...pt, x: c.x / ctx.W, y: c.y / ctx.H };
    });
    return { layers, camera: cam("camera.focus-track", { points: safePoints, normalized: true }) };
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
  layouts: ["thirds-left", "thirds-right"],
  // pe orizontal, montajul pune textul sus și materialul mare dedesubt, oricare ar fi așezarea
  anchor: (c, o) => (o === "landscape" ? "top" : anchorOf(c, o)),
  params: z.object({ maxCuts: z.number().int().min(2).max(6).default(4) }),
  build: (ctx, p) => {
    const z0 = zones(ctx, ctx.orientation === "landscape" ? "stacked" : ctx.scene.composition);
    const layers = directionBase(ctx);
    const screens = ctx.slots("screens");
    const items = ctx.text.items.length ? ctx.text.items : [ctx.text.headline];
    const n = Math.min(p.maxCuts, Math.max(items.length, 2));
    const starts = readingSegments(
      ctx,
      Array.from({ length: n }, (_, i) => items[i] ?? ""),
    );
    const cues: RecipeCue[] = [];
    const used = new Set<string>();
    const pickFor = (text: string, i: number) => {
      const words = norm(text)
        .split(/\s+/)
        .filter((w) => w.length > 3);
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
      layers.push(
        layer(ctx, "media.screen", z0.media, screenParams(a, { crop, frame: "none", radius: cardRadius(ctx, 0.8) }), {
          from,
          duration: dur,
          z: 20,
          role: "hero",
          modifiers: [{ capability: "mod.enter", params: { style: "scale", spring: "pop", exit: "none", motionBlur: true } }],
        }),
      );
      if (items[i])
        layers.push(
          layer(
            ctx,
            pick(ctx, ctx.dir.text.list, "text.word-reveal"),
            z0.text,
            {
              text: items[i],
              emphasis: ctx.text.emphasis,
              maxSize: 110,
              minSize: 34,
              align: "left",
              vAlign: textHugsMedia(ctx) ? "top" : "middle",
              exitFrames: 3,
            },
            { from, duration: dur, z: 50, depth: 0, role: "hero" },
          ),
        );
      if (i > 0) cues.push({ at: from, sound: "whoosh-fast", gainDb: -6, reason: "tăietură în montaj" });
    }
    return { layers, camera: cam("camera.beat-punch", { hits: starts, amount: 0.05 }), cues };
  },
});

export const scrollTour = defineRecipe({
  id: "scroll-tour",
  title: "Tur prin pagină (scroll real)",
  description: "O captură de pagină întreagă într-o ramă de browser, derulată lin de sus până la o zonă-țintă. Ca dezvăluire, logo-ul stă deasupra titlului.",
  tags: ["scroll", "website", "landing", "tour", "browser", "establishing"],
  roles: ["feature", "demo", "reveal", "solution"],
  slots: [{ name: "page", kind: "tall-screenshot", required: true }],
  minSec: 2.5,
  capabilities: ["media.screen", "camera.push", "text.word-reveal", "logo.reveal"],
  layouts: ["thirds-left", "thirds-right"],
  params: z.object({ to: z.number().min(0).max(1).default(0.45) }),
  build: (ctx, p) => {
    const z0 = zones(ctx);
    const layers = directionBase(ctx);
    const a = ctx.slot("page")!;
    const vp = a.asset.capture?.viewport;
    const visibleH = vp ? (vp.height / vp.width) * a.w : a.w * 0.6;
    const target = ctx.focusRegion ? Math.max(0, ctx.focusRegion.rect.y - visibleH * 0.2) : (a.h - visibleH) * p.to;
    layers.push(
      layer(
        ctx,
        "media.screen",
        z0.media,
        screenParams(a, { frame: "browser", scroll: { from: 0, to: Math.max(0, Math.min(a.h - visibleH, target)), start: 0.15, end: 0.85, ease: "inOut" } }),
        { z: 20, role: "hero", modifiers: [{ capability: "mod.enter", params: { style: "rise", spring: "soft", exit: "none" } }] },
      ),
    );
    // ca dezvăluire: logo-ul deasupra titlului, aliniat cu el (cutia are proporțiile logo-ului, scară uniformă)
    let textBox = z0.text;
    const logo = ctx.scene.narrativeRole === "reveal" && !ctx.forbidden.includes("logo.reveal") ? ctx.logo : null;
    if (logo) {
      const ratio = logo.w / Math.max(1, logo.h);
      const lh = Math.min(z0.text.h * 0.28, ctx.H * 0.08, z0.text.w / Math.max(0.01, ratio));
      const gap = lh * 0.35;
      layers.push(
        layer(
          ctx,
          "logo.reveal",
          { x: z0.text.x, y: z0.text.y, w: lh * ratio, h: lh },
          { src: logo.src, mode: "rise", at: 2 },
          { z: 51, depth: 0, role: "support" },
        ),
      );
      textBox = { ...z0.text, y: z0.text.y + lh + gap, h: Math.max(z0.text.h * 0.5, z0.text.h - lh - gap) };
    }
    const h = headline(ctx, textBox);
    if (h) layers.push(h);
    const sub = subline(ctx, z0.sub, 8);
    if (sub) layers.push(sub);
    return {
      layers,
      camera: cam("camera.push", { from: 1, to: 1.06, ease: "linear" }),
      cues: [{ at: Math.round(ctx.duration * 0.15), sound: "whoosh-soft", gainDb: -10, reason: "începutul scroll-ului" }],
    };
  },
});

export const deviceHero = defineRecipe({
  id: "device-hero",
  title: "Dispozitiv 3D cu aplicația",
  description:
    "Un telefon sau laptop generic se rotește lent în 3D cu captura reală pe ecran, lumini difuze în spate. Pentru aplicații mobile și momente-hero.",
  tags: ["device", "3d", "phone", "mobile-app", "hero", "premium"],
  roles: ["reveal", "feature", "solution"],
  slots: [{ name: "screen", kind: "screenshot", required: true }],
  minSec: 2.2,
  capabilities: ["media.device-3d", "fx.glow-orbs", "camera.parallax-drift", "mod.reflection"],
  layouts: ["thirds-left", "thirds-right"],
  params: z.object({ device: z.enum(["auto", "phone", "laptop"]).default("auto") }),
  build: (ctx, p) => {
    const z0 = zones(ctx);
    const layers = directionBase(ctx);
    const a = ctx.slot("screen")!;
    const device = p.device === "auto" ? ((a.asset.capture?.viewport.width ?? a.w) < 600 || a.w / a.h < 0.7 ? "phone" : "laptop") : p.device;
    if (!ctx.forbidden.includes("fx.glow-orbs"))
      layers.push(
        layer(
          ctx,
          "fx.glow-orbs",
          { x: 0, y: 0, w: ctx.W, h: ctx.H },
          { colors: ["primary", "accent"], intensity: 0.4, size: 0.7 },
          { z: 3, depth: 0.5, role: "background" },
        ),
      );
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
  anchor: (_c, o) => (o === "portrait" ? "top" : "bottom"),
  params: z.object({}),
  build: (ctx) => {
    const z0 = zones(ctx, ctx.orientation === "portrait" ? "stacked" : "full-bleed");
    const layers = directionBase(ctx);
    const srcs = ctx.slots("screens").map((s) => s.src);
    layers.push(
      layer(
        ctx,
        "media.stack-3d",
        { x: 0, y: 0, w: ctx.W, h: ctx.H },
        { srcs: srcs.length >= 2 ? srcs : [...srcs, ...srcs].slice(0, 3) },
        { z: 20, depth: 1, role: "hero" },
      ),
    );
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
  slots: [
    { name: "before", kind: "image", required: true },
    { name: "after", kind: "image", required: true },
  ],
  minSec: 2.5,
  capabilities: ["media.compare", "text.word-reveal"],
  layouts: ["thirds-left", "thirds-right"],
  params: z.object({}),
  build: (ctx) => {
    const z0 = zones(ctx);
    const layers = directionBase(ctx);
    const b = ctx.slot("before")!;
    const a = ctx.slot("after")!;
    layers.push(
      layer(
        ctx,
        "media.compare",
        z0.media,
        {
          before: b.src,
          after: a.src,
          beforeLabel: ctx.text.items[0] ?? "",
          afterLabel: ctx.text.items[1] ?? "",
          startFrame: Math.round(ctx.fps * 0.6),
          frames: Math.round(ctx.fps * 1.2),
        },
        { z: 20, role: "hero" },
      ),
    );
    const h = headline(ctx, z0.text);
    if (h) layers.push(h);
    return { layers, camera: cam("camera.static", { zoom: 1 }) };
  },
});
