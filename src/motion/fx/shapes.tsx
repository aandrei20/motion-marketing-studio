import React from "react";
import { z } from "zod";
import { withAlpha } from "../core/color";
import { resolveColor } from "../core/context";
import { EASE, SPRINGS, prog, sp } from "../core/easing";
import { ORIGINAL, defineLayer } from "../types";

const base = {
  category: "shape" as const,
  compatibleMedia: ["none" as const],
  status: "tested" as const,
  license: ORIGINAL,
  performance: "light" as const,
  timing: { model: "duration" as const, defaultFrames: 45, minFrames: 4 },
};
const hex = (c: string) => (c.startsWith("#") ? c : "#ffffff");

export const shapePanel = defineLayer({
  ...base,
  id: "shape.panel",
  title: "Panou / bloc de culoare",
  description: "Un dreptunghi (cu colțuri) în culoarea brandului care intră pe o direcție. Bază pentru text, separator grafic sau card de CTA.",
  tags: ["panel", "block", "card", "background", "graphic", "cta"],
  sfx: [{ sound: "swipe", at: "start", gainDb: -10 }],
  params: z.object({ color: z.string().default("primary"), radius: z.number().min(0).default(28), from: z.enum(["left", "right", "up", "down", "scale", "none"]).default("scale"), gradientTo: z.string().optional(), border: z.number().min(0).max(1).default(0) }),
  Component: ({ params: p, frame, env }) => {
    const s = sp(frame, env.fps, 0, SPRINGS.ui);
    const c = resolveColor(env.palette, p.color, "primary");
    const bg = p.gradientTo ? `linear-gradient(135deg, ${c}, ${resolveColor(env.palette, p.gradientTo)})` : c;
    const tr =
      p.from === "scale" ? `scale(${s})` : p.from === "left" ? `translateX(${(s - 1) * 110}%)` : p.from === "right" ? `translateX(${(1 - s) * 110}%)` : p.from === "up" ? `translateY(${(s - 1) * 110}%)` : p.from === "down" ? `translateY(${(1 - s) * 110}%)` : "none";
    return <div style={{ position: "absolute", inset: 0, background: bg, borderRadius: p.radius, transform: tr, boxShadow: p.border ? `inset 0 0 0 2px ${withAlpha("#ffffff", p.border)}` : undefined }} />;
  },
  example: { params: { color: "primary", gradientTo: "accent" }, durationInFrames: 30, box: "center" },
});

export const shapeLine = defineLayer({
  ...base,
  id: "shape.line-draw",
  title: "Linie / săgeată desenată",
  description: "O linie sau o curbă care se trasează între puncte, opțional cu vârf de săgeată. Pentru legături și indicații.",
  tags: ["line", "arrow", "draw", "path", "connect", "pointer"],
  sfx: [{ sound: "marker", at: "start", gainDb: -10 }],
  params: z.object({ points: z.array(z.object({ x: z.number(), y: z.number() })).min(2), curve: z.number().min(-1).max(1).default(0.2), color: z.string().default("accent"), width: z.number().min(1).max(40).default(6), arrow: z.boolean().default(true), drawFrames: z.number().int().min(2).default(16) }),
  Component: ({ params: p, frame, box, env }) => {
    const t = prog(frame, 0, p.drawFrames, EASE.inOut);
    const pts = p.points.map((q) => ({ x: q.x * box.w, y: q.y * box.h }));
    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const mx = (a.x + b.x) / 2 - (b.y - a.y) * p.curve;
      const my = (a.y + b.y) / 2 + (b.x - a.x) * p.curve;
      d += ` Q${mx},${my} ${b.x},${b.y}`;
    }
    const c = hex(resolveColor(env.palette, p.color, "accent"));
    const last = pts[pts.length - 1];
    const prev = pts[pts.length - 2];
    const ang = (Math.atan2(last.y - prev.y, last.x - prev.x) * 180) / Math.PI;
    return (
      <svg width={box.w} height={box.h} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <path d={d} fill="none" stroke={c} strokeWidth={p.width} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - t} />
        {p.arrow && t > 0.97 ? <path d={`M0,0 L${-p.width * 3.5},${-p.width * 2.2} M0,0 L${-p.width * 3.5},${p.width * 2.2}`} stroke={c} strokeWidth={p.width} strokeLinecap="round" transform={`translate(${last.x},${last.y}) rotate(${ang})`} /> : null}
      </svg>
    );
  },
  example: { params: { points: [{ x: 0.1, y: 0.8 }, { x: 0.5, y: 0.3 }, { x: 0.9, y: 0.5 }] }, durationInFrames: 30, box: { x: 200, y: 200, w: 1500, h: 600 } },
});

export const shapeRingPulse = defineLayer({
  ...base,
  id: "shape.ring-pulse",
  title: "Inel de impact",
  description: "Unul sau mai multe inele care se extind și se sting dintr-un punct, la un impact (logo, buton, drop).",
  tags: ["ring", "pulse", "impact", "shockwave", "hit"],
  sfx: [{ sound: "impact-small", at: "param:at", gainDb: -6 }],
  params: z.object({ at: z.number().int().min(0).default(0), rings: z.number().int().min(1).max(5).default(2), color: z.string().default("accent"), width: z.number().min(1).max(30).default(6) }),
  Component: ({ params: p, frame, box, env }) => {
    const c = resolveColor(env.palette, p.color, "accent");
    const size = Math.min(box.w, box.h);
    return (
      <div style={{ position: "absolute", inset: 0 }}>
        {Array.from({ length: p.rings }, (_, i) => {
          const t = prog(frame, p.at + i * 4, p.at + i * 4 + 22, EASE.out);
          if (t <= 0 || t >= 1) return null;
          const r = size * 0.5 * t;
          return <div key={i} style={{ position: "absolute", left: box.w / 2 - r, top: box.h / 2 - r, width: r * 2, height: r * 2, borderRadius: "50%", border: `${p.width * (1 - t) + 1}px solid ${c}`, opacity: 1 - t }} />;
        })}
      </div>
    );
  },
  example: { params: { at: 2 }, durationInFrames: 30, box: "center" },
});

export const SHAPES = [shapePanel, shapeLine, shapeRingPulse];
