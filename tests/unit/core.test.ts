import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { hashString, mulberry32, noise1, rand } from "../../src/core/random";
import { formatTimecode, parseTimeToSec } from "../../src/core/time";
import { makeFormat, resolveSafeZone, rectInside } from "../../src/core/formats";
import { contrastRatio, readableOn } from "../../src/motion/core/color";
import { layoutText, type Measure } from "../../src/motion/core/text-layout";
import { MmsError } from "../../src/core/errors";
import { assertDiskSpace, dirSize, enforceCacheBudget, pruneOldDirs, USED_MARKER } from "../../src/core/prune";

describe("determinism", () => {
  it("aceeași cheie dă aceeași valoare", () => {
    expect(rand("a", 1, 2)).toBe(rand("a", 1, 2));
    expect(rand("a", 1, 2)).not.toBe(rand("a", 1, 3));
    const a = mulberry32(hashString("x"));
    const b = mulberry32(hashString("x"));
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it("zgomotul e neted și în [-1, 1]", () => {
    for (let x = 0; x < 20; x += 0.37) {
      const v = noise1("s", x);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
      expect(Math.abs(noise1("s", x + 0.001) - v)).toBeLessThan(0.02);
    }
  });
});

describe("timp", () => {
  it("interpretează timecode-uri în română și engleză", () => {
    expect(parseTimeToSec("00:14")).toBe(14);
    expect(parseTimeToSec("la 1:02")).toBe(62);
    expect(parseTimeToSec("14,5")).toBe(14.5);
    expect(parseTimeToSec("secunda 7.3")).toBe(7.3);
    expect(formatTimecode(435, 30)).toBe("00:14.50");
  });
});

describe("formate și zone de siguranță", () => {
  it("presetările au dimensiunile cerute", () => {
    expect(makeFormat("9x16", { platform: "tiktok", durationSec: 30 })).toMatchObject({ width: 1080, height: 1920, fps: 30 });
    expect(makeFormat("16x9", { platform: "youtube", durationSec: 30, fps: 60 })).toMatchObject({ width: 1920, height: 1080, fps: 60 });
    expect(makeFormat("1x1", { platform: "feed", durationSec: 15, fps: 25 })).toMatchObject({ width: 1080, height: 1080 });
    expect(makeFormat({ width: 1200, height: 800 }, { platform: "generic", durationSec: 10, fps: 24 }).id).toBe("1200x800");
  });
  it("TikTok vertical: sus 240, jos 660, coloana de butoane exclusă", () => {
    const z = resolveSafeZone({ width: 1080, height: 1920, platform: "tiktok" });
    expect(z.top).toBe(240);
    expect(z.bottom).toBe(660);
    expect(z.exclusions[0]).toMatchObject({ x: 780, y: 840, w: 300 });
    expect(rectInside({ x: 200, y: 300, w: 400, h: 200 }, z.rect)).toBe(true);
    expect(rectInside({ x: 200, y: 1400, w: 400, h: 200 }, z.rect)).toBe(false);
  });
  it("pe orizontal nu se aplică suprapunerile verticale", () => {
    const z = resolveSafeZone({ width: 1920, height: 1080, platform: "tiktok" });
    expect(z.bottom).toBeLessThan(200);
    expect(z.exclusions).toHaveLength(0);
  });
});

describe("culoare", () => {
  it("contrast WCAG și text lizibil", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(readableOn("#111111")).toBe("#ffffff");
    expect(readableOn("#f5f5f5")).toBe("#0b0b0f");
  });
});

describe("așezarea textului", () => {
  const mono: Measure = (t, _f, size) => t.length * size * 0.5;
  const font = { family: "X", weight: 700, tracking: 0, uppercase: false };
  it("alege cea mai mare mărime care încape și împarte pe rânduri", () => {
    const r = layoutText("Un mesaj scurt dar clar", font, { w: 600, h: 400 }, mono, { maxSize: 200, minSize: 20 });
    expect(r.overflow).toBe(false);
    for (const l of r.lines) expect(mono(l, font, r.fontSize)).toBeLessThanOrEqual(600);
    expect(r.lines.length * r.fontSize * r.lineHeight).toBeLessThanOrEqual(400);
    const bigger = layoutText("Un mesaj scurt dar clar", font, { w: 600, h: 400 }, mono, { maxSize: r.fontSize + 1, minSize: r.fontSize + 1 });
    expect(bigger.overflow).toBe(true);
  });
  it("semnalează textul care nu încape nici la mărimea minimă", () => {
    const r = layoutText("Supercalifragilisticexpialidocious", font, { w: 100, h: 100 }, mono, { maxSize: 80, minSize: 20 });
    expect(r.overflow).toBe(true);
  });
  it("majusculele românești se aplică corect", () => {
    const r = layoutText("ședință", { ...font, uppercase: true }, { w: 900, h: 300 }, mono, { maxSize: 100, minSize: 10 });
    expect(r.lines[0]).toBe("ȘEDINȚĂ");
  });
});

describe("curățarea cache-ului", () => {
  it("păstrează intrarea curentă, ultimele folosite și tot ce s-a folosit recent", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mms-prune-"));
    const now = Date.now();
    const H = 3600_000;
    const make = (name: string, usedAgoMs: number) => {
      fs.mkdirSync(path.join(dir, name));
      fs.writeFileSync(path.join(dir, name, "bundle.js"), "x".repeat(1000));
      const m = path.join(dir, name, USED_MARKER);
      fs.writeFileSync(m, "");
      const t = new Date(now - usedAgoMs);
      fs.utimesSync(m, t, t);
    };
    make("curent", 100 * H); // codul curent: rămâne oricât de vechi ar fi
    make("a", 1 * H); // cel mai recent dintre cele vechi: rămâne (maxOld = 1)
    make("b", 1.5 * H); // peste limită, dar folosit acum 1,5 ore: rămâne (perioada de grație)
    make("c", 40 * H);
    make("d", 50 * H);
    make("e", 60 * H);
    const removed = pruneOldDirs(dir, { keep: ["curent"], maxOld: 1, graceMs: 2 * H, now });
    expect(removed.sort()).toEqual(["c", "d", "e"]);
    expect(fs.readdirSync(dir).sort()).toEqual(["a", "b", "curent"]);
    expect(dirSize(dir)).toBe(3000);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe("bugetul cache-ului și spațiul pe disc", () => {
  it("șterge întâi fișierele folosite cel mai demult, până la 80% din buget", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mms-budget-"));
    const now = Date.now();
    for (let i = 0; i < 10; i++) {
      const f = path.join(dir, i < 5 ? "renders" : "quality", `f${i}.bin`);
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, Buffer.alloc(1000));
      const t = new Date(now - (10 - i) * 60_000);
      fs.utimesSync(f, t, t);
    }
    const r = enforceCacheBudget({ dirs: [path.join(dir, "renders"), path.join(dir, "quality")], maxBytes: 6000 });
    expect(r).toEqual({ before: 10_000, after: 4000, removed: 6 });
    // rămân cele mai recente
    expect(fs.readdirSync(path.join(dir, "quality")).sort()).toEqual(["f6.bin", "f7.bin", "f8.bin", "f9.bin"]);
    expect(enforceCacheBudget({ dirs: [path.join(dir, "quality")], maxBytes: 6000 }).removed).toBe(0);
    fs.rmSync(dir, { recursive: true, force: true });
  });
  it("refuză o randare care ar umple discul, cu o rezervă de 1 GB", () => {
    const GB = 1024 ** 3;
    expect(() => assertDiskSpace(".", 0.5 * GB, "randarea video", 3 * GB)).not.toThrow();
    let err: unknown = null;
    try {
      assertDiskSpace(".", 0.5 * GB, "randarea video", 1.2 * GB);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(MmsError);
    expect((err as MmsError).code).toBe("DISK_SPACE");
    // fără măsurătoare nu blochează
    expect(() => assertDiskSpace(".", 100 * GB, "randarea video", null)).not.toThrow();
  });
});

describe("migrarea schemelor", () => {
  it("aduce un fișier vechi la schema de acum, în memorie, și refuză clar un fișier mai nou", async () => {
    const { z } = await import("zod");
    const { readJson } = await import("../../src/core/json");
    const { registerMigrations, schemaVersionOf } = await import("../../src/core/migrate");
    const S = z.object({ schemaVersion: z.literal(3), name: z.string(), tags: z.array(z.string()) });
    registerMigrations(S, [
      { from: 1, describe: "title → name", up: ({ title, ...r }) => ({ ...r, name: title }) },
      { from: 2, describe: "tags obligatorii", up: (r) => ({ ...r, tags: r.tags ?? [] }) },
    ]);
    expect(schemaVersionOf(S)).toBe(3);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mms-migrate-"));
    const f = path.join(dir, "x.json");
    const v1 = `${JSON.stringify({ schemaVersion: 1, title: "Vechi" })}\n`;
    fs.writeFileSync(f, v1);
    expect(readJson(f, S)).toEqual({ schemaVersion: 3, name: "Vechi", tags: [] });
    // fișierul de pe disc rămâne neatins (versiunile înghețate nu se rescriu)
    expect(fs.readFileSync(f, "utf8")).toBe(v1);
    const code = (raw: unknown, schema: Parameters<typeof readJson>[1] = S) => {
      fs.writeFileSync(f, JSON.stringify(raw));
      try {
        readJson(f, schema);
        return null;
      } catch (e) {
        return (e as MmsError).code;
      }
    };
    expect(code({ schemaVersion: 4, name: "Nou", tags: [] })).toBe("SCHEMA_NEWER");
    expect(code({ schemaVersion: 0, title: "Prea vechi" })).toBe("SCHEMA_OLD");
    // schemele reale: un timeline scris de un studio mai nou primește indicația de actualizare
    const { Timeline } = await import("../../src/core/schema");
    expect(code({ schemaVersion: 2 }, Timeline)).toBe("SCHEMA_NEWER");
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
