/**
 * Recuperarea joburilor la pornire: jobul unui proces mort devine „întrerupt”, cel al unui proces care încă
 * rulează (alt Studio pe același folder) rămâne neatins.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("joburile la repornire", () => {
  it("doar joburile proceselor oprite devin „întrerupte”", async () => {
    const { JobQueue } = await import("../../src/studio/jobs");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mms-jobs-"));
    const dead = spawnSync(process.execPath, ["-e", "0"]).pid;
    const manifest = (id: string, pid: number | undefined) => ({
      id,
      projectId: "p",
      type: "capture",
      label: "Captură",
      params: {},
      state: "running",
      stage: null,
      progress: 0.4,
      log: [],
      result: null,
      artifacts: {},
      error: null,
      pid,
      createdAt: "2026-10-13T08:00:00.000Z",
      startedAt: "2026-10-13T08:00:00.000Z",
      updatedAt: "2026-10-13T08:00:00.000Z",
      finishedAt: null,
    });
    fs.writeFileSync(path.join(dir, "job-1.json"), JSON.stringify(manifest("job-1", dead)));
    fs.writeFileSync(path.join(dir, "job-2.json"), JSON.stringify(manifest("job-2", process.ppid)));
    fs.writeFileSync(path.join(dir, "job-3.json"), JSON.stringify(manifest("job-3", undefined)));
    const q = new JobQueue({ dir });
    expect(q.get("job-1")?.state).toBe("interrupted");
    // procesul părinte al testului trăiește: jobul lui nu se atinge, nici pe disc
    expect(q.get("job-2")?.state).toBe("running");
    expect(JSON.parse(fs.readFileSync(path.join(dir, "job-2.json"), "utf8")).state).toBe("running");
    // manifestele vechi, fără proces, se tratează ca înainte
    expect(q.get("job-3")?.state).toBe("interrupted");
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
