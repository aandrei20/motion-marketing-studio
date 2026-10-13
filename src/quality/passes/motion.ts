/** Pasa 3 a buclei de calitate: mișcare. */
import { READABLE_TEXT_CAPS } from "../../motion/text-caps";
import type { IssueDraft } from "../issues";
import type { CheckDef } from "../checks";

export const MOTION_CHECKS: CheckDef[] = [
  {
    id: "motion.grammar",
    version: 4,
    pass: "motion",
    title: "Gramatica mișcării: odihnă vizuală, varietate de animații, tranziții",
    categories: ["motion"],
    method: "timeline",
    perFormat: false,
    run: (ctx, fid) => {
      const t = ctx.timelines[fid];
      const out: IssueDraft[] = [];
      const body = t.scenes.filter((s) => s.meta.narrativeRole !== "cta");
      const moving = body.filter((s) => s.camera.keys.length > 1 || s.camera.handheld > 0 || s.camera.punches.length > 0);
      // odihna se pune pe o scenă fără demonstrație (nu pe hook, nu pe dezvăluire și nu pe o funcție: acolo push-ul face
      // interfața lizibilă, iar o cameră fixă ar fi întoarsă de verificarea de lizibilitate); aceeași regulă ca în compilator
      const calm = body.filter((s, i) => i > 0 && !["hook", "reveal", "feature", "demo", "solution"].includes(s.meta.narrativeRole));
      const rest = calm[Math.floor(calm.length / 2)];
      if (body.length >= 4 && moving.length === body.length)
        out.push({
          frame: null,
          sceneId: null,
          dimension: "motion",
          severity: "low",
          problem: "Camera se mișcă în toate scenele: nu există niciun moment de odihnă vizuală.",
          recommendation: "Lasă o scenă (de obicei dovada sau un detaliu) cu cameră fixă, ca mișcarea să aibă contrast.",
          suggestedFix: rest ? [{ op: "set-camera", sceneId: rest.id, capability: "camera.static", params: {} }] : [],
          confidence: 0.6,
        });
      if (body.length >= 4 && moving.length === 0)
        out.push({
          frame: null,
          sceneId: null,
          dimension: "motion",
          severity: "medium",
          problem: "Nicio scenă nu are mișcare de cameră: reclama pare statică.",
          recommendation: "Adaugă push-in pe dezvăluire și pe funcții.",
          confidence: 0.7,
        });
      const textCaps = t.scenes
        .map((s) => s.layers.find((l) => READABLE_TEXT_CAPS.has(l.capability) && l.role === "hero")?.capability)
        .filter((x): x is string => !!x);
      const counts = new Map<string, number>();
      for (const c of textCaps) counts.set(c, (counts.get(c) ?? 0) + 1);
      for (const [c, n] of counts)
        if (n >= 4 && n / Math.max(1, textCaps.length) > 0.7)
          out.push({
            frame: null,
            sceneId: null,
            dimension: "motion",
            severity: "low",
            problem: `Aceeași animație de text (${c}) în ${n} scene.`,
            recommendation: "Variază apariția textului după rolul scenei (hook cu impact, dovadă calmă).",
            confidence: 0.65,
          });
      const nonCut = t.scenes.slice(1).filter((s) => s.transitionIn && s.transitionIn.capability !== "tr.cut").length;
      // tăieturile directe din interiorul scenelor (punch-in) sunt și ele hard cut-uri
      const innerCuts = t.scenes.reduce((n, s) => n + (s.meta.cuts?.length ?? 0), 0);
      if (t.scenes.length > 4 && nonCut === t.scenes.length - 1 && !innerCuts && ctx.brief.pacing !== "slow")
        out.push({
          frame: null,
          sceneId: null,
          dimension: "motion",
          severity: "low",
          problem: "Toate tăieturile au tranziții animate: niciun hard cut.",
          recommendation: "Folosește tăietura simplă între scene apropiate; păstrează tranzițiile pentru schimbările de idee.",
          confidence: 0.55,
        });
      return out;
    },
  },
  {
    id: "motion.scene",
    version: 1,
    pass: "motion",
    title: "Mișcarea reală în scene (secvențe de cadre): scene statice, mișcare excesivă",
    categories: ["motion"],
    method: "scene-render",
    perFormat: false,
    run: async (ctx, fid) => {
      const t = ctx.timelines[fid];
      const out: IssueDraft[] = [];
      for (const m of await ctx.services.sceneMotion(fid)) {
        const s = t.scenes.find((x) => x.id === m.sceneId);
        if (!s || !m.curve.length) continue;
        const stepSec = m.stepFrames / t.fps;
        let run = 0;
        let longest = 0;
        for (const d of m.curve) {
          run = d < 0.0015 ? run + stepSec : 0;
          longest = Math.max(longest, run);
        }
        const isCta = s.meta.narrativeRole === "cta";
        if (!isCta && longest > 2.5)
          out.push({
            frame: s.from,
            sceneId: s.id,
            durationSec: longest,
            dimension: "motion",
            severity: "medium",
            method: "scene-render",
            problem: `Imaginea stă complet nemișcată ${longest.toFixed(1)} s.`,
            recommendation: "Adaugă o mișcare discretă (push lent, parallax) sau scurtează scena.",
            suggestedFix: [{ op: "set-camera", sceneId: s.id, capability: "camera.parallax-drift", params: {} }],
            confidence: 0.75,
          });
        const mean = m.curve.reduce((a, b) => a + b, 0) / m.curve.length;
        if (mean > 0.09 && s.meta.energy < 0.8)
          out.push({
            frame: s.from,
            sceneId: s.id,
            dimension: "motion",
            severity: "low",
            method: "scene-render",
            problem: `Mișcare foarte intensă (${mean.toFixed(3)}) pentru energia scenei (${s.meta.energy}).`,
            recommendation: "Mișcarea trebuie să servească mesajul: reduce tremurul sau viteza camerei.",
            confidence: 0.5,
          });
      }
      return out;
    },
  },
];
