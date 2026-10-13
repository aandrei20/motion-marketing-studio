/** Pasa 2 a buclei de calitate: vizual (pe pixeli și pe geometria timeline-ului). */
import type { Timeline, TimelineLayer } from "../../core/schema";
import { READABLE_TEXT_CAPS } from "../../motion/text-caps";
import type { IssueDraft } from "../issues";
import type { CheckDef } from "../checks";
import { flat, sec } from "./util";

const H_NAMES = { left: "stânga", center: "centru", right: "dreapta" } as const;
const V_NAMES = { top: "sus", middle: "mijloc", bottom: "jos" } as const;

/**
 * Locul pe ecran al unui text: treimea verticală a zonei sigure în care îi cade centrul blocului de rânduri
 * (măsurat cu rândurile și mărimea calculate de compilator) și partea orizontală (alinierea, sau partea cadrului
 * în care stă cutia: un text aliniat la stânga în jumătatea dreaptă e „dreapta”).
 */
export function textPlace(t: Pick<Timeline, "width" | "height" | "safeZone">, l: TimelineLayer): string {
  const p = l.params as { lines?: string[]; fontSize?: number; lineHeight?: number; vAlign?: string; align?: string };
  const th = Math.min(l.box.h, (p.lines?.length ?? 1) * (p.fontSize ?? l.box.h) * (p.lineHeight ?? 1.04));
  const top = p.vAlign === "top" ? l.box.y : p.vAlign === "bottom" ? l.box.y + l.box.h - th : l.box.y + (l.box.h - th) / 2;
  const s = { y: t.safeZone.top, h: t.height - t.safeZone.top - t.safeZone.bottom };
  const k = (top + th / 2 - s.y) / Math.max(1, s.h);
  const v = k < 1 / 3 ? "top" : k < 2 / 3 ? "middle" : "bottom";
  const cx = (l.box.x + l.box.w / 2) / t.width;
  const h = p.align === "center" ? "center" : cx < 0.45 ? "left" : cx > 0.55 ? "right" : p.align === "right" ? "right" : "left";
  return `${V_NAMES[v]}-${H_NAMES[h]}`;
}

export const VISUAL_CHECKS: CheckDef[] = [
  {
    id: "visual.pixels",
    version: 1,
    pass: "visual",
    title: "Cadre-cheie randate: contrast real al textului, compoziție, spațiu gol, aglomerare",
    categories: ["visual", "typography"],
    method: "stills",
    perFormat: true,
    run: async (ctx, fid) => (await ctx.services.stills(fid)).flatMap((r) => r.issues),
  },
  {
    id: "visual.text-placement",
    version: 1,
    pass: "visual",
    title: "Locul textului principal: nu stă în același loc în scene la rând",
    // geometria singură nu evaluează categoria vizuală (aceea cere pixelii): problemele găsite intră totuși în scor
    categories: [],
    method: "timeline",
    perFormat: true,
    run: (ctx, fid) => {
      const t = ctx.timelines[fid];
      const out: IssueDraft[] = [];
      // locurile textelor principale din fiecare scenă, în ordinea apariției (CTA-ul are așezarea lui, centrată conștient)
      const scenes = t.scenes
        .filter((s) => s.meta.narrativeRole !== "cta")
        .map((s) => ({
          s,
          places: [
            ...new Set(
              flat(s.layers)
                .filter((l) => l.depth === 0 && l.role === "hero" && READABLE_TEXT_CAPS.has(l.capability))
                .sort((a, b) => a.from - b.from)
                .map((l) => textPlace(t, l)),
            ),
          ],
        }))
        .filter((x) => x.places.length);
      // o scenă continuă seria dacă are un singur loc al textului, același cu al scenei anterioare
      let run: typeof scenes = [];
      const flush = () => {
        // corectura: scenele din serie cu așezarea scrisă explicit trec pe „auto” (o decizie de layout, aplicată de om
        // sau de Claude dintr-un clic, nu de corecturile automate)
        const explicit = run.map((x) => ctx.storyboard.scenes.find((sc) => sc.id === x.s.id)).filter((sc) => sc && sc.composition !== "auto" && !sc.locked);
        if (run.length >= 3)
          out.push({
            frame: run[0].s.from,
            sceneId: run[0].s.id,
            formatId: fid,
            durationSec: sec(t, run[run.length - 1].s.from + run[run.length - 1].s.durationInFrames - run[0].s.from),
            dimension: "composition",
            category: "visual",
            severity: "medium",
            problem: `Textul principal stă în același loc (${run[0].places[0]}) în ${run.length} scene la rând (${run.map((x) => x.s.id).join(", ")}).`,
            recommendation:
              "Lasă compoziția scenelor pe „auto” (compilatorul mută textul între sus și jos pe vertical, stânga și dreapta pe orizontal) sau alege explicit alt loc pentru una dintre ele.",
            whyItMatters: "Același colț în fiecare scenă face reclama previzibilă și statică; textul care își schimbă locul conduce privirea și dă ritm.",
            suggestedFix: explicit.map((sc) => ({ op: "set-composition" as const, sceneId: sc!.id, composition: "auto" as const })),
            autoFixable: false,
            confidence: 0.75,
          });
        run = [];
      };
      for (const x of scenes) {
        const prev = run[run.length - 1];
        if (x.places.length === 1 && prev && prev.places.length === 1 && prev.places[0] === x.places[0]) run.push(x);
        else {
          flush();
          if (x.places.length === 1) run = [x];
        }
      }
      flush();
      return out;
    },
  },
];
