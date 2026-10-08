/**
 * Pachetul de revizuire vizuală pentru criticul multimodal (Claude în Claude Code sau, cu cheie, prin API):
 * cadrele-cheie deja randate (cache-ul buclei de calitate), foaia de contact, descrierea fiecărei scene,
 * problemele deja găsite automat (ca revizuirea să se concentreze pe ce nu se măsoară) și schema JSON a
 * răspunsului. Răspunsul se adaugă cu `mms review <id> --file review.json` (reviewer „claude-visual”).
 *
 * Nu randează video: refolosește cadrele existente; randează doar cadrele-cheie lipsă.
 */
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { formatTimecode } from "../core/time";
import { projectPublicPath } from "../core/paths";
import { READABLE_TEXT_CAPS } from "../motion/text-caps";
import { ReviewInput } from "../pipeline/iterate";
import { loadProject, loadTimeline, projectDir, versionFile } from "../projects/store";
import { renderContactSheet } from "../renderer/node/render";
import { keyStills, loadQualityRun } from "../quality/run";

/** Ce trebuie căutat vizual (cerința 11 a studioului); mașina acoperă deja contrastul, timpii și zonele. */
export const VISUAL_CHECKLIST = [
  "compoziție slabă, încadrare greșită, subiect prea mic sau tăiat",
  "ierarhie vizuală neclară (ce vezi întâi?)",
  "spațiu gol fără rost, sau dimpotrivă cadru aglomerat",
  "text prea mic, prea mult text, text greu de citit pe fundal",
  "interfață ilizibilă (funcția nu se vede)",
  "mișcare repetitivă, artificială sau fără motiv; tranziții inutile",
  "ritm: prea rapid / prea lent; scene fără eveniment vizual",
  "hook slab, punct culminant slab, recompensă slabă, CTA slab, final stângaci",
  "spațieri inconsecvente, mișcare inconsecventă între scene",
  "inconsecvențe de brand (culori, fonturi, logo deformat sau recolorat)",
  "ritmul vizual de ansamblu (contrast între scene calme și active)",
];

export interface CritiquePack {
  dir: string;
  request: string;
  schema: string;
  contactSheet: string;
  frames: Array<{ sceneId: string; file: string; timecode: string }>;
  rendered: number;
}

export async function critiquePack(projectId: string, o: { versionId?: string; formatId?: string; log?: (m: string) => void } = {}): Promise<CritiquePack> {
  const project = loadProject(projectId);
  const versionId = o.versionId ?? project.currentVersion!;
  const fid = o.formatId ?? project.formats[0].id;
  const t = loadTimeline(projectId, versionId, fid);
  const ks = await keyStills(projectId, t, { log: o.log });
  const dir = versionFile(projectId, versionId, `review/${fid}`);
  fs.mkdirSync(dir, { recursive: true });
  const frames = ks.stills.map((s) => {
    const dst = path.join(dir, `${s.sceneId}.jpg`);
    fs.copyFileSync(s.file, dst);
    return { sceneId: s.sceneId, file: dst, timecode: formatTimecode(s.frame, t.fps) };
  });
  const cell = t.width > t.height ? { w: 320, h: 180 } : t.width === t.height ? { w: 240, h: 240 } : { w: 180, h: 320 };
  const sheet = await renderContactSheet(
    frames.map((f) => projectPublicPath(projectId, path.relative(projectDir(projectId), f.file).replace(/\\/g, "/"))),
    frames.map((f) => `${f.timecode} ${f.sceneId}`),
    path.join(dir, "contact.png"),
    { cols: Math.min(frames.length, t.width > t.height ? 4 : 7), cellWidth: cell.w, cellHeight: cell.h, title: `${project.name} · ${versionId} · ${fid} · cadre-cheie` },
  );
  const previewSheet = versionFile(projectId, versionId, `renders/contact-${fid}.png`);
  const run = loadQualityRun(projectId, versionId);
  const auto = (run?.issues ?? []).filter((f) => !f.formatId || f.formatId === fid);
  const lines: string[] = [
    `# Revizuire vizuală – ${project.name} · ${versionId} · ${fid}`,
    "",
    `Format ${t.width}×${t.height} @ ${t.fps} fps · ${(t.durationInFrames / t.fps).toFixed(1)} s · ${t.scenes.length} scene.`,
    "",
    "Privește imaginile de mai jos (Read pe fiecare fișier) și judecă ce nu se poate măsura automat. Nu repeta problemele deja găsite (lista de la final). Fii concret: secunda, scena, ce vezi, de ce contează, ce ai schimba.",
    "",
    `- Foaia de contact (cadre-cheie): \`${sheet}\``,
    ...(fs.existsSync(previewSheet) ? [`- Foaia de contact a preview-ului (2 cadre/s, pentru ritm și mișcare): \`${previewSheet}\``] : []),
    "",
    "## Scenele",
    "",
  ];
  for (const s of t.scenes) {
    const f = frames.find((x) => x.sceneId === s.id);
    const texts = s.layers.filter((l) => READABLE_TEXT_CAPS.has(l.capability)).map((l) => `„${String(l.params.text ?? "")}”`);
    lines.push(
      `### ${s.id} · ${formatTimecode(s.from, t.fps)}–${formatTimecode(s.from + s.durationInFrames, t.fps)} · ${s.meta.narrativeRole}`,
      "",
      `- Scop: ${s.meta.purpose}`,
      `- Rețetă: ${s.meta.recipe} · cadru: ${s.meta.shot} · energie ${s.meta.energy} · tranziție de intrare: ${s.transitionIn?.capability ?? "—"} · cameră: ${s.camera.keys.length > 1 ? `zoom ${s.camera.keys[0].zoom.toFixed(2)}→${s.camera.keys[s.camera.keys.length - 1].zoom.toFixed(2)}` : "fixă"}`,
      `- Text pe ecran: ${texts.join(", ") || "—"}`,
      ...(f ? [`- Cadrul-cheie (${f.timecode}): \`${f.file}\``] : []),
      "",
    );
  }
  lines.push("## Ce să cauți", "", ...VISUAL_CHECKLIST.map((x) => `- ${x}`), "", `## Deja găsite automat (${auto.length})`, "");
  for (const f of auto.slice(0, 60)) lines.push(`- ${f.timecode ?? "--"} [${f.severity}] ${f.category}/${f.dimension}${f.sceneId ? ` (${f.sceneId})` : ""}: ${f.problem}`);
  lines.push(
    "",
    "## Răspunsul",
    "",
    "Scrie un fișier JSON după `review-schema.json` (alături), de exemplu:",
    "",
    "```json",
    JSON.stringify({ reviewer: "claude-visual", findings: [{ sec: 4.2, dimension: "composition", severity: "medium", problem: "Captura e lipită de marginea de jos; titlul plutește sus.", whyItMatters: "Cadrul pare neterminat și ochiul nu are un punct de sprijin.", recommendation: "Coboară titlul lângă captură sau mărește captura cu 15%.", confidence: 0.8, suggestedFix: [] }], sceneScores: [] }, null, 2),
    "```",
    "",
    `Apoi: \`npm run mms -- review ${projectId} --version ${versionId} --file review.json\`. Observațiile mari deschise blochează verdictul PASS până se rezolvă.`,
  );
  const request = path.join(dir, "review-request.md");
  fs.writeFileSync(request, lines.join("\n"), "utf8");
  const schema = path.join(dir, "review-schema.json");
  fs.writeFileSync(schema, JSON.stringify(z.toJSONSchema(ReviewInput, { io: "input" }), null, 2));
  return { dir, request, schema, contactSheet: sheet, frames, rendered: ks.rendered };
}
