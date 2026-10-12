/**
 * Ce adrese poate deschide captura (protecție SSRF pentru un studio local).
 *
 *  - Adresa de start o dă utilizatorul: http, https sau file (o machetă locală). Fără nume/parolă în adresă
 *    (ar ajunge în manifeste și loguri) și niciodată serviciile de metadate ale norilor (chei, tokenuri).
 *  - Aplicația ta pe localhost sau în rețeaua locală se poate captura: adresa de start locală e intenția ta.
 *  - O pagină PUBLICĂ nu poate trage captura în rețeaua locală: redirecționările, iframe-urile și resursele
 *    spre localhost, IP-uri private sau nume care se rezolvă la IP-uri private sunt blocate, iar o pagină
 *    care ajunge totuși pe o adresă locală oprește captura înainte să se salveze ceva.
 *
 * Limite cunoscute: o redirecționare spre o adresă locală se vede abia după ce cererea a plecat (captura se
 * oprește, dar cererea GET a ajuns la serviciul local); numele se rezolvă separat în Node și în Chromium, deci
 * un DNS care se schimbă între cele două (DNS rebinding) nu e prins.
 */
import dns from "node:dns";
import net from "node:net";
import type { BrowserContext } from "playwright";
import { MmsError } from "../core/errors";

export type HostKind = "public" | "local" | "metadata";

/** Serviciile de metadate ale norilor (AWS, GCP, Azure, Alibaba, Oracle): nu se deschid niciodată. */
const METADATA_HOSTS = new Set(["169.254.169.254", "169.254.170.2", "100.100.100.200", "fd00:ec2::254", "metadata.google.internal", "metadata.azure.com", "metadata"]);
const LOCAL_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".home.arpa", ".intranet", ".corp"];

function ipv4Kind(ip: string): HostKind {
  const [a, b] = ip.split(".").map(Number);
  if (METADATA_HOSTS.has(ip)) return "metadata";
  if (a === 0 || a === 10 || a === 127) return "local";
  if (a === 169 && b === 254) return "local";
  if (a === 172 && b >= 16 && b <= 31) return "local";
  if (a === 192 && b === 168) return "local";
  if (a === 100 && b >= 64 && b <= 127) return "local";
  if (a >= 224) return "local";
  return "public";
}

function ipv6Kind(ip: string): HostKind {
  const x = ip.toLowerCase();
  if (METADATA_HOSTS.has(x)) return "metadata";
  const mapped = x.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return ipv4Kind(mapped[1]);
  if (x === "::" || x === "::1") return "local";
  if (/^f[cd]/.test(x) || /^fe[89ab]/.test(x) || /^ff/.test(x)) return "local";
  return "public";
}

/** Tipul unei gazde după nume sau IP literal (fără rezolvare DNS). */
export function hostKind(hostname: string): HostKind {
  const h = hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
  if (METADATA_HOSTS.has(h)) return "metadata";
  const v = net.isIP(h);
  if (v === 4) return ipv4Kind(h);
  if (v === 6) return ipv6Kind(h);
  if (h === "localhost" || LOCAL_SUFFIXES.some((s) => h.endsWith(s))) return "local";
  // un nume fără punct se rezolvă în rețeaua locală (de ex. „router”)
  if (!h.includes(".")) return "local";
  return "public";
}

/** Tipul gazdei după rezolvarea DNS: un nume public care duce la un IP privat e local. */
export async function resolvedHostKind(hostname: string): Promise<HostKind> {
  const literal = hostKind(hostname);
  if (literal !== "public" || net.isIP(hostname.replace(/^\[|\]$/g, ""))) return literal;
  try {
    const addrs = await dns.promises.lookup(hostname, { all: true, verbatim: true });
    const kinds = addrs.map((a) => (a.family === 4 ? ipv4Kind(a.address) : ipv6Kind(a.address)));
    if (kinds.includes("metadata")) return "metadata";
    if (kinds.includes("local")) return "local";
  } catch {
    /* numele nu se rezolvă: navigarea va eșua oricum, cu eroarea ei */
  }
  return "public";
}

export interface CheckedUrl {
  url: URL;
  /** „file” = machetă locală; „local” = localhost sau rețeaua locală; „public” = internet */
  kind: "public" | "local" | "file";
}

/** Verifică adresa de start a unei capturi. Aruncă MmsError cu indicație dacă nu se poate deschide. */
export async function checkCaptureUrl(raw: string): Promise<CheckedUrl> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new MmsError("CAPTURE_URL", `Adresa „${String(raw).slice(0, 120)}” nu e validă.`, "Scrie adresa completă, cu https:// (de ex. https://exemplu.ro).");
  }
  if (url.protocol === "file:") return { url, kind: "file" };
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new MmsError("CAPTURE_URL", `Captura deschide doar adrese http, https sau file (primit: ${url.protocol}).`, "Scrie adresa paginii, cu https://.");
  if (url.username || url.password) throw new MmsError("CAPTURE_URL", "Adresa conține un nume de utilizator sau o parolă.", "Nu pune date de autentificare în adresă: ar rămâne în manifeste și loguri. Autentifică-te cu: npm run mms -- login --url … --profile …");
  const kind = await resolvedHostKind(url.hostname);
  if (kind === "metadata") throw new MmsError("CAPTURE_URL", `Adresa ${url.hostname} e un serviciu intern de metadate și nu se capturează.`, "Folosește adresa publică a produsului.");
  return { url, kind };
}

/** Un pas „goto” al capturii: aceleași reguli ca adresa de start, iar o pagină publică nu duce pașii în rețeaua locală. */
export async function checkStepUrl(start: CheckedUrl, raw: string): Promise<void> {
  const step = await checkCaptureUrl(raw);
  if (start.kind === "public" && step.kind !== "public") throw new MmsError("CAPTURE_URL", `Pasul „goto ${step.url.href.slice(0, 120)}” duce captura unei pagini publice pe o adresă locală.`, "Capturează aplicația locală separat, cu adresa ei de start.");
}

export interface NetworkGuard {
  /** cererile oprite înainte să plece (adrese locale sau de metadate) */
  blocked: string[];
  /** cererile spre adrese locale care nu au putut fi oprite înainte (pașii unei redirecționări) */
  violations: string[];
  /** Aruncă dacă pagina publică a atins rețeaua locală; se cheamă înainte de a salva ceva. */
  assertClean(page?: { url(): string }): Promise<void>;
}

const httpHost = (raw: string): string | null => {
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:" || u.protocol === "ws:" || u.protocol === "wss:" ? u.hostname : null;
  } catch {
    return null;
  }
};

/**
 * Pentru o pagină de start publică: blochează cererile spre rețeaua locală și spre metadate (iframe-uri,
 * imagini, scripturi, WebSocket). Playwright nu trece prin `route` pașii unei redirecționări: aceia se
 * observă din evenimentele cererilor, iar `assertClean` oprește captura înainte de salvare. Service
 * worker-ii se blochează din opțiunile contextului (`contextNetworkOptions`), altfel cererile lor ar ocoli
 * filtrul. Pentru o adresă de start locală nu face nimic (fără cost pe aplicația ta din localhost).
 */
export async function guardNetwork(ctx: BrowserContext, start: CheckedUrl): Promise<NetworkGuard> {
  const blocked: string[] = [];
  const violations: string[] = [];
  const pending: Promise<void>[] = [];
  const guard: NetworkGuard = {
    blocked,
    violations,
    async assertClean(page) {
      await Promise.all(pending);
      if (page) await assertStillPublic(start, page.url());
      if (violations.length)
        throw new MmsError("CAPTURE_REDIRECT", `Pagina ${start.url.href} a încercat să ducă captura pe o adresă locală (${violations[0]}); captura s-a oprit și nu s-a salvat nimic.`, "Verifică adresa; o pagină publică nu are voie să deschidă rețeaua ta locală.");
    },
  };
  if (start.kind !== "public") return guard;
  const kinds = new Map<string, Promise<HostKind>>();
  const kindOf = (host: string): Promise<HostKind> => {
    if (!kinds.has(host)) kinds.set(host, resolvedHostKind(host));
    return kinds.get(host)!;
  };
  await ctx.route("**/*", async (route) => {
    const host = httpHost(route.request().url());
    if (host === null) return route.continue();
    if ((await kindOf(host)) !== "public") {
      blocked.push(route.request().url().slice(0, 200));
      return route.abort("blockedbyclient");
    }
    return route.continue();
  });
  await ctx.routeWebSocket(/.*/, async (ws) => {
    const host = httpHost(ws.url());
    if (host !== null && (await kindOf(host)) !== "public") {
      blocked.push(ws.url().slice(0, 200));
      return ws.close();
    }
    ws.connectToServer();
  });
  ctx.on("request", (req) => {
    if (!req.redirectedFrom()) return;
    const url = req.url();
    const host = httpHost(url);
    if (host === null) {
      if (url.startsWith("file:")) violations.push(url.slice(0, 200));
      return;
    }
    pending.push(
      kindOf(host).then((k) => {
        if (k !== "public") violations.push(url.slice(0, 200));
      }),
    );
  });
  return guard;
}

/** Opțiunile de context care țin filtrul complet: service worker-ii ar ocoli `route`, deci se blochează pe paginile publice. */
export function contextNetworkOptions(start: CheckedUrl): { serviceWorkers: "allow" | "block" } {
  return { serviceWorkers: start.kind === "public" ? "block" : "allow" };
}

/** O pagină publică ajunsă totuși pe o adresă locală (de ex. prin redirecționare) oprește captura. */
export async function assertStillPublic(start: CheckedUrl, finalUrl: string): Promise<void> {
  if (start.kind !== "public") return;
  let u: URL;
  try {
    u = new URL(finalUrl);
  } catch {
    return;
  }
  if (u.protocol === "about:" || u.protocol === "data:") return;
  const k = u.protocol === "file:" ? "local" : await resolvedHostKind(u.hostname);
  if (k !== "public") throw new MmsError("CAPTURE_REDIRECT", `Pagina ${start.url.href} a dus captura pe o adresă locală (${u.host || u.protocol}); captura s-a oprit și nu s-a salvat nimic.`, "Verifică adresa; o pagină publică nu are voie să deschidă rețeaua ta locală.");
}
