import React from "react";
import { z } from "zod";
import { fbm1, rand } from "../../core/random";
import { mix, withAlpha } from "../core/color";
import { resolveColor, useAssetUrl } from "../core/context";
import { ORIGINAL, defineLayer } from "../types";
import { Img } from "remotion";

const base = {
  category: "background" as const,
  compatibleMedia: ["none" as const],
  status: "tested" as const,
  license: ORIGINAL,
  timing: { model: "loop" as const, defaultFrames: 90, minFrames: 1 },
  sfx: [],
};

const hex = (c: string) => (c.startsWith("#") ? c : "#000000");

export const bgSolid = defineLayer({
  ...base,
  id: "bg.solid",
  title: "Fundal plin",
  description: "O culoare plină din paleta brandului.",
  tags: ["background", "solid", "flat", "brand"],
  performance: "light",
  params: z.object({ color: z.string().default("background") }),
  Component: ({ params: p, env }) => <div style={{ position: "absolute", inset: 0, background: resolveColor(env.palette, p.color, "background") }} />,
  example: { params: { color: "primary" }, durationInFrames: 30, box: "full" },
});

export const bgGradient = defineLayer({
  ...base,
  id: "bg.gradient",
  title: "Gradient animat",
  description: "Gradient lent în culorile brandului, cu unghi care derivă. Fundal discret, nu concurează cu mesajul.",
  tags: ["background", "gradient", "brand", "calm", "premium"],
  performance: "light",
  params: z.object({
    from: z.string().default("background"),
    to: z.string().default("primary"),
    angle: z.number().default(160),
    driftDegPerSec: z.number().min(-90).max(90).default(6),
    mode: z.enum(["linear", "radial"]).default("linear"),
    strength: z.number().min(0).max(1).default(0.55),
  }),
  Component: ({ params: p, frame, env }) => {
    const a = resolveColor(env.palette, p.from, "background");
    const b = mix(hex(a), hex(resolveColor(env.palette, p.to, "primary")), p.strength);
    const angle = p.angle + (frame / env.fps) * p.driftDegPerSec;
    const cx = 50 + 20 * Math.sin(frame / env.fps / 3);
    const bg = p.mode === "linear" ? `linear-gradient(${angle.toFixed(2)}deg, ${a} 0%, ${b} 100%)` : `radial-gradient(120% 90% at ${cx.toFixed(2)}% 30%, ${b} 0%, ${a} 70%)`;
    return <div style={{ position: "absolute", inset: 0, background: bg }} />;
  },
  example: { params: { from: "background", to: "primary" }, durationInFrames: 60, box: "full" },
});

export const bgMesh = defineLayer({
  ...base,
  id: "bg.mesh",
  title: "Gradient „mesh” viu",
  description: "Pete mari de culoare, estompate, care plutesc lent (zgomot cu sămânță). Fundal modern, cu adâncime.",
  tags: ["background", "mesh", "blobs", "modern", "ai", "premium"],
  performance: "medium",
  params: z.object({
    colors: z.array(z.string()).min(1).default(["primary", "accent", "secondary"]),
    base: z.string().default("background"),
    blobs: z.number().int().min(1).max(8).default(4),
    speed: z.number().min(0).max(4).default(0.6),
    intensity: z.number().min(0).max(1).default(0.55),
  }),
  Component: ({ params: p, frame, env, layer }) => {
    const t = (frame / env.fps) * p.speed;
    return (
      <div style={{ position: "absolute", inset: 0, background: resolveColor(env.palette, p.base, "background"), overflow: "hidden" }}>
        {Array.from({ length: p.blobs }, (_, i) => {
          const c = resolveColor(env.palette, p.colors[i % p.colors.length], "primary");
          const x = 50 + 42 * fbm1(`${layer.id}:x${i}`, t * 0.35 + i * 10);
          const y = 50 + 42 * fbm1(`${layer.id}:y${i}`, t * 0.3 + i * 20);
          const r = 45 + 20 * rand(layer.id, "r", i);
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: `${x - r}%`,
                top: `${y - r}%`,
                width: `${r * 2}%`,
                height: `${r * 2}%`,
                background: `radial-gradient(closest-side, ${withAlpha(hex(c), p.intensity)}, transparent)`,
                filter: "blur(30px)",
              }}
            />
          );
        })}
      </div>
    );
  },
  example: { params: {}, durationInFrames: 60, box: "full" },
});

export const bgGrid = defineLayer({
  ...base,
  id: "bg.grid",
  title: "Grilă tehnică",
  description: "Grilă fină de linii, plată sau în perspectivă (podea), care derivă lent. Pentru produse tehnice/dev.",
  tags: ["background", "grid", "tech", "developer", "perspective"],
  performance: "light",
  params: z.object({
    color: z.string().default("textMuted"),
    spacing: z.number().min(8).max(400).default(80),
    opacity: z.number().min(0).max(1).default(0.18),
    perspective: z.boolean().default(false),
    speed: z.number().min(-400).max(400).default(20),
    fade: z.boolean().default(true),
  }),
  Component: ({ params: p, frame, env }) => {
    const c = withAlpha(hex(resolveColor(env.palette, p.color, "textMuted")), p.opacity);
    const off = ((frame / env.fps) * p.speed) % p.spacing;
    const grid: React.CSSProperties = {
      position: "absolute",
      inset: p.perspective ? "-50% -50% 0 -50%" : 0,
      backgroundImage: `linear-gradient(${c} 1px, transparent 1px), linear-gradient(90deg, ${c} 1px, transparent 1px)`,
      backgroundSize: `${p.spacing}px ${p.spacing}px`,
      backgroundPosition: `0px ${off}px`,
      transform: p.perspective ? "perspective(700px) rotateX(62deg)" : undefined,
      transformOrigin: "50% 100%",
      maskImage: p.fade ? "radial-gradient(ellipse at 50% 60%, black 30%, transparent 75%)" : undefined,
      WebkitMaskImage: p.fade ? "radial-gradient(ellipse at 50% 60%, black 30%, transparent 75%)" : undefined,
    };
    return (
      <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        <div style={grid} />
      </div>
    );
  },
  example: { params: { perspective: true }, durationInFrames: 60, box: "full" },
});

export const bgImage = defineLayer({
  ...base,
  id: "bg.image",
  title: "Fundal din imagine (estompat)",
  description: "O imagine (de ex. o captură) folosită ca fundal: estompată, întunecată și ușor mărită, pentru adâncime.",
  tags: ["background", "image", "blur", "depth", "screenshot"],
  compatibleMedia: ["image", "screenshot"],
  performance: "medium",
  params: z.object({ src: z.string(), blur: z.number().min(0).max(80).default(36), dim: z.number().min(0).max(1).default(0.55), scale: z.number().min(1).max(2).default(1.15) }),
  Component: ({ params: p }) => {
    const url = useAssetUrl();
    return (
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#000" }}>
        <Img src={url(p.src)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: `blur(${p.blur}px)`, transform: `scale(${p.scale})` }} />
        <div style={{ position: "absolute", inset: 0, background: `rgba(0,0,0,${p.dim})` }} />
      </div>
    );
  },
  example: { params: { src: "$screenshot" }, durationInFrames: 30, box: "full", needs: ["screenshot"] },
});

export const bgWaves = defineLayer({
  ...base,
  id: "bg.waves",
  category: "light",
  title: "Valuri",
  description: "Linii sinusoidale suprapuse care curg lent (SVG). Pentru audio, fluxuri, date.",
  tags: ["waves", "lines", "flow", "audio", "calm"],
  performance: "light",
  params: z.object({ color: z.string().default("primary"), count: z.number().int().min(1).max(12).default(5), amplitude: z.number().min(0).max(0.5).default(0.08), speed: z.number().min(0).max(5).default(0.8), opacity: z.number().min(0).max(1).default(0.5) }),
  Component: ({ params: p, frame, env, box }) => {
    const c = resolveColor(env.palette, p.color, "primary");
    const t = (frame / env.fps) * p.speed;
    const W = box.w;
    const H = box.h;
    const paths = Array.from({ length: p.count }, (_, k) => {
      const pts: string[] = [];
      for (let i = 0; i <= 48; i++) {
        const x = (i / 48) * W;
        const y = H / 2 + Math.sin(i / 6 + t * (1 + k * 0.15) + k) * H * p.amplitude * (1 + k * 0.3) + (k - p.count / 2) * H * 0.04;
        pts.push(`${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`);
      }
      return pts.join(" ");
    });
    return (
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        {paths.map((d, k) => (
          <path key={k} d={d} fill="none" stroke={c} strokeWidth={2 + (k % 3)} opacity={p.opacity * (0.4 + 0.6 * (k / p.count))} />
        ))}
      </svg>
    );
  },
  example: { params: {}, durationInFrames: 60, box: "full" },
});

export const bgBeatBars = defineLayer({
  ...base,
  id: "bg.beat-bars",
  category: "light",
  title: "Bare de egalizator pe ritm",
  description:
    "Bare care pulsează pe bătăile din beat grid (deterministe). Reacționează la ritmul declarat, nu la spectrul audio real.",
  tags: ["equalizer", "bars", "beat", "music", "audio-reactive", "rhythm"],
  performance: "light",
  params: z.object({ color: z.string().default("primary"), bars: z.number().int().min(4).max(64).default(24), beatFrames: z.number().min(2).default(15), offset: z.number().default(0), opacity: z.number().min(0).max(1).default(0.8) }),
  Component: ({ params: p, frame, env, box, layer }) => {
    const c = resolveColor(env.palette, p.color, "primary");
    const phase = ((frame - p.offset) % p.beatFrames + p.beatFrames) % p.beatFrames;
    const pulse = Math.exp(-phase / (p.beatFrames * 0.35));
    const bw = box.w / p.bars;
    return (
      <div style={{ position: "absolute", inset: 0 }}>
        {Array.from({ length: p.bars }, (_, i) => {
          const base = 0.15 + 0.35 * (0.5 + 0.5 * fbm1(`${layer.id}:${i}`, frame / env.fps * 2));
          const h = Math.min(1, base + pulse * (0.3 + 0.5 * rand(layer.id, i, Math.floor(frame / p.beatFrames))));
          return <div key={i} style={{ position: "absolute", left: i * bw + bw * 0.15, width: bw * 0.7, bottom: 0, height: `${(h * 100).toFixed(2)}%`, background: c, opacity: p.opacity, borderRadius: bw * 0.2 }} />;
        })}
      </div>
    );
  },
  example: { params: { beatFrames: 15 }, durationInFrames: 60, box: { x: 160, y: 500, w: 1600, h: 400 } },
});

export const BACKGROUNDS = [bgSolid, bgGradient, bgMesh, bgGrid, bgImage, bgWaves, bgBeatBars];

