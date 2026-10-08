/**
 * Randare reală de video: proiectul demo, primele ~6 secunde în 9:16, cu sunet. Verificări pe fișierul
 * MP4 rezultat (ffprobe, cadre negre, flash-uri) și determinism pe un cadru al timeline-ului.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mms-video-"));
process.env.MMS_PROJECTS_DIR = tmp;

afterAll(async () => {
  const steps = await import("../../src/pipeline/steps");
  await steps.shutdown();
});

describe("randare video", () => {
  it("produce un MP4 H.264 + AAC redabil, fără cadre negre și fără flash-uri peste limită", async () => {
    const { runE2E } = await import("../../scripts/e2e-demo");
    const r = await runE2E({ id: "rt", fresh: true, render: false, log: () => undefined });
    const store = await import("../../src/projects/store");
    const t = store.loadTimeline(r.id, r.versionId, "9x16");
    const { renderTimelineVideo } = await import("../../src/renderer/node/render");
    const out = path.join(tmp, "clip.mp4");
    await renderTimelineVideo(t, { out, frameRange: [0, 179] });
    expect(fs.statSync(out).size).toBeGreaterThan(200_000);
    const { ffprobe } = await import("../../src/core/binaries");
    const p = JSON.parse((await ffprobe(["-v", "error", "-print_format", "json", "-show_streams", "-show_format", out])).stdout.toString());
    const v = p.streams.find((s: { codec_type: string }) => s.codec_type === "video");
    const a = p.streams.find((s: { codec_type: string }) => s.codec_type === "audio");
    expect(v.codec_name).toBe("h264");
    expect(v.width).toBe(1080);
    expect(v.height).toBe(1920);
    expect(v.pix_fmt).toBe("yuv420p");
    expect(a.codec_name).toBe("aac");
    expect(Number(p.format.duration)).toBeGreaterThan(5.8);
    const { analyzeVideo } = await import("../../src/renderer/node/analyze-video");
    const check = await analyzeVideo(out, 30);
    expect(check.blackFrames).toEqual([]);
    expect(check.maxFlashesPerSec).toBeLessThanOrEqual(2);
  }, 900_000);

  it("același cadru randat de două ori e identic", async () => {
    const store = await import("../../src/projects/store");
    const t = store.loadTimeline("rt", store.loadProject("rt").currentVersion!, "16x9");
    const { renderTimelineStill } = await import("../../src/renderer/node/render");
    const a = await renderTimelineStill(t, 140, path.join(tmp, "a.png"));
    const b = await renderTimelineStill(t, 140, path.join(tmp, "b.png"));
    const h = (f: string) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
    expect(h(a)).toBe(h(b));
  }, 300_000);
});
