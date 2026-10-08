/**
 * Serverul Studio-ului: interfața web locală, API JSON peste proiecte, fișiere (cu Range pentru
 * video/audio în Player) și joburi de producție cu evenimente în timp real (SSE).
 * Ascultă doar pe 127.0.0.1.
 */
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { build } from "esbuild";
import { ingestFile, setRights, updateAsset } from "../assets/ingest";
import { listVoices } from "../audio/voice";
import { formatError, MmsError } from "../core/errors";
import { readJsonLoose } from "../core/json";
import { makeFormat, FORMAT_PRESETS, type FormatPresetId } from "../core/formats";
import { PATHS, publicToAbs } from "../core/paths";
import { Brief, type AssetRole, type FormatSpec, type ProductCategory, type RightsStatus } from "../core/schema";
import { suggestDirections } from "../creative/directions";
import { INTAKE_GROUPS, INTAKE_QUESTIONS } from "../creative/intake";
import { validateScript } from "../creative/script";
import { listTemplates } from "../creative/templates";
import { ALL_CAPABILITIES } from "../motion/registry";
import { addReview, critiqueRound, iterate } from "../pipeline/iterate";
import { approve, demoUrl, stepAudio, stepBrand, stepCapture, stepCompile, stepFinalRender, stepPreview, stepScript, stepStoryboard, stepVoice } from "../pipeline/steps";
import {
  createProject,
  createVersion,
  hasFile,
  listProjects,
  listVersions,
  loadApprovals,
  loadAssets,
  loadBrand,
  loadBrief,
  loadCritique,
  loadProject,
  loadResearch,
  loadScript,
  loadState,
  loadStoryboard,
  loadTimeline,
  loadVersionMeta,
  projectDir,
  saveBrand,
  saveBrief,
  saveScript,
  saveStoryboard,
  versionFile,
} from "../projects/store";
import { RECIPES } from "../recipes/recipes";
import { setClaimStatus } from "../research/extract";
import { JobQueue } from "./jobs";
import { registryJson } from "./registry-json";

const UI_DIR = path.join(PATHS.root, "src", "studio", "ui");
const OUT_DIR = path.join(PATHS.cache, "studio");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".srt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

/** Construiește interfața cu esbuild (o dată la pornire; din nou dacă s-au schimbat sursele). */
export async function buildUi(): Promise<string> {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const out = path.join(OUT_DIR, "app.js");
  await build({
    entryPoints: [path.join(UI_DIR, "main.tsx")],
    bundle: true,
    outfile: out,
    format: "esm",
    platform: "browser",
    target: ["chrome120"],
    jsx: "automatic",
    loader: { ".json": "json" },
    define: { "process.env.NODE_ENV": '"production"' },
    minify: true,
    sourcemap: false,
    logLevel: "error",
  });
  return out;
}

function send(res: http.ServerResponse, code: number, body: unknown, type = "application/json; charset=utf-8") {
  const data = typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(data);
}

async function readBody(req: http.IncomingMessage, limit = 2_000_000_000): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > limit) throw new MmsError("UPLOAD_TOO_LARGE", "Fișier prea mare.");
    chunks.push(c as Buffer);
  }
  return Buffer.concat(chunks);
}

async function json<T>(req: http.IncomingMessage): Promise<T> {
  const b = await readBody(req, 20_000_000);
  return (b.length ? JSON.parse(b.toString("utf8")) : {}) as T;
}

/** Servește un fișier cu suport pentru Range (necesar pentru căutarea în video/audio). */
function serveFile(req: http.IncomingMessage, res: http.ServerResponse, file: string) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res, 404, { error: "Fișier inexistent" });
  const stat = fs.statSync(file);
  const type = MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream";
  const range = req.headers.range;
  if (range) {
    const m = range.match(/bytes=(\d*)-(\d*)/);
    const start = m && m[1] ? Number(m[1]) : 0;
    const end = m && m[2] ? Math.min(Number(m[2]), stat.size - 1) : stat.size - 1;
    res.writeHead(206, { "Content-Type": type, "Content-Range": `bytes ${start}-${end}/${stat.size}`, "Accept-Ranges": "bytes", "Content-Length": end - start + 1, "Cache-Control": "no-cache" });
    fs.createReadStream(file, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { "Content-Type": type, "Content-Length": stat.size, "Accept-Ranges": "bytes", "Cache-Control": "no-cache" });
  fs.createReadStream(file).pipe(res);
}

function versionBundle(id: string, v: string) {
  const project = loadProject(id);
  const read = (rel: string) => (fs.existsSync(versionFile(id, v, rel)) ? readJsonLoose(versionFile(id, v, rel)) : null);
  const timelines = Object.fromEntries(project.formats.filter((f) => hasFile(id, `versions/${v}/timeline-${f.id}.json`)).map((f) => [f.id, loadTimeline(id, v, f.id)]));
  const rendersDir = versionFile(id, v, "renders");
  const renders = fs.existsSync(rendersDir) ? fs.readdirSync(rendersDir).filter((f) => /\.(mp4|png|json)$/.test(f)).map((f) => `projects/${id}/versions/${v}/renders/${f}`) : [];
  return {
    meta: loadVersionMeta(id, v),
    script: hasFile(id, `versions/${v}/script.json`) ? loadScript(id, v) : null,
    storyboard: hasFile(id, `versions/${v}/storyboard.json`) ? loadStoryboard(id, v) : null,
    timelines,
    critique: loadCritique(id, v),
    mixReport: read("audio/mix-report.json"),
    compileReport: read("compile-report.json"),
    cueSheet: read("audio/cue-sheet.json"),
    renders,
    scriptIssues: hasFile(id, `versions/${v}/script.json`) && hasFile(id, "brief.json") ? validateScript(loadScript(id, v), loadBrief(id), loadResearch(id)) : [],
  };
}

function projectBundle(id: string) {
  const project = loadProject(id);
  return {
    project,
    state: loadState(id),
    stateMd: fs.readFileSync(path.join(projectDir(id), "STATE.md"), "utf8"),
    brief: hasFile(id, "brief.json") ? loadBrief(id) : null,
    brand: hasFile(id, "brand.json") ? loadBrand(id) : null,
    research: loadResearch(id),
    assets: loadAssets(id),
    approvals: loadApprovals(id),
    versions: listVersions(id),
  };
}

function parseFormat(spec: { preset?: string; width?: number; height?: number; fps: number; durationSec: number; platform: FormatSpec["platform"] }): FormatSpec {
  if (spec.preset && spec.preset in FORMAT_PRESETS) return makeFormat(spec.preset as FormatPresetId, spec);
  if (!spec.width || !spec.height) throw new MmsError("FORMAT_INVALID", "Format personalizat fără lățime/înălțime.");
  return makeFormat({ width: spec.width, height: spec.height }, spec);
}

export async function startStudio(o: { port: number; open: boolean }): Promise<http.Server> {
  process.stdout.write("Construiesc interfața Studio… ");
  await buildUi();
  console.log("gata.");
  const jobs = new JobQueue();
  const clients = new Set<http.ServerResponse>();
  jobs.onChange((j) => {
    const data = `data: ${JSON.stringify(j)}\n\n`;
    for (const c of clients) c.write(data);
  });

  const runJob = (id: string, type: string, params: Record<string, unknown>) => {
    const p = loadProject(id);
    const v = (params.version as string | undefined) ?? p.currentVersion ?? undefined;
    const fmt = (params.format as string | undefined) ?? null;
    const label = { capture: "Captură reală", brand: "Brand kit", script: "Script", storyboard: "Storyboard", voice: "Voce", compile: "Compilare timeline", audio: "Mix audio", preview: "Preview", critique: "Critică", make: "Producție completă", final: "Render final", iterate: "Iterație", "new-version": "Versiune nouă" }[type] ?? type;
    return jobs.enqueue(id, type, label, async ({ log, progress }) => {
      switch (type) {
        case "capture": {
          const reqs = params.demo
            ? [
                { id: "landing", url: demoUrl("index.html"), viewport: "desktop" as const },
                { id: "landing-full", url: demoUrl("index.html"), viewport: "desktop" as const, fullPage: true },
                { id: "app", url: demoUrl("app.html"), viewport: "desktop" as const, research: false },
              ]
            : [{ id: String(params.captureId ?? `cap-${Date.now()}`), url: String(params.url), viewport: (params.viewport as "desktop") ?? "desktop", fullPage: !!params.fullPage, research: params.research !== false }];
          return stepCapture(id, reqs, log);
        }
        case "brand":
          return stepBrand(id, { force: true });
        case "script":
          return stepScript(id, { force: !!params.force });
        case "storyboard":
          return stepStoryboard(id, { force: !!params.force, templateId: params.template as string | undefined });
        case "voice":
          return stepVoice(id, v!, log);
        case "compile": {
          // timeline-ul nou schimbă momentele: mixul se reface imediat, ca preview-ul să aibă sunet
          const r = await stepCompile(id, v!, log);
          await stepAudio(id, r.versionId, log);
          return r;
        }
        case "audio":
          return stepAudio(id, v!, log);
        case "preview":
          return stepPreview(id, v!, fmt, log, { onProgress: progress });
        case "critique":
          return critiqueRound(id, v, fmt ?? undefined);
        case "make": {
          stepScript(id);
          stepStoryboard(id);
          await stepVoice(id, loadProject(id).currentVersion!, log);
          const vv = (await stepCompile(id, loadProject(id).currentVersion!, log)).versionId;
          await stepAudio(id, vv, log);
          await stepPreview(id, vv, fmt, log, { onProgress: progress });
          return critiqueRound(id, vv);
        }
        case "final":
          return stepFinalRender(id, v!, fmt, log);
        case "iterate":
          return iterate(id, String(params.command ?? ""), log);
        case "new-version":
          return createVersion(id, { label: String(params.label ?? "") });
        default:
          throw new MmsError("JOB_UNKNOWN", `Job necunoscut: ${type}`);
      }
    });
  };

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
      const m = req.method ?? "GET";
      if (m === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) return serveFile(req, res, path.join(UI_DIR, "index.html"));
      if (m === "GET" && url.pathname === "/app.js") return serveFile(req, res, path.join(OUT_DIR, "app.js"));
      if (m === "GET" && url.pathname === "/styles.css") return serveFile(req, res, path.join(UI_DIR, "styles.css"));
      if (m === "GET" && parts[0] === "files") {
        const rel = parts.slice(1).join("/");
        if (rel.includes("..")) return send(res, 400, { error: "cale invalidă" });
        return serveFile(req, res, publicToAbs(rel));
      }
      if (parts[0] !== "api") return send(res, 404, { error: "Nu există" });
      // ─── API ───
      if (m === "GET" && parts[1] === "events") {
        res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
        res.write(":ok\n\n");
        clients.add(res);
        req.on("close", () => clients.delete(res));
        return;
      }
      if (m === "GET" && parts[1] === "meta") {
        return send(res, 200, { questions: INTAKE_QUESTIONS, groups: INTAKE_GROUPS, templates: listTemplates(), recipes: RECIPES.map((r) => ({ id: r.id, title: r.title, description: r.description, roles: r.roles, slots: r.slots, tags: r.tags })), formats: Object.keys(FORMAT_PRESETS), capabilities: ALL_CAPABILITIES.length });
      }
      if (m === "GET" && parts[1] === "registry") return send(res, 200, registryJson());
      if (m === "GET" && parts[1] === "voices") return send(res, 200, await listVoices());
      if (m === "GET" && parts[1] === "jobs") return send(res, 200, jobs.list(url.searchParams.get("project") ?? undefined));
      if (m === "POST" && parts[1] === "suggest-directions") return send(res, 200, suggestDirections(await json(req)));
      if (parts[1] === "projects" && parts.length === 2) {
        if (m === "GET") return send(res, 200, listProjects());
        if (m === "POST") {
          const b = await json<{ id: string; name: string; product: { name: string; url?: string; category: ProductCategory }; formats: Array<Parameters<typeof parseFormat>[0]>; textLang: string | null; voiceLang: string | null }>(req);
          const p = createProject({ id: b.id, name: b.name, product: b.product, formats: b.formats.map(parseFormat), language: { text: b.textLang || null, voice: b.voiceLang || null } });
          return send(res, 201, p);
        }
      }
      if (parts[1] === "projects" && parts[2]) {
        const id = parts[2];
        const sub = parts[3];
        if (!sub && m === "GET") return send(res, 200, projectBundle(id));
        if (sub === "brief" && m === "PUT") return send(res, 200, saveBrief(id, Brief.parse(await json(req))));
        if (sub === "brand" && m === "PUT") return send(res, 200, saveBrand(id, await json(req)));
        if (sub === "approve" && m === "POST") {
          const b = await json<{ kind: "brief" | "render-final"; phrase: string; versionId?: string }>(req);
          return send(res, 200, approve(id, b.kind, b.phrase, b.versionId));
        }
        if (sub === "claims" && parts[4] && m === "POST") {
          const b = await json<{ status: "approved-by-user" | "rejected" | "verified" | "needs-confirmation" }>(req);
          return send(res, 200, setClaimStatus(id, parts[4], b.status));
        }
        if (sub === "assets" && m === "POST" && !parts[4]) {
          const name = String(req.headers["x-filename"] ?? "fisier.bin").replace(/[^\w.\-]+/g, "_");
          const data = await readBody(req);
          const tmp = path.join(PATHS.cache, "uploads", `${crypto.randomBytes(6).toString("hex")}-${name}`);
          fs.mkdirSync(path.dirname(tmp), { recursive: true });
          fs.writeFileSync(tmp, data);
          const thirdParty = req.headers["x-third-party"] === "1";
          const r = await ingestFile(id, tmp, { origin: "user_provided", role: (req.headers["x-role"] as AssetRole | undefined) || undefined, thirdParty });
          fs.rmSync(tmp, { force: true });
          return send(res, 201, r);
        }
        if (sub === "assets" && parts[4] && m === "PATCH") {
          const b = await json<{ role?: AssetRole; focalPoint?: { x: number; y: number }; rights?: RightsStatus; blurApproved?: boolean; keepApproved?: boolean; notes?: string }>(req);
          if (b.rights) setRights(id, parts[4], b.rights);
          return send(res, 200, updateAsset(id, parts[4], { role: b.role, focalPoint: b.focalPoint, blurApproved: b.blurApproved, keepApproved: b.keepApproved, notes: b.notes }));
        }
        if (sub === "versions" && !parts[4] && m === "POST") {
          const b = await json<{ from?: string; label?: string }>(req);
          return send(res, 201, createVersion(id, { from: b.from, label: b.label ?? "" }));
        }
        if (sub === "versions" && parts[4] && !parts[5] && m === "GET") return send(res, 200, versionBundle(id, parts[4]));
        if (sub === "versions" && parts[4] && parts[5] === "script" && m === "PUT") return send(res, 200, saveScript(id, parts[4], await json(req)));
        if (sub === "versions" && parts[4] && parts[5] === "storyboard" && m === "PUT") return send(res, 200, saveStoryboard(id, parts[4], await json(req)));
        if (sub === "versions" && parts[4] && parts[5] === "review" && m === "POST") return send(res, 200, addReview(id, parts[4], await json(req)));
        if (sub === "jobs" && m === "POST") {
          const b = await json<{ type: string; params?: Record<string, unknown> }>(req);
          return send(res, 202, runJob(id, b.type, b.params ?? {}));
        }
      }
      return send(res, 404, { error: `Rută necunoscută: ${m} ${url.pathname}` });
    } catch (e) {
      const status = e instanceof MmsError ? 400 : 500;
      send(res, status, { error: formatError(e), code: e instanceof MmsError ? e.code : "INTERNAL" });
    }
  });
  await new Promise<void>((resolve) => server.listen(o.port, "127.0.0.1", resolve));
  const addr = `http://127.0.0.1:${o.port}`;
  console.log(`\nMotion Marketing Studio rulează la ${addr}\nOprește cu Ctrl+C.`);
  if (o.open) {
    const cmd = process.platform === "win32" ? "cmd" : process.platform === "darwin" ? "open" : "xdg-open";
    const args = process.platform === "win32" ? ["/c", "start", "", addr] : [addr];
    spawn(cmd, args, { detached: true, stdio: "ignore" }).unref();
  }
  return server;
}
