/**
 * Testul cap-coadă pe un produs REAL (un site public, dat la rulare), ca studioul să nu fie verificat doar
 * pe produsul demo fictiv. Codul nu conține niciun nume de produs: adresa vine din linia de comandă.
 *
 *   npm run e2e:real -- --url https://… [--id e2e-real] [--fresh] [--no-render] [--lang ro] [--duration 20]
 *                       [--vision "…"] [--max-pages 4]
 *
 * Flux: intake inteligent pe pagina reală → proiect + brief dedus → aprobarea de test → captură reală
 * (pagina vizibilă, pagina întreagă) → research pe site → brand → concepte → producția cu bucla de calitate
 * (cadre-cheie, corecturi automate, un singur preview, final QA).
 *
 * Site-ul e al altcuiva: capturile intră ca materiale ale unui terț, cu drepturi neconfirmate. Reclama iese
 * deci marcată „concept”, iar exportul final rămâne blocat (regula 3); testul verifică asta. Datele personale
 * găsite se estompează. Prețurile și cifrele rămân „de confirmat” și nu intră în video (regula 5).
 * Aprobarea brief-ului e a testului (proiect de test, fără export); o reclamă reală cere „aprob” de la om.
 */
import fs from "node:fs";
import path from "node:path";
import { updateAsset } from "../src/assets/ingest";
import { listVoices } from "../src/audio/voice";
import { capture } from "../src/capture/capture";
import { MmsError } from "../src/core/errors";
import { PATHS } from "../src/core/paths";
import { Brief } from "../src/core/schema";
import { inferIntake, intakeSummaryMarkdown, projectFromIntake } from "../src/creative/smart-intake";
import { produce } from "../src/pipeline/produce";
import { loadQualityRun } from "../src/quality/run";
import { approve, shutdown, stepBrand, stepCapture, stepFinalRender } from "../src/pipeline/steps";
import { createProject, loadAssets, loadProject, loadResearch, loadTimeline, projectDir, projectExists, saveBrief } from "../src/projects/store";
import { crawlSite } from "../src/research/crawl";
import { claimGraph } from "../src/research/graph";

export interface RealE2EOptions {
  url: string;
  id?: string;
  fresh?: boolean;
  render?: boolean;
  lang?: string;
  durationSec?: number;
  vision?: string;
  maxPages?: number;
  log?: (m: string) => void;
}

export async function runRealE2E(o: RealE2EOptions): Promise<{ id: string; versionId: string; concept: boolean; verdict: string; score: number }> {
  const ID = o.id ?? "e2e-real";
  const log = o.log ?? ((m: string) => console.log(m));
  const t0 = Date.now();
  if (!/^https?:\/\//.test(o.url))
    throw new MmsError("ARG_MISSING", "Lipsește adresa site-ului real (--url https://…).", "Ex.: npm run e2e:real -- --url https://exemplu.ro");
  if (!ID.startsWith("e2e-"))
    throw new MmsError(
      "ARG_INVALID",
      `Proiectul de test trebuie să înceapă cu „e2e-” (primit: ${ID}).`,
      "Testul șterge proiectul cu --fresh; numele protejează proiectele reale.",
    );
  if (projectExists(ID)) {
    if (!o.fresh) throw new MmsError("PROJECT_EXISTS", `Proiectul de test ${ID} există.`, "Rulează cu --fresh ca să-l refaci.");
    fs.rmSync(projectDir(ID), { recursive: true, force: true });
  }

  log(`1. Intake inteligent pe pagina reală: ${o.url}`);
  const intakeDir = path.join(PATHS.cache, "intake", Buffer.from(o.url).toString("hex").slice(0, 24));
  const page = (await capture({ id: "intake", url: o.url, viewport: "desktop", research: true }, intakeDir)).page;
  const lang = o.lang ?? "ro";
  const r = inferIntake(
    {
      url: o.url,
      vision: o.vision,
      formats: ["9x16", "16x9"],
      textLanguage: lang,
      voiceLanguage: lang,
      durationSec: o.durationSec ?? 20,
      voices: await listVoices(),
    },
    page,
  );
  for (const line of intakeSummaryMarkdown(r).split("\n").filter(Boolean)) log(`   ${line}`);
  createProject(projectFromIntake(ID, r));
  saveBrief(ID, Brief.parse(r.brief));
  approve(ID, "brief", "aprob");
  log("   brief aprobat de test (proiect de test, fără export final)");

  log("2. Captură reală (material al unui terț: drepturi neconfirmate)");
  await stepCapture(
    ID,
    [
      { id: "landing", url: o.url, viewport: "desktop" },
      { id: "landing-full", url: o.url, viewport: "desktop", fullPage: true, research: false },
    ],
    (m) => log(`   ${m}`),
    { thirdParty: true },
  );
  for (const a of loadAssets(ID).assets.filter((x) => x.pii.regions.length)) {
    updateAsset(ID, a.id, { blurApproved: true });
    log(`   date personale în ${a.id}: ${a.pii.regions.map((x) => x.label).join("; ")} → se estompează`);
  }

  log(`3. Research pe site (maximum ${o.maxPages ?? 4} pagini) și graful de afirmații`);
  const crawl = await crawlSite(ID, o.url, { max: o.maxPages ?? 4, log: (m) => log(`   ${m}`) });
  const g = claimGraph(loadResearch(ID));
  log(
    `   ${crawl.pages.length} pagini citite, ${crawl.skipped.length} ocolite · ${g.stats.claims} afirmații din ${g.stats.sources} surse, ${g.stats.usable} utilizabile, ${g.stats.needsConfirmation} de confirmat, ${g.stats.corroborated} coroborate, ${g.stats.conflicts} conflicte`,
  );

  log("4. Brand kit din captura reală");
  stepBrand(ID).notes.forEach((n) => {
    log(`   ${n}`);
  });

  log("5. Producția cu bucla de calitate (concept → script → storyboard → voce → timeline → mix → calitate → corecturi → preview)");
  const rep = await produce(ID, { depth: "standard", autofix: true, preview: o.render !== false, log: (m) => log(`   ${m}`), stage: (s) => log(`   — ${s}`) });
  const v = loadProject(ID).currentVersion!;
  const run = rep.final ?? loadQualityRun(ID, v) ?? rep.first;
  log(
    `   ${v}: ${run.score.overall}/100 · ${run.score.verdict} · critice ${run.score.counts.critical}, mari ${run.score.counts.high}, medii ${run.score.counts.medium}, mici ${run.score.counts.low}`,
  );
  for (const x of run.issues.slice(0, 20)) log(`   ${x.timecode ?? "--"} [${x.severity}] ${x.category}: ${x.problem}`);

  log("6. Poarta de drepturi și exportul final");
  const concept = run.formats.every((f) => loadTimeline(ID, v, f).concept);
  log(`   marcaj „concept” pe toate formatele: ${concept ? "da" : "NU"}`);
  if (!concept) throw new Error("Capturile unui terț fără drepturi confirmate trebuiau să marcheze reclama „concept”.");
  let blocked = false;
  try {
    await stepFinalRender(ID, v, null, () => undefined);
  } catch (e) {
    blocked = true;
    log(`   exportul final e refuzat: ${(e as Error).message.split("\n")[0]}`);
  }
  if (!blocked) throw new Error("Exportul final nu trebuia să pornească fără „render final” și fără drepturi.");

  log(`\nGata în ${Math.round((Date.now() - t0) / 1000)} s. Proiect: ${path.relative(PATHS.root, projectDir(ID))}`);
  return { id: ID, versionId: v, concept, verdict: run.score.verdict, score: run.score.overall };
}

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

if (process.argv[1] && /e2e-real.ts$/.test(process.argv[1])) {
  runRealE2E({
    url: flag("url") ?? "",
    id: flag("id"),
    fresh: process.argv.includes("--fresh"),
    render: !process.argv.includes("--no-render"),
    lang: flag("lang"),
    durationSec: flag("duration") ? Number(flag("duration")) : undefined,
    vision: flag("vision"),
    maxPages: flag("max-pages") ? Number(flag("max-pages")) : undefined,
  })
    .then(() => shutdown())
    .catch(async (e) => {
      console.error(e instanceof MmsError ? `${e.message}\n→ ${e.hint ?? ""}` : e);
      await shutdown();
      process.exit(1);
    });
}
