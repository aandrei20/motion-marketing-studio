/**
 * Editare cu istoric: fiecare schimbare din editor (sau de la Claude / corecturile automate) se aplică pe
 * storyboard-ul versiunii editabile și se scrie în versions/vN/edits.json, cu amprentele stării dinainte și
 * de după (conținutul în projects/<id>/snapshots/). Undo/redo restaurează exact acele stări.
 *
 * Pe o versiune înghețată (preview, aprobată, finală) prima editare creează automat versiunea următoare
 * (regula 9); undo-ul nu poate modifica o versiune înghețată.
 */
import fs from "node:fs";
import { MmsError } from "../core/errors";
import { readJson, writeValidated } from "../core/json";
import { EditLog, EditOp, Storyboard, type EditLogEntry, type EditOpInput } from "../core/schema";
import { appendChanges, assertWritable, hasFile, loadAssets, loadProject, loadStoryboard, loadTimeline, loadVersionMeta, saveStoryboard, updateState, versionFile, writableVersion } from "../projects/store";
import { loadSnapshot, saveSnapshot } from "../projects/snapshots";
import { applyEditOps, type AppliedEdit } from "./ops";

const logFile = (projectId: string, v: string) => versionFile(projectId, v, "edits.json");

export function loadEditLog(projectId: string, v: string): EditLog {
  const f = logFile(projectId, v);
  return fs.existsSync(f) ? readJson(f, EditLog) : { schemaVersion: 1, entries: [] };
}

function saveEditLog(projectId: string, v: string, log: EditLog): void {
  writeValidated(logFile(projectId, v), EditLog, log);
}

export interface EditResult {
  versionId: string;
  entry: EditLogEntry;
  applied: AppliedEdit[];
}

/** Aplică operațiile pe versiunea editabilă (o creează dacă cea curentă e înghețată). Nu recompilează. */
export function applyEdit(projectId: string, rawOps: EditOpInput[], o: { source?: EditLogEntry["source"]; description?: string; versionId?: string } = {}): EditResult {
  const ops = rawOps.map((x) => EditOp.parse(x));
  if (!ops.length) throw new MmsError("NO_OPS", "Nicio operație de aplicat.");
  const at = new Date().toISOString();
  const project = loadProject(projectId);
  const versionId = o.versionId ?? writableVersion(projectId);
  assertWritable(projectId, versionId);
  const before = loadStoryboard(projectId, versionId);
  const fid = project.formats[0].id;
  const timeline = hasFile(projectId, `versions/${versionId}/timeline-${fid}.json`) ? loadTimeline(projectId, versionId, fid) : null;
  const res = applyEditOps(before, ops, { timeline, assets: loadAssets(projectId), respectLocks: o.source === "auto-fix" });
  const b = saveSnapshot(projectId, "storyboard", before);
  const a = saveSnapshot(projectId, "storyboard", res.storyboard);
  saveStoryboard(projectId, versionId, res.storyboard);
  const log = loadEditLog(projectId, versionId);
  // o editare nouă după undo șterge ramura de redo (comportament standard)
  log.entries = log.entries.filter((e) => !e.undone);
  const description = o.description ?? res.applied.map((x) => x.description).join(" ");
  const entry: EditLogEntry = { n: (log.entries[log.entries.length - 1]?.n ?? 0) + 1, at, ops, description, before: b, after: a, source: o.source ?? "editor", undone: false };
  log.entries.push(entry);
  saveEditLog(projectId, versionId, log);
  appendChanges(projectId, versionId, res.applied.filter((x) => !x.skipped).map((x) => ({ at, op: x.op.op, description: x.description, params: x.op as unknown as Record<string, unknown> })));
  updateState(projectId, { log: `Editare (${entry.source}) în ${versionId}: ${description}` });
  return { versionId, entry, applied: res.applied };
}

/** Anulează ultima editare aplicată din versiunea curentă (restaurează storyboard-ul dinainte). */
export function undo(projectId: string, versionId?: string): { versionId: string; entry: EditLogEntry } {
  const v = versionId ?? loadProject(projectId).currentVersion;
  if (!v) throw new MmsError("NO_VERSION", "Proiectul nu are versiuni.");
  if (loadVersionMeta(projectId, v).frozen) throw new MmsError("VERSION_FROZEN", `Versiunea ${v} e înghețată; undo-ul nu o poate modifica.`, "Alege versiunea anterioară (mms versions) sau continuă editarea: se creează automat versiunea următoare.");
  const log = loadEditLog(projectId, v);
  const entry = [...log.entries].reverse().find((e) => !e.undone);
  if (!entry) throw new MmsError("NOTHING_TO_UNDO", `Nicio editare de anulat în ${v}.`);
  saveStoryboard(projectId, v, Storyboard.parse(loadSnapshot(projectId, "storyboard", entry.before)));
  entry.undone = true;
  saveEditLog(projectId, v, log);
  appendChanges(projectId, v, [{ at: new Date().toISOString(), op: "undo", description: `Anulat: ${entry.description}`, params: { n: entry.n } }]);
  updateState(projectId, { log: `Undo în ${v}: ${entry.description}` });
  return { versionId: v, entry };
}

/** Refă prima editare anulată (în ordinea în care fuseseră aplicate). */
export function redo(projectId: string, versionId?: string): { versionId: string; entry: EditLogEntry } {
  const v = versionId ?? loadProject(projectId).currentVersion;
  if (!v) throw new MmsError("NO_VERSION", "Proiectul nu are versiuni.");
  assertWritable(projectId, v);
  const log = loadEditLog(projectId, v);
  const entry = log.entries.find((e) => e.undone);
  if (!entry) throw new MmsError("NOTHING_TO_REDO", `Nicio editare de refăcut în ${v}.`);
  saveStoryboard(projectId, v, Storyboard.parse(loadSnapshot(projectId, "storyboard", entry.after)));
  entry.undone = false;
  saveEditLog(projectId, v, log);
  appendChanges(projectId, v, [{ at: new Date().toISOString(), op: "redo", description: `Refăcut: ${entry.description}`, params: { n: entry.n } }]);
  updateState(projectId, { log: `Redo în ${v}: ${entry.description}` });
  return { versionId: v, entry };
}
