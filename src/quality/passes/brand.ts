/** Pasa 7 a buclei de calitate: brand. */
import type { IssueDraft } from "../issues";
import type { CheckDef } from "../checks";
import { flat } from "./util";

export const BRAND_CHECKS: CheckDef[] = [
  {
    id: "brand.stale",
    version: 1,
    pass: "brand",
    title: "Timeline-ul e compilat din datele actuale (brief, brand, materiale, research)?",
    categories: ["brand", "technical"],
    method: "static",
    perFormat: false,
    run: (ctx) => {
      const changed = (["brief", "brand", "assets", "research", "references"] as const).filter(
        (k) => ctx.inputsAtCompile[k] && ctx.inputsNow[k] && ctx.inputsAtCompile[k] !== ctx.inputsNow[k],
      );
      if (!changed.length) return [];
      return [
        {
          frame: null,
          sceneId: null,
          dimension: "stale",
          category: changed.includes("brand") ? "brand" : "technical",
          severity: "high",
          problem: `Timeline-ul a fost compilat înainte de schimbări în: ${changed.join(", ")}.`,
          recommendation: "Recompilează (se creează versiunea următoare).",
          suggestedFix: [{ op: "recompile" }],
          method: "static",
          confidence: 1,
        },
      ];
    },
  },
  {
    id: "brand.rules",
    version: 1,
    pass: "brand",
    title: "Regulile logo-ului (fără recolorare/rotire) și culorile din brand",
    categories: ["brand"],
    method: "timeline",
    perFormat: true,
    run: (ctx, fid) => {
      const t = ctx.timelines[fid];
      const out: IssueDraft[] = [];
      const rules = ctx.brand?.logo.rules;
      for (const s of t.scenes) {
        for (const l of flat(s.layers).filter((x) => x.capability.startsWith("logo."))) {
          const recolor = l.modifiers.some((m) => m.capability === "mod.color-grade") || typeof l.params.tint === "string";
          const rotate = l.modifiers.some((m) => m.capability === "mod.tilt-3d") || (typeof l.params.rotate === "number" && l.params.rotate !== 0);
          if (recolor && !rules?.allowRecolor)
            out.push({
              frame: s.from + l.from,
              sceneId: s.id,
              layerId: l.id,
              formatId: fid,
              dimension: "brand-consistency",
              severity: "high",
              problem: "Logo-ul e recolorat, deși regulile brandului nu permit.",
              recommendation: "Scoate filtrul de culoare de pe logo (doar scară uniformă).",
            });
          if (rotate && !rules?.allowRotate)
            out.push({
              frame: s.from + l.from,
              sceneId: s.id,
              layerId: l.id,
              formatId: fid,
              dimension: "brand-consistency",
              severity: "high",
              problem: "Logo-ul e rotit/înclinat, deși regulile brandului nu permit.",
              recommendation: "Folosește logo-ul drept, doar cu scară uniformă.",
            });
        }
      }
      if (
        ctx.brand &&
        (t.palette.primary.toLowerCase() !== ctx.brand.colors.primary.toLowerCase() ||
          t.palette.background.toLowerCase() !== ctx.brand.colors.background.toLowerCase())
      )
        out.push({
          frame: null,
          sceneId: null,
          formatId: fid,
          dimension: "brand-consistency",
          severity: "high",
          problem: "Paleta timeline-ului diferă de brand kit.",
          recommendation: "Recompilează din brand kit-ul actual.",
          suggestedFix: [{ op: "recompile" }],
          confidence: 0.95,
        });
      return out;
    },
  },
  {
    id: "brand.color-presence",
    version: 1,
    pass: "brand",
    title: "Culorile brandului se văd efectiv în cadrele randate",
    categories: ["brand"],
    method: "stills",
    perFormat: false,
    run: async (ctx, fid) => {
      const rs = await ctx.services.stills(fid);
      if (!rs.length) return [];
      const share = rs.reduce((a, r) => a + r.metrics.brandShare, 0) / rs.length;
      if (share < 0.002)
        return [
          {
            frame: null,
            sceneId: null,
            formatId: fid,
            dimension: "brand-consistency",
            severity: "low",
            method: "stills",
            source: "pixel-check",
            problem: `Culorile principale ale brandului apar în doar ${(share * 100).toFixed(2)}% din cadre.`,
            recommendation: "Folosește culoarea primară în accente (text evidențiat, butonul CTA, lumini).",
            confidence: 0.55,
          },
        ];
      return [];
    },
  },
];
