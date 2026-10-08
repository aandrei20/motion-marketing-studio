import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { PATHS } from "../core/paths";
import { loadProject, timelineFileName } from "../projects/store";

/**
 * Pregătește folderul public al Remotion Studio: joncțiuni (Windows) sau legături simbolice spre
 * projects/ și library/, ca fișierele să fie servite fără copiere.
 */
export function preparePublicDir(): string {
  const pub = PATHS.publicDir;
  fs.mkdirSync(pub, { recursive: true });
  for (const [name, target] of [
    ["projects", PATHS.projects],
    ["library", PATHS.library],
  ] as const) {
    const link = path.join(pub, name);
    fs.mkdirSync(target, { recursive: true });
    let ok = false;
    try {
      ok = fs.realpathSync(link) === fs.realpathSync(target);
    } catch {
      ok = false;
    }
    if (!ok) {
      fs.rmSync(link, { recursive: true, force: true });
      fs.symlinkSync(target, link, process.platform === "win32" ? "junction" : "dir");
    }
  }
  return pub;
}

/** Pornește Remotion Studio pe timeline-ul unui proiect (sau pe catalog, fără proiect). */
export async function runRemotionStudio(o: { projectId?: string; version?: string; format?: string }): Promise<void> {
  preparePublicDir();
  const args = ["remotion", "studio"];
  if (o.projectId) {
    const p = loadProject(o.projectId);
    const v = o.version ?? p.currentVersion;
    const f = o.format ?? p.formats[0].id;
    if (!v) throw new Error("Proiectul nu are încă versiuni compilate.");
    const props = path.join(PATHS.cache, "remotion-props.json");
    fs.writeFileSync(props, JSON.stringify({ timelinePath: `projects/${p.id}/versions/${v}/${timelineFileName(f)}` }));
    args.push(`--props=${props}`);
    console.log(`Remotion Studio pe ${p.id} ${v} ${f} (compoziția „Timeline”).`);
  } else console.log("Remotion Studio pe catalogul de efecte (compoziția „Catalog”).");
  // Remotion Studio (4.0.534) ascultă pe toate interfețele de rețea, fără opțiune de a-l limita la acest calculator
  console.log("Atenție: cât rulează, Remotion Studio e accesibil și din rețeaua locală (portul 3000). Pe rețele publice, folosește Studio-ul propriu (npm run studio, doar local) sau oprește-l cu Ctrl+C când termini.");
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.platform === "win32" ? "npx.cmd" : "npx", args, { cwd: PATHS.root, stdio: "inherit", shell: process.platform === "win32" });
    child.on("error", reject);
    child.on("exit", () => resolve());
  });
}
