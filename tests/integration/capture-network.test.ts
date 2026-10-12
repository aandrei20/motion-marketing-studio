/**
 * Filtrul de rețea al capturii pe o pagină publică (SSRF), fără internet: un server local joacă rolul
 * site-ului public „public.test”, iar proxy-ul de filtrare primește o rezolvare de test care îl tratează ca
 * public. Orice altă adresă locală trebuie oprită înainte să ajungă la server: resurse, WebSocket, pașii unei
 * redirecționări și un nume care „devine” local abia la conectare (DNS rebinding).
 */
import http from "node:http";
import type { AddressInfo } from "node:net";
import { chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startFilterProxy } from "../../src/capture/filter-proxy";
import { type CheckedUrl, contextNetworkOptions, guardNetwork, hostKind } from "../../src/capture/url-policy";
import { MmsError } from "../../src/core/errors";

let server: http.Server;
let port = 0;
const hits: string[] = [];
let upgrades = 0;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const host = (req.headers.host ?? "").split(":")[0];
    hits.push(`${host}${req.url}`);
    const page = (body: string) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`${body}<h1>pagina</h1>`);
    };
    if (req.url === "/direct")
      return page(`<img src="http://127.0.0.1:${port}/secret-direct.png"><script>try { new WebSocket("ws://127.0.0.1:${port}/ws") } catch {}</script>`);
    if (req.url === "/hop") return page(`<img src="http://public.test:${port}/redirect.png">`);
    if (req.url === "/rebind") return page(`<img src="http://rebind.test:${port}/secret-rebind.png">`);
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
  // „public.test” e site-ul public al testului; „rebind.test” pare public la verificare, dar proxy-ul îl rezolvă local
  const proxy = await startFilterProxy({
    lookup: async (h) => (h === "public.test" || h === "rebind.test" ? [{ address: "127.0.0.1", family: 4 }] : []),
    classify: (h, ip) => (h === "public.test" ? "public" : hostKind(ip)),
  });
  const browser = await chromium.launch({ proxy: { server: proxy.server } });
  const ctx = await browser.newContext(contextNetworkOptions(start));
  const guard = await guardNetwork(ctx, start);
  const page = await ctx.newPage();
  await page.goto(start.url.href, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  return {
    guard,
    page,
    proxy,
    close: async () => {
      await browser.close();
      await proxy.close();
    },
  };
}

describe("filtrul de rețea pentru o pagină publică", () => {
  it("oprește resursele și WebSocket-urile spre rețeaua locală înainte să plece", async () => {
    const { guard, page, close } = await openPublic("/direct");
    try {
      expect(hits).toContain("public.test/direct");
      expect(hits.some((h) => h.includes("secret-direct"))).toBe(false);
      expect(upgrades).toBe(0);
      expect(guard.blocked.some((u) => u.includes("secret-direct"))).toBe(true);
      expect(guard.blocked.some((u) => u.startsWith("ws://127.0.0.1"))).toBe(true);
      await expect(guard.assertClean(page)).resolves.toBeUndefined();
    } finally {
      await close();
    }
  }, 60_000);

  it("o redirecționare spre o adresă locală e oprită de proxy înainte să plece, iar captura se oprește", async () => {
    const { guard, page, proxy, close } = await openPublic("/hop");
    try {
      expect(hits).toContain("public.test/redirect.png");
      // cererea redirecționată nu ajunge la serviciul local
      expect(hits.some((h) => h.includes("secret-hop"))).toBe(false);
      expect(proxy.blocked.some((u) => u.includes("127.0.0.1") && u.includes("secret-hop"))).toBe(true);
      const err = await guard.assertClean(page).then(
        () => null,
        (e: unknown) => e,
      );
      expect(err).toBeInstanceOf(MmsError);
      expect((err as MmsError).code).toBe("CAPTURE_REDIRECT");
    } finally {
      await close();
    }
  }, 60_000);

  it("un nume care se rezolvă local abia la conectare (DNS rebinding) nu ajunge la server", async () => {
    const { proxy, close } = await openPublic("/rebind");
    try {
      expect(hits.some((h) => h.includes("secret-rebind"))).toBe(false);
      expect(proxy.blocked.some((u) => u.includes("rebind.test"))).toBe(true);
    } finally {
      await close();
    }
  }, 60_000);
});
