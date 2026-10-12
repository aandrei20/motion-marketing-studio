/**
 * Jurnalul operațiilor (voci, randări) și bugetul de apeluri plătite al unei rulări.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mms-usage-"));
process.env.MMS_PROJECTS_DIR = tmp;

describe("jurnalul de utilizare", () => {
  it("adună apelurile, refolosirile din cache și eșecurile pe furnizor și model", async () => {
    const { loadUsage, recordUsage, summarizeUsage } = await import("../../src/core/usage");
    const base = { projectId: "proba", provider: "elevenlabs", model: "m1", op: "tts" as const, paid: true };
    recordUsage({ ...base, units: { chars: 40 }, durationMs: 1200, cached: false, ok: true });
    recordUsage({ ...base, units: { chars: 40 }, durationMs: 0, cached: true, ok: true });
    recordUsage({ ...base, units: { chars: 25 }, durationMs: 90_000, cached: false, ok: false, error: "TTS_TIMEOUT" });
    recordUsage({ projectId: "proba", provider: "remotion", op: "render-preview", units: { frames: 690 }, durationMs: 60_000, cached: false, paid: false, ok: true });
    const rows = summarizeUsage(loadUsage("proba"));
    expect(rows.find((r) => r.provider === "elevenlabs")).toMatchObject({ calls: 3, cached: 1, failed: 1, chars: 65, durationMs: 91_200 });
    expect(rows.find((r) => r.provider === "remotion")).toMatchObject({ calls: 1, frames: 690 });
    // fără texte în jurnal: doar unități
    expect(fs.readFileSync(path.join(tmp, "proba", "usage.jsonl"), "utf8")).not.toMatch(/"text"/);
  });

  it("oprește apelurile plătite peste bugetul rulării", async () => {
    process.env.MMS_MAX_PAID_CALLS = "2";
    const { reservePaidCall } = await import("../../src/core/usage");
    const { MmsError } = await import("../../src/core/errors");
    reservePaidCall("openai");
    reservePaidCall("openai");
    let err: unknown = null;
    try {
      reservePaidCall("openai");
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(MmsError);
    expect((err as InstanceType<typeof MmsError>).code).toBe("BUDGET_PAID_CALLS");
    delete process.env.MMS_MAX_PAID_CALLS;
  });

  it("modelul vocii din cloud intră în cheie; vocile locale nu au model", async () => {
    const { ttsModel } = await import("../../src/audio/voice");
    process.env.OPENAI_TTS_MODEL = "model-a";
    expect(ttsModel("openai")).toBe("model-a");
    delete process.env.OPENAI_TTS_MODEL;
    expect(ttsModel("windows")).toBeNull();
  });
});
