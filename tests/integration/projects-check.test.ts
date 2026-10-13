/**
 * Proiectele existente față de schemele de acum: un proiect corect trece; un fișier stricat, un material
 * șters de mână sau un fișier lipsă folosit de timeline sunt raportate, fără să ascundă celelalte proiecte.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mms-check-"));
process.env.MMS_PROJECTS_DIR = tmp;

describe("verificarea proiectelor existente", () => {
  it("raportează fișierele invalide și materialele lipsă, proiect cu proiect", async () => {
    const store = await import("../../src/projects/store");
    const { makeFormat } = await import("../../src/core/formats");
    const { checkAllProjects, checkProjectFiles } = await import("../../src/projects/check");
    const mk = (id: string) =>
      store.createProject({
        id,
        name: id,
        product: { name: "Produs", category: "saas" },
        formats: [makeFormat("9x16", { platform: "tiktok", durationSec: 15 })],
        language: { text: "ro", voice: "ro" },
      });
    mk("bun");
    mk("stricat");
    expect(checkProjectFiles("bun")).toEqual([]);
    // un câmp invalid în research.json și un material al cărui fișier a fost șters
    fs.writeFileSync(path.join(tmp, "stricat", "research.json"), JSON.stringify({ schemaVersion: 1, claims: "nu e listă" }));
    const manifest = JSON.parse(fs.readFileSync(path.join(tmp, "stricat", "assets.json"), "utf8"));
    manifest.assets.push({
      id: "logo-1",
      file: "assets/logo-1.svg",
      originalName: "logo.svg",
      sha256: "x",
      bytes: 1,
      mime: "image/svg+xml",
      type: "svg",
      origin: "user_provided",
      role: "logo",
      roleSource: "user",
      roleConfidence: 1,
      showsProductUI: false,
      rights: { thirdParty: false, status: "owned" },
      media: {},
      addedAt: "2026-10-12T10:00:00Z",
    });
    fs.writeFileSync(path.join(tmp, "stricat", "assets.json"), JSON.stringify(manifest));
    const problems = checkAllProjects();
    expect(problems.every((p) => p.projectId === "stricat")).toBe(true);
    expect(problems.map((p) => p.file).sort()).toEqual(["assets.json", "research.json"]);
    expect(problems.find((p) => p.file === "assets.json")!.problem).toContain("assets/logo-1.svg");
  });
});
