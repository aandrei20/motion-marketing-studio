import React from "react";
import { Img } from "remotion";
import { z } from "zod";
import { withAlpha } from "../core/color";
import { resolveColor, useAssetUrl, useOverlayScale } from "../core/context";
import { EASE, SPRINGS, clamp, prog, sp } from "../core/easing";
import { ORIGINAL, defineLayer } from "../types";

const base = {
  category: "ui" as const,
  compatibleMedia: ["screenshot" as const, "video" as const],
  status: "tested" as const,
  license: ORIGINAL,
  performance: "light" as const,
  timing: { model: "duration" as const, defaultFrames: 60, minFrames: 6 },
};

const hex = (c: string) => (c.startsWith("#") ? c : "#ffffff");
const Pt = z.object({ x: z.number(), y: z.number() });
const RectP = z.object({ x: z.number(), y: z.number(), w: z.number().positive(), h: z.number().positive() });

/** Exemplele de interfață se randează ca copii ai unui media.screen cu captura de probă. */
const childExample = (child: { capability: string; params: Record<string, unknown>; box: { x: number; y: number; w: number; h: number } }, durationInFrames = 60) => ({
  params: {},
  durationInFrames,
  box: "center" as const,
  needs: ["screenshot" as const],
  children: [{ id: "child", capability: child.capability, from: 0, durationInFrames, box: child.box, params: child.params }],
});

function Pointer({ size, color = "#ffffff", press = 0 }: { size: number; color?: string; press?: number }) {
  return (
    <svg width={size} height={size * 1.4} viewBox="0 0 20 28" style={{ transform: `scale(${1 - 0.15 * press})`, transformOrigin: "2px 2px", filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.45))", overflow: "visible" }}>
      <path d="M2 2 L2 22 L7.5 17 L11 25.5 L14.3 24 L10.8 15.8 L18 15.6 Z" fill={color} stroke="#111" strokeWidth={1.4} strokeLinejoin="round" />
    </svg>
  );
}

export const uiCursor = defineLayer({
  ...base,
  id: "ui.cursor",
  title: "Cursor animat cu clicuri",
  description: "Un cursor care trece prin puncte (în pixelii capturii), cu accelerare/încetinire naturală, arc ușor și undă la clic. Fiecare clic are sunet.",
  tags: ["cursor", "pointer", "click", "demo", "walkthrough", "interaction"],
  sfx: [{ sound: "click", at: "each" }],
  params: z.object({
    path: z.array(z.object({ at: z.number().int().min(0), x: z.number(), y: z.number(), click: z.boolean().default(false) })).min(1),
    size: z.number().min(10).max(120).default(34),
    color: z.string().default("#ffffff"),
    rippleColor: z.string().default("accent"),
    clickDelay: z.number().int().min(0).max(20).default(3),
  }),
  events: (p) => p.path.filter((pt) => pt.click).map((pt) => ({ at: pt.at + p.clickDelay })),
  Component: ({ params: p, frame, env }) => {
    const k = useOverlayScale();
    const pts = p.path;
    let x = pts[0].x;
    let y = pts[0].y;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      if (frame >= b.at) {
        x = b.x;
        y = b.y;
      } else if (frame > a.at) {
        const t = prog(frame, a.at, b.at, EASE.inOut);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const arc = Math.sin(Math.PI * t) * Math.hypot(dx, dy) * 0.08;
        const len = Math.hypot(dx, dy) || 1;
        x = a.x + dx * t + (-dy / len) * arc;
        y = a.y + dy * t + (dx / len) * arc;
        break;
      }
    }
    const appear = prog(frame, pts[0].at - 6, pts[0].at, EASE.out);
    const clicks = pts.filter((pt) => pt.click).map((pt) => ({ ...pt, t: pt.at + p.clickDelay }));
    const press = clicks.reduce((m, c) => Math.max(m, frame >= c.t && frame < c.t + 6 ? 1 - Math.abs(frame - c.t - 2) / 4 : 0), 0);
    const ripple = resolveColor(env.palette, p.rippleColor, "accent");
    const size = p.size / k;
    return (
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {clicks.map((c, i) => {
          const rt = prog(frame, c.t, c.t + 16, EASE.out);
          if (frame < c.t || rt >= 1) return null;
          const r = (10 + 60 * rt) / k;
          return <div key={i} style={{ position: "absolute", left: c.x - r, top: c.y - r, width: r * 2, height: r * 2, borderRadius: "50%", border: `${3 / k}px solid ${ripple}`, background: withAlpha(hex(ripple), 0.18 * (1 - rt)), opacity: 1 - rt }} />;
        })}
        <div style={{ position: "absolute", left: x - 2 / k, top: y - 2 / k, opacity: appear }}>
          <Pointer size={size} color={resolveColor(env.palette, p.color)} press={press} />
        </div>
      </div>
    );
  },
  example: childExample({ capability: "ui.cursor", params: { path: [{ at: 0, x: 200, y: 600 }, { at: 25, x: 700, y: 300, click: true }, { at: 50, x: 1000, y: 500, click: true }] }, box: { x: 0, y: 0, w: "$screenshot.w" as unknown as number, h: "$screenshot.h" as unknown as number } }),
});

export const uiClick = defineLayer({
  ...base,
  id: "ui.click",
  title: "Undă de clic",
  description: "Undă care pornește din punctul apăsat. Folosit și fără cursor, pentru tap-uri pe mobil.",
  tags: ["click", "tap", "ripple", "press", "mobile"],
  sfx: [{ sound: "click", at: "param:at" }],
  params: z.object({ x: z.number(), y: z.number(), at: z.number().int().min(0).default(0), color: z.string().default("accent"), size: z.number().default(70) }),
  Component: ({ params: p, frame, env }) => {
    const k = useOverlayScale();
    const t = prog(frame, p.at, p.at + 18, EASE.out);
    if (frame < p.at || t >= 1) return null;
    const c = resolveColor(env.palette, p.color, "accent");
    const r = ((p.size * 0.2 + p.size * t) / k);
    return (
      <>
        <div style={{ position: "absolute", left: p.x - r, top: p.y - r, width: r * 2, height: r * 2, borderRadius: "50%", border: `${4 / k}px solid ${c}`, opacity: 1 - t }} />
        <div style={{ position: "absolute", left: p.x - 14 / k, top: p.y - 14 / k, width: 28 / k, height: 28 / k, borderRadius: "50%", background: withAlpha(hex(c), 0.5 * (1 - t)) }} />
      </>
    );
  },
  example: childExample({ capability: "ui.click", params: { x: 600, y: 400, at: 5 }, box: { x: 0, y: 0, w: 10, h: 10 } }, 30),
});

export const uiHover = defineLayer({
  ...base,
  id: "ui.hover",
  title: "Hover: elementul se luminează",
  description: "Zona (un buton, un card) se luminează și se ridică ușor, ca la trecerea mouse-ului.",
  tags: ["hover", "glow", "focus", "button", "interaction"],
  sfx: [{ sound: "tick-soft", at: "start", gainDb: -12 }],
  params: z.object({ color: z.string().default("accent"), radius: z.number().default(12), intensity: z.number().min(0).max(1).default(0.6) }),
  Component: ({ params: p, frame, duration, env }) => {
    const k = useOverlayScale();
    const t = prog(frame, 0, 8, EASE.out) * (1 - prog(frame, duration - 6, duration, EASE.in));
    const c = hex(resolveColor(env.palette, p.color, "accent"));
    return <div style={{ position: "absolute", inset: 0, borderRadius: p.radius / k, background: withAlpha("#ffffff", 0.1 * t), boxShadow: `0 0 0 ${2 / k}px ${withAlpha(c, t)}, 0 0 ${30 / k}px ${withAlpha(c, p.intensity * t)}` }} />;
  },
  example: childExample({ capability: "ui.hover", params: {}, box: { x: 300, y: 250, w: 420, h: 120 } }),
});

export const uiTyping = defineLayer({
  ...base,
  id: "ui.typing",
  title: "Scriere într-un câmp real",
  description: "Text scris literă cu literă peste câmpul (input) găsit în captură, cu cursor de text. Fiecare tastă are sunet.",
  tags: ["typing", "input", "search", "form", "keyboard", "prompt"],
  sfx: [{ sound: "key", at: "each", gainDb: -10 }],
  params: z.object({ text: z.string().min(1), cps: z.number().min(2).max(60).default(14), at: z.number().int().min(0).default(4), color: z.string().default("#111111"), sizeRatio: z.number().min(0.2).max(0.9).default(0.45), paddingRatio: z.number().min(0).max(2).default(0.35), background: z.string().optional(), font: z.enum(["body", "mono", "display"]).default("body") }),
  events: (p) => [...p.text].map((ch, i) => ({ at: Math.round(p.at + (i * 30) / p.cps), ch })).filter((e) => e.ch !== " ").map(({ at }) => ({ at })),
  Component: ({ params: p, frame, box, env }) => {
    const n = Math.floor(clamp(((frame - p.at) / env.fps) * p.cps, 0, [...p.text].length));
    const blink = Math.floor(frame / Math.round(env.fps * 0.5)) % 2 === 0 || n < [...p.text].length;
    const fs = box.h * p.sizeRatio;
    return (
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", paddingLeft: box.h * p.paddingRatio, background: p.background ? resolveColor(env.palette, p.background) : undefined, fontFamily: `"${env.typography[p.font].family}"`, fontSize: fs, color: resolveColor(env.palette, p.color), whiteSpace: "pre", overflow: "hidden" }}>
        {[...p.text].slice(0, n).join("")}
        <span style={{ display: "inline-block", width: Math.max(1, fs * 0.06), height: fs * 1.1, marginLeft: fs * 0.04, background: resolveColor(env.palette, p.color), opacity: blink && frame >= p.at - 2 ? 1 : 0 }} />
      </div>
    );
  },
  example: childExample({ capability: "ui.typing", params: { text: "raport săptămânal", background: "#ffffff" }, box: { x: 300, y: 120, w: 700, h: 80 } }),
});

export const uiSpotlight = defineLayer({
  ...base,
  id: "ui.spotlight",
  title: "Spotlight pe o zonă",
  description: "Restul ecranului se întunecă; zona aleasă rămâne luminată, cu margine moale.",
  tags: ["spotlight", "focus", "dim", "attention", "highlight"],
  sfx: [{ sound: "whoosh-soft", at: "start", gainDb: -14 }],
  params: z.object({ region: RectP, dim: z.number().min(0).max(0.95).default(0.65), radius: z.number().default(16), feather: z.number().min(0).max(80).default(18), padding: z.number().default(10), frames: z.number().int().min(1).default(10) }),
  Component: ({ params: p, frame, duration, box, layer }) => {
    const k = useOverlayScale();
    const t = prog(frame, 0, p.frames, EASE.out) * (1 - prog(frame, duration - 6, duration, EASE.in));
    const r = { x: p.region.x - p.padding, y: p.region.y - p.padding, w: p.region.w + 2 * p.padding, h: p.region.h + 2 * p.padding };
    const id = `spot-${layer.id}`.replace(/[^a-zA-Z0-9-]/g, "");
    return (
      <svg width={box.w} height={box.h} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        <defs>
          <filter id={`${id}-f`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={p.feather / k} />
          </filter>
          <mask id={id}>
            <rect x={-box.w} y={-box.h} width={box.w * 3} height={box.h * 3} fill="white" />
            <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={p.radius / k} fill="black" filter={`url(#${id}-f)`} />
          </mask>
        </defs>
        <rect x={-box.w} y={-box.h} width={box.w * 3} height={box.h * 3} fill={`rgba(0,0,0,${(p.dim * t).toFixed(3)})`} mask={`url(#${id})`} />
      </svg>
    );
  },
  example: childExample({ capability: "ui.spotlight", params: { region: { x: 300, y: 250, w: 520, h: 200 } }, box: { x: 0, y: 0, w: "$screenshot.w" as unknown as number, h: "$screenshot.h" as unknown as number } }),
});

export const uiHighlight = defineLayer({
  ...base,
  id: "ui.highlight",
  title: "Contur desenat în jurul unei zone",
  description: "Un dreptunghi, o elipsă sau o subliniere se desenează în jurul zonei (animație de trasare).",
  tags: ["highlight", "outline", "circle", "underline", "draw", "attention"],
  sfx: [{ sound: "marker", at: "start", gainDb: -8 }],
  params: z.object({ shape: z.enum(["rect", "ellipse", "underline"]).default("rect"), color: z.string().default("accent"), stroke: z.number().default(5), padding: z.number().default(12), radius: z.number().default(14), drawFrames: z.number().int().min(2).default(14) }),
  Component: ({ params: p, frame, duration, box, env }) => {
    const k = useOverlayScale();
    const t = prog(frame, 0, p.drawFrames, EASE.inOut);
    const fade = 1 - prog(frame, duration - 5, duration, EASE.in);
    const c = resolveColor(env.palette, p.color, "accent");
    const pad = p.padding;
    const w = box.w + pad * 2;
    const h = box.h + pad * 2;
    const sw = p.stroke / k;
    return (
      <svg width={w} height={h} style={{ position: "absolute", left: -pad, top: -pad, overflow: "visible", opacity: fade }}>
        {p.shape === "rect" ? <rect x={sw / 2} y={sw / 2} width={w - sw} height={h - sw} rx={p.radius / k} fill="none" stroke={c} strokeWidth={sw} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - t} strokeLinecap="round" /> : null}
        {p.shape === "ellipse" ? <ellipse cx={w / 2} cy={h / 2} rx={w / 2 + sw} ry={h / 2 + sw} fill="none" stroke={c} strokeWidth={sw} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - t} strokeLinecap="round" /> : null}
        {p.shape === "underline" ? <line x1={pad} y1={h - pad / 2} x2={pad + (w - 2 * pad) * t} y2={h - pad / 2} stroke={c} strokeWidth={sw} strokeLinecap="round" /> : null}
      </svg>
    );
  },
  example: childExample({ capability: "ui.highlight", params: { shape: "rect" }, box: { x: 300, y: 250, w: 420, h: 120 } }),
});

export const uiCallout = defineLayer({
  ...base,
  id: "ui.callout",
  title: "Callout cu linie spre element",
  description: "O etichetă scurtă legată printr-o linie de o zonă din captură. Textul rămâne lizibil la orice zoom.",
  tags: ["callout", "label", "annotation", "pointer", "explain", "feature"],
  sfx: [{ sound: "pop", at: "start", gainDb: -8 }],
  params: z.object({
    text: z.string().min(1),
    side: z.enum(["top", "bottom", "left", "right"]).default("right"),
    distance: z.number().default(160),
    color: z.string().default("accent"),
    textColor: z.string().optional(),
    size: z.number().min(12).max(120).default(38),
  }),
  Component: ({ params: p, frame, duration, box, env }) => {
    const k = useOverlayScale();
    const s = sp(frame, env.fps, 4, SPRINGS.pop);
    const line = prog(frame, 0, 8, EASE.out);
    const fade = 1 - prog(frame, duration - 5, duration, EASE.in);
    const c = resolveColor(env.palette, p.color, "accent");
    const anchor = { x: p.side === "left" ? 0 : p.side === "right" ? box.w : box.w / 2, y: p.side === "top" ? 0 : p.side === "bottom" ? box.h : box.h / 2 };
    const d = p.distance / k;
    const end = { x: anchor.x + (p.side === "right" ? d : p.side === "left" ? -d : 0), y: anchor.y + (p.side === "bottom" ? d : p.side === "top" ? -d : 0) };
    const fs = p.size / k;
    const labelStyle: React.CSSProperties = {
      position: "absolute",
      left: end.x,
      top: end.y,
      transform: `translate(${p.side === "left" ? "-100%" : p.side === "right" ? "0" : "-50%"}, ${p.side === "top" ? "-100%" : p.side === "bottom" ? "0" : "-50%"}) scale(${s})`,
      transformOrigin: p.side === "left" ? "right center" : p.side === "right" ? "left center" : p.side === "top" ? "center bottom" : "center top",
      background: c,
      color: p.textColor ? resolveColor(env.palette, p.textColor) : "#0b0b0f",
      fontFamily: `"${env.typography.body.family}"`,
      fontWeight: 700,
      fontSize: fs,
      padding: `${fs * 0.35}px ${fs * 0.6}px`,
      borderRadius: fs * 0.4,
      whiteSpace: "nowrap",
      boxShadow: `0 ${8 / k}px ${24 / k}px rgba(0,0,0,0.35)`,
    };
    return (
      <div style={{ position: "absolute", inset: 0, opacity: fade, overflow: "visible" }}>
        <svg width={box.w} height={box.h} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
          <line x1={anchor.x} y1={anchor.y} x2={anchor.x + (end.x - anchor.x) * line} y2={anchor.y + (end.y - anchor.y) * line} stroke={c} strokeWidth={3 / k} />
          <circle cx={anchor.x} cy={anchor.y} r={7 / k} fill={c} />
        </svg>
        <div style={labelStyle}>{p.text}</div>
      </div>
    );
  },
  example: childExample({ capability: "ui.callout", params: { text: "Filtre rapide" }, box: { x: 300, y: 250, w: 420, h: 120 } }),
});

export const uiTooltip = defineLayer({
  ...base,
  id: "ui.tooltip",
  title: "Tooltip",
  description: "O bulă mică cu săgeată, deasupra unei zone, pentru o explicație de 2–4 cuvinte.",
  tags: ["tooltip", "hint", "bubble", "label", "explain"],
  sfx: [{ sound: "pop", at: "start", gainDb: -12 }],
  params: z.object({ text: z.string().min(1), color: z.string().default("surface"), textColor: z.string().default("text"), size: z.number().min(12).max(100).default(30) }),
  Component: ({ params: p, frame, duration, box, env }) => {
    const k = useOverlayScale();
    const s = sp(frame, env.fps, 0, SPRINGS.pop);
    const fade = 1 - prog(frame, duration - 4, duration, EASE.in);
    const fs = p.size / k;
    const bg = resolveColor(env.palette, p.color, "surface");
    return (
      <div style={{ position: "absolute", left: box.w / 2, top: -fs * 0.6, transform: `translate(-50%, -100%) scale(${s})`, transformOrigin: "50% 100%", opacity: fade }}>
        <div style={{ background: bg, color: resolveColor(env.palette, p.textColor, "text"), fontFamily: `"${env.typography.body.family}"`, fontWeight: 600, fontSize: fs, padding: `${fs * 0.3}px ${fs * 0.55}px`, borderRadius: fs * 0.35, whiteSpace: "nowrap", boxShadow: `0 ${6 / k}px ${18 / k}px rgba(0,0,0,0.3)` }}>{p.text}</div>
        <div style={{ position: "absolute", left: "50%", bottom: -fs * 0.28, width: fs * 0.56, height: fs * 0.56, marginLeft: -fs * 0.28, background: bg, transform: "rotate(45deg)", zIndex: -1 }} />
      </div>
    );
  },
  example: childExample({ capability: "ui.tooltip", params: { text: "Salvare automată" }, box: { x: 300, y: 300, w: 300, h: 80 } }),
});

export const uiDrag = defineLayer({
  ...base,
  id: "ui.drag",
  title: "Drag and drop",
  description: "O bucată din captură (zona sursă) este ridicată și mutată la o țintă, cu umbră; pixelii sunt cei reali.",
  tags: ["drag", "drop", "move", "kanban", "interaction"],
  sfx: [{ sound: "tick-soft", at: "param:at" }, { sound: "drop", at: "param:dropAt" }],
  params: z.object({ src: z.string(), imageWidth: z.number().positive(), imageHeight: z.number().positive(), from: RectP, to: Pt, at: z.number().int().min(0).default(6), dropAt: z.number().int().min(1).default(36), dimSource: z.boolean().default(true) }),
  Component: ({ params: p, frame }) => {
    const url = useAssetUrl();
    const k = useOverlayScale();
    const lift = prog(frame, p.at, p.at + 6, EASE.out) * (1 - prog(frame, p.dropAt, p.dropAt + 6, EASE.out));
    const t = prog(frame, p.at + 4, p.dropAt, EASE.inOut);
    const x = p.from.x + (p.to.x - p.from.x) * t;
    const y = p.from.y + (p.to.y - p.from.y) * t;
    const started = frame >= p.at;
    return (
      <>
        {p.dimSource && started && frame < p.dropAt + 6 ? <div style={{ position: "absolute", left: p.from.x, top: p.from.y, width: p.from.w, height: p.from.h, background: "rgba(0,0,0,0.35)", borderRadius: 8 / k }} /> : null}
        {started ? (
          <div style={{ position: "absolute", left: x, top: y, width: p.from.w, height: p.from.h, overflow: "hidden", borderRadius: 10 / k, transform: `scale(${1 + 0.05 * lift}) rotate(${2 * lift}deg)`, boxShadow: `0 ${20 * lift / k}px ${40 * lift / k}px rgba(0,0,0,${0.45 * lift})` }}>
            <Img src={url(p.src)} style={{ position: "absolute", left: -p.from.x, top: -p.from.y, width: p.imageWidth, height: p.imageHeight, maxWidth: "none" }} />
          </div>
        ) : null}
      </>
    );
  },
  example: childExample({ capability: "ui.drag", params: { src: "$screenshot", imageWidth: "$screenshot.w", imageHeight: "$screenshot.h", from: { x: 100, y: 200, w: 360, h: 140 }, to: { x: 700, y: 420 } }, box: { x: 0, y: 0, w: 10, h: 10 } }),
});

export const uiBlurRegion = defineLayer({
  ...base,
  id: "ui.blur-region",
  title: "Estompare date personale",
  description: "Estompează o zonă cu date personale (email, nume de cont). Se aplică doar cu acordul utilizatorului (pii.blurApproved).",
  tags: ["blur", "privacy", "pii", "redact", "personal-data"],
  sfx: [],
  params: z.object({ amount: z.number().min(2).max(60).default(16) }),
  Component: ({ params: p }) => {
    const k = useOverlayScale();
    return <div style={{ position: "absolute", inset: 0, backdropFilter: `blur(${p.amount / k}px)`, WebkitBackdropFilter: `blur(${p.amount / k}px)`, borderRadius: 6 / k }} />;
  },
  example: childExample({ capability: "ui.blur-region", params: {}, box: { x: 300, y: 250, w: 420, h: 120 } }),
});

export const UI_OVERLAYS = [uiCursor, uiClick, uiHover, uiTyping, uiSpotlight, uiHighlight, uiCallout, uiTooltip, uiDrag, uiBlurRegion];
