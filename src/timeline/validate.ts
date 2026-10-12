/**
 * Validarea timeline-ului înainte de randare. Fiecare problemă are cadru, scenă, gravitate și
 * recomandare, ca să poată fi reparată local. Regulile dure din CLAUDE.md sunt „critical” (blochează exportul).
 */
import { captureSource } from "../assets/source";
import { rectInside, rectsOverlap, resolveSafeZone } from "../core/formats";
import { isClaimUsable, type AssetManifest, type Finding, type FormatSpec, type Rect, type Research, type Timeline, type TimelineLayer } from "../core/schema";
import { getCapability } from "../motion/registry";
import { readingSec } from "../editing/grammar";
import { issueCollector, type IssueDraft } from "../quality/issues";
import { DATA_CAPS, READABLE_TEXT_CAPS as TEXT_CAPS, SCREEN_CAPS } from "../motion/text-caps";


export interface ValidationResult {
  ok: boolean;
  findings: Finding[];
  stats: { flashes: number; maxFlashesPerSec: number; textLayers: number; minFontAt360: number | null };
}

/** Pozițiile benzii de subtitrări pe intervale (segmentele compilatorului sau poziția implicită). */
export function captionBoxes(t: Timeline): Array<{ from: number; to: number; box: Rect }> {
  if (!t.captions) return [];
  return t.captions.segments.length ? t.captions.segments : [{ from: 0, to: t.durationInFrames, box: t.captions.box }];
}

export function boxAt(segs: Array<{ from: number; to: number; box: Rect }>, frame: number): Rect {
  return (segs.find((x) => frame >= x.from && frame < x.to) ?? segs[segs.length - 1]).box;
}

export function validateTimeline(t: Timeline, ctx: { assets: AssetManifest; research: Research; format: FormatSpec }): ValidationResult {
  const col = issueCollector("v", 0, t.fps);
  const findings: Finding[] = col.issues;
  const add = (d: IssueDraft) => col.add({ method: "timeline", ...d });
  const unlicensed = new Map<string, { name: string; frame: number; sceneId: string; scenes: Set<string> }>();
  const safe = resolveSafeZone(ctx.format);
  const assetByPath = new Map(ctx.assets.assets.map((a) => [`projects/${t.projectId}/${a.file}`, a]));
  const claims = new Map(ctx.research.claims.map((c) => [c.id, c]));
  let minAt360: number | null = null;
  let textLayers = 0;

  // acoperire: fără goluri între scene (fără cadre negre)
  const sorted = [...t.scenes].sort((a, b) => a.from - b.from);
  if (sorted[0].from !== 0) add({ frame: 0, sceneId: sorted[0].id, dimension: "black-frame", severity: "critical", problem: "Prima scenă nu începe la cadrul 0.", recommendation: "Recompilează timeline-ul." });
  for (let i = 1; i < sorted.length; i++) {
    const prevEnd = sorted[i - 1].from + sorted[i - 1].durationInFrames;
    if (sorted[i].from > prevEnd) add({ frame: prevEnd, sceneId: sorted[i].id, dimension: "black-frame", severity: "critical", problem: `Gol de ${sorted[i].from - prevEnd} cadre între scene (cadre goale).`, recommendation: "Scenele trebuie să se atingă sau să se suprapună pe tranziție." });
    const overlap = prevEnd - sorted[i].from;
    const tin = sorted[i].transitionIn?.durationInFrames ?? 0;
    if (overlap !== tin) add({ frame: sorted[i].from, sceneId: sorted[i].id, dimension: "timing", severity: "high", problem: `Suprapunerea (${overlap} cadre) nu corespunde tranziției (${tin} cadre).`, recommendation: "Recompilează; nu edita manual cadrele de start." });
  }
  const last = sorted[sorted.length - 1];
  if (last.from + last.durationInFrames !== t.durationInFrames) add({ frame: t.durationInFrames - 1, sceneId: last.id, dimension: "timing", severity: "high", problem: "Durata totală nu se potrivește cu ultima scenă.", recommendation: "Recompilează." });

  // flash-uri: maximum 2 pe secundă
  const flashes = t.scenes.filter((s) => s.transitionIn?.capability === "tr.flash").map((s) => s.from);
  let maxPerSec = 0;
  for (const f of flashes) {
    const inWin = flashes.filter((g) => g >= f && g < f + t.fps).length;
    maxPerSec = Math.max(maxPerSec, inWin);
    if (inWin > 2) {
      const sc = t.scenes.find((x) => x.from === f && x.transitionIn?.capability === "tr.flash");
      add({ frame: f, sceneId: sc?.id ?? null, dimension: "flash", severity: "critical", problem: `${inWin} flash-uri într-o secundă (maximum 2).`, recommendation: "Înlocuiește unele tranziții flash cu cut sau push.", suggestedFix: sc ? [{ op: "set-transition", sceneId: sc.id, capability: "tr.cut", durationFrames: null }] : [] });
    }
  }

  const visit = (l: TimelineLayer, sceneId: string, sceneFrom: number, parentScreen: boolean) => {
    const cap = getCapability(l.capability);
    if (!cap) {
      add({ frame: sceneFrom + l.from, sceneId, dimension: "assets", severity: "critical", problem: `Capabilitate necunoscută: ${l.capability}.`, recommendation: "Folosește doar capabilitățile din registry (library/registry.json)." });
      return;
    }
    if (cap.status === "deprecated") add({ frame: sceneFrom + l.from, sceneId, dimension: "assets", severity: "medium", problem: `${l.capability} este depreciată.`, recommendation: "Alege o alternativă din registry." });
    // fișierele există în manifest și au drepturile în regulă
    for (const p of l.assets) {
      if (!p.startsWith("projects/")) continue;
      const a = assetByPath.get(p);
      if (!a) {
        add({ frame: sceneFrom + l.from, sceneId, dimension: "assets", severity: "critical", problem: `Fișierul ${p} nu e în manifestul de materiale.`, recommendation: "Ingerează fișierul cu mms add-asset." });
        continue;
      }
      if (a.rights.thirdParty && a.rights.status !== "confirmed-by-user" && a.rights.status !== "owned") {
        const u = unlicensed.get(a.id) ?? unlicensed.set(a.id, { name: a.originalName, frame: sceneFrom + l.from, sceneId, scenes: new Set<string>() }).get(a.id)!;
        u.scenes.add(sceneId);
      }
      if (SCREEN_CAPS.has(l.capability) && a.showsProductUI !== true && a.role !== "screenshot" && a.role !== "screen-recording") add({ frame: sceneFrom + l.from, sceneId, dimension: "real-footage", severity: "high", problem: `${l.capability} afișează „${a.originalName}”, care nu e marcat ca interfață reală.`, recommendation: "Folosește o captură reală sau un fișier dat de utilizator cu rolul screenshot." });
      if (SCREEN_CAPS.has(l.capability) && a.pii.regions.length) {
        if (!a.pii.blurApproved && !a.pii.keepApproved)
          add({ frame: sceneFrom + l.from, sceneId, dimension: "assets", severity: "critical", problem: `„${a.originalName}” conține ${a.pii.regions.length} zone cu date personale, fără decizia utilizatorului.`, recommendation: "Întreabă utilizatorul: estompez datele personale sau le las vizibile? (Studio → Materiale sau mms pii)" });
        else if (a.pii.blurApproved && (l.capability !== "media.screen" || !l.children.some((c) => c.capability === "ui.blur-region")))
          add({ frame: sceneFrom + l.from, sceneId, dimension: "assets", severity: "critical", problem: `Estomparea datelor personale din „${a.originalName}” nu se poate aplica în ${l.capability}.`, recommendation: "Folosește captura într-o rețetă cu media.screen (ecran plat) sau alt material fără date personale." });
      }
      if (SCREEN_CAPS.has(l.capability) && a.origin !== "real_capture" && a.origin !== "user_provided") add({ frame: sceneFrom + l.from, sceneId, dimension: "real-footage", severity: "critical", problem: `Interfața din ${l.capability} vine din „${a.origin}”, nu din captură reală sau de la utilizator.`, recommendation: "Interfața produsului nu se inventează: capturează-o (mms capture) sau cere fișierul utilizatorului." });
    }
    // cifrele din grafice și contoare au nevoie de o afirmație verificată
    if (DATA_CAPS.has(l.capability)) {
      const id = l.params.claimId as string | undefined;
      const c = id ? claims.get(id) : undefined;
      if (!c || !isClaimUsable(c)) add({ frame: sceneFrom + l.from, sceneId, dimension: "claims", severity: "critical", problem: `${l.capability} afișează cifre fără afirmație verificată (claimId ${id ?? "lipsă"}).`, recommendation: "Leagă cifra de o afirmație din research confirmată de utilizator, sau scoate graficul." });
    }
    // text: zona de siguranță și lizibilitatea la 360 px
    if (TEXT_CAPS.has(l.capability) && !parentScreen && l.depth === 0) {
      textLayers++;
      const at = sceneFrom + l.from;
      if (!rectInside(l.box, safe.rect, 2)) add({ frame: at, sceneId, dimension: "safe-zone", severity: "high", problem: `Textul „${String(l.params.text ?? "").slice(0, 40)}” iese din zona de siguranță a platformei.`, recommendation: "Mută sau micșorează cutia textului în interiorul zonei sigure." });
      for (const ex of safe.exclusions) if (rectsOverlap(l.box, ex)) add({ frame: at, sceneId, dimension: "safe-zone", severity: "high", problem: `Textul se suprapune cu ${ex.label}.`, recommendation: "Mută textul în afara zonei butoanelor platformei." });
      const size = typeof l.params.fontSize === "number" ? l.params.fontSize : null;
      if (size !== null) {
        // testul de 360 px: latura scurtă a video-ului afișată la 360 px (telefon ținut pe orizontală sau pe verticală)
        const at360 = (size * 360) / Math.min(t.width, t.height);
        minAt360 = minAt360 === null ? at360 : Math.min(minAt360, at360);
        const limit = l.role === "hero" ? 12 : 9;
        if (at360 < limit) add({ frame: at, sceneId, layerId: l.id, dimension: "readability", severity: "high", problem: `Text prea mic la testul de 360 px: ${at360.toFixed(1)} px (minim ${limit}).`, recommendation: "Scurtează textul sau mărește cutia." });
      }
      const text = String(l.params.text ?? "");
      const visibleSec = l.durationInFrames / t.fps;
      if (text && visibleSec < readingSec(text) - 0.05) {
        const scene = t.scenes.find((x) => x.id === sceneId);
        const missing = Math.ceil((readingSec(text) - visibleSec + 0.15) * 10) / 10;
        add({ frame: at, sceneId, layerId: l.id, durationSec: visibleSec, dimension: "readability", severity: "high", problem: `„${text.slice(0, 40)}” stă ${visibleSec.toFixed(2)} s, sub timpul de citire (${readingSec(text).toFixed(2)} s).`, recommendation: "Prelungește scena sau scurtează textul.", suggestedFix: scene ? [{ op: "scene-extend", sceneId, deltaSec: missing, currentSec: scene.durationInFrames / t.fps }] : [], confidence: 0.95 });
      }
    }
    l.children.forEach((c) => visit(c, sceneId, sceneFrom + l.from, parentScreen || l.capability === "media.screen"));
  };
  for (const s of t.scenes) {
    for (const l of s.layers) visit(l, s.id, s.from, false);
    if (s.transitionIn && s.transitionIn.durationInFrames > s.durationInFrames * 0.6) add({ frame: s.from, sceneId: s.id, dimension: "timing", severity: "medium", problem: "Tranziția ocupă peste 60% din scenă.", recommendation: "Scurtează tranziția sau prelungește scena.", suggestedFix: [{ op: "set-transition", sceneId: s.id, capability: s.transitionIn.capability, durationFrames: Math.max(2, Math.round(((s.durationInFrames * 0.4) * 30) / t.fps)) }] });
    if (s.meta.narrativeRole === "cta") {
      const holdStart = s.durationInFrames - Math.round(2.5 * t.fps);
      if (holdStart < 0) add({ frame: s.from, sceneId: s.id, dimension: "cta", severity: "high", problem: "Cardul final e mai scurt de 2,5 s.", recommendation: "Prelungește scena CTA (hold fără mișcare la momentul deciziei).", suggestedFix: [{ op: "scene-extend", sceneId: s.id, deltaSec: Math.ceil((-holdStart / t.fps + 0.2) * 10) / 10, currentSec: s.durationInFrames / t.fps }] });
      if (s.camera.keys.some((k) => k.at > holdStart) || s.camera.handheld > 0) add({ frame: s.from + Math.max(0, holdStart), sceneId: s.id, dimension: "cta", severity: "medium", problem: "Camera încă se mișcă în timpul hold-ului de pe CTA.", recommendation: "Folosește camera.static pe cardul final.", suggestedFix: [{ op: "set-camera", sceneId: s.id, capability: "camera.static", params: {} }] });
    }
  }
  // subtitrările: fiecare poziție a benzii în zona sigură și fără suprapunere cu textul principal în același timp
  if (t.captions) {
    const segs = captionBoxes(t);
    for (const seg of segs) if (!rectInside(seg.box, safe.rect, 2)) add({ frame: seg.from, sceneId: null, dimension: "safe-zone", severity: "high", problem: "Subtitrările ies din zona de siguranță.", recommendation: "Recompilează cu formatul corect." });
    for (const s of t.scenes) {
      for (const l of s.layers) {
        if (!TEXT_CAPS.has(l.capability) || l.depth !== 0) continue;
        const a0 = s.from + l.from;
        const a1 = a0 + l.durationInFrames;
        const wordsHere = t.captions.words.filter((w) => w.from < a1 && w.to > a0);
        const clash = wordsHere.some((w) => rectsOverlap(l.box, boxAt(segs, w.from)));
        if (clash) add({ frame: a0, sceneId: s.id, layerId: l.id, dimension: "readability", severity: "high", problem: `Subtitrările se suprapun cu textul „${String(l.params.text ?? "").slice(0, 30)}”.`, recommendation: "Mută textul scenei mai sus sau dezactivează subtitrările arse." });
      }
    }
  }
  if (!t.scenes.some((s) => s.meta.narrativeRole === "cta")) add({ frame: null, sceneId: null, dimension: "cta", severity: "high", problem: "Nu există scenă de CTA.", recommendation: "Adaugă cardul final cu apelul la acțiune." });
  // drepturile: o problemă pe material (nu pe fiecare strat), cu scenele în care apare
  // capturile aceluiași site sunt o singură întrebare (regula 3), cu același text pe toate formatele
  const bySource = new Map<string, string[]>();
  for (const [id, u] of unlicensed) {
    const a = ctx.assets.assets.find((x) => x.id === id);
    const src = a ? captureSource(ctx.assets, a) : null;
    if (!src) {
      add({ frame: u.frame, sceneId: u.sceneId, dimension: "rights", severity: t.concept ? "high" : "critical", problem: `„${u.name}” aparține unui terț și nu are drepturi confirmate (în ${u.scenes.size} ${u.scenes.size === 1 ? "scenă" : "scene"}: ${[...u.scenes].join(", ")}). Preview-ul e marcat „concept”, iar exportul final e blocat.`, recommendation: "Întreabă utilizatorul o singură dată: „Ai dreptul să-l folosești?”. Da: mms rights <proiect> <assetId> confirmed. Nu: înlocuiește materialul." });
      continue;
    }
    (bySource.get(src) ?? bySource.set(src, []).get(src)!).push(u.name);
  }
  for (const [src, names] of bySource)
    add({ frame: null, sceneId: null, dimension: "rights", severity: t.concept ? "high" : "critical", problem: `Capturile de pe ${src} aparțin unui terț și nu au drepturi confirmate. Preview-ul e marcat „concept”, iar exportul final e blocat.`, recommendation: `Întreabă utilizatorul o singură dată: „Ai dreptul să folosești capturile de pe ${src}?”. Da: mms rights <proiect> --source ${src} confirmed (toate capturile site-ului). Nu: înlocuiește materialele (${names.join(", ")}).` });
  if (t.concept && !unlicensed.size) add({ frame: null, sceneId: null, dimension: "rights", severity: "high", problem: "Timeline-ul folosește materiale fără drepturi confirmate (preview „concept”).", recommendation: "Confirmă drepturile sau înlocuiește materialele înainte de exportul final." });
  const ok = !findings.some((f) => f.severity === "critical");
  return { ok, findings, stats: { flashes: flashes.length, maxFlashesPerSec: maxPerSec, textLayers, minFontAt360: minAt360 === null ? null : Math.round(minAt360 * 10) / 10 } };
}
