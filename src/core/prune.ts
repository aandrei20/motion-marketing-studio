/**
 * Curățarea cache-urilor care cresc cu fiecare schimbare de cod (de ex. bundle-urile Remotion, ~20–60 MB
 * fiecare cu fișierele puse în public/). Se păstrează intrările cerute și cele mai recent folosite `maxOld`;
 * nu se șterge nimic folosit în ultimele `graceMs` (un Studio sau o randare pornită cu o versiune mai veche
 * a codului o poate folosi încă).
 */
import fs from "node:fs";
import path from "node:path";

/** Fișierul care marchează ultima folosire a unei intrări din cache. */
export const USED_MARKER = ".used";

export interface PruneOptions {
  keep?: string[];
  maxOld?: number;
  graceMs?: number;
  now?: number;
}

/** Șterge subfolderele vechi din `dir`. Întoarce numele celor șterse. */
export function pruneOldDirs(dir: string, o: PruneOptions = {}): string[] {
  if (!fs.existsSync(dir)) return [];
  const keep = new Set(o.keep ?? []);
  const maxOld = o.maxOld ?? 2;
  const graceMs = o.graceMs ?? 2 * 3600_000;
  const now = o.now ?? Date.now();
  const lastUsed = (name: string): number => {
    const marker = path.join(dir, name, USED_MARKER);
    return fs.existsSync(marker) ? fs.statSync(marker).mtimeMs : fs.statSync(path.join(dir, name)).mtimeMs;
  };
  const old = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !keep.has(e.name))
    .map((e) => ({ name: e.name, used: lastUsed(e.name) }))
    .sort((a, b) => b.used - a.used);
  const removed: string[] = [];
  for (const d of old.slice(maxOld)) {
    if (now - d.used < graceMs) continue;
    fs.rmSync(path.join(dir, d.name), { recursive: true, force: true });
    removed.push(d.name);
  }
  return removed;
}

/** Mărimea unui folder (fișierele legate hard se numără o singură dată). */
export function dirSize(dir: string, seen = new Set<string>()): number {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isSymbolicLink()) continue;
    if (e.isDirectory()) total += dirSize(p, seen);
    else {
      const st = fs.statSync(p, { bigint: true });
      const key = `${st.dev}:${st.ino}`;
      if (st.nlink > 1n && seen.has(key)) continue;
      seen.add(key);
      total += Number(st.size);
    }
  }
  return total;
}

/** Mărimea fiecărui subfolder din cache, descrescător. */
export function cacheReport(dir: string): Array<{ name: string; bytes: number }> {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.isSymbolicLink())
    .map((e) => ({ name: e.name, bytes: dirSize(path.join(dir, e.name)) }))
    .sort((a, b) => b.bytes - a.bytes);
}
