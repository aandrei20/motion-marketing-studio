/**
 * Inventarul de design și producție nu poate minți: fiecare trimitere la implementare trebuie să existe,
 * iar stările parțiale sau lipsă au explicația și pasul următor.
 */
import { describe, expect, it } from "vitest";
import { INVENTORY } from "../../src/inventory/inventory";
import { inventoryProblems, refProblem } from "../../src/inventory/validate";

describe("inventarul de design și producție", () => {
  it("toate trimiterile există în cod și fiecare stare e justificată", () => {
    expect(inventoryProblems()).toEqual([]);
  });
  it("acoperă toate ariile cerute, cu priorități", () => {
    const areas = new Set(INVENTORY.map((i) => i.area));
    for (const a of [
      "visual-design",
      "typography",
      "ui-product",
      "motion",
      "transitions",
      "editing",
      "camera",
      "audio",
      "graphics",
      "branding",
      "content",
      "commercial-grammar",
      "platform",
      "asset-media",
    ])
      expect(areas.has(a as never), a).toBe(true);
    expect(INVENTORY.length).toBeGreaterThan(150);
    expect(INVENTORY.filter((i) => i.priority === "P0").every((i) => i.status !== "MISSING")).toBe(true);
  });
  it("prinde trimiterile false", () => {
    expect(refProblem("cap:nu.exista")).toMatch(/inexistentă/);
    expect(refProblem("module:src/quality/score.ts#nuExista")).toMatch(/nu exportă/);
    expect(refProblem("check:timeline.validate")).toBeNull();
  });
});
