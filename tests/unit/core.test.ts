import { describe, expect, it } from "vitest";
import { hashString, mulberry32, noise1, rand } from "../../src/core/random";
import { formatTimecode, parseTimeToSec } from "../../src/core/time";
import { makeFormat, resolveSafeZone, rectInside } from "../../src/core/formats";
import { contrastRatio, readableOn } from "../../src/motion/core/color";
import { layoutText, type Measure } from "../../src/motion/core/text-layout";

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
