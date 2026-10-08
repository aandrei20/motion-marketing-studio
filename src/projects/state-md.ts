import fs from "node:fs";
import path from "node:path";
import { isClaimUsable, type Critique, type ProjectState, type Research, type VersionMeta } from "../core/schema";
import { PATHS } from "../core/paths";

const STEP_LABELS: Record<string, string> = {
  intake: "Întrebări (A–H) și brief",
  "brief-approval": "Brief aprobat („aprob”)",
  capture: "Captură reală (Playwright)",
  assets: "Materiale ingerate și analizate",
  research: "Research cu surse",
  brand: "Brand kit",
  script: "Script",
  storyboard: "Storyboard",
  compile: "Timeline compilat",
  audio: "Audio mixat și verificat",
  preview: "Preview randat",
  critique: "Critică (prag 8/10)",
  "user-listening": "Ascultare și note de la utilizator",
  "final-render": "Render final (doar după „render final”)",
};

const MARK: Record<string, string> = { done: "[x]", pending: "[ ]", skipped: "[-]", blocked: "[!]" };

function readOpt<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

/** Generează STATE.md din datele proiectului, ca o sesiune nouă să poată relua exact de unde s-a rămas. */
export function renderStateMarkdown(id: string): string {
  const dir = path.join(PATHS.projects, id);
  const project = readOpt<{ name: string; currentVersion: string | null; status: string; formats: { id: string }[] }>(
    path.join(dir, "project.json"),
  );
  const state = readOpt<ProjectState>(path.join(dir, "state.json"));
  const research = readOpt<Research>(path.join(dir, "research.json"));
  const versionsDir = path.join(dir, "versions");
  const versions: VersionMeta[] = fs.existsSync(versionsDir)
    ? fs
        .readdirSync(versionsDir)
        .map((v) => readOpt<VersionMeta>(path.join(versionsDir, v, "version.json")))
        .filter((v): v is VersionMeta => !!v)
        .sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)))
    : [];
  const cur = project?.currentVersion;
  const critique = cur ? readOpt<Critique>(path.join(versionsDir, cur, "critique.json")) : null;

  const lines: string[] = [];
  lines.push(`# STATE – ${project?.name ?? id}`, "");
  lines.push("Fișier generat automat din datele proiectului. Nu îl edita de mână; se rescrie după fiecare pas.", "");
  lines.push(`- Stare proiect: **${project?.status ?? "?"}**`);
  lines.push(`- Versiunea curentă: **${cur ?? "niciuna"}**`);
  lines.push(`- Formate: ${project?.formats.map((f) => f.id).join(", ") ?? "-"}`, "");

  lines.push("## Pași", "");
  if (state) {
    for (const [k, v] of Object.entries(state.steps)) {
      lines.push(`- ${MARK[v.state] ?? "[ ]"} ${STEP_LABELS[k] ?? k}${v.note ? ` – ${v.note}` : ""}`);
    }
  }
  lines.push("", "## Ce urmează", "");
  for (const n of state?.next ?? []) lines.push(`- ${n}`);

  lines.push("", "## Decizii", "");
  for (const d of (state?.decisions ?? []).slice(-30)) lines.push(`- ${d.at.slice(0, 16).replace("T", " ")} – ${d.text}`);

  const toConfirm = (research?.claims ?? []).filter((c) => c.status === "needs-confirmation");
  lines.push("", "## De confirmat (nu intră în video fără aprobarea ta)", "");
  if (!toConfirm.length) lines.push("- nimic");
  for (const c of toConfirm) lines.push(`- \`${c.id}\` ${c.text}`);
  const usable = (research?.claims ?? []).filter(isClaimUsable).length;
  lines.push("", `Afirmații utilizabile: ${usable} din ${research?.claims.length ?? 0}.`);

  lines.push("", "## Versiuni", "");
  for (const v of versions) {
    lines.push(
      `- **${v.id}**${v.parent ? ` (din ${v.parent})` : ""} – ${v.status}${v.frozen ? ", înghețată" : ""}${v.label ? ` – ${v.label}` : ""}`,
    );
    for (const c of v.changes.slice(-5)) lines.push(`  - ${c.description}`);
  }

  if (critique?.rounds.length) {
    const last = critique.rounds[critique.rounds.length - 1];
    lines.push("", `## Ultima critică (runda ${last.n}, ${last.reviewer})`, "");
    lines.push(`- Scorul minim pe scenă: ${last.minScene.toFixed(1)} (prag ${critique.threshold})`);
    const open = last.findings.filter((f) => f.status === "open");
    lines.push(`- Probleme deschise: ${open.length}`);
    for (const f of open.slice(0, 10)) lines.push(`  - ${f.timecode ?? "-"} [${f.severity}] ${f.problem}`);
  }

  lines.push("", "## Jurnal (ultimele 15)", "");
  for (const l of (state?.log ?? []).slice(-15)) lines.push(`- ${l.at.slice(0, 16).replace("T", " ")} – ${l.text}`);
  lines.push("");
  return lines.join("\n");
}
