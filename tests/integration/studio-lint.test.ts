import fs from "node:fs";
import type http from "node:http";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mms-studio-"));
process.env.MMS_PROJECTS_DIR = tmp;
const PORT = 4400 + Math.floor(Math.random() * 400);
const base = `http://127.0.0.1:${PORT}`;
let server: http.Server;

beforeAll(async () => {
  const { startStudio } = await import("../../src/studio/server");
  server = await startStudio({ port: PORT, open: false });
}, 120_000);

afterAll(() => new Promise<void>((r) => server.close(() => r())));

const call = async (method: string, url: string, body?: unknown) => {
  const res = await fetch(`${base}${url}`, {
    method,
    headers: { "Content-Type": "application/json", "X-MMS": "1" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
};

describe("Studio (server + interfață)", () => {
  it("servește interfața construită", async () => {
    const html = await (await fetch(`${base}/`)).text();
    expect(html).toContain("/app.js");
    const js = await fetch(`${base}/app.js`);
    expect(js.status).toBe(200);
    expect(Number(js.headers.get("content-length"))).toBeGreaterThan(100_000);
  });
  it("creează un proiect, salvează brief-ul și cere fraza exactă de aprobare", async () => {
    const meta = await call("GET", "/api/meta");
    expect(meta.data.questions.length).toBeGreaterThan(25);
    const created = await call("POST", "/api/projects", {
      id: "ui-test",
      name: "Test UI",
      product: { name: "Produs Test", category: "saas" },
      formats: [{ preset: "9x16", fps: 30, durationSec: 15, platform: "tiktok" }],
      textLang: "ro",
      voiceLang: null,
    });
    expect(created.status).toBe(201);
    const brief = {
      schemaVersion: 1,
      objective: "signups",
      audience: { description: "x" },
      userVision: {},
      pacing: "fast",
      direction: "energetic",
      visual: {},
      cta: { text: "Încearcă" },
      platforms: ["tiktok"],
      durationSec: 15,
      audio: { voice: { mode: "none" }, music: { mode: "none" } },
    };
    expect((await call("PUT", "/api/projects/ui-test/brief", brief)).status).toBe(200);
    expect((await call("POST", "/api/projects/ui-test/approve", { kind: "brief", phrase: "da" })).status).toBe(400);
    expect((await call("POST", "/api/projects/ui-test/approve", { kind: "brief", phrase: "aprob" })).status).toBe(200);
    const bundle = await call("GET", "/api/projects/ui-test");
    expect(bundle.data.project.status).toBe("brief-approved");
    const reg = await call("GET", "/api/registry");
    expect(reg.data.capabilities.length).toBeGreaterThanOrEqual(100);
  });
  it("fișierele se servesc cu Range (necesar pentru video în Player)", async () => {
    const res = await fetch(`${base}/files/library/catalog/samples/video.mp4`, { headers: { Range: "bytes=0-99" } });
    expect(res.status).toBe(206);
    expect((await res.arrayBuffer()).byteLength).toBe(100);
  });
});

describe("Studio: protecții și joburi", () => {
  it("refuză Host-ul străin (DNS rebinding), originea străină și cererile fără antetul X-MMS", async () => {
    const { checkRequest } = await import("../../src/studio/server");
    expect(checkRequest({ method: "GET", headers: { host: "evil.test:80" } }, PORT)).toMatch(/Host/);
    expect(checkRequest({ method: "GET", headers: { host: `127.0.0.1:${PORT}` } }, PORT)).toBeNull();
    expect(checkRequest({ method: "POST", headers: { host: `127.0.0.1:${PORT}`, origin: "http://evil.test", "x-mms": "1" } }, PORT)).toMatch(/Origine/);
    expect(checkRequest({ method: "POST", headers: { host: `localhost:${PORT}` } }, PORT)).toMatch(/X-MMS/);
    const noHeader = await fetch(`${base}/api/projects`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    expect(noHeader.status).toBe(403);
  });
  it("refuză tipurile de fișier nepermise la încărcare", async () => {
    const res = await fetch(`${base}/api/projects/ui-test/assets`, {
      method: "POST",
      headers: { "X-MMS": "1", "x-filename": "script.exe" },
      body: new Uint8Array([1, 2, 3]),
    });
    expect(res.status).toBe(415);
  });
  it("un job se oprește, are manifest pe disc și se poate relua", async () => {
    const j = (await call("POST", "/api/projects/ui-test/jobs", { type: "concepts" })).data;
    expect(j.id).toMatch(/^job-/);
    for (let k = 0; k < 50; k++) {
      const list = (await call("GET", "/api/jobs?project=ui-test")).data as Array<{ id: string; state: string }>;
      if (list.find((x) => x.id === j.id)?.state !== "queued" && list.find((x) => x.id === j.id)?.state !== "running") break;
      await new Promise((r) => setTimeout(r, 100));
    }
    const { PATHS } = await import("../../src/core/paths");
    const manifest = JSON.parse(fs.readFileSync(path.join(PATHS.cache, "jobs", `${j.id}.json`), "utf8"));
    expect(manifest).toMatchObject({ id: j.id, type: "concepts" });
    expect(["done", "failed"]).toContain(manifest.state);
    expect(manifest.updatedAt).toBeTruthy();
    const again = await call("POST", `/api/projects/ui-test/jobs/${j.id}/resume`);
    expect(again.status).toBe(202);
    expect(again.data.type).toBe("concepts");
    expect((await call("POST", "/api/projects/ui-test/jobs", { type: "nu-exista" })).status).toBe(400);
  });
});

describe("reguli verificabile automat", () => {
  it("fără nume de produs în motor, fără Math.random în randare, fără secrete în Git", async () => {
    const { lintRules } = await import("../../scripts/lint-rules");
    expect(lintRules()).toEqual([]);
  });
});
