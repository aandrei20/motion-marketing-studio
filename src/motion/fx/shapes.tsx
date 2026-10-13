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
  params: z.object({
    color: z.string().default("primary"),
    radius: z.number().min(0).default(28),
    from: z.enum(["left", "right", "up", "down", "scale", "none"]).default("scale"),
    gradientTo: z.string().optional(),
    border: z.number().min(0).max(1).default(0),
  }),
  Component: ({ params: p, frame, env }) => {
    const s = sp(frame, env.fps, 0, SPRINGS.ui);
    const c = resolveColor(env.palette, p.color, "primary");
    const bg = p.gradientTo ? `linear-gradient(135deg, ${c}, ${resolveColor(env.palette, p.gradientTo)})` : c;
    const tr =
      p.from === "scale"
        ? `scale(${s})`
        : p.from === "left"
          ? `translateX(${(s - 1) * 110}%)`
          : p.from === "right"
            ? `translateX(${(1 - s) * 110}%)`
            : p.from === "up"
              ? `translateY(${(s - 1) * 110}%)`
              : p.from === "down"
                ? `translateY(${(1 - s) * 110}%)`
                : "none";
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: bg,
          borderRadius: p.radius,
          transform: tr,
          boxShadow: p.border ? `inset 0 0 0 2px ${withAlpha("#ffffff", p.border)}` : undefined,
        }}
      />
    );
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
  params: z.object({
    points: z.array(z.object({ x: z.number(), y: z.number() })).min(2),
    curve: z.number().min(-1).max(1).default(0.2),
    color: z.string().default("accent"),
    width: z.number().min(1).max(40).default(6),
    arrow: z.boolean().default(true),
    drawFrames: z.number().int().min(2).default(16),
  }),
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
        {p.arrow && t > 0.97 ? (
          <path
            d={`M0,0 L${-p.width * 3.5},${-p.width * 2.2} M0,0 L${-p.width * 3.5},${p.width * 2.2}`}
            stroke={c}
            strokeWidth={p.width}
            strokeLinecap="round"
            transform={`translate(${last.x},${last.y}) rotate(${ang})`}
          />
        ) : null}
      </svg>
    );
  },
  example: {
    params: {
      points: [
        { x: 0.1, y: 0.8 },
        { x: 0.5, y: 0.3 },
        { x: 0.9, y: 0.5 },
      ],
    },
    durationInFrames: 30,
    box: { x: 200, y: 200, w: 1500, h: 600 },
  },
});

export const shapeRingPulse = defineLayer({
  ...base,
  id: "shape.ring-pulse",
  title: "Inel de impact",
  description: "Unul sau mai multe inele care se extind și se sting dintr-un punct, la un impact (logo, buton, drop).",
  tags: ["ring", "pulse", "impact", "shockwave", "hit"],
  sfx: [{ sound: "impact-small", at: "param:at", gainDb: -6 }],
  params: z.object({
    at: z.number().int().min(0).default(0),
    rings: z.number().int().min(1).max(5).default(2),
    color: z.string().default("accent"),
    width: z.number().min(1).max(30).default(6),
  }),
  Component: ({ params: p, frame, box, env }) => {
    const c = resolveColor(env.palette, p.color, "accent");
    const size = Math.min(box.w, box.h);
    return (
      <div style={{ position: "absolute", inset: 0 }}>
        {Array.from({ length: p.rings }, (_, i) => {
          const t = prog(frame, p.at + i * 4, p.at + i * 4 + 22, EASE.out);
          if (t <= 0 || t >= 1) return null;
          const r = size * 0.5 * t;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: box.w / 2 - r,
                top: box.h / 2 - r,
                width: r * 2,
                height: r * 2,
                borderRadius: "50%",
                border: `${p.width * (1 - t) + 1}px solid ${c}`,
                opacity: 1 - t,
              }}
            />
          );
        })}
      </div>
    );
  },
  example: { params: { at: 2 }, durationInFrames: 30, box: "center" },
});

/**
 * Setul de iconițe: trasee originale (licență proprie), desenate pe o grilă de 24 × 24, cu linie, fără umplere.
 * Fiecare iconiță e o listă de trasee; animația le desenează pe rând.
 */
export const ICONS = {
  check: ["M5 12.5l4.5 4.5L19 7.5"],
  x: ["M6 6l12 12", "M18 6L6 18"],
  plus: ["M12 5v14", "M5 12h14"],
  "arrow-right": ["M4 12h15", "M13 6l6 6-6 6"],
  star: ["M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"],
  bolt: ["M13 3L5 13.5h6L10 21l8-10.5h-6z"],
  clock: ["M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z", "M12 7.5V12l3 2"],
  lock: ["M6.5 11h11v9h-11z", "M9 11V8a3 3 0 0 1 6 0v3"],
  shield: ["M12 3l7 3v5.5c0 4.2-3 7.6-7 9.5-4-1.9-7-5.3-7-9.5V6z"],
  chart: ["M4 20h16", "M7 16v-5", "M12 16V7", "M17 16v-8"],
  users: ["M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M3.5 19c.8-3 3-4.5 5.5-4.5s4.7 1.5 5.5 4.5", "M16 11a2.5 2.5 0 1 0 0-5", "M17.5 14.5c1.6.5 2.6 1.9 3 4.5"],
  bell: ["M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z", "M10 20.5a2 2 0 0 0 4 0"],
  search: ["M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13z", "M15.5 15.5L20 20"],
  heart: ["M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"],
  sparkle: ["M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z"],
} as const;
export type IconName = keyof typeof ICONS;

export const shapeIcon = defineLayer({
  ...base,
  id: "shape.icon",
  title: "Iconiță desenată (set original)",
  description:
    "O iconiță din setul propriu (bifă, x, plus, săgeată, stea, fulger, ceas, lacăt, scut, grafic, oameni, clopoțel, căutare, inimă, scânteie) care se desenează din linie, apoi se așază cu un mic arc; opțional pe un disc colorat. Pentru liste de beneficii, pași și dovezi, niciodată în locul interfeței reale.",
  tags: ["icon", "pictogram", "symbol", "check", "benefit", "list", "draw"],
  sfx: [{ sound: "tick-soft", at: "start", gainDb: -8 }],
  params: z.object({
    name: z.enum(Object.keys(ICONS) as [IconName, ...IconName[]]).default("check"),
    color: z.string().default("accent"),
    /** grosimea liniei, în unitățile grilei de 24 */
    stroke: z.number().min(0.5).max(4).default(2),
    drawFrames: z.number().int().min(2).default(18),
    /** disc colorat sub iconiță (culoarea, translucidă) */
    disc: z.boolean().default(false),
  }),
  Component: ({ params: p, frame, box, env }) => {
    const c = hex(resolveColor(env.palette, p.color, "accent"));
    const paths = ICONS[p.name as IconName];
    const s = Math.min(box.w, box.h);
    const settle = sp(frame, env.fps, Math.round(p.drawFrames * 0.6), SPRINGS.pop);
    const scale = 0.9 + 0.1 * settle;
    return (
      <svg
        width={box.w}
        height={box.h}
        viewBox={`${(24 - (24 * box.w) / s) / 2} ${(24 - (24 * box.h) / s) / 2} ${(24 * box.w) / s} ${(24 * box.h) / s}`}
        style={{ position: "absolute", inset: 0, overflow: "visible" }}
      >
        <title>{p.name}</title>
        <g transform={`translate(12 12) scale(${scale.toFixed(4)}) translate(-12 -12)`}>
          {p.disc ? <circle cx={12} cy={12} r={11.5} fill={withAlpha(c, 0.16 * Math.min(1, settle + 0.2))} /> : null}
          {paths.map((d, i) => {
            // traseele se desenează pe rând, fiecare în partea lui din timpul de desen
            const t = prog(frame, (i * p.drawFrames) / paths.length, ((i + 1) * p.drawFrames) / paths.length, EASE.inOut);
            return (
              <path
                key={d}
                d={d}
                fill="none"
                stroke={c}
                strokeWidth={p.stroke}
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1 - t}
                transform={p.disc ? "translate(12 12) scale(0.62) translate(-12 -12)" : undefined}
              />
            );
          })}
        </g>
      </svg>
    );
  },
  example: { params: { name: "check", disc: true }, durationInFrames: 30, box: "center" },
});

export const SHAPES = [shapePanel, shapeLine, shapeRingPulse, shapeIcon];
