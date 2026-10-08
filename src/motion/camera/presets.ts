import { z } from "zod";
import type { CameraKey } from "../../core/schema";
import { ORIGINAL, defineCamera, type CameraBuildContext } from "../types";

const Ease = z.enum(["linear", "inOut", "out", "in", "snap", "spring"]);

const key = (at: number, x: number, y: number, zoom: number, extra: Partial<CameraKey> = {}): CameraKey => ({
  at: Math.round(at),
  x,
  y,
  zoom,
  rotate: 0,
  rotateX: 0,
  rotateY: 0,
  ease: "inOut",
  ...extra,
});

const center = (c: CameraBuildContext) => ({ x: c.width / 2, y: c.height / 2 });
const target = (c: CameraBuildContext) => c.focus ?? center(c);

const baseMeta = {
  category: "camera" as const,
  compatibleMedia: ["scene" as const],
  status: "tested" as const,
  performance: "light" as const,
  license: ORIGINAL,
  sfx: [],
};

export const cameraStatic = defineCamera({
  ...baseMeta,
  id: "camera.static",
  title: "Cameră fixă",
  description: "Cadru fix, opțional ușor mărit. Pentru momente de citire și cardul final (hold fără mișcare).",
  tags: ["static", "hold", "still", "cta", "read"],
  timing: { model: "duration", defaultFrames: 60, minFrames: 1 },
  params: z.object({ zoom: z.number().min(1).max(4).default(1) }),
  build: (p, c) => ({ keys: [key(0, center(c).x, center(c).y, p.zoom)] }),
  example: { params: { zoom: 1 }, durationInFrames: 30 },
});

export const cameraPush = defineCamera({
  ...baseMeta,
  id: "camera.push",
  title: "Push-in spre punctul de interes",
  description: "Camera înaintează spre punctul de focus al scenei (o zonă din captură). Zoom geometric, easing configurabil.",
  tags: ["zoom", "push", "push-in", "focus", "detail", "dramatic"],
  timing: { model: "duration", defaultFrames: 75, minFrames: 10 },
  params: z.object({
    from: z.number().min(0.5).max(4).default(1),
    /** null = zoom-ul calculat ca punctul de interes să umple cadrul */
    to: z.number().min(0.5).max(6).nullable().default(null),
    start: z.number().min(0).max(1).default(0),
    end: z.number().min(0).max(1).default(1),
    ease: Ease.default("inOut"),
  }),
  build: (p, c) => {
    const t = target(c);
    const to = p.to ?? c.focusZoom;
    return {
      keys: [key(c.duration * p.start, center(c).x, center(c).y, p.from), key(c.duration * p.end, t.x, t.y, to, { ease: p.ease })],
    };
  },
  example: { params: { from: 1, to: 1.6 }, durationInFrames: 60 },
});

export const cameraPull = defineCamera({
  ...baseMeta,
  id: "camera.pull",
  title: "Pull-out (dezvăluire)",
  description: "Pornește aproape de punctul de interes și se retrage, dezvăluind contextul.",
  tags: ["zoom-out", "pull", "reveal", "context", "establishing"],
  timing: { model: "duration", defaultFrames: 75, minFrames: 10 },
  params: z.object({
    from: z.number().min(0.5).max(6).nullable().default(null),
    to: z.number().min(0.5).max(4).default(1),
    end: z.number().min(0).max(1).default(0.85),
    ease: Ease.default("out"),
  }),
  build: (p, c) => {
    const t = target(c);
    return {
      keys: [key(0, t.x, t.y, p.from ?? c.focusZoom), key(c.duration * p.end, center(c).x, center(c).y, p.to, { ease: p.ease })],
    };
  },
  example: { params: { from: 1.8, to: 1 }, durationInFrames: 60 },
});

export const cameraPan = defineCamera({
  ...baseMeta,
  id: "camera.pan",
  title: "Pan (stânga, dreapta, sus, jos)",
  description: "Translație laterală sau verticală peste scenă. Zoom-ul crește automat cât să nu se vadă marginile.",
  tags: ["pan", "slide", "scan", "travel", "lateral"],
  timing: { model: "duration", defaultFrames: 90, minFrames: 10 },
  params: z.object({
    direction: z.enum(["left", "right", "up", "down"]).default("right"),
    /** distanța, ca fracție din lățimea/înălțimea cadrului */
    distance: z.number().min(0.01).max(1).default(0.12),
    zoom: z.number().min(1).max(4).default(1.15),
    ease: Ease.default("inOut"),
  }),
  build: (p, c) => {
    const horizontal = p.direction === "left" || p.direction === "right";
    const sign = p.direction === "right" || p.direction === "down" ? 1 : -1;
    const span = (horizontal ? c.width : c.height) * p.distance;
    const zoom = Math.max(p.zoom, 1 + p.distance * 1.05);
    const cx = center(c).x;
    const cy = center(c).y;
    const a = horizontal ? key(0, cx - (sign * span) / 2, cy, zoom) : key(0, cx, cy - (sign * span) / 2, zoom);
    const b = horizontal ? key(c.duration, cx + (sign * span) / 2, cy, zoom, { ease: p.ease }) : key(c.duration, cx, cy + (sign * span) / 2, zoom, { ease: p.ease });
    return { keys: [a, b] };
  },
  example: { params: { direction: "right", distance: 0.15 }, durationInFrames: 60 },
});

export const cameraTilt = defineCamera({
  ...baseMeta,
  id: "camera.tilt",
  title: "Tilt 3D (înclinare)",
  description: "Camera se înclină în jurul axei orizontale (rotateX cu perspectivă), pentru o intrare cinematică peste un ecran.",
  tags: ["tilt", "3d", "perspective", "cinematic", "premium"],
  timing: { model: "duration", defaultFrames: 90, minFrames: 15 },
  params: z.object({
    fromDeg: z.number().min(-45).max(45).default(18),
    toDeg: z.number().min(-45).max(45).default(0),
    zoom: z.number().min(0.5).max(3).default(1.08),
    ease: Ease.default("out"),
  }),
  build: (p, c) => {
    const t = target(c);
    return {
      keys: [
        key(0, center(c).x, center(c).y, p.zoom * 0.94, { rotateX: p.fromDeg }),
        key(c.duration * 0.8, t.x, t.y, p.zoom, { rotateX: p.toDeg, ease: p.ease }),
      ],
    };
  },
  example: { params: { fromDeg: 22, toDeg: 0 }, durationInFrames: 60 },
});

export const cameraOrbit = defineCamera({
  ...baseMeta,
  id: "camera.orbit",
  title: "Orbită ușoară",
  description: "Rotire în jurul axei verticale (rotateY cu perspectivă), ca o cameră care ocolește obiectul.",
  tags: ["orbit", "rotate", "3d", "premium", "product"],
  timing: { model: "duration", defaultFrames: 120, minFrames: 20 },
  params: z.object({
    fromDeg: z.number().min(-60).max(60).default(-14),
    toDeg: z.number().min(-60).max(60).default(14),
    zoom: z.number().min(0.5).max(3).default(1.05),
    ease: Ease.default("inOut"),
  }),
  build: (p, c) => {
    const t = target(c);
    return {
      keys: [
        key(0, t.x, t.y, p.zoom, { rotateY: p.fromDeg }),
        key(c.duration, t.x, t.y, p.zoom, { rotateY: p.toDeg, ease: p.ease }),
      ],
    };
  },
  example: { params: { fromDeg: -16, toDeg: 16 }, durationInFrames: 60 },
});

export const cameraDollyZoom = defineCamera({
  ...baseMeta,
  id: "camera.dolly-zoom",
  title: "Dolly zoom (vertigo)",
  description:
    "Fundalul (straturi cu adâncime 1) se mărește sau se micșorează în timp ce subiectul pus la adâncime 0 rămâne fix. Efect rar, pentru un moment de șoc.",
  tags: ["vertigo", "dolly", "shock", "dramatic"],
  timing: { model: "duration", defaultFrames: 45, minFrames: 15 },
  params: z.object({ from: z.number().min(0.5).max(3).default(1), to: z.number().min(0.5).max(3).default(1.45), ease: Ease.default("in") }),
  build: (p, c) => ({ keys: [key(0, center(c).x, center(c).y, p.from), key(c.duration, center(c).x, center(c).y, p.to, { ease: p.ease })] }),
  example: { params: { from: 1, to: 1.5 }, durationInFrames: 45 },
});

export const cameraHandheld = defineCamera({
  ...baseMeta,
  id: "camera.handheld",
  title: "Handheld (cameră din mână)",
  description: "Mișcare fină, continuă și organică (zgomot fractal cu sămânță), plus un zoom mic ca marginile să nu se vadă.",
  tags: ["handheld", "organic", "documentary", "alive", "subtle"],
  timing: { model: "duration", defaultFrames: 90, minFrames: 1 },
  params: z.object({ amplitude: z.number().min(0).max(40).default(7), zoom: z.number().min(1).max(3).default(1.05) }),
  build: (p, c) => ({ keys: [key(0, target(c).x, target(c).y, p.zoom)], handheld: p.amplitude }),
  example: { params: { amplitude: 10 }, durationInFrames: 60 },
});

export const cameraShake = defineCamera({
  ...baseMeta,
  id: "camera.shake",
  title: "Tremur de impact",
  description: "Tremur care se stinge rapid la fiecare impact. Folosit doar pe impacturi (slam, logo, drop).",
  tags: ["shake", "impact", "hit", "aggressive", "energy"],
  timing: { model: "duration", defaultFrames: 30, minFrames: 1 },
  params: z.object({
    /** momentele de impact, ca fracții din durată */
    hits: z.array(z.number().min(0).max(1)).default([0]),
    strength: z.enum(["small", "medium", "strong"]).default("medium"),
    zoom: z.number().min(1).max(3).default(1.04),
  }),
  build: (p, c) => {
    const amp = p.strength === "small" ? 8 : p.strength === "medium" ? 18 : 34;
    return { keys: [key(0, center(c).x, center(c).y, p.zoom)], shake: p.hits.map((h) => ({ at: Math.round(h * c.duration), amp })) };
  },
  example: { params: { hits: [0.1, 0.5], strength: "medium" }, durationInFrames: 45 },
});

export const cameraFocusTrack = defineCamera({
  ...baseMeta,
  id: "camera.focus-track",
  title: "Camera urmărește punctele de interes",
  description:
    "Trece pe rând prin mai multe puncte de interes (de ex. zonele găsite la captură: căutare, buton, rezultat), cu zoom pe fiecare.",
  tags: ["follow", "track", "walkthrough", "demo", "regions", "tour"],
  timing: { model: "duration", defaultFrames: 150, minFrames: 30 },
  params: z.object({
    points: z
      .array(z.object({ at: z.number().min(0).max(1), x: z.number(), y: z.number(), zoom: z.number().min(0.5).max(6) }))
      .min(1)
      .default([{ at: 0, x: 0.5, y: 0.5, zoom: 1 }]),
    /** x și y sunt fracții din cadru (true) sau pixeli (false) */
    normalized: z.boolean().default(true),
    ease: Ease.default("inOut"),
  }),
  build: (p, c) => ({
    keys: p.points.map((pt, i) =>
      key(pt.at * c.duration, p.normalized ? pt.x * c.width : pt.x, p.normalized ? pt.y * c.height : pt.y, pt.zoom, { ease: i === 0 ? "inOut" : p.ease }),
    ),
  }),
  example: {
    params: { points: [{ at: 0, x: 0.5, y: 0.5, zoom: 1 }, { at: 0.4, x: 0.3, y: 0.35, zoom: 1.8 }, { at: 0.85, x: 0.7, y: 0.65, zoom: 1.6 }] },
    durationInFrames: 90,
  },
});

export const cameraWhip = defineCamera({
  ...baseMeta,
  id: "camera.whip",
  title: "Whip pan la final de scenă",
  description: "Cadru stabil, apoi o smucitură rapidă în ultimele cadre (cu blur de mișcare) care predă scena următoarei.",
  tags: ["whip", "fast", "energetic", "handoff", "transition"],
  timing: { model: "duration", defaultFrames: 45, minFrames: 12 },
  params: z.object({ direction: z.enum(["left", "right"]).default("left"), frames: z.number().int().min(3).max(20).default(7), zoom: z.number().default(1.1) }),
  build: (p, c) => {
    const cx = center(c).x;
    const cy = center(c).y;
    const dx = (p.direction === "left" ? -1 : 1) * c.width * 0.35;
    return {
      keys: [key(0, cx, cy, p.zoom), key(Math.max(1, c.duration - p.frames), cx, cy, p.zoom), key(c.duration, cx - dx, cy, p.zoom, { ease: "in" })],
    };
  },
  example: { params: { direction: "left" }, durationInFrames: 40 },
});

export const cameraRackFocus = defineCamera({
  ...baseMeta,
  id: "camera.rack-focus",
  title: "Rack focus (focus care trece între planuri)",
  description: "Focusul trece de pe un plan de adâncime pe altul: stratul nefocalizat se estompează. Cere straturi cu adâncimi diferite.",
  tags: ["rack-focus", "depth", "focus", "cinematic", "dof"],
  timing: { model: "duration", defaultFrames: 75, minFrames: 20 },
  params: z.object({
    fromDepth: z.number().min(0).max(3).default(1.4),
    toDepth: z.number().min(0).max(3).default(0.6),
    at: z.number().min(0).max(1).default(0.45),
    strength: z.number().min(0).max(30).default(14),
    zoom: z.number().min(1).max(3).default(1.04),
  }),
  build: (p, c) => {
    const t = Math.round(p.at * c.duration);
    return {
      keys: [key(0, center(c).x, center(c).y, p.zoom)],
      depthOfField: {
        focusDepth: p.fromDepth,
        strength: p.strength,
        keys: [
          { at: Math.max(0, t - 8), focusDepth: p.fromDepth },
          { at: t + 8, focusDepth: p.toDepth },
        ],
      },
    };
  },
  example: { params: { fromDepth: 1.4, toDepth: 0.6 }, durationInFrames: 60 },
});

export const cameraParallaxDrift = defineCamera({
  ...baseMeta,
  id: "camera.parallax-drift",
  title: "Derivă cu parallax",
  description: "Derivă laterală lentă; straturile cu adâncimi diferite se mișcă diferit, dând senzația de spațiu.",
  tags: ["parallax", "depth", "drift", "space", "calm", "premium"],
  timing: { model: "duration", defaultFrames: 120, minFrames: 20 },
  params: z.object({ distance: z.number().min(0).max(0.4).default(0.08), zoom: z.number().min(1).max(2).default(1.12), direction: z.enum(["left", "right"]).default("right") }),
  build: (p, c) => {
    const s = p.direction === "right" ? 1 : -1;
    const span = c.width * p.distance;
    return {
      keys: [
        key(0, c.width / 2 - (s * span) / 2, c.height / 2, p.zoom),
        key(c.duration, c.width / 2 + (s * span) / 2, c.height / 2, p.zoom * 1.03, { ease: "linear" }),
      ],
    };
  },
  example: { params: { distance: 0.12 }, durationInFrames: 60 },
});

export const cameraBeatPunch = defineCamera({
  ...baseMeta,
  id: "camera.beat-punch",
  title: "Punch-in pe ritm",
  description: "Zoom scurt care sare pe fiecare bătaie din beat grid (sau pe momente date) și revine. Pentru montaje energice.",
  tags: ["beat", "punch", "rhythm", "music", "energetic", "montage"],
  timing: { model: "duration", defaultFrames: 60, minFrames: 5 },
  params: z.object({
    /** cadre locale ale bătăilor (completate de compilator din beat grid) */
    hits: z.array(z.number().int().min(0)).default([0]),
    amount: z.number().min(0).max(0.3).default(0.06),
    zoom: z.number().min(1).max(3).default(1.03),
  }),
  build: (p, c) => ({
    keys: [key(0, center(c).x, center(c).y, p.zoom)],
    punches: p.hits.filter((h) => h < c.duration).map((h) => ({ at: h, amount: p.amount })),
  }),
  example: { params: { hits: [0, 15, 30, 45], amount: 0.07 }, durationInFrames: 60 },
});

export const CAMERAS = [
  cameraStatic,
  cameraPush,
  cameraPull,
  cameraPan,
  cameraTilt,
  cameraOrbit,
  cameraDollyZoom,
  cameraHandheld,
  cameraShake,
  cameraFocusTrack,
  cameraWhip,
  cameraRackFocus,
  cameraParallaxDrift,
  cameraBeatPunch,
];
