import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { openBrowser, renderMedia, renderStill, selectComposition, type HeadlessBrowser } from "@remotion/renderer";
import { optionalEnv } from "../../core/env";
import { MmsError } from "../../core/errors";
import { PATHS, publicToAbs } from "../../core/paths";
import type { Timeline, TimelineLayer } from "../../core/schema";

const ENTRY = path.join(PATHS.root, "src", "renderer", "remotion", "index.ts");

/** Hash al codului sursă care intră în bundle: dacă nu s-a schimbat nimic, refolosim bundle-ul. */
function sourceHash(): string {
  const h = crypto.createHash("sha256");
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(tsx?|json|css)$/.test(e.name)) {
        h.update(p);
        h.update(fs.readFileSync(p));
      }
    }
  };
  walk(path.join(PATHS.root, "src"));
  for (const f of ["library/fonts/fonts.json", "library/catalog/samples/samples.json", "package-lock.json"]) {
    const p = path.join(PATHS.root, f);
    if (fs.existsSync(p)) h.update(fs.readFileSync(p));
  }
  return h.digest("hex").slice(0, 16);
}

let bundlePromise: Promise<string> | null = null;

/** Bundle-ul Remotion, construit o singură dată pentru o versiune a codului. */
export function getBundle(onProgress?: (p: number) => void): Promise<string> {
  if (bundlePromise) return bundlePromise;
  bundlePromise = (async () => {
    const hash = sourceHash();
    const outDir = path.join(PATHS.cache, "bundles", hash);
    if (fs.existsSync(path.join(outDir, "index.html"))) return outDir;
    const emptyPublic = path.join(PATHS.cache, "empty-public");
    fs.mkdirSync(emptyPublic, { recursive: true });
    fs.rmSync(outDir, { recursive: true, force: true });
    const serve = await bundle({ entryPoint: ENTRY, outDir, publicDir: emptyPublic, onProgress: (p) => onProgress?.(p), enableCaching: true });
    return serve;
  })();
  return bundlePromise;
}

/** Toate căile publice referite de timeline (straturi, copii, fonturi, audio). */
export function timelineAssets(t: Timeline): string[] {
  const out = new Set<string>();
  const visit = (l: TimelineLayer) => {
    l.assets.forEach((a) => out.add(a));
    l.children.forEach(visit);
  };
  t.scenes.forEach((s) => s.layers.forEach(visit));
  t.overlays.forEach(visit);
  t.fonts.forEach((f) => out.add(f.src));
  if (t.audio.src) out.add(t.audio.src);
  return [...out];
}

/**
 * Pune în folderul public al bundle-ului doar fișierele folosite (legături hard, fără copiere când se poate).
 * Aruncă eroare clară dacă lipsește vreun fișier.
 */
export function stagePublic(serveUrl: string, t: Timeline): void {
  stageFiles(serveUrl, timelineAssets(t));
}

export function stageFiles(serveUrl: string, files: string[]): void {
  const pub = path.join(serveUrl, "public");
  const missing: string[] = [];
  for (const rel of files) {
    const src = publicToAbs(rel);
    if (!fs.existsSync(src)) {
      missing.push(rel);
      continue;
    }
    const dst = path.join(pub, rel);
    if (fs.existsSync(dst)) {
      const a = fs.statSync(src);
      const b = fs.statSync(dst);
      if (a.size === b.size && a.mtimeMs <= b.mtimeMs + 1) continue;
      fs.rmSync(dst);
    }
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    try {
      fs.linkSync(src, dst);
    } catch {
      fs.copyFileSync(src, dst);
    }
  }
  if (missing.length) throw new MmsError("ASSET_MISSING", `Lipsesc fișiere folosite de timeline:\n${missing.map((m) => `  • ${m}`).join("\n")}`, "Reingerează materialele sau recompilează timeline-ul.");
}

/** Randarea grafică: „angle” (GPU, implicit) sau „swangle” (software, mai lentă). Se alege cu MMS_GL. */
const GL = (["angle", "swangle", "swiftshader", "egl"] as const).find((g) => g === process.env.MMS_GL) ?? "angle";

let browser: HeadlessBrowser | null = null;
export async function getBrowser(): Promise<HeadlessBrowser> {
  if (!browser) browser = await openBrowser("chrome", { chromiumOptions: { gl: GL } });
  return browser;
}
export async function closeBrowser(): Promise<void> {
  if (browser) await browser.close({ silent: true });
  browser = null;
}

async function prepare(t: Timeline, compositionId = "Timeline") {
  const serveUrl = await getBundle();
  stagePublic(serveUrl, t);
  const inputProps = { timeline: t, quality: "full", muted: false };
  const puppeteerInstance = await getBrowser();
  const composition = await selectComposition({ serveUrl, id: compositionId, inputProps, puppeteerInstance, logLevel: "error" });
  return { serveUrl, inputProps, composition, puppeteerInstance };
}

export interface RenderVideoOptions {
  out: string;
  frameRange?: [number, number];
  crf?: number;
  concurrency?: number | null;
  muted?: boolean;
  onProgress?: (p: { progress: number; renderedFrames: number; encodedFrames: number }) => void;
}

export async function renderTimelineVideo(t: Timeline, o: RenderVideoOptions): Promise<{ out: string; durationMs: number }> {
  const started = Date.now();
  const { serveUrl, inputProps, composition, puppeteerInstance } = await prepare(t);
  fs.mkdirSync(path.dirname(o.out), { recursive: true });
  await renderMedia({
    serveUrl,
    composition,
    inputProps,
    codec: "h264",
    outputLocation: path.resolve(o.out),
    crf: o.crf ?? 17,
    pixelFormat: "yuv420p",
    colorSpace: "bt709",
    imageFormat: "jpeg",
    jpegQuality: 95,
    audioCodec: "aac",
    audioBitrate: "320k",
    x264Preset: "medium",
    frameRange: o.frameRange ?? null,
    concurrency: o.concurrency ?? null,
    muted: o.muted ?? false,
    enforceAudioTrack: !o.muted,
    overwrite: false,
    puppeteerInstance,
    chromiumOptions: { gl: GL },
    logLevel: "error",
    licenseKey: optionalEnv("REMOTION_LICENSE_KEY") ?? null,
    onProgress: (p) => o.onProgress?.({ progress: p.progress, renderedFrames: p.renderedFrames, encodedFrames: p.encodedFrames }),
  });
  return { out: o.out, durationMs: Date.now() - started };
}

export async function renderTimelineStill(t: Timeline, frame: number, out: string, opts: { format?: "png" | "jpeg"; scale?: number } = {}): Promise<string> {
  const { serveUrl, inputProps, composition, puppeteerInstance } = await prepare(t);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await renderStill({
    serveUrl,
    composition,
    inputProps: { ...inputProps, muted: true },
    frame,
    output: path.resolve(out),
    imageFormat: opts.format ?? "png",
    ...((opts.format ?? "png") === "jpeg" ? { jpegQuality: 92 } : {}),
    scale: opts.scale ?? 1,
    overwrite: true,
    puppeteerInstance,
    chromiumOptions: { gl: GL },
    logLevel: "error",
    licenseKey: optionalEnv("REMOTION_LICENSE_KEY") ?? null,
  });
  return out;
}

/** Randează mai multe cadre statice cu aceeași pregătire (o singură selecție de compoziție). */
export async function renderStills(t: Timeline, frames: number[], outDir: string, opts: { format?: "png" | "jpeg"; scale?: number; prefix?: string } = {}): Promise<string[]> {
  const { serveUrl, inputProps, composition, puppeteerInstance } = await prepare(t);
  fs.mkdirSync(outDir, { recursive: true });
  const files: string[] = [];
  for (const f of frames) {
    const out = path.join(outDir, `${opts.prefix ?? "frame"}-${String(f).padStart(5, "0")}.${opts.format ?? "png"}`);
    await renderStill({
      serveUrl,
      composition,
      inputProps: { ...inputProps, muted: true },
      frame: f,
      output: out,
      imageFormat: opts.format ?? "png",
      ...((opts.format ?? "png") === "jpeg" ? { jpegQuality: 90 } : {}),
      scale: opts.scale ?? 1,
      overwrite: true,
      puppeteerInstance,
      chromiumOptions: { gl: GL },
      logLevel: "error",
      licenseKey: optionalEnv("REMOTION_LICENSE_KEY") ?? null,
    });
    files.push(out);
  }
  return files;
}

/** Foaie de contact: cadre JPEG (căi publice) puse într-o singură imagine PNG. */
export async function renderContactSheet(images: string[], labels: string[], out: string, opts: { cols?: number; cellWidth?: number; cellHeight?: number; title?: string } = {}): Promise<string> {
  const serveUrl = await getBundle();
  stageFiles(serveUrl, images);
  const inputProps = { images, labels, cols: opts.cols ?? 6, cellWidth: opts.cellWidth ?? 320, cellHeight: opts.cellHeight ?? 180, title: opts.title ?? "" };
  const puppeteerInstance = await getBrowser();
  const composition = await selectComposition({ serveUrl, id: "ContactSheet", inputProps, puppeteerInstance, logLevel: "error" });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await renderStill({ serveUrl, composition, inputProps, frame: 0, output: path.resolve(out), imageFormat: "png", overwrite: true, puppeteerInstance, logLevel: "error", licenseKey: optionalEnv("REMOTION_LICENSE_KEY") ?? null });
  return out;
}
