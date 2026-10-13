/**
 * Producția automată cap-coadă (`mms make` / Studio „Producție completă”) pe produsul demo, fără randare:
 * concept → script și storyboard generate → voce → timeline → mix → bucla de calitate „fast” → corecturi
 * automate cu rollback. Verifică și că o corectură nu reface vocea (regenerare selectivă) și că versiunile
 * vechi rămân neatinse.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mms-produce-"));
process.env.MMS_PROJECTS_DIR = tmp;

describe("producția automată", () => {
  afterAll(async () => {
    const steps = await import("../../src/pipeline/steps");
    await steps.shutdown();
  });

  it("concept, script și storyboard generate, timeline, mix, calitate și corecturi automate", async () => {
    const { makeFormat } = await import("../../src/core/formats");
    const { Brief } = await import("../../src/core/schema");
    const { readJsonLoose } = await import("../../src/core/json");
    const { PATHS } = await import("../../src/core/paths");
    const { listVoices } = await import("../../src/audio/voice");
    const store = await import("../../src/projects/store");
    const steps = await import("../../src/pipeline/steps");
    const { updateAsset } = await import("../../src/assets/ingest");
    const { produce } = await import("../../src/pipeline/produce");
    const { loadUsage } = await import("../../src/core/usage");
    const id = "it-produce";
    store.createProject({
      id,
      name: "Produs demo",
      product: { name: "Kolibri", url: steps.demoUrl("index.html"), category: "productivity" },
      formats: [makeFormat("9x16", { platform: "tiktok", durationSec: 20, fps: 30 }), makeFormat("16x9", { platform: "youtube", durationSec: 20, fps: 30 })],
      language: { text: "ro", voice: "ro" },
      seed: 3,
    });
    const brief = Brief.parse(readJsonLoose(path.join(PATHS.examples, "demo-product", "brief.json")));
    if (!(await listVoices()).some((v) => v.provider === "windows" && v.name.includes("Andrei"))) brief.audio.voice = { mode: "none", rate: 1 };
    store.saveBrief(id, brief);
    steps.approve(id, "brief", "aprob");
    await steps.stepCapture(id, [
      { id: "landing", url: steps.demoUrl("index.html"), viewport: "desktop" },
      { id: "app", url: steps.demoUrl("app.html"), viewport: "desktop", research: false },
    ]);
    for (const a of store.loadAssets(id).assets.filter((x) => x.pii.regions.length)) updateAsset(id, a.id, { keepApproved: true });
    steps.stepBrand(id);

    const logs: string[] = [];
    const r = await produce(id, { depth: "fast", autofix: true, preview: false, log: (m) => logs.push(m) });

    // conceptul ales și materialele generate
    expect(logs.some((l) => l.startsWith("Concept:"))).toBe(true);
    const v = store.loadProject(id).currentVersion!;
    expect(r.versionId).toBe(v);
    const sb = store.loadStoryboard(id, v);
    expect(sb.scenes.length).toBeGreaterThanOrEqual(4);
    expect(sb.scenes.some((s) => Object.values(s.slots).flat().length > 0)).toBe(true);
    // arcul de energie al corpului reclamei nu e plat (story.energy-arc cere o abatere de cel puțin 0,06)
    const body = sb.scenes.filter((s) => s.narrativeRole !== "hook" && s.narrativeRole !== "cta").map((s) => s.energy);
    if (body.length >= 3) {
      const mean = body.reduce((a, b) => a + b, 0) / body.length;
      expect(Math.sqrt(body.reduce((a, b) => a + (b - mean) ** 2, 0) / body.length)).toBeGreaterThanOrEqual(0.06);
    }
    // storyboard-ul comun formatelor folosește capturile desktop, nu perechile lor de telefon
    const phoneIds = new Set(
      store
        .loadAssets(id)
        .assets.filter((a) => (a.capture?.viewport.width ?? 9999) < 600)
        .map((a) => a.id),
    );
    expect(phoneIds.size).toBeGreaterThan(0);
    expect(sb.scenes.flatMap((s) => Object.values(s.slots).flat()).some((x) => phoneIds.has(String(x)))).toBe(false);
    for (const f of ["9x16", "16x9"]) expect(store.loadTimeline(id, v, f).scenes.length).toBe(sb.scenes.length);

    // bucla de calitate și corecturile automate
    expect(r.first.score.overall).toBeGreaterThan(0);
    expect(r.final).toBeNull();
    // fără PASS la prima verificare, bucla de corecturi trebuie să fi rulat
    if (r.first.score.verdict !== "PASS") expect(r.autofix).not.toBeNull();
    if (r.autofix) {
      expect(r.autofix.stopReason.length).toBeGreaterThan(0);
      expect(r.autofix.iterations.length).toBeLessThanOrEqual(3);
      for (const it of r.autofix.iterations) {
        const meta = store.loadVersionMeta(id, it.to);
        // nimic nu se șterge: o corectură respinsă rămâne pe disc, marcată „rejected”
        expect(meta.status).toBe(it.decision === "rolled-back" ? "rejected" : meta.status);
      }
      // regenerare selectivă: corecturile nu refac vocea (aceleași sinteze, din cache sau neatinse)
      const fresh = loadUsage(id).filter((u) => u.op === "tts" && !u.cached);
      const lines = store.loadScript(id, r.autofix.startVersion).lines.filter((l) => l.voiceover.trim()).length;
      if (brief.audio.voice.mode === "tts") expect(fresh.length).toBeLessThanOrEqual(lines);
    }
    expect(store.listVersions(id).length).toBeGreaterThanOrEqual(1);
  }, 600_000);
});

describe("Studio pe proiectul produs", () => {
  it("fiecare tab se încarcă fără erori, trece verificarea de accesibilitate și încape pe ecrane mici", async () => {
    const { startStudio } = await import("../../src/studio/server");
    const { chromium } = await import("playwright");
    const { default: AxeBuilder } = await import("@axe-core/playwright");
    const { TABS } = await import("../../src/studio/ui/App");
    const port = 4800 + Math.floor(Math.random() * 300);
    const server = await startStudio({ port, open: false });
    const browser = await chromium.launch();
    try {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await ctx.newPage();
      const errors: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`http://127.0.0.1:${port}/#p=it-produce&t=overview`, { waitUntil: "networkidle" });
      const a11y: string[] = [];
      const overflow: string[] = [];
      for (const [tab, label] of TABS) {
        await page.getByRole("button", { name: label, exact: true }).first().click();
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(250);
        const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
        for (const v of r.violations.filter((x) => x.impact === "serious" || x.impact === "critical"))
          a11y.push(`${tab}: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target.join(" ")}`);
        for (const width of [1280, 820]) {
          await page.setViewportSize({ width, height: 800 });
          const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
          if (wide > 1) overflow.push(`${tab} la ${width}px: ${wide}px în afara ecranului`);
        }
        await page.setViewportSize({ width: 1280, height: 800 });
      }
      expect(errors, "erori în consolă").toEqual([]);
      expect(a11y, "probleme de accesibilitate (WCAG 2 A/AA, grave)").toEqual([]);
      expect(overflow, "conținut care iese din ecran").toEqual([]);
    } finally {
      await browser.close();
      await new Promise<void>((r) => server.close(() => r()));
    }
  }, 600_000);
});
