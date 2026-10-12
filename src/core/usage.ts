/**
 * Jurnalul operațiilor care costă bani sau timp: apelurile la vocile din cloud (plătite, pe caracter), sinteza
 * locală, randările. Un rând JSON pe operație, în `projects/<id>/usage.jsonl` (sau `.cache/usage.jsonl` fără
 * proiect). Nu conține texte, chei sau răspunsuri: doar furnizorul, modelul, operația, motivul, unitățile
 * (caractere, cadre), durata, rezultatul și dacă s-a refolosit din cache. Costul nu se estimează: furnizorii
 * nu îl întorc în aceste apeluri, iar o cifră inventată ar încălca regula 5.
 *
 * Bugetul: apelurile plătite dintr-o rulare (un proces) sunt limitate de MMS_MAX_PAID_CALLS (implicit 60),
 * ca o buclă stricată să nu consume credite fără limită.
 */
import fs from "node:fs";
import path from "node:path";
import { MmsError } from "./errors";
import { PATHS } from "./paths";

export interface UsageEntry {
  at: string;
  projectId?: string;
  provider: string;
  model?: string | null;
  op: "tts" | "render-preview" | "render-final";
  reason?: string;
  units?: { chars?: number; frames?: number };
  durationMs: number;
  cached: boolean;
  paid: boolean;
  ok: boolean;
  error?: string;
}

const PAID_DEFAULT = 60;
let paidCalls = 0;

function usageFile(projectId?: string): string {
  return projectId ? path.join(PATHS.projects, projectId, "usage.jsonl") : path.join(PATHS.cache, "usage.jsonl");
}

export function recordUsage(e: Omit<UsageEntry, "at">): void {
  const file = usageFile(e.projectId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify({ at: new Date().toISOString(), ...e })}\n`);
}

/** Cere voie pentru încă un apel plătit; aruncă dacă bugetul rulării e atins. */
export function reservePaidCall(provider: string): void {
  const raw = process.env.MMS_MAX_PAID_CALLS;
  const max = raw && /^\d+$/.test(raw) ? Number(raw) : PAID_DEFAULT;
  if (paidCalls >= max)
    throw new MmsError("BUDGET_PAID_CALLS", `Bugetul de apeluri plătite al acestei rulări e atins (${max}, furnizor ${provider}).`, "Verifică de ce se refac atâtea replici (textul se schimbă la fiecare pas?). Dacă e intenționat, mărește MMS_MAX_PAID_CALLS în .env.");
  paidCalls++;
}

export function loadUsage(projectId?: string): UsageEntry[] {
  const file = usageFile(projectId);
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .flatMap((l) => {
      try {
        return [JSON.parse(l) as UsageEntry];
      } catch {
        return [];
      }
    });
}

export interface UsageSummaryRow {
  provider: string;
  model: string | null;
  op: string;
  calls: number;
  cached: number;
  failed: number;
  chars: number;
  frames: number;
  durationMs: number;
}

/** Totalurile pe furnizor, model și operație (apeluri, refolosiri din cache, eșecuri, unități, durată). */
export function summarizeUsage(entries: UsageEntry[]): UsageSummaryRow[] {
  const rows = new Map<string, UsageSummaryRow>();
  for (const e of entries) {
    const key = `${e.provider}|${e.model ?? ""}|${e.op}`;
    const r = rows.get(key) ?? { provider: e.provider, model: e.model ?? null, op: e.op, calls: 0, cached: 0, failed: 0, chars: 0, frames: 0, durationMs: 0 };
    r.calls++;
    if (e.cached) r.cached++;
    if (!e.ok) r.failed++;
    if (!e.cached) {
      r.chars += e.units?.chars ?? 0;
      r.frames += e.units?.frames ?? 0;
      r.durationMs += e.durationMs;
    }
    rows.set(key, r);
  }
  return [...rows.values()].sort((a, b) => a.provider.localeCompare(b.provider) || a.op.localeCompare(b.op));
}
