/**
 * Verificarea proiectelor existente față de schemele de acum: fiecare fișier al proiectului și al fiecărei
 * versiuni se citește prin schema lui, iar fișierele la care trimit manifestul și timeline-urile trebuie să
 * existe pe disc. Așa se vede imediat un proiect vechi care nu mai e compatibil sau un material șters de mână,
 * înainte ca o randare să eșueze la jumătate.
 *
 * Schimbările de schemă se fac compatibil (câmpuri noi opționale sau cu valori implicite); o schimbare care
 * nu poate fi compatibilă crește `schemaVersion` și vine cu o migrare (docs/ARHITECTURA.md, „Date”).
 */
import fs from "node:fs";
import path from "node:path";
import { MmsError } from "../core/errors";
import { PATHS, publicToAbs } from "../core/paths";
import { timelineAssets } from "../timeline/assets";
import {
  hasFile,
  loadApprovals,
  loadAssets,
  loadBrand,
  loadBrief,
  loadProject,
  loadResearch,
  loadScript,
  loadState,
  loadStoryboard,
  loadTimeline,
  loadVersionMeta,
  projectDir,
  projectFile,
  timelineFileName,
} from "./store";

export interface ProjectFileProblem {
  projectId: string;
  file: string;
  problem: string;
}

/** Problemele unui proiect (listă goală = proiectul se poate folosi cu codul de acum). */
export function checkProjectFiles(id: string): ProjectFileProblem[] {
  const out: ProjectFileProblem[] = [];
  const attempt = (file: string, fn: () => void) => {
    try {
      fn();
    } catch (e) {
      out.push({ projectId: id, file, problem: e instanceof MmsError ? e.message.split("\n").slice(0, 4).join(" ") : String(e) });
    }
  };
  let formats: string[] = [];
  attempt("project.json", () => {
    formats = loadProject(id).formats.map((f) => f.id);
  });
  if (out.length) return out;
  if (hasFile(id, "brief.json")) attempt("brief.json", () => loadBrief(id));
  attempt("research.json", () => loadResearch(id));
  if (hasFile(id, "brand.json")) attempt("brand.json", () => loadBrand(id));
  attempt("approvals.json", () => loadApprovals(id));
  attempt("state.json", () => loadState(id));
  attempt("assets.json", () => {
    for (const a of loadAssets(id).assets)
      if (!fs.existsSync(path.join(projectDir(id), a.file)))
        out.push({ projectId: id, file: "assets.json", problem: `Lipsește fișierul materialului ${a.id}: ${a.file}` });
  });
  const vdir = projectFile(id, "versions");
  const versions = fs.existsSync(vdir) ? fs.readdirSync(vdir).filter((d) => /^v\d+$/.test(d)) : [];
  for (const v of versions) {
    const rel = (f: string) => `versions/${v}/${f}`;
    attempt(rel("version.json"), () => loadVersionMeta(id, v));
    if (hasFile(id, rel("script.json"))) attempt(rel("script.json"), () => loadScript(id, v));
    if (hasFile(id, rel("storyboard.json"))) attempt(rel("storyboard.json"), () => loadStoryboard(id, v));
    for (const f of formats) {
      const tf = rel(timelineFileName(f));
      if (!hasFile(id, tf)) continue;
      attempt(tf, () => {
        const missing = timelineAssets(loadTimeline(id, v, f)).filter((p) => !fs.existsSync(publicToAbs(p)));
        if (missing.length)
          out.push({
            projectId: id,
            file: tf,
            problem: `Timeline-ul folosește fișiere care lipsesc: ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? ` și încă ${missing.length - 3}` : ""}`,
          });
      });
    }
  }
  return out;
}

/** Toate proiectele din folderul de proiecte (un proiect stricat nu le ascunde pe celelalte). */
export function checkAllProjects(): ProjectFileProblem[] {
  if (!fs.existsSync(PATHS.projects)) return [];
  return fs
    .readdirSync(PATHS.projects, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(PATHS.projects, d.name, "project.json")))
    .flatMap((d) =>
      /^[a-z0-9][a-z0-9-]*$/.test(d.name)
        ? checkProjectFiles(d.name)
        : [{ projectId: d.name, file: "", problem: "Numele folderului nu e un id de proiect valid." }],
    );
}
