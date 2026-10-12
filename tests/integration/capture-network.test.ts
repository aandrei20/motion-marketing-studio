/**
 * Filtrul de rețea al capturii pe o pagină publică (SSRF): resursele spre rețeaua locală sunt oprite înainte
 * să plece, iar o redirecționare spre o adresă locală (pe care Playwright nu o trece prin `route`) oprește
 * captura. „public.test” e mapat în Chromium pe 127.0.0.1 (`--host-resolver-rules`), iar în Node numele nu
 * se rezolvă, deci politica îl tratează ca public: testul nu depinde de internet.
 */
import http from "node:http";
import type { AddressInfo } from "node:net";
import { chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contextNetworkOptions, guardNetwork, type CheckedUrl } from "../../src/capture/url-policy";
import { MmsError } from "../../src/core/errors";

let server: http.Server;
let port = 0;
const hits: string[] = [];
let upgrades = 0;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const host = (req.headers.host ?? "").split(":")[0];
    hits.push(`${host}${req.url}`);
    if (req.url === "/direct") {
      res.writeHead(200, { "Content-Type": "text/html" });
      return res.end(`<img src="http://127.0.0.1:${port}/secret-direct.png"><script>try { new WebSocket("ws://127.0.0.1:${port}/ws") } catch {}</script><h1>pagina</h1>`);
    }
    if (req.url === "/hop") {
      res.writeHead(200, { "Content-Type": "text/html" });
      return res.end(`<img src="http://public.test:${port}/redirect.png"><h1>pagina</h1>`);
    }
    if (req.url === "/redirect.png") {
      res.writeHead(302, { Location: `http://127.0.0.1:${port}/secret-hop.png` });
      return res.end();
    }
    res.writeHead(404);
    res.end();
  });
  server.on("upgrade", (_req, socket) => {
    upgrades++;
    socket.destroy();
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  port = (server.address() as AddressInfo).port;
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

async function openPublic(pathname: string) {
  const start: CheckedUrl = { url: new URL(`http://public.test:${port}${pathname}`), kind: "public" };
  const browser = await chromium.launch({ args: [`--host-resolver-rules=MAP public.test 127.0.0.1`] });
  const ctx = await browser.newContext(contextNetworkOptions(start));
  const guard = await guardNetwork(ctx, start);
  const page = await ctx.newPage();
  await page.goto(start.url.href, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  return { browser, guard, page };
}

describe("filtrul de rețea pentru o pagină publică", () => {
  it("oprește resursele și WebSocket-urile spre rețeaua locală înainte să plece", async () => {
    const { browser, guard, page } = await openPublic("/direct");
    try {
      expect(hits).toContain(`public.test/direct`);
      expect(hits.some((h) => h.includes("secret-direct"))).toBe(false);
      expect(upgrades).toBe(0);
      expect(guard.blocked.some((u) => u.includes("secret-direct"))).toBe(true);
      expect(guard.blocked.some((u) => u.startsWith("ws://127.0.0.1"))).toBe(true);
      // nimic nu a trecut de filtru: captura poate continua
      await expect(guard.assertClean(page)).resolves.toBeUndefined();
    } finally {
      await browser.close();
    }
  }, 60_000);

  it("o redirecționare spre o adresă locală oprește captura înainte de salvare", async () => {
    const { browser, guard, page } = await openPublic("/hop");
    try {
      expect(guard.violations.some((u) => u.includes("127.0.0.1") && u.includes("secret-hop"))).toBe(true);
      const err = await guard.assertClean(page).then(() => null, (e: unknown) => e);
      expect(err).toBeInstanceOf(MmsError);
      expect((err as MmsError).code).toBe("CAPTURE_REDIRECT");
    } finally {
      await browser.close();
    }
  }, 60_000);
});
