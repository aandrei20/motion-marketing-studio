/** Piesele comune ale rețetelor: titlul și subtitlul măsurate, camera, segmentele de citire, loviturile pe beat. */
import { readingSec } from "../editing/grammar";
import type { Rect, TimelineLayer } from "../core/schema";
import { layer, textHugsMedia, textParams } from "./kit";
import type { RecipeContext } from "./types";

export const cam = (capability: string, params: Record<string, unknown> = {}) => ({ capability, params });
export const pick = (ctx: RecipeContext, id: string, fallback: string) => (ctx.forbidden.includes(id) ? fallback : id);

/**
 * Animația titlului: cea obișnuită a direcției, iar pe scenele cu energie mare (≥ 0,8, în afara CTA-ului) animația
 * de impact a aceleiași direcții (a hook-ului sau a listelor, alta decât cea obișnuită; mașina de scris nu, fiindcă
 * întârzie citirea). Textul variază între scene după arcul de energie, fără să iasă din stilul direcției.
 */
export function headlineAnimation(ctx: RecipeContext): string {
  const base = ctx.dir.text.headline;
  if (ctx.energy < 0.8 || ctx.scene.narrativeRole === "cta") return base;
  return [ctx.dir.text.hook, ctx.dir.text.list, "text.mask-reveal"].find((c) => c !== base && c !== "text.typewriter" && c !== "text.body") ?? base;
}

export function headline(
  ctx: RecipeContext,
  box: Rect,
  opts: {
    capability?: string;
    from?: number;
    maxSize?: number;
    align?: "left" | "center" | "right";
    vAlign?: "top" | "middle" | "bottom";
    exit?: "snap" | "none";
    uppercase?: boolean;
    text?: string;
  } = {},
): TimelineLayer | null {
  const t = opts.text ?? ctx.text.headline;
  if (!t) return null;
  const capability = pick(ctx, opts.capability ?? headlineAnimation(ctx), "text.word-reveal");
  const short = t.split(/\s+/).length <= 3;
  // sub material (vertical, „thirds-right”), titlul stă lipit de material, nu în mijlocul cutiei
  const vAlign = opts.vAlign ?? (textHugsMedia(ctx) ? "top" : undefined);
  return layer(
    ctx,
    capability,
    box,
    textParams(ctx, t, {
      maxSize: opts.maxSize ?? (ctx.orientation === "portrait" ? (short ? 170 : 130) : short ? 150 : 116),
      minSize: 34,
      align: opts.align ?? "left",
      ...(vAlign ? { vAlign } : {}),
      exit: opts.exit ?? "snap",
      uppercase: opts.uppercase,
    }),
    { from: opts.from ?? 0, z: 50, depth: 0, role: "hero" },
  );
}

export function subline(ctx: RecipeContext, box: Rect, from: number, text = ctx.text.sub, align: "left" | "center" | "right" = "left"): TimelineLayer | null {
  if (!text) return null;
  return layer(
    ctx,
    "text.body",
    box,
    { text, emphasis: [], maxSize: ctx.orientation === "portrait" ? 52 : 46, minSize: 30, color: "textMuted", align, delay: 0 },
    { from, z: 49, depth: 0, role: "support" },
  );
}

/** Împarte durata scenei între elemente proporțional cu timpul lor de citire (cadre de start). */
export function readingSegments(ctx: RecipeContext, items: string[]): number[] {
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

export function beatHits(ctx: RecipeContext): number[] {
  return ctx.beats.length ? ctx.beats : Array.from({ length: Math.floor(ctx.duration / 15) }, (_, i) => i * 15);
}
