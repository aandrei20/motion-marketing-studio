/**
 * Curățarea cache-urilor care cresc cu fiecare schimbare de cod (de ex. bundle-urile Remotion, ~20–60 MB
 * fiecare cu fișierele puse în public/). Se păstrează intrările cerute și cele mai recent folosite `maxOld`;
 * nu se șterge nimic folosit în ultimele `graceMs` (un Studio sau o randare pornită cu o versiune mai veche
 * a codului o poate folosi încă).
 */
import fs from "node:fs";
import path from "node:path";
import { MmsError } from "./errors";

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

/** Spațiul liber pe discul unui folder, în octeți (null dacă sistemul nu-l poate măsura). */
export function freeBytes(dir: string): number | null {
  try {
    const st = fs.statfsSync(dir);
    return Number(st.bavail) * Number(st.bsize);
  } catch {
    return null;
  }
}

/**
 * Oprește o operație mare (randarea) înainte să umple discul: cere spațiul estimat plus o rezervă de 1 GB.
 * Fără măsurătoare (sistem care nu o oferă) nu blochează nimic.
 */
export function assertDiskSpace(dir: string, needBytes: number, what: string, free: number | null = freeBytes(dir)): void {
  const reserve = 1024 ** 3;
  if (free === null || free >= needBytes + reserve) return;
  const gb = (b: number) => `${(b / 1024 ** 3).toFixed(1)} GB`;
  throw new MmsError(
    "DISK_SPACE",
    `Spațiu liber insuficient pentru ${what}: ${gb(free)} liberi, trebuie ~${gb(needBytes + reserve)} (cu rezerva de 1 GB).`,
    "Eliberează spațiu pe disc sau rulează: npm run mms -- cache --prune",
  );
}

/** Bugetul cache-urilor care se pot reface (implicit 10 GB; MMS_CACHE_MAX_GB îl schimbă). */
export function cacheBudgetBytes(): number {
  const raw = process.env.MMS_CACHE_MAX_GB;
  const gb = raw && /^\d+(\.\d+)?$/.test(raw) ? Number(raw) : 10;
  return gb * 1024 ** 3;
}

interface CacheFile {
  file: string;
  bytes: number;
  used: number;
}

function filesUnder(dir: string, out: CacheFile[] = []): CacheFile[] {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    // joncțiunile și legăturile (de ex. .cache/public → projects/) nu se urmează
    if (e.isSymbolicLink()) continue;
    if (e.isDirectory()) filesUnder(p, out);
    else {
      const st = fs.statSync(p);
      out.push({ file: p, bytes: st.size, used: Math.max(st.mtimeMs, st.atimeMs) });
    }
  }
  return out;
}

/**
 * Cache-urile care se pot reface oricând din intrări (adresate pe conținut): randările de preview, cadrele-cheie
 * ale buclei de calitate, mixurile, OCR-ul, audio decodat, capturile pentru intake. Versiunile folosesc
 * legături hard spre ele, deci ștergerea din cache nu atinge o versiune. Cache-ul vocilor (cache/tts) NU e aici:
 * timeline-urile trimit direct la el.
 */
export function evictableCacheDirs(root: { cache: string; projects: string }): string[] {
  const dirs = ["decoded", "intake", "golden-diff", "tts-work", "uploads"].map((d) => path.join(root.cache, d));
  if (fs.existsSync(root.projects))
    for (const p of fs.readdirSync(root.projects, { withFileTypes: true }))
      if (p.isDirectory()) for (const d of ["renders", "quality", "mix", "ocr"]) dirs.push(path.join(root.projects, p.name, "cache", d));
  return dirs;
}

/**
 * Ține cache-urile care se pot reface sub buget: când îl depășesc, șterge fișierele folosite cel mai demult
 * până ajunge la 80% din buget. Întoarce ce a șters.
 */
export function enforceCacheBudget(o: { dirs: string[]; maxBytes?: number }): { before: number; after: number; removed: number } {
  const max = o.maxBytes ?? cacheBudgetBytes();
  const files = o.dirs.flatMap((d) => filesUnder(d)).sort((a, b) => a.used - b.used);
  const before = files.reduce((s, f) => s + f.bytes, 0);
  let total = before;
  let removed = 0;
  if (total <= max) return { before, after: total, removed };
  for (const f of files) {
    if (total <= max * 0.8) break;
    fs.rmSync(f.file, { force: true });
    total -= f.bytes;
    removed++;
  }
  return { before, after: total, removed };
}
