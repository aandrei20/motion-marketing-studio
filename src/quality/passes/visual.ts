/** Pasa 2 a buclei de calitate: vizual (pe pixeli). */
import type { CheckDef } from "../checks";

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
];
