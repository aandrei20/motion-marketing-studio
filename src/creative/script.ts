/**
 * Scriptul: schiță asamblată din faptele verificate și din cuvintele utilizatorului, plus validare.
 * Schița nu „inventează” copy: folosește citatele din research și textul din brief. Rescrierea
 * creativă o face Claude (directorul creativ) în script.json, iar validatorul păzește regulile.
 */
import { isClaimUsable, type Brief, type Claim, type Research, type Script, type ScriptLine } from "../core/schema";

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
  const features = usable.filter((c) => c.category === "feature").slice(0, 3);
  for (const f of features) {
    const [title, ...rest] = (f.quote ?? f.text).split("\n");
    const desc = rest.join(" ") || f.text.split(":").slice(1).join(":").trim();
    lines.push(line(`f-${slug(title)}`, { origin: "ai", onScreen: title.replace(/:$/, ""), voiceover: firstSentence(desc || title, 16), claimIds: [f.id], emotion: "încredere", visualIntent: "captura reală, zoom pe zona funcției" }));
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
  severity: "blocker" | "major" | "minor";
  lineId: string | null;
  message: string;
}

/** Validarea scriptului: fraze obligatorii exacte, afirmații utilizabile, cifre cu sursă, interdicții, ritm de vorbire. */
export function validateScript(script: Script, brief: Brief, research: Research): ScriptIssue[] {
  const issues: ScriptIssue[] = [];
  const claims = new Map<string, Claim>(research.claims.map((c) => [c.id, c]));
  for (const m of brief.userVision.mandatoryPhrases) {
    const found = script.lines.find((l) => (m.channel !== "on-screen" && l.voiceover.includes(m.text)) || (m.channel !== "voiceover" && l.onScreen.includes(m.text)));
    if (!found) issues.push({ severity: "blocker", lineId: null, message: `Fraza obligatorie „${m.text}” nu apare exact (${m.channel}).` });
  }
  if (!script.lines.some((l) => l.isHook)) issues.push({ severity: "major", lineId: null, message: "Nu există o replică marcată ca hook." });
  if (!script.lines.some((l) => l.isCta)) issues.push({ severity: "blocker", lineId: null, message: "Nu există apel la acțiune (CTA)." });
  const cta = script.lines.find((l) => l.isCta);
  if (cta && !cta.onScreen.includes(brief.cta.text) && !cta.voiceover.includes(brief.cta.text)) issues.push({ severity: "major", lineId: cta.id, message: `CTA-ul nu conține textul din brief („${brief.cta.text}”).` });
  for (const l of script.lines) {
    for (const id of l.claimIds) {
      const c = claims.get(id);
      if (!c) issues.push({ severity: "blocker", lineId: l.id, message: `Afirmația ${id} nu există în research.` });
      else if (!isClaimUsable(c)) issues.push({ severity: "blocker", lineId: l.id, message: `Afirmația ${id} nu e verificată sau aprobată (${c.status}); nu poate intra în video.` });
    }
    const text = `${l.voiceover} ${l.onScreen}`;
    const hasNumber = /\d/.test(text.replace(/\b(19|20)\d{2}\b/g, ""));
    if (hasNumber && !l.claimIds.length && l.origin !== "user-verbatim") issues.push({ severity: "blocker", lineId: l.id, message: "Conține o cifră fără afirmație-sursă (claimIds)." });
    if (hasNumber && !l.claimIds.length && l.origin === "user-verbatim") issues.push({ severity: "minor", lineId: l.id, message: "Cifră venită de la utilizator fără sursă: răspunderea e a utilizatorului; recomand o sursă." });
    for (const banned of brief.doNotSay) if (banned && text.toLowerCase().includes(banned.toLowerCase())) issues.push({ severity: "blocker", lineId: l.id, message: `Conține ceva ce nu trebuie spus: „${banned}”.` });
    const words = l.voiceover.split(/\s+/).filter(Boolean).length;
    if (words > 32) issues.push({ severity: "minor", lineId: l.id, message: `Replica de voce e lungă (${words} cuvinte); pe social, sub 25 se înțelege mai bine.` });
    const screenWords = l.onScreen.split(/\s+/).filter(Boolean).length;
    if (screenWords > 9) issues.push({ severity: "minor", lineId: l.id, message: `Text pe ecran lung (${screenWords} cuvinte); ideal sub 8.` });
    if (l.origin === "user-verbatim" && l.mandatoryPhraseIds.length === 0 && !l.isCta && !l.isHook) {
      /* textul utilizatorului fără frază obligatorie: ok */
    }
  }
  return issues;
}
