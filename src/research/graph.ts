/**
 * Graful de afirmații: afirmație ↔ dovadă (citat) ↔ sursă ↔ încredere, plus coroborare (aceeași afirmație
 * în mai multe surse) și conflicte (aceeași temă, cifre diferite – de ex. prețul unui plan pe două pagini).
 * Se calculează din research.json (sursa de adevăr), nu se stochează separat.
 */
import { isClaimUsable, type Claim, type Confidence, type Research, type Source } from "../core/schema";

export interface ClaimNode {
  claim: Claim;
  sources: Source[];
  /** încrederea după coroborare (două surse oficiale independente o ridică) */
  confidence: Confidence;
  usable: boolean;
  corroboratedBy: string[];
  conflictsWith: string[];
  aboutCompetitor: boolean;
}

export interface ClaimGraph {
  nodes: ClaimNode[];
  stats: { claims: number; sources: number; usable: number; needsConfirmation: number; corroborated: number; conflicts: number };
  /** ce trebuie confirmat de om, în ordinea priorității (cifre și prețuri întâi) */
  toConfirm: Claim[];
}

const tokens = (t: string) =>
  new Set(
    t
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^\p{L}\p{N} ]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );
const jaccard = (a: Set<string>, b: Set<string>) => {
  const inter = [...a].filter((x) => b.has(x)).length;
  return inter / Math.max(1, a.size + b.size - inter);
};
const numbers = (t: string) => (t.match(/\d+(?:[.,]\d+)?/g) ?? []).map((x) => x.replace(",", "."));
const topic = (c: Claim) =>
  (c.quote ?? c.text)
    .split(/[·:\n]/)[0]
    .trim()
    .toLowerCase();

export function claimGraph(r: Research): ClaimGraph {
  const sources = new Map(r.sources.map((s) => [s.id, s]));
  const tok = new Map(r.claims.map((c) => [c.id, tokens(c.text)]));
  const nodes: ClaimNode[] = r.claims.map((claim) => {
    const srcs = claim.sourceIds.map((id) => sources.get(id)).filter((s): s is Source => !!s);
    const aboutCompetitor = srcs.length > 0 && srcs.every((s) => s.kind === "competitor");
    const corroboratedBy = r.claims
      .filter((o) => o.id !== claim.id && jaccard(tok.get(o.id)!, tok.get(claim.id)!) >= 0.6 && o.sourceIds.some((id) => !claim.sourceIds.includes(id)))
      .map((o) => o.id);
    const conflictsWith =
      claim.category === "pricing" || claim.category === "metric"
        ? r.claims
            .filter(
              (o) =>
                o.id !== claim.id &&
                o.category === claim.category &&
                topic(o) === topic(claim) &&
                numbers(o.text).join() !== numbers(claim.text).join() &&
                numbers(o.text).length > 0,
            )
            .map((o) => o.id)
        : [];
    const official = new Set(
      [...claim.sourceIds, ...corroboratedBy.flatMap((id) => r.claims.find((x) => x.id === id)!.sourceIds)].filter(
        (id) => sources.get(id)?.reliability === "official",
      ),
    );
    let confidence: Confidence = claim.confidence;
    if (official.size >= 2 && confidence !== "high") confidence = confidence === "low" ? "medium" : "high";
    if (conflictsWith.length || aboutCompetitor) confidence = "low";
    return {
      claim,
      sources: srcs,
      confidence,
      usable: isClaimUsable(claim) && !conflictsWith.length && !aboutCompetitor,
      corroboratedBy,
      conflictsWith,
      aboutCompetitor,
    };
  });
  const rank = (c: Claim) => (c.category === "pricing" ? 0 : c.category === "metric" ? 1 : c.category === "testimonial" ? 2 : 3);
  const toConfirm = nodes
    .filter((n) => n.claim.status === "needs-confirmation" || n.conflictsWith.length)
    .map((n) => n.claim)
    .sort((a, b) => rank(a) - rank(b));
  return {
    nodes,
    stats: {
      claims: nodes.length,
      sources: r.sources.length,
      usable: nodes.filter((n) => n.usable).length,
      needsConfirmation: nodes.filter((n) => n.claim.status === "needs-confirmation").length,
      corroborated: nodes.filter((n) => n.corroboratedBy.length || n.claim.sourceIds.length > 1).length,
      conflicts: nodes.filter((n) => n.conflictsWith.length).length,
    },
    toConfirm,
  };
}
