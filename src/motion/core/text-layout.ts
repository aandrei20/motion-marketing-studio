/**
 * Așezarea textului într-o cutie: încadrare pe rânduri + mărimea maximă care încape.
 * Același algoritm rulează în Node (măsurare cu fontkit, pentru validare) și în browser
 * (măsurare cu canvas, dacă timeline-ul nu are deja rândurile calculate).
 */

export interface FontSpec {
  family: string;
  weight: number;
  /** spațiere între litere, în em */
  tracking: number;
  uppercase: boolean;
  style?: "normal" | "italic";
}

export type Measure = (text: string, font: FontSpec, sizePx: number) => number;

export interface TextLayout {
  lines: string[];
  fontSize: number;
  lineHeight: number;
  width: number;
  height: number;
  /** true dacă nici la mărimea minimă textul nu încape în cutie */
  overflow: boolean;
}

export interface LayoutOptions {
  maxSize: number;
  minSize: number;
  lineHeight?: number;
  maxLines?: number;
  /** marjă de siguranță pentru diferențele de kerning între motoare */
  safety?: number;
}

export function applyCase(text: string, font: FontSpec): string {
  return font.uppercase ? text.toLocaleUpperCase("ro") : text;
}

function measureLine(measure: Measure, text: string, font: FontSpec, size: number): number {
  const base = measure(text, font, size);
  const chars = [...text].length;
  return base + Math.max(0, chars - 1) * font.tracking * size;
}

function wrap(measure: Measure, text: string, font: FontSpec, size: number, maxWidth: number): { lines: string[]; widest: number; brokeWord: boolean } {
  const out: string[] = [];
  let widest = 0;
  let brokeWord = false;
  for (const para of text.split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    let line = "";
    for (const w of words) {
      const candidate = line ? `${line} ${w}` : w;
      if (measureLine(measure, candidate, font, size) <= maxWidth || !line) {
        line = candidate;
        if (!out.length && measureLine(measure, w, font, size) > maxWidth) brokeWord = true;
      } else {
        out.push(line);
        line = w;
      }
      if (measureLine(measure, w, font, size) > maxWidth) brokeWord = true;
    }
    out.push(line);
  }
  for (const l of out) widest = Math.max(widest, measureLine(measure, l, font, size));
  return { lines: out, widest, brokeWord };
}

export function layoutText(
  rawText: string,
  font: FontSpec,
  box: { w: number; h: number },
  measure: Measure,
  opts: LayoutOptions,
): TextLayout {
  const text = applyCase(rawText, font);
  const lh = opts.lineHeight ?? 1.08;
  const safety = opts.safety ?? 0.97;
  const maxW = box.w * safety;
  const fits = (size: number) => {
    const r = wrap(measure, text, font, size, maxW);
    const height = r.lines.length * size * lh;
    const ok = !r.brokeWord && r.widest <= maxW && height <= box.h && (!opts.maxLines || r.lines.length <= opts.maxLines);
    return { ok, r, height };
  };
  let lo = Math.floor(opts.minSize);
  let hi = Math.floor(opts.maxSize);
  if (!fits(lo).ok) {
    const r = fits(lo);
    return { lines: r.r.lines, fontSize: lo, lineHeight: lh, width: r.r.widest, height: r.height, overflow: true };
  }
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (fits(mid).ok) lo = mid;
    else hi = mid - 1;
  }
  const best = fits(lo);
  return { lines: best.r.lines, fontSize: lo, lineHeight: lh, width: best.r.widest, height: best.height, overflow: false };
}

let canvasCtx: CanvasRenderingContext2D | null = null;
/** Măsurare în browser (după ce fonturile s-au încărcat). */
export const browserMeasure: Measure = (text, font, size) => {
  if (!canvasCtx) {
    const c = document.createElement("canvas");
    canvasCtx = c.getContext("2d");
  }
  if (!canvasCtx) return text.length * size * 0.55;
  canvasCtx.font = `${font.style === "italic" ? "italic " : ""}${font.weight} ${size}px "${font.family}"`;
  return canvasCtx.measureText(text).width;
};
