/** Pasa 9 a buclei de calitate: final QA. */
import type { Timeline } from "../../core/schema";
import { videoIssues } from "../../critique/auto";
import type { CheckDef } from "../checks";

export const FINAL_CHECKS: CheckDef[] = [
  {
    id: "technical.recompile",
    version: 1,
    pass: "final",
    title: "Recompilare de control: același timeline octet cu octet (determinism) sau date învechite",
    categories: ["technical"],
    method: "static",
    perFormat: true,
    run: (ctx, fid) => {
      const fresh = ctx.services.recompile(fid);
      if (!fresh) return [];
      const saved = ctx.timelines[fid];
      const norm = (t: Timeline) => JSON.stringify({ ...t, audio: { ...t.audio, src: null } });
      if (norm(fresh) === norm(saved)) return [];
      const inputsChanged = (["brief", "brand", "assets", "research", "references"] as const).some(
        (k) => ctx.inputsAtCompile[k] && ctx.inputsNow[k] !== ctx.inputsAtCompile[k],
      );
      if (inputsChanged) return []; // raportat deja de brand.stale
      return [
        {
          frame: null,
          sceneId: null,
          formatId: fid,
          dimension: "determinism",
          severity: "critical",
          method: "static",
          problem: "Recompilarea din aceleași date dă alt timeline (determinism încălcat).",
          recommendation: "Caută aleator nefixat sau timp real în compilator/rețete; nu exporta până nu e reparat.",
        },
      ];
    },
  },
  {
    id: "final.video",
    version: 1,
    pass: "final",
    title: "Video-ul randat: cadre negre, flash-uri, înghețări (refolosit dacă e la zi)",
    categories: ["technical", "motion"],
    method: "full-render",
    perFormat: true,
    run: async (ctx, fid) => {
      const v = await ctx.services.fullVideo(fid);
      if (!v) return [];
      return videoIssues(ctx.timelines[fid], v).map((d) => ({ ...d, formatId: fid }));
    },
  },
];
