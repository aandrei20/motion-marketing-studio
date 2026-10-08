import * as fontkit from "fontkit";
import { publicToAbs } from "../core/paths";
import type { TimelineFont } from "../core/schema";
import type { FontSpec, Measure } from "../motion/core/text-layout";

type FkFont = {
  unitsPerEm: number;
  layout: (t: string) => { advanceWidth: number };
  getVariation?: (v: Record<string, number>) => FkFont;
  variationAxes?: Record<string, unknown>;
};

const cache = new Map<string, FkFont>();

function load(src: string): FkFont {
  const hit = cache.get(src);
  if (hit) return hit;
  const f = fontkit.openSync(publicToAbs(src)) as unknown as FkFont;
  cache.set(src, f);
  return f;
}

/**
 * Măsurare în Node cu fișierele reale ale fonturilor (aceleași pe care le încarcă browserul la randare),
 * pentru validarea textului (mărime, încadrare, zone de siguranță) înainte de randare.
 */
export function nodeMeasure(fonts: TimelineFont[]): Measure {
  const variations = new Map<string, FkFont>();
  return (text: string, spec: FontSpec, size: number) => {
    const tf = fonts.find((f) => f.family === spec.family && f.style === (spec.style ?? "normal")) ?? fonts.find((f) => f.family === spec.family);
    if (!tf) throw new Error(`Fontul „${spec.family}” nu e declarat în timeline.`);
    let font = load(tf.src);
    if (font.variationAxes && "wght" in font.variationAxes && font.getVariation) {
      const key = `${tf.src}@${spec.weight}`;
      let v = variations.get(key);
      if (!v) {
        v = font.getVariation({ wght: spec.weight });
        variations.set(key, v);
      }
      font = v;
    }
    return (font.layout(text).advanceWidth / font.unitsPerEm) * size;
  };
}
