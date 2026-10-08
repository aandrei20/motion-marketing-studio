import React, { useLayoutEffect, useRef } from "react";
import { z } from "zod";
import { fbm1, hashString, mulberry32, rand } from "../../core/random";
import { hexToRgb, withAlpha } from "../core/color";
import { resolveColor } from "../core/context";
import { EASE, clamp, prog } from "../core/easing";
import { ORIGINAL, defineLayer } from "../types";

const hex = (c: string) => (c.startsWith("#") ? c : "#ffffff");

const fxBase = {
  compatibleMedia: ["none" as const, "scene" as const],
  status: "tested" as const,
  license: ORIGINAL,
  timing: { model: "loop" as const, defaultFrames: 90, minFrames: 1 },
};

/** Canvas desenat sincron la fiecare cadru (determinist: doar din cadru și sămânță). */
function FrameCanvas({ w, h, scale = 1, draw, style }: { w: number; h: number; scale?: number; draw: (ctx: CanvasRenderingContext2D, cw: number, ch: number) => void; style?: React.CSSProperties }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, cw, ch);
    draw(ctx, cw, ch);
  });
  return <canvas ref={ref} width={cw} height={ch} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", ...style }} />;
}

export const fxGrain = defineLayer({
  ...fxBase,
  id: "fx.grain",
  category: "texture",
  title: "Grain de film",
  description: "Zgomot fin, schimbat de câteva ori pe secundă, ca pe film. Calculat cu sămânță pe cadru (determinist).",
  tags: ["grain", "film", "texture", "noise", "cinematic"],
  performance: "medium",
  sfx: [],
  params: z.object({ opacity: z.number().min(0).max(0.5).default(0.06), refreshFps: z.number().min(1).max(60).default(12), resolution: z.number().min(0.1).max(1).default(0.35) }),
  Component: ({ params: p, frame, box, env, layer }) => {
    const step = Math.floor((frame / env.fps) * p.refreshFps);
    return (
      <FrameCanvas
        w={box.w}
        h={box.h}
        scale={env.quality === "draft" ? p.resolution * 0.5 : p.resolution}
        style={{ opacity: p.opacity, mixBlendMode: "overlay", imageRendering: "pixelated" }}
        draw={(ctx, cw, ch) => {
          const img = ctx.createImageData(cw, ch);
          const r = mulberry32(hashString(`${layer.id}:${env.seed}:${step}`));
          for (let i = 0; i < img.data.length; i += 4) {
            const v = r() * 255;
            img.data[i] = v;
            img.data[i + 1] = v;
            img.data[i + 2] = v;
            img.data[i + 3] = 255;
          }
          ctx.putImageData(img, 0, 0);
        }}
      />
    );
  },
  example: { params: { opacity: 0.2 }, durationInFrames: 30, box: "full" },
});

export const fxVignette = defineLayer({
  ...fxBase,
  id: "fx.vignette",
  category: "light",
  title: "Vignetă",
  description: "Margini ușor întunecate care duc ochiul spre centru.",
  tags: ["vignette", "focus", "cinematic", "subtle"],
  performance: "light",
  sfx: [],
  params: z.object({ strength: z.number().min(0).max(1).default(0.45), color: z.string().default("#000000") }),
  Component: ({ params: p, env }) => (
    <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at center, transparent 45%, ${withAlpha(hex(resolveColor(env.palette, p.color)), p.strength)} 100%)` }} />
  ),
  example: { params: { strength: 0.7 }, durationInFrames: 30, box: "full" },
});

export const fxLightSweep = defineLayer({
  ...fxBase,
  id: "fx.light-sweep",
  category: "light",
  title: "Dungă de lumină (light sweep)",
  description: "O bandă de lumină traversează cutia o dată, pe diagonală. Pune accent pe un element sau pe un logo.",
  tags: ["light", "sweep", "shine", "glint", "premium", "logo"],
  performance: "light",
  sfx: [{ sound: "shimmer", at: "start", gainDb: -10 }],
  params: z.object({ angle: z.number().default(20), width: z.number().min(0.02).max(0.6).default(0.18), color: z.string().default("#ffffff"), intensity: z.number().min(0).max(1).default(0.55), start: z.number().min(0).max(1).default(0), end: z.number().min(0).max(1).default(0.6) }),
  Component: ({ params: p, frame, duration, env }) => {
    const t = prog(frame, p.start * duration, p.end * duration, EASE.inOut);
    const pos = -30 + t * 160;
    const c = hex(resolveColor(env.palette, p.color));
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          mixBlendMode: "screen",
          background: `linear-gradient(${90 + p.angle}deg, transparent ${pos - p.width * 100}%, ${withAlpha(c, p.intensity)} ${pos}%, transparent ${pos + p.width * 100}%)`,
          opacity: t > 0 && t < 1 ? 1 : 0,
        }}
      />
    );
  },
  example: { params: { end: 0.9 }, durationInFrames: 40, box: "full" },
});

export const fxGlowOrbs = defineLayer({
  ...fxBase,
  id: "fx.glow-orbs",
  category: "light",
  title: "Lumini difuze (glow / bloom)",
  description: "Surse de lumină mari și moi care respiră lent. Dau strălucire și adâncime fundalului.",
  tags: ["glow", "bloom", "light", "orbs", "ambient", "premium"],
  performance: "light",
  sfx: [],
  params: z.object({ colors: z.array(z.string()).min(1).default(["primary", "accent"]), count: z.number().int().min(1).max(8).default(3), size: z.number().min(0.1).max(1.5).default(0.6), intensity: z.number().min(0).max(1).default(0.5), speed: z.number().min(0).max(3).default(0.5) }),
  Component: ({ params: p, frame, env, layer }) => (
    <div style={{ position: "absolute", inset: 0, mixBlendMode: "screen", overflow: "hidden" }}>
      {Array.from({ length: p.count }, (_, i) => {
        const t = (frame / env.fps) * p.speed;
        const x = 50 + 35 * fbm1(`${layer.id}:ox${i}`, t * 0.4 + i * 7);
        const y = 50 + 35 * fbm1(`${layer.id}:oy${i}`, t * 0.4 + i * 13);
        const breathe = 0.75 + 0.25 * Math.sin(t * 1.3 + i);
        const c = hex(resolveColor(env.palette, p.colors[i % p.colors.length], "primary"));
        const s = p.size * 100;
        return <div key={i} style={{ position: "absolute", left: `${x - s / 2}%`, top: `${y - s / 2}%`, width: `${s}%`, aspectRatio: "1", background: `radial-gradient(closest-side, ${withAlpha(c, p.intensity * breathe)}, transparent)` }} />;
      })}
    </div>
  ),
  example: { params: {}, durationInFrames: 60, box: "full" },
});

export const fxGodRays = defineLayer({
  ...fxBase,
  id: "fx.god-rays",
  category: "light",
  title: "Raze de lumină",
  description: "Raze care pornesc dintr-un punct și se rotesc lent, pentru o revelare (produs, logo).",
  tags: ["rays", "god-rays", "reveal", "light", "epic", "launch"],
  performance: "light",
  sfx: [],
  params: z.object({ color: z.string().default("#ffffff"), x: z.number().min(0).max(1).default(0.5), y: z.number().min(0).max(1).default(0.4), rays: z.number().int().min(4).max(64).default(18), intensity: z.number().min(0).max(1).default(0.22), degPerSec: z.number().default(6) }),
  Component: ({ params: p, frame, env }) => {
    const c = hex(resolveColor(env.palette, p.color));
    const a = (frame / env.fps) * p.degPerSec;
    const step = 360 / p.rays;
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          mixBlendMode: "screen",
          background: `repeating-conic-gradient(from ${a.toFixed(2)}deg at ${p.x * 100}% ${p.y * 100}%, ${withAlpha(c, p.intensity)} 0deg, transparent ${(step * 0.35).toFixed(2)}deg, transparent ${step.toFixed(2)}deg)`,
          maskImage: `radial-gradient(circle at ${p.x * 100}% ${p.y * 100}%, black 0%, transparent 70%)`,
          WebkitMaskImage: `radial-gradient(circle at ${p.x * 100}% ${p.y * 100}%, black 0%, transparent 70%)`,
        }}
      />
    );
  },
  example: { params: { intensity: 0.4 }, durationInFrames: 60, box: "full" },
});

export const fxScanlines = defineLayer({
  ...fxBase,
  id: "fx.scanlines",
  category: "texture",
  title: "Scanlines / CRT",
  description: "Linii orizontale fine și o bandă care rulează, ca pe un monitor vechi. Folosit rar.",
  tags: ["scanlines", "crt", "retro", "tech", "glitch"],
  performance: "light",
  sfx: [],
  params: z.object({ opacity: z.number().min(0).max(1).default(0.15), spacing: z.number().min(2).max(20).default(4), roll: z.boolean().default(true) }),
  Component: ({ params: p, frame, env }) => (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <div style={{ position: "absolute", inset: 0, opacity: p.opacity, backgroundImage: `repeating-linear-gradient(0deg, rgba(0,0,0,0.9) 0px, rgba(0,0,0,0.9) 1px, transparent 1px, transparent ${p.spacing}px)` }} />
      {p.roll ? <div style={{ position: "absolute", left: 0, right: 0, height: "12%", top: `${((frame / env.fps) * 40) % 112 - 12}%`, background: "linear-gradient(transparent, rgba(255,255,255,0.06), transparent)" }} /> : null}
    </div>
  ),
  example: { params: { opacity: 0.35 }, durationInFrames: 30, box: "full" },
});

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  a: number;
  phase: number;
  color: string;
}

export const fxParticles = defineLayer({
  ...fxBase,
  id: "fx.particles",
  category: "particles",
  title: "Particule (praf, scântei, bokeh, jar)",
  description: "Particule cu poziții din sămânță și mișcare calculată din cadru. Numărul se reduce automat în modul draft.",
  tags: ["particles", "dust", "sparks", "bokeh", "embers", "ambient", "magic"],
  performance: "medium",
  sfx: [],
  params: z.object({
    mode: z.enum(["dust", "sparks", "bokeh", "embers", "snow"]).default("dust"),
    count: z.number().int().min(1).max(600).default(80),
    colors: z.array(z.string()).min(1).default(["#ffffff"]),
    speed: z.number().min(0).max(5).default(1),
    opacity: z.number().min(0).max(1).default(0.6),
    size: z.number().min(0.2).max(10).default(1),
  }),
  Component: ({ params: p, frame, box, env, layer }) => {
    const n = env.quality === "draft" ? Math.ceil(p.count / 2) : p.count;
    const r = mulberry32(hashString(`${layer.id}:${env.seed}`));
    const parts: Particle[] = Array.from({ length: n }, () => ({
      x: r(),
      y: r(),
      vx: (r() - 0.5) * 0.02,
      vy: p.mode === "sparks" || p.mode === "embers" ? -0.02 - r() * 0.05 : p.mode === "snow" ? 0.02 + r() * 0.03 : (r() - 0.5) * 0.015,
      r: p.mode === "bokeh" ? 18 + r() * 60 : p.mode === "sparks" ? 1 + r() * 2.5 : 1 + r() * 3,
      a: 0.3 + r() * 0.7,
      phase: r() * Math.PI * 2,
      color: hex(resolveColor(env.palette, p.colors[Math.floor(r() * p.colors.length)])),
    }));
    const t = (frame / env.fps) * p.speed;
    return (
      <FrameCanvas
        w={box.w}
        h={box.h}
        scale={0.5}
        style={{ opacity: p.opacity, mixBlendMode: p.mode === "bokeh" ? "screen" : "normal" }}
        draw={(ctx, cw, ch) => {
          for (const q of parts) {
            const x = (((q.x + q.vx * t + 0.02 * Math.sin(t + q.phase)) % 1) + 1) % 1;
            const y = (((q.y + q.vy * t) % 1) + 1) % 1;
            const twinkle = p.mode === "sparks" || p.mode === "embers" ? 0.5 + 0.5 * Math.sin(t * 6 + q.phase * 3) : 1;
            const rad = q.r * p.size * 0.5;
            const { r: R, g: G, b: B } = hexToRgb(q.color);
            if (p.mode === "bokeh") {
              const g = ctx.createRadialGradient(x * cw, y * ch, 0, x * cw, y * ch, rad);
              g.addColorStop(0, `rgba(${R},${G},${B},${0.35 * q.a})`);
              g.addColorStop(0.8, `rgba(${R},${G},${B},${0.22 * q.a})`);
              g.addColorStop(1, `rgba(${R},${G},${B},0)`);
              ctx.fillStyle = g;
            } else {
              ctx.fillStyle = `rgba(${R},${G},${B},${(q.a * twinkle).toFixed(3)})`;
            }
            ctx.beginPath();
            ctx.arc(x * cw, y * ch, Math.max(0.5, rad), 0, Math.PI * 2);
            ctx.fill();
          }
        }}
      />
    );
  },
  example: { params: { mode: "sparks", count: 120, colors: ["accent", "#ffffff"] }, durationInFrames: 60, box: "full" },
});

export const fxBurst = defineLayer({
  ...fxBase,
  id: "fx.burst",
  category: "particles",
  title: "Explozie de confetti / scântei",
  description: "O explozie la un moment dat: bucăți care zboară pe traiectorii balistice (formulă închisă, deterministă) și cad.",
  tags: ["confetti", "burst", "explosion", "celebrate", "success", "launch"],
  performance: "medium",
  timing: { model: "duration", defaultFrames: 60, minFrames: 20 },
  sfx: [{ sound: "pop", at: "param:at" }, { sound: "sparkle", at: "param:at", gainDb: -6 }],
  params: z.object({
    at: z.number().int().min(0).default(0),
    count: z.number().int().min(4).max(400).default(90),
    colors: z.array(z.string()).min(1).default(["primary", "accent", "#ffffff"]),
    x: z.number().min(0).max(1).default(0.5),
    y: z.number().min(0).max(1).default(0.55),
    power: z.number().min(0.1).max(3).default(1),
    shape: z.enum(["confetti", "sparks"]).default("confetti"),
  }),
  Component: ({ params: p, frame, box, env, layer }) => {
    const t = (frame - p.at) / env.fps;
    if (t < 0) return null;
    const n = env.quality === "draft" ? Math.ceil(p.count / 2) : p.count;
    const r = mulberry32(hashString(`${layer.id}:burst`));
    const g = 2.2 * box.h;
    return (
      <FrameCanvas
        w={box.w}
        h={box.h}
        scale={0.5}
        draw={(ctx, cw, ch) => {
          const k = cw / box.w;
          for (let i = 0; i < n; i++) {
            const ang = -Math.PI / 2 + (r() - 0.5) * Math.PI * 1.4;
            const v = (0.6 + r() * 0.9) * box.h * 1.4 * p.power;
            const drag = 1.6;
            const vx = Math.cos(ang) * v;
            const vy = Math.sin(ang) * v;
            const e = (1 - Math.exp(-drag * t)) / drag;
            const x = p.x * box.w + vx * e;
            const y = p.y * box.h + vy * e + g * (t / drag - e / drag) * 0.6;
            const col = hex(resolveColor(env.palette, p.colors[i % p.colors.length], "primary"));
            const life = clamp(1 - t / (1.6 + r()), 0, 1);
            const spin = t * (4 + r() * 8);
            if (life <= 0) continue;
            ctx.globalAlpha = life;
            ctx.fillStyle = col;
            ctx.save();
            ctx.translate(x * k, y * k);
            ctx.rotate(spin);
            if (p.shape === "confetti") ctx.fillRect(-6 * k * 2, -3 * k * 2, 12 * k * 2, 6 * k * 2 * Math.abs(Math.cos(spin)));
            else {
              ctx.beginPath();
              ctx.arc(0, 0, 3 * k * 2, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.restore();
          }
          ctx.globalAlpha = 1;
        }}
      />
    );
  },
  example: { params: { at: 4 }, durationInFrames: 60, box: "full" },
});

export const fxShapes = defineLayer({
  ...fxBase,
  id: "fx.shapes",
  category: "particles",
  title: "Forme geometrice plutitoare",
  description: "Cercuri, pătrate și triunghiuri contur care plutesc și se rotesc lent. Decor grafic, nu interfață.",
  tags: ["shapes", "geometric", "floating", "decor", "playful"],
  performance: "light",
  sfx: [],
  params: z.object({ count: z.number().int().min(1).max(40).default(10), colors: z.array(z.string()).min(1).default(["primary", "accent"]), size: z.number().min(10).max(400).default(60), opacity: z.number().min(0).max(1).default(0.5), stroke: z.number().min(1).max(12).default(3) }),
  Component: ({ params: p, frame, env, layer }) => {
    const t = frame / env.fps;
    return (
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }} viewBox="0 0 1000 1000" preserveAspectRatio="none">
        {Array.from({ length: p.count }, (_, i) => {
          const x = 1000 * rand(layer.id, "x", i) + 30 * fbm1(`${layer.id}:fx${i}`, t * 0.5);
          const y = 1000 * rand(layer.id, "y", i) + 30 * fbm1(`${layer.id}:fy${i}`, t * 0.5);
          const s = (p.size * (0.5 + rand(layer.id, "s", i))) / 2;
          const rot = t * 20 * (rand(layer.id, "r", i) - 0.5);
          const kind = i % 3;
          const c = resolveColor(env.palette, p.colors[i % p.colors.length], "primary");
          return (
            <g key={i} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(2)})`} opacity={p.opacity} fill="none" stroke={c} strokeWidth={p.stroke} vectorEffect="non-scaling-stroke">
              {kind === 0 ? <circle r={s} /> : kind === 1 ? <rect x={-s} y={-s} width={2 * s} height={2 * s} rx={s * 0.15} /> : <polygon points={`0,${-s} ${s},${s} ${-s},${s}`} />}
            </g>
          );
        })}
      </svg>
    );
  },
  example: { params: {}, durationInFrames: 60, box: "full" },
});

export const fxFog = defineLayer({
  ...fxBase,
  id: "fx.fog",
  category: "light",
  title: "Ceață / fum",
  description: "Straturi mari de ceață moale care derivă, pentru atmosferă (cinematic, emoțional).",
  tags: ["fog", "smoke", "haze", "atmosphere", "cinematic", "moody"],
  performance: "medium",
  sfx: [],
  params: z.object({ color: z.string().default("#ffffff"), opacity: z.number().min(0).max(1).default(0.18), layers: z.number().int().min(1).max(6).default(3), speed: z.number().min(0).max(3).default(0.5) }),
  Component: ({ params: p, frame, env, layer }) => {
    const c = hex(resolveColor(env.palette, p.color));
    const t = (frame / env.fps) * p.speed;
    return (
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", opacity: p.opacity }}>
        {Array.from({ length: p.layers }, (_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${-30 + ((t * (8 + i * 4) + rand(layer.id, i) * 60) % 160) - 30}%`,
              top: `${20 + i * 22 + 6 * fbm1(`${layer.id}:${i}`, t * 0.3)}%`,
              width: "110%",
              height: "45%",
              background: `radial-gradient(closest-side, ${withAlpha(c, 0.9)}, transparent)`,
              filter: "blur(40px)",
            }}
          />
        ))}
      </div>
    );
  },
  example: { params: { opacity: 0.4 }, durationInFrames: 60, box: "full" },
});

export const fxGlass = defineLayer({
  ...fxBase,
  id: "fx.glass",
  category: "light",
  title: "Panou de sticlă mată",
  description: "Un panou translucid care estompează ce e în spate (backdrop-filter), cu margine luminoasă. Suport pentru text.",
  tags: ["glass", "frosted", "panel", "card", "modern", "premium"],
  compatibleMedia: ["none", "scene"],
  performance: "medium",
  timing: { model: "duration", defaultFrames: 60, minFrames: 10 },
  sfx: [{ sound: "whoosh-soft", at: "start", gainDb: -12 }],
  params: z.object({ blur: z.number().min(0).max(60).default(24), tint: z.string().default("#ffffff"), tintOpacity: z.number().min(0).max(1).default(0.08), radius: z.number().min(0).max(120).default(36), border: z.number().min(0).max(1).default(0.25), enter: z.boolean().default(true) }),
  Component: ({ params: p, frame, env }) => {
    const s = p.enter ? prog(frame, 0, 14, EASE.expoOut) : 1;
    const c = hex(resolveColor(env.palette, p.tint));
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: p.radius,
          background: withAlpha(c, p.tintOpacity),
          backdropFilter: `blur(${p.blur}px) saturate(1.3)`,
          WebkitBackdropFilter: `blur(${p.blur}px) saturate(1.3)`,
          boxShadow: `inset 0 0 0 1.5px ${withAlpha("#ffffff", p.border)}, 0 30px 80px rgba(0,0,0,0.25)`,
          opacity: s,
          transform: `translateY(${(1 - s) * 40}px) scale(${0.96 + 0.04 * s})`,
        }}
      />
    );
  },
  example: { params: {}, durationInFrames: 40, box: { x: 460, y: 240, w: 1000, h: 600 } },
});

export const fxLensFlare = defineLayer({
  ...fxBase,
  id: "fx.lens-flare",
  category: "light",
  title: "Lens flare subtil",
  description: "O sursă de lumină cu o dungă orizontală și câteva cercuri pe diagonală, care trece prin cadru. Folosit rar.",
  tags: ["flare", "lens", "light", "cinematic", "launch"],
  performance: "light",
  sfx: [],
  params: z.object({ color: z.string().default("#ffd9a8"), intensity: z.number().min(0).max(1).default(0.6), fromX: z.number().default(0.15), toX: z.number().default(0.6), y: z.number().default(0.3) }),
  Component: ({ params: p, frame, duration, env, box }) => {
    const t = prog(frame, 0, duration, EASE.inOut);
    const x = (p.fromX + (p.toX - p.fromX) * t) * box.w;
    const y = p.y * box.h;
    const c = hex(resolveColor(env.palette, p.color));
    const cx = box.w / 2;
    const cy = box.h / 2;
    const ghosts = [0.4, 0.75, 1.2, 1.6];
    return (
      <div style={{ position: "absolute", inset: 0, mixBlendMode: "screen", opacity: p.intensity * Math.sin(Math.PI * clamp(t * 1.05, 0, 1)) }}>
        <div style={{ position: "absolute", left: x - 160, top: y - 160, width: 320, height: 320, borderRadius: "50%", background: `radial-gradient(closest-side, ${withAlpha("#ffffff", 0.95)}, ${withAlpha(c, 0.5)} 30%, transparent)` }} />
        <div style={{ position: "absolute", left: x - box.w * 0.45, top: y - 3, width: box.w * 0.9, height: 6, background: `linear-gradient(90deg, transparent, ${withAlpha(c, 0.8)}, transparent)`, filter: "blur(2px)" }} />
        {ghosts.map((g, i) => {
          const gx = x + (cx - x) * g * 2;
          const gy = y + (cy - y) * g * 2;
          const r = 30 + i * 22;
          return <div key={i} style={{ position: "absolute", left: gx - r, top: gy - r, width: r * 2, height: r * 2, borderRadius: "50%", background: withAlpha(c, 0.12), border: `1px solid ${withAlpha(c, 0.25)}` }} />;
        })}
      </div>
    );
  },
  example: { params: {}, durationInFrames: 60, box: "full" },
});

export const fxLightLeak = defineLayer({
  ...fxBase,
  id: "fx.light-leak",
  category: "light",
  title: "Light leak (strat)",
  description: "Lumină caldă care se scurge pe margine și pulsează lent, ca pe peliculă.",
  tags: ["light-leak", "warm", "film", "nostalgic", "emotional"],
  performance: "light",
  sfx: [],
  params: z.object({ color: z.string().default("#ff9a5a"), opacity: z.number().min(0).max(1).default(0.35), speed: z.number().min(0).max(3).default(0.5) }),
  Component: ({ params: p, frame, env, layer }) => {
    const t = (frame / env.fps) * p.speed;
    const x = 10 + 25 * fbm1(`${layer.id}:lx`, t);
    const c = hex(resolveColor(env.palette, p.color));
    return <div style={{ position: "absolute", inset: 0, mixBlendMode: "screen", opacity: p.opacity * (0.7 + 0.3 * Math.sin(t * 2)), background: `radial-gradient(70% 90% at ${x}% 10%, ${withAlpha(c, 0.9)}, transparent 65%)` }} />;
  },
  example: { params: { opacity: 0.6 }, durationInFrames: 60, box: "full" },
});

export const fxTrails = defineLayer({
  ...fxBase,
  id: "fx.trails",
  category: "particles",
  title: "Puncte cu urme",
  description: "Puncte care se mișcă pe curbe și lasă urme care se sting (traiectorii calculate din cadru).",
  tags: ["trails", "dots", "motion", "data", "flow", "connections"],
  performance: "medium",
  sfx: [],
  params: z.object({ count: z.number().int().min(1).max(60).default(12), color: z.string().default("accent"), trail: z.number().int().min(2).max(40).default(14), speed: z.number().min(0).max(4).default(1) }),
  Component: ({ params: p, frame, box, env, layer }) => {
    const c = hexToRgb(hex(resolveColor(env.palette, p.color, "accent")));
    return (
      <FrameCanvas
        w={box.w}
        h={box.h}
        scale={0.5}
        draw={(ctx, cw, ch) => {
          for (let i = 0; i < p.count; i++) {
            for (let k = p.trail; k >= 0; k--) {
              const t = ((frame - k * 0.6) / env.fps) * p.speed;
              const x = 0.5 + 0.42 * fbm1(`${layer.id}:tx${i}`, t * 0.5 + i * 3);
              const y = 0.5 + 0.42 * fbm1(`${layer.id}:ty${i}`, t * 0.5 + i * 7);
              const a = (1 - k / (p.trail + 1)) ** 2;
              ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${a.toFixed(3)})`;
              ctx.beginPath();
              ctx.arc(x * cw, y * ch, Math.max(0.6, 4 * (1 - k / (p.trail + 2))), 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }}
      />
    );
  },
  example: { params: {}, durationInFrames: 60, box: "full" },
});

export const FX_LAYERS = [fxGrain, fxVignette, fxLightSweep, fxGlowOrbs, fxGodRays, fxScanlines, fxParticles, fxBurst, fxShapes, fxFog, fxGlass, fxLensFlare, fxLightLeak, fxTrails];
