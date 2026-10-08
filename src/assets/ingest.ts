import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { decodeAudio } from "../audio/decode";
import { detectBeatGrid } from "../audio/beat";
import { integratedLoudness } from "../audio/loudness";
import type { CaptureResult } from "../capture/capture";
import { MmsError } from "../core/errors";
import type { Asset, AssetOrigin, AssetRole, RightsStatus } from "../core/schema";
import { loadAssets, now, projectDir, saveAssets, updateState } from "../projects/store";
import { dhash, focalPoint, hamming, meanLuma, palette, probe, svgColors, thumbnail, type ProbeResult } from "./analyze";

export interface IngestOptions {
  origin: AssetOrigin;
  role?: AssetRole;
  /** materialul aparține altcuiva (logo străin, muzică, footage)? */
  thirdParty?: boolean;
  rights?: RightsStatus;
  rightsNote?: string;
  notes?: string;
  tags?: string[];
  capture?: CaptureResult;
  /** dacă e o înregistrare de captură (mp4) și nu captura statică */
  captureRecording?: boolean;
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32) || "fisier";

/** Rolul probabil, din tip, nume de fișier, transparență și proporții. Întoarce și încrederea. */
export function classifyRole(file: string, p: ProbeResult, origin: AssetOrigin): { role: AssetRole; confidence: number } {
  const name = path.basename(file).toLowerCase();
  const has = (...k: string[]) => k.some((x) => name.includes(x));
  if (p.type === "font") return { role: "font", confidence: 1 };
  if (p.type === "pdf") return { role: has("brand", "guide", "ghid", "identity") ? "brand-guide" : "document", confidence: 0.7 };
  if (p.type === "document") return { role: "document", confidence: 0.8 };
  if (p.type === "audio") {
    if (has("voice", "vo", "voce", "narat", "speech")) return { role: "voiceover", confidence: 0.8 };
    if (has("sfx", "whoosh", "click", "hit")) return { role: "sfx", confidence: 0.7 };
    return { role: "music", confidence: (p.durationSec ?? 0) > 20 ? 0.75 : 0.5 };
  }
  if (p.type === "video") {
    if (origin === "real_capture" || has("screen", "record", "capture", "demo", "walkthrough")) return { role: "screen-recording", confidence: 0.8 };
    if (has("ref", "inspir", "referin")) return { role: "reference-video", confidence: 0.75 };
    return { role: "other", confidence: 0.4 };
  }
  if (p.type === "svg" || p.type === "image") {
    if (origin === "real_capture" || has("screenshot", "screen", "captur", "ui", "dashboard", "app")) return { role: "screenshot", confidence: origin === "real_capture" ? 1 : 0.75 };
    if (has("logo", "brand", "mark", "wordmark")) return { role: "logo", confidence: 0.9 };
    if (has("icon")) return { role: "icon", confidence: 0.8 };
    if (has("bg", "background", "fundal")) return { role: "background", confidence: 0.75 };
    if (has("ref", "inspir", "referin", "moodboard")) return { role: "reference-image", confidence: 0.75 };
    const w = p.width ?? 0;
    const h = p.height ?? 0;
    if (p.type === "svg" || (p.hasAlpha && w <= 1200 && h <= 1200)) return { role: "logo", confidence: 0.5 };
    return { role: "photo", confidence: 0.35 };
  }
  return { role: "other", confidence: 0.3 };
}

/**
 * Adaugă un fișier în proiect: copiere cu nume stabil (rol + hash), deduplicare exactă (sha256) și
 * aproximativă (dHash), metadate, analiză, rol, drepturi. Întoarce asset-ul (existent, dacă e duplicat).
 */
export async function ingestFile(projectId: string, src: string, opts: IngestOptions): Promise<{ asset: Asset; duplicate: boolean }> {
  const abs = path.resolve(src);
  if (!fs.existsSync(abs)) throw new MmsError("FILE_MISSING", `Nu există fișierul ${abs}`);
  const bytes = fs.readFileSync(abs);
  const sha = crypto.createHash("sha256").update(bytes).digest("hex");
  const manifest = loadAssets(projectId);
  const existing = manifest.assets.find((a) => a.sha256 === sha);
  if (existing) return { asset: existing, duplicate: true };

  const p = await probe(abs);
  const cls = opts.role ? { role: opts.role, confidence: 1 } : classifyRole(abs, p, opts.origin);
  const ext = path.extname(abs).toLowerCase();
  let id = `${cls.role}-${sha.slice(0, 8)}`;
  if (manifest.assets.some((a) => a.id === id)) id = `${id}-${slug(path.basename(abs, ext))}`;
  const rel = `assets/${id}${ext}`;
  const dest = path.join(projectDir(projectId), rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(abs, dest);

  const thirdParty = opts.thirdParty ?? false;
  const rightsStatus: RightsStatus = opts.rights ?? (thirdParty ? "not-confirmed" : opts.origin === "generated" ? "owned" : opts.origin === "real_capture" ? "owned" : "owned");
  const analysis: Asset["analysis"] = { palette: [], nearDuplicates: [] };
  if (p.type === "image" || p.type === "video") {
    const t = await thumbnail(dest, 96, p.type === "video" ? Math.min(1, (p.durationSec ?? 0) / 2) : 0);
    if (t) {
      analysis.focalPoint = focalPoint(t);
      analysis.focalSource = "auto";
      analysis.palette = palette(t, 5);
      analysis.meanLuma = Math.round(meanLuma(t) * 1000) / 1000;
    }
    const h = p.type === "image" ? await dhash(dest) : null;
    if (h) {
      analysis.dhash = h;
      analysis.nearDuplicates = manifest.assets.filter((a) => a.analysis.dhash && hamming(a.analysis.dhash, h) <= 5).map((a) => a.id);
    }
  }
  if (p.type === "svg") {
    analysis.palette = svgColors(fs.readFileSync(dest, "utf8")).slice(0, 6);
    analysis.focalPoint = { x: 0.5, y: 0.5 };
    analysis.focalSource = "auto";
  }
  if (p.type === "audio" && (cls.role === "music" || cls.role === "voiceover")) {
    const audio = await decodeAudio(dest);
    const l = integratedLoudness(audio);
    if (l !== null) analysis.loudnessLufs = Math.round(l * 10) / 10;
    if (cls.role === "music") analysis.bpm = detectBeatGrid(audio).bpm;
  }
  // regiunile de la captură (pixeli ai imaginii) și datele personale găsite
  const cap = opts.capture;
  if (cap && !opts.captureRecording && cap.fullPage === false) {
    const best = cap.regions.find((r) => r.kind === "input") ?? cap.regions.find((r) => r.kind === "button");
    if (best) {
      analysis.focalPoint = { x: Math.min(1, (best.rect.x + best.rect.w / 2) / cap.width), y: Math.min(1, (best.rect.y + best.rect.h / 2) / cap.height) };
      analysis.focalSource = "capture";
    }
  }
  const orientation = p.width && p.height ? (p.width / p.height > 1.15 ? "landscape" : p.width / p.height < 0.87 ? "portrait" : "square") : undefined;
  const importance = cls.role === "logo" ? 1 : cls.role === "screenshot" || cls.role === "screen-recording" ? 0.9 : cls.role === "music" || cls.role === "voiceover" ? 0.8 : 0.5;
  const asset: Asset = {
    id,
    file: rel,
    originalName: path.basename(abs),
    sha256: sha,
    bytes: bytes.length,
    mime: p.mime,
    type: p.type,
    origin: opts.origin,
    role: cls.role,
    roleSource: opts.role ? "user" : "inferred",
    roleConfidence: cls.confidence,
    showsProductUI: cls.role === "screenshot" || cls.role === "screen-recording",
    rights: { thirdParty, status: rightsStatus, note: opts.rightsNote ?? "", ...(rightsStatus === "confirmed-by-user" ? { confirmedAt: now() } : {}) },
    media: {
      width: p.width,
      height: p.height,
      durationSec: p.durationSec,
      fps: p.fps,
      hasAlpha: p.hasAlpha,
      hasAudio: p.hasAudio,
      codec: p.codec,
      sampleRate: p.sampleRate,
      channels: p.channels,
      orientation,
      fontFamily: p.fontFamily,
      fontSubfamily: p.fontSubfamily,
      fontVariable: p.fontVariable,
    },
    analysis: { ...analysis, importance },
    capture: cap
      ? {
          url: cap.url,
          viewport: cap.viewport,
          deviceScaleFactor: cap.deviceScaleFactor,
          capturedAt: cap.capturedAt,
          fullPage: cap.fullPage,
          regions: opts.captureRecording ? [] : cap.regions,
        }
      : undefined,
    pii: { regions: cap && !opts.captureRecording ? cap.pii : [], blurApproved: false },
    tags: opts.tags ?? [],
    notes: opts.notes ?? "",
    addedAt: now(),
  };
  manifest.assets.push(asset);
  saveAssets(projectId, manifest);
  updateState(projectId, { log: `Material adăugat: ${asset.id} (${asset.role}, ${asset.origin}).` });
  return { asset, duplicate: false };
}

/** Ingerează rezultatul unei capturi: captura statică și, dacă există, înregistrarea. */
export async function ingestCapture(projectId: string, cap: CaptureResult): Promise<Asset[]> {
  const out: Asset[] = [];
  out.push((await ingestFile(projectId, cap.screenshot, { origin: "real_capture", role: "screenshot", capture: cap, tags: [cap.id, cap.fullPage ? "full-page" : "viewport"] })).asset);
  if (cap.recording) out.push((await ingestFile(projectId, cap.recording.file, { origin: "real_capture", role: "screen-recording", capture: cap, captureRecording: true, tags: [cap.id, "recording"] })).asset);
  return out;
}

/** Confirmarea drepturilor pentru un material al unui terț (poarta de drepturi). */
export function setRights(projectId: string, assetId: string, status: RightsStatus, note = ""): Asset {
  const m = loadAssets(projectId);
  const a = m.assets.find((x) => x.id === assetId);
  if (!a) throw new MmsError("ASSET_MISSING", `Nu există materialul ${assetId}`);
  a.rights = { ...a.rights, status, note: note || (status === "confirmed-by-user" ? "drepturi confirmate de utilizator" : a.rights.note), ...(status === "confirmed-by-user" ? { confirmedAt: now() } : {}) };
  saveAssets(projectId, m);
  updateState(projectId, { decision: `Drepturi pentru ${assetId}: ${status}.` });
  return a;
}

export function updateAsset(projectId: string, assetId: string, patch: Partial<Pick<Asset, "role" | "notes" | "tags" | "showsProductUI">> & { focalPoint?: { x: number; y: number }; blurApproved?: boolean }): Asset {
  const m = loadAssets(projectId);
  const a = m.assets.find((x) => x.id === assetId);
  if (!a) throw new MmsError("ASSET_MISSING", `Nu există materialul ${assetId}`);
  if (patch.role) {
    a.role = patch.role;
    a.roleSource = "user";
    a.roleConfidence = 1;
    a.showsProductUI = patch.role === "screenshot" || patch.role === "screen-recording";
  }
  if (patch.showsProductUI !== undefined) a.showsProductUI = patch.showsProductUI;
  if (patch.notes !== undefined) a.notes = patch.notes;
  if (patch.tags) a.tags = patch.tags;
  if (patch.focalPoint) {
    a.analysis.focalPoint = patch.focalPoint;
    a.analysis.focalSource = "user";
  }
  if (patch.blurApproved !== undefined) a.pii.blurApproved = patch.blurApproved;
  saveAssets(projectId, m);
  return a;
}
