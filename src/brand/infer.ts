/**
 * Brand kit dedus din materiale reale: culorile din CSS-ul paginii (variabile, fundaluri, butoane)
 * și din logo, fonturile folosite pe site. Fonturile care nu sunt în bibliotecă se înlocuiesc cu
 * o alternativă liberă apropiată, cu mențiune.
 */
import type { PageData } from "../capture/capture";
import type { Asset, Brand, BrandInput } from "../core/schema";
import { contrastRatio, hexToRgb, luminance, mix, rgbToHex } from "../motion/core/color";
import { LIBRARY_FONTS } from "../motion/fonts-library";

function cssToHex(c: string): string | null {
  const t = c.trim();
  if (/^#[0-9a-f]{6}$/i.test(t)) return t.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(t)) return `#${t[1]}${t[1]}${t[2]}${t[2]}${t[3]}${t[3]}`.toLowerCase();
  const m = t.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/);
  if (m) {
    if (m[4] !== undefined && Number(m[4]) < 0.5) return null;
    return rgbToHex(Number(m[1]), Number(m[2]), Number(m[3]));
  }
  return null;
}

function saturation(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const mx = Math.max(r, g, b) / 255;
  const mn = Math.min(r, g, b) / 255;
  return mx === 0 ? 0 : (mx - mn) / mx;
}

/** Alege fontul din bibliotecă: același nume dacă există, altfel unul cu personalitate apropiată. */
export function matchLibraryFont(family: string | undefined, role: "display" | "body" | "mono", personality: string[] = []): { id: string; family: string; note: string } {
  const exact = family ? LIBRARY_FONTS.find((f) => f.family.toLowerCase() === family.toLowerCase()) : undefined;
  if (exact) return { id: exact.id, family: exact.family, note: "Același font ca pe site (din biblioteca liberă)." };
  const candidates = LIBRARY_FONTS.filter((f) => f.roles.includes(role) && f.style !== "italic");
  const scored = candidates.map((f) => ({ f, s: f.personality.filter((p) => personality.includes(p)).length }));
  scored.sort((a, b) => b.s - a.s);
  const pick = scored[0]?.f ?? candidates[0];
  return { id: pick.id, family: pick.family, note: family ? `Fontul „${family}” nu e în bibliotecă; folosesc alternativa liberă „${pick.family}”.` : "Font ales după personalitatea brandului." };
}

export function inferBrand(name: string, page: PageData | null, logo: Asset | null, personality: string[] = []): { brand: BrandInput; notes: string[] } {
  const notes: string[] = [];
  const vars = page ? Object.entries(page.cssVars).map(([k, v]) => [k, cssToHex(v)] as const).filter((x): x is readonly [string, string] => !!x[1]) : [];
  const byVar = (re: RegExp) => vars.find(([k]) => re.test(k))?.[1];
  const bgs = (page?.colors.backgrounds ?? []).map(([c]) => cssToHex(c)).filter((c): c is string => !!c);
  const texts = (page?.colors.texts ?? []).map(([c]) => cssToHex(c)).filter((c): c is string => !!c);
  // accentele: culori saturate și luminoase de pe elemente interactive, ordonate după vizibilitate
  const accents = (page?.colors.accents ?? [])
    .map(([c, n]) => ({ c: cssToHex(c), n }))
    .filter((x): x is { c: string; n: number } => !!x.c && saturation(x.c) > 0.35 && luminance(x.c) > 0.06)
    .sort((a, b) => saturation(b.c) * Math.log(2 + b.n) * (0.3 + luminance(b.c)) - saturation(a.c) * Math.log(2 + a.n) * (0.3 + luminance(a.c)))
    .map((x) => x.c);
  const logoColors = (logo?.analysis.palette ?? []).filter((c) => saturation(c) > 0.3);

  const background = byVar(/^--(bg|background)$/) ?? bgs[0] ?? "#0f1020";
  const text = byVar(/^--(text|fg|foreground)$/) ?? texts.find((t) => contrastRatio(t, background) > 4.5) ?? (luminance(background) < 0.4 ? "#f5f5f7" : "#111114");
  const primary = byVar(/^--(primary|brand|accent-?1)$/) ?? accents[0] ?? logoColors[0] ?? mix(background, "#6c5cff", 0.9);
  const accent = byVar(/^--(accent|secondary|highlight)$/) ?? accents.find((a) => a !== primary) ?? logoColors.find((c) => c !== primary) ?? mix(primary, "#ffffff", 0.35);
  const surface = byVar(/^--(surface|card|panel)$/) ?? bgs.find((b) => b !== background) ?? mix(background, text, 0.08);
  const muted = byVar(/^--(muted|text-?muted|subtle)$/) ?? mix(text, background, 0.4);
  if (!page) notes.push("Fără captură de pagină: culorile vin doar din logo sau sunt implicite.");
  const fonts = page?.fonts.map(([f]) => f) ?? [];
  const display = matchLibraryFont(fonts.find((f) => !/inter|system|arial|helvetica/i.test(f)) ?? fonts[0], "display", personality);
  const body = matchLibraryFont(fonts[0], "body", personality);
  const mono = matchLibraryFont("JetBrains Mono", "mono");
  notes.push(display.note, body.note);
  const brand: BrandInput = {
    schemaVersion: 1,
    name,
    logo: { primary: logo?.id, rules: { allowRecolor: false, allowRotate: false, allowEffects: true, clearSpacePct: 0.25 } },
    colors: { primary, secondary: surface, accent, background, surface, text, textMuted: muted, extra: [], origin: page ? "extracted" : "inferred" },
    typography: {
      display: { family: display.family, source: "library", ref: display.id, weight: 700, displayWeight: 800, tracking: -0.02, uppercase: false },
      body: { family: body.family, source: "library", ref: body.id, weight: 500, displayWeight: 700, tracking: 0, uppercase: false },
      mono: { family: mono.family, source: "library", ref: mono.id, weight: 500, displayWeight: 700, tracking: 0, uppercase: false },
      origin: page ? "extracted" : "inferred",
    },
    shape: { radius: 16, spacing: 8, shadow: "soft" },
    gradients: [{ from: primary, to: accent, angle: 135 }],
    personality: { keywords: personality, density: "balanced", motion: "smooth" },
  };
  return { brand, notes };
}

export type { Brand };
