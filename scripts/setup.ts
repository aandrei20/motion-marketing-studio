/**
 * Pregătire după instalare (rulat de install.ps1 / install.sh / npm run update):
 * foldere, folderul public pentru Remotion Studio, cache-ul efectelor sonore, registry-ul.
 */
import fs from "node:fs";
import path from "node:path";
import { SFX, getSfx } from "../src/audio/sfx";
import { PATHS } from "../src/core/paths";
import { registryJson } from "../src/studio/registry-json";
import { preparePublicDir } from "../src/studio/remotion-studio";

fs.mkdirSync(PATHS.projects, { recursive: true });
fs.mkdirSync(PATHS.cache, { recursive: true });
const readme = path.join(PATHS.projects, "README.md");
if (!fs.existsSync(readme)) fs.writeFileSync(readme, "# Proiecte\n\nAici stau reclamele tale. Folderul nu urcă pe Git (are materiale cu drepturi, capturi și randări).\n");
preparePublicDir();
console.log("Foldere pregătite (projects/, .cache/, folderul public pentru Remotion Studio).");
let n = 0;
for (const s of SFX) {
  getSfx(s.id);
  n++;
}
console.log(`Efecte sonore sintetizate și puse în cache: ${n}.`);
fs.writeFileSync(path.join(PATHS.library, "registry.json"), `${JSON.stringify(registryJson(), null, 2)}\n`);
console.log("Registry-ul (library/registry.json) e la zi.");
