/**
 * Planificatorul de compoziție: unde stă textul principal în fiecare scenă, pe fiecare format.
 *
 * O rețetă declară așezările pe care le suportă (`layouts`, în ordinea preferinței). Pentru o scenă cu
 * `composition: "auto"`, compilatorul alege prima așezare a rețetei al cărei loc al textului diferă de locul
 * textului din scena anterioară; o așezare scrisă explicit în storyboard rămâne neatinsă. Așa textul nu mai stă în
 * același colț în scene la rând (regula 8: eticheta în colț doar ca alegere conștientă), iar alegerea e
 * deterministă: depinde doar de storyboard și de orientarea formatului. Centrul nu e niciodată ales automat.
 */
import type { CompositionKind, ConcreteComposition, Rect } from "../core/schema";
import type { Orientation } from "../core/formats";
import type { RecipeContext } from "./types";

/** Locul textului principal în cadru. */
export type TextAnchor = "top" | "bottom" | "left" | "right" | "middle";

/**
 * Locul textului pentru o așezare: pe orizontal, treimile pun textul în stânga sau în dreapta; pe vertical și pe
 * pătrat, „thirds-left” pune textul sus (materialul dedesubt), „thirds-right” jos (materialul deasupra).
 */
export function anchorOf(comp: CompositionKind, o: Orientation): TextAnchor {
  if (comp === "center") return "middle";
  if (o === "landscape") {
    if (comp === "thirds-right") return "right";
    if (comp === "stacked") return "top";
    if (comp === "full-bleed") return "bottom";
    return "left";
  }
  return comp === "thirds-right" || comp === "full-bleed" ? "bottom" : "top";
}

export interface LayoutRecipe {
  layouts?: ConcreteComposition[];
  anchor?: (comp: ConcreteComposition, o: Orientation) => TextAnchor;
}

/**
 * Așezarea fiecărei scene pe un format. Scenele fără `layouts` în rețetă (dezvăluirea, CTA-ul) își păstrează
 * așezarea proprie (`anchor` spune unde le stă textul), iar locul textului lor contează pentru scena următoare.
 */
export function planCompositions(scenes: Array<{ composition: CompositionKind; recipe: LayoutRecipe }>, o: Orientation): ConcreteComposition[] {
  let prev: TextAnchor | null = null;
  return scenes.map(({ composition, recipe }) => {
    const layouts = recipe.layouts ?? [];
    let comp: ConcreteComposition;
    if (composition !== "auto") comp = composition;
    else if (!layouts.length) comp = "thirds-left";
    else comp = layouts.find((c) => placeOf(recipe, c, o) !== prev) ?? layouts[0];
    prev = placeOf(recipe, comp, o);
    return comp;
  });
}

const placeOf = (recipe: LayoutRecipe, comp: ConcreteComposition, o: Orientation): TextAnchor => (recipe.anchor ?? anchorOf)(comp, o);

/** Așezarea opusă (pentru secvențele de fraze care alternează locul): stânga ↔ dreapta, sus ↔ jos. */
export function opposite(comp: ConcreteComposition): ConcreteComposition {
  if (comp === "thirds-left" || comp === "stacked" || comp === "split") return "thirds-right";
  if (comp === "thirds-right" || comp === "full-bleed") return "thirds-left";
  return comp;
}

/** Marginea de jos până la care poate coborî textul: deasupra benzii subtitrărilor arse. */
export function textBottom(ctx: Pick<RecipeContext, "safe" | "captions" | "orientation" | "H">): number {
  const s = ctx.safe.rect;
  return s.y + s.h - (ctx.captions ? (ctx.orientation === "portrait" ? ctx.H * 0.085 : ctx.H * 0.12) : 0);
}

export interface TextPlacement {
  box: Rect;
  align: "left" | "right" | "center";
  vAlign: "top" | "middle" | "bottom";
}

/**
 * Cutia unui text fără material alături (hook, secvențe de fraze, problema, dovada), după așezare. „thirds-left”
 * = textul în partea de sus, aliniat la stânga (poziția clasică); „thirds-right” = jos pe vertical și pe pătrat
 * (aliniat la stânga, lipit de marginea de jos), în dreapta pe orizontal (aliniat la dreapta); „center” = centrat,
 * doar când e ales explicit. `room` = cât din înălțimea zonei sigure rămâne sub text pentru un subtitlu.
 */
export function textOnlyPlacement(ctx: RecipeContext, comp: ConcreteComposition, o: { room?: number } = {}): TextPlacement {
  const s = ctx.safe.rect;
  const room = (o.room ?? 0) * s.h;
  const r = (x: number, y: number, w: number, h: number): Rect => ({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });
  const anchor = anchorOf(comp, ctx.orientation);
  if (anchor === "middle") return { box: r(s.x + s.w * 0.08, s.y + s.h * 0.24, s.w * 0.84, s.h * 0.42), align: "center", vAlign: "middle" };
  if (ctx.orientation === "landscape") {
    if (anchor === "right") return { box: r(s.x + s.w * 0.22, s.y + s.h * 0.16, s.w * 0.78, s.h * 0.56 - room), align: "right", vAlign: "middle" };
    if (anchor === "bottom") {
      const bottom = textBottom(ctx) - room;
      return { box: r(s.x, s.y + s.h * 0.42, s.w * 0.78, bottom - (s.y + s.h * 0.42)), align: "left", vAlign: "bottom" };
    }
    return { box: r(s.x, s.y + s.h * 0.16, s.w * 0.78, s.h * 0.56 - room), align: "left", vAlign: "middle" };
  }
  if (anchor === "bottom") {
    const top = s.y + s.h * 0.4;
    return { box: r(s.x, top, s.w, textBottom(ctx) - room - top), align: "left", vAlign: "bottom" };
  }
  return { box: r(s.x, s.y + s.h * 0.16, s.w, s.h * 0.46 - room), align: "left", vAlign: "middle" };
}
