/** Pasa 8 a buclei de calitate: platformă. */
import { READABLE_TEXT_CAPS } from "../../motion/text-caps";
import type { IssueDraft } from "../issues";
import { area, focusRects, holdFrame, overlapArea } from "../../timeline/geometry";
import { resolveSafeZone } from "../../core/formats";
import type { CheckDef } from "../checks";
import { sec } from "./util";

export const PLATFORM_CHECKS: CheckDef[] = [
  {
    id: "platform.profile",
    version: 1,
    pass: "platform",
    title: "Profilul platformei: durată, format, hook, subtitrări, densitatea textului, hold pe CTA",
    categories: ["platform"],
    method: "timeline",
    perFormat: true,
    run: (ctx, fid) => {
      const t = ctx.timelines[fid];
      const fmt = ctx.formats.find((f) => f.id === fid)!;
      const prof = ctx.profiles[fid];
      const out: IssueDraft[] = [];
      const dur = t.durationInFrames / t.fps;
      // durata cerută în brief: vocea și timpul de citire pot lungi reclama peste țintă
      const target = ctx.brief.durationSec;
      if (target && dur > target * 1.15)
        out.push({
          frame: null,
          sceneId: null,
          formatId: fid,
          dimension: "pacing",
          category: "platform",
          severity: dur > target * 1.5 ? "high" : "medium",
          problem: `Reclama durează ${dur.toFixed(1)} s, iar ținta din brief e ${target} s (+${Math.round((dur / target - 1) * 100)}%).`,
          recommendation:
            "Scurtează scriptul: mai puține replici sau replici mai scurte (vocea și timpul de citire dictează durata). Sau acceptă durata nouă în brief.",
          confidence: 0.9,
        });
      if (dur > prof.durationSec.max)
        out.push({
          frame: null,
          sceneId: null,
          formatId: fid,
          dimension: "platform",
          severity: "high",
          problem: `Durata ${dur.toFixed(1)} s depășește maximul pentru ${prof.label} (${prof.durationSec.max} s).`,
          recommendation: "Scurtează scriptul sau livrează o variantă separată.",
        });
      else if (dur > prof.durationSec.idealMax * 1.1 || dur < prof.durationSec.idealMin * 0.9)
        out.push({
          frame: null,
          sceneId: null,
          formatId: fid,
          dimension: "platform",
          severity: "low",
          problem: `Durata ${dur.toFixed(1)} s e în afara intervalului recomandat pentru ${prof.label} (${prof.durationSec.idealMin}–${prof.durationSec.idealMax} s).`,
          recommendation: "Ajustează durata țintă din brief dacă nu e o alegere conștientă.",
          confidence: 0.5,
        });
      if (!prof.aspects.includes(fmt.id.replace(/-4k$/, "")))
        out.push({
          frame: null,
          sceneId: null,
          formatId: fid,
          dimension: "format",
          severity: "low",
          problem: `Formatul ${fmt.id} nu e cel recomandat pentru ${prof.label} (${prof.aspects.join(", ")}).`,
          recommendation: "Adaugă formatul recomandat în proiect.",
          confidence: 0.6,
        });
      const firstText = Math.min(
        ...t.scenes.flatMap((s) => s.layers.filter((l) => READABLE_TEXT_CAPS.has(l.capability)).map((l) => s.from + l.from)),
        Infinity,
      );
      if (Number.isFinite(firstText) && sec(t, firstText) > prof.hookBySec)
        out.push({
          frame: firstText,
          sceneId: t.scenes[0].id,
          formatId: fid,
          dimension: "platform",
          category: "story",
          severity: "medium",
          problem: `Primul mesaj pe ecran apare la ${sec(t, firstText).toFixed(1)} s (ținta pentru ${prof.label}: ${prof.hookBySec} s).`,
          recommendation: "Mesajul hook-ului din prima secundă.",
          confidence: 0.85,
        });
      if (prof.captions === "required" && !t.captions && ctx.brief.audio.voice.mode !== "none")
        out.push({
          frame: null,
          sceneId: null,
          formatId: fid,
          dimension: "platform",
          severity: "high",
          problem: `${prof.label} se vede mult fără sunet, iar vocea nu are subtitrări arse.`,
          recommendation: "Activează subtitrările arse (brief.captions.burnIn).",
        });
      const words = t.scenes
        .flatMap((s) => s.layers.filter((l) => READABLE_TEXT_CAPS.has(l.capability)))
        .reduce(
          (n, l) =>
            n +
            String(l.params.text ?? "")
              .split(/\s+/)
              .filter(Boolean).length,
          0,
        );
      if (words / dur > prof.maxWordsPerSec)
        out.push({
          frame: null,
          sceneId: null,
          formatId: fid,
          dimension: "platform",
          category: "typography",
          severity: "medium",
          problem: `Text dens: ${(words / dur).toFixed(1)} cuvinte pe ecran pe secundă (maximum ${prof.maxWordsPerSec} pentru ${prof.label}).`,
          recommendation: "Mută explicațiile în voce; pe ecran un singur mesaj scurt pe scenă.",
          confidence: 0.7,
        });
      const cta = t.scenes.find((s) => s.meta.narrativeRole === "cta");
      if (cta && cta.durationInFrames / t.fps < prof.ctaHoldSec)
        out.push({
          frame: cta.from,
          sceneId: cta.id,
          formatId: fid,
          dimension: "cta",
          category: "platform",
          severity: "medium",
          problem: `Cardul final ține ${(cta.durationInFrames / t.fps).toFixed(1)} s (recomandat ${prof.ctaHoldSec} s pentru ${prof.label}).`,
          recommendation: "Prelungește cardul final.",
          suggestedFix: [
            {
              op: "scene-extend",
              sceneId: cta.id,
              deltaSec: Math.ceil((prof.ctaHoldSec - cta.durationInFrames / t.fps + 0.1) * 10) / 10,
              currentSec: cta.durationInFrames / t.fps,
            },
          ],
          confidence: 0.85,
        });
      return out;
    },
  },
  {
    id: "platform.reframing",
    version: 1,
    pass: "platform",
    title: "Reîncadrarea pe format: zona demonstrată rămâne în cadru și în zona sigură la momentul de hold",
    categories: ["platform", "ui"],
    method: "timeline",
    perFormat: true,
    run: (ctx, fid) => {
      const t = ctx.timelines[fid];
      const fmt = ctx.formats.find((f) => f.id === fid)!;
      const safe = resolveSafeZone(fmt).rect;
      const frame = { x: 0, y: 0, w: t.width, h: t.height };
      const out: IssueDraft[] = [];
      t.scenes.forEach((s, i) => {
        const local = holdFrame(t, i);
        for (const r of focusRects(t, s, local)) {
          const a = Math.max(1, area(r));
          const inFrame = overlapArea(r, frame) / a;
          const inSafe = overlapArea(r, safe) / a;
          if (inFrame < 0.8)
            out.push({
              frame: s.from + local,
              sceneId: s.id,
              formatId: fid,
              dimension: "reframing",
              severity: "high",
              problem: `Pe ${fid}, zona demonstrată din ${s.id} iese din cadru (${Math.round(inFrame * 100)}% vizibilă).`,
              recommendation: "Decupează captura în jurul zonei pe acest format (portraitCrop) sau mută camera pe ea.",
              confidence: 0.8,
            });
          else if (inSafe < 0.7)
            out.push({
              frame: s.from + local,
              sceneId: s.id,
              formatId: fid,
              dimension: "reframing",
              severity: "medium",
              problem: `Pe ${fid}, zona demonstrată din ${s.id} stă mult în afara zonei sigure (${Math.round(inSafe * 100)}% în zona sigură).`,
              recommendation: "Adu zona în interiorul zonei sigure (sub butoanele platformei se pierde).",
              confidence: 0.7,
            });
          break;
        }
      });
      return out;
    },
  },
];
