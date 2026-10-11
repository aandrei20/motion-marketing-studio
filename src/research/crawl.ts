/**
 * Research pe site: pornind de la pagina principală, se citesc paginile relevante ale aceluiași domeniu
 * (prețuri, funcții, documentație, ajutor, noutăți, blog), cu captură reală (Playwright), și se extrag
 * afirmațiile cu citat, sursă, dată și încredere. Paginile concurenților (date explicit de utilizator)
 * intră ca surse „competitor”, cu afirmațiile mereu „de confirmat”.
 *
 * Paginile de research nu devin materiale ale reclamei (manifestul rămâne curat); capturile lor stau în
 * captures/research/ pentru trasabilitate.
 */
import path from "node:path";
import { ingestCapture } from "../assets/ingest";
import { capture } from "../capture/capture";
import { MmsError } from "../core/errors";
import type { Research, SourceKind } from "../core/schema";
import { loadAssets, loadResearch, projectDir, saveResearch, updateState } from "../projects/store";
import { extractFromPage, mergeIntoResearch, sourceKindFor } from "./extract";

/** Ce pagini merită citite, în ordinea valorii pentru o reclamă. */
const KIND_PRIORITY: SourceKind[] = ["pricing", "official-site", "changelog", "docs", "help", "blog"];
const TEXT_HINTS: Array<[RegExp, SourceKind]> = [
  [/pre[țt]|pricing|plans?\b|abonament|tarif/i, "pricing"],
  [/func[țt]i|features?|produs|product|solu[țt]i|how it works|cum func/i, "official-site"],
  [/nout[ăa][țt]i|changelog|what.?s new|release/i, "changelog"],
  [/docs?|documenta|api|developer/i, "docs"],
  [/ajutor|help|support|faq|[îi]ntreb[ăa]ri/i, "help"],
  [/blog|articole|news|[șs]tiri/i, "blog"],
];

export interface CrawlPlanItem {
  url: string;
  kind: SourceKind;
  text: string;
  score: number;
}

/** Alege paginile de citit din legăturile paginii principale (același domeniu, fără duplicate, cu prioritate). */
export function planCrawl(start: string, links: Array<{ text: string; href: string }>, max = 6): CrawlPlanItem[] {
  let host: string;
  try {
    host = new URL(start).hostname;
  } catch {
    throw new MmsError("URL_INVALID", `Adresă invalidă: ${start}`);
  }
  // cheia unei pagini: adresa fără fragment și fără „/” final (pe file:// originea e „null”, deci nu se folosește)
  const keyOf = (u: URL) => `${u.protocol}//${u.host}${u.pathname}`.replace(/\/$/, "");
  const seen = new Set<string>([keyOf(new URL(start))]);
  const out: CrawlPlanItem[] = [];
  for (const l of links) {
    let u: URL;
    try {
      u = new URL(l.href, start);
    } catch {
      continue;
    }
    if (u.hostname !== host || !/^https?:$|^file:$/.test(u.protocol)) continue;
    if (/\.(pdf|zip|png|jpe?g|svg|mp4|dmg|exe)$/i.test(u.pathname)) continue;
    if (/login|log-in|signin|sign-in|signup|register|cont\/|account|cart|checkout|privacy|terms|cookie|legal|gdpr|confiden/i.test(u.pathname)) continue;
    // aplicația din spatele contului nu e o sursă de afirmații despre produs (datele de test din ea nu sunt fapte)
    if (/intr[ăa] [îi]n cont|log ?in|sign ?in|sign ?up|autentific|deschide aplica|open (the )?app|dashboard|contul meu|my account|cont nou|[îi]nregistr/i.test(l.text)) continue;
    const key = keyOf(u);
    if (seen.has(key)) continue;
    seen.add(key);
    const byText = TEXT_HINTS.find(([re]) => re.test(l.text))?.[1];
    const kind = byText ?? sourceKindFor(u.href, { headings: [] } as never);
    const rank = KIND_PRIORITY.indexOf(kind);
    const score = (rank < 0 ? 0 : KIND_PRIORITY.length - rank) + (byText ? 1 : 0) - u.pathname.split("/").filter(Boolean).length * 0.2;
    out.push({ url: u.href.split("#")[0], kind, text: l.text.slice(0, 60), score });
  }
  out.sort((a, b) => b.score - a.score || a.url.localeCompare(b.url));
  // varietate: cel mult două pagini de același tip
  const per = new Map<SourceKind, number>();
  return out.filter((x) => (per.set(x.kind, (per.get(x.kind) ?? 0) + 1).get(x.kind) ?? 0) <= 2).slice(0, max);
}

export interface CrawlResult {
  pages: Array<{ url: string; kind: SourceKind; claims: number }>;
  research: Research;
  skipped: string[];
}

/**
 * Citește paginile relevante ale site-ului. Capturile paginilor produsului (fără pagina de start, deja
 * capturată, și fără concurenți) devin și materiale: o funcție citată de pe pagina ei se poate arăta pe
 * captura ei reală. Drepturile urmează capturile existente de pe același site (`thirdParty` explicit altfel).
 */
export async function crawlSite(projectId: string, startUrl: string, o: { max?: number; competitors?: string[]; log?: (m: string) => void; ingest?: boolean; thirdParty?: boolean } = {}): Promise<CrawlResult> {
  const log = o.log ?? (() => undefined);
  const host = new URL(startUrl).hostname.replace(/^www\./, "");
  const sameSite = (u: string | undefined) => !!u && /^https?:/.test(u) && new URL(u).hostname.replace(/^www\./, "") === host;
  const thirdParty = o.thirdParty ?? loadAssets(projectId).assets.some((a) => a.origin === "real_capture" && a.rights.thirdParty && sameSite(a.capture?.url));
  const dir = path.join(projectDir(projectId), "captures", "research");
  log(`Research: pagina principală ${startUrl}`);
  const home = await capture({ id: "r-home", url: startUrl, viewport: "desktop", research: true }, dir);
  const ex0 = extractFromPage(home.page, { capturedAt: home.capturedAt });
  mergeIntoResearch(projectId, ex0, home.page.fullText);
  const pages: CrawlResult["pages"] = [{ url: startUrl, kind: ex0.source.kind, claims: ex0.claims.length }];
  const skipped: string[] = [];
  const plan = planCrawl(startUrl, home.page.links, o.max ?? 6);
  for (const [i, p] of plan.entries()) {
    try {
      log(`  [${p.kind}] ${p.url}`);
      const r = await capture({ id: `r-${i + 1}`, url: p.url, viewport: "desktop", research: true }, dir);
      const ex = extractFromPage(r.page, { capturedAt: r.capturedAt });
      mergeIntoResearch(projectId, ex, r.page.fullText);
      if (o.ingest !== false) await ingestCapture(projectId, r, { thirdParty });
      pages.push({ url: p.url, kind: ex.source.kind, claims: ex.claims.length });
    } catch (e) {
      skipped.push(`${p.url}: ${(e as Error).message.split("\n")[0]}`);
    }
  }
  for (const [i, url] of (o.competitors ?? []).entries()) {
    try {
      log(`  [competitor] ${url}`);
      const r = await capture({ id: `r-comp-${i + 1}`, url, viewport: "desktop", research: true }, dir);
      const ex = extractFromPage(r.page, { capturedAt: r.capturedAt });
      // despre concurenți: sursă terță, afirmații mereu de confirmat (nu se folosesc ca fapte despre produs)
      ex.source = { ...ex.source, kind: "competitor", reliability: "third-party" };
      ex.claims = ex.claims.map((c) => ({ ...c, status: "needs-confirmation", confidence: "low", notes: `${c.notes} Pagina unui concurent: doar pentru context; nu intră în video fără aprobare.`.trim() }));
      mergeIntoResearch(projectId, ex, r.page.fullText);
      pages.push({ url, kind: "competitor", claims: ex.claims.length });
    } catch (e) {
      skipped.push(`${url}: ${(e as Error).message.split("\n")[0]}`);
    }
  }
  const research = loadResearch(projectId);
  research.openQuestions = [...new Set([...research.openQuestions, ...skipped.map((s) => `Pagină necitită: ${s}`)])];
  saveResearch(projectId, research);
  updateState(projectId, { step: "research", note: `${research.sources.length} surse, ${research.claims.length} afirmații`, log: `Research pe site: ${pages.length} pagini citite, ${skipped.length} sărite.` });
  return { pages, research, skipped };
}
