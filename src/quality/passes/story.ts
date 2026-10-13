/** Pasa 1 a buclei de calitate: poveste. */
import { autoCritique } from "../../critique/auto";
import { READABLE_TEXT_CAPS } from "../../motion/text-caps";
import type { IssueDraft } from "../issues";
import { loadConcepts } from "../../creative/concepts";
import type { CheckDef } from "../checks";
import { flat, sec } from "./util";

export const STORY_CHECKS: CheckDef[] = [
  {
    id: "critique.rubric",
    version: 1,
    pass: "story",
    title: "Rubrica fixă rubric-v1 (hook, claritate, ritm, ierarhie, varietate, brand, CTA) pe fiecare scenă",
    categories: ["story", "typography", "motion"],
    method: "timeline",
    perFormat: false,
    run: async (ctx, fid) => {
      // validarea intră în scorul rubricii (claritate), dar problemele ei sunt raportate de timeline.validate
      const r = autoCritique(
        { timeline: ctx.timelines[fid], brief: ctx.brief, dir: ctx.dir, validation: ctx.validation[fid], mix: ctx.mix, video: null },
        ctx.round,
        ctx.versionId,
      );
      ctx.rubric.minScene = r.minScene;
      ctx.rubric.overall = r.overall;
      ctx.rubric.sceneScores = r.sceneScores;
      return r.findings.filter((f) => !f.id.includes("-v-") && f.dimension !== "audio").map((f) => ({ ...f, formatId: null }));
    },
  },
  {
    id: "story.structure",
    version: 1,
    pass: "story",
    title: "Structura narativă: hook la început, recompensă înainte de CTA, problemă înaintea soluției",
    categories: ["story", "creative"],
    method: "timeline",
    perFormat: false,
    run: (ctx, fid) => {
      const t = ctx.timelines[fid];
      const roles = t.scenes.map((s) => s.meta.narrativeRole);
      const out: IssueDraft[] = [];
      const payoff = ["reveal", "solution", "feature", "demo", "proof", "benefit", "transformation"];
      if (roles[0] !== "hook")
        out.push({
          frame: 0,
          sceneId: t.scenes[0].id,
          dimension: "story",
          severity: "high",
          problem: `Prima scenă are rolul „${roles[0]}”, nu hook.`,
          recommendation: "Deschide cu hook-ul (curiozitate, contrast sau problemă), în prima secundă.",
        });
      if (!roles.some((r) => payoff.includes(r)))
        out.push({
          frame: null,
          sceneId: null,
          dimension: "story",
          severity: "high",
          problem: "Reclama nu are o scenă de recompensă (produsul, dovada, beneficiul).",
          recommendation: "Adaugă o scenă de demonstrație sau de dovadă între hook și CTA.",
        });
      const firstProblem = roles.indexOf("problem");
      const firstSolution = roles.findIndex((r) => r === "reveal" || r === "solution");
      if (firstProblem >= 0 && firstSolution >= 0 && firstProblem > firstSolution)
        out.push({
          frame: t.scenes[firstProblem].from,
          sceneId: t.scenes[firstProblem].id,
          dimension: "story",
          severity: "medium",
          problem: "Problema apare după soluție.",
          recommendation: "Ordinea clasică: problemă → tensiune → soluție.",
          suggestedFix: [{ op: "scene-move", sceneId: t.scenes[firstProblem].id, to: firstSolution }],
          confidence: 0.7,
        });
      const ctaIdx = roles.lastIndexOf("cta");
      if (ctaIdx > 0 && !payoff.includes(roles[ctaIdx - 1]) && roles[ctaIdx - 1] !== "outro")
        out.push({
          frame: t.scenes[ctaIdx].from,
          sceneId: t.scenes[ctaIdx].id,
          dimension: "story",
          severity: "low",
          problem: `CTA-ul vine după „${roles[ctaIdx - 1]}”, nu după o recompensă.`,
          recommendation: "Pune dovada sau beneficiul chiar înaintea CTA-ului.",
          confidence: 0.6,
        });
      return out;
    },
  },
  {
    id: "story.energy-arc",
    version: 1,
    pass: "story",
    title: "Arcul de energie: escaladare, punct culminant, recompensă",
    categories: ["story", "creative"],
    method: "timeline",
    perFormat: false,
    run: (ctx, fid) => {
      const t = ctx.timelines[fid];
      const out: IssueDraft[] = [];
      const body = t.scenes.filter((s) => s.meta.narrativeRole !== "cta" && s.meta.narrativeRole !== "hook");
      if (body.length >= 3) {
        const e = body.map((s) => s.meta.energy);
        const mean = e.reduce((a, b) => a + b, 0) / e.length;
        const std = Math.sqrt(e.reduce((a, b) => a + (b - mean) ** 2, 0) / e.length);
        if (std < 0.06)
          out.push({
            frame: body[0].from,
            sceneId: null,
            dimension: "story",
            severity: "medium",
            problem: `Energia e plată în corpul reclamei (abatere ${std.toFixed(2)}): nu există escaladare.`,
            recommendation: "Construiește spre un punct culminant: crește energia la dezvăluire sau la dovadă.",
            confidence: 0.75,
          });
        const peak = t.scenes.reduce((a, b) => (b.meta.energy > a.meta.energy && b.meta.narrativeRole !== "hook" ? b : a), body[0]);
        const pos = (peak.from + peak.durationInFrames / 2) / t.durationInFrames;
        if (pos < 0.3)
          out.push({
            frame: peak.from,
            sceneId: peak.id,
            dimension: "story",
            severity: "low",
            problem: `Punctul culminant e prea devreme (${Math.round(pos * 100)}% din durată).`,
            recommendation: "Mută momentul cu cea mai mare energie spre 50–80% din reclamă.",
            confidence: 0.6,
          });
      }
      return out;
    },
  },
  {
    id: "story.brand-reveal",
    version: 1,
    pass: "story",
    title: "Momentul în care apare brandul (logo sau numele produsului)",
    categories: ["story", "brand"],
    method: "timeline",
    perFormat: false,
    run: (ctx, fid) => {
      const t = ctx.timelines[fid];
      const name = ctx.project.product.name.toLowerCase();
      let first: number | null = null;
      for (const s of t.scenes) {
        for (const l of flat(s.layers)) {
          const hit =
            l.capability.startsWith("logo.") ||
            (READABLE_TEXT_CAPS.has(l.capability) &&
              String(l.params.text ?? "")
                .toLowerCase()
                .includes(name));
          if (hit) first = first === null ? s.from + l.from : Math.min(first, s.from + l.from);
        }
      }
      const prof = ctx.profiles[fid];
      const limit = prof.brandBySec ?? (t.durationInFrames / t.fps) * 0.6;
      if (first === null)
        return [
          {
            frame: null,
            sceneId: null,
            dimension: "brand",
            severity: "high",
            problem: "Brandul (logo sau numele produsului) nu apare nicăieri pe ecran.",
            recommendation: "Arată logo-ul sau numele la dezvăluire și pe cardul final.",
            confidence: 0.85,
          },
        ];
      if (sec(t, first) > limit)
        return [
          {
            frame: first,
            sceneId: null,
            dimension: "brand",
            severity: "medium",
            problem: `Brandul apare abia la ${sec(t, first).toFixed(1)} s (ținta pentru ${prof.label}: ${limit.toFixed(1)} s).`,
            recommendation: "Arată numele sau logo-ul mai devreme (de ex. pe dezvăluire), fără să strici hook-ul.",
            confidence: 0.6,
          },
        ];
      return [];
    },
  },
  {
    id: "story.pacing",
    version: 2,
    pass: "story",
    title: "Ritmul: durata medie a planurilor (scene și tăieturile din interiorul lor) față de platformă și direcție",
    categories: ["story", "motion"],
    method: "timeline",
    perFormat: true,
    run: (ctx, fid) => {
      const t = ctx.timelines[fid];
      const prof = ctx.profiles[fid];
      const shots = t.scenes.reduce((n, s) => n + 1 + (s.meta.cuts?.length ?? 0), 0);
      const avg = t.durationInFrames / t.fps / shots;
      const [lo, hi] = prof.avgShotSec;
      if (avg > hi * 1.15)
        return [
          {
            frame: null,
            sceneId: null,
            formatId: fid,
            dimension: "pacing",
            severity: "medium",
            problem: `Ritm lent pentru ${prof.label}: ${avg.toFixed(1)} s pe plan în medie (recomandat ${lo}–${hi} s).`,
            recommendation: "Împarte scenele lungi sau taie din hold-uri (vocea dictează minimul).",
            confidence: 0.6,
          },
        ];
      if (avg < lo * 0.85)
        return [
          {
            frame: null,
            sceneId: null,
            formatId: fid,
            dimension: "pacing",
            severity: "medium",
            problem: `Ritm foarte rapid: ${avg.toFixed(1)} s pe plan (recomandat ${lo}–${hi} s).`,
            recommendation: "Lasă mesajele să respire: comasează scenele sau prelungește-le.",
            confidence: 0.6,
          },
        ];
      return [];
    },
  },
  {
    id: "creative.concept",
    version: 1,
    pass: "story",
    title: "Conceptul creativ: ales, susținut de dovezi, respectat de storyboard",
    categories: ["creative"],
    method: "static",
    perFormat: false,
    run: (ctx) => {
      const concepts = loadConcepts(ctx.project.id);
      const out: IssueDraft[] = [];
      const c = concepts?.concepts.find((x) => x.id === concepts.selectedId);
      if (!c)
        return [
          {
            frame: null,
            sceneId: null,
            dimension: "creative",
            severity: "medium",
            problem: "Reclama nu are un concept creativ ales (concepts.json).",
            recommendation: "Generează și alege conceptul: npm run mms -- concepts <proiect>.",
            method: "static",
            confidence: 0.9,
          },
        ];
      if (c.total < 60)
        out.push({
          frame: null,
          sceneId: null,
          dimension: "creative",
          severity: "medium",
          problem: `Conceptul ales („${c.title}”) are doar ${c.total}/100.`,
          recommendation: "Claude propune un concept mai puternic (origin „ai”) sau utilizatorul își rafinează ideea.",
          method: "static",
          confidence: 0.6,
        });
      for (const r of c.risks)
        out.push({
          frame: null,
          sceneId: null,
          dimension: "creative",
          severity: "low",
          problem: `Risc al conceptului „${c.title}”: ${r}.`,
          recommendation: "Adaugă materialul lipsă sau alege alt concept.",
          method: "static",
          confidence: 0.7,
        });
      if (ctx.storyboard.templateId && ctx.storyboard.templateId !== c.templateId)
        out.push({
          frame: null,
          sceneId: null,
          dimension: "creative",
          severity: "low",
          problem: `Storyboard-ul folosește structura „${ctx.storyboard.templateId}”, conceptul ales cere „${c.templateId}”.`,
          recommendation: "Regenerează storyboard-ul din concept sau alege conceptul care corespunde.",
          method: "static",
          confidence: 0.6,
        });
      return out;
    },
  },
];
