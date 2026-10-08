/**
 * Generează library/registry.json din codul capabilităților (sursa de adevăr e src/motion/registry.ts).
 * Rulează: npm run registry   ·   Verificare fără scriere: npm run registry -- --check
 */
import fs from "node:fs";
import path from "node:path";
import { PATHS } from "../src/core/paths";
import { registryJson } from "../src/studio/registry-json";

const file = path.join(PATHS.library, "registry.json");
const content = `${JSON.stringify(registryJson(), null, 2)}\n`;
if (process.argv.includes("--check")) {
  const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n") : "";
  if (current !== content) {
    console.error("library/registry.json nu e la zi. Rulează: npm run registry");
    process.exit(1);
  }
  console.log("library/registry.json e la zi.");
} else {
  fs.writeFileSync(file, content);
  console.log(`Scris ${path.relative(PATHS.root, file)} (${JSON.parse(content).capabilities.length} capabilități).`);
}
