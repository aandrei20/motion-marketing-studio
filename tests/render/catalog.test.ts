/**
 * Fiecare capabilitate din registry se randează (exemplul din fișa ei) și trebuie să producă pixeli.
 * Determinism: aceleași cadre randate de două ori dau aceleași fișiere PNG (byte cu byte).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { frameLuma } from "../../src/assets/frames";
import { thumbnail } from "../../src/assets/analyze";
import { buildCatalogTimeline } from "../../src/motion/catalog";
import { closeBrowser, renderStills } from "../../src/renderer/node/render";

const out = fs.mkdtempSync(path.join(os.tmpdir(), "mms-catalog-"));
/** capabilități care, prin definiție, umplu cadrul cu o singură culoare în momentul eșantionat */
const UNIFORM_BY_DESIGN = new Set(["bg.solid", "tr.dip", "tr.color-sweep"]);
const { timeline, entries } = buildCatalogTimeline();

afterAll(async () => {
  await closeBrowser();
});

/** Variația luminanței pe o grilă 32×18: un cadru gol sau uniform are variație ~0. */
async function variation(file: string): Promise<number> {
  const t = await thumbnail(file, 32, 0, 18);
  if (!t) return 0;
  const l: number[] = [];
  for (let i = 0; i < t.w * t.h; i++) l.push((0.2126 * t.rgb[i * 3] + 0.7152 * t.rgb[i * 3 + 1] + 0.0722 * t.rgb[i * 3 + 2]) / 255);
  const m = l.reduce((a, b) => a + b, 0) / l.length;
  return Math.sqrt(l.reduce((a, b) => a + (b - m) ** 2, 0) / l.length);
}

describe("catalogul de capabilități", () => {
  it(`randează toate cele ${entries.length} de intrări, fiecare cu conținut vizibil`, async () => {
    const files = await renderStills(timeline, entries.map((e) => e.sampleFrame), path.join(out, "all"), { format: "jpeg", scale: 0.25, prefix: "cat" });
    expect(files).toHaveLength(entries.length);
    fs.writeFileSync(path.join(out, "entries.json"), JSON.stringify(entries.map((e, i) => ({ ...e, file: files[i] })), null, 2));
    const empty: string[] = [];
    for (let i = 0; i < entries.length; i++) {
      const id = entries[i].id;
      if (UNIFORM_BY_DESIGN.has(id)) {
        // umplere plină în culoarea primară a paletei de catalog (#6c5cff): verificăm culoarea medie
        const t = await thumbnail(files[i], 16, 0, 9);
        const n = t!.w * t!.h;
        const mean = [0, 1, 2].map((c) => Array.from({ length: n }, (_, k) => t!.rgb[k * 3 + c]).reduce((a, b) => a + b, 0) / n);
        const dist = Math.hypot(mean[0] - 0x6c, mean[1] - 0x5c, mean[2] - 0xff);
        if (dist > 40) empty.push(`${id} (culoare medie ${mean.map((m) => m.toFixed(0)).join(",")}, așteptat #6c5cff)`);
        continue;
      }
      const v = await variation(files[i]);
      if (v < 0.02) empty.push(`${id} (variație ${v.toFixed(3)})`);
    }
    expect(empty).toEqual([]);
  }, 1_800_000);

  it("randarea e deterministă (aceleași cadre → aceiași octeți)", async () => {
    const pick = ["fx.grain", "fx.particles", "fx.burst", "camera.handheld", "camera.shake", "tr.glitch", "text.glitch", "logo.particles", "media.video", "bg.mesh"];
    const frames = entries.filter((e) => pick.includes(e.id)).map((e) => e.sampleFrame);
    const a = await renderStills(timeline, frames, path.join(out, "det-a"), { format: "png", scale: 0.25 });
    const b = await renderStills(timeline, frames, path.join(out, "det-b"), { format: "png", scale: 0.25 });
    const h = (f: string) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
    for (let i = 0; i < a.length; i++) expect(h(a[i]), path.basename(a[i])).toBe(h(b[i]));
  }, 900_000);

  it("luminanța medie a cadrelor nu e neagră (fără cadre negre în catalog)", async () => {
    const files = JSON.parse(fs.readFileSync(path.join(out, "entries.json"), "utf8")) as Array<{ file: string; id: string }>;
    for (const f of files.slice(0, 20)) {
      const t = await thumbnail(f.file, 16, 0, 9);
      expect(t && frameLuma(t.rgb), f.id).toBeGreaterThan(0.01);
    }
  });
});
