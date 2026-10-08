/**
 * Snapshot-uri adresate prin conținut: projects/<id>/snapshots/<tip>-<amprentă>.json.
 * Aceeași stare se scrie o singură dată (deduplicare), iar o versiune păstrează doar amprentele.
 * Servesc la rollback, la comparația dintre versiuni și la undo/redo (stările storyboard-ului).
 */
import fs from "node:fs";
import path from "node:path";
import { fingerprint } from "../core/hash";
import { readJsonLoose, writeJson } from "../core/json";
import { MmsError } from "../core/errors";
import { projectFile } from "./store";

export type SnapshotKind = "brief" | "research" | "brand" | "assets" | "storyboard" | "script" | "quality";

function snapshotPath(projectId: string, kind: SnapshotKind, hash: string): string {
  return projectFile(projectId, path.join("snapshots", `${kind}-${hash}.json`));
}

export function saveSnapshot(projectId: string, kind: SnapshotKind, data: unknown): string {
  const hash = fingerprint(data);
  const f = snapshotPath(projectId, kind, hash);
  if (!fs.existsSync(f)) writeJson(f, data);
  return hash;
}

export function loadSnapshot<T = unknown>(projectId: string, kind: SnapshotKind, hash: string): T {
  const f = snapshotPath(projectId, kind, hash);
  if (!fs.existsSync(f)) throw new MmsError("SNAPSHOT_MISSING", `Lipsește snapshot-ul ${kind}-${hash}.`, "Snapshot-urile sunt în projects/<id>/snapshots/; nu le șterge cât timp versiunile le folosesc.");
  return readJsonLoose(f) as T;
}

export function hasSnapshot(projectId: string, kind: SnapshotKind, hash: string): boolean {
  return fs.existsSync(snapshotPath(projectId, kind, hash));
}

/** Snapshot-ul intrărilor de proiect folosite la compilarea unei versiuni (brief, research, brand, assets). */
export function snapshotProjectInputs(projectId: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of ["brief", "research", "brand", "assets"] as const) {
    const f = projectFile(projectId, `${k}.json`);
    if (fs.existsSync(f)) out[k] = saveSnapshot(projectId, k, readJsonLoose(f));
  }
  return out;
}
