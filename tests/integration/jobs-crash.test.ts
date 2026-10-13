/**
 * Un crash în mijlocul unui job, cap-coadă: Studio-ul rulează ca proces separat, o captură reală pornește,
 * procesul e omorât forțat (cu tot cu browserul), iar la repornire jobul apare „întrerupt”, se reia și
 * termină. Proiectul rămâne valid: fiecare fișier se citește cu schema lui, iar materialele există pe disc.
 */
import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mms-crash-"));
process.env.MMS_PROJECTS_DIR = tmp;
const PORT = 4300 + Math.floor(Math.random() * 90);
const base = `http://127.0.0.1:${PORT}`;
const ROOT = path.resolve(__dirname, "..", "..");
let child: ChildProcess | null = null;

const call = async (method: string, url: string, body?: unknown) => {
  const res = await fetch(`${base}${url}`, {
    method,
    headers: { "Content-Type": "application/json", "X-MMS": "1" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
};

async function until<T>(what: string, fn: () => Promise<T | null | undefined | false>, ms = 120_000): Promise<T> {
  const end = performance.now() + ms;
  for (;;) {
    const v = await fn().catch(() => null);
    if (v) return v;
    if (performance.now() > end) throw new Error(`Nu s-a întâmplat la timp: ${what}`);
    await new Promise((r) => setTimeout(r, 200));
  }
}

async function startStudio(): Promise<ChildProcess> {
  const c = spawn(process.execPath, ["--import", "tsx", "src/cli/index.ts", "studio", "--port", String(PORT), "--no-open"], {
    cwd: ROOT,
    env: { ...process.env, MMS_PROJECTS_DIR: tmp },
    stdio: "ignore",
  });
  await until("Studio-ul răspunde", async () => (await fetch(`${base}/api/projects`)).ok);
  return c;
}

/** Oprirea bruscă a procesului și a copiilor lui (browserul capturii), ca o pană de curent. */
function crash(c: ChildProcess): void {
  if (process.platform === "win32") execFileSync("taskkill", ["/pid", String(c.pid), "/T", "/F"], { stdio: "ignore" });
  else c.kill("SIGKILL");
}

afterAll(() => {
  if (child && child.exitCode === null) crash(child);
});

describe("joburile după un crash", () => {
  it("o captură întreruptă de oprirea procesului apare „întreruptă”, se reia și lasă proiectul valid", async () => {
    const store = await import("../../src/projects/store");
    const { makeFormat } = await import("../../src/core/formats");
    const { PATHS } = await import("../../src/core/paths");
    const id = "crash-test";
    store.createProject({
      id,
      name: "Crash",
      product: { name: "Produs", category: "saas" },
      formats: [makeFormat("9x16", { platform: "tiktok", durationSec: 15 })],
      language: { text: "ro", voice: "ro" },
    });

    child = await startStudio();
    const job = (await call("POST", `/api/projects/${id}/jobs`, { type: "capture", params: { demo: true } })).data as { id: string };
    // prima captură e gata, restul încă rulează: crash în mijlocul jobului
    await until("captura a început", async () => {
      const j = ((await call("GET", `/api/jobs?project=${id}`)).data as Array<{ id: string; state: string; log: string[] }>).find((x) => x.id === job.id);
      return j?.state === "running" && j.log.length > 0;
    });
    crash(child);
    await until("procesul s-a oprit", async () => child?.exitCode !== null || child?.signalCode !== null);
    const manifest = path.join(PATHS.cache, "jobs", `${job.id}.json`);
    expect(JSON.parse(fs.readFileSync(manifest, "utf8")).state).toBe("running");

    child = await startStudio();
    const interrupted = ((await call("GET", `/api/jobs?project=${id}`)).data as Array<{ id: string; state: string; error: string }>).find(
      (x) => x.id === job.id,
    );
    expect(interrupted?.state).toBe("interrupted");
    expect(interrupted?.error).toContain("Poți relua");

    const resumed = (await call("POST", `/api/projects/${id}/jobs/${job.id}/resume`)).data as { id: string; type: string };
    expect(resumed.type).toBe("capture");
    const done = await until(
      "jobul reluat s-a terminat",
      async () => {
        const j = ((await call("GET", `/api/jobs?project=${id}`)).data as Array<{ id: string; state: string; error: string | null }>).find(
          (x) => x.id === resumed.id,
        );
        return j && !["queued", "running"].includes(j.state) ? j : null;
      },
      300_000,
    );
    expect(done.error).toBeNull();
    expect(done.state).toBe("done");
    crash(child);
    child = null;

    // proiectul e întreg: capturile cerute există o singură dată, iar fișierele lor sunt pe disc
    const { checkProjectFiles } = await import("../../src/projects/check");
    expect(checkProjectFiles(id)).toEqual([]);
    const keys = store
      .loadAssets(id)
      .assets.flatMap((a) =>
        a.capture ? [`${path.basename(a.capture.url)} ${a.capture.viewport.width < 600 ? "telefon" : "desktop"} ${a.capture.fullPage}`] : [],
      );
    // nicio captură dublată de reluare
    expect(new Set(keys).size).toBe(keys.length);
    for (const want of ["index.html desktop false", "index.html desktop true", "app.html desktop false", "index.html telefon false"])
      expect(keys).toContain(want);
    fs.rmSync(manifest, { force: true });
  }, 600_000);
});
