/**
 * Research din pagini capturate: surse cu dată și hash, afirmații cu citat exact.
 * FAPT = text spus explicit de sursă (citat). Ce conține prețuri sau cifre merge „de confirmat”
 * până îl aprobă utilizatorul. Nimic nu se inventează: extracția doar citează.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { PageData } from "../capture/capture";
import type { Claim, Research, Source, SourceKind } from "../core/schema";
import { loadResearch, now, projectDir, saveResearch, updateState } from "../projects/store";

const slug = (s: string, max = 40) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, max) || "x";

export function sourceKindFor(url: string, page: PageData): SourceKind {
  const u = url.toLowerCase();
  const h = page.headings.map((x) => x.text.toLowerCase()).join(" ");
  if (/pric|pret|plans|tarif|abonament/.test(u)) return "pricing";
  if (/docs|documenta|api|developer/.test(u)) return "docs";
  if (/help|support|ajutor|faq/.test(u)) return "help";
  if (/changelog|release|nout|what-?s-new|updates/.test(u)) return "changelog";
  if (/blog|news|stiri/.test(u)) return "blog";
  if (/apps\.apple|play\.google|chrome\.google/.test(u)) return "store-listing";
  void h;
  return "official-site";
}

const PRICE_RE = /(?:€|\$|£|lei|RON|EUR|USD)\s?\d[\d.,]*|\d[\d.,]*\s?(?:€|\$|£|lei|RON|EUR|USD)/i;
const NUMBER_RE = /\b\d+([.,]\d+)?\s?(%|x|×|\+|k|K|M|mii|milioane)?\b/;

/** Secțiunile paginii: titlu + textele care urmează (din textul vizibil, în ordine). */
function sections(page: PageData): Array<{ heading: string; level: number; body: string[] }> {
  const lines = page.fullText.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const headSet = new Map(page.headings.map((h) => [h.text, h.level]));
  const out: Array<{ heading: string; level: number; body: string[] }> = [];
  let cur: { heading: string; level: number; body: string[] } | null = null;
  for (const l of lines) {
    const lvl = headSet.get(l);
    if (lvl) {
      cur = { heading: l, level: lvl, body: [] };
      out.push(cur);
    } else if (cur) cur.body.push(l);
  }
  return out;
}

export interface ExtractResult {
  source: Source;
  claims: Claim[];
  summary: string;
  discoveredLinks: Array<{ kind: SourceKind; url: string; text: string }>;
}

export function extractFromPage(page: PageData, opts: { capturedAt?: string } = {}): ExtractResult {
  const text = page.fullText;
  const hash = crypto.createHash("sha256").update(text).digest("hex");
  const kind = sourceKindFor(page.url, page);
  const u = new URL(page.url);
  const sid = `src-${slug(`${u.hostname} ${u.pathname.split("/").filter(Boolean).slice(-2).join(" ")}`, 36)}-${crypto.createHash("sha1").update(page.url.split("#")[0]).digest("hex").slice(0, 6)}`;
  const at = opts.capturedAt ?? now();
  const source: Source = { id: sid, kind, url: page.url, title: page.title || page.url, fetchedAt: at, contentHash: hash, reliability: "official" };
  const claims: Claim[] = [];
  const used = new Set<string>();
  const add = (c: Omit<Claim, "id" | "sourceIds" | "checkedAt" | "notes"> & { idHint: string; notes?: string }) => {
    let id = `c-${slug(c.idHint, 36)}`;
    let k = 2;
    while (used.has(id)) id = `c-${slug(c.idHint, 36)}-${k++}`;
    used.add(id);
    const { idHint: _h, ...rest } = c;
    claims.push({ ...rest, id, sourceIds: [sid], checkedAt: at, notes: c.notes ?? "" });
  };
  const flag = (t: string): Claim["status"] => (PRICE_RE.test(t) || NUMBER_RE.test(t) ? "needs-confirmation" : "verified");

  const h1 = page.headings.find((h) => h.level === 1);
  if (h1) add({ idHint: `poz-${h1.text}`, text: h1.text, kind: "fact", category: "positioning", quote: h1.text, confidence: "high", status: flag(h1.text), notes: "Titlul principal al paginii (promisiunea oficială)." });
  if (page.description) add({ idHint: `rez-${page.description}`, text: page.description, kind: "fact", category: "positioning", quote: page.description, confidence: "high", status: flag(page.description), notes: "Meta description." });

  for (const s of sections(page)) {
    const first = s.body.find((b) => b.length > 25 && !PRICE_RE.test(b));
    // carduri de preț (titlu de plan + preț în primele rânduri) nu sunt funcții
    const pricingCard = s.body.slice(0, 3).some((b) => PRICE_RE.test(b) || /^(personalizat|custom|gratuit|free)$/i.test(b.trim()));
    if (s.level >= 3 && first && s.heading.length < 70 && !pricingCard) {
      // funcție: titlu + prima frază descriptivă
      add({ idHint: `f-${s.heading}`, text: `${s.heading}: ${first}`, kind: "fact", category: "feature", quote: `${s.heading}\n${first}`, confidence: "medium", status: flag(`${s.heading} ${first}`), notes: "Funcție extrasă din titlul secțiunii și textul de sub el." });
    }
    for (const b of s.body) {
      if (PRICE_RE.test(b) && b.length < 80) {
        const ctx = [s.heading, b, s.body[s.body.indexOf(b) + 1] ?? ""].filter(Boolean).join(" · ");
        add({ idHint: `pret-${s.heading}-${b}`, text: ctx, kind: "fact", category: "pricing", quote: ctx, confidence: "medium", status: "needs-confirmation", notes: "Preț găsit pe pagină; se confirmă înainte de a intra în video." });
      }
    }
  }
  // noutăți datate (changelog)
  for (const t of page.times) {
    const s = sections(page).find((x) => text.indexOf(x.heading) > text.indexOf(t.text) && text.indexOf(x.heading) - text.indexOf(t.text) < 200);
    if (s) add({ idHint: `nou-${s.heading}`, text: `${t.text}: ${s.heading}${s.body[0] ? ` – ${s.body[0]}` : ""}`, kind: "fact", category: "feature", quote: `${t.text} ${s.heading} ${s.body[0] ?? ""}`.trim(), confidence: "medium", status: flag(`${s.heading} ${s.body[0] ?? ""}`), notes: `Noutate datată ${t.datetime || t.text}.` });
  }
  // propoziții cu cifre din paragrafe: candidate de „dovadă”, mereu de confirmat
  for (const p of page.paragraphs) {
    if (NUMBER_RE.test(p) && p.length < 220 && !claims.some((c) => c.quote?.includes(p))) add({ idHint: `cifra-${p}`, text: p, kind: "fact", category: "metric", quote: p, confidence: "low", status: "needs-confirmation", notes: "Conține o cifră; se confirmă înainte de folosire." });
  }
  const discoveredLinks = page.links
    .filter((l) => {
      try {
        return new URL(l.href).hostname === new URL(page.url).hostname && l.href !== page.url;
      } catch {
        return false;
      }
    })
    .map((l) => ({ kind: sourceKindFor(l.href, { ...page, headings: [] }), url: l.href.split("#")[0], text: l.text }))
    .filter((l, i, a) => l.url !== page.url.split("#")[0] && a.findIndex((x) => x.url === l.url) === i);
  return { source, claims, summary: page.description || h1?.text || page.title, discoveredLinks };
}

/** Adaugă în research-ul proiectului (fără duplicate: aceeași sursă cu același conținut nu se repetă). */
export function mergeIntoResearch(projectId: string, r: ExtractResult, pageText: string): Research {
  const res = loadResearch(projectId);
  const dir = path.join(projectDir(projectId), "sources");
  fs.mkdirSync(dir, { recursive: true });
  const textFile = `sources/${r.source.id}.txt`;
  fs.writeFileSync(path.join(projectDir(projectId), textFile), pageText, "utf8");
  const existing = res.sources.find((s) => s.id === r.source.id);
  if (existing && existing.contentHash === r.source.contentHash) return res;
  res.sources = [...res.sources.filter((s) => s.id !== r.source.id), { ...r.source, textFile }];
  const known = new Set(res.claims.map((c) => c.quote ?? c.text));
  for (const c of r.claims) if (!known.has(c.quote ?? c.text)) res.claims.push(c);
  if (!res.productSummary) res.productSummary = r.summary;
  const pending = res.claims.filter((c) => c.status === "needs-confirmation").length;
  res.openQuestions = pending ? [`Confirmă ${pending} afirmații cu prețuri sau cifre înainte să intre în video.`] : [];
  const saved = saveResearch(projectId, res);
  updateState(projectId, { step: "research", note: `${saved.sources.length} surse, ${saved.claims.length} afirmații`, log: `Research din ${r.source.url}: ${r.claims.length} afirmații.` });
  return saved;
}

/** Utilizatorul confirmă sau respinge o afirmație (singura cale prin care o cifră/preț intră în video). */
export function setClaimStatus(projectId: string, claimId: string, status: Claim["status"], note = ""): Claim {
  const res = loadResearch(projectId);
  const c = res.claims.find((x) => x.id === claimId);
  if (!c) throw new Error(`Nu există afirmația ${claimId}`);
  c.status = status;
  c.checkedAt = now();
  if (note) c.notes = `${c.notes} ${note}`.trim();
  saveResearch(projectId, res);
  updateState(projectId, { decision: `Afirmația ${claimId}: ${status}.` });
  return c;
}

/** Adaugă o afirmație dată de utilizator (de ex. dintr-un PDF sau din cunoștințele lui), cu sursă „user-provided”. */
export function addUserClaim(projectId: string, text: string, category: Claim["category"], sourceTitle: string): Claim {
  const res = loadResearch(projectId);
  const sid = `src-user-${slug(sourceTitle, 30)}`;
  if (!res.sources.some((s) => s.id === sid)) res.sources.push({ id: sid, kind: "user-provided", title: sourceTitle, fetchedAt: now(), contentHash: crypto.createHash("sha256").update(sourceTitle).digest("hex"), reliability: "user" });
  const claim: Claim = { id: `c-user-${slug(text, 30)}`, text, kind: "fact", category, sourceIds: [sid], quote: text, confidence: "medium", status: "approved-by-user", checkedAt: now(), notes: "Dată de utilizator." };
  res.claims.push(claim);
  saveResearch(projectId, res);
  return claim;
}
