/**
 * Generează docs/BIBLIOTECA.md din registry (capabilități, rețete, șabloane, sunete), ca documentația
 * bibliotecii să descrie exact ce există în cod. Rulează: npx tsx scripts/build-docs.ts
 */
import fs from "node:fs";
import path from "node:path";
import { SFX } from "../src/audio/sfx";
import { PATHS } from "../src/core/paths";
import { listTemplates } from "../src/creative/templates";
import { DIRECTIONS } from "../src/creative/directions";
import { ALL_CAPABILITIES } from "../src/motion/registry";
import { RECIPES } from "../src/recipes/recipes";

const CATEGORY: Record<string, string> = {
  camera: "Cameră",
  transition: "Tranziții",
  typography: "Tipografie",
  ui: "Interfață (straturi peste captura reală)",
  frame: "Rame de dispozitiv (generice)",
  media: "Media (imagini, video, ecrane)",
  "3d": "3D (CSS 3D real)",
  background: "Fundaluri",
  light: "Lumină",
  particles: "Particule",
  texture: "Textură",
  distortion: "Distorsiuni",
  logo: "Logo",
  data: "Date și grafice (doar cifre cu sursă)",
  shape: "Forme",
  modifier: "Modificatori (se aplică pe orice strat)",
};

const lines: string[] = [];
lines.push("# Biblioteca de efecte", "");
lines.push("Fișier generat din cod de `scripts/build-docs.ts` – nu îl edita de mână. Sursa de adevăr: `src/motion/registry.ts` și `library/registry.json`.", "");
lines.push(`**${ALL_CAPABILITIES.length} capabilități** · **${RECIPES.length} rețete** · **${listTemplates().length} șabloane** · **${SFX.length} sunete sintetizate** · **${Object.keys(DIRECTIONS).length} direcții creative**`, "");
lines.push("Fiecare capabilitate are implementare reală, parametri validați (zod), sunet declarat și un exemplu randat de testul de catalog (`tests/render/catalog.test.ts`), care verifică și determinismul. Starea „tested” înseamnă că exemplul a fost randat și a trecut testele.", "");
lines.push("Vezi catalogul vizual: `npm run remotion` (compoziția „Catalog”).", "");

const byCat = new Map<string, typeof ALL_CAPABILITIES>();
for (const c of ALL_CAPABILITIES) byCat.set(c.category, [...(byCat.get(c.category) ?? []), c]);
for (const [cat, caps] of byCat) {
  lines.push(`## ${CATEGORY[cat] ?? cat} (${caps.length})`, "");
  lines.push("| Id | Ce face | Sunet | Stare |", "| --- | --- | --- | --- |");
  for (const c of caps) {
    const sfx = c.sfx.map((s) => `${s.sound} (${s.at})`).join(", ") || "—";
    lines.push(`| \`${c.id}\` | **${c.title}.** ${c.description.replace(/\|/g, "/")} | ${sfx} | ${c.status} |`);
  }
  lines.push("");
}

lines.push("## Rețete (combinații de nivel înalt)", "");
lines.push("O rețetă primește scena (rol, text, materiale, energie, format) și produce straturile, camera și sunetele. Claude alege rețeta; motorul o execută.", "");
lines.push("| Id | Pentru | Materiale | Ce face |", "| --- | --- | --- | --- |");
for (const r of RECIPES) lines.push(`| \`${r.id}\` | ${r.roles.join(", ")} | ${r.slots.map((s) => `${s.name}${s.required ? "" : "?"}`).join(", ") || "—"} | **${r.title}.** ${r.description} |`);
lines.push("");

lines.push("## Șabloane de structură (templates/)", "");
lines.push("| Id | Durată | Scene | Descriere |", "| --- | --- | --- | --- |");
for (const t of listTemplates()) lines.push(`| \`${t.id}\` | ${t.durationSec.join("–")} s | ${t.scenes.map((s) => s.recipe + (s.optional ? "?" : "")).join(" → ")} | ${t.title}. ${t.description} |`);
lines.push("");

lines.push("## Direcții creative", "");
for (const d of Object.values(DIRECTIONS)) lines.push(`- **${d.letter} – ${d.label}** (\`${d.id}\`): ${d.description} Tranziții: ${[...new Set([...d.transitions.calm, ...d.transitions.rise])].join(", ")}. Text: ${d.text.hook}. Muzică: ${d.mood}, ${d.bpm.join("–")} BPM.`);
lines.push("");

lines.push("## Sunete sintetizate (src/audio/sfx.ts)", "");
lines.push("Toate sunetele sunt generate din cod (originale, fără licențe externe), deterministe, în cache la `.cache/sfx/`.", "");
lines.push(SFX.map((s) => `\`${s.id}\` (${s.title})`).join(" · "), "");

fs.writeFileSync(path.join(PATHS.root, "docs", "BIBLIOTECA.md"), lines.join("\n"));
console.log("Scris docs/BIBLIOTECA.md");
