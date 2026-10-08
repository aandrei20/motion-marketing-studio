import React from "react";
import { z } from "zod";
import { withAlpha } from "../core/color";
import { resolveColor } from "../core/context";
import { EASE, SPRINGS, clamp, prog, sp } from "../core/easing";
import { formatNumber } from "../typography/counter-captions";
import { ORIGINAL, defineLayer } from "../types";

/**
 * Graficele afișează doar cifre cu sursă: validatorul cere `claimId` spre o afirmație utilizabilă
 * din research (regula „fără minciuni”).
 */
const base = {
  category: "data" as const,
  compatibleMedia: ["none" as const],
  status: "tested" as const,
  license: ORIGINAL,
  performance: "light" as const,
  timing: { model: "duration" as const, defaultFrames: 75, minFrames: 20 },
};
const hex = (c: string) => (c.startsWith("#") ? c : "#ffffff");
const Claim = z.string().optional();

function Label({ env, children, size, color, align = "left" }: { env: { typography: { body: { family: string } } }; children: React.ReactNode; size: number; color: string; align?: "left" | "center" }) {
  return <div style={{ fontFamily: `"${env.typography.body.family}"`, fontWeight: 600, fontSize: size, color, textAlign: align, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{children}</div>;
}

export const dataBars = defineLayer({
  ...base,
  id: "data.bars",
  title: "Bare animate",
  description: "Bare care cresc pe rând până la valorile lor, cu etichetă și valoare. Sunet tick pe fiecare bară.",
  tags: ["bars", "chart", "data", "comparison", "growth"],
  sfx: [{ sound: "tick", at: "each", gainDb: -8 }],
  params: z.object({ items: z.array(z.object({ label: z.string(), value: z.number() })).min(1), max: z.number().optional(), stagger: z.number().int().min(0).default(5), color: z.string().default("accent"), highlightIndex: z.number().int().optional(), suffix: z.string().default(""), decimals: z.number().int().min(0).default(0), claimId: Claim }),
  events: (p) => p.items.map((_, i) => ({ at: i * p.stagger + 10 })),
  Component: ({ params: p, frame, box, env }) => {
    const max = p.max ?? Math.max(...p.items.map((i) => i.value));
    const n = p.items.length;
    const gap = box.h * 0.06;
    const rowH = (box.h - gap * (n - 1)) / n;
    const labelW = box.w * 0.28;
    const muted = resolveColor(env.palette, "textMuted");
    const text = resolveColor(env.palette, "text");
    return (
      <div style={{ position: "absolute", inset: 0 }}>
        {p.items.map((it, i) => {
          const s = sp(frame, env.fps, i * p.stagger, SPRINGS.body);
          const w = (box.w - labelW - box.w * 0.16) * (it.value / max) * clamp(s, 0, 1);
          const c = p.highlightIndex === undefined || p.highlightIndex === i ? resolveColor(env.palette, p.color, "accent") : muted;
          return (
            <div key={i} style={{ position: "absolute", left: 0, top: i * (rowH + gap), height: rowH, width: box.w, display: "flex", alignItems: "center", gap: box.w * 0.02 }}>
              <div style={{ width: labelW }}><Label env={env} size={rowH * 0.36} color={text}>{it.label}</Label></div>
              <div style={{ width: w, height: rowH * 0.62, borderRadius: rowH * 0.12, background: c }} />
              <Label env={env} size={rowH * 0.36} color={text}>{formatNumber(it.value * clamp(s, 0, 1), p.decimals, "ro-RO", true)}{p.suffix}</Label>
            </div>
          );
        })}
      </div>
    );
  },
  example: { params: { items: [{ label: "Luni", value: 3 }, { label: "Marți", value: 5 }, { label: "Miercuri", value: 8 }], highlightIndex: 2, claimId: "example" }, durationInFrames: 50, box: { x: 260, y: 300, w: 1400, h: 420 } },
});

export const dataLine = defineLayer({
  ...base,
  id: "data.line",
  title: "Linie / sparkline care se desenează",
  description: "O linie de date se trasează de la stânga la dreapta, cu zonă umplută și punct final. Mică (sparkline) sau mare.",
  tags: ["line", "chart", "trend", "sparkline", "growth", "data"],
  sfx: [{ sound: "whoosh-soft", at: "start", gainDb: -10 }, { sound: "tick-hi", at: "param:drawFrames", gainDb: -6 }],
  params: z.object({ points: z.array(z.number()).min(2), drawFrames: z.number().int().min(4).default(40), color: z.string().default("accent"), fill: z.boolean().default(true), stroke: z.number().min(1).max(20).default(6), claimId: Claim }),
  Component: ({ params: p, frame, box, env, layer }) => {
    const uid = layer.id.replace(/[^a-zA-Z0-9-]/g, "_");
    const t = prog(frame, 0, p.drawFrames, EASE.inOut);
    const min = Math.min(...p.points);
    const max = Math.max(...p.points);
    const pad = p.stroke * 2;
    const pts = p.points.map((v, i) => ({ x: pad + (i / (p.points.length - 1)) * (box.w - 2 * pad), y: pad + (1 - (v - min) / (max - min || 1)) * (box.h - 2 * pad) }));
    const d = pts.map((q, i) => `${i ? "L" : "M"}${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(" ");
    const c = hex(resolveColor(env.palette, p.color, "accent"));
    const endIdx = t * (pts.length - 1);
    const i0 = Math.floor(endIdx);
    const f = endIdx - i0;
    const a = pts[i0];
    const b = pts[Math.min(pts.length - 1, i0 + 1)];
    const head = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
    return (
      <svg width={box.w} height={box.h} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <defs>
          <linearGradient id={`dl-fill-${uid}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={c} stopOpacity={0.35} />
            <stop offset="1" stopColor={c} stopOpacity={0} />
          </linearGradient>
          <clipPath id={`dl-clip-${uid}`}>
            <rect x={0} y={-box.h} width={head.x} height={box.h * 3} />
          </clipPath>
        </defs>
        {p.fill ? <path d={`${d} L${pts[pts.length - 1].x},${box.h} L${pts[0].x},${box.h} Z`} fill={`url(#dl-fill-${uid})`} clipPath={`url(#dl-clip-${uid})`} /> : null}
        <path d={d} fill="none" stroke={c} strokeWidth={p.stroke} strokeLinejoin="round" strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - t} />
        {t > 0 ? <circle cx={head.x} cy={head.y} r={p.stroke * 1.6} fill={c} stroke={withAlpha(c, 0.35)} strokeWidth={p.stroke * 2} /> : null}
      </svg>
    );
  },
  example: { params: { points: [2, 3, 2.6, 4, 5.2, 4.8, 7], claimId: "example" }, durationInFrames: 50, box: { x: 260, y: 300, w: 1400, h: 440 } },
});

export const dataRing = defineLayer({
  ...base,
  id: "data.ring",
  title: "Inel de progres / gauge",
  description: "Un inel care se umple până la un procent, cu numărul în centru.",
  tags: ["ring", "gauge", "progress", "percent", "donut", "metric"],
  sfx: [{ sound: "counter", at: "start", gainDb: -10 }, { sound: "ding", at: "param:fillFrames", gainDb: -6 }],
  params: z.object({ value: z.number().min(0).max(100), label: z.string().default(""), fillFrames: z.number().int().min(4).default(40), color: z.string().default("accent"), track: z.string().default("surface"), stroke: z.number().min(0.02).max(0.3).default(0.1), claimId: Claim }),
  Component: ({ params: p, frame, box, env }) => {
    const t = prog(frame, 0, p.fillFrames, EASE.out);
    const size = Math.min(box.w, box.h);
    const sw = size * p.stroke;
    const r = (size - sw) / 2;
    const c = resolveColor(env.palette, p.color, "accent");
    return (
      <div style={{ position: "absolute", left: (box.w - size) / 2, top: (box.h - size) / 2, width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={resolveColor(env.palette, p.track, "surface")} strokeWidth={sw} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" pathLength={100} strokeDasharray={100} strokeDashoffset={100 - p.value * t} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: `"${env.typography.display.family}"`, color: resolveColor(env.palette, "text") }}>
          <div style={{ fontWeight: 800, fontSize: size * 0.24, fontVariantNumeric: "tabular-nums" }}>{Math.round(p.value * t)}%</div>
          {p.label ? <div style={{ fontFamily: `"${env.typography.body.family}"`, fontWeight: 600, fontSize: size * 0.07, opacity: 0.8 }}>{p.label}</div> : null}
        </div>
      </div>
    );
  },
  example: { params: { value: 72, label: "exemplu", claimId: "example" }, durationInFrames: 50, box: { x: 710, y: 240, w: 500, h: 500 } },
});

export const dataCompare = defineLayer({
  ...base,
  id: "data.compare",
  title: "Comparație între două valori",
  description: "Două bare verticale una lângă alta (de ex. „înainte” și „după”), cu valorile numărând.",
  tags: ["compare", "versus", "before-after", "data", "metric"],
  sfx: [{ sound: "tick", at: "start", gainDb: -8 }, { sound: "impact-small", at: "param:revealAt", gainDb: -6 }],
  params: z.object({ a: z.object({ label: z.string(), value: z.number() }), b: z.object({ label: z.string(), value: z.number() }), revealAt: z.number().int().min(0).default(14), suffix: z.string().default(""), decimals: z.number().int().min(0).default(0), colorA: z.string().default("textMuted"), colorB: z.string().default("accent"), claimId: Claim }),
  Component: ({ params: p, frame, box, env }) => {
    const max = Math.max(p.a.value, p.b.value) || 1;
    const sa = sp(frame, env.fps, 0, SPRINGS.body);
    const sb = sp(frame, env.fps, p.revealAt, SPRINGS.ui);
    const colW = box.w * 0.28;
    const labelH = box.h * 0.14;
    const maxH = box.h - labelH * 2.2;
    const col = (it: { label: string; value: number }, s: number, color: string, x: number) => (
      <div style={{ position: "absolute", left: x, bottom: 0, width: colW, height: box.h, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", gap: labelH * 0.15 }}>
        <div style={{ fontFamily: `"${env.typography.display.family}"`, fontWeight: 800, fontSize: labelH * 0.8, color: resolveColor(env.palette, "text") }}>{formatNumber(it.value * clamp(s, 0, 1), p.decimals, "ro-RO", true)}{p.suffix}</div>
        <div style={{ width: "100%", height: maxH * (it.value / max) * clamp(s, 0, 1.05), background: resolveColor(env.palette, color), borderRadius: colW * 0.08 }} />
        <Label env={env} size={labelH * 0.5} color={resolveColor(env.palette, "textMuted")} align="center">{it.label}</Label>
      </div>
    );
    return (
      <div style={{ position: "absolute", inset: 0 }}>
        {col(p.a, sa, p.colorA, box.w * 0.14)}
        {col(p.b, sb, p.colorB, box.w * 0.58)}
      </div>
    );
  },
  example: { params: { a: { label: "Înainte", value: 40 }, b: { label: "După", value: 12 }, suffix: " min", claimId: "example" }, durationInFrames: 50, box: { x: 460, y: 160, w: 1000, h: 760 } },
});

export const dataPie = defineLayer({
  ...base,
  id: "data.pie",
  title: "Grafic circular (donut)",
  description: "Segmente care se desenează pe rând într-un donut, cu legendă.",
  tags: ["pie", "donut", "share", "distribution", "data"],
  sfx: [{ sound: "tick", at: "each", gainDb: -10 }],
  params: z.object({ items: z.array(z.object({ label: z.string(), value: z.number().positive(), color: z.string().optional() })).min(1), stagger: z.number().int().min(1).default(10), claimId: Claim }),
  events: (p) => p.items.map((_, i) => ({ at: i * p.stagger })),
  Component: ({ params: p, frame, box, env }) => {
    const total = p.items.reduce((s, i) => s + i.value, 0);
    const size = Math.min(box.h, box.w * 0.55);
    const r = size * 0.38;
    const sw = size * 0.16;
    const defaults = ["primary", "accent", "secondary", "textMuted"];
    let acc = 0;
    return (
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", gap: box.w * 0.05 }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
          {p.items.map((it, i) => {
            const share = (it.value / total) * 100;
            const t = prog(frame, i * p.stagger, i * p.stagger + 14, EASE.out);
            const el = <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={resolveColor(env.palette, it.color ?? defaults[i % 4])} strokeWidth={sw} pathLength={100} strokeDasharray={`${(share * t).toFixed(3)} ${100}`} strokeDashoffset={-acc} />;
            acc += share;
            return el;
          })}
        </svg>
        <div style={{ display: "flex", flexDirection: "column", gap: size * 0.05 }}>
          {p.items.map((it, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: size * 0.04, opacity: prog(frame, i * p.stagger, i * p.stagger + 8) }}>
              <div style={{ width: size * 0.06, height: size * 0.06, borderRadius: 4, background: resolveColor(env.palette, it.color ?? defaults[i % 4]) }} />
              <Label env={env} size={size * 0.07} color={resolveColor(env.palette, "text")}>{it.label} · {Math.round((it.value / total) * 100)}%</Label>
            </div>
          ))}
        </div>
      </div>
    );
  },
  example: { params: { items: [{ label: "A", value: 50 }, { label: "B", value: 30 }, { label: "C", value: 20 }], claimId: "example" }, durationInFrames: 50, box: { x: 300, y: 240, w: 1300, h: 600 } },
});

export const dataTimeline = defineLayer({
  ...base,
  id: "data.timeline",
  title: "Linie de timp / pași",
  description: "O linie se desenează și dezvăluie pe rând etape (pași ai unui flux sau momente dintr-o lansare).",
  tags: ["timeline", "steps", "milestones", "how-it-works", "process"],
  sfx: [{ sound: "pop", at: "each", gainDb: -8 }],
  params: z.object({ items: z.array(z.object({ label: z.string(), sub: z.string().default("") })).min(2), stagger: z.number().int().min(2).default(12), color: z.string().default("accent"), claimId: Claim }),
  events: (p) => p.items.map((_, i) => ({ at: i * p.stagger + 4 })),
  Component: ({ params: p, frame, box, env }) => {
    const n = p.items.length;
    const c = resolveColor(env.palette, p.color, "accent");
    const lineT = prog(frame, 0, (n - 1) * p.stagger + 8, EASE.inOut);
    const y = box.h * 0.35;
    const dot = Math.min(box.h * 0.1, 40);
    return (
      <div style={{ position: "absolute", inset: 0 }}>
        <div style={{ position: "absolute", left: dot, top: y - 3, height: 6, width: (box.w - 2 * dot) * lineT, background: c, borderRadius: 3 }} />
        {p.items.map((it, i) => {
          const x = dot + (i / (n - 1)) * (box.w - 2 * dot);
          const s = sp(frame, env.fps, i * p.stagger + 4, SPRINGS.pop);
          return (
            <div key={i} style={{ position: "absolute", left: x, top: y, transform: "translate(-50%, -50%)" }}>
              <div style={{ width: dot, height: dot, borderRadius: "50%", background: c, transform: `scale(${s})`, margin: "0 auto", boxShadow: `0 0 20px ${withAlpha(hex(c), 0.6)}` }} />
              <div style={{ position: "absolute", top: dot * 1.4, left: "50%", transform: `translateX(-50%) translateY(${(1 - clamp(s, 0, 1)) * 20}px)`, opacity: clamp(s, 0, 1), textAlign: "center", width: (box.w / n) * 0.95 }}>
                <div style={{ fontFamily: `"${env.typography.display.family}"`, fontWeight: 700, fontSize: box.h * 0.09, color: resolveColor(env.palette, "text") }}>{it.label}</div>
                {it.sub ? <div style={{ fontFamily: `"${env.typography.body.family}"`, fontSize: box.h * 0.06, color: resolveColor(env.palette, "textMuted"), marginTop: 6 }}>{it.sub}</div> : null}
              </div>
            </div>
          );
        })}
      </div>
    );
  },
  example: { params: { items: [{ label: "Conectezi", sub: "pasul 1" }, { label: "Configurezi", sub: "pasul 2" }, { label: "Lansezi", sub: "pasul 3" }] }, durationInFrames: 60, box: { x: 200, y: 300, w: 1520, h: 500 } },
});

export const DATA = [dataBars, dataLine, dataRing, dataCompare, dataPie, dataTimeline];
