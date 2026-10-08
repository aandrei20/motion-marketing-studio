/**
 * OCR offline: textul din imagini (capturi date de utilizator, cadre), cu cutiile lui, prin motorul Windows
 * (scripts/ocr/winrt-ocr.ps1, fără instalări). Pe alte sisteme întoarce „indisponibil” (nu inventează text).
 * Rezultatele se păstrează în cache după conținutul imaginii.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { runBinary } from "../core/binaries";
import { PATHS } from "../core/paths";
import type { Rect } from "../core/schema";

export interface OcrLine {
  text: string;
  rect: Rect;
  words: Array<{ text: string } & Rect>;
}

export interface OcrResult {
  available: boolean;
  language: string | null;
  lines: OcrLine[];
  reason?: string;
}

export async function ocrImage(file: string, o: { language?: string; cacheDir?: string } = {}): Promise<OcrResult> {
  if (process.platform !== "win32") return { available: false, language: null, lines: [], reason: "OCR-ul offline e disponibil doar pe Windows (Windows.Media.Ocr)." };
  const bytes = fs.readFileSync(file);
  const key = crypto.createHash("sha1").update(bytes).update(o.language ?? "").digest("hex").slice(0, 20);
  const dir = o.cacheDir ?? path.join(PATHS.cache, "ocr");
  const cached = path.join(dir, `${key}.json`);
  if (fs.existsSync(cached)) return JSON.parse(fs.readFileSync(cached, "utf8")) as OcrResult;
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, `${key}.raw.json`);
  const r = await runBinary("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(PATHS.root, "scripts", "ocr", "winrt-ocr.ps1"), "-Image", path.resolve(file), "-Out", out, ...(o.language ? ["-Language", o.language] : [])], { allowFail: true });
  if (r.code !== 0 || !fs.existsSync(out)) return { available: false, language: null, lines: [], reason: `Motorul OCR Windows nu a rulat: ${(r.stderr || r.stdout.toString()).split("\n")[0].slice(0, 200)}` };
  const raw = JSON.parse(fs.readFileSync(out, "utf8").replace(/^﻿/, "")) as { language: string; lines: Array<{ text: string; words: Array<{ text: string; x: number; y: number; w: number; h: number }> | { text: string; x: number; y: number; w: number; h: number } }> | { text: string; words: unknown } };
  const lines = (Array.isArray(raw.lines) ? raw.lines : [raw.lines]).map((l) => {
    const words = (Array.isArray(l.words) ? l.words : l.words ? [l.words] : []) as Array<{ text: string; x: number; y: number; w: number; h: number }>;
    const x0 = Math.min(...words.map((w) => w.x));
    const y0 = Math.min(...words.map((w) => w.y));
    const x1 = Math.max(...words.map((w) => w.x + w.w));
    const y1 = Math.max(...words.map((w) => w.y + w.h));
    return { text: l.text, rect: words.length ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : { x: 0, y: 0, w: 0, h: 0 }, words };
  });
  const result: OcrResult = { available: true, language: raw.language, lines };
  fs.writeFileSync(cached, JSON.stringify(result));
  fs.rmSync(out, { force: true });
  return result;
}
