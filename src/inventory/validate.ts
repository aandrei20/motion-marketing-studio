/**
 * Verificarea inventarului față de cod: fiecare trimitere trebuie să existe. Folosită de test și de
 * generatorul de documentație (care refuză să scrie un inventar care minte).
 */
import fs from "node:fs";
import path from "node:path";
import { SFX } from "../audio/sfx";
import { EditOp } from "../core/schema";
import { PATHS } from "../core/paths";
import { ALL_CAPABILITIES } from "../motion/registry";
import { CHECKS } from "../quality/checks";
import { RECIPES } from "../recipes/recipes";
import { INVENTORY, type InventoryItem } from "./inventory";

const OPS = new Set(EditOp.options.map((o) => o.shape.op.value as string));

export function refProblem(ref: string): string | null {
  const [kind, ...rest] = ref.split(":");
  const v = rest.join(":");
  switch (kind) {
    case "cap":
      return ALL_CAPABILITIES.some((c) => c.id === v) ? null : `capabilitate inexistentă: ${v}`;
    case "recipe":
      return RECIPES.some((r) => r.id === v) ? null : `rețetă inexistentă: ${v}`;
    case "sfx":
      return SFX.some((s) => s.id === v) ? null : `sunet inexistent: ${v}`;
    case "check":
      return CHECKS.some((c) => c.id === v) ? null : `verificare inexistentă: ${v}`;
    case "op":
      return OPS.has(v) ? null : `operație inexistentă: ${v}`;
    case "template":
      return fs.existsSync(path.join(PATHS.templates, `${v}.json`)) ? null : `șablon inexistent: ${v}`;
    case "module": {
      const [file, name] = v.split("#");
      const abs = path.join(PATHS.root, file);
      if (!fs.existsSync(abs)) return `fișier inexistent: ${file}`;
      if (name && !new RegExp(`export (async )?(function|const|class|type|interface) ${name}\\b`).test(fs.readFileSync(abs, "utf8"))) return `${file} nu exportă ${name}`;
      return null;
    }
    default:
      return `tip de trimitere necunoscut: ${ref}`;
  }
}

/** Problemele inventarului: trimiteri care nu există și stări fără justificare. */
export function inventoryProblems(items: InventoryItem[] = INVENTORY): string[] {
  const out: string[] = [];
  const ids = new Set<string>();
  for (const it of items) {
    if (ids.has(it.id)) out.push(`${it.id}: id duplicat`);
    ids.add(it.id);
    for (const r of it.refs) {
      const p = refProblem(r);
      if (p) out.push(`${it.id}: ${p}`);
    }
    if (it.status === "IMPLEMENTED" && !it.refs.length) out.push(`${it.id}: IMPLEMENTED fără nicio trimitere la implementare`);
    if ((it.status === "PARTIAL" || it.status === "MISSING" || it.status === "PLANNED") && !it.next) out.push(`${it.id}: ${it.status} fără pasul următor`);
    if (it.status === "PARTIAL" && !it.note) out.push(`${it.id}: PARTIAL fără explicația a ce lipsește`);
    if (it.status === "MISSING" && it.refs.length) out.push(`${it.id}: MISSING, dar are trimiteri (atunci e PARTIAL)`);
    if (it.status === "REDUNDANT" && !it.note) out.push(`${it.id}: REDUNDANT fără să spună cu ce se suprapune`);
  }
  return out;
}

/** Capabilitățile din registry folosite efectiv de rețete sau direcții (restul se aleg doar explicit de Claude). */
export function capabilityUsage(): Map<string, string[]> {
  const use = new Map<string, string[]>();
  for (const r of RECIPES) for (const c of r.capabilities) use.set(c, [...(use.get(c) ?? []), `rețeta ${r.id}`]);
  return use;
}
