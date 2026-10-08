import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function findRoot(start: string): string {
  let dir = start;
  for (;;) {
    if (fs.existsSync(path.join(dir, "package.json")) && fs.existsSync(path.join(dir, "CLAUDE.md"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error(`Nu găsesc rădăcina repo-ului pornind din ${start}`);
    dir = parent;
  }
}

export const ROOT = findRoot(path.dirname(fileURLToPath(import.meta.url)));

export const PATHS = {
  root: ROOT,
  projects: process.env.MMS_PROJECTS_DIR ? path.resolve(process.env.MMS_PROJECTS_DIR) : path.join(ROOT, "projects"),
  library: path.join(ROOT, "library"),
  templates: path.join(ROOT, "templates"),
  cache: path.join(ROOT, ".cache"),
  /** folderul public pentru Remotion Studio (joncțiuni spre projects/ și library/) */
  publicDir: path.join(ROOT, ".cache", "public"),
  sfxCache: path.join(ROOT, ".cache", "sfx"),
  browserProfiles: path.join(ROOT, ".browser-profiles"),
  examples: path.join(ROOT, "examples"),
};

/** Calea publică (folosită în timeline) pentru un fișier din proiect: projects/<id>/<rel>. */
export function projectPublicPath(projectId: string, rel: string): string {
  return `projects/${projectId}/${rel.replace(/\\/g, "/")}`;
}

/** Transformă o cale publică în cale absolută pe disc. */
export function publicToAbs(publicPath: string): string {
  const p = publicPath.replace(/\\/g, "/");
  if (p.startsWith("projects/")) return path.join(PATHS.projects, p.slice("projects/".length));
  if (p.startsWith("library/")) return path.join(PATHS.library, p.slice("library/".length));
  if (p.startsWith("cache/")) return path.join(PATHS.cache, p.slice("cache/".length));
  throw new Error(`Cale publică necunoscută: ${publicPath}`);
}
