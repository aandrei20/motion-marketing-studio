import fs from "node:fs";
import path from "node:path";
import { MmsError } from "./errors";
import { ROOT } from "./paths";

/**
 * Încarcă `.env` din rădăcină (fără dependențe). Valorile existente în mediu au prioritate.
 * Cheile nu se scriu niciodată în loguri.
 */
let loaded = false;
export function loadEnv(): void {
  if (loaded) return;
  loaded = true;
  const file = path.join(ROOT, ".env");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const [, key, rawValue] = m;
    const value = rawValue.replace(/^["']|["']$/g, "");
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export function optionalEnv(key: string): string | undefined {
  loadEnv();
  const v = process.env[key];
  return v && v.trim() ? v.trim() : undefined;
}

export function requireEnv(key: string, purpose: string): string {
  const v = optionalEnv(key);
  if (!v)
    throw new MmsError(
      "CONFIG_MISSING",
      `Lipsește ${key} (necesar pentru ${purpose}).`,
      `Adaugă ${key}=... în fișierul .env din rădăcina proiectului (vezi .env.example).`,
    );
  return v;
}

/** Ascunde valori secrete dintr-un text înainte de a-l afișa. */
export function redactSecrets(text: string): string {
  loadEnv();
  let out = text;
  for (const [k, v] of Object.entries(process.env)) {
    if (!v || v.length < 8) continue;
    if (/KEY|TOKEN|SECRET|PASSWORD/i.test(k)) out = out.split(v).join("***");
  }
  return out;
}
