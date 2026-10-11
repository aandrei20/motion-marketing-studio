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

// ─── inventarul de design și producție (src/inventory/inventory.ts) ──────────
{
  const { INVENTORY, AREA_TITLES } = await import("../src/inventory/inventory");
  const { inventoryProblems, capabilityUsage } = await import("../src/inventory/validate");
  const problems = inventoryProblems();
  if (problems.length) {
    console.error(`Inventarul are trimiteri false sau stări nejustificate:\n${problems.join("\n")}`);
    process.exit(1);
  }
  const STATUSES = ["IMPLEMENTED", "PARTIAL", "MISSING", "REDUNDANT", "PLANNED"] as const;
  const count = (f: (i: (typeof INVENTORY)[number]) => boolean) => INVENTORY.filter(f).length;
  const inv: string[] = [];
  inv.push("# Inventarul de design și producție", "");
  inv.push("Fișier generat din `src/inventory/inventory.ts` de `npm run docs` – nu îl edita de mână. Testul `tests/unit/inventory.test.ts` verifică fiecare trimitere la cod: un element „IMPLEMENTED” fără implementare reală pică testul.", "");
  inv.push("Priorități: **P0** esențial pentru un rezultat profesional · **P1** valoare mare · **P2** avansat · **P3** experimental / nișă.", "");
  inv.push("| Stare | Total | P0 | P1 | P2 | P3 |", "| --- | --- | --- | --- | --- | --- |");
  for (const s of STATUSES) inv.push(`| ${s} | ${count((i) => i.status === s)} | ${["P0", "P1", "P2", "P3"].map((p) => count((i) => i.status === s && i.priority === p)).join(" | ")} |`);
  inv.push(`| **toate** | **${INVENTORY.length}** | ${["P0", "P1", "P2", "P3"].map((p) => count((i) => i.priority === p)).join(" | ")} |`, "");
  for (const [area, title] of Object.entries(AREA_TITLES)) {
    const items = INVENTORY.filter((i) => i.area === area);
    if (!items.length) continue;
    inv.push(`## ${title} (${items.length})`, "", "| Element | Prioritate | Stare | Implementare | Ce lipsește / pasul următor |", "| --- | --- | --- | --- | --- |");
    for (const i of items) inv.push(`| ${i.name} | ${i.priority} | ${i.status} | ${i.refs.map((r) => `\`${r}\``).join(", ") || "—"} | ${[i.note, i.next ? `**Următorul pas:** ${i.next}` : ""].filter(Boolean).join(" ") || "—"} |`);
    inv.push("");
  }
  const usage = capabilityUsage();
  const unused = ALL_CAPABILITIES.filter((c) => !usage.has(c.id) && c.kind !== "transition" && c.kind !== "camera");
  inv.push("## Capabilități folosite de rețete", "");
  inv.push(`Din ${ALL_CAPABILITIES.length} capabilități, ${usage.size} sunt folosite direct de rețete; tranzițiile și camerele se aleg de gramatica de montaj și de direcții. Celelalte se folosesc doar când Claude le alege explicit în storyboard (suprascrieri), deci nu sunt „moarte”, dar nici nu intră automat:`, "");
  inv.push(unused.map((c) => `\`${c.id}\``).join(" · ") || "—", "");
  fs.writeFileSync(path.join(PATHS.root, "docs", "INVENTAR.md"), inv.join("\n"));
  console.log("Scris docs/INVENTAR.md");
}

// ─── registrul capabilităților de sistem (src/pipeline/graph.ts) ─────────────
{
  const { SYSTEM_CAPABILITIES } = await import("../src/pipeline/graph");
  const { CHECKS, PASSES } = await import("../src/quality/checks");
  const sys: string[] = [];
  sys.push("# Capabilitățile de sistem și bucla de calitate", "");
  sys.push("Fișier generat din `src/pipeline/graph.ts` și `src/quality/checks.ts` de `npm run docs`. Graful de dependențe (intrări → ieșiri) decide ce se recalculează după o schimbare.", "");
  sys.push("| Id | Domeniu | Ce face | Intrări → ieșiri | Implementare | Teste | Stare | Cost |", "| --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const c of SYSTEM_CAPABILITIES) sys.push(`| \`${c.id}\` v${c.version} | ${c.domain} | ${c.title}${c.notes ? ` (${c.notes})` : ""} | ${c.inputs.join(", ") || "—"} → ${c.outputs.join(", ")} | \`${c.implementation}\` | ${c.tests.map((t) => `\`${t}\``).join(", ") || "—"} | ${c.status} · încredere ${c.confidence} | ${c.cost} |`);
  sys.push("", "## Pasele buclei de calitate și verificările lor", "");
  for (const p of PASSES) {
    sys.push(`### Pasul ${p.n} – ${p.title}`, "", "| Verificare | Metodă | Categorii | Pe format |", "| --- | --- | --- | --- |");
    for (const c of CHECKS.filter((x) => x.pass === p.id)) sys.push(`| \`${c.id}\` – ${c.title} | ${c.method} | ${c.categories.join(", ")} | ${c.perFormat ? "da" : "nu (formatul principal)"} |`);
    sys.push("");
  }
  fs.writeFileSync(path.join(PATHS.root, "docs", "SISTEM.md"), sys.join("\n"));
  console.log("Scris docs/SISTEM.md");
}
