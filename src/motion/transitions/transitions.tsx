import React from "react";
import { z } from "zod";
import { rand } from "../../core/random";
import { withAlpha } from "../core/color";
import { resolveColor } from "../core/context";
import { EASE, clamp, prog } from "../core/easing";
import { ORIGINAL, defineTransition, type TransitionFrame } from "../types";

const base = {
  category: "transition" as const,
  compatibleMedia: ["scene" as const],
  status: "tested" as const,
  license: ORIGINAL,
  timing: { model: "transition" as const, defaultFrames: 10, minFrames: 0 },
};

const Dir = z.enum(["left", "right", "up", "down"]);
type DirT = z.infer<typeof Dir>;
const vec = (d: DirT): [number, number] => (d === "left" ? [-1, 0] : d === "right" ? [1, 0] : d === "up" ? [0, -1] : [0, 1]);

const example = (params: Record<string, unknown> = {}, durationInFrames = 16) => ({ params, durationInFrames });

/** Viteza unei funcții de progres, pentru blur direcțional. */
const speed = (f: (p: number) => number, p: number, dur: number) => Math.abs(f(clamp(p + 0.5 / dur, 0, 1)) - f(clamp(p - 0.5 / dur, 0, 1)));

export const trCut = defineTransition({
  ...base,
  id: "tr.cut",
  title: "Tăietură",
  description:
    "Tăietură directă. Combinată cu snap pe beat grid (storyboard: beat.snap = beat/bar) devine tăietură pe ritm (beat cut).",
  tags: ["cut", "hard-cut", "beat-cut", "rhythm", "fast"],
  timing: { model: "transition", defaultFrames: 0, minFrames: 0 },
  performance: "light",
  sfx: [],
  defaultDuration: 0,
  params: z.object({}),
  present: () => ({ outgoing: {}, incoming: {} }),
  example: example({}, 0),
});

export const trDissolve = defineTransition({
  ...base,
  id: "tr.dissolve",
  title: "Dizolvare (cross-dissolve)",
  description: "Scena nouă apare peste cea veche. Interzis ca implicit generic; doar ca alegere conștientă (ritm lent, emoțional).",
  tags: ["dissolve", "crossfade", "soft", "emotional", "conscious-only"],
  performance: "light",
  sfx: [],
  defaultDuration: 14,
  params: z.object({}),
  present: ({ p }) => ({ outgoing: {}, incoming: { opacity: EASE.smooth(p) } }),
  example: example({}, 14),
});

export const trDip = defineTransition({
  ...base,
  id: "tr.dip",
  title: "Trecere prin culoare",
  description: "Imaginea trece printr-o culoare a brandului (nu negru), apoi intră scena nouă. Fără cadre negre.",
  tags: ["dip", "color", "brand", "pause", "breath"],
  performance: "light",
  sfx: [{ sound: "whoosh-soft", at: "start" }],
  defaultDuration: 14,
  params: z.object({ color: z.string().default("primary") }),
  present: ({ p, params, env }) => {
    const a = p < 0.5 ? EASE.inOut(p * 2) : EASE.inOut((1 - p) * 2);
    return {
      outgoing: { opacity: p < 0.5 ? 1 : 0 },
      incoming: { opacity: p < 0.5 ? 0 : 1 },
      overlay: <div style={{ position: "absolute", inset: 0, background: resolveColor(env.palette, params.color, "primary"), opacity: a }} />,
    };
  },
  example: example({ color: "primary" }, 14),
});

export const trPush = defineTransition({
  ...base,
  id: "tr.push",
  title: "Push",
  description: "Scena nouă împinge scena veche afară din cadru, pe o direcție. Continuă direcția mișcării anterioare.",
  tags: ["push", "slide", "direction", "continuity"],
  performance: "medium",
  sfx: [{ sound: "swipe", at: "start" }],
  defaultDuration: 10,
  params: z.object({ direction: Dir.default("left") }),
  present: ({ p, params, env, duration }) => {
    const [dx, dy] = vec(params.direction);
    const e = EASE.inOut(p);
    const v = speed(EASE.inOut, p, duration) * (dx ? env.width : env.height);
    const blur: [number, number] = [dx ? Math.min(40, v * 0.12) : 0, dy ? Math.min(40, v * 0.12) : 0];
    return {
      outgoing: { transform: `translate(${dx * env.width * e}px, ${dy * env.height * e}px)`, dirBlur: blur },
      incoming: { transform: `translate(${-dx * env.width * (1 - e)}px, ${-dy * env.height * (1 - e)}px)`, dirBlur: blur },
    };
  },
  example: example({ direction: "left" }, 12),
});

export const trSlide = defineTransition({
  ...base,
  id: "tr.slide",
  title: "Slide peste",
  description: "Scena nouă alunecă peste cea veche, care se retrage puțin și se întunecă (adâncime).",
  tags: ["slide", "over", "stack", "depth"],
  performance: "medium",
  sfx: [{ sound: "swipe", at: "start" }],
  defaultDuration: 12,
  params: z.object({ direction: Dir.default("up") }),
  present: ({ p, params, env }) => {
    const [dx, dy] = vec(params.direction);
    const e = EASE.out(p);
    return {
      outgoing: { transform: `scale(${1 - 0.06 * e})`, filter: `brightness(${1 - 0.45 * e})` },
      incoming: { transform: `translate(${-dx * env.width * (1 - e)}px, ${-dy * env.height * (1 - e)}px)` },
    };
  },
  example: example({ direction: "up" }, 14),
});

export const trWipe = defineTransition({
  ...base,
  id: "tr.wipe",
  title: "Wipe liniar",
  description: "O margine dreaptă dezvăluie scena nouă pe o direcție.",
  tags: ["wipe", "reveal", "linear", "graphic"],
  performance: "light",
  sfx: [{ sound: "swipe", at: "start" }],
  defaultDuration: 12,
  params: z.object({ direction: Dir.default("right") }),
  present: ({ p, params }) => {
    const e = EASE.inOut(p) * 100;
    const r = 100 - e;
    const clip =
      params.direction === "right"
        ? `inset(0 ${r}% 0 0)`
        : params.direction === "left"
          ? `inset(0 0 0 ${r}%)`
          : params.direction === "down"
            ? `inset(0 0 ${r}% 0)`
            : `inset(${r}% 0 0 0)`;
    return { outgoing: {}, incoming: { clipPath: clip } };
  },
  example: example({ direction: "right" }, 12),
});

export const trIris = defineTransition({
  ...base,
  id: "tr.mask-iris",
  title: "Wipe cu mască circulară (iris)",
  description: "Un cerc care crește dintr-un punct dezvăluie scena nouă. Bun pentru match cut pe un element rotund (buton, avatar, logo).",
  tags: ["iris", "circle", "mask", "match-cut", "reveal"],
  performance: "light",
  sfx: [{ sound: "pop", at: "start" }],
  defaultDuration: 14,
  params: z.object({ x: z.number().min(0).max(1).default(0.5), y: z.number().min(0).max(1).default(0.5) }),
  present: ({ p, params, env }) => {
    const maxR = Math.hypot(Math.max(params.x, 1 - params.x) * env.width, Math.max(params.y, 1 - params.y) * env.height);
    const r = EASE.inOut(p) * maxR;
    return { outgoing: {}, incoming: { clipPath: `circle(${r.toFixed(1)}px at ${params.x * 100}% ${params.y * 100}%)` } };
  },
  example: example({ x: 0.5, y: 0.5 }, 14),
});

export const trDiagonal = defineTransition({
  ...base,
  id: "tr.mask-diagonal",
  title: "Wipe diagonal cu bandă de culoare",
  description: "O bandă diagonală în culoarea brandului traversează cadrul; scena nouă apare în urma ei.",
  tags: ["diagonal", "band", "brand", "graphic", "energetic"],
  performance: "light",
  sfx: [{ sound: "whoosh", at: "start" }],
  defaultDuration: 14,
  params: z.object({ color: z.string().default("accent"), band: z.number().min(0).max(0.5).default(0.12) }),
  present: ({ p, params, env }) => {
    const e = EASE.inOut(p);
    const lead = -0.5 + e * 2.2; // poziția muchiei din față, în fracții de lățime
    const trail = lead - params.band;
    const poly = (edge: number) => `polygon(0% 0%, ${(edge + 0.5) * 100}% 0%, ${(edge - 0.5) * 100}% 100%, 0% 100%)`;
    const col = resolveColor(env.palette, params.color, "accent");
    return {
      outgoing: {},
      incoming: { clipPath: poly(trail) },
      overlay: (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: col,
            clipPath: `polygon(${(trail + 0.5) * 100}% 0%, ${(lead + 0.5) * 100}% 0%, ${(lead - 0.5) * 100}% 100%, ${(trail - 0.5) * 100}% 100%)`,
          }}
        />
      ),
    };
  },
  example: example({ color: "accent" }, 16),
});

export const trWhip = defineTransition({
  ...base,
  id: "tr.whip",
  title: "Whip pan",
  description: "Mișcare foarte rapidă, cu blur direcțional puternic, spre scena următoare. Pentru ritm alert.",
  tags: ["whip", "whip-pan", "fast", "energetic", "social", "blur"],
  performance: "medium",
  sfx: [{ sound: "whoosh-fast", at: "start" }],
  defaultDuration: 8,
  params: z.object({ direction: Dir.default("left") }),
  present: ({ p, params, env }) => {
    const [dx, dy] = vec(params.direction);
    const e = p < 0.5 ? EASE.expoIn(p * 2) * 0.5 : 0.5 + EASE.expoOut((p - 0.5) * 2) * 0.5;
    const peak = 1 - Math.abs(p - 0.5) * 2;
    const blur: [number, number] = [dx ? 70 * peak : 0, dy ? 70 * peak : 0];
    const dist = (dx ? env.width : env.height) * 1.1;
    return {
      outgoing: { transform: `translate(${dx * dist * e}px, ${dy * dist * e}px)`, dirBlur: blur },
      incoming: { transform: `translate(${-dx * dist * (1 - e)}px, ${-dy * dist * (1 - e)}px)`, dirBlur: blur },
    };
  },
  example: example({ direction: "left" }, 8),
});

export const trZoomThrough = defineTransition({
  ...base,
  id: "tr.zoom-through",
  title: "Zoom through",
  description: "Camera intră în scena veche (zoom + blur) și iese în cea nouă, care se așază dintr-o scară mai mare.",
  tags: ["zoom", "zoom-through", "dive", "energetic", "impact"],
  performance: "medium",
  sfx: [{ sound: "whoosh", at: "start" }, { sound: "impact-small", at: "end", gainDb: -6 }],
  defaultDuration: 12,
  params: z.object({ maxScale: z.number().min(1.1).max(4).default(2.2) }),
  present: ({ p, params }) => {
    const tOut = EASE.expoIn(clamp(p * 2, 0, 1));
    const tIn = EASE.expoOut(clamp(p * 2 - 1, 0, 1));
    return {
      outgoing: { transform: `scale(${1 + (params.maxScale - 1) * tOut})`, filter: `blur(${(tOut * 16).toFixed(2)}px)`, opacity: p < 0.5 ? 1 : 0 },
      incoming: {
        transform: `scale(${1 + (params.maxScale * 0.3) * (1 - tIn)})`,
        filter: `blur(${((1 - tIn) * 14).toFixed(2)}px)`,
        opacity: p < 0.5 ? 0 : 1,
      },
    };
  },
  example: example({ maxScale: 2.2 }, 12),
});

export const trScale = defineTransition({
  ...base,
  id: "tr.scale",
  title: "Scale-in ca un card",
  description: "Scena nouă crește dintr-un card cu colțuri rotunjite până umple cadrul; cea veche se retrage.",
  tags: ["scale", "card", "grow", "ui", "premium"],
  performance: "light",
  sfx: [{ sound: "pop", at: "start" }],
  defaultDuration: 14,
  params: z.object({ from: z.number().min(0.1).max(0.95).default(0.55), radius: z.number().min(0).max(120).default(48) }),
  present: ({ p, params }) => {
    const e = EASE.expoOut(p);
    const s = params.from + (1 - params.from) * e;
    return {
      outgoing: { transform: `scale(${1 - 0.08 * e})`, filter: `brightness(${1 - 0.5 * e})` },
      incoming: { transform: `scale(${s})`, clipPath: `inset(0 round ${(params.radius * (1 - e)) / s}px)` },
    };
  },
  example: example({ from: 0.5 }, 14),
});

export const trFlash = defineTransition({
  ...base,
  id: "tr.flash",
  title: "Flash de expunere",
  description:
    "Supraexpunere scurtă (2–4 cadre) pe tăietură, cu opacitate maximă 0,55. Validatorul limitează la maximum 2 flash-uri pe secundă.",
  tags: ["flash", "impact", "exposure", "hit", "drop"],
  performance: "light",
  sfx: [{ sound: "impact", at: "start" }],
  defaultDuration: 4,
  params: z.object({ peak: z.number().min(0).max(0.55).default(0.5), color: z.string().default("#ffffff") }),
  present: ({ p, params }) => {
    const k = 1 - Math.abs(p - 0.5) * 2;
    return {
      outgoing: { filter: `brightness(${1 + 0.8 * k})`, opacity: p < 0.5 ? 1 : 0 },
      incoming: { filter: `brightness(${1 + 0.8 * k})`, opacity: p < 0.5 ? 0 : 1 },
      overlay: <div style={{ position: "absolute", inset: 0, background: params.color, opacity: params.peak * k }} />,
    };
  },
  example: example({}, 4),
});

export const trBlur = defineTransition({
  ...base,
  id: "tr.blur",
  title: "Tranziție prin blur",
  description: "Scena veche se estompează până devine abstractă, iar cea nouă se clarifică.",
  tags: ["blur", "soft", "dream", "focus"],
  performance: "medium",
  sfx: [{ sound: "whoosh-soft", at: "start" }],
  defaultDuration: 14,
  params: z.object({ amount: z.number().min(2).max(60).default(28) }),
  present: ({ p, params }) => ({
    outgoing: { filter: `blur(${(params.amount * EASE.in(clamp(p * 2, 0, 1))).toFixed(2)}px)`, opacity: 1 },
    incoming: {
      filter: `blur(${(params.amount * (1 - EASE.out(clamp(p * 2 - 1, 0, 1)))).toFixed(2)}px)`,
      opacity: EASE.smooth(clamp((p - 0.3) / 0.4, 0, 1)),
    },
  }),
  example: example({}, 14),
});

export const trParallaxHandoff = defineTransition({
  ...base,
  id: "tr.parallax-handoff",
  title: "Parallax handoff",
  description: "Scena veche iese lent, cea nouă intră rapid peste ea din direcția opusă: viteze diferite, senzație de adâncime.",
  tags: ["parallax", "handoff", "depth", "premium", "continuity"],
  performance: "medium",
  sfx: [{ sound: "swipe", at: "start" }],
  defaultDuration: 16,
  params: z.object({ direction: Dir.default("left") }),
  present: ({ p, params, env, duration }) => {
    const [dx, dy] = vec(params.direction);
    const eIn = EASE.expoOut(p);
    const eOut = EASE.inOut(p);
    const v = speed(EASE.expoOut, p, duration) * env.width;
    return {
      outgoing: { transform: `translate(${dx * env.width * 0.35 * eOut}px, ${dy * env.height * 0.35 * eOut}px) scale(${1 - 0.05 * eOut})`, filter: `brightness(${1 - 0.35 * eOut})` },
      incoming: {
        transform: `translate(${-dx * env.width * (1 - eIn)}px, ${-dy * env.height * (1 - eIn)}px)`,
        dirBlur: [dx ? Math.min(30, v * 0.08) : 0, dy ? Math.min(30, v * 0.08) : 0],
      },
    };
  },
  example: example({ direction: "left" }, 16),
});

export const trPushThrough = defineTransition({
  ...base,
  id: "tr.push-through",
  title: "Camera trece prin scenă",
  description: "Scena veche crește spre cameră și dispare, ca și cum camera trece prin ea; cea nouă e deja în spate.",
  tags: ["push-through", "camera", "depth", "dive", "cinematic"],
  performance: "medium",
  sfx: [{ sound: "whoosh-long", at: "start" }],
  defaultDuration: 16,
  params: z.object({ maxScale: z.number().min(1.2).max(5).default(2.6) }),
  present: ({ p, params }) => {
    const e = EASE.expoIn(p);
    const eIn = EASE.out(p);
    return {
      outgoing: { transform: `scale(${1 + (params.maxScale - 1) * e})`, opacity: 1 - EASE.in(clamp((p - 0.35) / 0.65, 0, 1)), zIndex: 2, filter: `blur(${(e * 10).toFixed(2)}px)` },
      incoming: { transform: `scale(${0.82 + 0.18 * eIn})`, zIndex: 1 },
    };
  },
  example: example({}, 16),
});

export const trColorSweep = defineTransition({
  ...base,
  id: "tr.color-sweep",
  title: "Panou de culoare",
  description: "Un panou plin în culoarea brandului traversează cadrul; scenele se schimbă cât timp ecranul e acoperit.",
  tags: ["color", "sweep", "brand", "graphic", "bold"],
  performance: "light",
  sfx: [{ sound: "whoosh", at: "start" }],
  defaultDuration: 16,
  params: z.object({ color: z.string().default("primary"), direction: z.enum(["left", "right", "up", "down"]).default("right") }),
  present: ({ p, params, env }) => {
    const [dx, dy] = vec(params.direction);
    // panoul intră (0..0.5) și iese (0.5..1) pe aceeași direcție
    const pos = p < 0.5 ? -1 + EASE.inOut(p * 2) : EASE.inOut((p - 0.5) * 2);
    const col = resolveColor(env.palette, params.color, "primary");
    return {
      outgoing: { opacity: p < 0.5 ? 1 : 0 },
      incoming: { opacity: p < 0.5 ? 0 : 1 },
      overlay: <div style={{ position: "absolute", inset: 0, background: col, transform: `translate(${dx * pos * 100}%, ${dy * pos * 100}%)` }} />,
    };
  },
  example: example({}, 16),
});

/** Filtru SVG de aberație cromatică (canale R și B deplasate). Folosit de tranziția glitch și de modificator. */
export function ChromaFilterDefs({ id, offset }: { id: string; offset: number }) {
  return (
    <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden>
      <defs>
        <filter id={id} x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
          <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
          <feOffset in="r" dx={offset} dy={0} result="ro" />
          <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g" />
          <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b" />
          <feOffset in="b" dx={-offset} dy={0} result="bo" />
          <feBlend in="ro" in2="g" mode="screen" result="rg" />
          <feBlend in="rg" in2="bo" mode="screen" />
        </filter>
      </defs>
    </svg>
  );
}

export const trGlitch = defineTransition({
  ...base,
  id: "tr.glitch",
  title: "Glitch cut",
  description: "2–6 cadre de glitch: canale RGB separate, salturi orizontale cu sămânță și benzi de interferență, apoi tăietură.",
  tags: ["glitch", "digital", "tech", "aggressive", "error"],
  performance: "medium",
  sfx: [{ sound: "glitch", at: "start" }],
  defaultDuration: 6,
  params: z.object({ intensity: z.number().min(0).max(1).default(0.8) }),
  present: ({ p, params, frame, seed }) => {
    const id = `glitch-${seed}`.replace(/[^a-zA-Z0-9-]/g, "");
    const off = 6 + 26 * params.intensity * rand(seed, "o", frame);
    const jx = (rand(seed, "jx", frame) - 0.5) * 60 * params.intensity;
    const bands = Array.from({ length: 5 }, (_, i) => ({
      top: rand(seed, "bt", frame, i) * 100,
      h: 1 + rand(seed, "bh", frame, i) * 6,
      a: 0.25 + rand(seed, "ba", frame, i) * 0.4,
    }));
    const style = { transform: `translateX(${jx.toFixed(1)}px)`, filter: `url(#${id})` };
    return {
      outgoing: { ...style, opacity: p < 0.5 ? 1 : 0 },
      incoming: { ...style, opacity: p < 0.5 ? 0 : 1 },
      overlay: (
        <>
          <ChromaFilterDefs id={id} offset={off} />
          {bands.map((b, i) => (
            <div key={i} style={{ position: "absolute", left: 0, right: 0, top: `${b.top}%`, height: `${b.h}%`, background: `rgba(255,255,255,${b.a})`, mixBlendMode: "overlay" }} />
          ))}
        </>
      ),
    };
  },
  example: example({}, 6),
});

export const trLightLeak = defineTransition({
  ...base,
  id: "tr.light-leak",
  title: "Light leak",
  description: "Lumină caldă (sau în culoarea brandului) inundă cadrul și acoperă tăietura, ca pe film.",
  tags: ["light-leak", "warm", "film", "emotional", "premium"],
  performance: "light",
  sfx: [{ sound: "shimmer", at: "start", gainDb: -8 }],
  defaultDuration: 18,
  params: z.object({ color: z.string().default("#ffb36b"), secondColor: z.string().default("#ff5e7e") }),
  present: ({ p, params, env }) => {
    const k = Math.sin(Math.PI * p);
    const x = -30 + 160 * EASE.inOut(p);
    const c1 = resolveColor(env.palette, params.color);
    const c2 = resolveColor(env.palette, params.secondColor);
    return {
      outgoing: { opacity: 1 },
      incoming: { opacity: EASE.smooth(clamp((p - 0.35) / 0.3, 0, 1)) },
      overlay: (
        <div
          style={{
            position: "absolute",
            inset: 0,
            mixBlendMode: "screen",
            opacity: k,
            background: `radial-gradient(60% 80% at ${x}% 40%, ${withAlpha(c1.startsWith("#") ? c1 : "#ffb36b", 0.95)}, transparent 70%), radial-gradient(50% 60% at ${x - 30}% 70%, ${withAlpha(c2.startsWith("#") ? c2 : "#ff5e7e", 0.8)}, transparent 70%)`,
          }}
        />
      ),
    };
  },
  example: example({}, 18),
});

export const trFilmStrip = defineTransition({
  ...base,
  id: "tr.film-strip",
  title: "Film strip (pan legat)",
  description: "Cele două scene se mișcă împreună ca o bandă de film, fără spațiu între ele și fără cadru negru; blur din viteză.",
  tags: ["film-strip", "pan", "continuous", "montage"],
  performance: "medium",
  sfx: [{ sound: "swipe", at: "start" }],
  defaultDuration: 8,
  params: z.object({ direction: z.enum(["left", "right"]).default("left") }),
  present: ({ p, params, env, duration }) => {
    const s = params.direction === "left" ? -1 : 1;
    const e = EASE.inOut(p);
    const v = speed(EASE.inOut, p, duration) * env.width;
    const blur: [number, number] = [Math.min(36, v * 0.11), 0];
    return {
      outgoing: { transform: `translateX(${s * env.width * e}px)`, dirBlur: blur },
      incoming: { transform: `translateX(${-s * env.width * (1 - e)}px)`, dirBlur: blur },
    };
  },
  example: example({ direction: "left" }, 8),
});

export function RippleFilterDefs({ id, scale, freq, seed }: { id: string; scale: number; freq: number; seed: number }) {
  return (
    <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden>
      <defs>
        <filter id={id} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency={`${freq} ${freq * 1.6}`} numOctaves={2} seed={seed} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={scale} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
}

export const trRipple = defineTransition({
  ...base,
  id: "tr.ripple",
  title: "Tranziție lichidă (ondulare)",
  description: "Imaginea se deformează ca un lichid (hartă de deplasare din zgomot) și se reface în scena nouă.",
  tags: ["ripple", "liquid", "distortion", "dream", "creative"],
  performance: "heavy",
  sfx: [{ sound: "whoosh-soft", at: "start" }],
  defaultDuration: 16,
  params: z.object({ strength: z.number().min(0).max(300).default(120) }),
  present: ({ p, params, frame, seed }) => {
    const id = `ripple-${seed}`.replace(/[^a-zA-Z0-9-]/g, "");
    const k = Math.sin(Math.PI * p);
    return {
      outgoing: { filter: `url(#${id})`, opacity: 1 },
      incoming: { filter: `url(#${id})`, opacity: EASE.smooth(clamp((p - 0.3) / 0.4, 0, 1)) },
      overlay: <RippleFilterDefs id={id} scale={params.strength * k} freq={0.006 + 0.004 * k} seed={Math.floor(frame / 2) % 1000} />,
    };
  },
  example: example({}, 16),
});

export const trSpeedRamp = defineTransition({
  ...base,
  id: "tr.speed-ramp",
  title: "Speed ramp",
  description: "Scena veche aproape îngheață, apoi accelerează brusc (zoom) într-o tăietură; cea nouă intră încetinind.",
  tags: ["speed-ramp", "ramp", "accelerate", "dramatic", "social"],
  performance: "medium",
  sfx: [{ sound: "riser-short", at: "start", gainDb: -4 }],
  defaultDuration: 14,
  params: z.object({ maxScale: z.number().min(1.1).max(3).default(1.7) }),
  present: ({ p, params }) => {
    const tOut = EASE.ramp(clamp(p / 0.6, 0, 1));
    const tIn = EASE.expoOut(clamp((p - 0.6) / 0.4, 0, 1));
    const cut = p >= 0.6;
    return {
      outgoing: { transform: `scale(${1 + (params.maxScale - 1) * tOut})`, filter: `blur(${(tOut * tOut * 12).toFixed(2)}px)`, opacity: cut ? 0 : 1 },
      incoming: { transform: `scale(${1 + 0.25 * (1 - tIn)})`, filter: `blur(${((1 - tIn) * 8).toFixed(2)}px)`, opacity: cut ? 1 : 0 },
    };
  },
  example: example({}, 14),
});

export const TRANSITIONS = [
  trCut,
  trDissolve,
  trDip,
  trPush,
  trSlide,
  trWipe,
  trIris,
  trDiagonal,
  trWhip,
  trZoomThrough,
  trScale,
  trFlash,
  trBlur,
  trParallaxHandoff,
  trPushThrough,
  trColorSweep,
  trGlitch,
  trLightLeak,
  trFilmStrip,
  trRipple,
  trSpeedRamp,
];

export type { TransitionFrame };
export { prog };
