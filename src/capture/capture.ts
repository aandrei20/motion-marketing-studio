import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type BrowserContext, type Page } from "playwright";
import { z } from "zod";
import { findPii, PII_CANDIDATE_SOURCE, PII_LABEL } from "../assets/pii";
import { ffmpeg } from "../core/binaries";
import { MmsError } from "../core/errors";
import { PATHS } from "../core/paths";
import type { Region } from "../core/schema";

export const VIEWPORTS = {
  desktop: { width: 1440, height: 900, dpr: 2, mobile: false },
  laptop: { width: 1280, height: 800, dpr: 2, mobile: false },
  tablet: { width: 834, height: 1112, dpr: 2, mobile: true },
  mobile: { width: 390, height: 844, dpr: 3, mobile: true },
} as const;
export type ViewportName = keyof typeof VIEWPORTS;

export const CaptureStep = z.discriminatedUnion("action", [
  z.object({ action: z.literal("goto"), url: z.string() }),
  z.object({ action: z.literal("click"), selector: z.string() }),
  z.object({ action: z.literal("hover"), selector: z.string() }),
  z.object({ action: z.literal("type"), selector: z.string(), text: z.string(), delayMs: z.number().int().min(0).default(110) }),
  z.object({ action: z.literal("press"), key: z.string() }),
  z.object({ action: z.literal("scroll"), y: z.number() }),
  z.object({ action: z.literal("wait"), ms: z.number().int().min(0) }),
  z.object({ action: z.literal("drag"), from: z.string(), to: z.string() }),
]);
export type CaptureStep = z.infer<typeof CaptureStep>;

export const CaptureRequest = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  url: z.string(),
  viewport: z.enum(["desktop", "laptop", "tablet", "mobile"]).default("desktop"),
  fullPage: z.boolean().default(false),
  /** pași înainte de captură (de ex. tastare într-un câmp) */
  before: z.array(CaptureStep).default([]),
  /** înregistrare: pașii executați în timp ce se fac cadre */
  record: z.object({ steps: z.array(CaptureStep).min(1), fps: z.number().int().min(10).max(60).default(30), tailMs: z.number().int().min(0).default(600) }).optional(),
  /** CSS injectat (de ex. ascunde banner de cookie) */
  css: z.string().default(""),
  /** profil persistent pentru pagini cu autentificare (sesiunea rămâne doar local) */
  profile: z.string().optional(),
  /** textul paginii intră în research (false pentru ecrane de aplicație cu date de test/personale) */
  research: z.boolean().default(true),
});
export type CaptureRequest = z.infer<typeof CaptureRequest>;
export type CaptureRequestInput = z.input<typeof CaptureRequest>;

export interface PageData {
  url: string;
  title: string;
  description: string;
  og: Record<string, string>;
  headings: Array<{ level: number; text: string }>;
  paragraphs: string[];
  listItems: string[];
  links: Array<{ text: string; href: string }>;
  buttons: string[];
  colors: { backgrounds: Array<[string, number]>; texts: Array<[string, number]>; accents: Array<[string, number]> };
  fonts: Array<[string, number]>;
  /** forma brandului din CSS (capturile vechi nu o au) */
  shapes?: { radii: Array<[string, number]>; shadows: Array<[string, number]>; gradients: Array<[string, number]>; gaps: Array<[string, number]> };
  cssVars: Record<string, string>;
  times: Array<{ datetime: string; text: string }>;
  fullText: string;
}

export interface CaptureResult {
  id: string;
  research: boolean;
  url: string;
  viewport: { width: number; height: number };
  deviceScaleFactor: number;
  fullPage: boolean;
  screenshot: string;
  width: number;
  height: number;
  regions: Region[];
  pii: Region[];
  page: PageData;
  recording?: { file: string; fps: number; frames: number; durationSec: number; width: number; height: number };
  /** logo-ul găsit în pagină (SVG inline sau imaginea din antet), salvat lângă captură; lipsește dacă nu e sigur */
  logo?: { file: string; source: "inline-svg" | "img"; url?: string };
  capturedAt: string;
}

const DEFAULT_CSS = `
#onetrust-consent-sdk, #onetrust-banner-sdk, [id*="cookie" i][class*="banner" i], [aria-label*="cookie" i] { display: none !important; }
*, *::before, *::after { caret-color: transparent; }
`;

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "zona";

/** Extrage zonele interesante (butoane, câmpuri, titluri, navigație) cu cutiile lor, în pixeli CSS ai documentului. */
async function extractRegions(page: Page, fullPage: boolean): Promise<{ regions: Array<Omit<Region, "id"> & { idHint: string }>; pii: Array<Omit<Region, "id"> & { idHint: string }> }> {
  return page.evaluate(({ full, piiSource }) => {
    const out: Array<{ idHint: string; label: string; kind: string; rect: { x: number; y: number; w: number; h: number }; text?: string; selector?: string }> = [];
    const pii: typeof out = [];
    const sx = full ? window.scrollX : 0;
    const sy = full ? window.scrollY : 0;
    const vw = window.innerWidth;
    const vh = full ? document.documentElement.scrollHeight : window.innerHeight;
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      return r.width > 4 && r.height > 4 && st.visibility !== "hidden" && st.display !== "none" && Number(st.opacity) > 0.05 && r.bottom + sy > 0 && r.right > 0 && r.left < vw && r.top + sy < vh;
    };
    const selectorOf = (el: Element): string => {
      if (el.id) return `#${CSS.escape(el.id)}`;
      const parts: string[] = [];
      let e: Element | null = el;
      while (e && e !== document.body && parts.length < 4) {
        let p = e.tagName.toLowerCase();
        const parent: Element | null = e.parentElement;
        if (parent) {
          const same = Array.from(parent.children).filter((c) => c.tagName === e!.tagName);
          if (same.length > 1) p += `:nth-of-type(${same.indexOf(e) + 1})`;
        }
        parts.unshift(p);
        e = parent;
      }
      return parts.join(" > ");
    };
    const labelOf = (el: Element) =>
      (el.getAttribute("aria-label") || (el as HTMLInputElement).placeholder || el.getAttribute("title") || (el as HTMLElement).innerText || el.getAttribute("alt") || "").trim().replace(/\s+/g, " ").slice(0, 80);
    const push = (el: Element, kind: string, target = out, labelFrom?: Element) => {
      if (!visible(el)) return;
      const r = el.getBoundingClientRect();
      const label = labelOf(labelFrom ?? el) || labelOf(el);
      target.push({ idHint: `${kind}-${label || el.tagName.toLowerCase()}`, label: label || el.tagName.toLowerCase(), kind, rect: { x: r.left + sx, y: r.top + sy, w: r.width, h: r.height }, text: label, selector: selectorOf(el) });
    };
    document.querySelectorAll("input, textarea, select, [contenteditable=true]").forEach((el) => {
      // cutia vine de la eticheta care înconjoară câmpul (arată ca un câmp), textul de la câmpul însuși
      const lbl = el.closest("label");
      push(lbl && lbl.getBoundingClientRect().height < 120 ? lbl : el, "input", out, el);
    });
    document.querySelectorAll("button, [role=button], a.btn, .btn").forEach((el) => push(el, "button"));
    document.querySelectorAll("h1, h2, h3").forEach((el) => push(el, "heading"));
    document.querySelectorAll("nav, aside, [role=navigation]").forEach((el) => push(el, "nav"));
    document.querySelectorAll("article, .card, [class*=card], section, .panel").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width * r.height > 8000 && r.width < vw * 0.98) push(el, "custom");
    });
    document.querySelectorAll("img, svg").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width * r.height > 20000) push(el, "image");
    });
    // date personale: candidați largi aici (email, șiruri de cifre, saluturi cu nume, ID-uri); validarea
    // (sume de control, excluderea datelor și prețurilor) se face în Node, cu src/assets/pii.ts
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const candRe = new RegExp(piiSource, "i");
    let n: Node | null;
    while ((n = walker.nextNode())) {
      const t = (n.textContent ?? "").trim();
      if (t && candRe.test(t) && n.parentElement) {
        push(n.parentElement, "pii", pii);
        const last = pii[pii.length - 1];
        if (last) last.text = t.slice(0, 200);
      }
    }
    return { regions: out.slice(0, 120), pii };
  }, { full: fullPage, piiSource: PII_CANDIDATE_SOURCE }) as Promise<{ regions: Array<Omit<Region, "id"> & { idHint: string }>; pii: Array<Omit<Region, "id"> & { idHint: string }> }>;
}

/**
 * Logo-ul din pagină: imaginea sau SVG-ul din partea de sus cu cel mai mare scor („logo” în id, clasă, alt
 * sau aria-label, pe el sau pe părinți; link spre pagina principală; în antet sau meniu). Fără un semnal
 * clar (scor sub 3) nu se întoarce nimic: un logo greșit e mai rău decât niciunul.
 */
async function extractLogo(page: Page): Promise<{ kind: "svg"; svg: string } | { kind: "img"; src: string } | null> {
  return page.evaluate(() => {
    const mentions = (el: Element | null, depth: number): boolean => {
      for (let e = el, d = 0; e && d <= depth; e = e.parentElement, d++) {
        const attrs = [e.id, e.getAttribute("class") ?? "", e.getAttribute("alt") ?? "", e.getAttribute("aria-label") ?? "", e.getAttribute("title") ?? ""].join(" ");
        if (/logo|brand/i.test(attrs)) return true;
      }
      return false;
    };
    const homeLink = (el: Element) => {
      const a = el.closest("a[href]") as HTMLAnchorElement | null;
      if (!a) return false;
      try {
        const u = new URL(a.href, location.href);
        return u.origin === location.origin && /^\/?(index\.html?)?$/.test(u.pathname.replace(/^\//, ""));
      } catch {
        return false;
      }
    };
    let best: { el: Element; score: number } | null = null;
    for (const el of Array.from(document.querySelectorAll("img, svg"))) {
      if (el.tagName.toLowerCase() === "svg" && el.parentElement?.closest("svg")) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 16 || r.height < 12 || r.width > 600 || r.top + window.scrollY > 260) continue;
      const score = (mentions(el, 3) ? 3 : 0) + (homeLink(el) ? 2 : 0) + (el.closest("header, nav, [role=banner]") ? 1 : 0);
      if (!best || score > best.score) best = { el, score };
    }
    if (!best || best.score < 3) return null;
    if (best.el.tagName.toLowerCase() === "img") {
      const img = best.el as HTMLImageElement;
      return img.currentSrc || img.src ? { kind: "img" as const, src: img.currentSrc || img.src } : null;
    }
    const svg = best.el.cloneNode(true) as SVGSVGElement;
    // simbolurile externe (<use href="#…">) nu se văd în afara paginii: atunci nu se salvează
    if (svg.querySelector("use")) return null;
    const r = best.el.getBoundingClientRect();
    if (!svg.getAttribute("xmlns")) svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    if (!svg.getAttribute("viewBox")) svg.setAttribute("viewBox", `0 0 ${Math.round(r.width)} ${Math.round(r.height)}`);
    svg.setAttribute("width", String(Math.round(r.width)));
    svg.setAttribute("height", String(Math.round(r.height)));
    // currentColor rămâne culoarea din pagină (logo-ul nu se recolorează)
    svg.setAttribute("style", `color: ${getComputedStyle(best.el).color}`);
    const out = svg.outerHTML;
    return out.length < 400_000 ? { kind: "svg" as const, svg: out } : null;
  });
}

async function saveLogo(page: Page, found: NonNullable<Awaited<ReturnType<typeof extractLogo>>>, base: string): Promise<CaptureResult["logo"] | undefined> {
  if (found.kind === "svg") {
    fs.writeFileSync(`${base}.svg`, found.svg);
    return { file: `${base}.svg`, source: "inline-svg" };
  }
  const ext = (type: string, url: string) => (/svg/.test(type) || /\.svg(\?|$)/i.test(url) ? "svg" : /png/.test(type) || /\.png(\?|$)/i.test(url) ? "png" : /webp/.test(type) ? "webp" : /jpe?g/.test(type) || /\.jpe?g(\?|$)/i.test(url) ? "jpg" : null);
  let bytes: Buffer | null = null;
  let type = "";
  if (found.src.startsWith("data:")) {
    const m = found.src.match(/^data:([^;,]+)(;base64)?,(.*)$/s);
    if (m) {
      type = m[1];
      bytes = m[2] ? Buffer.from(m[3], "base64") : Buffer.from(decodeURIComponent(m[3]));
    }
  } else if (found.src.startsWith("file:")) {
    const p = fileURLToPath(found.src);
    if (fs.existsSync(p)) bytes = fs.readFileSync(p);
  } else {
    const r = await page.request.get(found.src, { timeout: 15_000 }).catch(() => null);
    if (r?.ok()) {
      type = r.headers()["content-type"] ?? "";
      bytes = await r.body();
    }
  }
  const e = ext(type, found.src);
  if (!bytes || !e || bytes.length > 3_000_000) return undefined;
  fs.writeFileSync(`${base}.${e}`, bytes);
  return { file: `${base}.${e}`, source: "img", url: found.src.startsWith("data:") ? undefined : found.src };
}

async function extractPageData(page: Page): Promise<PageData> {
  return page.evaluate(() => {
    const txt = (el: Element) => ((el as HTMLElement).innerText || "").trim().replace(/\s+/g, " ");
    const count = (m: Map<string, number>, k: string, w = 1) => m.set(k, (m.get(k) ?? 0) + w);
    const bgs = new Map<string, number>();
    const fgs = new Map<string, number>();
    const acc = new Map<string, number>();
    const fonts = new Map<string, number>();
    document.querySelectorAll("body *").forEach((el) => {
      const st = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const area = r.width * r.height;
      if (area < 1) return;
      if (st.backgroundColor && !st.backgroundColor.includes("rgba(0, 0, 0, 0)")) count(bgs, st.backgroundColor, area);
      if ((el as HTMLElement).innerText && el.children.length === 0) {
        count(fgs, st.color, (el as HTMLElement).innerText.length);
        count(fonts, st.fontFamily.split(",")[0].replace(/["']/g, "").trim(), (el as HTMLElement).innerText.length);
      }
      if ((el.matches("button, .btn, a.btn, [role=button]") || st.cursor === "pointer") && !st.backgroundColor.includes("rgba(0, 0, 0, 0)")) count(acc, st.backgroundColor, 1);
    });
    const top = (m: Map<string, number>, n: number) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n) as Array<[string, number]>;
    const cssVars: Record<string, string> = {};
    const rootStyle = getComputedStyle(document.documentElement);
    // variabilele CSS din stilul calculat (merge și când foile de stil nu se pot citi, de ex. file://)
    for (let i = 0; i < rootStyle.length; i++) {
      const name = rootStyle.item(i);
      if (name.startsWith("--")) cssVars[name] = rootStyle.getPropertyValue(name).trim();
    }
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules)) {
          if (rule instanceof CSSStyleRule && rule.selectorText === ":root") {
            for (const name of Array.from(rule.style)) if (name.startsWith("--")) cssVars[name] = rootStyle.getPropertyValue(name).trim();
          }
        }
      } catch {
        /* foi de stil din alt domeniu */
      }
    }
    // forma brandului din CSS-ul real: raze de colț, umbre, gradiente, spațiere (pentru brand kit)
    const radii = new Map<string, number>();
    const shadows = new Map<string, number>();
    const grads = new Map<string, number>();
    const gaps = new Map<string, number>();
    document.querySelectorAll("button, .btn, a.btn, [role=button], input, textarea, .card, [class*=card], article, aside, nav").forEach((el) => {
      const st = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) return;
      const rad = parseFloat(st.borderTopLeftRadius);
      if (!Number.isNaN(rad)) count(radii, String(rad >= r.height / 2 - 1 ? "pill" : Math.round(rad)), 1);
      if (st.boxShadow && st.boxShadow !== "none") count(shadows, st.boxShadow, 1);
    });
    document.querySelectorAll("body *").forEach((el) => {
      const st = getComputedStyle(el);
      if (st.backgroundImage && st.backgroundImage.includes("gradient(")) {
        const r = el.getBoundingClientRect();
        count(grads, st.backgroundImage.slice(0, 400), Math.max(1, r.width * r.height));
      }
      if ((st.display.includes("flex") || st.display.includes("grid")) && st.gap && st.gap !== "normal") {
        const g = parseFloat(st.gap);
        if (!Number.isNaN(g) && g > 0) count(gaps, String(Math.round(g)), 1);
      }
    });
    // meniul și subsolul nu descriu produsul: titlurile lor nu intră în titlurile paginii
    const chrome = (el: Element) => !!el.closest("nav, footer, [role=navigation], [role=contentinfo]");
    // pe site-urile reale, CTA-ul e de obicei un link stilizat ca buton (fundal sau contur, padding, text scurt)
    const buttonLike = (a: Element) => {
      const t = txt(a);
      if (!t || t.split(/\s+/).length > 6) return false;
      if (/(btn|button|cta)/i.test(a.getAttribute("class") ?? "")) return true;
      const st = getComputedStyle(a);
      const filled = !!st.backgroundColor && st.backgroundColor !== "transparent" && !/rgba\([^)]*,\s*0\)$/.test(st.backgroundColor);
      const bordered = parseFloat(st.borderTopWidth) > 0 && st.borderTopStyle !== "none";
      const padded = parseFloat(st.paddingLeft) + parseFloat(st.paddingRight) >= 16 && parseFloat(st.paddingTop) >= 4;
      return (filled || bordered) && padded;
    };
    const og: Record<string, string> = {};
    document.querySelectorAll("meta[property^='og:']").forEach((m) => (og[m.getAttribute("property") ?? ""] = m.getAttribute("content") ?? ""));
    return {
      url: location.href,
      title: document.title,
      description: document.querySelector("meta[name=description]")?.getAttribute("content") ?? "",
      og,
      headings: Array.from(document.querySelectorAll("h1, h2, h3, h4")).filter((h) => !chrome(h)).map((h) => ({ level: Number(h.tagName[1]), text: txt(h) })).filter((h) => h.text),
      paragraphs: Array.from(document.querySelectorAll("p")).map(txt).filter((t) => t.length > 20).slice(0, 80),
      listItems: Array.from(document.querySelectorAll("li")).map(txt).filter(Boolean).slice(0, 120),
      links: Array.from(document.querySelectorAll("a[href]")).map((a) => ({ text: txt(a), href: (a as HTMLAnchorElement).href })).slice(0, 150),
      // textul unui buton e scurt; cardurile de meniu cu rol de buton (titlu + descriere) nu sunt butoane de acțiune
      buttons: [...new Set([...Array.from(document.querySelectorAll("button, .btn, [role=button]")), ...Array.from(document.querySelectorAll("a[href]")).filter(buttonLike)].map((el) => txt(el).replace(/^[-–•·]\s*/, "")).filter((t) => t && t.split(/\s+/).length <= 6))].slice(0, 40),
      colors: { backgrounds: top(bgs, 8), texts: top(fgs, 6), accents: top(acc, 6) },
      fonts: top(fonts, 5),
      shapes: { radii: top(radii, 5), shadows: top(shadows, 4), gradients: top(grads, 4), gaps: top(gaps, 5) },
      cssVars,
      times: Array.from(document.querySelectorAll("time")).map((t) => ({ datetime: t.getAttribute("datetime") ?? "", text: txt(t) })),
      fullText: (document.body.innerText || "").slice(0, 60000),
    };
  });
}

async function runStep(page: Page, s: CaptureStep): Promise<void> {
  switch (s.action) {
    case "goto":
      await page.goto(s.url, { waitUntil: "networkidle" });
      break;
    case "click":
      await page.click(s.selector);
      break;
    case "hover":
      await page.hover(s.selector);
      break;
    case "type":
      await page.click(s.selector);
      await page.keyboard.type(s.text, { delay: s.delayMs });
      break;
    case "press":
      await page.keyboard.press(s.key);
      break;
    case "scroll":
      await page.mouse.wheel(0, s.y);
      break;
    case "wait":
      await page.waitForTimeout(s.ms);
      break;
    case "drag":
      await page.dragAndDrop(s.from, s.to);
      break;
  }
}

/**
 * Înregistrare cadru cu cadru: capturi JPEG cât de des se poate în timp ce rulează pașii,
 * apoi un MP4 cu FPS constant în care fiecare cadru de ieșire arată ultima captură de până atunci.
 * Pixelii sunt cei reali, la rezoluția 2x a capturii.
 */
async function recordSteps(page: Page, steps: CaptureStep[], fps: number, tailMs: number, outFile: string, workDir: string) {
  const framesDir = path.join(workDir, "frames");
  fs.rmSync(framesDir, { recursive: true, force: true });
  fs.mkdirSync(framesDir, { recursive: true });
  const shots: Array<{ t: number; file: string }> = [];
  let done = false;
  const t0 = Date.now();
  const loop = (async () => {
    let i = 0;
    while (!done) {
      const file = path.join(framesDir, `f${String(i).padStart(5, "0")}.jpg`);
      const t = Date.now() - t0;
      await page.screenshot({ path: file, type: "jpeg", quality: 92, animations: "allow", caret: "initial" });
      shots.push({ t, file });
      i++;
    }
  })();
  for (const s of steps) await runStep(page, s);
  await page.waitForTimeout(tailMs);
  done = true;
  await loop;
  const total = Date.now() - t0;
  const n = Math.max(1, Math.round((total / 1000) * fps));
  const lines: string[] = [];
  let j = 0;
  for (let k = 0; k < n; k++) {
    const t = (k / fps) * 1000;
    while (j + 1 < shots.length && shots[j + 1].t <= t) j++;
    lines.push(`file '${shots[j].file.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`, `duration ${(1 / fps).toFixed(6)}`);
  }
  lines.push(`file '${shots[shots.length - 1].file.replace(/\\/g, "/")}'`);
  const listFile = path.join(workDir, "frames.txt");
  fs.writeFileSync(listFile, lines.join("\n"));
  await ffmpeg(["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-vf", `scale=trunc(iw/2)*2:trunc(ih/2)*2`, "-r", String(fps), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", "-preset", "medium", path.resolve(outFile)]);
  fs.rmSync(framesDir, { recursive: true, force: true });
  return { frames: n, durationSec: n / fps, shots: shots.length };
}

/**
 * tsx/esbuild păstrează numele funcțiilor cu un ajutor `__name(...)`, care nu există în pagină.
 * Îl definim în fiecare pagină înainte de orice `page.evaluate`.
 */
const NAME_SHIM = "globalThis.__name = globalThis.__name || ((f) => f);";

async function openContext(req: CaptureRequest, headed: boolean): Promise<{ ctx: BrowserContext; close: () => Promise<void> }> {
  const r = await openContextRaw(req, headed);
  await r.ctx.addInitScript({ content: NAME_SHIM });
  return r;
}

async function openContextRaw(req: CaptureRequest, headed: boolean): Promise<{ ctx: BrowserContext; close: () => Promise<void> }> {
  const vp = VIEWPORTS[req.viewport];
  const opts = {
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.dpr,
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
    locale: "ro-RO",
    reducedMotion: "no-preference" as const,
  };
  if (req.profile) {
    const dir = path.join(PATHS.browserProfiles, req.profile.replace(/[^a-z0-9-]/gi, "_"));
    fs.mkdirSync(dir, { recursive: true });
    const ctx = await chromium.launchPersistentContext(dir, { ...opts, headless: !headed });
    return { ctx, close: () => ctx.close() };
  }
  const browser = await chromium.launch({ headless: !headed });
  const ctx = await browser.newContext(opts);
  return { ctx, close: () => browser.close() };
}

/** Deschide un browser vizibil cu profil persistent; utilizatorul se autentifică singur, apoi închide fereastra. */
export async function interactiveLogin(url: string, profile: string): Promise<void> {
  const { ctx, close } = await openContext(CaptureRequest.parse({ id: "login", url, profile }), true);
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto(url);
  await new Promise<void>((resolve) => ctx.on("close", () => resolve()));
  await close().catch(() => undefined);
}

export async function capture(reqInput: CaptureRequestInput, outDir: string, opts: { headed?: boolean } = {}): Promise<CaptureResult> {
  const req = CaptureRequest.parse(reqInput);
  fs.mkdirSync(outDir, { recursive: true });
  const { ctx, close } = await openContext(req, opts.headed ?? false);
  try {
    const page = ctx.pages()[0] ?? (await ctx.newPage());
    const resp = await page.goto(req.url, { waitUntil: "networkidle", timeout: 60_000 });
    if (resp && resp.status() >= 400) throw new MmsError("CAPTURE_HTTP", `Pagina ${req.url} a răspuns cu ${resp.status()}.`);
    await page.addStyleTag({ content: DEFAULT_CSS + req.css });
    await page.evaluate(() => document.fonts.ready);
    for (const s of req.before) await runStep(page, s);
    await page.waitForTimeout(300);
    const vp = VIEWPORTS[req.viewport];
    const shotFile = path.join(outDir, `${req.id}.png`);
    if (req.fullPage) await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: shotFile, fullPage: req.fullPage, animations: "disabled", caret: "hide" });
    const raw = await extractRegions(page, req.fullPage);
    const pageData = await extractPageData(page);
    const foundLogo = req.record ? null : await extractLogo(page).catch(() => null);
    const logo = foundLogo ? await saveLogo(page, foundLogo, path.join(outDir, `${req.id}-logo`)).catch(() => undefined) : undefined;
    const dims = await page.evaluate((full) => ({ w: window.innerWidth, h: full ? document.documentElement.scrollHeight : window.innerHeight }), req.fullPage);
    const used = new Set<string>();
    const toRegion = (r: Omit<Region, "id"> & { idHint: string }): Region => {
      let id = slug(r.idHint);
      let k = 2;
      while (used.has(id)) id = `${slug(r.idHint)}-${k++}`;
      used.add(id);
      return { id, label: r.label, kind: r.kind as Region["kind"], text: r.text, selector: r.selector, rect: { x: r.rect.x * vp.dpr, y: r.rect.y * vp.dpr, w: r.rect.w * vp.dpr, h: r.rect.h * vp.dpr } };
    };
    const result: CaptureResult = {
      id: req.id,
      research: req.research,
      url: req.url,
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.dpr,
      fullPage: req.fullPage,
      screenshot: shotFile,
      width: Math.round(dims.w * vp.dpr),
      height: Math.round(dims.h * vp.dpr),
      regions: raw.regions.map(toRegion),
      // doar candidații confirmați de validatori; eticheta spune ce fel de dată personală e
      pii: raw.pii
        .map((r) => ({ r, hits: findPii(r.text ?? r.label) }))
        .filter((x) => x.hits.length)
        .map((x) => toRegion({ ...x.r, idHint: `pii-${x.hits[0].kind}`, label: [...new Set(x.hits.map((h) => PII_LABEL[h.kind]))].join(", ") })),
      page: pageData,
      ...(logo ? { logo } : {}),
      capturedAt: new Date().toISOString(),
    };
    if (req.record) {
      if (req.fullPage) await page.evaluate(() => window.scrollTo(0, 0));
      const vfile = path.join(outDir, `${req.id}.mp4`);
      const r = await recordSteps(page, req.record.steps, req.record.fps, req.record.tailMs, vfile, outDir);
      result.recording = { file: vfile, fps: req.record.fps, frames: r.frames, durationSec: r.durationSec, width: Math.round(vp.width * vp.dpr) - (Math.round(vp.width * vp.dpr) % 2), height: Math.round(vp.height * vp.dpr) - (Math.round(vp.height * vp.dpr) % 2) };
    }
    fs.writeFileSync(path.join(outDir, `${req.id}.json`), JSON.stringify(result, null, 2));
    return result;
  } finally {
    await close();
  }
}
