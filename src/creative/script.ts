/**
 * Scriptul: schiță asamblată din faptele verificate și din cuvintele utilizatorului, plus validare.
 * Schița nu „inventează” copy: folosește citatele din research și textul din brief. Rescrierea
 * creativă o face Claude (directorul creativ) în script.json, iar validatorul păzește regulile.
 */
import { baseLang, detectLanguage, LANGUAGE_NAME } from "./language";
import { isClaimUsable, type Brief, type Claim, type Dimension, type Research, type Script, type ScriptLine, type SourceKind } from "../core/schema";

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 28) || "linie";

function line(id: string, p: Partial<ScriptLine> & Pick<ScriptLine, "origin">): ScriptLine {
  return {
    id,
    voiceover: "",
    onScreen: "",
    emphasis: [],
    pauseAfterMs: 0,
    emotion: "",
    visualIntent: "",
    claimIds: [],
    mandatoryPhraseIds: [],
    pronunciation: [],
    isHook: false,
    isCta: false,
    ...p,
  };
}

/** Textul pus în brief când utilizatorul nu a dat încă CTA-ul exact (întrebarea A5). Nu intră niciodată în video. */
export const CTA_PLACEHOLDER = "de confirmat";
export const isPlaceholderCta = (t: string | undefined | null): boolean => !t?.trim() || t.trim().toLowerCase() === CTA_PLACEHOLDER;

/** O dată la începutul unui titlu (jurnal de schimbări): „SEP 23, 2026: …”, „2026-09-23 – …”, „23 sept. 2026 …”. */
const LEADING_DATE = /^\s*(?:\p{L}{3,9}\.?\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}\s+\p{L}{3,9}\.?\s+\d{4})\s*[:–—-]?\s*/u;

/**
 * Titlul scurt al unei funcții, pentru ecran: primul rând al citatului, fără data din față; dacă e lung,
 * partea dinaintea primului separator („Titlu – descriere”, „Titlu: descriere”). Cuvintele nu se schimbă.
 */
export function featureTitle(quote: string): { title: string; rest: string; dated: boolean } {
  const [first, ...more] = quote.split("\n");
  const dated = LEADING_DATE.test(first);
  let title = first.replace(LEADING_DATE, "").trim();
  let rest = more.join(" ").trim();
  if (title.split(/\s+/).length > 8) {
    const m = title.match(/^(.{3,80}?)\s*(?:\s[–—-]\s|:\s)(.+)$/);
    if (m && m[1].split(/\s+/).length <= 8) {
      rest = `${m[2]} ${rest}`.trim();
      title = m[1];
    }
  }
  return { title: title.replace(/[:–—-]\s*$/, "").trim(), rest, dated };
}

/** Prima propoziție, scurtată la un număr de cuvinte (fără a schimba cuvintele). */
function firstSentence(t: string, maxWords = 14): string {
  const s = t.split(/(?<=[.!?])\s/)[0] ?? t;
  const w = s.split(/\s+/);
  return w.length > maxWords ? `${w.slice(0, maxWords).join(" ")}…` : s;
}

export function draftScript(brief: Brief, research: Research, opts: { textLanguage: string; voiceLanguage: string | null; productName: string }): Script {
  const usable = research.claims.filter(isClaimUsable);
  const lines: ScriptLine[] = [];
  const hooks = brief.userVision.hooks.map((h, i) => ({ id: `hook-${i + 1}`, text: h, origin: "user-verbatim" as const, selected: i === 0 }));
  const positioning = usable.find((c) => c.category === "positioning");
  if (!hooks.length && positioning) hooks.push({ id: "hook-1", text: positioning.text, origin: "ai" as never, selected: true });
  const hook = hooks.find((h) => h.selected) ?? hooks[0];
  if (hook)
    lines.push(
      line("hook", {
        origin: hook.origin === "user-verbatim" ? "user-verbatim" : "ai",
        voiceover: hook.text,
        onScreen: hook.text,
        isHook: true,
        emotion: "curiozitate",
        claimIds: hook.origin === "user-verbatim" ? [] : positioning ? [positioning.id] : [],
      }),
    );
  const pain = brief.audience.painPoints[0];
  if (pain) lines.push(line("problema", { origin: "user-verbatim", voiceover: pain, onScreen: pain, emotion: "frustrare" }));
  if (positioning && hook?.text !== positioning.text) lines.push(line("solutia", { origin: "ai", voiceover: `${opts.productName}. ${firstSentence(positioning.text)}`, onScreen: opts.productName, emotion: "ușurare", claimIds: [positioning.id] }));
  // funcțiile stabile ale produsului întâi: pagina principală, apoi paginile oficiale; noutățile datate din
  // jurnalul de schimbări doar dacă nu ajung. Documentația și ajutorul nu intră în schiță (textul lor e scris
  // pentru alt scop, iar extragerea prinde navigarea); rămân afirmații cu sursă, pentru Claude.
  // concurenții și articolele terților nu descriu funcțiile produsului; o sursă necunoscută rămâne admisă
  const KIND_RANK: Partial<Record<SourceKind, number>> = { "official-site": 0, pricing: 0, "user-provided": 0, "store-listing": 0, changelog: 2, blog: 2, press: 2 };
  const kindOf = new Map(research.sources.map((s, i) => [s.id, i === 0 ? -1 : (KIND_RANK[s.kind] ?? 3)]));
  const rank = (c: Claim) => Math.min(3, ...c.sourceIds.map((id) => kindOf.get(id) ?? 1));
  const features = usable
    .filter((c) => c.category === "feature")
    .map((c) => ({ c, t: featureTitle(c.quote ?? c.text) }))
    .filter((x) => x.t.title.split(/\s+/).length <= 10 && rank(x.c) < 3)
    .sort((a, b) => Number(a.t.dated) - Number(b.t.dated) || rank(a.c) - rank(b.c))
    .slice(0, 3);
  for (const { c: f, t } of features) {
    const desc = t.rest || f.text.split(":").slice(1).join(":").trim();
    lines.push(line(`f-${slug(t.title)}`, { origin: "ai", onScreen: t.title, voiceover: firstSentence(desc || t.title, 16), claimIds: [f.id], emotion: "încredere", visualIntent: "captura reală, zoom pe zona funcției" }));
  }
  const proof = usable.find((c) => c.category === "metric" || c.category === "testimonial");
  if (proof) lines.push(line("dovada", { origin: "ai", onScreen: firstSentence(proof.text, 10), voiceover: firstSentence(proof.text, 16), claimIds: [proof.id], emotion: "încredere" }));
  lines.push(line("cta", { origin: "user-verbatim", onScreen: brief.cta.text, voiceover: brief.cta.text, isCta: true, claimIds: brief.cta.claimIds, emotion: "urgență" }));
  // frazele obligatorii, cuvânt cu cuvânt, dacă nu apar deja
  for (const m of brief.userVision.mandatoryPhrases) {
    const has = lines.some((l) => l.voiceover.includes(m.text) || l.onScreen.includes(m.text));
    if (!has) lines.splice(Math.max(1, lines.length - 1), 0, line(`obligatoriu-${m.id}`, { origin: "user-verbatim", voiceover: m.channel === "on-screen" ? "" : m.text, onScreen: m.channel === "voiceover" ? "" : m.text, mandatoryPhraseIds: [m.id] }));
  }
  for (const l of lines) l.mandatoryPhraseIds = brief.userVision.mandatoryPhrases.filter((m) => l.voiceover.includes(m.text) || l.onScreen.includes(m.text)).map((m) => m.id);
  return {
    schemaVersion: 1,
    textLanguage: opts.textLanguage,
    voiceLanguage: opts.voiceLanguage,
    hooks: hooks.map((h) => ({ ...h, origin: h.origin === "user-verbatim" ? "user-verbatim" : "ai" })),
    lines,
  };
}

export interface ScriptIssue {
  severity: "critical" | "high" | "medium";
  lineId: string | null;
  message: string;
  /** dimensiunea din critică (categoria scorului); lipsă = după mesaj */
  dimension?: Dimension;
}

/** Validarea scriptului: fraze obligatorii exacte, afirmații utilizabile, cifre cu sursă, interdicții, ritm de vorbire. */
export function validateScript(script: Script, brief: Brief, research: Research): ScriptIssue[] {
  const issues: ScriptIssue[] = [];
  const claims = new Map<string, Claim>(research.claims.map((c) => [c.id, c]));
  for (const m of brief.userVision.mandatoryPhrases) {
    const found = script.lines.find((l) => (m.channel !== "on-screen" && l.voiceover.includes(m.text)) || (m.channel !== "voiceover" && l.onScreen.includes(m.text)));
    if (!found) issues.push({ severity: "critical", lineId: null, message: `Fraza obligatorie „${m.text}” nu apare exact (${m.channel}).` });
  }
  if (!script.lines.some((l) => l.isHook)) issues.push({ severity: "high", lineId: null, message: "Nu există o replică marcată ca hook." });
  if (!script.lines.some((l) => l.isCta)) issues.push({ severity: "critical", lineId: null, message: "Nu există apel la acțiune (CTA)." });
  const cta = script.lines.find((l) => l.isCta);
  if (isPlaceholderCta(brief.cta.text)) issues.push({ severity: "critical", lineId: cta?.id ?? null, dimension: "cta", message: `CTA-ul din brief nu e stabilit („${brief.cta.text || "gol"}”): textul exact al butonului îl dă utilizatorul (întrebarea A5).` });
  else if (cta && !cta.onScreen.includes(brief.cta.text) && !cta.voiceover.includes(brief.cta.text)) issues.push({ severity: "high", lineId: cta.id, dimension: "cta", message: `CTA-ul nu conține textul din brief („${brief.cta.text}”).` });
  const textLang = baseLang(script.textLanguage);
  const voiceLang = baseLang(script.voiceLanguage);
  for (const l of script.lines) {
    for (const id of l.claimIds) {
      const c = claims.get(id);
      if (!c) issues.push({ severity: "critical", lineId: l.id, message: `Afirmația ${id} nu există în research.` });
      else if (!isClaimUsable(c)) issues.push({ severity: "critical", lineId: l.id, message: `Afirmația ${id} nu e verificată sau aprobată (${c.status}); nu poate intra în video.` });
    }
    const text = `${l.voiceover} ${l.onScreen}`;
    const hasNumber = /\d/.test(text.replace(/\b(19|20)\d{2}\b/g, ""));
    if (hasNumber && !l.claimIds.length && l.origin !== "user-verbatim") issues.push({ severity: "critical", lineId: l.id, message: "Conține o cifră fără afirmație-sursă (claimIds)." });
    if (hasNumber && !l.claimIds.length && l.origin === "user-verbatim") issues.push({ severity: "medium", lineId: l.id, message: "Cifră venită de la utilizator fără sursă: răspunderea e a utilizatorului; recomand o sursă." });
    for (const banned of brief.doNotSay) if (banned && text.toLowerCase().includes(banned.toLowerCase())) issues.push({ severity: "critical", lineId: l.id, message: `Conține ceva ce nu trebuie spus: „${banned}”.` });
    const words = l.voiceover.split(/\s+/).filter(Boolean).length;
    if (words > 32) issues.push({ severity: "medium", lineId: l.id, message: `Replica de voce e lungă (${words} cuvinte); pe social, sub 25 se înțelege mai bine.` });
    const screenWords = l.onScreen.split(/\s+/).filter(Boolean).length;
    if (screenWords > 14) issues.push({ severity: "high", lineId: l.id, dimension: "clarity", message: `Text pe ecran mult prea lung (${screenWords} cuvinte): nu se poate citi în timpul scenei; ideal sub 8.` });
    else if (screenWords > 9) issues.push({ severity: "medium", lineId: l.id, dimension: "clarity", message: `Text pe ecran lung (${screenWords} cuvinte); ideal sub 8.` });
    // limba: un citat de pe site în altă limbă decât reclama trebuie tradus (cuvintele utilizatorului rămân cum le-a scris)
    if (l.origin !== "user-verbatim") {
      for (const [field, expected] of [["onScreen", textLang], ["voiceover", voiceLang]] as const) {
        const d = detectLanguage(l[field]);
        if (expected && d.lang && d.lang !== expected && d.confidence >= 0.5)
          issues.push({ severity: "high", lineId: l.id, dimension: "story", message: `${field === "onScreen" ? "Textul de pe ecran" : "Vocea"} „${firstSentence(l[field], 8)}” e în ${LANGUAGE_NAME[d.lang] ?? d.lang}, iar reclama e în ${LANGUAGE_NAME[expected] ?? expected}: citatul trebuie tradus (Claude propune, tu aprobi); originalul rămâne sursa.` });
      }
    }
    if (l.origin === "user-verbatim" && l.mandatoryPhraseIds.length === 0 && !l.isCta && !l.isHook) {
      /* textul utilizatorului fără frază obligatorie: ok */
    }
  }
  return issues;
}
