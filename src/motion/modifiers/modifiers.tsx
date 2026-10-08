import React from "react";
import { z } from "zod";
import { hexToRgb, withAlpha } from "../core/color";
import { resolveColor } from "../core/context";
import { EASE, SPRINGS, clamp, prog, sp, type SpringName } from "../core/easing";
import { DirBlurDefs, DuotoneDefs, PixelateDefs, filterId } from "../core/filters";
import { ChromaFilterDefs, RippleFilterDefs } from "../transitions/transitions";
import { ORIGINAL, defineModifier } from "../types";

const base = {
  category: "modifier" as const,
  compatibleMedia: ["layer" as const, "image" as const, "screenshot" as const, "text" as const, "logo" as const, "video" as const],
  status: "tested" as const,
  license: ORIGINAL,
  timing: { model: "duration" as const, defaultFrames: 60, minFrames: 1 },
};

const hex = (c: string) => (c.startsWith("#") ? c : "#ffffff");
/** strat de probă pentru catalog: o imagine sau o formă pe care se aplică modificatorul */
const modExample = (params: Record<string, unknown>, durationInFrames = 45) => ({ params, durationInFrames, box: "center" as const, needs: ["screenshot" as const] });

export const modEnter = defineModifier({
  ...base,
  id: "mod.enter",
  title: "Intrare și ieșire cu arc",
  description:
    "Intrarea standard a oricărui strat (pop, urcare, cădere, alunecare, scară), cu motion blur din viteză și ieșire rapidă. Fade-ul simplu e doar alegere conștientă.",
  tags: ["enter", "entrance", "spring", "pop", "rise", "exit", "snap"],
  performance: "light",
  sfx: [],
  params: z.object({
    style: z.enum(["pop", "rise", "drop", "slide-left", "slide-right", "scale", "fade"]).default("rise"),
    at: z.number().int().min(0).default(0),
    spring: z.enum(["pop", "slam", "body", "ui", "cam", "soft"]).default("ui"),
    distance: z.number().min(0).max(3000).default(120),
    exit: z.enum(["snap", "none"]).default("snap"),
    exitFrames: z.number().int().min(1).max(30).default(5),
    motionBlur: z.boolean().default(true),
  }),
  apply: ({ params: p, frame, duration, env, id }) => {
    const cfg = SPRINGS[p.spring as SpringName];
    const offset = (f: number): [number, number, number] => {
      const s = sp(f, env.fps, p.at, cfg);
      const d = (1 - s) * p.distance;
      switch (p.style) {
        case "rise":
          return [0, d, 1];
        case "drop":
          return [0, -d, 1];
        case "slide-left":
          return [d, 0, 1];
        case "slide-right":
          return [-d, 0, 1];
        case "pop":
          return [0, 0, s];
        case "scale":
          return [0, 0, 0.85 + 0.15 * s];
        default:
          return [0, 0, 1];
      }
    };
    const [x, y, s] = offset(frame);
    const appear = p.style === "pop" ? (frame >= p.at ? 1 : 0) : clamp(prog(frame, p.at, p.at + (p.style === "fade" ? 12 : 6)), 0, 1);
    const ex = p.exit === "snap" ? prog(frame, duration - p.exitFrames, duration, EASE.snap) : 0;
    const [x2, y2] = offset(frame + 0.5);
    const [x1, y1] = offset(frame - 0.5);
    const bx = p.motionBlur ? clamp(Math.abs(x2 - x1) * 0.35 - 0.5, 0, 30) : 0;
    const by = p.motionBlur ? clamp(Math.abs(y2 - y1) * 0.35 - 0.5, 0, 30) : 0;
    const fid = filterId("enter", id);
    const blurred = bx > 0.2 || by > 0.2;
    return {
      style: {
        transform: `translate(${x.toFixed(2)}px, ${(y - ex * 30).toFixed(2)}px) scale(${(s * (1 - 0.08 * ex)).toFixed(4)})`,
        opacity: appear * (1 - ex),
        filter: blurred ? `url(#${fid})` : undefined,
      },
      wrap: blurred ? (c) => (<>{<DirBlurDefs id={fid} x={bx} y={by} />}{c}</>) : undefined,
    };
  },
  example: modExample({ style: "rise", exit: "snap" }),
});

export const modGlow = defineModifier({
  ...base,
  id: "mod.glow",
  title: "Glow / neon cu puls",
  description: "Aură luminoasă în jurul stratului (drop-shadow colorat), opțional pulsând ca un neon.",
  tags: ["glow", "neon", "bloom", "pulse", "light"],
  performance: "medium",
  sfx: [],
  params: z.object({ color: z.string().default("primary"), radius: z.number().min(1).max(120).default(28), intensity: z.number().min(0).max(1).default(0.8), pulse: z.number().min(0).max(1).default(0), pulseHz: z.number().min(0.1).max(8).default(1.5) }),
  apply: ({ params: p, frame, env }) => {
    const c = hex(resolveColor(env.palette, p.color, "primary"));
    const k = p.pulse ? 1 - p.pulse * (0.5 + 0.5 * Math.sin((frame / env.fps) * Math.PI * 2 * p.pulseHz)) : 1;
    const a = p.intensity * k;
    return { style: { filter: `drop-shadow(0 0 ${(p.radius * 0.35).toFixed(1)}px ${withAlpha(c, a)}) drop-shadow(0 0 ${p.radius.toFixed(1)}px ${withAlpha(c, a * 0.7)})` } };
  },
  example: modExample({ color: "accent", pulse: 0.6 }),
});

export const modShadow = defineModifier({
  ...base,
  id: "mod.shadow",
  title: "Umbră (moale sau de contact)",
  description: "Umbră care așază stratul în spațiu: moale și largă, sau scurtă și densă (umbră de contact).",
  tags: ["shadow", "depth", "contact", "elevation", "realism"],
  performance: "light",
  sfx: [],
  params: z.object({ kind: z.enum(["soft", "deep", "contact"]).default("soft"), opacity: z.number().min(0).max(1).default(0.45) }),
  apply: ({ params: p }) => {
    const s =
      p.kind === "contact"
        ? `drop-shadow(0 6px 6px rgba(0,0,0,${p.opacity})) drop-shadow(0 2px 2px rgba(0,0,0,${p.opacity}))`
        : p.kind === "deep"
          ? `drop-shadow(0 40px 60px rgba(0,0,0,${p.opacity})) drop-shadow(0 12px 18px rgba(0,0,0,${p.opacity * 0.6}))`
          : `drop-shadow(0 24px 40px rgba(0,0,0,${p.opacity * 0.8}))`;
    return { style: { filter: s } };
  },
  example: modExample({ kind: "deep" }),
});

export const modReflection = defineModifier({
  ...base,
  id: "mod.reflection",
  title: "Reflexie pe suprafață lucioasă",
  description: "O copie oglindită, estompată spre jos, sub strat (ca pe o masă lucioasă).",
  tags: ["reflection", "mirror", "glossy", "product", "premium"],
  performance: "light",
  sfx: [],
  params: z.object({ gap: z.number().min(0).max(200).default(8), strength: z.number().min(0).max(1).default(0.25) }),
  apply: ({ params: p }) => ({ style: { WebkitBoxReflect: `below ${p.gap}px linear-gradient(transparent 55%, rgba(255,255,255,${p.strength}))` } as React.CSSProperties }),
  example: { ...modExample({ strength: 0.35 }), box: { x: 660, y: 120, w: 600, h: 420 } },
});

export const modBlur = defineModifier({
  ...base,
  id: "mod.blur",
  title: "Blur animat",
  description: "Estompare care crește sau scade în timp (de ex. fundalul se estompează când apare textul).",
  tags: ["blur", "defocus", "depth", "soft"],
  performance: "medium",
  sfx: [],
  params: z.object({ from: z.number().min(0).max(80).default(0), to: z.number().min(0).max(80).default(16), start: z.number().min(0).max(1).default(0), end: z.number().min(0).max(1).default(0.5) }),
  apply: ({ params: p, frame, duration }) => {
    const t = prog(frame, p.start * duration, p.end * duration, EASE.inOut);
    const b = p.from + (p.to - p.from) * t;
    return { style: { filter: b > 0.05 ? `blur(${b.toFixed(2)}px)` : undefined } };
  },
  example: modExample({ from: 0, to: 18 }),
});

export const modChromatic = defineModifier({
  ...base,
  id: "mod.chromatic",
  category: "distortion",
  title: "Aberație cromatică (RGB split)",
  description: "Canalele roșu și albastru se separă orizontal. Static sau cu impulsuri pe momente date.",
  tags: ["chromatic", "rgb-split", "glitch", "distortion", "tech"],
  performance: "medium",
  sfx: [],
  params: z.object({ amount: z.number().min(0).max(60).default(8), hits: z.array(z.number().int()).default([]), decay: z.number().min(1).max(30).default(6) }),
  apply: ({ params: p, frame, id }) => {
    let k = p.hits.length ? 0 : 1;
    for (const h of p.hits) if (frame >= h) k = Math.max(k, Math.exp(-(frame - h) / p.decay));
    const off = p.amount * k;
    if (off < 0.3) return {};
    const fid = filterId("chroma", id);
    return { style: { filter: `url(#${fid})` }, wrap: (c) => (<><ChromaFilterDefs id={fid} offset={off} />{c}</>) };
  },
  example: modExample({ amount: 14 }),
});

export const modRipple = defineModifier({
  ...base,
  id: "mod.ripple",
  category: "distortion",
  title: "Ondulare / lichid / deplasare",
  description: "Deformare cu hartă de zgomot (feTurbulence + feDisplacementMap). Lent = lichid, rapid = ondulare.",
  tags: ["ripple", "liquid", "displacement", "distortion", "water", "dream"],
  performance: "heavy",
  sfx: [],
  params: z.object({ strength: z.number().min(0).max(300).default(40), frequency: z.number().min(0.001).max(0.1).default(0.012), speed: z.number().min(0).max(30).default(6), envelope: z.enum(["constant", "in-out", "decay"]).default("constant") }),
  apply: ({ params: p, frame, duration, id }) => {
    const env = p.envelope === "in-out" ? Math.sin(Math.PI * clamp(frame / duration, 0, 1)) : p.envelope === "decay" ? Math.exp(-frame / 15) : 1;
    const fid = filterId("ripple", id);
    return {
      style: { filter: `url(#${fid})` },
      wrap: (c) => (<><RippleFilterDefs id={fid} scale={p.strength * env} freq={p.frequency} seed={Math.floor((frame * p.speed) / 30) % 997} />{c}</>),
    };
  },
  example: modExample({ strength: 60 }),
});

export const modPixelate = defineModifier({
  ...base,
  id: "mod.pixelate",
  category: "distortion",
  title: "Pixelare (mozaic)",
  description: "Imaginea se descompune în pătrate mari și se recompune. Pentru dezvăluiri și tranziții digitale.",
  tags: ["pixelate", "mosaic", "digital", "reveal", "retro"],
  performance: "medium",
  sfx: [],
  params: z.object({ from: z.number().min(1).max(200).default(60), to: z.number().min(1).max(200).default(1), end: z.number().min(0).max(1).default(0.5) }),
  apply: ({ params: p, frame, duration, id }) => {
    const size = p.from + (p.to - p.from) * prog(frame, 0, p.end * duration, EASE.out);
    if (size < 2) return {};
    const fid = filterId("pix", id, Math.round(size));
    return { style: { filter: `url(#${fid})` }, wrap: (c) => (<><PixelateDefs id={fid} size={size} />{c}</>) };
  },
  example: modExample({ from: 48, to: 1 }),
});

export const modColorGrade = defineModifier({
  ...base,
  id: "mod.color-grade",
  title: "Gradare de culoare",
  description: "Tratamente de culoare: duotone în culorile brandului, cald, rece, alb-negru, contrast cinematic.",
  tags: ["color", "grade", "duotone", "lut", "mood", "cinematic"],
  performance: "medium",
  sfx: [],
  params: z.object({ preset: z.enum(["duotone", "warm", "cool", "mono", "cinematic"]).default("cinematic"), dark: z.string().default("background"), light: z.string().default("primary") }),
  apply: ({ params: p, env, id }) => {
    if (p.preset === "duotone") {
      const d = hexToRgb(hex(resolveColor(env.palette, p.dark, "background")));
      const l = hexToRgb(hex(resolveColor(env.palette, p.light, "primary")));
      const fid = filterId("duo", id);
      return { style: { filter: `url(#${fid})` }, wrap: (c) => (<><DuotoneDefs id={fid} dark={[d.r, d.g, d.b]} light={[l.r, l.g, l.b]} />{c}</>) };
    }
    const f = { warm: "sepia(0.25) saturate(1.15) hue-rotate(-8deg)", cool: "saturate(0.9) hue-rotate(12deg) brightness(1.02)", mono: "grayscale(1) contrast(1.1)", cinematic: "contrast(1.12) saturate(1.08) brightness(0.97)" }[p.preset];
    return { style: { filter: f } };
  },
  example: modExample({ preset: "duotone" }),
});

export const modMaskReveal = defineModifier({
  ...base,
  id: "mod.mask-reveal",
  title: "Dezvăluire cu mască",
  description: "Stratul apare dintr-o mască: wipe pe o direcție, cerc din centru sau bandă diagonală.",
  tags: ["mask", "reveal", "wipe", "circle", "clip"],
  performance: "light",
  sfx: [{ sound: "swipe", at: "start", gainDb: -8 }],
  params: z.object({ shape: z.enum(["left", "right", "up", "down", "circle", "diagonal"]).default("right"), frames: z.number().int().min(2).max(90).default(16), at: z.number().int().min(0).default(0) }),
  apply: ({ params: p, frame }) => {
    const t = prog(frame, p.at, p.at + p.frames, EASE.inOut);
    const r = (100 - t * 100).toFixed(2);
    const clip =
      p.shape === "circle"
        ? `circle(${(t * 75).toFixed(2)}% at 50% 50%)`
        : p.shape === "diagonal"
          ? `polygon(0 0, ${t * 200}% 0, ${t * 200 - 100}% 100%, 0 100%)`
          : p.shape === "right"
            ? `inset(0 ${r}% 0 0)`
            : p.shape === "left"
              ? `inset(0 0 0 ${r}%)`
              : p.shape === "down"
                ? `inset(0 0 ${r}% 0)`
                : `inset(${r}% 0 0 0)`;
    return { style: { clipPath: clip } };
  },
  example: modExample({ shape: "circle" }),
});

export const modFloat = defineModifier({
  ...base,
  id: "mod.float",
  title: "Plutire",
  description: "Mișcare lentă sus-jos și o rotație mică, ca nimic să nu stea perfect înghețat.",
  tags: ["float", "idle", "bob", "alive", "subtle"],
  performance: "light",
  sfx: [],
  params: z.object({ amplitude: z.number().min(0).max(80).default(10), periodSec: z.number().min(0.5).max(20).default(4), rotate: z.number().min(0).max(10).default(0.6), phase: z.number().default(0) }),
  apply: ({ params: p, frame, env }) => {
    const t = (frame / env.fps / p.periodSec) * Math.PI * 2 + p.phase;
    return { style: { transform: `translateY(${(Math.sin(t) * p.amplitude).toFixed(2)}px) rotate(${(Math.sin(t * 0.7) * p.rotate).toFixed(3)}deg)` } };
  },
  example: modExample({ amplitude: 20 }),
});

export const modTilt3d = defineModifier({
  ...base,
  id: "mod.tilt-3d",
  category: "3d",
  title: "Înclinare 3D în perspectivă",
  description: "Stratul se rotește în 3D (rotateX/rotateY cu perspectivă reală CSS) între două unghiuri. Pentru ecrane și carduri.",
  tags: ["3d", "tilt", "perspective", "rotate", "device", "premium"],
  performance: "light",
  sfx: [],
  params: z.object({ fromX: z.number().default(18), toX: z.number().default(6), fromY: z.number().default(-24), toY: z.number().default(-10), perspective: z.number().min(200).max(6000).default(1800), ease: z.enum(["inOut", "out", "linear"]).default("out") }),
  apply: ({ params: p, frame, duration }) => {
    const t = prog(frame, 0, duration, p.ease === "out" ? EASE.out : p.ease === "linear" ? EASE.linear : EASE.inOut);
    return { style: { transform: `perspective(${p.perspective}px) rotateX(${(p.fromX + (p.toX - p.fromX) * t).toFixed(3)}deg) rotateY(${(p.fromY + (p.toY - p.fromY) * t).toFixed(3)}deg)` } };
  },
  example: modExample({}),
});

export const MODIFIERS = [modEnter, modGlow, modShadow, modReflection, modBlur, modChromatic, modRipple, modPixelate, modColorGrade, modMaskReveal, modFloat, modTilt3d];
