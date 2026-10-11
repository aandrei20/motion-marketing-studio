/**
 * Datele paginii din captura reală: butoanele (inclusiv linkurile stilizate ca butoane), titlurile fără
 * meniu și subsol, logo-ul din antet. Pagina e un fișier local, ca testul să nu depindă de internet.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { capture } from "../../src/capture/capture";

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>Pagină de test</title><style>
body { font-family: sans-serif; margin: 0 }
header { display: flex; gap: 12px; padding: 12px }
nav a { padding: 8px 14px; color: #222; text-decoration: none }
.primary { background: #2563eb; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none }
.outline { border: 1px solid #2563eb; padding: 10px 20px; text-decoration: none }
.wordy { background: #2563eb; color: #fff; padding: 10px 20px }
</style></head><body>
<header>
  <a href="index.html" class="site-logo"><svg width="120" height="32" viewBox="0 0 120 32"><rect width="120" height="32" fill="currentColor"/></svg></a>
  <nav><a href="#functii">Funcții</a><a href="#preturi">Prețuri</a><a href="#ajutor">Ajutor</a><h3>Titlu din meniu</h3></nav>
</header>
<main>
  <h1>Titlul principal</h1>
  <a class="primary" href="#cont">Încearcă gratuit</a>
  <a class="outline" href="#demo">Cere o demonstrație</a>
  <a class="wordy" href="#lung">Un link cu prea multe cuvinte ca să fie un buton adevărat</a>
  <a href="#mai-mult">Citește mai mult</a>
</main>
<footer><h4>Titlu din subsol</h4></footer>
</body></html>`;

describe("datele paginii din captură", () => {
  it("găsește butoanele reale, ignoră linkurile transparente din meniu, titlurile din meniu și subsol, și ia logo-ul", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mms-capture-"));
    const file = path.join(dir, "index.html");
    fs.writeFileSync(file, PAGE);
    const r = await capture({ id: "pagina", url: pathToFileURL(file).href, viewport: "desktop" }, path.join(dir, "out"));
    // linkurile cu fundal sau contur și padding sunt butoane; cele transparente din meniu (doar cu padding) nu
    expect(r.page.buttons).toEqual(["Încearcă gratuit", "Cere o demonstrație"]);
    const headings = r.page.headings.map((h) => h.text);
    expect(headings).toContain("Titlul principal");
    expect(headings).not.toContain("Titlu din meniu");
    expect(headings).not.toContain("Titlu din subsol");
    expect(r.logo?.source).toBe("inline-svg");
    expect(fs.readFileSync(r.logo!.file, "utf8")).toContain("<rect");
  }, 120_000);
});
