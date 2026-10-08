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
});
