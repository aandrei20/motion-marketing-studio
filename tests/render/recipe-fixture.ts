/**
 * Proiect sintetic pentru regresia vizuală a rețetelor și a secvențelor: materialele de probă din bibliotecă
 * (capturi reale ale produsului FICTIV), o scenă pe fiecare rețetă, compilat prin compilatorul real
 * (gramatica de montaj, tranziții, layout pe format, subtitrări fără voce).
 */
import fs from "node:fs";
import path from "node:path";
import { Asset, Brand, Brief, Research, Script, Storyboard, type FormatSpec, type Timeline } from "../../src/core/schema";
import { makeFormat } from "../../src/core/formats";
import { PATHS } from "../../src/core/paths";
import { RECIPES } from "../../src/recipes/recipes";
import { compileTimeline } from "../../src/timeline/compile";

const SAMPLES = path.join(PATHS.library, "catalog", "samples");

/** Pregătește fișierele proiectului în MMS_PROJECTS_DIR (căile publice ale timeline-ului le găsesc acolo). */
export function recipeFixture(projectsDir: string, format: FormatSpec = makeFormat("16x9", { platform: "youtube", durationSec: 40 })): Timeline {
  const id = "golden-recipes";
  const dir = path.join(projectsDir, id, "assets");
  fs.mkdirSync(dir, { recursive: true });
  const files: Record<string, string> = { screenshot: "screenshot.png", tall: "tall-screenshot.png", image: "image.png", logo: "logo.svg" };
  for (const f of Object.values(files)) fs.copyFileSync(path.join(SAMPLES, f), path.join(dir, f));
  const t0 = "2026-10-08T00:00:00.000Z";
  const asset = (aid: string, file: string, role: string, w: number, h: number, extra: Record<string, unknown> = {}) =>
    Asset.parse({ id: aid, file: `assets/${file}`, originalName: file, sha256: aid, bytes: 1, mime: file.endsWith(".svg") ? "image/svg+xml" : "image/png", type: file.endsWith(".svg") ? "svg" : "image", origin: "real_capture", role, roleSource: "user", roleConfidence: 1, showsProductUI: role === "screenshot", rights: { thirdParty: false, status: "owned" }, media: { width: w, height: h }, analysis: { focalPoint: { x: 0.5, y: 0.4 } }, addedAt: t0, ...extra });
  const assets = {
    schemaVersion: 1 as const,
    assets: [
      asset("shot", files.screenshot, "screenshot", 2880, 1800, { capture: { url: "file://demo", viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, capturedAt: t0, fullPage: false, regions: [{ id: "cautare", label: "Caută sarcini", kind: "input", rect: { x: 1100, y: 150, w: 900, h: 90 }, text: "Caută" }] } }),
      asset("tall", files.tall, "screenshot", 2880, 4944, { capture: { url: "file://demo", viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, capturedAt: t0, fullPage: true, regions: [] } }),
      asset("img", files.image, "photo", 2880, 1800),
      asset("logo", files.logo, "logo", 120, 120),
    ],
  };
  const brand = Brand.parse({ schemaVersion: 1, name: "Produs Test", logo: { primary: "logo", rules: {} }, colors: { primary: "#6c5cff", accent: "#2de2b0", background: "#0f1020", text: "#f2f3ff", origin: "default" }, typography: { display: { family: "Space Grotesk", source: "library", ref: "space-grotesk" }, body: { family: "Inter", source: "library", ref: "inter" }, origin: "default" }, shape: { radius: 12, spacing: 12, shadow: "soft" }, personality: {} });
  const brief = Brief.parse({ schemaVersion: 1, objective: "signups", audience: { description: "test" }, userVision: {}, pacing: "medium", direction: "technical", visual: {}, cta: { text: "Încearcă gratuit" }, platforms: [format.platform], durationSec: 40, audio: { voice: { mode: "none" }, music: { mode: "none" }, sfxDensity: "none" }, captions: { burnIn: false, srt: false } });
  const research = Research.parse({ schemaVersion: 1, sources: [{ id: "s", kind: "user-provided", title: "test", fetchedAt: t0, contentHash: "h", reliability: "user" }], claims: [{ id: "c-metric", text: "3 ore câștigate pe săptămână", kind: "fact", category: "metric", sourceIds: ["s"], confidence: "high", status: "approved-by-user", checkedAt: t0 }] });
  const slotFor = (kind: string, multiple?: boolean): string | string[] => (kind === "logo" ? "logo" : kind === "tall-screenshot" ? "tall" : kind === "image" ? "img" : multiple ? ["shot", "tall"] : "shot");
  const scenes = RECIPES.map((r) => ({
    id: `r-${r.id}`,
    purpose: `test vizual pentru ${r.id}`,
    narrativeRole: r.roles[0],
    emotionalRole: "confidence",
    energy: 0.6,
    shot: "close-up",
    durationSec: Math.max(3, r.minSec + 0.5),
    lineIds: r.id === "proof-metric" ? ["l-metric"] : ["l-text"],
    recipe: { id: r.id, params: r.id === "proof-metric" ? { mode: "metric", value: 3, suffix: " ore", claimId: "c-metric" } : r.id === "technical-demo" ? { mode: "terminal", entries: [{ cmd: "npx produs init", output: ["proiect creat", "gata în 2 s"] }] } : {} },
    slots: Object.fromEntries(r.slots.map((s) => [s.name, s.name === "before" ? "img" : s.name === "after" ? "shot" : slotFor(s.kind, s.multiple)])),
    text: { headline: r.roles[0] === "cta" ? "Produs Test" : "Planifică săptămâna în 5 minute", sub: r.roles[0] === "cta" ? "Încearcă gratuit" : "Toate sarcinile într-un loc", items: ["Căutare", "Focus", "Kanban"] },
    beat: { snap: "none" },
    transitionIn: { capability: "tr.cut", durationFrames: 0 },
  }));
  const storyboard = Storyboard.parse({ schemaVersion: 1, direction: "technical", scenes });
  const script = Script.parse({ schemaVersion: 1, textLanguage: "ro", voiceLanguage: null, lines: [{ id: "l-text", origin: "ai", onScreen: "Planifică săptămâna" }, { id: "l-metric", origin: "ai", onScreen: "3 ore", claimIds: ["c-metric"] }] });
  const project = { schemaVersion: 1 as const, id, name: "golden", createdAt: t0, updatedAt: t0, product: { name: "Produs Test", category: "saas" as const }, language: { text: "ro", voice: null }, formats: [format], currentVersion: "v1", status: "in-production" as const, seed: 3, platformOverrides: {} };
  return compileTimeline({ project, versionId: "v1", format, brief, brand, research, assets, script, storyboard, voice: {}, beatGrid: null }).timeline;
}
