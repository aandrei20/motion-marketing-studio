/**
 * Bucla de calitate: scorul quality-v1, sistemul de probleme (inclusiv migrarea severităților vechi),
 * operațiile de editare, motorul de impact, registrul de sistem, profilurile de platformă și analiza pe pixeli.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Finding, Storyboard, type Timeline } from "../../src/core/schema";
import { fingerprint, stableStringify } from "../../src/core/hash";
import { countBySeverity, dedupe, issueKey, makeIssue, prioritize } from "../../src/quality/issues";
import { resolveQualityConfig, scoreDelta, scoreQuality } from "../../src/quality/score";
import { applyEditOps, mergeOps } from "../../src/editing/ops";
import { diffFingerprints, planImpact, sceneContentKey, type VersionFingerprint } from "../../src/pipeline/impact";
import { SYSTEM_CAPABILITIES, capabilitiesToRerun, downstream } from "../../src/pipeline/graph";
import { PLATFORM_PROFILES, platformProfile } from "../../src/platform/profiles";
import { analyzeSample, detailOccupancy, lumaMap, measuredContrast, pickSamples, type Raster } from "../../src/critique/pixel";
import { CHECKS, PASSES, checksForDepth } from "../../src/quality/checks";
import { PATHS } from "../../src/core/paths";

const issue = (o: Partial<Parameters<typeof makeIssue>[0]> = {}) => makeIssue({ frame: 10, sceneId: "s1", dimension: "readability", severity: "high", problem: "Text prea mic: 8 px", recommendation: "Mărește", ...o }, `x${Math.round(Math.random() * 1e6)}`, 1, 30);

describe("sistemul de probleme", () => {
  it("are toate câmpurile cerute și categoria verificării", () => {
    const f = issue({ suggestedFix: [{ op: "scene-extend", sceneId: "s1", deltaSec: 0.5 }] });
    for (const k of ["id", "severity", "category", "timecode", "durationSec", "sceneId", "layerId", "problem", "whyItMatters", "recommendation", "confidence", "autoFixable", "suggestedFix"]) expect(f).toHaveProperty(k);
    expect(f.category).toBe("typography");
    expect(f.autoFixable).toBe(true);
    expect(f.whyItMatters.length).toBeGreaterThan(10);
    expect(f.timecode).toBe("00:00.33"); // cadrul 10 la 30 fps
  });
  it("citește problemele vechi (blocker/major/minor/nit, fără categorie)", () => {
    const old = { id: "v1", round: 0, frame: 0, timecode: null, sceneId: null, dimension: "claims", severity: "blocker", problem: "x", recommendation: "y", source: "auto-check", status: "open" };
    const f = Finding.parse(old);
    expect(f.severity).toBe("critical");
    expect(f.category).toBe("claims");
    expect(Finding.parse({ ...old, severity: "nit", dimension: "variety" }).severity).toBe("low");
  });
  it("prioritizează, deduplică și numără", () => {
    const a = issue({ severity: "medium" });
    const b = issue({ severity: "critical", problem: "Text prea mic: 6 px" });
    const c = issue({ severity: "low", dimension: "motion", problem: "Altceva" });
    expect(prioritize([c, a, b]).map((x) => x.severity)).toEqual(["critical", "medium", "low"]);
    // aceeași verificare, aceeași scenă, același text fără cifre → aceeași problemă, gravitatea maximă
    expect(issueKey(a)).toBe(issueKey(b));
    const d = dedupe([a, b, c]);
    expect(d).toHaveLength(2);
    expect(d.find((x) => x.dimension === "readability")!.severity).toBe("critical");
    expect(countBySeverity([a, b, c])).toEqual({ critical: 1, high: 0, medium: 1, low: 1 });
  });
});

describe("scorul de calitate quality-v1", () => {
  const all = ["story", "creative", "visual", "motion", "typography", "ui", "audio", "brand", "claims", "technical", "platform"] as const;
  it("fără probleme și cu toate categoriile evaluate → PASS 100", () => {
    const s = scoreQuality({ issues: [], evaluated: all });
    expect(s.overall).toBe(100);
    expect(s.verdict).toBe("PASS");
    expect(s.coverage).toBe(1);
  });
  it("o problemă critică → FAIL, una mare → FIX, indiferent de medie", () => {
    expect(scoreQuality({ issues: [issue({ severity: "critical", dimension: "claims" })], evaluated: all }).verdict).toBe("FAIL");
    const fix = scoreQuality({ issues: [issue({ severity: "high" })], evaluated: all });
    expect(fix.verdict).toBe("FIX");
    expect(fix.overall).toBeGreaterThan(95);
  });
  it("praguri 92/95: POLISH între ele; pragurile sunt configurabile", () => {
    // câte o problemă medie în 10 categorii: fiecare 93, media ponderată între 92 și 95
    const dims = ["story", "contrast", "motion", "audio", "brand-consistency", "platform", "ui-legibility", "typography", "creative", "claims"] as const;
    const issues = dims.map((d, i) => issue({ severity: "medium", dimension: d, problem: `p${i}` }));
    const s = scoreQuality({ issues, evaluated: all });
    expect(s.overall).toBeGreaterThanOrEqual(92);
    expect(s.overall).toBeLessThan(95);
    expect(s.verdict).toBe("POLISH");
    expect(scoreQuality({ issues, evaluated: all, config: resolveQualityConfig({ passAt: 90, polishAt: 85 }) }).verdict).toBe("PASS");
  });
  it("categoriile neevaluate rămân null (nu 100) și sunt raportate", () => {
    const s = scoreQuality({ issues: [], evaluated: ["story", "claims"] });
    expect(s.categories.visual).toBeNull();
    expect(s.coverage).toBeLessThan(0.2);
    expect(s.reasons.join(" ")).toMatch(/neevaluate/);
  });
  it("rubrica regulii 7 sub prag împiedică PASS", () => {
    expect(scoreQuality({ issues: [], evaluated: all, rubricMinScene: 7 }).verdict).toBe("FIX");
  });
  it("încrederea ponderează penalizarea; diferența între scoruri se calculează pe categorii", () => {
    const sure = scoreQuality({ issues: [issue({ severity: "high", confidence: 1 })], evaluated: all });
    const unsure = scoreQuality({ issues: [issue({ severity: "high", confidence: 0.5 })], evaluated: all });
    expect(unsure.categories.typography!).toBeGreaterThan(sure.categories.typography!);
    expect(scoreDelta(sure, unsure).categories.typography).toBeGreaterThan(0);
  });
});

const sb0 = (): Storyboard =>
  Storyboard.parse({
    schemaVersion: 1,
    scenes: [
      { id: "s1-hook", purpose: "hook", narrativeRole: "hook", emotionalRole: "curiosity", energy: 0.8, shot: "title", recipe: { id: "hook-kinetic" } },
      { id: "s2-demo", purpose: "demo", narrativeRole: "demo", emotionalRole: "confidence", energy: 0.6, shot: "close-up", recipe: { id: "hook-kinetic" } },
      { id: "s3-cta", purpose: "cta", narrativeRole: "cta", emotionalRole: "urgency", energy: 0.5, shot: "title", recipe: { id: "cta-end" } },
    ],
  });

describe("operațiile de editare", () => {
  it("aplică, validează și descrie fiecare operație", () => {
    const r = applyEditOps(sb0(), [
      { op: "scene-extend", sceneId: "s2-demo", deltaSec: 0.5, currentSec: 2 },
      { op: "set-camera", sceneId: "s2-demo", capability: "camera.static", params: {} },
      { op: "layer-params", sceneId: "s1-hook", slot: "text-", params: { shadow: true } },
      { op: "layer-hide", sceneId: "s1-hook", slot: "fx-", hidden: true },
      { op: "scene-move", sceneId: "s3-cta", to: 0 },
      { op: "mix", musicDb: -3, sfxDb: 0, duckDb: 0 },
    ]);
    expect(r.storyboard.scenes.find((s) => s.id === "s2-demo")!.durationSec).toBe(2.5);
    expect(r.storyboard.scenes[0].id).toBe("s3-cta");
    expect(r.storyboard.scenes.find((s) => s.id === "s1-hook")!.overrides.map((o) => o.slot)).toEqual(["text-", "fx-"]);
    expect(r.storyboard.audio.musicGainDb).toBe(-3);
    expect(r.applied.every((a) => a.description.length > 5)).toBe(true);
  });
  it("refuză capabilități, rețete sau scene inexistente", () => {
    expect(() => applyEditOps(sb0(), [{ op: "set-camera", sceneId: "s1-hook", capability: "camera.nu-exista", params: {} }])).toThrow(/registry/);
    expect(() => applyEditOps(sb0(), [{ op: "set-recipe", sceneId: "s1-hook", recipe: "nu-exista", params: {} }])).toThrow(/Rețeta/);
    expect(() => applyEditOps(sb0(), [{ op: "scene-energy", sceneId: "zzz", energy: 1 }])).toThrow(/nu există/);
  });
  it("corecturile automate respectă scenele blocate; editorul nu", () => {
    const locked = applyEditOps(sb0(), [{ op: "scene-lock", sceneId: "s2-demo", locked: true }]).storyboard;
    const auto = applyEditOps(locked, [{ op: "scene-energy", sceneId: "s2-demo", energy: 1 }], { respectLocks: true });
    expect(auto.applied[0].skipped).toBe("locked");
    expect(auto.storyboard.scenes[1].energy).toBe(0.6);
    expect(applyEditOps(locked, [{ op: "scene-energy", sceneId: "s2-demo", energy: 1 }]).storyboard.scenes[1].energy).toBe(1);
  });
  it("comasează operațiile repetate pe aceeași țintă", () => {
    const m = mergeOps([
      { op: "scene-extend", sceneId: "a", deltaSec: 0.2 },
      { op: "scene-extend", sceneId: "a", deltaSec: 0.6 },
      { op: "layer-params", sceneId: "a", slot: "t", params: { shadow: true } },
      { op: "layer-params", sceneId: "a", slot: "t", params: { color: "text" } },
      { op: "recompile" },
      { op: "recompile" },
    ]);
    expect(m).toHaveLength(3);
    expect(m[0]).toMatchObject({ deltaSec: 0.6 });
    expect(m[1]).toMatchObject({ params: { shadow: true, color: "text" } });
  });
});

describe("amprente și motorul de impact", () => {
  it("amprenta nu depinde de ordinea cheilor", () => {
    expect(stableStringify({ b: 1, a: [1, { d: 2, c: 3 }] })).toBe('{"a":[1,{"c":3,"d":2}],"b":1}');
    expect(fingerprint({ a: 1, b: 2 })).toBe(fingerprint({ b: 2, a: 1 }));
  });
  it("o scenă mutată în timp păstrează aceeași amprentă de conținut", () => {
    const t = { width: 1080, height: 1920, fps: 30, palette: {}, fonts: [], typography: {}, overlays: [], captions: null, concept: false, safeZone: {} } as unknown as Timeline;
    const s = { id: "a", from: 0, durationInFrames: 60, transitionIn: null, camera: { keys: [] }, layers: [], meta: {} } as unknown as Timeline["scenes"][number];
    expect(sceneContentKey(t, s)).toBe(sceneContentKey(t, { ...s, from: 120 }));
    expect(sceneContentKey(t, s)).not.toBe(sceneContentKey(t, { ...s, durationInFrames: 61 }));
  });
  const fp = (o: Partial<VersionFingerprint> = {}): VersionFingerprint => ({
    versionId: "v1",
    inputs: { brief: "b", research: "r", brand: "k", assets: "a" },
    script: { voice: "v", text: "t" },
    storyboard: { global: "g", audio: "au", scenes: { s1: "1", s2: "2" }, order: ["s1", "s2"] },
    timelines: { "9x16": { global: "G", timing: "T", scenes: { s1: "x1", s2: "x2" }, order: ["s1", "s2"], cues: "C" } },
    mix: "m",
    ...o,
  });
  it("doar textul de pe ecran al unei scene: voce păstrată, mix păstrat, doar scena aceea se re-verifică", () => {
    const a = fp();
    const b = fp({ versionId: "v2", script: { voice: "v", text: "t2" }, timelines: { "9x16": { ...a.timelines["9x16"], scenes: { s1: "x1", s2: "x2b" } } } });
    const plan = planImpact(diffFingerprints(a, b));
    expect(plan.rerun.voice).toBe(false);
    expect(plan.rerun.audio).toBe(false);
    expect(plan.rerun.stills["9x16"]).toEqual(["s2"]);
  });
  it("vocea schimbată reface vocea și mixul; muzica schimbată doar mixul", () => {
    const a = fp();
    expect(planImpact(diffFingerprints(a, fp({ script: { voice: "v2", text: "t" } }))).rerun.voice).toBe(true);
    const music = planImpact(diffFingerprints(a, fp({ storyboard: { ...a.storyboard!, audio: "au2" } })));
    expect(music.rerun.voice).toBe(false);
    expect(music.rerun.audio).toBe(true);
    expect(music.rerun.stills["9x16"]).toEqual([]);
  });
  it("nicio schimbare: nimic de refăcut, video-ul rămâne valid", () => {
    const plan = planImpact(diffFingerprints(fp(), fp({ versionId: "v2" })));
    expect(plan.changed).toEqual([]);
    expect(plan.rerun.fullRender).toBe(false);
  });
  it("brand-ul schimbat face timeline-ul învechit în graf", () => {
    const stale = downstream(["brand"]);
    expect(stale.has("timeline")).toBe(true);
    expect(stale.has("full-render")).toBe(true);
    expect(stale.has("research")).toBe(false);
    expect(capabilitiesToRerun(["brand"]).map((c) => c.id)).toContain("timeline.compile");
  });
});

describe("registrul capabilităților de sistem", () => {
  it("fiecare intrare implementată trimite la o funcție exportată și la teste care există", () => {
    const ids = new Set<string>();
    for (const c of SYSTEM_CAPABILITIES) {
      expect(ids.has(c.id), c.id).toBe(false);
      ids.add(c.id);
      const [file, fn] = c.implementation.split("#");
      const abs = path.join(PATHS.root, file);
      expect(fs.existsSync(abs), `${c.id}: ${file}`).toBe(true);
      if (c.status !== "planned") expect(new RegExp(`export (async )?(function|const) ${fn}\\b`).test(fs.readFileSync(abs, "utf8")), `${c.id}: ${fn}`).toBe(true);
      for (const t of c.tests) expect(fs.existsSync(path.join(PATHS.root, t)), `${c.id}: ${t}`).toBe(true);
      if (c.status === "implemented") expect(c.tests.length + (c.cost === 0 ? 1 : 0), `${c.id} fără teste`).toBeGreaterThan(0);
    }
  });
});

describe("bucla adaptivă: pase și adâncimi", () => {
  it("are cele 10 pase, iar fiecare verificare aparține uneia", () => {
    expect(PASSES.map((p) => p.n)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (const c of CHECKS) expect(PASSES.some((p) => p.id === c.pass), c.id).toBe(true);
  });
  it("adâncimea fast nu randează nimic; final include video-ul", () => {
    const fast = checksForDepth("fast");
    expect(fast.run.every((c) => !["stills", "scene-render", "full-render"].includes(c.method))).toBe(true);
    expect(checksForDepth("standard").run.some((c) => c.method === "stills")).toBe(true);
    expect(checksForDepth("standard").run.some((c) => c.method === "full-render")).toBe(false);
    expect(checksForDepth("final").skipped).toHaveLength(0);
  });
});

describe("profilurile de platformă", () => {
  it("există pentru toate platformele și se pot ajusta per proiect", () => {
    for (const p of ["tiktok", "reels", "shorts", "youtube", "linkedin", "x", "feed", "generic"] as const) expect(PLATFORM_PROFILES[p].durationSec.max).toBeGreaterThan(0);
    const p = platformProfile("tiktok", { platformOverrides: { tiktok: { hookBySec: 0.5, durationSec: { idealMax: 20 } } } });
    expect(p.hookBySec).toBe(0.5);
    expect(p.durationSec.idealMax).toBe(20);
    expect(p.durationSec.max).toBe(PLATFORM_PROFILES.tiktok.durationSec.max);
  });
});

describe("subtitrările în compilator", () => {
  it("replica deja scrisă pe ecran nu se mai arde ca subtitrare", async () => {
    const { coveredByScreen } = await import("../../src/timeline/compile");
    expect(coveredByScreen("Cu Kolibri: Planifică săptămâna în 5 minute.", ["Planifică săptămâna în 5 minute"])).toBe(true);
    expect(coveredByScreen("Găsești orice sarcină tastând câteva litere.", ["Căutare instantă"])).toBe(false);
  });
  it("banda nu acoperă elementul demonstrat; peste restul interfeței rămâne implicită", async () => {
    const { captionSegments } = await import("../../src/timeline/compile");
    const scene = (id: string, from: number, focus: boolean) =>
      ({
        id,
        from,
        durationInFrames: 90,
        transitionIn: null,
        camera: { keys: [{ at: 0, x: 540, y: 960, zoom: 1, rotate: 0, rotateX: 0, rotateY: 0, ease: "inOut" }], handheld: 0, shake: [], punches: [], perspective: 1600, motionBlur: true },
        meta: {},
        layers: [
          {
            id: `${id}-m`,
            capability: "media.screen",
            from: 0,
            durationInFrames: 90,
            box: { x: 60, y: 800, w: 960, h: 600 },
            depth: 1,
            params: { src: "x.png", kind: "image", imageWidth: 960, imageHeight: 600, frame: "none" },
            children: focus ? [{ id: `${id}-f`, capability: "ui.spotlight", from: 0, durationInFrames: 90, box: { x: 100, y: 300, w: 400, h: 80 }, depth: 1, params: {}, children: [], modifiers: [], assets: [], role: "overlay", z: 1 }] : [],
            modifiers: [],
            assets: [],
            role: "hero",
            z: 1,
          },
        ],
      }) as unknown as Timeline["scenes"][number];
    const base = { x: 120, y: 1100, w: 840, h: 144 };
    const safe = { x: 120, y: 240, w: 840, h: 1020 };
    // elementul demonstrat ajunge pe ecran la y 1100–1180, exact sub bandă → banda urcă deasupra lui
    const segs = captionSegments([scene("a", 0, true), scene("b", 90, false)], base, safe, { width: 1080, height: 1920, fps: 30 });
    expect(segs.length).toBe(2);
    expect(segs[0].box.y + segs[0].box.h).toBeLessThanOrEqual(1100);
    expect(segs[0].box.y).toBeGreaterThanOrEqual(safe.y);
    expect(segs[1].box.y).toBe(base.y);
    // fără element demonstrat → nimic de mutat (poziția implicită)
    expect(captionSegments([scene("b", 0, false)], base, safe, { width: 1080, height: 1920, fps: 30 })).toEqual([]);
  });
});

/** O imagine sintetică: fundal plin + un dreptunghi de „text”. */
function raster(w: number, h: number, bg: [number, number, number], fill?: { x: number; y: number; w: number; h: number; c: [number, number, number] }): Raster {
  const rgb = new Uint8Array(w * h * 3);
  for (let i = 0; i < w * h; i++) rgb.set(bg, i * 3);
  if (fill) for (let y = fill.y; y < fill.y + fill.h; y++) for (let x = fill.x; x < fill.x + fill.w; x++) rgb.set(fill.c, (y * w + x) * 3);
  return { w, h, rgb };
}

describe("criticul pe pixeli", () => {
  it("măsoară contrastul real: alb pe negru mare, alb pe gri deschis mic", () => {
    const good = raster(100, 50, [0, 0, 0], { x: 20, y: 15, w: 30, h: 10, c: [255, 255, 255] });
    expect(measuredContrast(good, lumaMap(good), { x: 0, y: 0, w: 100, h: 50 }, "#ffffff")!.ratio).toBeGreaterThan(15);
    const bad = raster(100, 50, [200, 200, 200], { x: 20, y: 15, w: 30, h: 10, c: [255, 255, 255] });
    expect(measuredContrast(bad, lumaMap(bad), { x: 0, y: 0, w: 100, h: 50 }, "#ffffff")!.ratio).toBeLessThan(2);
  });
  it("culorile de design ale textului (marker, accent) nu se socotesc fundal", () => {
    const img = raster(100, 50, [0, 0, 0], { x: 10, y: 10, w: 60, h: 20, c: [45, 212, 191] });
    const L = lumaMap(img);
    const withMarker = measuredContrast(img, L, { x: 0, y: 0, w: 100, h: 50 }, "#ffffff")!.ratio;
    const excluded = measuredContrast(img, L, { x: 0, y: 0, w: 100, h: 50 }, "#ffffff", ["#2dd4bf"])!.ratio;
    expect(withMarker).toBeLessThan(3);
    expect(excluded).toBeGreaterThan(15);
  });
  it("detectează cadrul uniform și ocuparea", () => {
    const flat = raster(64, 36, [20, 20, 30]);
    expect(detailOccupancy(lumaMap(flat), 64, 36).uniform).toBe(true);
    const busy = raster(64, 36, [20, 20, 30], { x: 0, y: 0, w: 64, h: 18, c: [200, 200, 200] });
    expect(detailOccupancy(lumaMap(busy), 64, 36).uniform).toBe(false);
  });
  it("alege cadrul de hold fără tranziții și propune culoarea lizibilă din paletă", () => {
    const palette = { primary: "#6c5cff", secondary: "#222233", accent: "#2dd4bf", background: "#0f1020", surface: "#1a1b2e", text: "#f5f5f7", textMuted: "#5a5c70" };
    const t = {
      formatId: "16x9",
      width: 1920,
      height: 1080,
      fps: 30,
      palette,
      scenes: [
        { id: "a", from: 0, durationInFrames: 90, transitionIn: null, camera: { keys: [{ at: 0, x: 960, y: 540, zoom: 1 }] }, meta: { narrativeRole: "feature", shot: "close-up", energy: 0.5 }, layers: [{ id: "t1", capability: "text.body", from: 0, durationInFrames: 90, box: { x: 100, y: 100, w: 600, h: 100 }, params: { text: "Adresa site-ului", color: "textMuted", fontSize: 40 }, depth: 0, role: "support", children: [], modifiers: [], assets: [] }] },
        { id: "b", from: 80, durationInFrames: 60, transitionIn: { capability: "tr.dissolve", durationInFrames: 10, params: {} }, camera: { keys: [{ at: 0, x: 960, y: 540, zoom: 1 }] }, meta: { narrativeRole: "cta", shot: "title", energy: 0.5 }, layers: [] },
      ],
    } as unknown as Timeline;
    const [sa] = pickSamples(t);
    expect(sa.local).toBeGreaterThanOrEqual(0);
    expect(sa.local).toBeLessThan(80);
    expect(sa.texts.map((x) => x.layerId)).toEqual(["t1"]);
    // text gri închis pe fundal închis → contrast mic; culoarea „text” din paletă e soluția mecanică
    const img = raster(480, 270, [15, 16, 32], { x: 30, y: 30, w: 100, h: 12, c: [90, 92, 112] });
    const r = analyzeSample(img, t, sa);
    const c = r.issues.find((i) => i.dimension === "contrast");
    expect(c).toBeTruthy();
    expect(c!.suggestedFix).toEqual([{ op: "layer-params", sceneId: "a", slot: "t1", params: { color: "text" } }]);
  });
});
