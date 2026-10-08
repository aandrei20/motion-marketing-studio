/**
 * Testul de acceptanță cap-coadă pe produsul demo FICTIV (examples/demo-product):
 * intrare → captură reală → research → brand → script → storyboard → voce → timeline → audio →
 * bucla de calitate adaptivă (fără randare / cadre-cheie) → [corecturi automate] → un singur preview
 * randat pentru om (MP4) → final QA pe video.
 *
 * Rulează: npm run e2e            (proiectul „e2e-kolibri” în projects/)
 *          npm run e2e -- --fresh (șterge întâi proiectul de test e2e-kolibri, doar pe acesta)
 *          npm run e2e -- --auto  (script și storyboard generate automat, fără cele curate)
 *          npm run e2e -- --no-render (fără randare: bucla de calitate la adâncimea fast)
 *          npm run e2e -- --autofix   (plus corecturile automate, cu rollback)
 */
import fs from "node:fs";
import path from "node:path";
import { ingestFile, updateAsset } from "../src/assets/ingest";
import { listVoices } from "../src/audio/voice";
import { readJsonLoose } from "../src/core/json";
import { makeFormat } from "../src/core/formats";
import { PATHS } from "../src/core/paths";
import { Brief, Script, Storyboard } from "../src/core/schema";
import { validateScript } from "../src/creative/script";
import { runQuality } from "../src/quality/run";
import { autoFixLoop } from "../src/quality/autofix";
import { approve, demoUrl, shutdown, stepAudio, stepBrand, stepCapture, stepCompile, stepScript, stepStoryboard, stepVoice } from "../src/pipeline/steps";
import { createProject, loadAssets, loadBrief, loadProject, loadResearch, projectDir, projectExists, saveBrief, saveScript, saveStoryboard, writableVersion } from "../src/projects/store";
import { setClaimStatus } from "../src/research/extract";

const ex = path.join(PATHS.examples, "demo-product");

export interface E2EOptions {
  id?: string;
  fresh?: boolean;
  auto?: boolean;
  render?: boolean;
  autofix?: boolean;
  log?: (m: string) => void;
}

export async function runE2E(o: E2EOptions = {}): Promise<{ id: string; versionId: string; finalVersion: string }> {
  const ID = o.id ?? "e2e-kolibri";
  const args = new Set([o.fresh ? "--fresh" : "", o.auto ? "--auto" : "", o.render === false ? "--no-render" : "", o.autofix ? "--autofix" : ""]);
  const log = o.log ?? ((m: string) => console.log(m));
  const t0 = Date.now();
  if (projectExists(ID)) {
    if (!args.has("--fresh")) throw new Error(`Proiectul de test ${ID} există. Rulează cu --fresh ca să-l refaci.`);
    fs.rmSync(projectDir(ID), { recursive: true, force: true });
  }
  log("1. Proiect, brief, aprobare (fixture)");
  createProject({
    id: ID,
    name: "Kolibri – reclamă de test",
    product: { name: "Kolibri", url: demoUrl("index.html"), category: "productivity", oneLiner: "Produs FICTIV pentru testul studioului." },
    formats: [makeFormat("9x16", { platform: "tiktok", durationSec: 24, fps: 30 }), makeFormat("16x9", { platform: "youtube", durationSec: 24, fps: 30 })],
    language: { text: "ro", voice: "ro" },
    seed: 7,
  });
  const brief = Brief.parse(readJsonLoose(path.join(ex, "brief.json")));
  const voices = await listVoices();
  if (!voices.some((v) => v.provider === "windows" && v.name.includes("Andrei"))) {
    log("   ! Vocea „Microsoft Andrei” nu e instalată: testul continuă fără voce.");
    brief.audio.voice = { mode: "none", rate: 1 };
  }
  saveBrief(ID, brief);
  approve(ID, "brief", "aprob");

  log("2. Captură reală a produsului demo + research + materiale");
  await stepCapture(
    ID,
    [
      { id: "landing", url: demoUrl("index.html"), viewport: "desktop" },
      { id: "landing-full", url: demoUrl("index.html"), viewport: "desktop", fullPage: true },
      { id: "app", url: demoUrl("app.html"), viewport: "desktop", research: false },
      { id: "app-search", url: demoUrl("app.html"), viewport: "desktop", research: false, record: { steps: [{ action: "wait", ms: 900 }, { action: "type", selector: "#search", text: "raport", delayMs: 210 }, { action: "wait", ms: 2600 }], fps: 30, tailMs: 400 } },
    ],
    log,
  );
  await ingestFile(ID, path.join(ex, "site", "logo.svg"), { origin: "user_provided", role: "logo", tags: ["logo"] });
  // datele personale găsite (nume din salut, email): în produsul demo sunt fictive; „utilizatorul” decide să rămână vizibile
  for (const a of loadAssets(ID).assets.filter((x) => x.pii.regions.length)) {
    updateAsset(ID, a.id, { keepApproved: true, notes: "Date personale fictive (produs demo): rămân vizibile." });
    log(`   date personale în ${a.id}: ${a.pii.regions.map((r) => r.label).join("; ")} → rămân vizibile (fictive)`);
  }
  // fraza obligatorie conține o cifră („5 minute”): „utilizatorul” o confirmă explicit
  setClaimStatus(ID, "c-poz-planifica-saptamana-in-5-minute-", "approved-by-user", "Promisiunea oficială a produsului de test.");
  log(`   ${loadResearch(ID).claims.length} afirmații, ${loadResearch(ID).claims.filter((c) => c.status === "needs-confirmation").length} de confirmat`);

  log("3. Brand kit din captură");
  stepBrand(ID).notes.forEach((n) => log(`   ${n}`));

  log("4. Script și storyboard");
  if (args.has("--auto")) {
    stepScript(ID);
    stepStoryboard(ID).rationale.forEach((r) => log(`   ${r}`));
  } else {
    const v = writableVersion(ID, [{ at: new Date().toISOString(), op: "creative", description: "Script și storyboard scrise de directorul creativ.", params: {} }]);
    saveScript(ID, v, Script.parse(readJsonLoose(path.join(ex, "script.json"))));
    saveStoryboard(ID, v, Storyboard.parse(readJsonLoose(path.join(ex, "storyboard.json"))));
  }
  const v = loadProject(ID).currentVersion!;
  const issues = validateScript(Script.parse(readJsonLoose(path.join(projectDir(ID), "versions", v, "script.json"))), loadBrief(ID), loadResearch(ID));
  for (const i of issues) log(`   script [${i.severity}] ${i.message}`);
  if (issues.some((i) => i.severity === "critical")) throw new Error("Scriptul are blocaje.");

  log("5. Voce");
  await stepVoice(ID, v, log);
  log("6. Timeline (toate formatele) + validare");
  const c = await stepCompile(ID, v, log);
  c.warnings.forEach((w) => log(`   ! ${w}`));
  for (const [f, val] of Object.entries(c.validation)) {
    for (const x of val.findings) log(`   [${f}] ${x.timecode ?? "--"} ${x.severity} ${x.problem}`);
    if (!val.ok) throw new Error(`Validarea ${f} are blocaje.`);
  }
  log("7. Audio");
  const mix = await stepAudio(ID, v, log);
  log(`   ${mix.integratedLufs} LUFS, TP ${mix.truePeakDbtp} dBTP, ${mix.ok ? "OK" : mix.problems.join("; ")}`);
  if (!mix.ok) throw new Error("Mixul audio nu trece verificarea.");

  // 8. Bucla de calitate adaptivă: fără randare (fast) sau cu cadre-cheie (standard), fără video întreg
  const depth = args.has("--no-render") ? "fast" : "standard";
  log(`8. Calitate (adâncime ${depth}: ${depth === "fast" ? "fără randare" : "cadre-cheie, fără video întreg"})`);
  const q = await runQuality(ID, { versionId: v, depth, log: (m) => log(`   ${m}`) });
  log(`   scor ${q.run.score.overall}/100 · ${q.run.score.verdict} · rubrica: minim ${q.round.minScene}/10 – ${q.decision.message}`);
  for (const x of q.run.issues.slice(0, 25)) log(`   ${x.timecode ?? "--"} [${x.severity}] ${x.category}: ${x.problem}`);
  let finalVersion = v;
  if (args.has("--autofix")) {
    log("9. Corecturi automate (cu rollback)");
    const fx = await autoFixLoop(ID, { depth, log: (m) => log(`   ${m}`) });
    finalVersion = fx.finalVersion;
    log(`   ${fx.startVersion} → ${fx.finalVersion}: ${fx.finalScore.overall}/100 · ${fx.stopReason}`);
  }
  if (!args.has("--no-render")) {
    log("10. Preview pentru om (un singur video pe format, sau refolosit) + final QA pe video");
    const fin = await runQuality(ID, { versionId: finalVersion, depth: "final", log: (m) => log(`   ${m}`) });
    for (const fid of fin.run.formats) {
      const chk = JSON.parse(fs.readFileSync(path.join(projectDir(ID), "versions", finalVersion, "renders", `check-${fid}.json`), "utf8")) as { frames: number; blackFrames: number[]; maxFlashesPerSec: number; problems: string[] };
      log(`   [${fid}] ${chk.frames} cadre analizate · ${chk.problems.length ? chk.problems.join(" ") : "fără cadre negre, flash-uri sau înghețări"}`);
      if (chk.blackFrames.length || chk.maxFlashesPerSec > 2) throw new Error("Verificarea video a eșuat.");
    }
    log(`   final QA: ${fin.run.score.overall}/100 · ${fin.run.score.verdict} · video randat ${fin.run.renders.fullRendered}, refolosit ${fin.run.renders.fullReused}`);
  }
  log(`\nGata în ${((Date.now() - t0) / 1000).toFixed(0)} s. Proiect: ${path.relative(PATHS.root, projectDir(ID))}`);
  return { id: ID, versionId: v, finalVersion };
}

if (process.argv[1] && /e2e-demo\.ts$/.test(process.argv[1])) {
  const a = new Set(process.argv.slice(2));
  runE2E({ fresh: a.has("--fresh"), auto: a.has("--auto"), render: !a.has("--no-render"), autofix: a.has("--autofix") })
    .then(() => shutdown())
    .catch(async (e) => {
      console.error(e);
      await shutdown();
      process.exit(1);
    });
}
