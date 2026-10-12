/**
 * Proxy-ul de filtrare al capturii unei pagini publice: Chromium trimite prin el fiecare cerere (resurse,
 * iframe-uri, pașii redirecționărilor, WebSocket, HTTPS prin CONNECT). Proxy-ul rezolvă singur numele,
 * refuză orice adresă din rețeaua locală sau a metadatelor norilor și se conectează exact la IP-ul verificat.
 * Așa se închid cele două limite ale filtrului din browser: o redirecționare spre o adresă locală e oprită
 * înainte să plece, iar un DNS care se schimbă între verificare și conectare (DNS rebinding) nu mai contează.
 *
 * Ascultă doar pe 127.0.0.1, pe un port ales de sistem, cât durează captura.
 */
import dns from "node:dns";
import http from "node:http";
import net from "node:net";
import type { Duplex } from "node:stream";
import { type HostKind, hostKind } from "./url-policy";

export interface LookupResult {
  address: string;
  family: number;
}

export interface FilterProxyOptions {
  /** rezolvarea numelor; implicit DNS-ul sistemului (testele o înlocuiesc) */
  lookup?: (host: string) => Promise<LookupResult[]>;
  /** tipul unei adrese rezolvate; implicit după IP (testele o înlocuiesc) */
  classify?: (host: string, address: string) => HostKind;
  /** cât așteaptă conectarea la server */
  connectTimeoutMs?: number;
}

export interface FilterProxy {
  /** adresa pentru Chromium (`proxy.server`) */
  server: string;
  /** cererile refuzate (rețea locală, metadate, nume nerezolvate) */
  blocked: string[];
  close(): Promise<void>;
}

const systemLookup = (host: string): Promise<LookupResult[]> => dns.promises.lookup(host, { all: true, verbatim: true });

type Decision = { ok: true; address: string; family: number } | { ok: false; why: string };

/** host:port dintr-o cerere CONNECT („exemplu.ro:443”, „[2606:4700::1]:443”). */
function splitHostPort(target: string): { host: string; port: number } | null {
  const m = target.match(/^\[([^\]]+)\]:(\d+)$/) ?? target.match(/^([^:]+):(\d+)$/);
  return m ? { host: m[1], port: Number(m[2]) } : null;
}

export async function startFilterProxy(o: FilterProxyOptions = {}): Promise<FilterProxy> {
  const lookup = o.lookup ?? systemLookup;
  const classify = o.classify ?? ((_host: string, address: string) => hostKind(address));
  const timeout = o.connectTimeoutMs ?? 30_000;
  const blocked: string[] = [];
  const sockets = new Set<Duplex>();

  const decide = async (rawHost: string): Promise<Decision> => {
    const host = rawHost.replace(/^\[|\]$/g, "");
    // numele locale (localhost, *.local, fără punct) nu se rezolvă deloc
    const byName = hostKind(host);
    if (byName !== "public") return { ok: false, why: byName };
    let addrs: LookupResult[];
    try {
      addrs = net.isIP(host) ? [{ address: host, family: net.isIP(host) }] : await lookup(host);
    } catch {
      return { ok: false, why: "nume nerezolvat" };
    }
    if (!addrs.length) return { ok: false, why: "nume nerezolvat" };
    // toate adresele numelui trebuie să fie publice: altfel conectarea ar putea ajunge pe cea locală
    for (const a of addrs) {
      const k = classify(host, a.address);
      if (k !== "public") return { ok: false, why: k };
    }
    return { ok: true, address: addrs[0].address, family: addrs[0].family };
  };

  const track = (s: Duplex) => {
    sockets.add(s);
    s.on("close", () => sockets.delete(s));
  };

  /** Tunel TCP spre IP-ul verificat (HTTPS și WSS prin CONNECT, WebSocket simplu prin upgrade). */
  const tunnel = (client: Duplex, address: string, port: number, onOpen: (up: net.Socket) => void) => {
    const up = net.connect({ host: address, port, timeout });
    track(up);
    up.once("connect", () => {
      up.setTimeout(0);
      onOpen(up);
      up.pipe(client);
      client.pipe(up);
    });
    up.on("timeout", () => up.destroy());
    up.on("error", () => client.destroy());
    client.on("error", () => up.destroy());
  };

  const server = http.createServer(async (req, res) => {
    let u: URL;
    try {
      u = new URL(req.url ?? "");
    } catch {
      res.writeHead(400).end();
      return;
    }
    if (u.protocol !== "http:") {
      res.writeHead(400).end();
      return;
    }
    const d = await decide(u.hostname);
    if (!d.ok) {
      blocked.push(u.href.slice(0, 200));
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" }).end(`blocat: ${d.why}`);
      return;
    }
    const headers = { ...req.headers };
    delete headers["proxy-connection"];
    delete headers["proxy-authorization"];
    const up = http.request(
      { host: d.address, family: d.family, port: Number(u.port || 80), method: req.method, path: `${u.pathname}${u.search}`, headers, setHost: false, timeout },
      (r) => {
        res.writeHead(r.statusCode ?? 502, r.headers);
        r.pipe(res);
      },
    );
    up.on("timeout", () => up.destroy(new Error("timeout")));
    up.on("error", () => {
      if (!res.headersSent) res.writeHead(502);
      res.end();
    });
    req.pipe(up);
  });

  server.on("connect", async (req: http.IncomingMessage, client: Duplex, head: Buffer) => {
    track(client);
    const target = splitHostPort(req.url ?? "");
    const d = target ? await decide(target.host) : ({ ok: false, why: "țintă invalidă" } as Decision);
    if (!target || !d.ok) {
      blocked.push(String(req.url).slice(0, 200));
      client.end("HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n");
      return;
    }
    tunnel(client, d.address, target.port, (up) => {
      client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (head.length) up.write(head);
    });
  });

  server.on("upgrade", async (req: http.IncomingMessage, client: Duplex, head: Buffer) => {
    track(client);
    let u: URL | null = null;
    try {
      u = new URL(req.url ?? "");
    } catch {
      u = null;
    }
    const d = u ? await decide(u.hostname) : ({ ok: false, why: "țintă invalidă" } as Decision);
    if (!u || !d.ok) {
      blocked.push(String(req.url).slice(0, 200));
      client.end("HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n");
      return;
    }
    const url = u;
    tunnel(client, d.address, Number(url.port || 80), (up) => {
      const lines = [`${req.method} ${url.pathname}${url.search} HTTP/1.1`];
      for (let i = 0; i < req.rawHeaders.length; i += 2) if (!/^proxy-/i.test(req.rawHeaders[i])) lines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
      up.write(`${lines.join("\r\n")}\r\n\r\n`);
      if (head.length) up.write(head);
    });
  });

  server.on("connection", track);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as net.AddressInfo).port;
  return {
    server: `http://127.0.0.1:${port}`,
    blocked,
    close: () =>
      new Promise<void>((resolve) => {
        for (const s of sockets) s.destroy();
        server.close(() => resolve());
      }),
  };
}
