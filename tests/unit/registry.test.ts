import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PATHS } from "../../src/core/paths";
import { buildCatalogTimeline } from "../../src/motion/catalog";
import { ALL_CAPABILITIES, CAMERA_LIST, LAYERS, MODIFIER_LIST, TRANSITION_LIST } from "../../src/motion/registry";
import { RECIPES } from "../../src/recipes/recipes";
import { SFX } from "../../src/audio/sfx";
import { Timeline } from "../../src/core/schema";
import { registryJson } from "../../src/studio/registry-json";

describe("registry", () => {
  it("fiecare capabilitate are id unic, fișă completă și exemplu valid", () => {
    const ids = new Set<string>();
    for (const c of ALL_CAPABILITIES) {
      expect(ids.has(c.id), c.id).toBe(false);
      ids.add(c.id);
      expect(c.title.length, c.id).toBeGreaterThan(3);
      expect(c.description.length, c.id).toBeGreaterThan(20);
      expect(c.tags.length, c.id).toBeGreaterThan(0);
      expect(c.license.source, c.id).toBeTruthy();
      expect(["tested", "experimental", "deprecated"]).toContain(c.status);
      expect(c.example, c.id).toBeTruthy();
    }
    expect(ALL_CAPABILITIES.length).toBeGreaterThanOrEqual(100);
  });
  it("straturile au componentă, tranzițiile durată, camerele funcție de construcție", () => {
    for (const l of LAYERS) expect(typeof l.Component, l.id).toBe("function");
    for (const t of TRANSITION_LIST) expect(t.defaultDuration, t.id).toBeGreaterThanOrEqual(0);
    for (const c of CAMERA_LIST) {
      const p = c.params.parse(c.example.params);
      const b = c.build(p as never, { duration: 60, width: 1920, height: 1080, focus: { x: 800, y: 400 }, focusZoom: 1.8, energy: 0.5 });
      expect(b.keys.length, c.id).toBeGreaterThan(0);
      for (const k of b.keys) expect(Number.isFinite(k.x) && Number.isFinite(k.zoom), c.id).toBe(true);
    }
    for (const m of MODIFIER_LIST) expect(typeof m.apply, m.id).toBe("function");
  });
  it("sunetele declarate în fișe există în biblioteca de efecte", () => {
    const sounds = new Set(SFX.map((s) => s.id));
    for (const c of ALL_CAPABILITIES) for (const s of c.sfx) expect(sounds.has(s.sound), `${c.id} → ${s.sound}`).toBe(true);
  });
  it("rețetele folosesc doar capabilități existente", () => {
    const ids = new Set(ALL_CAPABILITIES.map((c) => c.id));
    for (const r of RECIPES) for (const c of r.capabilities) expect(ids.has(c), `${r.id} → ${c}`).toBe(true);
  });
  it("catalogul acoperă fiecare intrare și formează un timeline valid", () => {
    const { timeline, entries } = buildCatalogTimeline();
    expect(entries.map((e) => e.id).sort()).toEqual(ALL_CAPABILITIES.map((c) => c.id).sort());
    expect(Timeline.safeParse(timeline).success).toBe(true);
  });
  it("library/registry.json e generat din cod și e la zi", () => {
    const file = path.join(PATHS.library, "registry.json");
    const disk = JSON.parse(fs.readFileSync(file, "utf8"));
    expect(disk).toEqual(JSON.parse(JSON.stringify(registryJson())));
  });
});
