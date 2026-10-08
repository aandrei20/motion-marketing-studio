/**
 * Generează materialele de probă ale catalogului (library/catalog/samples) prin captură REALĂ
 * a produsului demo fictiv din examples/demo-product/site. Rulează: npx tsx scripts/make-catalog-samples.ts
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { capture } from "../src/capture/capture";
import { PATHS } from "../src/core/paths";

const site = path.join(PATHS.examples, "demo-product", "site");
const out = path.join(PATHS.library, "catalog", "samples");
const tmp = path.join(PATHS.cache, "catalog-capture");
fs.mkdirSync(out, { recursive: true });

const app = pathToFileURL(path.join(site, "app.html")).href;
const landing = pathToFileURL(path.join(site, "index.html")).href;

const main = async () => {
  const shot = await capture({ id: "screenshot", url: app, viewport: "desktop" }, tmp);
  const tall = await capture({ id: "tall-screenshot", url: landing, viewport: "desktop", fullPage: true }, tmp);
  const hero = await capture({ id: "image", url: landing, viewport: "desktop" }, tmp);
  const rec = await capture(
    {
      id: "video",
      url: app,
      viewport: "laptop",
      record: { steps: [{ action: "wait", ms: 400 }, { action: "type", selector: "#search", text: "raport", delayMs: 140 }, { action: "wait", ms: 500 }], fps: 30, tailMs: 300 },
    },
    tmp,
  );
  fs.copyFileSync(shot.screenshot, path.join(out, "screenshot.png"));
  fs.copyFileSync(tall.screenshot, path.join(out, "tall-screenshot.png"));
  fs.copyFileSync(hero.screenshot, path.join(out, "image.png"));
  fs.copyFileSync(rec.recording!.file, path.join(out, "video.mp4"));
  fs.copyFileSync(path.join(site, "logo.svg"), path.join(out, "logo.svg"));
  const manifest = {
    note: "Capturi reale ale produsului FICTIV de test (examples/demo-product). Generate de scripts/make-catalog-samples.ts.",
    screenshot: { file: "library/catalog/samples/screenshot.png", w: shot.width, h: shot.height },
    "tall-screenshot": { file: "library/catalog/samples/tall-screenshot.png", w: tall.width, h: tall.height },
    image: { file: "library/catalog/samples/image.png", w: hero.width, h: hero.height },
    video: { file: "library/catalog/samples/video.mp4", w: rec.recording!.width, h: rec.recording!.height, durationSec: rec.recording!.durationSec, fps: rec.recording!.fps },
    logo: { file: "library/catalog/samples/logo.svg", w: 120, h: 120 },
  };
  fs.writeFileSync(path.join(out, "samples.json"), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({ shot: [shot.width, shot.height, shot.regions.length], tall: [tall.width, tall.height], rec: rec.recording }, null, 1));
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
