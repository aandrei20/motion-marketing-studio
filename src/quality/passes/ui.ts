/** Pasa 4 a buclei de calitate: interfață. */
import type { TimelineLayer } from "../../core/schema";
import { READABLE_TEXT_CAPS } from "../../motion/text-caps";
import type { IssueDraft } from "../issues";
import { area, focusRects, holdFrame, overlapArea, screenRect } from "../../timeline/geometry";
import { boxAt, captionBoxes } from "../../timeline/validate";
import type { CheckDef } from "../checks";

export const UI_CHECKS: CheckDef[] = [
  {
    id: "ui.legibility",
    version: 1,
    pass: "ui",
    title: "Lizibilitatea interfeței reale pe ecran (scara capturii × zoom-ul camerei, la 360 px)",
    categories: ["ui"],
    method: "timeline",
    perFormat: true,
    run: (ctx, fid) => {
      const t = ctx.timelines[fid];
      const out: IssueDraft[] = [];
      for (const s of t.scenes) {
        for (const l of s.layers.filter((x) => x.capability === "media.screen")) {
          const p = l.params as { imageWidth?: number; crop?: { w: number } };
          const asset = ctx.assets.assets.find((a) => l.assets.includes(`projects/${ctx.project.id}/${a.file}`));
          if (!p.imageWidth || !asset) continue;
          const dpr = asset.capture?.deviceScaleFactor ?? 1;
          const visibleW = p.crop?.w ?? p.imageWidth;
          const scale = l.box.w / visibleW;
          const zoom = Math.max(...s.camera.keys.map((k) => k.zoom), 1);
          const focus = l.children.find((c) => /^ui\.(spotlight|highlight|callout|zoom-lens|typing|click|cursor)/.test(c.capability));
          // textul de interfață: din zona țintită (eticheta ~45% din înălțimea unui câmp/buton) sau corpul de text tipic (15 px CSS)
          const capPx = focus && focus.box.h > 0 && focus.box.h < 200 * dpr ? focus.box.h * 0.45 : 15 * dpr;
          const at360 = (capPx * scale * zoom * 360) / Math.min(t.width, t.height);
          const demo = ["feature", "demo", "solution"].includes(s.meta.narrativeRole);
          if (at360 < 5 && demo)
            out.push({
              frame: s.from,
              sceneId: s.id,
              layerId: l.id,
              formatId: fid,
              dimension: "ui-legibility",
              severity: at360 < 3.5 ? "high" : "medium",
              problem: `Interfața din ${s.id} se vede la ~${at360.toFixed(1)} px la testul de 360 px: funcția nu se poate citi.`,
              recommendation: "Apropie camera pe zona funcției (push pe regiune) sau decupează captura în jurul ei.",
              suggestedFix: focus && s.camera.keys.length <= 1 ? [{ op: "set-camera", sceneId: s.id, capability: "camera.push", params: {} }] : [],
              confidence: 0.6,
            });
          const upscale = (l.box.w * zoom) / (visibleW || 1);
          if (upscale > 1.6)
            out.push({
              frame: s.from,
              sceneId: s.id,
              layerId: l.id,
              formatId: fid,
              dimension: "assets",
              category: "ui",
              severity: "medium",
              problem: `Captura „${asset.originalName}” e mărită ${upscale.toFixed(1)}× peste rezoluția ei: va arăta neclar.`,
              recommendation: "Capturează din nou la rezoluție mai mare (deviceScaleFactor 2–3) sau reduce zoom-ul.",
              confidence: 0.8,
            });
        }
      }
      return out;
    },
  },
  {
    id: "ui.caption-occlusion",
    version: 2,
    pass: "ui",
    title: "Subtitrările nu acoperă elementul demonstrat (zona țintită, pe ecran, cu decupaj, scroll și cameră)",
    categories: ["ui", "typography"],
    method: "timeline",
    perFormat: true,
    run: (ctx, fid) => {
      const t = ctx.timelines[fid];
      if (!t.captions) return [];
      const segs = captionBoxes(t);
      const out: IssueDraft[] = [];
      t.scenes.forEach((s, i) => {
        const local = holdFrame(t, i);
        const words = t.captions!.words.filter((w) => w.from < s.from + s.durationInFrames && w.to > s.from);
        if (!words.length) return;
        const cap = boxAt(segs, words[0].from);
        const focus = focusRects(t, s, local);
        const hit = focus.map((r) => overlapArea(cap, r) / Math.max(1, area(r))).reduce((m, x) => Math.max(m, x), 0);
        if (hit > 0.1)
          out.push({
            frame: s.from + local,
            sceneId: s.id,
            formatId: fid,
            dimension: "composition",
            category: "ui",
            severity: ["feature", "demo", "solution"].includes(s.meta.narrativeRole) ? "high" : "medium",
            problem: `Subtitrările acoperă ${Math.round(hit * 100)}% din elementul demonstrat în ${s.id}.`,
            recommendation:
              "Recompilează (banda se mută automat dacă există loc în zona sigură); altfel mută materialul sau dezactivează subtitrările arse pe această scenă.",
            confidence: 0.8,
          });
      });
      return out;
    },
  },
  {
    id: "ui.material-over-text",
    version: 1,
    pass: "ui",
    title: "Materialul mărit de cameră nu intră peste titlu (geometria pe ecran la zoom-ul maxim al scenei)",
    categories: ["ui"],
    method: "timeline",
    perFormat: true,
    run: (ctx, fid) => {
      const t = ctx.timelines[fid];
      const out: IssueDraft[] = [];
      t.scenes.forEach((s, i) => {
        // textul fix al scenei (titlu, subtitlu) și materialele principale care se mișcă odată cu camera
        const texts = s.layers.filter((l) => READABLE_TEXT_CAPS.has(l.capability) && l.depth === 0 && l.role !== "background");
        const media = s.layers.filter(
          (l) => (l.capability.startsWith("media.") || l.capability.startsWith("frame.")) && l.depth > 0 && l.role !== "background",
        );
        if (!texts.length || !media.length) return;
        // momentul cu zoom-ul cel mai mare (de regulă ultima cheie a camerei), în fereastra de hold a scenei
        const peak = s.camera.keys.reduce((a, k) => (k.zoom > a.zoom ? k : a), s.camera.keys[0] ?? { at: 0, zoom: 1 });
        const local = Math.min(holdFrame(t, i, 1), Math.max(holdFrame(t, i, 0), Math.round(peak.at)));
        let worst = 0;
        let hit: TimelineLayer | null = null;
        for (const tx of texts) {
          if (tx.from > local || tx.from + tx.durationInFrames <= local) continue;
          const covered = media.reduce((m, l) => Math.max(m, overlapArea(screenRect(t, s, l, local), tx.box)), 0) / Math.max(1, area(tx.box));
          if (covered > worst) [worst, hit] = [covered, tx];
        }
        if (worst > 0.12 && hit)
          out.push({
            frame: s.from + local,
            sceneId: s.id,
            layerId: hit.id,
            formatId: fid,
            dimension: "composition",
            category: "ui",
            severity: worst > 0.3 ? "high" : "medium",
            problem: `Materialul mărit de cameră acoperă ${Math.round(worst * 100)}% din textul „${String(hit.params.text ?? "").slice(0, 32)}” în ${s.id}.`,
            recommendation: "Lasă camera rețetei (zoom-ul ei e limitat sub titlu) sau scade zoom-ul; textul și materialul nu se suprapun.",
            confidence: 0.8,
          });
      });
      return out;
    },
  },
  {
    id: "typography.caption-redundancy",
    version: 1,
    pass: "typography",
    title: "Subtitrările nu repetă textul deja scris pe ecran",
    categories: ["typography"],
    method: "timeline",
    perFormat: false,
    run: (ctx, fid) => {
      const t = ctx.timelines[fid];
      if (!t.captions) return [];
      const out: IssueDraft[] = [];
      const norm = (x: string) =>
        x
          .toLowerCase()
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/[^\p{L}\p{N} ]/gu, " ")
          .split(/\s+/)
          .filter((w) => w.length > 1 || /\d/.test(w));
      for (const s of t.scenes) {
        const words = t.captions.words.filter((w) => w.from >= s.from && w.from < s.from + s.durationInFrames).flatMap((w) => norm(w.text));
        if (words.length < 2) continue;
        const screen = new Set(
          norm(
            s.layers
              .filter((l) => READABLE_TEXT_CAPS.has(l.capability))
              .map((l) => String(l.params.text ?? ""))
              .join(" "),
          ),
        );
        const dup = words.filter((w) => screen.has(w)).length / words.length;
        if (dup >= 0.7)
          out.push({
            frame: s.from,
            sceneId: s.id,
            dimension: "clutter",
            category: "typography",
            severity: "medium",
            problem: `Subtitrările din ${s.id} repetă textul de pe ecran (${Math.round(dup * 100)}% din cuvinte).`,
            recommendation: "Nu arde subtitrarea pentru o replică deja scrisă pe ecran (recompilează: compilatorul o omite).",
            confidence: 0.8,
          });
      }
      return out;
    },
  },
];
