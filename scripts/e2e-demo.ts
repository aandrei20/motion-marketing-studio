/**
 * Testul de acceptanță cap-coadă pe produsul demo FICTIV (examples/demo-product):
 * intrare → captură reală → research → brand → script → storyboard → voce → timeline → audio →
 * preview randat (MP4) → verificare (video, audio, validare) → critică.
 *
 * Rulează: npm run e2e            (proiectul „e2e-kolibri” în projects/)
 *          npm run e2e -- --fresh (șterge întâi proiectul de test e2e-kolibri, doar pe acesta)
 *          npm run e2e -- --auto  (script și storyboard generate automat, fără cele curate)
 *          npm run e2e -- --no-render (fără randare MP4)
 */
import fs from "node:fs";
import path from "node:path";
import { ingestFile } from "../src/assets/ingest";
import { listVoices } from "../src/audio/voice";
import { readJsonLoose } from "../src/core/json";
import { makeFormat } from "../src/core/formats";
import { PATHS } from "../src/core/paths";
import { Brief, Script, Storyboard } from "../src/core/schema";
import { validateScript } from "../src/creative/script";
import { critiqueRound } from "../src/pipeline/iterate";
import { approve, demoUrl, shutdown, stepAudio, stepBrand, stepCapture, stepCompile, stepPreview, stepScript, stepStoryboard, stepVoice } from "../src/pipeline/steps";
import { createProject, loadBrief, loadProject, loadResearch, projectDir, projectExists, saveBrief, saveScript, saveStoryboard, writableVersion } from "../src/projects/store";
import { setClaimStatus } from "../src/research/extract";

const ID = "e2e-kolibri";
const args = new Set(process.argv.slice(2));
const ex = path.join(PATHS.examples, "demo-product");
const log = (m: string) => console.log(m);
const t0 = Date.now();

async function main() {
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
  if (issues.some((i) => i.severity === "blocker")) throw new Error("Scriptul are blocaje.");

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

  if (!args.has("--no-render")) {
    for (const f of loadProject(ID).formats) {
      log(`8. Preview ${f.id}`);
      const r = await stepPreview(ID, v, f.id, log);
      log(`   ${path.relative(PATHS.root, r.file)} · ${r.check.frames} cadre analizate · ${r.check.problems.length ? r.check.problems.join(" ") : "fără cadre negre, flash-uri sau înghețări"}`);
      if (r.check.blackFrames.length || r.check.maxFlashesPerSec > 2) throw new Error("Verificarea video a eșuat.");
    }
  }
  log("9. Critică automată (rubrica fixă)");
  const cr = critiqueRound(ID, v);
  for (const [k, val] of Object.entries(cr.round.overall)) log(`   ${k.padEnd(10)} ${val}`);
  log(`   scor minim pe scenă: ${cr.round.minScene} – ${cr.decision.message}`);
  for (const f of cr.round.findings) log(`   ${f.timecode ?? "--"} [${f.severity}] ${f.problem}`);
  log(`\nGata în ${((Date.now() - t0) / 1000).toFixed(0)} s. Proiect: ${path.relative(PATHS.root, projectDir(ID))}`);
}

main()
  .then(() => shutdown())
  .catch(async (e) => {
    console.error(e);
    await shutdown();
    process.exit(1);
  });
