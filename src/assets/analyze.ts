/**
 * Analiza materialelor: metadate (ffprobe, fontkit, SVG), miniatură RGB prin FFmpeg, punct focal
 * (saliență din gradient și contrast de culoare), paletă (k-means determinist) și hash perceptual (dHash).
 */
import fs from "node:fs";
import path from "node:path";
import * as fontkit from "fontkit";
import { ffmpeg, ffprobe } from "../core/binaries";
import type { AssetType } from "../core/schema";
import { rgbToHex } from "../motion/core/color";

export interface ProbeResult {
  type: AssetType;
  mime: string;
  width?: number;
  height?: number;
  durationSec?: number;
  fps?: number;
  hasAlpha?: boolean;
  hasAudio?: boolean;
  codec?: string;
  sampleRate?: number;
  channels?: number;
  fontFamily?: string;
  fontSubfamily?: string;
  fontVariable?: boolean;
}

const EXT: Record<string, { type: AssetType; mime: string }> = {
  ".png": { type: "image", mime: "image/png" },
  ".jpg": { type: "image", mime: "image/jpeg" },
  ".jpeg": { type: "image", mime: "image/jpeg" },
  ".webp": { type: "image", mime: "image/webp" },
  ".gif": { type: "image", mime: "image/gif" },
  ".svg": { type: "svg", mime: "image/svg+xml" },
  ".mp4": { type: "video", mime: "video/mp4" },
  ".mov": { type: "video", mime: "video/quicktime" },
  ".webm": { type: "video", mime: "video/webm" },
  ".mkv": { type: "video", mime: "video/x-matroska" },
  ".mp3": { type: "audio", mime: "audio/mpeg" },
  ".wav": { type: "audio", mime: "audio/wav" },
  ".m4a": { type: "audio", mime: "audio/mp4" },
  ".aac": { type: "audio", mime: "audio/aac" },
  ".flac": { type: "audio", mime: "audio/flac" },
  ".ogg": { type: "audio", mime: "audio/ogg" },
  ".opus": { type: "audio", mime: "audio/opus" },
  ".ttf": { type: "font", mime: "font/ttf" },
  ".otf": { type: "font", mime: "font/otf" },
  ".woff": { type: "font", mime: "font/woff" },
  ".woff2": { type: "font", mime: "font/woff2" },
  ".pdf": { type: "pdf", mime: "application/pdf" },
  ".md": { type: "document", mime: "text/markdown" },
  ".txt": { type: "document", mime: "text/plain" },
  ".docx": { type: "document", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
};

export function typeFromExt(file: string): { type: AssetType; mime: string } {
  return EXT[path.extname(file).toLowerCase()] ?? { type: "other", mime: "application/octet-stream" };
}

function parseSvgSize(xml: string): { width?: number; height?: number } {
  const num = (v?: string) => (v && /^[\d.]+(px)?$/.test(v.trim()) ? Number.parseFloat(v) : undefined);
  const tag = xml.match(/<svg\b[^>]*>/i)?.[0] ?? "";
  const w = num(tag.match(/\bwidth="([^"]+)"/)?.[1]);
  const h = num(tag.match(/\bheight="([^"]+)"/)?.[1]);
  if (w && h) return { width: Math.round(w), height: Math.round(h) };
  const vb = tag.match(/viewBox="([^"]+)"/)?.[1]?.split(/[\s,]+/).map(Number);
  if (vb && vb.length === 4) return { width: Math.round(vb[2]), height: Math.round(vb[3]) };
  return {};
}

export async function probe(file: string): Promise<ProbeResult> {
  const abs = path.resolve(file);
  const { type, mime } = typeFromExt(abs);
  const base: ProbeResult = { type, mime };
  if (type === "svg") return { ...base, ...parseSvgSize(fs.readFileSync(abs, "utf8")), hasAlpha: true };
  if (type === "font") {
    const f = fontkit.openSync(abs) as unknown as { familyName: string; subfamilyName: string; variationAxes?: Record<string, unknown> };
    return { ...base, fontFamily: f.familyName, fontSubfamily: f.subfamilyName, fontVariable: !!f.variationAxes && Object.keys(f.variationAxes).length > 0 };
  }
  if (type === "image" || type === "video" || type === "audio") {
    const r = await ffprobe(["-v", "error", "-print_format", "json", "-show_streams", "-show_format", abs]).catch(() => null);
    if (!r) return base;
    const j = JSON.parse(r.stdout.toString()) as { streams: Array<Record<string, string | number>>; format?: { duration?: string } };
    const v = j.streams.find((s) => s.codec_type === "video");
    const a = j.streams.find((s) => s.codec_type === "audio");
    const fr = typeof v?.avg_frame_rate === "string" && v.avg_frame_rate.includes("/") ? v.avg_frame_rate.split("/").map(Number) : null;
    const pix = String(v?.pix_fmt ?? "");
    return {
      ...base,
      width: v ? Number(v.width) : undefined,
      height: v ? Number(v.height) : undefined,
      durationSec: j.format?.duration ? Number(j.format.duration) : undefined,
      fps: fr && fr[1] ? fr[0] / fr[1] : undefined,
      hasAlpha: type === "image" ? /rgba|bgra|argb|abgr|ya8|ya16|pal8|gbrap|yuva/.test(pix) : undefined,
      hasAudio: !!a,
      codec: String((type === "audio" ? a?.codec_name : v?.codec_name) ?? ""),
      sampleRate: a ? Number(a.sample_rate) : undefined,
      channels: a ? Number(a.channels) : undefined,
    };
  }
  return base;
}

export interface Thumb {
  w: number;
  h: number;
  rgb: Uint8Array;
}

/** Miniatură RGB (lățime `w`) decodată de FFmpeg. Pentru video ia cadrul de la secunda `atSec`. */
export async function thumbnail(file: string, w = 64, atSec = 0, h?: number): Promise<Thumb | null> {
  const abs = path.resolve(file);
  const p = await probe(abs);
  if (!p.width || !p.height) return null;
  const hh = h ?? Math.max(1, Math.round((p.height / p.width) * w));
  const args = [...(p.type === "video" && atSec > 0 ? ["-ss", String(atSec)] : []), "-i", abs, "-frames:v", "1", "-vf", `scale=${w}:${hh}`, "-f", "image2pipe", "-c:v", "rawvideo", "-pix_fmt", "rgb24", "-"];
  const r = await ffmpeg(args, { allowFail: true });
  if (r.code !== 0 || r.stdout.length < w * hh * 3) return null;
  return { w, h: hh, rgb: new Uint8Array(r.stdout.subarray(0, w * hh * 3)) };
}

/** dHash 64 biți (9×8, gri). Distanța Hamming mică = imagini aproape identice. */
export async function dhash(file: string): Promise<string | null> {
  const t = await thumbnail(file, 9, 0, 8);
  if (!t) return null;
  const g = (x: number, y: number) => {
    const i = (y * 9 + x) * 3;
    return 0.299 * t.rgb[i] + 0.587 * t.rgb[i + 1] + 0.114 * t.rgb[i + 2];
  };
  let bits = "";
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += g(x, y) > g(x + 1, y) ? "1" : "0";
  return BigInt(`0b${bits}`).toString(16).padStart(16, "0");
}

export function hamming(a: string, b: string): number {
  let x = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let c = 0;
  while (x) {
    c += Number(x & 1n);
    x >>= 1n;
  }
  return c;
}

/** Punctul focal: centrul de greutate al celor mai salienți pixeli (gradient + distanța de la culoarea medie). */
export function focalPoint(t: Thumb): { x: number; y: number } {
  const { w, h, rgb } = t;
  const lum = new Float32Array(w * h);
  let mr = 0;
  let mg = 0;
  let mb = 0;
  for (let i = 0; i < w * h; i++) {
    lum[i] = 0.299 * rgb[i * 3] + 0.587 * rgb[i * 3 + 1] + 0.114 * rgb[i * 3 + 2];
    mr += rgb[i * 3];
    mg += rgb[i * 3 + 1];
    mb += rgb[i * 3 + 2];
  }
  mr /= w * h;
  mg /= w * h;
  mb /= w * h;
  const sal = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = lum[i + 1] - lum[i - 1];
      const gy = lum[i + w] - lum[i - w];
      const cd = Math.hypot(rgb[i * 3] - mr, rgb[i * 3 + 1] - mg, rgb[i * 3 + 2] - mb);
      sal[i] = Math.hypot(gx, gy) + 0.5 * cd;
    }
  }
  const sorted = Float32Array.from(sal).sort();
  const thr = sorted[Math.floor(sorted.length * 0.9)];
  let sx = 0;
  let sy = 0;
  let sw = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = sal[y * w + x];
      if (v >= thr && v > 0) {
        sx += x * v;
        sy += y * v;
        sw += v;
      }
    }
  if (!sw) return { x: 0.5, y: 0.5 };
  return { x: Math.min(1, Math.max(0, (sx / sw + 0.5) / w)), y: Math.min(1, Math.max(0, (sy / sw + 0.5) / h)) };
}

/** Paletă dominantă: k-means determinist (inițializare pe cuantile de luminanță), sortată după mărimea grupului. */
export function palette(t: Thumb, k = 5): string[] {
  const px: Array<[number, number, number]> = [];
  for (let i = 0; i < t.w * t.h; i++) px.push([t.rgb[i * 3], t.rgb[i * 3 + 1], t.rgb[i * 3 + 2]]);
  const byLum = [...px].sort((a, b) => a[0] * 0.3 + a[1] * 0.59 + a[2] * 0.11 - (b[0] * 0.3 + b[1] * 0.59 + b[2] * 0.11));
  let cents = Array.from({ length: k }, (_, i) => [...byLum[Math.floor(((i + 0.5) / k) * byLum.length)]] as [number, number, number]);
  let assign = new Int32Array(px.length);
  for (let iter = 0; iter < 12; iter++) {
    assign = new Int32Array(px.length);
    px.forEach((p, i) => {
      let best = 0;
      let bd = Infinity;
      cents.forEach((c, j) => {
        const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
        if (d < bd) {
          bd = d;
          best = j;
        }
      });
      assign[i] = best;
    });
    cents = cents.map((c, j) => {
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      px.forEach((p, i) => {
        if (assign[i] === j) {
          r += p[0];
          g += p[1];
          b += p[2];
          n++;
        }
      });
      return n ? [r / n, g / n, b / n] : c;
    });
  }
  const counts = cents.map((_, j) => assign.reduce((a, v) => a + (v === j ? 1 : 0), 0));
  return cents
    .map((c, j) => ({ hex: rgbToHex(c[0], c[1], c[2]), n: counts[j] }))
    .filter((c) => c.n > 0)
    .sort((a, b) => b.n - a.n)
    .map((c) => c.hex);
}

/** Culorile declarate într-un SVG (fill, stroke, stop-color), după frecvență. */
export function svgColors(xml: string): string[] {
  const counts = new Map<string, number>();
  for (const m of xml.matchAll(/(?:fill|stroke|stop-color)\s*[:=]\s*"?\s*(#[0-9a-fA-F]{3,8})/g)) {
    let c = m[1].toLowerCase();
    if (c.length === 4) c = `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`;
    counts.set(c.slice(0, 7), (counts.get(c.slice(0, 7)) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
}

export function meanLuma(t: Thumb): number {
  let s = 0;
  for (let i = 0; i < t.w * t.h; i++) s += 0.299 * t.rgb[i * 3] + 0.587 * t.rgb[i * 3 + 1] + 0.114 * t.rgb[i * 3 + 2];
  return s / (t.w * t.h) / 255;
}
