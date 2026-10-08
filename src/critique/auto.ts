/**
 * Critica automată, cu rubrica fixă din CLAUDE.md: hook, claritate, ritm, ierarhie vizuală,
 * varietate, fidelitate față de brand, apel la acțiune. Același „reviewer” (mms-auto-critic-v1) și
 * aceeași rubrică în toate rundele. Scorurile sunt explicate prin observații cu timecode.
 * Revizuirea vizuală a lui Claude (pe foaia de contact) se adaugă separat, cu reviewer „claude-visual”.
 */
import { contrastRatio } from "../motion/core/color";
import { formatTimecode } from "../core/time";
import { RUBRIC_KEYS, type Brief, type Critique, type CritiqueRound, type Finding, type MixReport, type RubricKey, type SceneScore, type Timeline, type TimelineLayer } from "../core/schema";
import { readingSec } from "../editing/grammar";
import type { DirectionProfile } from "../creative/directions";
import type { ValidationResult } from "../timeline/validate";
import type { VideoCheck } from "../renderer/node/analyze-video";

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

export function autoCritique(inp: CritiqueInput, round: number, versionId: string): CritiqueRound {
  const { timeline: t, brief } = inp;
  const fps = t.fps;
  const findings: Finding[] = [];
  let n = 0;
  const add = (f: Omit<Finding, "id" | "round" | "source" | "status" | "timecode">) => findings.push({ ...f, id: `r${round}-${++n}`, round, source: "auto-check", status: "open", timecode: f.frame === null ? null : formatTimecode(f.frame, fps) });
  const sceneScores: SceneScore[] = [];
  const recipes = t.scenes.map((s) => s.meta.recipe);
  const cams = t.scenes.map((s) => (s.camera.keys.length > 1 ? `${s.camera.keys[0].zoom.toFixed(2)}→${s.camera.keys[s.camera.keys.length - 1].zoom.toFixed(2)}` : "fix") + (s.camera.handheld ? "h" : "") + (s.camera.punches.length ? "p" : ""));
  const transitions = t.scenes.map((s) => s.transitionIn?.capability ?? "start");
  const textContrast = contrastRatio(t.palette.text, t.palette.background);
  t.scenes.forEach((s, i) => {
    const scores: Record<RubricKey, number> = { hook: 10, clarity: 10, rhythm: 10, hierarchy: 10, variety: 10, brand: 10, cta: 10 };
    const notes: string[] = [];
    const layers = flat(s.layers);
    const texts = layers.filter((l) => TEXT(l.capability));
    const heroes = s.layers.filter((l) => l.role === "hero");
    const secs = s.durationInFrames / fps;
    const ded = (k: RubricKey, v: number, note: string, f: Omit<Finding, "id" | "round" | "source" | "status" | "timecode" | "dimension"> | null = null) => {
      scores[k] = Math.max(1, scores[k] - v);
      notes.push(note);
      if (f) add({ ...f, dimension: k });
    };
    // hook: prima scenă
    if (i === 0) {
      const firstText = texts.length ? Math.min(...texts.map((l) => l.from)) : Infinity;
      if (firstText > fps * 0.5) ded("hook", 3, "Primul text apare după 0,5 s.", { frame: s.from + (Number.isFinite(firstText) ? firstText : 0), sceneId: s.id, severity: "major", problem: "Hook-ul nu are text în prima jumătate de secundă.", recommendation: "Pune mesajul hook-ului din primul cadru (scroll-ul se oprește în <1 s)." });
      if (secs > 3.5) ded("hook", 2, "Hook lung.", { frame: s.from, sceneId: s.id, severity: "minor", problem: `Hook-ul durează ${secs.toFixed(1)} s.`, recommendation: "Ține hook-ul sub 3 s; mută explicațiile în scenele următoare." });
      if (s.meta.energy < 0.6) ded("hook", 2, "Energie mică în hook.", { frame: s.from, sceneId: s.id, severity: "minor", problem: "Hook cu energie scăzută.", recommendation: "Crește energia: text cu impact, cameră pe ritm, un sunet la start." });
      const words = texts.reduce((m, l) => Math.max(m, String(l.params.text ?? "").split(/\s+/).length), 0);
      if (words > 9) ded("hook", 2, "Hook cu multe cuvinte.", { frame: s.from, sceneId: s.id, severity: "minor", problem: `Hook-ul are ${words} cuvinte pe ecran.`, recommendation: "Maximum 7–9 cuvinte în hook." });
      const startCue = t.audio.cues.some((c) => c.kind === "sfx" && c.atFrame <= s.from + 6);
      if (!startCue && brief.audio.sfxDensity !== "none" && !brief.audio.intentionalSilence) ded("hook", 1, "Fără accent sonor la start.");
    } else scores.hook = 10;
    // claritate: un mesaj, cuvinte puține, timp de citire, contrast
    for (const l of texts) {
      const txt = String(l.params.text ?? "");
      const w = txt.split(/\s+/).filter(Boolean).length;
      if (w > 10 && l.role === "hero") ded("clarity", 2, "Text principal lung.", { frame: s.from + l.from, sceneId: s.id, severity: "minor", problem: `Textul principal are ${w} cuvinte.`, recommendation: "Scurtează la un singur mesaj de maximum 8 cuvinte; restul în voce." });
      if (l.durationInFrames / fps < readingSec(txt)) ded("clarity", 2, "Text prea scurt pe ecran.", { frame: s.from + l.from, sceneId: s.id, severity: "major", problem: `„${txt.slice(0, 30)}” nu stă destul cât să fie citit.`, recommendation: "Prelungește scena sau scurtează textul." });
    }
    if (textContrast < 4.5) ded("clarity", 3, "Contrast text/fundal mic.", { frame: s.from, sceneId: s.id, severity: "major", problem: `Contrast ${textContrast.toFixed(1)}:1 între text și fundal (minim 4.5:1).`, recommendation: "Ajustează culorile de text sau de fundal din brand kit." });
    const blocking = inp.validation.findings.filter((f) => f.sceneId === s.id && (f.dimension === "readability" || f.dimension === "safe-zone"));
    if (blocking.length) ded("clarity", Math.min(4, blocking.length * 2), `${blocking.length} probleme de lizibilitate sau zone de siguranță.`);
    // ritm: durata vs direcția, varietatea duratelor
    const [lo, hi] = inp.dir.shotSec;
    const voiced = t.audio.cues.some((c) => c.kind === "voice" && c.sceneId === s.id);
    if (!voiced && s.meta.narrativeRole !== "cta" && secs > hi * 1.9) ded("rhythm", 2, "Scenă lungă fără voce.", { frame: s.from, sceneId: s.id, severity: "minor", problem: `${secs.toFixed(1)} s fără voce, peste ritmul direcției (${lo}–${hi} s).`, recommendation: "Scurtează scena sau adaugă o replică/un eveniment vizual." });
    if (i > 0) {
      const prev = t.scenes[i - 1].durationInFrames;
      const next = t.scenes[i + 1]?.durationInFrames;
      if (Math.abs(prev - s.durationInFrames) < 3 && next !== undefined && Math.abs(next - s.durationInFrames) < 3) ded("rhythm", 1, "Trei scene la rând cu aceeași durată (ritm monoton).");
    }
    if (t.audio.beatGrid) {
      const beat = (60 / t.audio.beatGrid.bpm) * fps;
      const cut = s.from + Math.floor((s.transitionIn?.durationInFrames ?? 0) / 2);
      const off = ((cut - t.audio.beatGrid.offsetSec * fps) % beat + beat) % beat;
      const dist = Math.min(off, beat - off);
      if (i > 0 && dist > 3) ded("rhythm", 1, `Tăietura e la ${dist.toFixed(0)} cadre de bătaie.`);
    }
    // ierarhie: un singur erou, mărimi diferite între principal și secundar
    if (heroes.length > 3) ded("hierarchy", 2, "Prea multe elemente principale.", { frame: s.from, sceneId: s.id, severity: "minor", problem: `${heroes.length} straturi marcate „hero” în aceeași scenă.`, recommendation: "Un singur mesaj principal pe moment; restul secundar." });
    const heroSize = Math.max(0, ...texts.filter((l) => l.role === "hero").map((l) => Number(l.params.fontSize ?? 0)));
    const supSize = Math.max(0, ...texts.filter((l) => l.role !== "hero").map((l) => Number(l.params.fontSize ?? 0)));
    if (heroSize && supSize && heroSize < supSize * 1.4) ded("hierarchy", 2, "Textul principal nu e destul de mare față de cel secundar.", { frame: s.from, sceneId: s.id, severity: "minor", problem: `Raport ${(heroSize / supSize).toFixed(2)} între textul principal și cel secundar.`, recommendation: "Măcar 1,4× diferență de mărime între niveluri." });
    // varietate: aceeași rețetă/cameră/tranziție de mai multe ori la rând
    if (i > 0 && recipes[i] === recipes[i - 1] && cams[i] === cams[i - 1]) ded("variety", 3, "Aceeași rețetă și aceeași mișcare ca scena anterioară.", { frame: s.from, sceneId: s.id, severity: "minor", problem: "Două scene la rând arată la fel (aceeași rețetă și cameră).", recommendation: "Schimbă camera sau rețeta (de ex. walkthrough în loc de spotlight)." });
    if (i > 1 && transitions[i] === transitions[i - 1] && transitions[i] === transitions[i - 2]) ded("variety", 2, "Aceeași tranziție de 3 ori la rând.");
    // brand: logo la revelare și la final, culorile din paletă
    if ((s.meta.narrativeRole === "reveal" || s.meta.narrativeRole === "cta") && !layers.some((l) => l.capability.startsWith("logo."))) ded("brand", 3, "Fără logo la revelare/final.", { frame: s.from, sceneId: s.id, severity: "minor", problem: "Scena de revelare/final nu arată logo-ul.", recommendation: "Adaugă logo-ul oficial (dacă există în materiale)." });
    // CTA: ultima scenă, hold fără mișcare
    if (s.meta.narrativeRole === "cta") {
      const hold = s.durationInFrames - Math.max(0, ...s.camera.keys.map((k) => k.at));
      if (hold < 2.5 * fps) ded("cta", 4, "Hold scurt pe CTA.", { frame: s.from, sceneId: s.id, severity: "major", problem: `CTA-ul stă nemișcat doar ${(hold / fps).toFixed(1)} s.`, recommendation: "Minimum 2,5 s fără mișcare la momentul deciziei." });
      if (!texts.some((l) => String(l.params.text ?? "").includes(brief.cta.text))) ded("cta", 4, "Textul CTA diferă de brief.", { frame: s.from, sceneId: s.id, severity: "major", problem: `CTA-ul de pe ecran nu e exact „${brief.cta.text}”.`, recommendation: "Folosește textul CTA din brief, cuvânt cu cuvânt." });
      if (i !== t.scenes.length - 1) ded("cta", 3, "CTA-ul nu e ultima scenă.");
    }
    sceneScores.push({ sceneId: s.id, scores, notes });
  });
  if (!t.scenes.some((s) => s.meta.narrativeRole === "cta")) for (const s of sceneScores) s.scores.cta = Math.min(s.scores.cta, 3);
  // probleme tehnice globale: audio și video randat
  if (inp.mix && !inp.mix.ok) for (const p of inp.mix.problems) add({ frame: null, sceneId: null, dimension: "audio", severity: "major", problem: p, recommendation: "Recalculează mixul; ajustează muzica sau efectele." });
  if (inp.video) for (const p of inp.video.problems) add({ frame: inp.video.blackFrames[0] ?? inp.video.flashes[0] ?? null, sceneId: null, dimension: p.includes("flash") ? "flash" : p.includes("negre") ? "black-frame" : "timing", severity: "major", problem: p, recommendation: "Verifică scena la acel timecode." });
  for (const v of inp.validation.findings) if (v.severity === "blocker") findings.push({ ...v, id: `r${round}-${++n}`, round });
  const overall = Object.fromEntries(RUBRIC_KEYS.map((k) => [k, Math.round((sceneScores.reduce((s, x) => s + x.scores[k], 0) / Math.max(1, sceneScores.length)) * 10) / 10])) as Record<RubricKey, number>;
  const minScene = Math.min(...sceneScores.map((s) => Math.min(...RUBRIC_KEYS.map((k) => s.scores[k]))));
  return { n: round, at: new Date().toISOString(), versionId, reviewer: REVIEWER, rubricVersion: "rubric-v1", sceneScores, findings, overall, minScene };
}

export interface LoopDecision {
  passed: boolean;
  /** la fiecare 3 runde, utilizatorul vede progresul și decide */
  checkpoint: boolean;
  /** două runde la rând fără îmbunătățire → oprire */
  stop: boolean;
  message: string;
}

/** Regulile buclei de calitate (regula 7). */
export function loopDecision(c: Critique): LoopDecision {
  const rounds = c.rounds.filter((r) => r.reviewer === REVIEWER);
  const last = rounds[rounds.length - 1];
  if (!last) return { passed: false, checkpoint: false, stop: false, message: "Nicio rundă de critică încă." };
  const passed = last.minScene >= c.threshold && !last.findings.some((f) => f.severity === "blocker");
  const avg = (r: CritiqueRound) => RUBRIC_KEYS.reduce((s, k) => s + r.overall[k], 0) / RUBRIC_KEYS.length;
  let stalled = 0;
  for (let i = rounds.length - 1; i > 0 && stalled < 2; i--) {
    if (avg(rounds[i]) <= avg(rounds[i - 1]) + 0.05 && rounds[i].minScene <= rounds[i - 1].minScene) stalled++;
    else break;
  }
  const stop = !passed && stalled >= 2;
  const checkpoint = rounds.length % 3 === 0;
  const message = passed
    ? `Toate scenele au cel puțin ${c.threshold}/10.`
    : stop
      ? "Două runde la rând fără îmbunătățire: mă opresc și îți arăt unde am rămas."
      : checkpoint
        ? `Runda ${rounds.length}: bilanț pentru utilizator (scor minim ${last.minScene}).`
        : `Scor minim ${last.minScene}/10 (prag ${c.threshold}); continui corecțiile.`;
  return { passed, checkpoint, stop, message };
}
