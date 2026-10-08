/**
 * Criticul pe pixeli (mms-pixel-critic): analizează cadre randate efectiv, nu doar timeline-ul.
 * Pentru fiecare scenă se alege un cadru „de hold” (după tranziția de intrare, înainte de cea de ieșire,
 * cu cât mai mult text așezat) și se măsoară:
 *   • contrastul real al textului față de ce e în spatele lui (captură, imagine, fundal) – WCAG 3:1 / 4,5:1;
 *   • aglomerarea (densitatea de muchii) și spațiul gol (blocuri fără detaliu);
 *   • cât din cadru ocupă subiectul (compoziție);
 *   • prezența culorilor de brand.
 * Limite (scrise și în raport): textul se analizează doar pe straturile fixe pe ecran (adâncime 0);
 * pragurile de aglomerare și compoziție sunt euristice, cu încredere sub 0,6 (nu declanșează corecturi automate).
 */
import type { Palette, Timeline, TimelineLayer, TimelineScene } from "../core/schema";
import { hexToRgb } from "../motion/core/color";
import { READABLE_TEXT_CAPS } from "../motion/text-caps";
import type { IssueDraft } from "../quality/issues";

export interface Raster {
  w: number;
  h: number;
  rgb: Uint8Array;
}

const lin = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};
const LIN = Array.from({ length: 256 }, (_, i) => lin(i));

/** Luminanța relativă (sRGB → liniar, coeficienții BT.709), ca în WCAG. */
export function relLuma(r: number, g: number, b: number): number {
  return 0.2126 * LIN[r] + 0.7152 * LIN[g] + 0.0722 * LIN[b];
}

export function lumaMap(img: Raster): Float32Array {
  const L = new Float32Array(img.w * img.h);
  for (let i = 0; i < L.length; i++) L[i] = relLuma(img.rgb[i * 3], img.rgb[i * 3 + 1], img.rgb[i * 3 + 2]);
  return L;
}

const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))];
}

export interface ContrastMeasure {
  /** contrastul dintre culoarea textului și fundalul cel mai defavorabil din spatele lui */
  ratio: number;
  /** luminanța fundalului cel mai defavorabil (pentru alegerea unei culori mai bune) */
  bgLum: number;
  /** variația fundalului (0 = plin, > 0,12 = încărcat) */
  bgStd: number;
  /** cât din cutie are culoarea textului */
  textShare: number;
}

/** Contrastul real al unui text în cutia lui (pixeli de imagine), cunoscând culoarea textului. */
/**
 * Contrastul real al unui text în cutia lui (pixeli de imagine), cunoscând culoarea textului.
 * `exclude` = culori care fac parte din designul textului (accentul cuvintelor, markerul), nu din fundal.
 */
export function measuredContrast(img: Raster, L: Float32Array, rect: { x: number; y: number; w: number; h: number }, textHex: string, exclude: string[] = []): ContrastMeasure | null {
  const x0 = Math.max(0, Math.floor(rect.x));
  const y0 = Math.max(0, Math.floor(rect.y));
  const x1 = Math.min(img.w, Math.ceil(rect.x + rect.w));
  const y1 = Math.min(img.h, Math.ceil(rect.y + rect.h));
  if (x1 - x0 < 3 || y1 - y0 < 3) return null;
  const c = hexToRgb(textHex);
  const Lt = relLuma(c.r, c.g, c.b);
  const ex = exclude.filter((h) => /^#[0-9a-f]{6}/i.test(h)).map((h) => hexToRgb(h));
  const bg: number[] = [];
  let text = 0;
  let n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = y * img.w + x;
      const l = L[i];
      const dr = img.rgb[i * 3] - c.r;
      const dg = img.rgb[i * 3 + 1] - c.g;
      const db = img.rgb[i * 3 + 2] - c.b;
      const near = Math.abs(l - Lt) < 0.08 && dr * dr + dg * dg + db * db < 60 * 60;
      n++;
      if (ex.some((e) => (img.rgb[i * 3] - e.r) ** 2 + (img.rgb[i * 3 + 1] - e.g) ** 2 + (img.rgb[i * 3 + 2] - e.b) ** 2 < 70 * 70)) continue;
      if (near) text++;
      else if (Math.abs(l - Lt) > 0.12 || dr * dr + dg * dg + db * db > 90 * 90) bg.push(l);
    }
  }
  if (!n) return null;
  if (bg.length < n * 0.05) return { ratio: 1, bgLum: Lt, bgStd: 0, textShare: text / n };
  bg.sort((a, b) => a - b);
  const median = percentile(bg, 0.5);
  // fundalul cel mai apropiat de culoarea textului (cazul cel mai rău pentru citire), nu media
  const worst = Lt > median ? percentile(bg, 0.85) : percentile(bg, 0.15);
  const mean = bg.reduce((a, b) => a + b, 0) / bg.length;
  const std = Math.sqrt(bg.reduce((a, b) => a + (b - mean) ** 2, 0) / bg.length);
  return { ratio: Math.round(ratio(Lt, worst) * 100) / 100, bgLum: worst, bgStd: Math.round(std * 1000) / 1000, textShare: Math.round((text / n) * 1000) / 1000 };
}

/** Densitatea de muchii (gradientul mediu al luminanței, 0..1): măsura aglomerării vizuale. */
export function edgeDensity(L: Float32Array, w: number, h: number): number {
  let sum = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = L[i + 1] - L[i - 1];
      const gy = L[i + w] - L[i - w];
      sum += Math.min(1, Math.sqrt(gx * gx + gy * gy));
      n++;
    }
  }
  return n ? Math.round((sum / n) * 1000) / 1000 : 0;
}

/** Ocuparea cadrului: ce parte e fără detaliu și cât acoperă dreptunghiul zonelor cu detaliu. */
export function detailOccupancy(L: Float32Array, w: number, h: number, cols = 16): { flatShare: number; bboxShare: number; uniform: boolean } {
  const bw = Math.max(1, Math.floor(w / cols));
  const rows = Math.max(1, Math.floor(h / bw));
  const bh = Math.max(1, Math.floor(h / rows));
  let flat = 0;
  let total = 0;
  let minX = cols;
  let minY = rows;
  let maxX = -1;
  let maxY = -1;
  let globalStd = 0;
  const all: number[] = [];
  for (let by = 0; by < rows; by++) {
    for (let bx = 0; bx < cols; bx++) {
      let s = 0;
      let s2 = 0;
      let k = 0;
      for (let y = by * bh; y < Math.min(h, (by + 1) * bh); y++)
        for (let x = bx * bw; x < Math.min(w, (bx + 1) * bw); x++) {
          const v = L[y * w + x];
          s += v;
          s2 += v * v;
          k++;
        }
      if (!k) continue;
      const m = s / k;
      all.push(m);
      const sd = Math.sqrt(Math.max(0, s2 / k - m * m));
      total++;
      if (sd < 0.012) flat++;
      else {
        minX = Math.min(minX, bx);
        minY = Math.min(minY, by);
        maxX = Math.max(maxX, bx);
        maxY = Math.max(maxY, by);
      }
    }
  }
  const mean = all.reduce((a, b) => a + b, 0) / Math.max(1, all.length);
  globalStd = Math.sqrt(all.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, all.length));
  const bboxShare = maxX < 0 ? 0 : ((maxX - minX + 1) * (maxY - minY + 1)) / (cols * rows);
  return { flatShare: Math.round((flat / Math.max(1, total)) * 1000) / 1000, bboxShare: Math.round(bboxShare * 1000) / 1000, uniform: globalStd < 0.004 && flat === total };
}

/** Ce parte din imagine are o culoare apropiată de `hex` (distanță RGB < tol). */
export function colorShare(img: Raster, hex: string, tol = 45): number {
  const c = hexToRgb(hex);
  let k = 0;
  const n = img.w * img.h;
  for (let i = 0; i < n; i++) {
    const dr = img.rgb[i * 3] - c.r;
    const dg = img.rgb[i * 3 + 1] - c.g;
    const db = img.rgb[i * 3 + 2] - c.b;
    if (dr * dr + dg * dg + db * db < tol * tol) k++;
  }
  return k / Math.max(1, n);
}

export interface TextProbe {
  layerId: string;
  text: string;
  box: { x: number; y: number; w: number; h: number };
  color: string;
  /** cheia din paletă a culorii textului (text, textMuted…), dacă e una */
  colorKey: string | null;
  /** culori care fac parte din text (accentul cuvintelor, markerul) */
  exclude: string[];
  role: TimelineLayer["role"];
  fontAt360: number | null;
  shadow: boolean;
}

export interface SceneSample {
  sceneId: string;
  /** cadrul absolut în timeline */
  frame: number;
  /** cadrul local în scenă */
  local: number;
  texts: TextProbe[];
}

function resolveHex(palette: Palette, c: unknown): string {
  if (typeof c === "string" && /^#[0-9a-f]{6}/i.test(c)) return c.slice(0, 7);
  if (typeof c === "string" && c in palette) return palette[c as keyof Palette];
  return palette.text;
}

function settledTexts(t: Timeline, s: TimelineScene, local: number): TextProbe[] {
  return s.layers
    .filter((l) => READABLE_TEXT_CAPS.has(l.capability) && l.depth === 0)
    .filter((l) => {
      const settle = Math.min(18, Math.floor(l.durationInFrames * 0.4));
      const exit = typeof l.params.exitFrames === "number" ? l.params.exitFrames : 5;
      return local >= l.from + settle && local < l.from + l.durationInFrames - exit;
    })
    .map((l) => ({
      layerId: l.id,
      text: String(l.params.text ?? ""),
      box: l.box,
      color: resolveHex(t.palette, l.params.color ?? "text"),
      colorKey: typeof (l.params.color ?? "text") === "string" && String(l.params.color ?? "text") in t.palette ? String(l.params.color ?? "text") : null,
      exclude: [resolveHex(t.palette, l.params.emphasisColor ?? "accent"), ...(l.capability === "text.highlight" ? [resolveHex(t.palette, l.params.markColor ?? "accent")] : [])],
      role: l.role,
      fontAt360: typeof l.params.fontSize === "number" ? (l.params.fontSize * 360) / Math.min(t.width, t.height) : null,
      shadow: l.params.shadow === true,
    }));
}

/** Câte un cadru pe scenă, în fereastra în care se vede doar scena (fără tranziții), cu cât mai mult text așezat. */
export function pickSamples(t: Timeline): SceneSample[] {
  return t.scenes.map((s, i) => {
    const tin = s.transitionIn?.durationInFrames ?? 0;
    const next = t.scenes[i + 1];
    const tnext = next ? Math.max(0, s.from + s.durationInFrames - next.from) : 0;
    const a = Math.min(s.durationInFrames - 1, tin);
    const b = Math.max(a + 1, s.durationInFrames - tnext);
    let best = { local: Math.floor(a + (b - a) * 0.72), texts: settledTexts(t, s, Math.floor(a + (b - a) * 0.72)) };
    for (const p of [0.45, 0.6, 0.75, 0.9]) {
      const local = Math.min(b - 1, Math.floor(a + (b - a) * p));
      const texts = settledTexts(t, s, local);
      if (texts.length >= best.texts.length) best = { local, texts };
    }
    return { sceneId: s.id, frame: s.from + best.local, local: best.local, texts: best.texts };
  });
}

export interface PixelMetrics {
  edge: number;
  flatShare: number;
  bboxShare: number;
  uniform: boolean;
  brandShare: number;
  texts: Array<{ layerId: string; contrast: number | null; bgStd: number | null; required: number }>;
}

/**
 * Analiza unui cadru: metrici + probleme (fără id; colectorul le numerotează).
 * `img` e cadrul randat, la orice rezoluție (cutiile se scalează din pixelii compoziției).
 */
export function analyzeSample(img: Raster, t: Timeline, sample: SceneSample): { metrics: PixelMetrics; issues: IssueDraft[] } {
  const s = t.scenes.find((x) => x.id === sample.sceneId)!;
  const L = lumaMap(img);
  const sx = img.w / t.width;
  const sy = img.h / t.height;
  const issues: IssueDraft[] = [];
  const base = { frame: sample.frame, sceneId: s.id, method: "stills", source: "pixel-check" as const, formatId: t.formatId };
  const texts: PixelMetrics["texts"] = [];
  for (const tx of sample.texts) {
    const rect = { x: tx.box.x * sx, y: tx.box.y * sy, w: tx.box.w * sx, h: tx.box.h * sy };
    const m = measuredContrast(img, L, rect, tx.color, tx.exclude);
    const large = tx.role === "hero" || (tx.fontAt360 ?? 0) >= 18;
    const required = large ? 3 : 4.5;
    texts.push({ layerId: tx.layerId, contrast: m?.ratio ?? null, bgStd: m?.bgStd ?? null, required });
    if (m && m.ratio < required) {
      const busy = m.bgStd > 0.12;
      // cea mai lizibilă culoare din paletă pe fundalul măsurat (rămâne în brand); textul secundar nu primește accentul
      const keys = (tx.role === "hero" ? ["text", "textMuted", "background", "accent", "primary"] : ["text", "textMuted", "background"]) as Array<keyof Palette>;
      const best = keys.map((k) => { const c = hexToRgb(t.palette[k]); return { k, r: ratio(relLuma(c.r, c.g, c.b), m.bgLum) }; }).sort((a, b) => b.r - a.r)[0];
      const recolor = best && best.k !== tx.colorKey && best.r >= required;
      issues.push({
        ...base,
        layerId: tx.layerId,
        dimension: "contrast",
        severity: m.ratio < 2 ? "high" : "medium",
        problem: `Textul „${tx.text.slice(0, 32)}” are contrast ${m.ratio}:1 față de ce e în spatele lui (minim ${required}:1)${busy ? ", pe un fundal încărcat" : ""}.`,
        recommendation: recolor ? `Folosește culoarea „${best.k}” din paletă pentru acest text (contrast estimat ${best.r.toFixed(1)}:1).` : busy && !tx.shadow ? "Adaugă umbră textului sau pune-l pe un panou; alternativ mută-l pe o zonă liniștită." : "Pune textul pe un panou (shape.panel) sau mută-l pe o zonă liniștită a cadrului (decizie de compoziție).",
        suggestedFix: recolor ? [{ op: "layer-params", sceneId: s.id, slot: tx.layerId, params: { color: best.k } }] : busy && !tx.shadow ? [{ op: "layer-params", sceneId: s.id, slot: tx.layerId, params: { shadow: true } }] : [],
        confidence: 0.7,
      });
    }
  }
  const occ = detailOccupancy(L, img.w, img.h);
  const edge = edgeDensity(L, img.w, img.h);
  const brandShare = Math.max(colorShare(img, t.palette.primary), colorShare(img, t.palette.accent));
  if (occ.uniform) issues.push({ ...base, dimension: "black-frame", severity: "critical", problem: "Cadrul randat e uniform (gol).", recommendation: "Verifică materialele și straturile scenei.", confidence: 0.9 });
  const role = s.meta.narrativeRole;
  const restful = role === "cta" || role === "outro" || s.meta.shot === "title";
  if (!occ.uniform && !restful && occ.flatShare > 0.82) issues.push({ ...base, dimension: "whitespace", severity: "low", problem: `${Math.round(occ.flatShare * 100)}% din cadru e fără detaliu.`, recommendation: "Mărește subiectul (zoom pe funcție) sau adaugă un element secundar care susține mesajul.", confidence: 0.5 });
  if (!occ.uniform && !restful && occ.bboxShare < 0.22 && s.layers.some((l) => l.capability.startsWith("media."))) issues.push({ ...base, dimension: "composition", severity: "medium", problem: `Subiectul ocupă doar ~${Math.round(occ.bboxShare * 100)}% din cadru.`, recommendation: "Apropie camera de zona importantă sau folosește adaptorul de decupaj pe acest format.", confidence: 0.55 });
  const visibleText = sample.texts.length;
  if (edge > 0.09 && visibleText >= 2) issues.push({ ...base, dimension: "clutter", severity: "medium", problem: `Cadru încărcat (densitate de muchii ${edge}) cu ${visibleText} texte simultan.`, recommendation: "Un singur mesaj pe moment: scoate un text sau estompează fundalul în spatele lui.", confidence: 0.5 });
  return { metrics: { edge, flatShare: occ.flatShare, bboxShare: occ.bboxShare, uniform: occ.uniform, brandShare: Math.round(brandShare * 10000) / 10000, texts }, issues };
}
