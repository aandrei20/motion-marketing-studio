/**
 * Regresie vizuală: fiecare cadru de referință se reduce la o amprentă perceptuală compactă (grilă RGB
 * 32 × N, medie pe blocuri), salvată în tests/golden/*.json. O randare nouă se compară cu ea:
 *   - diferența medie pe toată grila (schimbări de culoare, de luminozitate, elemente lipsă);
 *   - diferența maximă pe un bloc (un element mutat sau dispărut într-o zonă).
 * Rasterizarea Chrome variază cu cel mult 2/255 (invizibil); pragurile de aici sunt mult peste ea și mult
 * sub o schimbare vizibilă. Actualizarea referințelor e o decizie explicită: MMS_UPDATE_GOLDEN=1.
 */
import fs from "node:fs";
import path from "node:path";
import { thumbnail } from "../../src/assets/analyze";
import { PATHS } from "../../src/core/paths";

export const GOLDEN_DIR = path.join(PATHS.root, "tests", "golden");
/** cadrele care nu trec regresia, pentru inspecție */
export const DIFF_DIR = path.join(PATHS.cache, "golden-diff");
export const GRID_W = 32;
/** media diferenței pe canal (0–255) peste care cadrul s-a schimbat vizibil */
export const MEAN_LIMIT = 6;
/** diferența pe un bloc (0–255) peste care un element s-a mutat sau a dispărut */
export const BLOCK_LIMIT = 60;

export interface GoldenEntry {
  w: number;
  h: number;
  rgb: string;
}

export async function gridOf(file: string, aspect: number): Promise<GoldenEntry> {
  const h = Math.max(4, Math.round(GRID_W / aspect));
  const t = await thumbnail(file, GRID_W, 0, h);
  if (!t) throw new Error(`Nu pot citi ${file}`);
  return { w: t.w, h: t.h, rgb: Buffer.from(t.rgb).toString("base64") };
}

export function compareGrid(a: GoldenEntry, b: GoldenEntry): { mean: number; maxBlock: number } {
  if (a.w !== b.w || a.h !== b.h) return { mean: 255, maxBlock: 255 };
  const x = Buffer.from(a.rgb, "base64");
  const y = Buffer.from(b.rgb, "base64");
  let sum = 0;
  let max = 0;
  for (let i = 0; i < x.length; i += 3) {
    const d = (Math.abs(x[i] - y[i]) + Math.abs(x[i + 1] - y[i + 1]) + Math.abs(x[i + 2] - y[i + 2])) / 3;
    sum += d;
    if (d > max) max = d;
  }
  return { mean: Math.round((sum / (x.length / 3)) * 100) / 100, maxBlock: Math.round(max) };
}

export function loadGolden(name: string): Record<string, GoldenEntry> | null {
  const f = path.join(GOLDEN_DIR, `${name}.json`);
  return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, "utf8")) as Record<string, GoldenEntry>) : null;
}

export function saveGolden(name: string, data: Record<string, GoldenEntry>): void {
  fs.mkdirSync(GOLDEN_DIR, { recursive: true });
  const sorted = Object.fromEntries(
    Object.keys(data)
      .sort()
      .map((k) => [k, data[k]]),
  );
  fs.writeFileSync(path.join(GOLDEN_DIR, `${name}.json`), `${JSON.stringify(sorted, null, 1)}\n`);
}

export const updateGolden = (): boolean => process.env.MMS_UPDATE_GOLDEN === "1";

/** Comparația unui set de cadre cu referințele lui; întoarce regresiile (sau scrie referințele noi). */
export async function checkGolden(
  name: string,
  frames: Array<{ id: string; file: string; aspect: number }>,
): Promise<{ regressions: string[]; missing: string[]; written: boolean }> {
  const now: Record<string, GoldenEntry> = {};
  for (const f of frames) now[f.id] = await gridOf(f.file, f.aspect);
  const golden = loadGolden(name);
  if (updateGolden() || !golden) {
    saveGolden(name, now);
    return { regressions: [], missing: [], written: true };
  }
  const regressions: string[] = [];
  const missing: string[] = [];
  for (const [id, g] of Object.entries(now)) {
    const ref = golden[id];
    if (!ref) {
      missing.push(id);
      continue;
    }
    const c = compareGrid(ref, g);
    if (c.mean > MEAN_LIMIT || c.maxBlock > BLOCK_LIMIT) {
      regressions.push(`${id}: diferență medie ${c.mean}, maximă pe bloc ${c.maxBlock}`);
      // cadrul nou se păstrează pentru inspecție (în CI devine artefact)
      const src = frames.find((f) => f.id === id)?.file;
      if (src) {
        fs.mkdirSync(path.join(DIFF_DIR, name), { recursive: true });
        fs.copyFileSync(src, path.join(DIFF_DIR, name, `${id}${path.extname(src)}`));
      }
    }
  }
  return { regressions, missing, written: false };
}
