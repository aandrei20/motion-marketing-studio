/** Pasa 0 a buclei de calitate: plan. */
import { isClaimUsable } from "../../core/schema";
import { validateScript } from "../../creative/script";
import type { IssueDraft } from "../issues";
import { claimGraph } from "../../research/graph";
import type { CheckDef } from "../checks";

export const PLAN_CHECKS: CheckDef[] = [
  {
    id: "timeline.validate",
    version: 1,
    pass: "plan",
    title: "Validatorul timeline-ului (reguli dure: footage real, drepturi, cifre, zone, 360 px, flash, goluri)",
    categories: ["claims", "technical", "platform", "typography", "ui"],
    method: "timeline",
    perFormat: true,
    run: (ctx, fid) => ctx.validation[fid].findings.map((f) => ({ ...f, formatId: fid })),
  },
  {
    id: "claims.script",
    version: 1,
    pass: "plan",
    title: "Scriptul: fraze obligatorii exacte, afirmații verificate, cifre cu sursă, interdicții",
    categories: ["claims", "story"],
    method: "static",
    perFormat: false,
    run: (ctx) =>
      validateScript(ctx.script, ctx.brief, ctx.research).map((i) => ({
        frame: null,
        sceneId: ctx.storyboard.scenes.find((s) => i.lineId && s.lineIds.includes(i.lineId))?.id ?? null,
        dimension: i.dimension ?? (/afirma|cifr/i.test(i.message) ? "claims" : /CTA|hook/i.test(i.message) ? "story" : "claims"),
        severity: i.severity,
        problem: i.message,
        recommendation: "Corectează scriptul (Claude în Claude Code sau Studio → Script); textul utilizatorului rămâne cuvânt cu cuvânt.",
        method: "static",
      })),
  },
  {
    id: "claims.confidence",
    version: 1,
    pass: "plan",
    title: "Afirmațiile folosite: încredere și stare",
    categories: ["claims"],
    method: "static",
    perFormat: false,
    run: (ctx) => {
      const out: IssueDraft[] = [];
      // graful de afirmații: încrederea după coroborare, conflictele între surse, afirmațiile despre concurenți
      const graph = new Map(claimGraph(ctx.research).nodes.map((n) => [n.claim.id, n]));
      for (const l of ctx.script.lines) {
        const sceneId = ctx.storyboard.scenes.find((s) => s.lineIds.includes(l.id))?.id ?? null;
        for (const id of l.claimIds) {
          const n = graph.get(id);
          if (!n) continue;
          if (n.conflictsWith.length && n.claim.status !== "approved-by-user")
            out.push({
              frame: null,
              sceneId,
              dimension: "claims",
              severity: "critical",
              problem: `Replica „${l.id}” folosește o afirmație în conflict cu alte surse (${id} ≠ ${n.conflictsWith.join(", ")}).`,
              recommendation: "Utilizatorul confirmă valoarea corectă (mms claim … approved) sau scoate replica.",
              method: "static",
            });
          else if (n.aboutCompetitor && n.claim.status !== "approved-by-user")
            out.push({
              frame: null,
              sceneId,
              dimension: "claims",
              severity: "critical",
              problem: `Replica „${l.id}” folosește o afirmație luată de pe pagina unui concurent (${id}).`,
              recommendation: "Afirmațiile despre concurenți nu intră în video fără aprobarea utilizatorului.",
              method: "static",
            });
          else if (isClaimUsable(n.claim) && n.confidence === "low" && n.claim.status !== "approved-by-user")
            out.push({
              frame: null,
              sceneId,
              dimension: "claims",
              severity: "medium",
              problem: `Replica „${l.id}” se sprijină pe o afirmație cu încredere mică (${id}).`,
              recommendation: "Cere confirmarea utilizatorului sau o sursă mai bună.",
              method: "static",
              confidence: 0.9,
            });
        }
      }
      return out;
    },
  },
];
