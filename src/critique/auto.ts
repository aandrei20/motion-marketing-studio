/**
 * Critica automată, cu rubrica fixă din CLAUDE.md: hook, claritate, ritm, ierarhie vizuală,
 * varietate, fidelitate față de brand, apel la acțiune. Același „reviewer” (mms-auto-critic-v1) și
 * aceeași rubrică în toate rundele. Fiecare depunctare devine o problemă structurată (src/quality/issues.ts),
 * cu corectură sugerată acolo unde schimbarea e mecanică și sigură. Revizuirea vizuală a lui Claude
 * (pe foaia de contact și cadre) se adaugă separat, cu reviewer „claude-visual”.
 */
import { contrastRatio } from "../motion/core/color";
import { RUBRIC_KEYS, type Brief, type Critique, type CritiqueRound, type EditOp, type Finding, type MixReport, type RubricKey, type SceneScore, type Severity, type Timeline, type TimelineLayer } from "../core/schema";
import { readingSec } from "../editing/grammar";
import type { DirectionProfile } from "../creative/directions";
import type { ValidationResult } from "../timeline/validate";
import type { VideoCheck } from "../renderer/node/analyze-video";
import { issueCollector, type IssueDraft } from "../quality/issues";
import { LAYOUT_TEXT_CAPS } from "../motion/text-caps";

export const REVIEWER = "mms-auto-critic-v1";

const TEXT = (c: string) => c.startsWith("text.") && c !== "text.captions";

function flat(layers: TimelineLayer[]): TimelineLayer[] {
  return layers.flatMap((l) => [l, ...flat(l.children)]);
}

export interface CritiqueInput {
  timeline: Timeline;
  brief: Brief;
  dir: DirectionProfile;
  validation: ValidationResult;
  mix: MixReport | null;
  video: VideoCheck | null;
}

type Draft = Omit<IssueDraft, "dimension">;

/** Scena care conține un cadru absolut (ultima care a început, ca la tranziții). */
export function sceneAtFrame(t: Timeline, frame: number): string | null {
  const s = [...t.scenes].reverse().find((x) => frame >= x.from && frame < x.from + x.durationInFrames);
  return s?.id ?? null;
}

export function autoCritique(inp: CritiqueInput, round: number, versionId: string): CritiqueRound {
  const { timeline: t, brief } = inp;
  const fps = t.fps;
  const col = issueCollector(`r${round}-`, round, fps);
  const sceneScores: SceneScore[] = [];
  const recipes = t.scenes.map((s) => s.meta.recipe);
  const camCaps = t.scenes.map((s) => (s.camera.keys.length > 1 ? `${s.camera.keys[0].zoom.toFixed(2)}→${s.camera.keys[s.camera.keys.length - 1].zoom.toFixed(2)}` : "fix") + (s.camera.handheld ? "h" : "") + (s.camera.punches.length ? "p" : ""));
  const transitions = t.scenes.map((s) => s.transitionIn?.capability ?? "start");
  const textContrast = contrastRatio(t.palette.text, t.palette.background);
  // o altă mișcare decât cea curentă; o scenă care deja împinge spre zonă nu primește iar „camera.push” (ar ieși la fel)
  const altCamera = (current: string, pushing = false) => [inp.dir.camera.calm, inp.dir.camera.active, inp.dir.camera.ui, "camera.parallax-drift", "camera.push"].find((c) => c !== current && c !== "camera.static" && !(pushing && c === "camera.push")) ?? "camera.parallax-drift";
  const pool = [...inp.dir.transitions.calm, ...inp.dir.transitions.rise];
  t.scenes.forEach((s, i) => {
    const scores: Record<RubricKey, number> = { hook: 10, clarity: 10, rhythm: 10, hierarchy: 10, variety: 10, brand: 10, cta: 10 };
    const notes: string[] = [];
    const layers = flat(s.layers);
    const texts = layers.filter((l) => TEXT(l.capability));
    const heroes = s.layers.filter((l) => l.role === "hero");
    const secs = s.durationInFrames / fps;
    /** depunctare pe rubrică + problema structurată care o explică (fiecare depunctare are o problemă) */
    const ded = (k: RubricKey, v: number, note: string, f: Partial<Draft> & { severity?: Severity } = {}) => {
      scores[k] = Math.max(1, scores[k] - v);
      notes.push(note);
      col.add({ frame: s.from, sceneId: s.id, severity: "low", problem: note, recommendation: "Vezi nota scenei.", ...f, dimension: k });
    };
    // hook: prima scenă
    if (i === 0) {
      const firstTextLayer = texts.length ? texts.reduce((a, b) => (b.from < a.from ? b : a)) : null;
      const firstText = firstTextLayer ? firstTextLayer.from : Infinity;
      if (firstText > fps * 0.5) {
        const fix: EditOp[] = firstTextLayer ? [{ op: "layer-shift", sceneId: s.id, slot: firstTextLayer.id, deltaSec: -Math.round(((firstText - fps * 0.15) / fps) * 100) / 100 }] : [];
        ded("hook", 3, "Primul text apare după 0,5 s.", { frame: s.from + (Number.isFinite(firstText) ? firstText : 0), severity: "high", layerId: firstTextLayer?.id ?? null, problem: "Hook-ul nu are text în prima jumătate de secundă.", recommendation: "Pune mesajul hook-ului din primul cadru (scroll-ul se oprește în <1 s).", suggestedFix: fix, confidence: 0.85 });
      }
      if (secs > 3.5) ded("hook", 2, "Hook lung.", { severity: "medium", durationSec: secs, problem: `Hook-ul durează ${secs.toFixed(1)} s.`, recommendation: "Ține hook-ul sub 3 s; mută explicațiile în scenele următoare (decizie de script: Claude/utilizator)." });
      if (s.meta.energy < 0.6) ded("hook", 2, "Energie mică în hook.", { severity: "medium", problem: "Hook cu energie scăzută.", recommendation: "Crește energia: text cu impact, cameră pe ritm, un sunet la start.", suggestedFix: [{ op: "scene-energy", sceneId: s.id, energy: 0.75 }], confidence: 0.6 });
      const words = texts.reduce((m, l) => Math.max(m, String(l.params.text ?? "").split(/\s+/).length), 0);
      if (words > 9) ded("hook", 2, "Hook cu multe cuvinte.", { severity: "medium", problem: `Hook-ul are ${words} cuvinte pe ecran.`, recommendation: "Maximum 7–9 cuvinte în hook (decizie de script: Claude/utilizator)." });
      const startCue = t.audio.cues.some((c) => c.kind === "sfx" && c.atFrame <= s.from + 6);
      if (!startCue && brief.audio.sfxDensity !== "none" && !brief.audio.intentionalSilence) ded("hook", 1, "Fără accent sonor la start.", { problem: "Hook-ul începe fără niciun accent sonor.", recommendation: "Un impact sau un whoosh în primele 0,2 s ajută oprirea scroll-ului.", category: "audio" });
    } else scores.hook = 10;
    // claritate: un mesaj, cuvinte puține, timp de citire, contrast
    for (const l of texts) {
      const txt = String(l.params.text ?? "");
      const w = txt.split(/\s+/).filter(Boolean).length;
      if (w > 10 && l.role === "hero") ded("clarity", 2, "Text principal lung.", { frame: s.from + l.from, layerId: l.id, severity: "medium", problem: `Textul principal are ${w} cuvinte.`, recommendation: "Scurtează la un singur mesaj de maximum 8 cuvinte; restul în voce (decizie de script)." });
      if (LAYOUT_TEXT_CAPS.has(l.capability) && l.durationInFrames / fps < readingSec(txt)) {
        const delta = Math.ceil((readingSec(txt) - l.durationInFrames / fps + 0.15) * 10) / 10;
        ded("clarity", 2, "Text prea scurt pe ecran.", { frame: s.from + l.from, layerId: l.id, durationSec: l.durationInFrames / fps, severity: "high", problem: `„${txt.slice(0, 30)}” nu stă destul cât să fie citit.`, recommendation: "Prelungește scena sau scurtează textul.", suggestedFix: [{ op: "scene-extend", sceneId: s.id, deltaSec: delta, currentSec: secs }], confidence: 0.95 });
      }
    }
    if (textContrast < 4.5) ded("clarity", 3, "Contrast text/fundal mic.", { severity: "high", problem: `Contrast ${textContrast.toFixed(1)}:1 între text și fundal (minim 4.5:1).`, recommendation: "Ajustează culorile de text sau de fundal din brand kit (decizie de brand)." });
    const blocking = inp.validation.findings.filter((f) => f.sceneId === s.id && (f.dimension === "readability" || f.dimension === "safe-zone"));
    if (blocking.length) {
      scores.clarity = Math.max(1, scores.clarity - Math.min(4, blocking.length * 2));
      notes.push(`${blocking.length} probleme de lizibilitate sau zone de siguranță (vezi validarea).`);
    }
    // ritm: durata vs direcția, varietatea duratelor
    const [lo, hi] = inp.dir.shotSec;
    const voiced = t.audio.cues.some((c) => c.kind === "voice" && c.sceneId === s.id);
    if (!voiced && s.meta.narrativeRole !== "cta" && secs > hi * 1.9) ded("rhythm", 2, "Scenă lungă fără voce.", { severity: "medium", durationSec: secs, problem: `${secs.toFixed(1)} s fără voce, peste ritmul direcției (${lo}–${hi} s).`, recommendation: "Scurtează scena sau adaugă o replică/un eveniment vizual.", suggestedFix: [{ op: "scene-extend", sceneId: s.id, deltaSec: -Math.round((secs - hi * 1.5) * 10) / 10, currentSec: secs }], confidence: 0.6 });
    if (i > 0) {
      const prev = t.scenes[i - 1].durationInFrames;
      const next = t.scenes[i + 1]?.durationInFrames;
      if (Math.abs(prev - s.durationInFrames) < 3 && next !== undefined && Math.abs(next - s.durationInFrames) < 3)
        ded("rhythm", 1, "Trei scene la rând cu aceeași durată (ritm monoton).", { problem: "Trei scene la rând au aceeași durată: ritmul devine monoton.", recommendation: "Variază durata (una mai scurtă, una mai lungă).", suggestedFix: [{ op: "scene-extend", sceneId: s.id, deltaSec: 0.4, currentSec: secs }], confidence: 0.6 });
    }
    if (t.audio.beatGrid && i > 0 && (t.audio.beatGrid.confidence ?? 1) >= 0.35) {
      const beat = (60 / t.audio.beatGrid.bpm) * fps;
      const cut = s.from + Math.floor((s.transitionIn?.durationInFrames ?? 0) / 2);
      const off = ((cut - t.audio.beatGrid.offsetSec * fps) % beat + beat) % beat;
      const dist = Math.min(off, beat - off);
      if (dist > 3) {
        const prevScene = t.scenes[i - 1];
        const later = (beat - off) / fps;
        ded("rhythm", 1, `Tăietura e la ${dist.toFixed(0)} cadre de bătaie.`, { frame: cut, problem: `Tăietura dintre ${prevScene.id} și ${s.id} cade la ${dist.toFixed(0)} cadre de bătaie.`, recommendation: "Mută tăietura pe bătaie (scena anterioară puțin mai lungă).", suggestedFix: [{ op: "scene-extend", sceneId: prevScene.id, deltaSec: Math.round(later * 100) / 100, currentSec: prevScene.durationInFrames / fps }], confidence: 0.7, category: "audio" });
      }
    }
    // ierarhie: un singur erou, mărimi diferite între principal și secundar
    if (heroes.length > 3) ded("hierarchy", 2, "Prea multe elemente principale.", { severity: "medium", problem: `${heroes.length} straturi marcate „hero” în aceeași scenă.`, recommendation: "Un singur mesaj principal pe moment; restul secundar (decizie de compoziție)." });
    const heroTexts = texts.filter((l) => l.role === "hero");
    const supTexts = texts.filter((l) => l.role !== "hero" && typeof l.params.fontSize === "number");
    const heroSize = Math.max(0, ...heroTexts.map((l) => Number(l.params.fontSize ?? 0)));
    const sup = supTexts.reduce<TimelineLayer | null>((a, b) => (!a || Number(b.params.fontSize) > Number(a.params.fontSize) ? b : a), null);
    const supSize = sup ? Number(sup.params.fontSize) : 0;
    if (heroSize && supSize && heroSize < supSize * 1.4)
      ded("hierarchy", 2, "Textul principal nu e destul de mare față de cel secundar.", { layerId: sup?.id ?? null, severity: "medium", problem: `Raport ${(heroSize / supSize).toFixed(2)} între textul principal și cel secundar.`, recommendation: "Măcar 1,4× diferență de mărime între niveluri.", suggestedFix: sup ? [{ op: "layer-params", sceneId: s.id, slot: sup.id, params: { maxSize: Math.max(12, Math.floor(heroSize / 1.5)) } }] : [], confidence: 0.75 });
    // varietate: aceeași rețetă/cameră/tranziție de mai multe ori la rând
    if (i > 0 && recipes[i] === recipes[i - 1] && camCaps[i] === camCaps[i - 1] && s.meta.narrativeRole !== "cta")
      ded("variety", 3, "Aceeași rețetă și aceeași mișcare ca scena anterioară.", { severity: "medium", problem: "Două scene la rând arată la fel (aceeași rețetă și cameră).", recommendation: "Schimbă camera sau rețeta (de ex. walkthrough în loc de spotlight).", suggestedFix: [{ op: "set-camera", sceneId: s.id, capability: altCamera(inp.dir.camera.ui, s.camera.keys.length > 1 && s.camera.keys[s.camera.keys.length - 1].zoom > s.camera.keys[0].zoom), params: {} }], confidence: 0.65 });
    if (i > 1 && transitions[i] === transitions[i - 1] && transitions[i] === transitions[i - 2]) {
      const alt = pool.find((x) => x !== transitions[i]) ?? "tr.cut";
      ded("variety", 2, "Aceeași tranziție de 3 ori la rând.", { problem: `Tranziția ${transitions[i]} se repetă de 3 ori la rând.`, recommendation: "Alternează tranziția (aceeași tranziție nu se repetă de două ori la rând).", suggestedFix: [{ op: "set-transition", sceneId: s.id, capability: alt, durationFrames: null }], confidence: 0.75 });
    }
    // brand: logo la revelare și la final
    if ((s.meta.narrativeRole === "reveal" || s.meta.narrativeRole === "cta") && !layers.some((l) => l.capability.startsWith("logo.")))
      ded("brand", 3, "Fără logo la revelare/final.", { severity: "medium", problem: "Scena de revelare/final nu arată logo-ul.", recommendation: "Adaugă logo-ul oficial (dacă există în materiale) sau o rețetă cu slot de logo." });
    // CTA: ultima scenă, hold fără mișcare
    if (s.meta.narrativeRole === "cta") {
      const hold = s.durationInFrames - Math.max(0, ...s.camera.keys.map((k) => k.at));
      if (hold < 2.5 * fps) ded("cta", 4, "Hold scurt pe CTA.", { severity: "high", durationSec: hold / fps, problem: `CTA-ul stă nemișcat doar ${(hold / fps).toFixed(1)} s.`, recommendation: "Minimum 2,5 s fără mișcare la momentul deciziei.", suggestedFix: [{ op: "set-camera", sceneId: s.id, capability: "camera.static", params: {} }, ...(secs < 2.7 ? [{ op: "scene-extend" as const, sceneId: s.id, deltaSec: Math.ceil((2.7 - secs) * 10) / 10, currentSec: secs }] : [])], confidence: 0.9 });
      if (!texts.some((l) => String(l.params.text ?? "").includes(brief.cta.text))) ded("cta", 4, "Textul CTA diferă de brief.", { severity: "high", problem: `CTA-ul de pe ecran nu e exact „${brief.cta.text}”.`, recommendation: "Folosește textul CTA din brief, cuvânt cu cuvânt.", suggestedFix: [{ op: "scene-text", sceneId: s.id, sub: brief.cta.text }], confidence: 0.6 });
      if (i !== t.scenes.length - 1) ded("cta", 3, "CTA-ul nu e ultima scenă.", { severity: "medium", problem: "Apelul la acțiune nu e ultima scenă.", recommendation: "Mută CTA-ul la final.", suggestedFix: [{ op: "scene-move", sceneId: s.id, to: t.scenes.length - 1 }], confidence: 0.8 });
    }
    sceneScores.push({ sceneId: s.id, scores, notes });
  });
  if (!t.scenes.some((s) => s.meta.narrativeRole === "cta")) for (const s of sceneScores) s.scores.cta = Math.min(s.scores.cta, 3);
  // probleme tehnice globale: audio și video randat
  if (inp.mix && !inp.mix.ok) for (const p of inp.mix.problems) col.add({ frame: null, sceneId: null, dimension: "audio", severity: "high", problem: p, recommendation: "Recalculează mixul; ajustează muzica sau efectele.", method: "audio" });
  if (inp.video) for (const d of videoIssues(t, inp.video)) col.add(d);
  const findings: Finding[] = [...col.issues];
  for (const v of inp.validation.findings) if (v.severity === "critical" || v.severity === "high") findings.push({ ...v, id: `r${round}-v-${v.id}`, round });
  const overall = Object.fromEntries(RUBRIC_KEYS.map((k) => [k, Math.round((sceneScores.reduce((s, x) => s + x.scores[k], 0) / Math.max(1, sceneScores.length)) * 10) / 10])) as Record<RubricKey, number>;
  const minScene = Math.min(...sceneScores.map((s) => Math.min(...RUBRIC_KEYS.map((k) => s.scores[k]))));
  return { n: round, at: new Date().toISOString(), versionId, reviewer: REVIEWER, rubricVersion: "rubric-v1", sceneScores, findings, overall, minScene };
}

/** Problemele găsite în video-ul randat (cadre negre, flash-uri, înghețări), legate de scena lor. */
export function videoIssues(t: Timeline, video: VideoCheck): IssueDraft[] {
  const fps = t.fps;
  const out: IssueDraft[] = [];
  for (const f of video.blackFrames.slice(0, 1)) out.push({ frame: f, sceneId: sceneAtFrame(t, f), dimension: "black-frame", severity: "critical", problem: `${video.blackFrames.length} cadre (aproape) negre în video-ul randat.`, recommendation: "Verifică tranziția sau scena de la acel timecode.", method: "full-render" });
  if (video.maxFlashesPerSec > 2) out.push({ frame: video.flashes[0] ?? null, sceneId: video.flashes[0] !== undefined ? sceneAtFrame(t, video.flashes[0]) : null, dimension: "flash", severity: "critical", problem: `Până la ${video.maxFlashesPerSec} flash-uri pe secundă (maximum 2).`, recommendation: "Înlocuiește tranzițiile flash apropiate cu cut sau push.", method: "full-render" });
  for (const r of video.frozenRuns) {
    const sc = t.scenes.find((x) => x.id === sceneAtFrame(t, r.from));
    out.push({ frame: r.from, sceneId: sc?.id ?? null, durationSec: (r.to - r.from) / fps, dimension: "motion", severity: "medium", problem: `Imagine înghețată ${((r.to - r.from) / fps).toFixed(1)} s.`, recommendation: "Adaugă mișcare discretă (camera.parallax-drift) sau scurtează scena.", method: "full-render", suggestedFix: sc && sc.meta.narrativeRole !== "cta" ? [{ op: "set-camera", sceneId: sc.id, capability: "camera.parallax-drift", params: {} }] : [], confidence: 0.7 });
  }
  return out;
}

export interface LoopDecision {
  passed: boolean;
  /** la fiecare 3 runde, utilizatorul vede progresul și decide */
  checkpoint: boolean;
  /** două runde la rând fără îmbunătățire → oprire */
  stop: boolean;
  message: string;
}

/**
 * Regulile buclei de calitate (regula 7). Rundele se compară doar între ele: același reviewer și,
 * pentru rundele cu scor de calitate, aceeași adâncime de verificare.
 */
export function loopDecision(c: Critique): LoopDecision {
  const own = c.rounds.filter((r) => r.reviewer === REVIEWER);
  const last = own[own.length - 1];
  if (!last) return { passed: false, checkpoint: false, stop: false, message: "Nicio rundă de critică încă." };
  const rounds = own.filter((r) => (r.depth ?? null) === (last.depth ?? null));
  const blocking = last.findings.some((f) => f.severity === "critical" && f.status === "open");
  const rubricOk = last.minScene >= c.threshold && !blocking;
  const passed = last.quality ? rubricOk && last.quality.verdict === "PASS" : rubricOk;
  const avg = (r: CritiqueRound) => (r.quality ? r.quality.overall / 10 : RUBRIC_KEYS.reduce((s, k) => s + r.overall[k], 0) / RUBRIC_KEYS.length);
  let stalled = 0;
  for (let i = rounds.length - 1; i > 0 && stalled < 2; i--) {
    if (avg(rounds[i]) <= avg(rounds[i - 1]) + 0.05 && rounds[i].minScene <= rounds[i - 1].minScene) stalled++;
    else break;
  }
  const stop = !passed && stalled >= 2;
  const checkpoint = rounds.length % 3 === 0;
  const q = last.quality ? ` · calitate ${last.quality.overall}/100 (${last.quality.verdict})` : "";
  const message = passed
    ? `Toate scenele au cel puțin ${c.threshold}/10${q}.`
    : stop
      ? `Două runde la rând fără îmbunătățire: mă opresc și îți arăt unde am rămas${q}.`
      : checkpoint
        ? `Runda ${rounds.length}: bilanț pentru utilizator (scor minim ${last.minScene}/10${q}).`
        : `Scor minim ${last.minScene}/10 (prag ${c.threshold})${q}; continui corecțiile.`;
  return { passed, checkpoint, stop, message };
}
