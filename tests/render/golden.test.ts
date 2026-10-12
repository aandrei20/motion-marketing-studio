/**
 * Regresia vizuală a rețetelor și a secvențelor (scene compilate prin compilatorul real, pe două formate):
 * cadrul de hold al fiecărei scene se compară cu referințele din
 * tests/golden/recipes-*.json. Capabilitățile individuale au regresia lor în catalog.test.ts.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mms-golden-"));
process.env.MMS_PROJECTS_DIR = tmp;

afterAll(async () => {
  const { closeBrowser } = await import("../../src/renderer/node/render");
  await closeBrowser();
});

describe("regresia vizuală a rețetelor", () => {
  for (const preset of ["16x9", "9x16"] as const) {
    it(`fiecare rețetă arată la fel ca referința (${preset})`, async () => {
      const { makeFormat } = await import("../../src/core/formats");
      const { recipeFixture } = await import("./recipe-fixture");
      const { renderStills } = await import("../../src/renderer/node/render");
      const { holdFrame } = await import("../../src/timeline/geometry");
      const { checkGolden } = await import("./golden");
      const fmt = makeFormat(preset, { platform: preset === "9x16" ? "tiktok" : "youtube", durationSec: 40 });
      const t = recipeFixture(tmp, fmt);
      const frames = t.scenes.map((s, i) => ({ id: s.id, frame: s.from + holdFrame(t, i) }));
      const files = await renderStills(
        t,
        frames.map((f) => f.frame),
        path.join(tmp, `stills-${preset}`),
        { format: "png", scale: 0.25 },
      );
      const r = await checkGolden(
        `recipes-${preset}`,
        frames.map((f, i) => ({ id: f.id, file: files[i], aspect: t.width / t.height })),
      );
      if (r.written) console.log(`Referințe scrise: tests/golden/recipes-${preset}.json (${frames.length} cadre)`);
      expect(r.missing, "rețete fără referință: rulează cu MMS_UPDATE_GOLDEN=1 după ce verifici vizual").toEqual([]);
      expect(r.regressions).toEqual([]);
    }, 900_000);
  }

  it("pragurile prind un element dispărut și unul mutat (testul are sens)", async () => {
    const { makeFormat } = await import("../../src/core/formats");
    const { recipeFixture } = await import("./recipe-fixture");
    const { renderStills } = await import("../../src/renderer/node/render");
    const { holdFrame } = await import("../../src/timeline/geometry");
    const { gridOf, compareGrid, loadGolden, MEAN_LIMIT, BLOCK_LIMIT } = await import("./golden");
    const golden = loadGolden("recipes-16x9");
    expect(golden, "referințele 16x9 lipsesc").not.toBeNull();
    const t = recipeFixture(tmp, makeFormat("16x9", { platform: "youtube", durationSec: 40 }));
    const at = (id: string) => {
      const i = t.scenes.findIndex((s) => s.id === id);
      return { i, frame: t.scenes[i].from + holdFrame(t, i) };
    };
    // cifra mare dispare din scena de dovadă
    const p = at("r-proof-metric");
    const gone = structuredClone(t);
    gone.scenes[p.i].layers = gone.scenes[p.i].layers.filter((l) => l.capability !== "text.counter");
    // logo-ul, titlul și butonul CTA se mută spre stânga
    const c = at("r-cta-end");
    const moved = structuredClone(t);
    for (const l of moved.scenes[c.i].layers)
      if (["logo.reveal", "text.word-reveal", "shape.panel", "text.body"].includes(l.capability)) l.box = { ...l.box, x: l.box.x - 520 };
    const [a] = await renderStills(gone, [p.frame], path.join(tmp, "sens-gone"), { format: "png", scale: 0.25 });
    const [b] = await renderStills(moved, [c.frame], path.join(tmp, "sens-moved"), { format: "png", scale: 0.25 });
    const ca = compareGrid(golden!["r-proof-metric"], await gridOf(a, 16 / 9));
    const cb = compareGrid(golden!["r-cta-end"], await gridOf(b, 16 / 9));
    expect(ca.mean > MEAN_LIMIT || ca.maxBlock > BLOCK_LIMIT, `element dispărut nedetectat: ${JSON.stringify(ca)}`).toBe(true);
    expect(cb.mean > MEAN_LIMIT || cb.maxBlock > BLOCK_LIMIT, `element mutat nedetectat: ${JSON.stringify(cb)}`).toBe(true);
  }, 900_000);
});
