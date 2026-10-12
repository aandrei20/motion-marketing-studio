/**
 * Inteligența materialelor: o captură dată de utilizator (fără DOM) primește zone de text din OCR,
 * folosibile pentru zoom; datele personale din imagine se detectează (doar pe Windows, OCR offline).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mms-ocr-"));
process.env.MMS_PROJECTS_DIR = tmp;

describe("OCR pe materialele utilizatorului", () => {
  it.runIf(process.platform === "win32")(
    "captura dată de utilizator primește zone de text și le folosește la potrivirea zonei",
    async () => {
      const store = await import("../../src/projects/store");
      const { makeFormat } = await import("../../src/core/formats");
      const { ingestFile } = await import("../../src/assets/ingest");
      const { assetRegions } = await import("../../src/core/schema");
      const { bestRegion } = await import("../../src/recipes/kit");
      const { PATHS } = await import("../../src/core/paths");
      store.createProject({
        id: "ocr",
        name: "OCR",
        product: { name: "Produs Test", category: "saas" },
        formats: [makeFormat("16x9", { platform: "youtube", durationSec: 10 })],
        language: { text: "ro", voice: null },
      });
      const file = path.join(PATHS.root, "projects", "e2e-kolibri", "captures", "app.png");
      const src = fs.existsSync(file) ? file : path.join(PATHS.library, "catalog", "samples", "screenshot.png");
      const { asset } = await ingestFile("ocr", src, { origin: "user_provided", role: "screenshot", ocrLanguage: "ro" });
      expect(asset.capture).toBeUndefined();
      expect(asset.ocr?.language).toBeTruthy();
      const regions = assetRegions(asset);
      expect(regions.length).toBeGreaterThan(3);
      expect(regions.every((r) => r.rect.w > 0 && r.rect.h > 0)).toBe(true);
      // o zonă din OCR se poate ținti după text, ca o zonă din DOM
      const target = regions.find((r) => (r.text ?? "").length > 5)!;
      expect(bestRegion(regions, target.text!, ["text"])?.id).toBe(target.id);
    },
    120_000,
  );
});
