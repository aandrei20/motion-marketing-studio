import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { MmsError } from "./errors";

/**
 * FFmpeg și FFprobe vin împreună cu Remotion (pachetul @remotion/compositor-<platformă>).
 * Nu cerem o instalare separată; dacă utilizatorul are FFmpeg în PATH, îl preferăm pe cel din Remotion
 * pentru reproductibilitate.
 */
const require = createRequire(import.meta.url);

function compositorDir(): string {
  const p = process.platform;
  const a = process.arch;
  const candidates =
    p === "win32"
      ? [`@remotion/compositor-win32-${a}-msvc`]
      : p === "darwin"
        ? [`@remotion/compositor-darwin-${a}`]
        : [`@remotion/compositor-linux-${a}-gnu`, `@remotion/compositor-linux-${a}-musl`];
  for (const name of candidates) {
    try {
      return path.dirname(require.resolve(`${name}/package.json`));
    } catch {
      /* încearcă următorul */
    }
  }
  throw new MmsError(
    "BINARY_MISSING",
    `Nu găsesc pachetul compozitorului Remotion pentru ${p}-${a}.`,
    "Rulează din nou instalarea (install.ps1 sau install.sh).",
  );
}

export function binaryPath(name: "ffmpeg" | "ffprobe"): string {
  const dir = compositorDir();
  const file = path.join(dir, process.platform === "win32" ? `${name}.exe` : name);
  if (!fs.existsSync(file)) throw new MmsError("BINARY_MISSING", `Lipsește ${file}.`, "Rulează din nou instalarea.");
  return file;
}

export interface RunResult {
  code: number;
  stdout: Buffer;
  stderr: string;
}

/**
 * Rulează un binar și strânge ieșirea. Aruncă eroare clară dacă procesul eșuează.
 * Procesul pornește în folderul binarului (bibliotecile lui stau acolo), deci căile din `args`
 * trebuie să fie absolute.
 */
export function runBinary(bin: string, args: string[], opts: { allowFail?: boolean; input?: Buffer } = {}): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(bin);
    const env = process.platform === "linux" ? { ...process.env, LD_LIBRARY_PATH: dir } : process.env;
    const child = spawn(bin, args, { cwd: dir, env, windowsHide: true });
    const out: Buffer[] = [];
    let err = "";
    child.stdout.on("data", (d: Buffer) => out.push(d));
    child.stderr.on("data", (d: Buffer) => {
      err += d.toString();
      if (err.length > 200_000) err = err.slice(-100_000);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      const r = { code: code ?? -1, stdout: Buffer.concat(out), stderr: err };
      if (r.code !== 0 && !opts.allowFail) {
        reject(new MmsError("BINARY_FAILED", `${path.basename(bin)} a eșuat (cod ${r.code}):\n${err.slice(-1500)}`));
      } else resolve(r);
    });
    if (opts.input) child.stdin.end(opts.input);
    else child.stdin.end();
  });
}

export function ffmpeg(args: string[], opts?: { allowFail?: boolean; input?: Buffer }): Promise<RunResult> {
  return runBinary(binaryPath("ffmpeg"), ["-hide_banner", "-nostdin", ...args], opts);
}

export function ffprobe(args: string[]): Promise<RunResult> {
  return runBinary(binaryPath("ffprobe"), ["-hide_banner", ...args]);
}

export function binaryVersion(name: "ffmpeg" | "ffprobe"): string | null {
  try {
    const r = spawnSync(binaryPath(name), ["-version"], { windowsHide: true, encoding: "utf8" });
    return r.status === 0 ? (r.stdout.split("\n")[0] ?? null) : null;
  } catch {
    return null;
  }
}
