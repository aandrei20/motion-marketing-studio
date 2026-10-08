import fs from "node:fs";
import path from "node:path";
import type { z } from "zod";
import { MmsError } from "./errors";

/** Citește și validează un JSON. Erorile de schemă arată exact câmpul greșit. */
export function readJson<S extends z.ZodType>(file: string, schema: S): z.infer<S> {
  if (!fs.existsSync(file)) throw new MmsError("FILE_MISSING", `Lipsește fișierul ${file}`);
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    throw new MmsError("JSON_INVALID", `JSON invalid în ${file}: ${(e as Error).message}`);
  }
  return parseWith(schema, raw, file);
}

export function parseWith<S extends z.ZodType>(schema: S, raw: unknown, where: string): z.infer<S> {
  const r = schema.safeParse(raw);
  if (!r.success) {
    const issues = r.error.issues
      .slice(0, 12)
      .map((i) => `  • ${i.path.join(".") || "(rădăcină)"}: ${i.message}`)
      .join("\n");
    throw new MmsError("SCHEMA_INVALID", `Date invalide în ${where}:\n${issues}`, "Corectează câmpurile de mai sus.");
  }
  return r.data;
}

/** Scriere atomică: fișier temporar + redenumire, ca un crash să nu lase JSON pe jumătate. */
export function writeJson(file: string, data: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n", "utf8");
  fs.renameSync(tmp, file);
}

export function writeValidated<S extends z.ZodType>(file: string, schema: S, data: z.input<S>): z.infer<S> {
  const parsed = parseWith(schema, data, file);
  writeJson(file, parsed);
  return parsed;
}

export function readJsonLoose(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
