/**
 * Catalogul: un timeline cu câte o scenă pentru fiecare capabilitate din registry, construit din
 * exemplul declarat în fișa ei. Îl randează testul de catalog (fiecare intrare trebuie să producă
 * pixeli, determinist) și îl vezi în Remotion Studio (compoziția „Catalog”).
 */
import samples from "../../library/catalog/samples/samples.json";
import type { Palette, Rect, Timeline, TimelineLayer, TimelineScene, TypographySet } from "../core/schema";
import { libraryFont, toTimelineFont } from "./fonts-library";
import { ALL_CAPABILITIES } from "./registry";
import type { Capability, CapabilityExample } from "./types";

export const CATALOG_W = 1920;
export const CATALOG_H = 1080;
export const CATALOG_FPS = 30;

export const STUDIO_PALETTE: Palette = {
  primary: "#6c5cff",
  secondary: "#3b82f6",
  accent: "#2de2b0",
  background: "#0f1020",
  surface: "#1c1f33",
  text: "#f2f3ff",
  textMuted: "#9aa0c3",
};

export const STUDIO_TYPOGRAPHY: TypographySet = {
  display: { family: "Space Grotesk", weight: 700, tracking: -0.02, uppercase: false },
  body: { family: "Inter", weight: 500, tracking: 0, uppercase: false },
  mono: { family: "JetBrains Mono", weight: 500, tracking: 0, uppercase: false },
};

const S = samples as unknown as Record<string, { file: string; w: number; h: number }>;
const SAMPLE_KEYS: Record<string, string> = { screenshot: "screenshot", "tall-screenshot": "tall-screenshot", photo: "image", image: "image", logo: "logo", video: "video" };

/** Înlocuiește „$screenshot”, „$screenshot.w” etc. cu materialele de probă reale. */
export function resolveSamples<T>(v: T): T {
  if (typeof v === "string" && v.startsWith("$")) {
    const [key, prop] = v.slice(1).split(".");
    const s = S[SAMPLE_KEYS[key] ?? key];
    if (!s) throw new Error(`Material de probă necunoscut: ${v}`);
    if (prop === "w") return s.w as T;
    if (prop === "h") return s.h as T;
    return s.file as T;
  }
  if (Array.isArray(v)) return v.map(resolveSamples) as T;
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolveSamples(x)])) as T;
  return v;
}

export function exampleBox(box: CapabilityExample["box"]): Rect {
  if (!box || box === "full") return { x: 0, y: 0, w: CATALOG_W, h: CATALOG_H };
  if (box === "center") return { x: CATALOG_W * 0.2, y: CATALOG_H * 0.17, w: CATALOG_W * 0.6, h: CATALOG_H * 0.66 };
  return box;
}

function collectAssets(v: unknown, out: Set<string>): void {
  if (typeof v === "string" && /^(library|projects)\//.test(v)) out.add(v);
  else if (Array.isArray(v)) v.forEach((x) => collectAssets(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => collectAssets(x, out));
}

function layer(id: string, capability: string, params: Record<string, unknown>, box: Rect, duration: number, extra: Partial<TimelineLayer> = {}): TimelineLayer {
  const assets = new Set<string>();
  collectAssets(params, assets);
  return { id, capability, from: 0, durationInFrames: duration, z: 1, box, params, depth: 1, role: "hero", modifiers: [], assets: [...assets], children: [], ...extra };
}

const bg = (duration: number): TimelineLayer => layer("bg", "bg.gradient", { from: "background", to: "primary", angle: 160, driftDegPerSec: 6, mode: "linear", strength: 0.35 }, { x: 0, y: 0, w: CATALOG_W, h: CATALOG_H }, duration, { z: 0, role: "background" });

const label = (cap: Capability, duration: number): TimelineLayer =>
  layer("label", "text.body", { text: `${cap.id} — ${cap.title}`, font: "mono", maxSize: 30, minSize: 16, color: "textMuted", align: "left", vAlign: "top", exit: "none", emphasis: [], emphasisColor: "accent", lineHeight: 1.2, delay: 0, exitFrames: 5, shadow: false }, { x: 40, y: 24, w: 1840, h: 50 }, duration, { z: 50, depth: 0, role: "hud" });

const screenParams = () => resolveSamples({ src: "$screenshot", kind: "image", imageWidth: "$screenshot.w", imageHeight: "$screenshot.h", frame: "browser", theme: "dark", url: "exemplu.ro", videoStartFrom: 0, playbackRate: 1, shadow: true });

function sceneFor(cap: Capability, from: number): TimelineScene {
  const ex = resolveSamples(cap.example);
  const duration = Math.max(cap.kind === "transition" ? 30 : 20, ex.durationInFrames || 30);
  const meta = { purpose: `Catalog: ${cap.title}`, narrativeRole: "demo", recipe: "catalog", shot: "insert", energy: 0.5 };
  const camera = { keys: [{ at: 0, x: CATALOG_W / 2, y: CATALOG_H / 2, zoom: 1, rotate: 0, rotateX: 0, rotateY: 0, ease: "inOut" as const }], handheld: 0, shake: [], punches: [], perspective: 1600, motionBlur: true };
  const box = exampleBox(ex.box);
  if (cap.kind === "layer") {
    const children = (ex.children ?? []).map((c, i) => {
      const cc = ALL_CAPABILITIES.find((k) => k.id === c.capability);
      if (!cc || cc.kind !== "layer") throw new Error(`Copil necunoscut în exemplul ${cap.id}: ${c.capability}`);
      return layer(`child-${i}`, c.capability, cc.params.parse(resolveSamples(c.params)) as Record<string, unknown>, resolveSamples(c.box), c.durationInFrames, { from: c.from });
    });
    // straturile de interfață se arată pe o captură reală: devin copii ai unui media.screen
    const host: TimelineLayer =
      cap.category === "ui" && children.length && cap.id !== "media.screen"
        ? layer("subject", "media.screen", screenParams(), box, duration, { children })
        : layer("subject", cap.id, cap.params.parse(ex.params) as Record<string, unknown>, box, duration, { children });
    return { id: `cat-${cap.id.replace(/\./g, "-")}`, from, durationInFrames: duration, transitionIn: null, camera, layers: [bg(duration), host, label(cap, duration)], meta };
  }
  if (cap.kind === "modifier") {
    const params = cap.params.parse(ex.params) as Record<string, unknown>;
    const subject = layer("subject", "media.image", resolveSamples({ src: "$screenshot", fit: "cover", radius: 24 }), box, duration, { modifiers: [{ capability: cap.id, params }] });
    return { id: `cat-${cap.id.replace(/\./g, "-")}`, from, durationInFrames: duration, transitionIn: null, camera, layers: [bg(duration), subject, label(cap, duration)], meta };
  }
  if (cap.kind === "camera") {
    const params = cap.params.parse(ex.params) as Record<string, unknown>;
    const build = cap.build(params as never, { duration, width: CATALOG_W, height: CATALOG_H, focus: { x: CATALOG_W * 0.42, y: CATALOG_H * 0.36 }, focusZoom: 1.8, energy: 0.6 });
    const cam = { ...camera, keys: build.keys, handheld: build.handheld ?? 0, shake: build.shake ?? [], punches: build.punches ?? [], depthOfField: build.depthOfField };
    const far = layer("far", "media.image", resolveSamples({ src: "$photo", fit: "cover", radius: 0 }), { x: 0, y: 0, w: CATALOG_W, h: CATALOG_H }, duration, { depth: 0.6, z: 0, role: "background" });
    const near = layer("near", "media.screen", screenParams(), box, duration, { depth: 1.4, z: 1 });
    return { id: `cat-${cap.id.replace(/\./g, "-")}`, from, durationInFrames: duration, transitionIn: null, camera: cam, layers: [far, near, label(cap, duration)], meta };
  }
  // tranziție: scena A (captură) → scena B (gradient + text), suprapuse pe durata tranziției
  const params = cap.params.parse(ex.params) as Record<string, unknown>;
  return {
    id: `cat-${cap.id.replace(/\./g, "-")}`,
    from,
    durationInFrames: duration,
    transitionIn: { capability: cap.id, durationInFrames: cap.defaultDuration, params },
    camera,
    layers: [
      layer("bg", "bg.mesh", { colors: ["primary", "accent", "secondary"], base: "background", blobs: 4, speed: 0.6, intensity: 0.55 }, { x: 0, y: 0, w: CATALOG_W, h: CATALOG_H }, duration, { z: 0, role: "background" }),
      layer("title", "text.word-reveal", { text: cap.title, emphasis: [], font: "display", color: "text", emphasisColor: "accent", align: "left", vAlign: "middle", maxSize: 120, minSize: 30, lineHeight: 1.04, exit: "none", exitFrames: 5, shadow: false, stagger: 3, rise: 0.45 }, { x: 160, y: 380, w: 1600, h: 320 }, duration, { z: 1 }),
      label(cap, duration),
    ],
    meta,
  };
}

/** Scena „A” pusă înaintea fiecărei tranziții, ca tranziția să aibă din ce ieși. */
function transitionSource(id: string, from: number, duration: number): TimelineScene {
  return {
    id,
    from,
    durationInFrames: duration,
    transitionIn: null,
    camera: { keys: [{ at: 0, x: CATALOG_W / 2, y: CATALOG_H / 2, zoom: 1, rotate: 0, rotateX: 0, rotateY: 0, ease: "inOut" }], handheld: 0, shake: [], punches: [], perspective: 1600, motionBlur: true },
    layers: [layer("shot", "media.image", resolveSamples({ src: "$screenshot", fit: "cover", radius: 0 }), { x: 0, y: 0, w: CATALOG_W, h: CATALOG_H }, duration, { z: 0 })],
    meta: { purpose: "Sursă pentru tranziție", narrativeRole: "demo", recipe: "catalog", shot: "insert", energy: 0.5 },
  };
}

export interface CatalogEntryRange {
  id: string;
  sceneId: string;
  from: number;
  durationInFrames: number;
  /** cadrul la care testul face o captură (mijlocul efectului) */
  sampleFrame: number;
}

export function buildCatalogTimeline(filter?: (c: Capability) => boolean): { timeline: Timeline; entries: CatalogEntryRange[] } {
  const caps = ALL_CAPABILITIES.filter((c) => (filter ? filter(c) : true));
  const scenes: TimelineScene[] = [];
  const entries: CatalogEntryRange[] = [];
  let t = 0;
  for (const cap of caps) {
    if (cap.kind === "transition") {
      const src = transitionSource(`src-${cap.id.replace(/\./g, "-")}`, t, 30);
      scenes.push(src);
      t += 30;
      const d = cap.defaultDuration;
      const sc = sceneFor(cap, t - d);
      scenes.push(sc);
      entries.push({ id: cap.id, sceneId: sc.id, from: sc.from, durationInFrames: sc.durationInFrames, sampleFrame: sc.from + Math.floor(Math.max(1, d) / 2) });
      t = sc.from + sc.durationInFrames;
    } else {
      const sc = sceneFor(cap, t);
      scenes.push(sc);
      entries.push({ id: cap.id, sceneId: sc.id, from: sc.from, durationInFrames: sc.durationInFrames, sampleFrame: sc.from + Math.floor(sc.durationInFrames * 0.6) });
      t += sc.durationInFrames;
    }
  }
  const fonts = ["inter", "space-grotesk", "jetbrains-mono"].map((id) => toTimelineFont(libraryFont(id)));
  const timeline: Timeline = {
    schemaVersion: 1,
    projectId: "catalog",
    versionId: "v1",
    formatId: "16x9",
    seed: 7,
    fps: CATALOG_FPS,
    width: CATALOG_W,
    height: CATALOG_H,
    durationInFrames: t,
    safeZone: { top: 54, right: 96, bottom: 54, left: 96 },
    fonts,
    palette: STUDIO_PALETTE,
    typography: STUDIO_TYPOGRAPHY,
    scenes,
    overlays: [],
    captions: null,
    audio: { src: null, cues: [], beatGrid: null },
    markers: entries.map((e) => ({ frame: e.from, label: e.id, kind: "catalog" })),
    concept: false,
  };
  return { timeline, entries };
}
