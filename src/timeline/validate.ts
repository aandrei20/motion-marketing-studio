/**
 * Validarea timeline-ului înainte de randare. Fiecare problemă are cadru, scenă, gravitate și
 * recomandare, ca să poată fi reparată local. Regulile dure din CLAUDE.md sunt „blocker”.
 */
import { formatTimecode } from "../core/time";
import { rectInside, rectsOverlap, resolveSafeZone } from "../core/formats";
import { isClaimUsable, type AssetManifest, type Finding, type FormatSpec, type Research, type Timeline, type TimelineLayer } from "../core/schema";
import { getCapability } from "../motion/registry";
import { readingSec } from "../editing/grammar";

const TEXT_CAPS = new Set(["text.word-reveal", "text.char-reveal", "text.mask-reveal", "text.slam", "text.pop", "text.blur-reveal", "text.tracking", "text.typewriter", "text.split", "text.highlight", "text.outline-fill", "text.glitch", "text.big-word", "text.body", "text.counter"]);
const DATA_CAPS = new Set(["text.counter", "data.bars", "data.line", "data.ring", "data.compare", "data.pie"]);
const SCREEN_CAPS = new Set(["media.screen", "media.device-3d", "media.stack-3d", "ui.zoom-lens", "media.cards"]);

export interface ValidationResult {
  ok: boolean;
  findings: Finding[];
  stats: { flashes: number; maxFlashesPerSec: number; textLayers: number; minFontAt360: number | null };
}

export function validateTimeline(t: Timeline, ctx: { assets: AssetManifest; research: Research; format: FormatSpec }): ValidationResult {
  const findings: Finding[] = [];
  let n = 0;
  const add = (f: Omit<Finding, "id" | "round" | "source" | "status" | "timecode"> & { frame: number | null }) =>
    findings.push({ ...f, id: `v${++n}`, round: 0, source: "auto-check", status: "open", timecode: f.frame === null ? null : formatTimecode(f.frame, t.fps) });
  const safe = resolveSafeZone(ctx.format);
  const assetByPath = new Map(ctx.assets.assets.map((a) => [`projects/${t.projectId}/${a.file}`, a]));
  const claims = new Map(ctx.research.claims.map((c) => [c.id, c]));
  let minAt360: number | null = null;
  let textLayers = 0;

  // acoperire: fără goluri între scene (fără cadre negre)
  const sorted = [...t.scenes].sort((a, b) => a.from - b.from);
  if (sorted[0].from !== 0) add({ frame: 0, sceneId: sorted[0].id, dimension: "black-frame", severity: "blocker", problem: "Prima scenă nu începe la cadrul 0.", recommendation: "Recompilează timeline-ul." });
  for (let i = 1; i < sorted.length; i++) {
    const prevEnd = sorted[i - 1].from + sorted[i - 1].durationInFrames;
    if (sorted[i].from > prevEnd) add({ frame: prevEnd, sceneId: sorted[i].id, dimension: "black-frame", severity: "blocker", problem: `Gol de ${sorted[i].from - prevEnd} cadre între scene (cadre goale).`, recommendation: "Scenele trebuie să se atingă sau să se suprapună pe tranziție." });
    const overlap = prevEnd - sorted[i].from;
    const tin = sorted[i].transitionIn?.durationInFrames ?? 0;
    if (overlap !== tin) add({ frame: sorted[i].from, sceneId: sorted[i].id, dimension: "timing", severity: "major", problem: `Suprapunerea (${overlap} cadre) nu corespunde tranziției (${tin} cadre).`, recommendation: "Recompilează; nu edita manual cadrele de start." });
  }
  const last = sorted[sorted.length - 1];
  if (last.from + last.durationInFrames !== t.durationInFrames) add({ frame: t.durationInFrames - 1, sceneId: last.id, dimension: "timing", severity: "major", problem: "Durata totală nu se potrivește cu ultima scenă.", recommendation: "Recompilează." });

  // flash-uri: maximum 2 pe secundă
  const flashes = t.scenes.filter((s) => s.transitionIn?.capability === "tr.flash").map((s) => s.from);
  let maxPerSec = 0;
  for (const f of flashes) {
    const inWin = flashes.filter((g) => g >= f && g < f + t.fps).length;
    maxPerSec = Math.max(maxPerSec, inWin);
    if (inWin > 2) add({ frame: f, sceneId: null, dimension: "flash", severity: "blocker", problem: `${inWin} flash-uri într-o secundă (maximum 2).`, recommendation: "Înlocuiește unele tranziții flash cu cut sau push." });
  }

  const visit = (l: TimelineLayer, sceneId: string, sceneFrom: number, parentScreen: boolean) => {
    const cap = getCapability(l.capability);
    if (!cap) {
      add({ frame: sceneFrom + l.from, sceneId, dimension: "assets", severity: "blocker", problem: `Capabilitate necunoscută: ${l.capability}.`, recommendation: "Folosește doar capabilitățile din registry (library/registry.json)." });
      return;
    }
    if (cap.status === "deprecated") add({ frame: sceneFrom + l.from, sceneId, dimension: "assets", severity: "minor", problem: `${l.capability} este depreciată.`, recommendation: "Alege o alternativă din registry." });
    // fișierele există în manifest și au drepturile în regulă
    for (const p of l.assets) {
      if (!p.startsWith("projects/")) continue;
      const a = assetByPath.get(p);
      if (!a) {
        add({ frame: sceneFrom + l.from, sceneId, dimension: "assets", severity: "blocker", problem: `Fișierul ${p} nu e în manifestul de materiale.`, recommendation: "Ingerează fișierul cu mms add-asset." });
        continue;
      }
      if (a.rights.thirdParty && a.rights.status !== "confirmed-by-user" && a.rights.status !== "owned") add({ frame: sceneFrom + l.from, sceneId, dimension: "rights", severity: t.concept ? "major" : "blocker", problem: `„${a.originalName}” aparține unui terț și nu are drepturi confirmate.`, recommendation: "Întreabă utilizatorul „Ai dreptul să-l folosești?” și notează răspunsul (mms rights)." });
      if (SCREEN_CAPS.has(l.capability) && a.showsProductUI !== true && a.role !== "screenshot" && a.role !== "screen-recording") add({ frame: sceneFrom + l.from, sceneId, dimension: "real-footage", severity: "major", problem: `${l.capability} afișează „${a.originalName}”, care nu e marcat ca interfață reală.`, recommendation: "Folosește o captură reală sau un fișier dat de utilizator cu rolul screenshot." });
      if (SCREEN_CAPS.has(l.capability) && a.origin !== "real_capture" && a.origin !== "user_provided") add({ frame: sceneFrom + l.from, sceneId, dimension: "real-footage", severity: "blocker", problem: `Interfața din ${l.capability} vine din „${a.origin}”, nu din captură reală sau de la utilizator.`, recommendation: "Interfața produsului nu se inventează: capturează-o (mms capture) sau cere fișierul utilizatorului." });
    }
    // cifrele din grafice și contoare au nevoie de o afirmație verificată
    if (DATA_CAPS.has(l.capability)) {
      const id = l.params.claimId as string | undefined;
      const c = id ? claims.get(id) : undefined;
      if (!c || !isClaimUsable(c)) add({ frame: sceneFrom + l.from, sceneId, dimension: "claims", severity: "blocker", problem: `${l.capability} afișează cifre fără afirmație verificată (claimId ${id ?? "lipsă"}).`, recommendation: "Leagă cifra de o afirmație din research confirmată de utilizator, sau scoate graficul." });
    }
    // text: zona de siguranță și lizibilitatea la 360 px
    if (TEXT_CAPS.has(l.capability) && !parentScreen && l.depth === 0) {
      textLayers++;
      const at = sceneFrom + l.from;
      if (!rectInside(l.box, safe.rect, 2)) add({ frame: at, sceneId, dimension: "safe-zone", severity: "major", problem: `Textul „${String(l.params.text ?? "").slice(0, 40)}” iese din zona de siguranță a platformei.`, recommendation: "Mută sau micșorează cutia textului în interiorul zonei sigure." });
      for (const ex of safe.exclusions) if (rectsOverlap(l.box, ex)) add({ frame: at, sceneId, dimension: "safe-zone", severity: "major", problem: `Textul se suprapune cu ${ex.label}.`, recommendation: "Mută textul în afara zonei butoanelor platformei." });
      const size = typeof l.params.fontSize === "number" ? l.params.fontSize : null;
      if (size !== null) {
        // testul de 360 px: latura scurtă a video-ului afișată la 360 px (telefon ținut pe orizontală sau pe verticală)
        const at360 = (size * 360) / Math.min(t.width, t.height);
        minAt360 = minAt360 === null ? at360 : Math.min(minAt360, at360);
        const limit = l.role === "hero" ? 12 : 9;
        if (at360 < limit) add({ frame: at, sceneId, dimension: "readability", severity: "major", problem: `Text prea mic la testul de 360 px: ${at360.toFixed(1)} px (minim ${limit}).`, recommendation: "Scurtează textul sau mărește cutia." });
      }
      const text = String(l.params.text ?? "");
      const visibleSec = l.durationInFrames / t.fps;
      if (text && visibleSec < readingSec(text) - 0.05) add({ frame: at, sceneId, dimension: "readability", severity: "major", problem: `„${text.slice(0, 40)}” stă ${visibleSec.toFixed(2)} s, sub timpul de citire (${readingSec(text).toFixed(2)} s).`, recommendation: "Prelungește scena sau scurtează textul." });
    }
    l.children.forEach((c) => visit(c, sceneId, sceneFrom + l.from, parentScreen || l.capability === "media.screen"));
  };
  for (const s of t.scenes) {
    for (const l of s.layers) visit(l, s.id, s.from, false);
    if (s.transitionIn && s.transitionIn.durationInFrames > s.durationInFrames * 0.6) add({ frame: s.from, sceneId: s.id, dimension: "timing", severity: "minor", problem: "Tranziția ocupă peste 60% din scenă.", recommendation: "Scurtează tranziția sau prelungește scena." });
    if (s.meta.narrativeRole === "cta") {
      const holdStart = s.durationInFrames - Math.round(2.5 * t.fps);
      if (holdStart < 0) add({ frame: s.from, sceneId: s.id, dimension: "cta", severity: "major", problem: "Cardul final e mai scurt de 2,5 s.", recommendation: "Prelungește scena CTA (hold fără mișcare la momentul deciziei)." });
      if (s.camera.keys.some((k) => k.at > holdStart) || s.camera.handheld > 0) add({ frame: s.from + Math.max(0, holdStart), sceneId: s.id, dimension: "cta", severity: "minor", problem: "Camera încă se mișcă în timpul hold-ului de pe CTA.", recommendation: "Folosește camera.static pe cardul final." });
    }
  }
  // subtitrările: în zona sigură și fără suprapunere cu textul principal în același timp
  if (t.captions) {
    if (!rectInside(t.captions.box, safe.rect, 2)) add({ frame: 0, sceneId: null, dimension: "safe-zone", severity: "major", problem: "Subtitrările ies din zona de siguranță.", recommendation: "Recompilează cu formatul corect." });
    for (const s of t.scenes) {
      for (const l of s.layers) {
        if (!TEXT_CAPS.has(l.capability) || l.depth !== 0) continue;
        const a0 = s.from + l.from;
        const a1 = a0 + l.durationInFrames;
        const wordsHere = t.captions.words.some((w) => w.from < a1 && w.to > a0);
        if (wordsHere && rectsOverlap(l.box, t.captions.box)) add({ frame: a0, sceneId: s.id, dimension: "readability", severity: "major", problem: `Subtitrările se suprapun cu textul „${String(l.params.text ?? "").slice(0, 30)}”.`, recommendation: "Mută textul scenei mai sus sau dezactivează subtitrările arse." });
      }
    }
  }
  if (!t.scenes.some((s) => s.meta.narrativeRole === "cta")) add({ frame: null, sceneId: null, dimension: "cta", severity: "major", problem: "Nu există scenă de CTA.", recommendation: "Adaugă cardul final cu apelul la acțiune." });
  if (t.concept) add({ frame: null, sceneId: null, dimension: "rights", severity: "major", problem: "Timeline-ul folosește materiale fără drepturi confirmate (preview „concept”).", recommendation: "Confirmă drepturile sau înlocuiește materialele înainte de exportul final." });
  const ok = !findings.some((f) => f.severity === "blocker");
  return { ok, findings, stats: { flashes: flashes.length, maxFlashesPerSec: maxPerSec, textLayers, minFontAt360: minAt360 === null ? null : Math.round(minAt360 * 10) / 10 } };
}
