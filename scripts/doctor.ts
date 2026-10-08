/**
 * npm run doctor – verifică tot ce trebuie ca studioul să meargă și spune exact ce lipsește.
 * Nu instalează nimic (regula 11): dacă ceva lipsește, spune comanda de instalare.
 */
import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { binaryVersion } from "../src/core/binaries";
import { loadEnv, optionalEnv } from "../src/core/env";
import { PATHS } from "../src/core/paths";

const require = createRequire(import.meta.url);
type Level = "ok" | "warn" | "fail";
const results: Array<{ level: Level; name: string; detail: string; fix?: string }> = [];
const add = (level: Level, name: string, detail: string, fix?: string) => results.push({ level, name, detail, fix });
const INSTALL = process.platform === "win32" ? "powershell -ExecutionPolicy Bypass -File install.ps1" : "bash install.sh";

async function main() {
  loadEnv();
  // Node și npm
  const [maj, min] = process.versions.node.split(".").map(Number);
  if (maj > 20 || (maj === 20 && min >= 11)) add("ok", "Node.js", `v${process.versions.node}`);
  else add("fail", "Node.js", `v${process.versions.node} (minim 20.11)`, "Instalează Node.js LTS de la https://nodejs.org sau rulează din nou instalarea.");
  const npm = process.platform === "win32" ? spawnSync("cmd.exe", ["/d", "/s", "/c", "npm --version"], { encoding: "utf8" }) : spawnSync("npm", ["--version"], { encoding: "utf8" });
  if (npm.status === 0) add("ok", "npm", npm.stdout.trim());
  else add("fail", "npm", "nu răspunde", "Reinstalează Node.js (npm vine cu el).");
  try {
    add("ok", "Git", execSync("git --version", { encoding: "utf8" }).trim());
  } catch {
    add("warn", "Git", "lipsește (necesar doar pentru npm run update)", "Instalează Git: https://git-scm.com");
  }
  // dependențe
  const pkgs = ["remotion", "@remotion/renderer", "@remotion/bundler", "@remotion/player", "@remotion/cli", "playwright", "zod", "fontkit", "esbuild", "react", "react-dom"];
  const resolvable = (p: string) => {
    for (const spec of [p, `${p}/package.json`]) {
      try {
        require.resolve(spec);
        return true;
      } catch {
        /* încearcă următoarea formă */
      }
    }
    return fs.existsSync(path.join(PATHS.root, "node_modules", ...p.split("/"), "package.json"));
  };
  const missing = pkgs.filter((p) => !resolvable(p));
  if (missing.length) add("fail", "Dependențe npm", `lipsesc: ${missing.join(", ")}`, `Rulează: npm ci (sau ${INSTALL})`);
  else add("ok", "Dependențe npm", `${pkgs.length} pachete principale`);
  const remotionVersions = new Set(["remotion", "@remotion/renderer", "@remotion/bundler", "@remotion/player", "@remotion/cli"].filter((p) => !missing.includes(p)).map((p) => (JSON.parse(fs.readFileSync(path.join(PATHS.root, "node_modules", ...p.split("/"), "package.json"), "utf8")) as { version: string }).version));
  if (remotionVersions.size > 1) add("fail", "Versiuni Remotion", `diferite: ${[...remotionVersions].join(", ")}`, "Toate pachetele @remotion/* trebuie să aibă aceeași versiune: npm ci");
  // FFmpeg/FFprobe incluse în Remotion
  const ff = binaryVersion("ffmpeg");
  const fp = binaryVersion("ffprobe");
  if (ff && fp) add("ok", "FFmpeg / FFprobe (din Remotion)", ff.split(" ").slice(0, 3).join(" "));
  else add("fail", "FFmpeg / FFprobe (din Remotion)", "nu pornesc", `Rulează din nou instalarea (${INSTALL}).`);
  // browserele
  const remotionBrowser = path.join(PATHS.root, "node_modules", ".remotion", "chrome-headless-shell");
  if (fs.existsSync(remotionBrowser)) add("ok", "Browser de randare (Remotion)", "chrome-headless-shell");
  else add("fail", "Browser de randare (Remotion)", "lipsește", "Rulează: npx remotion browser ensure");
  try {
    const { chromium } = await import("playwright");
    const exe = chromium.executablePath();
    if (fs.existsSync(exe)) add("ok", "Browser de captură (Playwright)", path.basename(path.dirname(path.dirname(exe))));
    else add("fail", "Browser de captură (Playwright)", "lipsește", "Rulează: npx playwright install chromium");
  } catch {
    add("fail", "Browser de captură (Playwright)", "playwright nu se încarcă", "Rulează: npm ci");
  }
  // bibliotecă
  const fonts = JSON.parse(fs.readFileSync(path.join(PATHS.library, "fonts", "fonts.json"), "utf8")) as { fonts: Array<{ file: string }> };
  const missingFonts = fonts.fonts.filter((f) => !fs.existsSync(path.join(PATHS.root, f.file)));
  if (missingFonts.length) add("fail", "Fonturi incluse", `lipsesc ${missingFonts.length}`, "Repo-ul e incomplet: git checkout -- library/fonts");
  else add("ok", "Fonturi incluse", `${fonts.fonts.length} fonturi OFL`);
  const samples = ["screenshot.png", "image.png", "tall-screenshot.png", "video.mp4", "logo.svg"].filter((f) => !fs.existsSync(path.join(PATHS.library, "catalog", "samples", f)));
  if (samples.length) add("warn", "Materiale de catalog", `lipsesc: ${samples.join(", ")}`, "npx tsx scripts/make-catalog-samples.ts");
  else add("ok", "Materiale de catalog", "capturi reale ale produsului demo");
  if (fs.existsSync(path.join(PATHS.library, "registry.json"))) add("ok", "Registry", "library/registry.json");
  else add("warn", "Registry", "lipsește library/registry.json", "npm run registry");
  // foldere și spațiu
  for (const d of [PATHS.projects, PATHS.cache]) {
    try {
      fs.mkdirSync(d, { recursive: true });
      fs.accessSync(d, fs.constants.W_OK);
    } catch {
      add("fail", "Foldere", `nu pot scrie în ${d}`, "Verifică permisiunile folderului.");
    }
  }
  if (/onedrive/i.test(PATHS.root)) add("warn", "Locație", `${PATHS.root} e în OneDrive`, "Mută repo-ul în C:\\dev\\ (regula 13): OneDrive încetinește și blochează fișierele mari.");
  else add("ok", "Locație", PATHS.root);
  try {
    const st = fs.statfsSync(PATHS.root);
    const freeGb = (st.bavail * st.bsize) / 1024 ** 3;
    if (freeGb < 3) add("fail", "Spațiu liber", `${freeGb.toFixed(1)} GB`, "Eliberează spațiu: randările și cache-ul au nevoie de câțiva GB.");
    else if (freeGb < 10) add("warn", "Spațiu liber", `${freeGb.toFixed(1)} GB`, "Recomandat: minimum 10 GB liberi.");
    else add("ok", "Spațiu liber", `${freeGb.toFixed(0)} GB`);
  } catch {
    add("warn", "Spațiu liber", "nu pot măsura");
  }
  // voce
  try {
    const { listVoices } = await import("../src/audio/voice");
    const voices = await listVoices();
    const local = voices.filter((v) => v.provider === "windows" || v.provider === "say");
    if (local.length) add("ok", "Voci TTS locale", local.map((v) => `${v.name} (${v.language})`).join(", "));
    else add("warn", "Voci TTS locale", "niciuna găsită", "Poți folosi vocea ta (fișier), o cheie API (vezi .env.example) sau reclame fără voce.");
  } catch (e) {
    add("warn", "Voci TTS locale", `nu pot lista: ${(e as Error).message}`);
  }
  // configurare
  if (!fs.existsSync(path.join(PATHS.root, ".env"))) add("warn", ".env", "lipsește (opțional)", "Copiază .env.example în .env doar dacă folosești chei API.");
  else add("ok", ".env", `chei setate: ${["ELEVENLABS_API_KEY", "OPENAI_API_KEY", "REMOTION_LICENSE_KEY"].filter((k) => optionalEnv(k)).length}`);

  const icon = { ok: "✓", warn: "!", fail: "✗" } as const;
  console.log("\nMotion Marketing Studio – doctor\n");
  for (const r of results) {
    console.log(`  ${icon[r.level]} ${r.name.padEnd(34)} ${r.detail}`);
    if (r.fix && r.level !== "ok") console.log(`      → ${r.fix}`);
  }
  const fails = results.filter((r) => r.level === "fail").length;
  const warns = results.filter((r) => r.level === "warn").length;
  console.log(`\n${fails ? `✗ ${fails} probleme blochează studioul.` : "✓ Instalarea e completă."}${warns ? ` (${warns} avertismente)` : ""}`);
  if (!fails) console.log("Pornește Studio-ul cu:  npm run studio\n");
  process.exit(fails ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
