/** Pasa 5 a buclei de calitate: tipografie. */
import { READABLE_TEXT_CAPS } from "../../motion/text-caps";
import type { IssueDraft } from "../issues";
import type { CheckDef } from "../checks";
import { flat } from "./util";

export const TYPOGRAPHY_CHECKS: CheckDef[] = [
  {
    id: "typography.consistency",
    version: 1,
    pass: "typography",
    title: "Consecvența tipografică: familii, mărimi, densitate",
    categories: ["typography"],
    method: "timeline",
    perFormat: true,
    run: (ctx, fid) => {
      const t = ctx.timelines[fid];
      const out: IssueDraft[] = [];
      const texts = t.scenes.flatMap((s) => flat(s.layers).filter((l) => READABLE_TEXT_CAPS.has(l.capability)));
      const families = new Set(texts.map((l) => String(l.params.font ?? "display")));
      const heroSizes = texts.filter((l) => l.role === "hero" && typeof l.params.fontSize === "number").map((l) => Number(l.params.fontSize));
      if (heroSizes.length >= 3) {
        const max = Math.max(...heroSizes);
        const min = Math.min(...heroSizes);
        if (max / min > 3.2)
          out.push({
            frame: null,
            sceneId: null,
            formatId: fid,
            dimension: "typography",
            severity: "low",
            problem: `Titlurile variază de la ${Math.round(min)} la ${Math.round(max)} px (raport ${(max / min).toFixed(1)}).`,
            recommendation: "Păstrează 2–3 mărimi de titlu pe toată reclama, pentru ierarhie consecventă.",
            confidence: 0.55,
          });
      }
      if (families.size > 3)
        out.push({
          frame: null,
          sceneId: null,
          formatId: fid,
          dimension: "typography",
          severity: "low",
          problem: `${families.size} roluri de font diferite pe ecran.`,
          recommendation: "Maximum două familii (titlu + text).",
          confidence: 0.7,
        });
      return out;
    },
  },
];
