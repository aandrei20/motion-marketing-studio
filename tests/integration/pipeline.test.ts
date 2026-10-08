/**
 * Integrare: lanțul complet pe produsul demo, fără randare video (aceea e în tests/render):
 * captură reală (Playwright) → research → brand → script/storyboard → voce → timeline → audio → critică.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mms-e2e-"));
process.env.MMS_PROJECTS_DIR = tmp;

describe("lanțul de producție pe produsul demo", () => {
  afterAll(async () => {
    const steps = await import("../../src/pipeline/steps");
    await steps.shutdown();
  });

  it("produce timeline-uri valide, mix verificat și critică", async () => {
    const { runE2E } = await import("../../scripts/e2e-demo");
    const logs: string[] = [];
    const r = await runE2E({ id: "it-e2e", fresh: true, render: false, log: (m) => logs.push(m) });
    const store = await import("../../src/projects/store");
    const project = store.loadProject(r.id);
    expect(project.formats.map((f) => f.id)).toEqual(["9x16", "16x9"]);
    for (const f of project.formats) {
      const t = store.loadTimeline(r.id, r.versionId, f.id);
      expect(t.scenes.length).toBe(7);
      expect(t.audio.src).toMatch(/mix\.wav$/);
      expect(t.width).toBe(f.width);
      // fără goluri între scene
      for (let i = 1; i < t.scenes.length; i++) expect(t.scenes[i].from).toBeLessThanOrEqual(t.scenes[i - 1].from + t.scenes[i - 1].durationInFrames);
    }
    const mix = JSON.parse(fs.readFileSync(path.join(tmp, r.id, "versions", r.versionId, "audio", "mix-report.json"), "utf8"));
    expect(mix.ok).toBe(true);
    expect(Math.abs(mix.integratedLufs + 14)).toBeLessThan(0.6);
    expect(mix.truePeakDbtp).toBeLessThanOrEqual(-1);
    // captura reală a produs zone din DOM și afirmații cu sursă
    const assets = store.loadAssets(r.id).assets;
    expect(assets.some((a) => a.origin === "real_capture" && (a.capture?.regions.length ?? 0) > 5)).toBe(true);
    expect(assets.some((a) => a.role === "screen-recording")).toBe(true);
    const research = store.loadResearch(r.id);
    expect(research.claims.every((c) => c.sourceIds.length > 0)).toBe(true);
    expect(research.claims.some((c) => c.status === "needs-confirmation")).toBe(true);
    // critica: aceeași rubrică, scoruri pe fiecare scenă
    const crit = store.loadCritique(r.id, r.versionId);
    expect(crit.rounds[0].sceneScores).toHaveLength(7);
    expect(fs.readFileSync(path.join(tmp, r.id, "STATE.md"), "utf8")).toContain("Timeline compilat");
  }, 600_000);

  it("același storyboard se compilează în alte formate și FPS-uri (1:1 @ 24, 4:5 @ 60, personalizat @ 25)", async () => {
    const store = await import("../../src/projects/store");
    const { makeFormat } = await import("../../src/core/formats");
    const { compileTimeline } = await import("../../src/timeline/compile");
    const { validateTimeline } = await import("../../src/timeline/validate");
    const id = "it-e2e";
    const v = store.loadProject(id).currentVersion!;
    const voice = JSON.parse(fs.readFileSync(path.join(tmp, id, "versions", v, "audio", "voice.json"), "utf8"));
    const base = { project: store.loadProject(id), versionId: v, brief: store.loadBrief(id), brand: store.loadBrand(id), research: store.loadResearch(id), assets: store.loadAssets(id), script: store.loadScript(id, v), storyboard: store.loadStoryboard(id, v), voice, beatGrid: store.loadTimeline(id, v, "9x16").audio.beatGrid };
    for (const format of [makeFormat("1x1", { platform: "feed", durationSec: 24, fps: 24 }), makeFormat("4x5", { platform: "feed", durationSec: 24, fps: 60 }), makeFormat({ width: 1280, height: 720, id: "custom-720p" }, { platform: "generic", durationSec: 24, fps: 25 })]) {
      const r = compileTimeline({ ...base, format });
      expect(r.timeline.fps).toBe(format.fps);
      expect(r.timeline.width).toBe(format.width);
      expect(r.timeline.scenes).toHaveLength(7);
      // aceleași tăieturi în secunde ca formatul principal, indiferent de FPS (±1 cadru): mixul audio e comun
      const primary = store.loadTimeline(id, v, "9x16");
      const tol = 1 / format.fps + 1 / primary.fps;
      r.timeline.scenes.forEach((sc, i) => expect(Math.abs(sc.from / format.fps - primary.scenes[i].from / primary.fps)).toBeLessThanOrEqual(tol));
      expect(Math.abs(r.timeline.durationInFrames / format.fps - primary.durationInFrames / primary.fps)).toBeLessThanOrEqual(tol);
      const val = validateTimeline(r.timeline, { assets: base.assets, research: base.research, format });
      expect(val.findings.filter((f) => f.severity === "blocker")).toEqual([]);
    }
  }, 120_000);

  it("iterația și variantele de hook creează versiuni noi fără să atingă versiunea veche", async () => {
    const store = await import("../../src/projects/store");
    const { iterate, hookVariants } = await import("../../src/pipeline/iterate");
    const id = "it-e2e";
    const v1 = store.loadProject(id).currentVersion!;
    const sb1 = JSON.stringify(store.loadStoryboard(id, v1));
    const r = await iterate(id, "CTA-ul să stea 3 secunde");
    expect(r.versionId).not.toBe(v1);
    expect(r.changes.join(" ")).toMatch(/CTA|cta/);
    expect(JSON.stringify(store.loadStoryboard(id, v1))).toBe(sb1);
    expect(store.loadVersionMeta(id, v1).frozen).toBe(true);
    const meta = store.loadVersionMeta(id, r.versionId);
    expect(meta.parent).toBe(v1);
    expect(meta.changes[0].request).toBe("CTA-ul să stea 3 secunde");
    const tl = store.loadTimeline(id, r.versionId, "9x16");
    const cta = tl.scenes[tl.scenes.length - 1];
    expect(cta.durationInFrames / tl.fps).toBeGreaterThanOrEqual(3 - 0.05);
    // variantele de hook pornesc toate din aceeași versiune
    const variants = await hookVariants(id, { from: v1, count: 1 });
    expect(variants).toHaveLength(1);
    const hookLine = store.loadScript(id, variants[0].versionId).lines.find((l) => l.isHook)!;
    expect(hookLine.onScreen).toBe(variants[0].text);
    expect(store.loadVersionMeta(id, variants[0].versionId).parent).toBe(v1);
    expect(store.loadScript(id, v1).lines.find((l) => l.isHook)!.onScreen).not.toBe(variants[0].text);
  }, 300_000);

  it("compilarea pe o versiune înghețată merge în versiunea următoare; textul schimbat reface vocea", async () => {
    const store = await import("../../src/projects/store");
    const steps = await import("../../src/pipeline/steps");
    const id = "it-e2e";
    const v = store.loadProject(id).currentVersion!;
    store.freezeVersion(id, v, "preview");
    const before = fs.readFileSync(path.join(tmp, id, "versions", v, "timeline-9x16.json"), "utf8");
    const r = await steps.stepCompile(id, v);
    expect(r.versionId).not.toBe(v);
    expect(store.loadVersionMeta(id, r.versionId).parent).toBe(v);
    expect(store.loadVersionMeta(id, r.versionId).changes.some((c) => c.op === "recompile")).toBe(true);
    expect(fs.readFileSync(path.join(tmp, id, "versions", v, "timeline-9x16.json"), "utf8")).toBe(before);
    // textul unei replici se schimbă direct în script: vocea și subtitrările urmează textul nou
    const script = store.loadScript(id, r.versionId);
    const line = script.lines.find((l) => !l.isHook && !l.isCta && l.voiceover)!;
    const text = "Găsești orice sarcină în câteva secunde.";
    store.saveScript(id, r.versionId, { ...script, lines: script.lines.map((l) => (l.id === line.id ? { ...l, voiceover: text, onScreen: l.onScreen } : l)) });
    await steps.stepCompile(id, r.versionId);
    const voice = JSON.parse(fs.readFileSync(path.join(tmp, id, "versions", r.versionId, "audio", "voice.json"), "utf8"));
    expect(voice[line.id].words.map((w: { text: string }) => w.text).join(" ")).toBe(text);
  }, 300_000);
});
