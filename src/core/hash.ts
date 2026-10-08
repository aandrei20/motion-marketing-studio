import crypto from "node:crypto";
import fs from "node:fs";

/** JSON cu cheile sortate: aceleași date dau același text, indiferent de ordinea cheilor. */
export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`)
    .join(",")}}`;
}

/** Amprenta unei valori (16 hex): servește la cache, la detecția schimbărilor și la snapshot-uri. */
export function fingerprint(v: unknown): string {
  return crypto.createHash("sha1").update(stableStringify(v)).digest("hex").slice(0, 16);
}

const fileCache = new Map<string, { size: number; mtimeMs: number; hash: string }>();

/** Amprenta conținutului unui fișier (memorată după mărime și dată, ca să nu fie recitit). */
export function fileFingerprint(file: string): string | null {
  if (!fs.existsSync(file)) return null;
  const st = fs.statSync(file);
  const c = fileCache.get(file);
  if (c && c.size === st.size && c.mtimeMs === st.mtimeMs) return c.hash;
  const hash = crypto.createHash("sha1").update(fs.readFileSync(file)).digest("hex").slice(0, 16);
  fileCache.set(file, { size: st.size, mtimeMs: st.mtimeMs, hash });
  return hash;
}
