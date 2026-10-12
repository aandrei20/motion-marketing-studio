#!/usr/bin/env node
/**
 * mms – linia de comandă a Motion Marketing Studio.
 * Folosire: npm run mms -- <comandă> [argumente]   (sau: npx tsx src/cli/index.ts <comandă>)
 */
import fs from "node:fs";
import path from "node:path";
import { ingestFile, setRights, updateAsset } from "../assets/ingest";
import { listVoices } from "../audio/voice";
import { SFX } from "../audio/sfx";
import { formatError, MmsError } from "../core/errors";
import { makeFormat, FORMAT_PRESETS, type FormatPresetId } from "../core/formats";
import { readJsonLoose } from "../core/json";
import { PATHS } from "../core/paths";
import { Brief, RightsStatus, type AssetRole, type FormatSpec, type ProductCategory } from "../core/schema";
import { intakeMarkdown } from "../creative/intake";
import { inferIntake, intakeSummaryMarkdown, projectFromIntake } from "../creative/smart-intake";
import { listTemplates } from "../creative/templates";
import { addReview, hookVariants, iterate } from "../pipeline/iterate";
import { produce } from "../pipeline/produce";
import { impactBetween } from "../pipeline/impact";
import { runQuality, type QualityRun } from "../quality/run";
import { autoFixLoop } from "../quality/autofix";
import type { Depth } from "../quality/checks";
import { applyEdit, redo, undo } from "../editing/history";
import { critiquePack } from "../critique/pack";
import { chooseConcept, ensureConcepts } from "../creative/concepts";
import { approve, demoUrl, shutdown, writePostPack, stepAudio, stepBrand, stepCapture, stepCompile, stepFinalRender, stepPreview, stepScript, stepStoryboard, stepVoice } from "../pipeline/steps";
import { createProject, createVersion, listProjects, listVersions, loadAssets, loadProject, loadResearch, projectDir, saveBrief } from "../projects/store";
import { analyzeReference, saveReferenceProfile } from "../references/analyze";
import { addUserClaim, setClaimStatus } from "../research/extract";
import { crawlSite } from "../research/crawl";
import { claimGraph } from "../research/graph";
import { ALL_CAPABILITIES } from "../motion/registry";
import { RECIPES } from "../recipes/recipes";
import { CaptureStep, capture, interactiveLogin, type CaptureRequestInput } from "../capture/capture";
import { z } from "zod";

interface Args {
  _: string[];
  flags: Record<string, string | boolean | string[]>;
}

function parseArgs(argv: string[]): Args {
  const a: Args = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t.startsWith("--")) {
      const [k, inline] = t.slice(2).split("=", 2);
      const next = argv[i + 1];
      const v = inline ?? (next !== undefined && !next.startsWith("--") ? (i++, next) : true);
      const prev = a.flags[k];
      a.flags[k] = prev === undefined ? v : Array.isArray(prev) ? [...prev, String(v)] : [String(prev), String(v)];
    } else a._.push(t);
  }
  return a;
}

const str = (v: unknown, d?: string): string | undefined => (typeof v === "string" ? v : Array.isArray(v) ? String(v[v.length - 1]) : d);
const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : typeof v === "string" ? [v] : []);
const log = (m: string) => console.log(m);

function need(v: string | undefined, what: string): string {
  if (!v) throw new MmsError("ARG_MISSING", `Lipsește ${what}.`, "Vezi: npm run mms -- help");
  return v;
}

/** „9x16:tiktok:30:30” → format (preset:platformă:durată:fps) sau „1200x800:generic:20:24”. */
function parseFormat(spec: string): FormatSpec {
  const [dims, platform = "generic", dur = "30", fps = "30"] = spec.split(":");
  const preset = dims in FORMAT_PRESETS ? (dims as FormatPresetId) : (() => {
    const m = dims.match(/^(\d+)x(\d+)$/);
    if (!m) throw new MmsError("FORMAT_INVALID", `Format invalid: ${spec}`, "Ex.: 9x16:tiktok:30:30 sau 1200x800:generic:20:24");
    return { width: Number(m[1]), height: Number(m[2]) };
  })();
  return makeFormat(preset, { platform: platform as FormatSpec["platform"], durationSec: Number(dur), fps: Number(fps) });
}

const HELP = `
mms – Motion Marketing Studio

PROIECT
  list                                   proiectele existente
  new <id> --name "…" --product "…" --category saas [--url https://…]
          --format 9x16:tiktok:30:30 [--format 16x9:youtube:30:30] --text-lang ro --voice-lang ro
  intake --url <u> --vision "…" --format 9x16 --lang ro [--duration 30] [--create <id>]
                                         intake inteligent: deduce din site ce se poate, întreabă doar restul
  questions                              întrebările de început (A–H)
  brief <id> --file brief.json           salvează brief-ul (validat)
  approve <id> brief "aprob"             aprobă brief-ul (lucrul începe abia după)
  status <id>                            STATE.md (ce e făcut, ce urmează)

MATERIALE ȘI RESEARCH
  capture <id> --url <u> [--id nume] [--viewport desktop|laptop|tablet|mobile] [--full]
          [--wait 2000] [--click "#selector"] [--type "#selector=text"] [--hide "#cookie,.banner"]
          [--steps pasi.json] [--record] [--profile nume] [--no-research] [--third-party] [--no-mobile]
                                         cu format vertical, fiecare captură desktop primește și varianta
                                         de telefon (<id>-mobile), folosită automat pe 9:16 și 4:5
  capture <id> --demo                    capturează produsul demo inclus (pentru test)
  login --url <u> --profile <nume>       deschide un browser; te autentifici tu, sesiunea rămâne local
  add-asset <id> <fișier> [--role logo|screenshot|music|…] [--tag nume] [--third-party] [--rights confirmed|not-confirmed|denied] [--origin user_provided|stock|generated]
  rights <id> <assetId> confirmed|not-confirmed|denied
  rights <id> --source <site> confirmed|…  toate capturile unui site (desktop, telefon, logo-ul din pagină)
  pii <id> <assetId> blur|keep           datele personale din captură: estompează sau lasă vizibile
  focus <id> <assetId> <x> <y>           punct focal (0..1)
  blur-ok <id> <assetId>                 acord pentru estomparea datelor personale
  reference <id> <assetId>               profilul unui video de referință
  research <id>                          sursele și afirmațiile
  research-crawl <id> [--url u] [--max 6] [--competitor u] [--third-party]
                                         citește paginile relevante ale site-ului (paginile devin materiale)
  claims <id>                            graful de afirmații: dovadă, sursă, încredere, coroborare, conflicte
  claim <id> <claimId> approved|rejected|verified
  add-claim <id> "text" --category feature --source "titlul sursei"
  brand <id> [--force]                   brand kit din captură și logo

PRODUCȚIE
  concepts <id> [--force]                conceptele creative (teritorii din dovezi, scor pe 10 criterii)
  concept <id> <conceptId>               alege conceptul (al tău are prioritate implicit)
  script <id> [--force]                  schița de script (din fapte + cuvintele tale)
  storyboard <id> [--template saas] [--force]
  voices                                 vocile TTS disponibile
  voice <id>                             sinteza vocii
  compile <id>                           timeline-ul pentru toate formatele + validare
  audio <id>                             muzică, efecte, voce, mix (−14 LUFS, ≤ −1 dBTP)
  preview <id> [--format 9x16] [--from 0 --to 150]
  make <id> [--depth standard] [--no-autofix] [--skip-preview]
                                         script → storyboard → voce → timeline → mix → bucla de calitate
                                         → corecturi automate → un singur preview la predare
  quality <id> [--depth fast|standard|deep|final] [--format 9x16] [--version v3] [--force]
                                         bucla de calitate adaptivă: 10 pase, metoda cea mai ieftină, cache
  critique <id> [--format 9x16]          aceeași buclă la adâncimea „fast” (fără randare)
  autofix <id> [--depth standard] [--max 3]   corecturi automate sigure, cu rollback
  impact <id> [--from v2] [--to v3]      ce s-a schimbat între versiuni și ce trebuie refăcut
  edit <id> --op '{"op":"scene-extend","sceneId":"s2-hook","deltaSec":0.5}' [--file ops.json] [--no-compile]
  undo <id> | redo <id>                  anulează / reface ultima editare din versiunea curentă
  critique-pack <id> [--version v3] [--format 9x16]
                                         cadre-cheie + foaie de contact + cerere de revizuire vizuală (Claude)
  review <id> --file review.json         observațiile lui Claude / notele tale (secunda X: problema)
  iterate <id> "la 00:14 zoom pe câmpul de căutare"
  hook-variants <id> [--count 2] [--from v2]   câte o versiune pentru fiecare variantă de hook din script
  post-pack <id> [--version v3] [--format 9x16] copertă + text de postare (și automat la exportul final)
  new-version <id> [--label "…"]
  versions <id>
  approve <id> render-final "render final" --version v3
  render <id> --final [--version v3] [--format 9x16]

BIBLIOTECĂ
  catalog                                capabilitățile din registry
  recipes | templates | sfx
  studio                                 pornește Studio-ul (interfața web locală)
  remotion-studio [<id>] [--version v1] [--format 9x16]

ÎNTREȚINERE
  cache [--prune]                        mărimea cache-ului; --prune șterge bundle-urile vechi de randare
  usage [<id>]                           jurnalul operațiilor: voci (plătite / locale / din cache), randări
`;

async function main(): Promise<void> {
  const a = parseArgs(process.argv.slice(2));
  const cmd = a._[0] ?? "help";
  const id = a._[1];
  switch (cmd) {
    case "help":
    case "--help":
      console.log(HELP);
      return;
    case "list":
      for (const p of listProjects()) console.log(`${p.id.padEnd(24)} ${p.status.padEnd(16)} ${p.currentVersion ?? "-"}  ${p.name}`);
      return;
    case "new": {
      const formats = list(a.flags.format).map(parseFormat);
      if (!formats.length) formats.push(parseFormat("9x16:tiktok:30:30"));
      const p = createProject({
        id: need(id, "id-ul proiectului"),
        name: str(a.flags.name) ?? id!,
        product: { name: need(str(a.flags.product), "--product"), url: str(a.flags.url), category: (str(a.flags.category) ?? "saas") as ProductCategory, oneLiner: str(a.flags["one-liner"]) },
        formats,
        language: { text: str(a.flags["text-lang"]) ?? null, voice: str(a.flags["voice-lang"]) ?? null },
        seed: Number(str(a.flags.seed) ?? 1),
      });
      log(`Proiect creat: ${path.relative(PATHS.root, projectDir(p.id))}`);
      return;
    }
    case "intake": {
      // intake inteligent: deduce din pagina reală tot ce se poate și întreabă doar ce e incert și important
      const url = str(a.flags.url);
      let page = null;
      if (url) {
        const dir = path.join(PATHS.cache, "intake", Buffer.from(url).toString("hex").slice(0, 24));
        log(`Citesc pagina (captură reală, fără proiect): ${url}`);
        page = (await capture({ id: "intake", url, viewport: "desktop", research: true }, dir)).page;
      }
      const r = inferIntake({ url, vision: str(a.flags.vision), formats: list(a.flags.format), textLanguage: str(a.flags.lang) ?? null, voiceLanguage: str(a.flags["voice-lang"]) ?? null, durationSec: a.flags.duration ? Number(str(a.flags.duration)) : undefined, voices: await listVoices() }, page);
      console.log(intakeSummaryMarkdown(r));
      const createId = str(a.flags.create);
      if (createId) {
        const p = createProject(projectFromIntake(createId, r));
        saveBrief(p.id, Brief.parse(r.brief));
        log(`
Proiect creat cu brief-ul dedus (neaprobat): ${path.relative(PATHS.root, projectDir(p.id))}. Răspunde la întrebări, apoi „aprob”.`);
      }
      return;
    }
    case "questions":
      console.log(intakeMarkdown());
      return;
    case "brief": {
      const file = need(str(a.flags.file), "--file brief.json");
      const b = saveBrief(need(id, "proiectul"), Brief.parse(readJsonLoose(path.resolve(file))));
      log(`Brief salvat (${b.platforms.join(", ")}, ${b.durationSec} s, direcție ${b.direction ?? "de propus"}).`);
      return;
    }
    case "approve": {
      const kind = need(a._[2], "tipul aprobării (brief | render-final)") as "brief" | "render-final";
      const phrase = need(a._[3], kind === "brief" ? '"aprob"' : '"render final"');
      approve(need(id, "proiectul"), kind, phrase, str(a.flags.version));
      log(`Aprobare înregistrată: ${kind}.`);
      return;
    }
    case "status":
      console.log(fs.readFileSync(path.join(projectDir(need(id, "proiectul")), "STATE.md"), "utf8"));
      return;
    case "capture": {
      const pid = need(id, "proiectul");
      const reqs: CaptureRequestInput[] = [];
      if (a.flags.demo) {
        reqs.push({ id: "landing", url: demoUrl("index.html"), viewport: "desktop" });
        reqs.push({ id: "landing-full", url: demoUrl("index.html"), viewport: "desktop", fullPage: true });
        reqs.push({ id: "app", url: demoUrl("app.html"), viewport: "desktop", research: false });
        reqs.push({ id: "app-mobile", url: demoUrl("app.html"), viewport: "mobile", research: false });
        reqs.push({ id: "app-search", url: demoUrl("app.html"), viewport: "desktop", record: { steps: [{ action: "wait", ms: 900 }, { action: "type", selector: "#search", text: "raport", delayMs: 210 }, { action: "wait", ms: 2600 }], fps: 30, tailMs: 400 }, research: false });
      } else {
        const typeFlag = str(a.flags.type);
        const clickFlag = str(a.flags.click);
        const waitFlag = str(a.flags.wait);
        const hideFlag = str(a.flags.hide);
        const stepsFile = str(a.flags.steps);
        const before: CaptureStep[] = stepsFile
          ? z.array(CaptureStep).parse(readJsonLoose(path.resolve(stepsFile)))
          : [
              ...(waitFlag ? [{ action: "wait" as const, ms: Number(waitFlag) }] : []),
              ...(clickFlag ? [{ action: "click" as const, selector: clickFlag }] : []),
              ...(typeFlag ? [{ action: "type" as const, selector: typeFlag.split("=")[0], text: typeFlag.split("=").slice(1).join("="), delayMs: 110 }] : []),
            ];
        reqs.push({
          id: str(a.flags.id) ?? `cap-${listCaptureCount(pid) + 1}`,
          url: need(str(a.flags.url), "--url"),
          viewport: (str(a.flags.viewport) ?? "desktop") as "desktop",
          fullPage: !!a.flags.full,
          before: a.flags.record ? [] : before,
          record: a.flags.record ? { steps: [{ action: "wait", ms: 600 }, ...before, { action: "wait", ms: 900 }], fps: 30, tailMs: 400 } : undefined,
          profile: str(a.flags.profile),
          research: !a.flags["no-research"],
          css: hideFlag ? hideFlag.split(",").map((sel) => `${sel.trim()}{display:none!important}`).join("\n") : "",
        });
      }
      await stepCapture(pid, reqs, log, { headed: !!a.flags.headed, thirdParty: !!a.flags["third-party"], mobile: !a.flags["no-mobile"] });
      return;
    }
    case "login":
      log("Se deschide un browser. Autentifică-te, apoi închide fereastra. Sesiunea rămâne doar pe acest calculator (.browser-profiles/).");
      await interactiveLogin(need(str(a.flags.url), "--url"), need(str(a.flags.profile), "--profile"));
      return;
    case "pii": {
      const choice = need(a._[3], "blur|keep");
      if (choice !== "blur" && choice !== "keep") throw new MmsError("ARG_MISSING", "Alege „blur” (estompează) sau „keep” (lasă vizibile).");
      const r = updateAsset(need(id, "proiectul"), need(a._[2], "assetId"), choice === "blur" ? { blurApproved: true } : { keepApproved: true });
      log(`${r.id}: ${r.pii.regions.length} zone cu date personale → ${choice === "blur" ? "se estompează" : "rămân vizibile"}.`);
      return;
    }
    case "add-asset": {
      const pid = need(id, "proiectul");
      const file = need(a._[2], "fișierul");
      const rights = str(a.flags.rights);
      const r = await ingestFile(pid, file, {
        origin: (str(a.flags.origin) ?? "user_provided") as "user_provided",
        role: str(a.flags.role) as AssetRole | undefined,
        thirdParty: !!a.flags["third-party"],
        rights: rights === "confirmed" ? "confirmed-by-user" : (rights as RightsStatus | undefined),
        rightsNote: rights === "confirmed" ? "drepturi confirmate de utilizator" : undefined,
        tags: list(a.flags.tag),
      });
      log(`${r.duplicate ? "Există deja" : "Adăugat"}: ${r.asset.id} (${r.asset.role}, încredere ${r.asset.roleConfidence}) ${r.asset.media.width ?? ""}${r.asset.media.height ? `×${r.asset.media.height}` : ""}`);
      if (r.asset.rights.thirdParty && r.asset.rights.status === "not-confirmed") log("  → Material al unui terț: ai dreptul să-l folosești? (mms rights … confirmed|denied)");
      return;
    }
    case "rights": {
      const pid = need(id, "proiectul");
      const source = str(a.flags.source);
      const raw = need(source ? a._[2] : a._[3], "starea (confirmed|not-confirmed|denied)");
      const status = raw === "confirmed" ? "confirmed-by-user" : RightsStatus.parse(raw);
      if (source) {
        // toate capturile unui site (desktop, telefon, pagină întreagă, logo-ul din pagină): o singură întrebare
        const { captureSource } = await import("../assets/source");
        const m = loadAssets(pid);
        const hits = m.assets.filter((x) => x.rights.thirdParty && captureSource(m, x) === source);
        if (!hits.length) throw new MmsError("RIGHTS_SOURCE", `Nu există capturi ale unui terț de pe ${source} în proiect.`, "Vezi sursele în raportul de calitate sau în Studio → Materiale.");
        for (const x of hits) setRights(pid, x.id, status);
        log(`Drepturi actualizate pentru ${hits.length} materiale de pe ${source}: ${hits.map((x) => x.id).join(", ")}.`);
        return;
      }
      setRights(pid, need(a._[2], "assetId"), status);
      log("Drepturi actualizate.");
      return;
    }
    case "focus":
      updateAsset(need(id, "proiectul"), need(a._[2], "assetId"), { focalPoint: { x: Number(a._[3]), y: Number(a._[4]) } });
      log("Punct focal setat.");
      return;
    case "blur-ok":
      updateAsset(need(id, "proiectul"), need(a._[2], "assetId"), { blurApproved: true });
      log("Acord de estompare înregistrat.");
      return;
    case "reference": {
      const pid = need(id, "proiectul");
      const asset = loadAssets(pid).assets.find((x) => x.id === a._[2]);
      if (!asset) throw new MmsError("ASSET_MISSING", `Nu există ${a._[2]}.`);
      const prof = await analyzeReference(asset.id, path.join(projectDir(pid), asset.file));
      const f = saveReferenceProfile(projectDir(pid), prof);
      log(prof.guidance.map((g) => `• ${g}`).join("\n"));
      log(`Profil: ${path.relative(PATHS.root, f)}`);
      return;
    }
    case "research": {
      const r = loadResearch(need(id, "proiectul"));
      log(`Rezumat: ${r.productSummary}\nSurse: ${r.sources.length}`);
      for (const s of r.sources) log(`  [${s.kind}] ${s.title} – ${s.url ?? s.assetId} (${s.fetchedAt.slice(0, 10)})`);
      for (const c of r.claims) log(`  ${c.status.padEnd(20)} ${c.id}: ${c.text.slice(0, 90)}`);
      return;
    }
    case "research-crawl": {
      const pid = need(id, "proiectul");
      const url = str(a.flags.url) ?? loadProject(pid).product.url;
      if (!url) throw new MmsError("ARG_MISSING", "Lipsește adresa site-ului (--url).");
      const r = await crawlSite(pid, url, { max: a.flags.max ? Number(str(a.flags.max)) : undefined, competitors: list(a.flags.competitor), thirdParty: a.flags["third-party"] ? true : undefined, log });
      for (const p of r.pages) log(`  ${p.kind.padEnd(14)} ${String(p.claims).padStart(3)} afirmații  ${p.url}`);
      for (const sk of r.skipped) log(`! ${sk}`);
      const g = claimGraph(r.research);
      log(`${g.stats.sources} surse, ${g.stats.claims} afirmații (${g.stats.usable} utilizabile, ${g.stats.needsConfirmation} de confirmat, ${g.stats.corroborated} coroborate, ${g.stats.conflicts} în conflict)`);
      return;
    }
    case "claims": {
      const g = claimGraph(loadResearch(need(id, "proiectul")));
      log(`${g.stats.sources} surse · ${g.stats.claims} afirmații · ${g.stats.usable} utilizabile · ${g.stats.needsConfirmation} de confirmat · ${g.stats.corroborated} coroborate · ${g.stats.conflicts} în conflict`);
      for (const n of g.nodes) log(`  ${(n.usable ? "✓" : "·")} ${n.confidence.padEnd(6)} ${n.claim.status.padEnd(18)} ${n.claim.id}: ${n.claim.text.slice(0, 80)}${n.sources.length ? ` [${n.sources.map((x) => x.kind).join(", ")}]` : ""}${n.conflictsWith.length ? ` ⚠ conflict cu ${n.conflictsWith.join(", ")}` : ""}${n.aboutCompetitor ? " (concurent)" : ""}`);
      if (g.toConfirm.length) log(`
De confirmat (${g.toConfirm.length}): ${g.toConfirm.map((c) => c.id).join(", ")}`);
      return;
    }
    case "claim": {
      const s = need(a._[3], "starea");
      setClaimStatus(need(id, "proiectul"), need(a._[2], "claimId"), s === "approved" ? "approved-by-user" : (s as "rejected"));
      log("Afirmație actualizată.");
      return;
    }
    case "add-claim": {
      const c = addUserClaim(need(id, "proiectul"), need(a._[2], "textul"), (str(a.flags.category) ?? "feature") as "feature", str(a.flags.source) ?? "dat de utilizator");
      log(`Adăugată: ${c.id}`);
      return;
    }
    case "brand": {
      const r = stepBrand(need(id, "proiectul"), { force: !!a.flags.force });
      r.notes.forEach((n) => log(`• ${n}`));
      return;
    }
    case "script": {
      const r = stepScript(need(id, "proiectul"), { force: !!a.flags.force });
      log(`Script în ${r.versionId}.`);
      for (const i of r.issues) log(`  [${i.severity}] ${i.lineId ?? ""} ${i.message}`);
      return;
    }
    case "storyboard": {
      const r = stepStoryboard(need(id, "proiectul"), { force: !!a.flags.force, templateId: str(a.flags.template) });
      r.rationale.forEach((x) => log(`• ${x}`));
      return;
    }
    case "voices":
      for (const v of await listVoices()) log(`${v.provider.padEnd(11)} ${v.name.padEnd(28)} ${v.language} ${v.gender ?? ""}`);
      return;
    case "voice": {
      const pid = need(id, "proiectul");
      await stepVoice(pid, loadProject(pid).currentVersion!, log);
      return;
    }
    case "compile": {
      const pid = need(id, "proiectul");
      const r = await stepCompile(pid, str(a.flags.version) ?? loadProject(pid).currentVersion!, log);
      log(`Versiunea compilată: ${r.versionId}`);
      r.warnings.forEach((w) => log(`! ${w}`));
      for (const [f, v] of Object.entries(r.validation)) for (const x of v.findings) log(`  [${f}] ${x.timecode ?? "--:--"} ${x.severity.padEnd(7)} ${x.problem}`);
      return;
    }
    case "audio": {
      const pid = need(id, "proiectul");
      const r = await stepAudio(pid, str(a.flags.version) ?? loadProject(pid).currentVersion!, log);
      log(`Loudness ${r.integratedLufs} LUFS, true peak ${r.truePeakDbtp} dBTP, ${r.ok ? "OK" : r.problems.join("; ")}`);
      return;
    }
    case "preview": {
      const pid = need(id, "proiectul");
      const from = str(a.flags.from);
      const to = str(a.flags.to);
      const r = await stepPreview(pid, str(a.flags.version) ?? loadProject(pid).currentVersion!, str(a.flags.format) ?? null, log, { frameRange: from && to ? [Number(from), Number(to)] : undefined, onProgress: progressBar() });
      log(`\nPreview: ${path.relative(PATHS.root, r.file)}\nFoaie de contact: ${path.relative(PATHS.root, r.contactSheet)}`);
      r.check.problems.forEach((p) => log(`! ${p}`));
      return;
    }
    case "make": {
      const pid = need(id, "proiectul");
      const r = await produce(pid, { log, depth: (str(a.flags.depth) as Depth | undefined) ?? "standard", autofix: !a.flags["no-autofix"], preview: !a.flags["skip-preview"], onProgress: progressBar(), stage: (n) => log(`\n— ${n} —`) });
      const score = r.final?.score ?? r.autofix?.finalScore ?? r.first.score;
      log(`\nVersiunea ${r.versionId}: calitate ${score.overall}/100 · ${score.verdict}`);
      for (const x of score.reasons) log(`  ${x}`);
      if (r.autofix?.needsHuman.length) log(`${r.autofix.needsHuman.length} probleme cer decizie creativă (vezi versions/${r.versionId}/autofix.json).`);
      return;
    }
    case "critique":
    case "quality": {
      const pid = need(id, "proiectul");
      const depth = (str(a.flags.depth) as Depth | undefined) ?? (cmd === "critique" ? "fast" : "standard");
      const fmt = str(a.flags.format);
      const r = await runQuality(pid, { versionId: str(a.flags.version), formats: fmt ? [fmt] : undefined, depth, log, force: !!a.flags.force, onProgress: progressBar() });
      printQuality(r.run);
      log(r.decision.message);
      return;
    }
    case "autofix": {
      const pid = need(id, "proiectul");
      const r = await autoFixLoop(pid, { depth: (str(a.flags.depth) as Depth | undefined) ?? "standard", maxIterations: a.flags.max ? Number(str(a.flags.max)) : undefined, log });
      log(`\n${r.startVersion} → ${r.finalVersion}: ${r.finalScore.overall}/100 · ${r.finalScore.verdict}`);
      log(r.stopReason);
      for (const it of r.iterations) log(`  iterația ${it.n}: ${it.from} → ${it.to} ${it.decision === "kept" ? "păstrată" : "respinsă (rollback)"} – ${it.reason}`);
      if (r.needsHuman.length) {
        log(`\nCer decizie creativă (${r.needsHuman.length}):`);
        for (const x of r.needsHuman.slice(0, 12)) log(`  ${x.timecode ?? "--:--"} [${x.severity}] ${x.problem} → ${x.recommendation}`);
      }
      if (r.checkpoint) log("\nRegula 7: 3 runde de corectură; arată progresul utilizatorului înainte de a continua.");
      return;
    }
    case "impact": {
      const pid = need(id, "proiectul");
      const to = str(a.flags.to) ?? loadProject(pid).currentVersion!;
      const from = str(a.flags.from) ?? listVersions(pid).find((v) => v.id === to)?.parent;
      if (!from) throw new MmsError("ARG_MISSING", "Versiunea de comparat lipsește (--from vN).");
      const r = impactBetween(pid, from, to);
      log(`${from} → ${to}: artefacte schimbate: ${r.changes.artifacts.join(", ") || "niciunul"}`);
      for (const x of r.plan.reasons) log(`  • ${x}`);
      log(`  de refăcut: voce ${r.plan.rerun.voice ? "da" : "nu"}, mix ${r.plan.rerun.audio ? "da" : "nu"}, video ${r.plan.rerun.fullRender ? "da" : "nu"}`);
      return;
    }
    case "edit": {
      const pid = need(id, "proiectul");
      const file = str(a.flags.file);
      const raw = file ? readJsonLoose(path.resolve(file)) : JSON.parse(need(str(a.flags.op), "--op (JSON) sau --file ops.json"));
      const ops = Array.isArray(raw) ? raw : [raw];
      const r = applyEdit(pid, ops, { source: "editor" });
      r.applied.forEach((x) => log(`• ${x.description}`));
      if (!a.flags["no-compile"]) {
        const c = await stepCompile(pid, r.versionId, log);
        await stepAudio(pid, c.versionId, log);
      }
      log(`Versiunea ${r.versionId} (editarea ${r.entry.n}).`);
      return;
    }
    case "undo":
    case "redo": {
      const pid = need(id, "proiectul");
      const r = cmd === "undo" ? undo(pid) : redo(pid);
      log(`${cmd === "undo" ? "Anulat" : "Refăcut"}: ${r.entry.description}`);
      if (!a.flags["no-compile"]) {
        const c = await stepCompile(pid, r.versionId, log);
        await stepAudio(pid, c.versionId, log);
      }
      return;
    }
    case "concepts": {
      const pid = need(id, "proiectul");
      const c = ensureConcepts(pid, { force: !!a.flags.force });
      for (const x of [...c.concepts].sort((p, q) => q.total - p.total)) {
        log(`${x.id === c.selectedId ? "▶" : " "} ${x.id.padEnd(22)} ${String(x.total).padStart(5)}/100  ${x.origin === "user" ? "al tău   " : x.origin === "ai" ? "Claude   " : "sugestie "} ${x.title} · ${x.templateId} · ${x.direction}`);
        log(`      ${x.bigIdea}`);
        log(`      hook (${x.hook.origin}): „${x.hook.text}”${x.risks.length ? ` · riscuri: ${x.risks.join("; ")}` : ""}`);
      }
      for (const r of c.rationale) log(r);
      return;
    }
    case "concept": {
      const pid = need(id, "proiectul");
      const c = chooseConcept(pid, need(a._[2], "id-ul conceptului"));
      log(`Conceptul ales: ${c.selectedId}. Regenerează storyboard-ul: npm run mms -- storyboard ${pid} --force`);
      return;
    }
    case "critique-pack": {
      const pid = need(id, "proiectul");
      const r = await critiquePack(pid, { versionId: str(a.flags.version), formatId: str(a.flags.format), log });
      log("Pachet de revizuire: " + path.relative(PATHS.root, r.request));
      log("Foaia de contact: " + path.relative(PATHS.root, r.contactSheet) + " (" + r.frames.length + " cadre-cheie, " + r.rendered + " randate acum)");
      log("Schema răspunsului: " + path.relative(PATHS.root, r.schema));
      return;
    }
    case "review": {
      const pid = need(id, "proiectul");
      const data = readJsonLoose(path.resolve(need(str(a.flags.file), "--file")));
      const r = addReview(pid, str(a.flags.version) ?? loadProject(pid).currentVersion!, data);
      log(`Observații adăugate: ${r.findings.length}`);
      return;
    }
    case "iterate": {
      const r = await iterate(need(id, "proiectul"), need(a._[2], "comanda"), log);
      log(`Versiune nouă: ${r.versionId}`);
      return;
    }
    case "hook-variants": {
      const r = await hookVariants(need(id, "proiectul"), { from: str(a.flags.from), count: a.flags.count !== undefined ? Number(a.flags.count) : undefined }, log);
      for (const v of r) log(`${v.versionId}: ${v.hookId} – „${v.text}”`);
      return;
    }
    case "post-pack": {
      const pid = need(id, "proiectul");
      const p = loadProject(pid);
      const v = str(a.flags.version) ?? p.currentVersion!;
      const fmt = str(a.flags.format) ?? p.formats[0].id;
      const r = await writePostPack(pid, v, fmt, path.join(projectDir(pid), "versions", v, "renders", `post-${fmt}`));
      log(`Copertă: ${path.relative(PATHS.root, r.cover)}`);
      log(`Text: ${path.relative(PATHS.root, r.text)}`);
      return;
    }
    case "new-version": {
      const v = createVersion(need(id, "proiectul"), { label: str(a.flags.label) ?? "" });
      log(`Versiune nouă: ${v.id}`);
      return;
    }
    case "versions":
      for (const v of listVersions(need(id, "proiectul"))) {
        log(`${v.id.padEnd(5)} ${v.status.padEnd(8)} ${v.frozen ? "înghețată" : "editabilă"}  ${v.parent ? `din ${v.parent}` : ""} ${v.label}`);
        for (const c of v.changes) log(`      • ${c.description}`);
      }
      return;
    case "render": {
      const pid = need(id, "proiectul");
      if (!a.flags.final) throw new MmsError("RENDER_MODE", "Pentru preview folosește „preview”; „render” face exportul final și cere --final.");
      const out = await stepFinalRender(pid, str(a.flags.version) ?? loadProject(pid).currentVersion!, str(a.flags.format) ?? null, log);
      log(`Export final: ${path.relative(PATHS.root, out)}`);
      return;
    }
    case "catalog":
      for (const c of ALL_CAPABILITIES) log(`${c.id.padEnd(24)} ${c.kind.padEnd(10)} ${c.status.padEnd(12)} ${c.title}`);
      log(`\n${ALL_CAPABILITIES.length} capabilități.`);
      return;
    case "recipes":
      for (const r of RECIPES) log(`${r.id.padEnd(20)} ${r.roles.join(",").padEnd(36)} ${r.title}`);
      return;
    case "templates":
      for (const t of listTemplates()) log(`${t.id.padEnd(18)} ${t.durationSec.join("–")} s  ${t.title}`);
      return;
    case "sfx":
      for (const s of SFX) log(`${s.id.padEnd(14)} ${s.category.padEnd(11)} ${s.title}`);
      return;
    case "usage": {
      const { loadUsage, summarizeUsage } = await import("../core/usage");
      const rows = summarizeUsage(loadUsage(id));
      if (!rows.length) {
        log(id ? `Proiectul ${id} nu are încă operații înregistrate.` : "Nu există operații înregistrate în afara proiectelor.");
        return;
      }
      for (const r of rows)
        log(`${r.provider.padEnd(11)} ${(r.model ?? "").padEnd(24)} ${r.op.padEnd(15)} ${String(r.calls).padStart(4)} operații · ${String(r.cached).padStart(4)} din cache · ${r.failed} eșuate${r.chars ? ` · ${r.chars} caractere sintetizate` : ""}${r.frames ? ` · ${r.frames} cadre randate` : ""} · ${(r.durationMs / 1000).toFixed(1)} s`);
      log("Costul în bani nu e calculat: furnizorii nu îl întorc în aceste apeluri (vezi contul furnizorului).");
      return;
    }
    case "cache": {
      const { cacheReport } = await import("../core/prune");
      if (a.flags.prune) {
        const { pruneBundles } = await import("../renderer/node/render");
        const removed = pruneBundles();
        log(removed.length ? `Șterse ${removed.length} bundle-uri vechi.` : "Niciun bundle de șters (se păstrează cel curent, ultimele 2 și cele folosite în ultimele 2 ore).");
      }
      const rows = cacheReport(PATHS.cache);
      const mb = (b: number) => `${(b / 1024 ** 2).toFixed(0).padStart(6)} MB`;
      for (const r of rows) log(`${mb(r.bytes)}  ${r.name}`);
      log(`${mb(rows.reduce((s, r) => s + r.bytes, 0))}  total (${PATHS.cache})`);
      return;
    }
    case "studio": {
      const { startStudio } = await import("../studio/server");
      await startStudio({ port: Number(str(a.flags.port) ?? process.env.MMS_STUDIO_PORT ?? 4321), open: !a.flags["no-open"] });
      return;
    }
    case "remotion-studio": {
      const { runRemotionStudio } = await import("../studio/remotion-studio");
      await runRemotionStudio({ projectId: id, version: str(a.flags.version), format: str(a.flags.format) });
      return;
    }
    default:
      throw new MmsError("UNKNOWN_COMMAND", `Comandă necunoscută: ${cmd}`, "Vezi: npm run mms -- help");
  }
}

function printQuality(r: QualityRun): void {
  const s = r.score;
  log(`\nRunda ${r.round} · ${r.versionId} · adâncime ${r.depth} · ${(r.durationMs / 1000).toFixed(1)} s`);
  log(`Calitate ${s.overall}/100 · ${s.verdict} · acoperire ${Math.round(s.coverage * 100)}%`);
  for (const [k, v] of Object.entries(s.categories)) log(`  ${k.padEnd(11)} ${v === null ? "neevaluat" : v}`);
  if (r.rubric.minScene !== null) log(`  rubrica regulii 7: scor minim pe scenă ${r.rubric.minScene}/10`);
  log(`Randări: ${r.renders.stillsRendered} cadre noi, ${r.renders.stillsReused} din cache; mișcare ${r.renders.motionFramesRendered} cadre; video ${r.renders.fullRendered} randat, ${r.renders.fullReused} refolosit`);
  for (const p of r.passes) {
    const ran = p.checks.filter((c) => c.status !== "skipped");
    const skipped = p.checks.filter((c) => c.status === "skipped");
    log(`  Pas ${p.n} ${p.title}: ${ran.map((c) => `${c.id}(${c.method}${c.status === "cached" ? ", cache" : ""})`).join(" ") || "—"}${skipped.length ? ` · sărite: ${skipped.map((c) => c.id).join(", ")}` : ""}`);
  }
  log(`\nProbleme (${r.issues.length}):`);
  for (const x of r.issues.slice(0, 40)) log(`  ${(x.timecode ?? "--:--").padEnd(8)} [${x.severity}] ${x.category}/${x.dimension}${x.formatId ? ` [${x.formatId}]` : ""}: ${x.problem}${x.autoFixable ? " (corectabil automat)" : ""}`);
  if (r.issues.length > 40) log(`  … și încă ${r.issues.length - 40} (versions/${r.versionId}/quality.json)`);
  for (const x of s.reasons) log(`• ${x}`);
}

function listCaptureCount(pid: string): number {
  const d = path.join(projectDir(pid), "captures");
  return fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith(".json")).length : 0;
}

function progressBar(): (p: number) => void {
  let last = -1;
  return (p: number) => {
    const pct = Math.floor(p * 100);
    if (pct === last || !process.stdout.isTTY) return;
    last = pct;
    process.stdout.write(`\r  randare ${String(pct).padStart(3)}%`);
  };
}

main()
  .then(async () => {
    const a = parseArgs(process.argv.slice(2));
    if (a._[0] !== "studio" && a._[0] !== "remotion-studio") await shutdown();
  })
  .catch(async (e) => {
    console.error(`\nEroare: ${formatError(e)}`);
    await shutdown().catch(() => undefined);
    process.exit(1);
  });
