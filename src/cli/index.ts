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
import { Brief, type AssetRole, type FormatSpec, type ProductCategory, type RightsStatus } from "../core/schema";
import { intakeMarkdown } from "../creative/intake";
import { listTemplates } from "../creative/templates";
import { addReview, critiqueRound, hookVariants, iterate } from "../pipeline/iterate";
import { approve, demoUrl, shutdown, writePostPack, stepAudio, stepBrand, stepCapture, stepCompile, stepFinalRender, stepPreview, stepScript, stepStoryboard, stepVoice } from "../pipeline/steps";
import { createProject, createVersion, listProjects, listVersions, loadAssets, loadProject, loadResearch, projectDir, saveBrief } from "../projects/store";
import { analyzeReference, saveReferenceProfile } from "../references/analyze";
import { addUserClaim, setClaimStatus } from "../research/extract";
import { ALL_CAPABILITIES } from "../motion/registry";
import { RECIPES } from "../recipes/recipes";
import { CaptureStep, interactiveLogin, type CaptureRequestInput } from "../capture/capture";
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
  questions                              întrebările de început (A–H)
  brief <id> --file brief.json           salvează brief-ul (validat)
  approve <id> brief "aprob"             aprobă brief-ul (lucrul începe abia după)
  status <id>                            STATE.md (ce e făcut, ce urmează)

MATERIALE ȘI RESEARCH
  capture <id> --url <u> [--id nume] [--viewport desktop|laptop|tablet|mobile] [--full]
          [--wait 2000] [--click "#selector"] [--type "#selector=text"] [--hide "#cookie,.banner"]
          [--steps pasi.json] [--record] [--profile nume] [--no-research]
  capture <id> --demo                    capturează produsul demo inclus (pentru test)
  login --url <u> --profile <nume>       deschide un browser; te autentifici tu, sesiunea rămâne local
  add-asset <id> <fișier> [--role logo|screenshot|music|…] [--tag nume] [--third-party] [--rights confirmed|not-confirmed|denied] [--origin user_provided|stock|generated]
  rights <id> <assetId> confirmed|not-confirmed|denied
  focus <id> <assetId> <x> <y>           punct focal (0..1)
  blur-ok <id> <assetId>                 acord pentru estomparea datelor personale
  reference <id> <assetId>               profilul unui video de referință
  research <id>                          sursele și afirmațiile
  claim <id> <claimId> approved|rejected|verified
  add-claim <id> "text" --category feature --source "titlul sursei"
  brand <id> [--force]                   brand kit din captură și logo

PRODUCȚIE
  script <id> [--force]                  schița de script (din fapte + cuvintele tale)
  storyboard <id> [--template saas] [--force]
  voices                                 vocile TTS disponibile
  voice <id>                             sinteza vocii
  compile <id>                           timeline-ul pentru toate formatele + validare
  audio <id>                             muzică, efecte, voce, mix (−14 LUFS, ≤ −1 dBTP)
  preview <id> [--format 9x16] [--from 0 --to 150]
  make <id> [--skip-preview]             script → storyboard → voce → compile → audio → preview → critică
  critique <id> [--format 9x16]          o rundă de critică automată (rubrica fixă)
  review <id> --file review.json         observațiile lui Claude / notele tale (vezi docs)
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
      await stepCapture(pid, reqs, log, { headed: !!a.flags.headed });
      return;
    }
    case "login":
      log("Se deschide un browser. Autentifică-te, apoi închide fereastra. Sesiunea rămâne doar pe acest calculator (.browser-profiles/).");
      await interactiveLogin(need(str(a.flags.url), "--url"), need(str(a.flags.profile), "--profile"));
      return;
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
      const s = need(a._[3], "starea (confirmed|not-confirmed|denied)");
      setRights(need(id, "proiectul"), need(a._[2], "assetId"), s === "confirmed" ? "confirmed-by-user" : (s as RightsStatus));
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
      const p = loadProject(pid);
      if (p.status === "intake") throw new MmsError("BRIEF_NOT_APPROVED", "Brief-ul nu e aprobat.", `Utilizatorul scrie „aprob”: npm run mms -- approve ${pid} brief "aprob"`);
      const s = stepScript(pid);
      s.issues.filter((i) => i.severity === "blocker").forEach((i) => log(`! script: ${i.message}`));
      stepStoryboard(pid).rationale.forEach((x) => log(`• ${x}`));
      const v = loadProject(pid).currentVersion!;
      await stepVoice(pid, v, log);
      const c = await stepCompile(pid, v, log);
      c.warnings.forEach((w) => log(`! ${w}`));
      const mixR = await stepAudio(pid, v, log);
      log(`Audio: ${mixR.integratedLufs} LUFS, TP ${mixR.truePeakDbtp} dBTP`);
      if (!a.flags["skip-preview"]) {
        for (const f of p.formats) {
          const r = await stepPreview(pid, v, f.id, log, { onProgress: progressBar() });
          log(`\nPreview ${f.id}: ${path.relative(PATHS.root, r.file)}`);
        }
      }
      const cr = critiqueRound(pid, v);
      log(`Critică: scor minim ${cr.round.minScene}/10 – ${cr.decision.message}`);
      return;
    }
    case "critique": {
      const r = critiqueRound(need(id, "proiectul"), str(a.flags.version), str(a.flags.format));
      log(`Runda ${r.round.n} (${r.round.reviewer}): scor minim ${r.round.minScene}/10`);
      for (const [k, v] of Object.entries(r.round.overall)) log(`  ${k.padEnd(10)} ${v}`);
      for (const f of r.round.findings) log(`  ${f.timecode ?? "--:--"} [${f.severity}] ${f.problem} → ${f.recommendation}`);
      log(r.decision.message);
      return;
    }
    case "review": {
      const pid = need(id, "proiectul");
      const data = readJsonLoose(path.resolve(need(str(a.flags.file), "--file"))) as Parameters<typeof addReview>[2];
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
