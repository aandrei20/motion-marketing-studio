/**
 * Verificări automate ale regulilor din CLAUDE.md care se pot verifica pe cod:
 *  - regula 4: niciun nume de produs în src/ și library/ (lista fixă + numele produselor din projects/)
 *  - regula 19: nicio cheie API în fișierele urmărite de Git
 *  - regula 18: fără Math.random() / Date.now() în codul de randare (src/motion, src/renderer/composition)
 * Rulează: npm run lint
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { PATHS } from "../src/core/paths";

export interface LintProblem {
  rule: string;
  file: string;
  line: number;
  text: string;
}

const FIXED_NAMES = ["Spotify", "Kolibri"];

function productNames(): string[] {
  const names = new Set(FIXED_NAMES);
  if (fs.existsSync(PATHS.projects)) {
    for (const d of fs.readdirSync(PATHS.projects)) {
      const f = path.join(PATHS.projects, d, "project.json");
      if (!fs.existsSync(f)) continue;
      try {
        const p = JSON.parse(fs.readFileSync(f, "utf8")) as { product?: { name?: string } };
        if (p.product?.name && p.product.name.length >= 4) names.add(p.product.name);
      } catch {
        /* proiect corupt: îl ignorăm aici */
      }
    }
  }
  return [...names];
}

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|json|md|css|html)$/.test(e.name)) out.push(p);
  }
  return out;
}

export function lintRules(): LintProblem[] {
  const problems: LintProblem[] = [];
  const names = productNames();
  const engineFiles = [...walk(path.join(PATHS.root, "src")), ...walk(PATHS.library)];
  for (const f of engineFiles) {
    const lines = fs.readFileSync(f, "utf8").split(/\r?\n/);
    lines.forEach((l, i) => {
      for (const n of names) {
        if (new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(l)) problems.push({ rule: "regula 4: fără nume de produs în motor", file: path.relative(PATHS.root, f), line: i + 1, text: l.trim().slice(0, 120) });
      }
    });
  }
  // determinism în codul care se randează
  const renderFiles = [...walk(path.join(PATHS.root, "src", "motion")), ...walk(path.join(PATHS.root, "src", "renderer", "composition"))];
  for (const f of renderFiles) {
    fs.readFileSync(f, "utf8")
      .split(/\r?\n/)
      .forEach((l, i) => {
        if (/Math\.random\(|Date\.now\(|new Date\(|performance\.now\(/.test(l) && !/\/\/ ok-determinism/.test(l)) problems.push({ rule: "regula 18: determinism", file: path.relative(PATHS.root, f), line: i + 1, text: l.trim().slice(0, 120) });
      });
  }
  // secrete în fișierele urmărite de Git
  let tracked: string[] = [];
  try {
    tracked = execSync("git ls-files", { cwd: PATHS.root, encoding: "utf8" }).split("\n").filter(Boolean);
  } catch {
    tracked = [];
  }
  const SECRET = /(sk-ant-[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{32,}|AKIA[0-9A-Z]{16}|xi-api-key\s*[:=]\s*["'][A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{30,}|-----BEGIN (RSA |EC )?PRIVATE KEY-----)/;
  for (const rel of tracked) {
    if (/\.(png|jpe?g|mp4|wav|ttf|docx|svg|ico)$/i.test(rel)) continue;
    const f = path.join(PATHS.root, rel);
    if (!fs.existsSync(f) || fs.statSync(f).size > 2_000_000) continue;
    fs.readFileSync(f, "utf8")
      .split(/\r?\n/)
      .forEach((l, i) => {
        if (SECRET.test(l)) problems.push({ rule: "regula 19: secret în Git", file: rel, line: i + 1, text: "(ascuns)" });
      });
    if (/^\.env$/.test(path.basename(rel))) problems.push({ rule: "regula 19: .env urmărit de Git", file: rel, line: 0, text: "" });
  }
  return problems;
}

if (process.argv[1] && process.argv[1].endsWith("lint-rules.ts")) {
  const p = lintRules();
  for (const x of p) console.error(`${x.file}:${x.line}  [${x.rule}]  ${x.text}`);
  if (p.length) {
    console.error(`\n${p.length} probleme.`);
    process.exit(1);
  }
  console.log("Regulile verificabile automat sunt respectate (nume de produs, determinism, secrete).");
}
