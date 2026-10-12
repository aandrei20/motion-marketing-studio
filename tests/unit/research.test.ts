/**
 * Research: alegerea paginilor de citit de pe site și graful de afirmații (coroborare, conflicte, concurenți).
 */
import { describe, expect, it } from "vitest";
import { Research } from "../../src/core/schema";
import { planCrawl } from "../../src/research/crawl";
import { claimGraph } from "../../src/research/graph";

describe("planul de research pe site", () => {
  it("alege paginile utile ale aceluiași domeniu, fără login, aplicație, documente legale sau duplicate", () => {
    const plan = planCrawl("https://produs.test/", [
      { text: "Prețuri", href: "/pricing" },
      { text: "Funcții", href: "https://produs.test/features#top" },
      { text: "Funcții", href: "https://produs.test/features" },
      { text: "Intră în cont", href: "https://produs.test/app" },
      { text: "Termeni", href: "/terms" },
      { text: "Blog", href: "https://altdomeniu.test/blog" },
      { text: "Noutăți", href: "/changelog" },
      { text: "Acasă", href: "https://produs.test/" },
      { text: "Ghid PDF", href: "/ghid.pdf" },
    ]);
    const urls = plan.map((p) => p.url);
    expect(urls).toEqual(["https://produs.test/pricing", "https://produs.test/features", "https://produs.test/changelog"]);
    expect(plan[0].kind).toBe("pricing");
  });
  it("pe file:// pagina de start nu se recitește", () => {
    const plan = planCrawl("file:///C:/site/index.html", [
      { text: "Acasă", href: "file:///C:/site/index.html#hero" },
      { text: "Prețuri", href: "file:///C:/site/preturi.html" },
    ]);
    expect(plan.map((p) => p.url)).toEqual(["file:///C:/site/preturi.html"]);
  });
});

const src = (id: string, kind = "official-site", reliability = "official") => ({
  id,
  kind,
  title: id,
  fetchedAt: "2026-10-08T00:00:00Z",
  contentHash: id,
  reliability,
});
const claim = (id: string, text: string, sourceIds: string[], o: Record<string, unknown> = {}) => ({
  id,
  text,
  quote: text,
  kind: "fact",
  category: "feature",
  sourceIds,
  confidence: "medium",
  status: "verified",
  checkedAt: "2026-10-08",
  ...o,
});

describe("graful de afirmații", () => {
  it("coroborarea în două surse oficiale ridică încrederea; conflictele de preț blochează folosirea", () => {
    const r = Research.parse({
      schemaVersion: 1,
      sources: [src("home"), src("pricing", "pricing"), src("rival", "competitor", "third-party")],
      claims: [
        claim("a", "Căutare instantă în toate proiectele echipei", ["home"]),
        claim("b", "Căutare instantă în toate proiectele echipei tale", ["pricing"]),
        claim("p1", "Echipă · 8 € · per utilizator", ["home"], { category: "pricing", status: "approved-by-user" }),
        claim("p2", "Echipă · 10 € · per utilizator", ["pricing"], { category: "pricing", status: "needs-confirmation" }),
        claim("r", "Cel mai rapid planificator", ["rival"]),
      ],
    });
    const g = claimGraph(r);
    const n = Object.fromEntries(g.nodes.map((x) => [x.claim.id, x]));
    expect(n.a.corroboratedBy).toEqual(["b"]);
    expect(n.a.confidence).toBe("high");
    expect(n.p1.conflictsWith).toEqual(["p2"]);
    expect(n.p1.usable).toBe(false);
    expect(n.r.aboutCompetitor).toBe(true);
    expect(n.r.usable).toBe(false);
    expect(g.toConfirm[0].category).toBe("pricing");
    expect(g.stats.conflicts).toBe(2);
  });
});
