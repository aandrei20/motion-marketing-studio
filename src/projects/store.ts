import fs from "node:fs";
import path from "node:path";
import {
  Approval,
  Approvals,
  AssetManifest,
  Brand,
  Brief,
  Critique,
  FormatSpec,
  PIPELINE_STEPS,
  Project,
  ProjectState,
  Research,
  Script,
  Storyboard,
  Timeline,
  VersionMeta,
  type Change,
  type PipelineStep,
  type ProductCategory,
} from "../core/schema";
import { MmsError } from "../core/errors";
import { readJson, writeJson, writeValidated } from "../core/json";
import { PATHS } from "../core/paths";
import { renderStateMarkdown } from "./state-md";

/**
 * Structura unui proiect pe disc:
 *   projects/<id>/project.json, brief.json, research.json, brand.json, assets.json, approvals.json, state.json
 *   projects/<id>/assets/          fișiere ingerate (nume după rol + hash)
 *   projects/<id>/captures/        date brute de la captură (text pagină, regiuni)
 *   projects/<id>/sources/         textul extras din surse (research)
 *   projects/<id>/references/      profiluri de referință
 *   projects/<id>/cache/           voce TTS, decodări (se pot regenera)
 *   projects/<id>/versions/vN/     version.json, script.json, storyboard.json, timeline-<format>.json,
 *                                  critique.json, audio/, renders/
 *   projects/<id>/STATE.md         rezumat pentru reluarea lucrului
 */

export const now = (): string => new Date().toISOString();

export function projectDir(id: string): string {
  return path.join(PATHS.projects, id);
}

export function projectFile(id: string, rel: string): string {
  return path.join(projectDir(id), rel);
}

export function projectExists(id: string): boolean {
  return fs.existsSync(projectFile(id, "project.json"));
}

export function listProjects(): Project[] {
  if (!fs.existsSync(PATHS.projects)) return [];
  return fs
    .readdirSync(PATHS.projects, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(PATHS.projects, d.name, "project.json")))
    .map((d) => readJson(path.join(PATHS.projects, d.name, "project.json"), Project));
}

export interface CreateProjectOptions {
  id: string;
  name: string;
  product: { name: string; url?: string; category: ProductCategory; oneLiner?: string };
  formats: FormatSpec[];
  language?: { text: string | null; voice: string | null };
  seed?: number;
}

export function createProject(opts: CreateProjectOptions): Project {
  if (projectExists(opts.id)) throw new MmsError("PROJECT_EXISTS", `Proiectul „${opts.id}” există deja.`);
  const dir = projectDir(opts.id);
  for (const sub of ["assets", "captures", "sources", "references", "cache", "versions"]) {
    fs.mkdirSync(path.join(dir, sub), { recursive: true });
  }
  const t = now();
  const project = writeValidated(projectFile(opts.id, "project.json"), Project, {
    schemaVersion: 1,
    id: opts.id,
    name: opts.name,
    createdAt: t,
    updatedAt: t,
    product: opts.product,
    language: opts.language ?? { text: null, voice: null },
    formats: opts.formats,
    currentVersion: null,
    status: "intake",
    seed: opts.seed ?? 1,
  });
  writeValidated(projectFile(opts.id, "assets.json"), AssetManifest, { schemaVersion: 1, assets: [] });
  writeValidated(projectFile(opts.id, "research.json"), Research, {
    schemaVersion: 1,
    productSummary: "",
    sources: [],
    claims: [],
    openQuestions: [],
  });
  writeValidated(projectFile(opts.id, "approvals.json"), Approvals, { items: [] });
  const steps = Object.fromEntries(PIPELINE_STEPS.map((s) => [s, { state: "pending", note: "" }]));
  writeValidated(projectFile(opts.id, "state.json"), ProjectState, {
    schemaVersion: 1,
    steps: steps as ProjectState["steps"],
    decisions: [],
    next: ["Completează brief-ul (întrebările A–H) și aprobă-l cu „aprob”."],
    log: [{ at: t, text: "Proiect creat." }],
  });
  refreshStateMd(opts.id);
  return project;
}

// ─── citire / scriere pe entități ──────────────────────────────────────────

export const loadProject = (id: string): Project => {
  if (!projectExists(id))
    throw new MmsError("PROJECT_MISSING", `Nu există proiectul „${id}”.`, "Vezi lista cu: npm run mms -- list");
  return readJson(projectFile(id, "project.json"), Project);
};

export function saveProject(p: Project): Project {
  return writeValidated(projectFile(p.id, "project.json"), Project, { ...p, updatedAt: now() });
}

export const hasFile = (id: string, rel: string): boolean => fs.existsSync(projectFile(id, rel));

export const loadBrief = (id: string): Brief => readJson(projectFile(id, "brief.json"), Brief);
export const saveBrief = (id: string, b: unknown): Brief =>
  writeValidated(projectFile(id, "brief.json"), Brief, b as Brief);

export const loadResearch = (id: string): Research => readJson(projectFile(id, "research.json"), Research);
export const saveResearch = (id: string, r: Research): Research =>
  writeValidated(projectFile(id, "research.json"), Research, r);

export const loadBrand = (id: string): Brand => readJson(projectFile(id, "brand.json"), Brand);
export const saveBrand = (id: string, b: unknown): Brand => writeValidated(projectFile(id, "brand.json"), Brand, b as Brand);

export const loadAssets = (id: string): AssetManifest => readJson(projectFile(id, "assets.json"), AssetManifest);
export const saveAssets = (id: string, m: AssetManifest): AssetManifest =>
  writeValidated(projectFile(id, "assets.json"), AssetManifest, m);

export const loadApprovals = (id: string): Approvals => readJson(projectFile(id, "approvals.json"), Approvals);

export function addApproval(id: string, a: Omit<Approval, "at">): Approval {
  const list = loadApprovals(id);
  const item: Approval = { ...a, at: now() };
  writeValidated(projectFile(id, "approvals.json"), Approvals, { items: [...list.items, item] });
  return item;
}

export const loadState = (id: string): ProjectState => readJson(projectFile(id, "state.json"), ProjectState);

export function updateState(
  id: string,
  patch: { step?: PipelineStep; stepState?: "pending" | "done" | "skipped" | "blocked"; note?: string; decision?: string; next?: string[]; log?: string },
): ProjectState {
  const s = loadState(id);
  const t = now();
  if (patch.step) s.steps[patch.step] = { state: patch.stepState ?? "done", at: t, note: patch.note ?? "" };
  if (patch.decision) s.decisions.push({ at: t, text: patch.decision });
  if (patch.next) s.next = patch.next;
  if (patch.log) s.log.push({ at: t, text: patch.log });
  if (s.log.length > 400) s.log = s.log.slice(-400);
  const saved = writeValidated(projectFile(id, "state.json"), ProjectState, s);
  refreshStateMd(id);
  return saved;
}

export function refreshStateMd(id: string): void {
  fs.writeFileSync(projectFile(id, "STATE.md"), renderStateMarkdown(id), "utf8");
}

// ─── versiuni ──────────────────────────────────────────────────────────────

export const versionDir = (id: string, v: string): string => projectFile(id, path.join("versions", v));
export const versionFile = (id: string, v: string, rel: string): string => path.join(versionDir(id, v), rel);

export function listVersions(id: string): VersionMeta[] {
  const dir = projectFile(id, "versions");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((d) => /^v\d+$/.test(d) && fs.existsSync(path.join(dir, d, "version.json")))
    .map((d) => readJson(path.join(dir, d, "version.json"), VersionMeta))
    .sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
}

export function loadVersionMeta(id: string, v: string): VersionMeta {
  return readJson(versionFile(id, v, "version.json"), VersionMeta);
}

function saveVersionMeta(id: string, meta: VersionMeta): VersionMeta {
  return writeValidated(versionFile(id, meta.id, "version.json"), VersionMeta, meta);
}

/** Fișierele creative copiate dintr-o versiune în următoarea. Timeline-ul și mixul se recompilează. */
const CARRIED = ["script.json", "storyboard.json", "audio-plan.json"];

/**
 * Creează versiunea următoare pornind din `from` (sau din versiunea curentă). Versiunea-părinte
 * se îngheață. Nimic din versiunea veche nu se modifică sau șterge.
 */
export function createVersion(id: string, opts: { from?: string | null; label?: string; changes?: Change[] } = {}): VersionMeta {
  const project = loadProject(id);
  const existing = listVersions(id);
  const nextN = existing.length ? Math.max(...existing.map((v) => Number(v.id.slice(1)))) + 1 : 1;
  const vid = `v${nextN}`;
  const parent = opts.from === undefined ? project.currentVersion : opts.from;
  fs.mkdirSync(versionDir(id, vid), { recursive: true });
  if (parent) {
    for (const f of CARRIED) {
      const src = versionFile(id, parent, f);
      if (fs.existsSync(src)) fs.copyFileSync(src, versionFile(id, vid, f));
    }
    const pm = loadVersionMeta(id, parent);
    if (!pm.frozen) saveVersionMeta(id, { ...pm, frozen: true });
  }
  const meta = saveVersionMeta(id, {
    id: vid,
    createdAt: now(),
    parent: parent ?? null,
    label: opts.label ?? "",
    status: "draft",
    frozen: false,
    changes: opts.changes ?? [],
  });
  saveProject({ ...project, currentVersion: vid });
  updateState(id, { log: `Versiune nouă ${vid}${parent ? ` (din ${parent})` : ""}.` });
  return meta;
}

/** Garanția regulii 9: o versiune înghețată nu se mai scrie. */
export function assertWritable(id: string, v: string): void {
  const meta = loadVersionMeta(id, v);
  if (meta.frozen)
    throw new MmsError(
      "VERSION_FROZEN",
      `Versiunea ${v} este înghețată și nu se mai modifică.`,
      "Creează o versiune nouă (mms new-version) și lucrează pe ea.",
    );
}

export function freezeVersion(id: string, v: string, status?: VersionMeta["status"]): VersionMeta {
  const meta = loadVersionMeta(id, v);
  return saveVersionMeta(id, { ...meta, frozen: true, status: status ?? meta.status });
}

export function setVersionStatus(id: string, v: string, status: VersionMeta["status"]): VersionMeta {
  const meta = loadVersionMeta(id, v);
  return saveVersionMeta(id, { ...meta, status });
}

export function appendChanges(id: string, v: string, changes: Change[]): VersionMeta {
  assertWritable(id, v);
  const meta = loadVersionMeta(id, v);
  return saveVersionMeta(id, { ...meta, changes: [...meta.changes, ...changes] });
}

/**
 * Pregătește o versiune pentru editare: dacă versiunea curentă e înghețată, creează automat
 * următoarea versiune. Întoarce id-ul versiunii în care se poate scrie.
 */
export function writableVersion(id: string, changes: Change[] = []): string {
  const project = loadProject(id);
  if (!project.currentVersion) return createVersion(id, { from: null, changes }).id;
  const meta = loadVersionMeta(id, project.currentVersion);
  if (meta.frozen) return createVersion(id, { from: project.currentVersion, changes }).id;
  if (changes.length) appendChanges(id, meta.id, changes);
  return meta.id;
}

export const loadScript = (id: string, v: string): Script => readJson(versionFile(id, v, "script.json"), Script);
export function saveScript(id: string, v: string, s: unknown): Script {
  assertWritable(id, v);
  return writeValidated(versionFile(id, v, "script.json"), Script, s as Script);
}

export const loadStoryboard = (id: string, v: string): Storyboard =>
  readJson(versionFile(id, v, "storyboard.json"), Storyboard);
export function saveStoryboard(id: string, v: string, s: unknown): Storyboard {
  assertWritable(id, v);
  return writeValidated(versionFile(id, v, "storyboard.json"), Storyboard, s as Storyboard);
}

export const timelineFileName = (formatId: string): string => `timeline-${formatId}.json`;
export const loadTimeline = (id: string, v: string, formatId: string): Timeline =>
  readJson(versionFile(id, v, timelineFileName(formatId)), Timeline);
export function saveTimeline(id: string, v: string, t: Timeline): Timeline {
  assertWritable(id, v);
  return writeValidated(versionFile(id, v, timelineFileName(t.formatId)), Timeline, t);
}

export function loadCritique(id: string, v: string): Critique {
  const f = versionFile(id, v, "critique.json");
  if (!fs.existsSync(f)) return { schemaVersion: 1, threshold: 8, rounds: [] };
  return readJson(f, Critique);
}
/** Critica se poate adăuga și pe o versiune înghețată: e o observație despre ea, nu o modificare. */
export function saveCritique(id: string, v: string, c: Critique): Critique {
  return writeValidated(versionFile(id, v, "critique.json"), Critique, c);
}

export function writeVersionJson(id: string, v: string, rel: string, data: unknown): void {
  assertWritable(id, v);
  writeJson(versionFile(id, v, rel), data);
}
