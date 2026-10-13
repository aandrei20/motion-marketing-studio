/**
 * Linia de comandă `mms`, apelată direct (fără proces separat): comenzile de citire, crearea unui proiect,
 * brief-ul, aprobarea cu fraza exactă și erorile cu indicație. Comenzile lungi (captură, producție, randare)
 * sunt acoperite de testele de integrare și de randare.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mms-cli-"));
process.env.MMS_PROJECTS_DIR = tmp;

let out: string[] = [];
beforeEach(() => {
  out = [];
  vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => {
    out.push(a.map(String).join(" "));
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = 0;
});

const cli = async (...argv: string[]) => {
  const { runCli } = await import("../../src/cli/index");
  await runCli(argv);
  return out.join("\n");
};
const code = async (...argv: string[]) => {
  try {
    await cli(...argv);
    return null;
  } catch (e) {
    return (e as { code?: string }).code ?? String(e);
  }
};

describe("mms", () => {
  it("ajutorul, întrebările A–H și biblioteca", async () => {
    expect(await cli("help")).toContain("mms – Motion Marketing Studio");
    out = [];
    expect(await cli("questions")).toMatch(/A[\s\S]*H/);
    out = [];
    expect(await cli("recipes")).toContain("ui-spotlight");
    out = [];
    expect(await cli("templates")).toContain("saas");
    out = [];
    expect((await cli("catalog")).split("\n").length).toBeGreaterThan(100);
  });

  it("proiect nou, brief, aprobarea cu fraza exactă, starea și versiunile", async () => {
    expect(await cli("list")).toBe("");
    out = [];
    await cli(
      "new",
      "proba-cli",
      "--name",
      "Probă",
      "--product",
      "Produs",
      "--category",
      "saas",
      "--format",
      "9x16:tiktok:20:30",
      "--text-lang",
      "ro",
      "--voice-lang",
      "ro",
    );
    expect(fs.existsSync(path.join(tmp, "proba-cli", "project.json"))).toBe(true);
    out = [];
    expect(await cli("list")).toContain("proba-cli");
    out = [];
    await cli("brief", "proba-cli", "--file", path.join("examples", "demo-product", "brief.json"));
    expect(out.join("\n")).toContain("Brief salvat");
    expect(await code("approve", "proba-cli", "brief", "da")).toBe("APPROVAL_PHRASE");
    out = [];
    await cli("approve", "proba-cli", "brief", "aprob");
    expect(out.join("\n")).toContain("Aprobare înregistrată: brief");
    out = [];
    expect(await cli("status", "proba-cli")).toContain("Brief aprobat");
    out = [];
    expect(await cli("versions", "proba-cli")).toBe("");
    out = [];
    expect(await cli("check-projects", "proba-cli")).toContain("e valid");
    out = [];
    expect(await cli("usage", "proba-cli")).toContain("nu are încă operații");
  });

  it("erorile au cod și indicație, fără să atingă alte foldere", async () => {
    expect(await code("nu-exista")).toBe("UNKNOWN_COMMAND");
    expect(await code("status", "../alt-folder")).toBe("PROJECT_ID");
    expect(await code("new", "proiect-fara-produs")).toBe("ARG_MISSING");
    expect(await code("rights", "proba-cli", "--source", "exemplu.ro", "confirmed")).toBe("RIGHTS_SOURCE");
    expect(await code("new", "x", "--product", "P", "--format", "9x16x:tiktok")).toBe("FORMAT_INVALID");
  });
});
