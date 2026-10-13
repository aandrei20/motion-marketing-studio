/**
 * Migrarea fișierelor de proiect între versiunile schemelor.
 *
 * Fiecare fișier de proiect are `schemaVersion: z.literal(N)` în schema lui. Schimbările compatibile (câmpuri
 * noi opționale sau cu valori implicite) nu schimbă N. O schimbare incompatibilă crește N în schemă și
 * înregistrează migrarea de la N-1 (`registerMigrations`), care primește JSON-ul vechi și întoarce forma nouă.
 *
 * Migrarea se face la citire, în memorie: fișierele versiunilor înghețate nu se rescriu (regula 9), iar un
 * fișier ajunge în forma nouă doar când e salvat din nou. Un fișier scris de o versiune mai nouă a studioului
 * se refuză cu o indicație clară, nu cu o eroare de schemă.
 */
import { z } from "zod";
import { MmsError } from "./errors";

export interface Migration {
  /** Versiunea de la care pleacă; rezultatul are `schemaVersion: from + 1`. */
  from: number;
  /** Ce se schimbă, pe scurt (apare în documentație și în depanare). */
  describe: string;
  up: (raw: Record<string, unknown>) => Record<string, unknown>;
}

const REGISTRY = new Map<z.ZodType, Migration[]>();

export function registerMigrations(schema: z.ZodType, list: Migration[]): void {
  REGISTRY.set(schema, [...(REGISTRY.get(schema) ?? []), ...list]);
}

/** Versiunea pe care o citește schema (din `schemaVersion: z.literal(N)`), sau null pentru schemele fără versiune. */
export function schemaVersionOf(schema: z.ZodType): number | null {
  const lit = (schema as { shape?: Record<string, unknown> }).shape?.schemaVersion;
  return lit instanceof z.ZodLiteral && typeof lit.value === "number" ? lit.value : null;
}

/** Aduce JSON-ul citit la versiunea schemei, aplicând migrările pe rând. Nu atinge fișierul de pe disc. */
export function migrateRaw(schema: z.ZodType, raw: unknown, where: string): unknown {
  const target = schemaVersionOf(schema);
  if (target === null || !raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const v = (raw as { schemaVersion?: unknown }).schemaVersion;
  if (typeof v !== "number" || !Number.isInteger(v) || v === target) return raw;
  if (v > target)
    throw new MmsError(
      "SCHEMA_NEWER",
      `${where} a fost scris de o versiune mai nouă a studioului (schema ${v}; aceasta citește până la ${target}).`,
      "Actualizează studioul: npm run update",
    );
  const list = REGISTRY.get(schema) ?? [];
  let cur = structuredClone(raw) as Record<string, unknown>;
  for (let from = v; from < target; from++) {
    const m = list.find((x) => x.from === from);
    if (!m)
      throw new MmsError(
        "SCHEMA_OLD",
        `${where} folosește schema ${v}, iar migrarea de la ${from} la ${from + 1} nu există.`,
        "Fișierul nu a fost modificat. Raportează problema, cu fișierul atașat.",
      );
    cur = { ...m.up(cur), schemaVersion: from + 1 };
  }
  return cur;
}
