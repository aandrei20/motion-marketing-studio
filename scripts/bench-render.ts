/**
 * Benchmark-ul randării: același interval de cadre al unui proiect, randat cu mai multe valori de concurență
 * (procese Chrome în paralel), ca valoarea implicită să vină din măsurători pe mașina ta.
 *
 * Rulează: npm run bench -- <proiect> [--format 9x16] [--seconds 10] [--concurrency 4,6,8,12] [--repeat 1]
 *
 * Închide celelalte aplicații grele înainte: rezultatul e curat doar pe o mașină liniștită. Prima randare
 * (bundle, browser) nu se cronometrează. MP4-urile se scriu în folderul temporar și se șterg la final.
 * Rezultatele rămân în .cache/bench/ (JSON), cu procesorul, memoria și încărcarea de dinainte.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { formatError, MmsError } from "../src/core/errors";
import { writeJson } from "../src/core/json";
import { PATHS } from "../src/core/paths";
import { loadProject, loadTimeline } from "../src/projects/store";
import { closeBrowser, renderTimelineVideo } from "../src/renderer/node/render";

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

/** Cât din procesor e ocupat în această clipă (0–1), măsurat pe o secundă. */
async function cpuBusy(): Promise<number> {
  const snap = () =>
    os.cpus().reduce((a, c) => ({ idle: a.idle + c.times.idle, total: a.total + Object.values(c.times).reduce((s, x) => s + x, 0) }), { idle: 0, total: 0 });
  const a = snap();
  await new Promise((r) => setTimeout(r, 1000));
  const b = snap();
  return 1 - (b.idle - a.idle) / Math.max(1, b.total - a.total);
}

async function main() {
  const id = process.argv[2];
  if (!id || id.startsWith("--")) throw new MmsError("ARG_MISSING", "Lipsește proiectul.", "npm run bench -- <proiect> [--format 9x16] [--seconds 10]");
  const project = loadProject(id);
  if (!project.currentVersion) throw new MmsError("NO_VERSION", `Proiectul ${id} nu are încă o versiune.`, "Compilează întâi timeline-ul.");
  const format = flag("format") ?? project.formats[0].id;
  const t = loadTimeline(id, project.currentVersion, format);
  const seconds = Number(flag("seconds") ?? 10);
  const frames = Math.min(t.durationInFrames, Math.round(seconds * t.fps));
  const cpus = os.cpus().length;
  const levels = (flag("concurrency") ?? [4, 6, 8, 12].filter((c) => c <= cpus).join(","))
    .split(",")
    .map(Number)
    .filter((c) => Number.isInteger(c) && c >= 1 && c <= cpus);
  const repeat = Math.max(1, Number(flag("repeat") ?? 1));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mms-bench-"));
  const busy = await cpuBusy();
  const machine = {
    cpu: os.cpus()[0]?.model.trim(),
    cpus,
    memGB: +(os.totalmem() / 1024 ** 3).toFixed(1),
    freeGB: +(os.freemem() / 1024 ** 3).toFixed(1),
    busyBefore: +busy.toFixed(2),
  };
  console.log(`${machine.cpu} · ${cpus} nuclee logice · ${machine.memGB} GB (liberi ${machine.freeGB}) · procesor ocupat înainte: ${(busy * 100).toFixed(0)}%`);
  if (busy > 0.15) console.log("Atenție: procesorul e deja ocupat; rezultatul nu e un benchmark curat.");
  console.log(`${id} ${project.currentVersion} ${format}: ${t.width}×${t.height} @ ${t.fps} fps, ${frames} cadre (${(frames / t.fps).toFixed(1)} s)\n`);
  try {
    // încălzirea: bundle-ul și browserul, necronometrate
    await renderTimelineVideo(t, { out: path.join(dir, "warmup.mp4"), frameRange: [0, Math.min(frames, t.fps) - 1] });
    const rows: Array<{ concurrency: number; sec: number; fps: number; xRealtime: number }> = [];
    for (let r = 0; r < repeat; r++)
      for (const c of levels) {
        const out = path.join(dir, `c${c}-r${r}.mp4`);
        const started = performance.now();
        await renderTimelineVideo(t, { out, frameRange: [0, frames - 1], concurrency: c });
        const sec = (performance.now() - started) / 1000;
        fs.rmSync(out, { force: true });
        const row = { concurrency: c, sec: +sec.toFixed(1), fps: +(frames / sec).toFixed(1), xRealtime: +(sec / (frames / t.fps)).toFixed(2) };
        rows.push(row);
        console.log(
          `concurență ${String(c).padStart(2)}: ${row.sec.toFixed(1).padStart(6)} s · ${row.fps.toFixed(1).padStart(5)} cadre/s · ${row.xRealtime.toFixed(2)}× durata`,
        );
      }
    const best = new Map<number, number>();
    for (const r of rows) best.set(r.concurrency, Math.min(best.get(r.concurrency) ?? Infinity, r.sec));
    const sorted = [...best.entries()].sort((a, b) => a[1] - b[1]);
    const [fastest, slowest] = [sorted[0], sorted[sorted.length - 1]];
    // sub 5% între cea mai rapidă și cea mai lentă: zgomotul măsurării, nu o diferență reală
    if (slowest[1] / fastest[1] < 1.05)
      console.log(
        "\nDiferențele sunt sub 5% (zgomotul măsurării): concurența nu e limita pe această mașină (de regulă e GPU-ul). Păstrează valoarea implicită.",
      );
    else console.log(`\nCea mai rapidă: concurența ${fastest[0]} (${fastest[1].toFixed(1)} s). Se fixează cu MMS_RENDER_CONCURRENCY în .env.`);
    const file = path.join(PATHS.cache, "bench", `${new Date().toISOString().replace(/[:.]/g, "-")}-${id}-${format}.json`);
    writeJson(file, {
      at: new Date().toISOString(),
      machine,
      project: id,
      version: project.currentVersion,
      format,
      width: t.width,
      height: t.height,
      fps: t.fps,
      frames,
      rows,
    });
    console.log(`Rezultatele: ${path.relative(PATHS.root, file)}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    await closeBrowser();
  }
}

main().catch(async (e) => {
  console.error(`\nEroare: ${formatError(e)}`);
  await closeBrowser().catch(() => undefined);
  process.exit(1);
});
