import React from "react";
import { z } from "zod";
import { resolveColor } from "../core/context";
import { EASE, SPRINGS, clamp, prog, sp } from "../core/easing";
import { ORIGINAL, defineLayer } from "../types";
import { fontSpecFor } from "./shared";
import { browserMeasure, layoutText } from "../core/text-layout";

const base = {
  category: "typography" as const,
  status: "tested" as const,
  performance: "light" as const,
  license: ORIGINAL,
};

export function formatNumber(v: number, decimals: number, locale: string, grouping: boolean): string {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: grouping }).format(v);
}

export const textCounter = defineLayer({
  ...base,
  id: "text.counter",
  title: "Contor animat",
  description:
    "Un număr care numără până la valoare (cu prefix/sufix, de ex. 99%, 3×, 10.000+). Valoarea trebuie să vină dintr-o afirmație verificată (claimId).",
  tags: ["counter", "number", "stat", "metric", "proof"],
  compatibleMedia: ["text"],
  timing: { model: "duration", defaultFrames: 60, minFrames: 24 },
  sfx: [{ sound: "counter", at: "start", gainDb: -8 }, { sound: "tick-hi", at: "param:countFrames", gainDb: -6 }],
  params: z.object({
    value: z.number(),
    from: z.number().default(0),
    decimals: z.number().int().min(0).max(4).default(0),
    prefix: z.string().default(""),
    suffix: z.string().default(""),
    locale: z.string().default("ro-RO"),
    grouping: z.boolean().default(true),
    countFrames: z.number().int().min(4).default(36),
    label: z.string().default(""),
    font: z.enum(["display", "body", "mono"]).default("display"),
    color: z.string().default("text"),
    accentColor: z.string().default("accent"),
    align: z.enum(["left", "center", "right"]).default("left"),
    /** id-ul afirmației din research care susține cifra (obligatoriu la validare) */
    claimId: z.string().optional(),
  }),
  Component: ({ params: p, frame, box, env }) => {
    const t = prog(frame, 0, p.countFrames, EASE.expoOut);
    const v = p.from + (p.value - p.from) * t;
    const final = `${p.prefix}${formatNumber(p.value, p.decimals, p.locale, p.grouping)}${p.suffix}`;
    const font = fontSpecFor(env, { font: p.font });
    const numberBox = { w: box.w, h: p.label ? box.h * 0.72 : box.h };
    const fit = layoutText(final, { ...font, tracking: -0.02 }, numberBox, browserMeasure, { maxSize: 400, minSize: 20, maxLines: 1 });
    const pop = sp(frame, env.fps, p.countFrames, SPRINGS.pop);
    const s = 1 + 0.06 * Math.sin(Math.min(1, pop) * Math.PI);
    const appear = sp(frame, env.fps, 0, SPRINGS.body);
    return (
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: p.align === "left" ? "flex-start" : p.align === "right" ? "flex-end" : "center", opacity: clamp(appear * 2, 0, 1) }}>
        <div
          style={{
            fontFamily: `"${font.family}"`,
            fontWeight: font.weight,
            fontSize: fit.fontSize,
            lineHeight: 1,
            letterSpacing: "-0.02em",
            color: resolveColor(env.palette, p.accentColor, "accent"),
            fontVariantNumeric: "tabular-nums",
            transform: `scale(${s})`,
            transformOrigin: p.align,
            whiteSpace: "nowrap",
          }}
        >
          {`${p.prefix}${formatNumber(v, p.decimals, p.locale, p.grouping)}${p.suffix}`}
        </div>
        {p.label ? (
          <div style={{ fontFamily: `"${env.typography.body.family}"`, fontWeight: 600, fontSize: Math.max(22, fit.fontSize * 0.22), color: resolveColor(env.palette, p.color, "text"), opacity: 0.85, marginTop: fit.fontSize * 0.08 }}>
            {p.label}
          </div>
        ) : null}
      </div>
    );
  },
  example: { params: { value: 12000, suffix: "+", label: "echipe active (exemplu)", claimId: "example" }, durationInFrames: 60, box: { x: 200, y: 280, w: 1200, h: 520 } },
});

export const textCaptions = defineLayer({
  ...base,
  id: "text.captions",
  title: "Subtitrări cuvânt cu cuvânt",
  description:
    "Subtitrări sincronizate cu vocea: fraza curentă, cu cuvântul rostit evidențiat (stil TikTok). Timpii vin din motorul TTS sau din estimare.",
  tags: ["captions", "subtitles", "karaoke", "accessibility", "social"],
  compatibleMedia: ["text"],
  timing: { model: "duration", defaultFrames: 120, minFrames: 10 },
  sfx: [],
  params: z.object({
    /** cadre relative la începutul stratului */
    words: z.array(z.object({ text: z.string(), from: z.number().int(), to: z.number().int() })).min(1),
    maxWords: z.number().int().min(1).max(10).default(4),
    style: z.enum(["highlight", "box", "pop"]).default("highlight"),
    color: z.string().default("#ffffff"),
    activeColor: z.string().default("accent"),
    size: z.number().min(16).max(200).default(64),
    uppercase: z.boolean().default(false),
  }),
  Component: ({ params: p, frame, env }) => {
    // grupează cuvintele în fraze de maximum maxWords, fără să traverseze pauze lungi
    const groups: Array<typeof p.words> = [];
    let cur: typeof p.words = [];
    for (const w of p.words) {
      const prev = cur[cur.length - 1];
      if (cur.length >= p.maxWords || (prev && (w.from - prev.to > env.fps * 0.35 || /[.!?…]$/.test(prev.text)))) {
        groups.push(cur);
        cur = [];
      }
      cur.push(w);
    }
    if (cur.length) groups.push(cur);
    const g = groups.find((gr) => frame >= gr[0].from && frame < gr[gr.length - 1].to + Math.round(env.fps * 0.25));
    if (!g) return null;
    const active = resolveColor(env.palette, p.activeColor, "accent");
    const base = resolveColor(env.palette, p.color, "text");
    return (
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: "0 0.28em", fontFamily: `"${env.typography.display.family}"`, fontWeight: 800, fontSize: p.size, lineHeight: 1.1, textAlign: "center", textTransform: p.uppercase ? "uppercase" : "none", textShadow: "0 4px 18px rgba(0,0,0,0.65), 0 0 2px rgba(0,0,0,0.8)" }}>
        {g.map((w, i) => {
          const on = frame >= w.from && frame < w.to;
          const said = frame >= w.from;
          const s = p.style === "pop" ? sp(frame, env.fps, w.from, SPRINGS.pop) : 1;
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                color: on && p.style !== "box" ? active : base,
                opacity: said || p.style !== "pop" ? 1 : 0.0,
                transform: `scale(${p.style === "pop" ? s : on ? 1.06 : 1})`,
                background: on && p.style === "box" ? active : "transparent",
                padding: p.style === "box" ? "0 0.12em" : 0,
                borderRadius: "0.12em",
              }}
            >
              {w.text}
            </span>
          );
        })}
      </div>
    );
  },
  example: {
    params: {
      words: [
        { text: "Fiecare", from: 0, to: 9 },
        { text: "cuvânt", from: 9, to: 18 },
        { text: "apare", from: 18, to: 27 },
        { text: "exact", from: 27, to: 36 },
        { text: "când", from: 38, to: 45 },
        { text: "e", from: 45, to: 49 },
        { text: "rostit", from: 49, to: 60 },
      ],
    },
    durationInFrames: 64,
    box: { x: 160, y: 760, w: 1600, h: 220 },
  },
});
